#!/usr/bin/env node
/**
 * Проверка собранного справочника колледжей и вузов и фасада доступа к нему.
 *
 *   node scripts/edu-registry-check.mjs [<baza.sqlite3>]
 *
 * Без аргумента проверяется только сам справочник и фасад. Если передать
 * исходную выгрузку — добавляется сверка с источником: она единственная
 * ловит ошибки сборщика, все остальные проверки видят лишь его результат.
 *
 * Путь к справочнику берётся из EDU_DB_PATH, как и в рантайме.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  closeEduDb,
  normalizeRegionName,
  countEduOrgs,
  getEduDb,
  getEduOrg,
  getEduSourceDate,
  listEduOrgs,
} from "../src/lib/eduRegistry.js";

const checks = [];
const check = (name, fn) => checks.push([name, fn]);

/* ------------------------------------------------------- целостность файла */

check("справочник открывается и заполнен", () => {
  const db = getEduDb();
  const meta = Object.fromEntries(
    db.prepare("SELECT key, value FROM edu_meta").all().map((row) => [row.key, row.value])
  );

  const orgs = db.prepare("SELECT COUNT(*) AS c FROM edu_orgs").get().c;
  const licenses = db.prepare("SELECT COUNT(*) AS c FROM edu_licenses").get().c;

  assert.equal(orgs, Number(meta.orgs), "число организаций разошлось с записью о сборке");
  assert.equal(licenses, Number(meta.licenses), "число лицензий разошлось с записью о сборке");
  assert.ok(orgs > 4000, `организаций всего ${orgs} — справочник собран не целиком`);
  assert.equal(getEduSourceDate(), meta.source_date);
});

check("ИНН — строка, ведущие нули на месте", () => {
  const db = getEduDb();
  const withZero = db.prepare("SELECT COUNT(*) AS c FROM edu_orgs WHERE inn LIKE '0%'").get().c;

  // Приведение ИНН к числу где угодно в цепочке — самая дорогая из возможных
  // ошибок: организация просто перестаёт находиться, молча и навсегда.
  assert.ok(withZero > 0, "ни одного ИНН с ведущим нулём — где-то произошло приведение к числу");
  assert.equal(withZero, 298, `ИНН с ведущим нулём ${withZero}, ожидалось 298`);

  const sample = db.prepare("SELECT inn FROM edu_orgs WHERE inn LIKE '0%' LIMIT 1").get().inn;
  assert.equal(typeof sample, "string");
  assert.equal(sample.length, 10);
});

check("счётчики организации сходятся с её строками", () => {
  const db = getEduDb();

  // Проверка не самоисполняющаяся: колонки-счётчики заполняются в одном месте
  // сборщика, а строки вставляются в другом, и разъехаться они могут.
  const badPrograms = db
    .prepare(
      `SELECT COUNT(*) AS c FROM edu_orgs o
       WHERE o.programs_count <> (SELECT COUNT(*) FROM edu_programs p WHERE p.inn = o.inn)`
    )
    .get().c;
  assert.equal(badPrograms, 0, `у ${badPrograms} организаций programs_count не равен числу программ`);

  const badPlaces = db
    .prepare(
      `SELECT COUNT(*) AS c FROM edu_orgs o
       WHERE o.places_count <> (SELECT COUNT(*) FROM edu_places p WHERE p.inn = o.inn)`
    )
    .get().c;
  assert.equal(badPlaces, 0, `у ${badPlaces} организаций places_count не равен числу адресов`);

  const orphanLicenses = db
    .prepare(
      "SELECT COUNT(*) AS c FROM edu_licenses l WHERE NOT EXISTS (SELECT 1 FROM edu_orgs o WHERE o.inn = l.inn)"
    )
    .get().c;
  assert.equal(orphanLicenses, 0, "есть лицензии без организации");
});

check("каждый регион сходится со справочником портала", () => {
  const db = getEduDb();
  // Сверка по нормализованной форме, а не по строке: один и тот же субъект
  // пишется по-разному — «Архангельская обл» в реестре и «Архангельская
  // область» в справочнике портала, — и в соседней ветке этот файл как раз
  // переводят на полные слова. Точное сравнение сломалось бы при слиянии.
  const portal = new Set(
    fs
      .readFileSync(path.join(process.cwd(), "public", "data", "regions.txt"), "utf8")
      .split("\n")
      .map((line) => normalizeRegionName(line.trim()))
      .filter(Boolean)
  );

  const regions = db.prepare("SELECT DISTINCT region_portal FROM edu_orgs").all();
  const missing = regions.filter((row) => !portal.has(normalizeRegionName(row.region_portal)));

  // Несопоставленный регион означает, что выбранная в профиле организация
  // не найдётся в справочнике — молча, без единой ошибки в логе.
  assert.equal(
    missing.length,
    0,
    `не сходятся со справочником портала: ${missing.map((r) => r.region_portal).join(", ")}`
  );

  const codes = db.prepare("SELECT COUNT(DISTINCT region_code) AS c FROM edu_orgs").get().c;
  assert.equal(codes, 89, `субъектов ${codes}, ожидалось 89`);
});

check("адреса занятий очищены", () => {
  const db = getEduDb();
  const junk = db
    .prepare(
      `SELECT COUNT(*) AS c FROM edu_places
       WHERE trim(address) = '' OR lower(address) LIKE '%не предусмотрен%'`
    )
    .get().c;

  assert.equal(junk, 0, `${junk} адресов пусты или содержат отметку «не предусмотрено»`);
});

check("рейтинг лежит в шкале bus.gov.ru", () => {
  const db = getEduDb();
  // Шкала именно 0..100, а не 0..5: «не рассчитан» приходит как -1.0
  // и должен был превратиться в NULL, а не в ноль.
  const out = db
    .prepare("SELECT COUNT(*) AS c FROM edu_orgs WHERE rating IS NOT NULL AND (rating < 0 OR rating > 100)")
    .get().c;

  assert.equal(out, 0, `${out} организаций с рейтингом вне 0..100`);
});

check("аккредитация: NULL и 0 не смешаны", () => {
  const db = getEduDb();
  const absent = db.prepare("SELECT COUNT(*) AS c FROM edu_orgs WHERE active_certs IS NULL").get().c;
  const expired = db.prepare("SELECT COUNT(*) AS c FROM edu_orgs WHERE active_certs = 0").get().c;

  // «Сведений в реестре нет» и «свидетельств не осталось» — разные сообщения
  // на карточке. Если бы NULL схлопнулся в ноль, различие исчезло бы.
  assert.ok(absent > 0 && expired > 0, "NULL и 0 в active_certs неразличимы");
  assert.equal(absent, 167);
  assert.equal(expired, 18);
});

/* -------------------------------------------------------------------- фасад */

check("список и счётчик считают одну и ту же выборку", () => {
  const filters = { region: "г Москва" };
  const total = countEduOrgs(filters);
  const page = listEduOrgs({ ...filters, limit: 1000 });

  assert.equal(total, 206, `в Москве ${total}, ожидалось 206 действующих`);
  assert.equal(page.length, total, "длина страницы не сошлась со счётчиком");

  const withInactive = countEduOrgs({ ...filters, includeInactive: true });
  assert.equal(withInactive, 207, "с ликвидированными в Москве должно быть 207");
});

check("поиск не зависит от регистра и от ё", () => {
  const lower = countEduOrgs({ q: "политех" });
  const upper = countEduOrgs({ q: "ПОЛИТЕХ" });

  assert.ok(lower > 0, "«политех» не нашёл ничего");
  assert.equal(lower, upper, "регистр запроса меняет выдачу");

  // Кириллический LIKE регистронезависим только если обе стороны уже приведены.
  assert.ok(countEduOrgs({ q: "Королёв" }) === countEduOrgs({ q: "королев" }));
});

check("шаблоны LIKE во вводе не срабатывают", () => {
  // Запрос короче двух символов не фильтрует вовсе — выдача равна полной.
  assert.equal(countEduOrgs({ q: "%" }), countEduOrgs({}), "короткий запрос не должен фильтровать");

  // А вот это ловит подмену: без ESCAPE «%» внутри слова совпал бы с любыми
  // буквами, и «кол%едж» нашло бы все колледжи страны.
  const literal = countEduOrgs({ q: "кол%едж" });
  const plain = countEduOrgs({ q: "колледж" });

  assert.ok(plain > 1500, `«колледж» нашёл всего ${plain} — проверка ничего не доказывает`);
  assert.equal(literal, 0, `«кол%едж» нашёл ${literal} организаций — «%» сработал как шаблон`);

  // Подчёркивание — тоже шаблон, совпадает с одним любым символом.
  assert.equal(countEduOrgs({ q: "колл_дж" }), 0, "«_» сработал как шаблон");
});

check("фильтр по виду делит справочник без потерь", () => {
  const all = countEduOrgs({});
  const colleges = countEduOrgs({ kind: "college" });
  const atUniversity = countEduOrgs({ kind: "both" });

  // Вид — не метка, а разбиение: организация либо колледж сама по себе, либо
  // колледж при вузе. Если сумма не сходится, часть выпала из обоих фильтров
  // и перестала находиться вовсе.
  assert.equal(colleges + atUniversity, all, `${colleges} + ${atUniversity} ≠ ${all}`);
  assert.ok(atUniversity > 0, "колледжей при вузах не нашлось ни одного");
});

check("фильтр по аккредитации различает три состояния", () => {
  const withCerts = countEduOrgs({ accreditation: "yes" });
  const expired = countEduOrgs({ accreditation: "no" });
  const all = countEduOrgs({});

  assert.ok(withCerts > 0 && expired > 0, "фильтр аккредитации не отбирает ничего");
  // Сумма меньше общего числа именно на тех, кого нет в реестре аккредитации:
  // третье состояние в фильтр не вынесено, и это не потеря.
  assert.ok(withCerts + expired < all, "организации без сведений об аккредитации куда-то делись");

  const sample = listEduOrgs({ accreditation: "yes", limit: 50 });
  assert.ok(sample.every((row) => row.active_certs > 0), "в выдаче «есть действующая» оказались другие");
});

check("сортировки упорядочивают, а чужое значение не уходит в SQL", () => {
  const byPrograms = listEduOrgs({ sort: "programs", limit: 5 });
  const counts = byPrograms.map((row) => row.programs_count);
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a), "по числу программ не отсортировано");

  const byRating = listEduOrgs({ sort: "rating", limit: 5 });
  // NULL-ы обязаны быть в конце: у 47% организаций рейтинга нет, и без этого
  // «выше оценка качества» показывало бы сначала тех, о ком ничего не известно.
  assert.ok(byRating.every((row) => row.rating !== null), "в начале выдачи по рейтингу оказались NULL");

  // sort уходит в ORDER BY подстановкой — параметром его туда не передать.
  // Значит единственная защита это белый список, и вот она проверяется.
  const injected = listEduOrgs({ sort: "full_name; DROP TABLE edu_orgs", limit: 3 });
  const byName = listEduOrgs({ sort: "name", limit: 3 });
  assert.deepEqual(
    injected.map((row) => row.inn),
    byName.map((row) => row.inn),
    "неизвестная сортировка не откатилась на сортировку по имени"
  );
  assert.ok(getEduDb().prepare("SELECT COUNT(*) AS c FROM edu_orgs").get().c > 0, "таблица пережила запрос");
});

check("карточка: несколько лицензий, программы не задвоены", () => {
  // У этой организации три действующие лицензии, две из них с одним reg_num.
  const card = getEduOrg("0263002030");

  assert.ok(card, "организация 0263002030 не найдена");
  assert.equal(card.licenses.length, 3, "должно быть три лицензии");
  assert.equal(card.org.licenses_count, 3);

  const keys = card.programs.map((p) => [p.level, p.code, p.name, p.qualification].join("|"));
  assert.equal(new Set(keys).size, keys.length, "программы задвоились между лицензиями");

  const empty = card.programs.filter((p) => !p.name.trim());
  assert.equal(empty.length, 0, "есть программы без названия");
});

check("карточка: десятки адресов и отсутствующий ИНН", () => {
  const many = getEduOrg("7801002274");
  assert.equal(many.places.length, 83, "должно быть 83 адреса занятий");
  assert.equal(many.org.places_count, 83);

  assert.equal(getEduOrg("0000000000"), null, "несуществующий ИНН должен давать null");
  assert.equal(getEduOrg(""), null);
  assert.equal(getEduOrg(null), null);
});

/* ------------------------------------------------------- сверка с источником */

const sourceArg = process.argv[2];

if (sourceArg && fs.existsSync(sourceArg)) {
  check("сверка с исходной выгрузкой реестров", () => {
    const source = new Database(path.resolve(sourceArg), { readonly: true, fileMustExist: true });
    const db = getEduDb();

    // Единственная проверка, которая видит дальше собственного результата
    // сборщика: имена и ИНН сверяются с реестром напрямую.
    const sample = db
      .prepare("SELECT inn, full_name FROM edu_orgs WHERE inn LIKE '0%' ORDER BY inn LIMIT 25")
      .all();

    for (const row of sample) {
      const origin = source
        .prepare(
          `SELECT full_name FROM licenses WHERE inn = ? ORDER BY license_id DESC LIMIT 1`
        )
        .get(row.inn);

      assert.ok(origin, `ИНН ${row.inn} отсутствует в источнике — ноль потерялся при сборке`);

      const expected = origin.full_name.trim();
      const got = row.full_name;
      assert.equal(
        got.toLowerCase(),
        expected.toLowerCase(),
        `название ${row.inn} разошлось с реестром`
      );
      assert.equal(got[0], got[0].toUpperCase(), "первая буква названия не поднята");
    }

    const sourceOrgs = source
      .prepare(
        // Правило отбора повторено здесь дословно и намеренно: если его
        // поменяют в сборщике и забудут тут, проверка это и покажет.
        `SELECT COUNT(DISTINCT l.inn) AS c FROM licenses l JOIN programs p ON p.license_id = l.license_id
         WHERE p.level = 'Среднее профессиональное образование'`
      )
      .get().c;

    const built = db.prepare("SELECT COUNT(*) AS c FROM edu_orgs").get().c;
    assert.equal(built, sourceOrgs, `собрано ${built} организаций, в источнике по тому же правилу ${sourceOrgs}`);

    source.close();
  });
} else {
  console.log("· сверка с источником пропущена (передайте путь к baza.sqlite3 аргументом)\n");
}

/* --------------------------------------------------------------------- запуск */

let failed = 0;

for (const [name, fn] of checks) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${name}\n      ${error.message}`);
  }
}

closeEduDb();

console.log(`\n${checks.length - failed} из ${checks.length} проверок пройдено.`);
process.exit(failed > 0 ? 1 : 0);
