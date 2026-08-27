#!/usr/bin/env node
/**
 * Сборка справочника колледжей и вузов из выгрузки государственных реестров.
 *
 *   node scripts/edu-registry-build.mjs <baza.sqlite3> [<edu.sqlite>]
 *
 * Источник (baza.sqlite3, ~536 МБ) в репозиторий не кладётся и на прод не едет:
 * из него собирается компактный справочник на ~35 МБ, и работает портал уже с ним.
 * Пересборка нужна раз в квартал, когда обновляется выгрузка реестров.
 *
 * Здесь собраны ВСЕ правила очистки. Рантайм намеренно туп: он только читает
 * готовые колонки. Иначе одно и то же правило разъезжается между сборщиком,
 * фасадом и страницей, и починка в одном месте не чинит два других.
 *
 * Скрипт падает, если не сходятся контрольные числа. Это не перестраховка:
 * тихо собранный наполовину справочник выглядит рабочим до первого запроса
 * по региону, которого в нём не оказалось.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";

const SOURCE_DATE = "2026-08-25"; // дата выгрузки реестров, не дата сборки

const [, , sourceArg, targetArg] = process.argv;

if (!sourceArg) {
  console.error("Укажите путь к baza.sqlite3:\n  node scripts/edu-registry-build.mjs <baza.sqlite3> [<edu.sqlite>]");
  process.exit(2);
}

const SOURCE_PATH = path.resolve(sourceArg);
const TARGET_PATH = path.resolve(
  targetArg || process.env.EDU_DB_PATH || path.join(process.cwd(), ".tools", "edu", "edu.sqlite")
);
const DDL_PATH = path.join(import.meta.dirname, "edu-registry.sql");

if (!fs.existsSync(SOURCE_PATH)) {
  console.error(`Источник не найден: ${SOURCE_PATH}`);
  process.exit(2);
}

/* ------------------------------------------------------------------ регионы */

// Порт normalize_region из orgs_service/app/cruds/orgs_crud.py. Сопоставление
// делается здесь, при сборке, чтобы рантайм сравнивал строки точно.
const REGION_NOISE = new Set([
  "обл", "область", "респ", "республика", "край",
  "ао", "аобл", "автономный", "автономная", "округ",
  "г", "город",
]);

function normalizeRegion(value) {
  let cleaned = (value || "").toLowerCase().replaceAll("ё", "е");
  for (const char of "().,-—–") {
    cleaned = cleaned.replaceAll(char, " ");
  }
  // Резать по пробелам, а не по \b: в JS \w — только ASCII, после кириллицы
  // границы слова нет, и регулярка молча не срабатывает.
  return cleaned.split(/\s+/).filter((word) => word && !REGION_NOISE.has(word)).join(" ");
}

// Три субъекта, где нормализатор честно не сходится: реестр печатает название
// с повтором в скобках («Республика Адыгея (Адыгея)»), а справочник портала —
// без него. Ключ — код субъекта, он однозначен; по названию сопоставлять нельзя.
const REGION_BY_CODE = {
  "01": "Респ Адыгея",
  "16": "Респ Татарстан",
  "42": "Кемеровская область - Кузбасс",
};

function loadPortalRegions() {
  const file = path.join(process.cwd(), "public", "data", "regions.txt");
  const lines = fs.readFileSync(file, "utf8").split("\n").map((line) => line.trim()).filter(Boolean);
  const byNormalized = new Map();

  for (const line of lines) {
    const key = normalizeRegion(line);
    // «Респ Тыва» и «Респ Тува» — один субъект двумя строками. Побеждает первая:
    // важно лишь, чтобы значение существовало в справочнике портала.
    if (!byNormalized.has(key)) {
      byNormalized.set(key, line);
    }
  }

  return { lines, byNormalized };
}

/* ------------------------------------------------------------------- утилиты */

const hash = (...parts) => crypto.createHash("md5").update(parts.join("\u0000")).digest("hex");

const text = (value) => (value == null ? "" : String(value).trim());

/** Реестр печатает треть названий строчными буквами — поднимаем первую. */
function capitalize(value) {
  const trimmed = text(value);
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : "";
}

/** Координаты и рейтинг лежат в источнике текстом. Мусор превращаем в NULL. */
function toNumber(value) {
  const parsed = Number.parseFloat(text(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/* -------------------------------------------------------------------- отбор */

// Справочник — про среднее профессиональное образование. Организация попадает
// в него, если ей разрешено вести программы СПО: это и колледжи с техникумами,
// и вузы, у которых есть отделение СПО. Чистые вузы (998 штук) не берём.
//
// Отбор по ОКВЭД не годится: он теряет сотни профильных организаций, у которых
// основной вид деятельности записан иначе — НИИ, семинарии, больницы.
const SPO_LEVEL = `p.level = 'Среднее профессиональное образование'`;

// А вот программы у отобранных организаций показываем все профильные, включая
// высшее образование: карточка описывает организацию целиком, и умалчивать,
// что у колледжа при вузе есть ещё и бакалавриат, значит её искажать.
const PROGRAM_LEVEL = `(p.level = 'Среднее профессиональное образование' OR p.level LIKE 'Высшее образование%')`;

const SELECTED_LICENSES = `
  SELECT DISTINCT l.license_id, l.inn
  FROM licenses l
  JOIN programs p ON p.license_id = l.license_id
  WHERE ${SPO_LEVEL}
`;

function build() {
  const source = new Database(SOURCE_PATH, { readonly: true, fileMustExist: true });
  const { lines: portalRegions, byNormalized } = loadPortalRegions();

  console.log(`Источник: ${SOURCE_PATH}`);
  console.log(`Цель:     ${TARGET_PATH}`);

  /* --- лицензии выборки --------------------------------------------------- */

  const licenseRows = source
    .prepare(
      `SELECT l.license_id, l.inn, l.ogrn, l.kpp, l.full_name, l.short_name, l.reg_num,
              l.licensing_body, l.subject_rf, l.subject_code, l.address, l.status,
              l.decision, l.changed_at
       FROM licenses l
       WHERE l.license_id IN (SELECT license_id FROM (${SELECTED_LICENSES}))
       ORDER BY l.inn, l.license_id`
    )
    .all();

  const byInn = new Map();
  for (const row of licenseRows) {
    const inn = text(row.inn);
    if (!inn) continue;
    if (!byInn.has(inn)) byInn.set(inn, []);
    byInn.get(inn).push(row);
  }

  console.log(`Лицензий в выборке: ${licenseRows.length}, организаций: ${byInn.size}`);

  /* --- обогащение: по одной строке на ИНН --------------------------------- */

  const lookup = (sql) => {
    const map = new Map();
    for (const row of source.prepare(sql).all()) {
      map.set(text(row.inn), row);
    }
    return map;
  };

  const innFilter = `inn IN (SELECT inn FROM (${SELECTED_LICENSES}))`;

  const companies = lookup(`SELECT * FROM companies WHERE ${innFilter}`);
  const accreditation = lookup(`SELECT * FROM accreditation WHERE ${innFilter}`);
  const bus = lookup(`SELECT * FROM bus_agencies WHERE ${innFilter}`);
  const geo = lookup(`SELECT * FROM geo WHERE ${innFilter}`);

  console.log(
    `Обогащение: ЕГРЮЛ ${companies.size}, аккредитация ${accreditation.size}, ` +
      `госучреждения ${bus.size}, гео ${geo.size}`
  );

  /* --- программы ----------------------------------------------------------- */

  // Фильтр по уровню применяется и к самим программам, а не только к отбору
  // организаций. Иначе в справочник приедут ДПО, допобразование детей и
  // профобучение — а с ними 8104 строки без разобранного названия.
  const programRows = source
    .prepare(
      `SELECT l.inn, p.level, p.code, p.name_clean, p.qualification, p.value
       FROM programs p
       JOIN licenses l ON l.license_id = p.license_id
       WHERE p.license_id IN (SELECT license_id FROM (${SELECTED_LICENSES}))
         AND ${PROGRAM_LEVEL}`
    )
    .all();

  /* --- адреса занятий ------------------------------------------------------ */

  const branchRows = source
    .prepare(
      `SELECT l.inn, b.places
       FROM branches b
       JOIN licenses l ON l.license_id = b.license_id
       WHERE b.license_id IN (SELECT license_id FROM (${SELECTED_LICENSES}))`
    )
    .all();

  source.close();

  /* --- сборка целевой базы ------------------------------------------------- */

  fs.mkdirSync(path.dirname(TARGET_PATH), { recursive: true });
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(TARGET_PATH + suffix, { force: true });
  }

  const target = new Database(TARGET_PATH);
  target.exec(fs.readFileSync(DDL_PATH, "utf8"));

  const insertOrg = target.prepare(
    `INSERT INTO edu_orgs (
       inn, full_name, short_name, kind, type, region, region_code, region_portal,
       city, settlement, address, postal_code, oktmo, kladr_id, lat, lon,
       ogrn, kpp, opf, okved, state_status, registration_date,
       management_name, management_post, head_name, head_post,
       phone, email, website, active_certs, rating,
       programs_count, places_count, licenses_count, search_text, source_date
     ) VALUES (
       @inn, @full_name, @short_name, @kind, @type, @region, @region_code, @region_portal,
       @city, @settlement, @address, @postal_code, @oktmo, @kladr_id, @lat, @lon,
       @ogrn, @kpp, @opf, @okved, @state_status, @registration_date,
       @management_name, @management_post, @head_name, @head_post,
       @phone, @email, @website, @active_certs, @rating,
       @programs_count, @places_count, @licenses_count, @search_text, @source_date
     )`
  );

  const insertLicense = target.prepare(
    `INSERT INTO edu_licenses (license_id, inn, reg_num, licensing_body, status, decision, changed_at)
     VALUES (@license_id, @inn, @reg_num, @licensing_body, @status, @decision, @changed_at)`
  );

  const insertProgram = target.prepare(
    `INSERT INTO edu_programs (inn, program_key, level, code, name, qualification)
     VALUES (@inn, @program_key, @level, @code, @name, @qualification)`
  );

  const insertPlace = target.prepare(
    `INSERT INTO edu_places (inn, place_key, address) VALUES (@inn, @place_key, @address)`
  );

  const insertMeta = target.prepare(`INSERT INTO edu_meta (key, value) VALUES (?, ?)`);

  /* --- программы и адреса раскладываем по ИНН, попутно дедуплицируя -------- */

  const programsByInn = new Map();
  for (const row of programRows) {
    const inn = text(row.inn);
    if (!inn) continue;
    const level = text(row.level);
    const code = text(row.code);
    const qualification = text(row.qualification);
    // Название берём разобранное, а при его отсутствии — сырую строку реестра:
    // source пишет запись либо как «специальность плюс уровень», либо одним
    // уровнем, и пустое имя здесь свойство записи, а не пробел в данных.
    const name = text(row.name_clean) || text(row.value);

    if (!programsByInn.has(inn)) programsByInn.set(inn, new Map());
    programsByInn.get(inn).set(hash(level, code, name, qualification), {
      level, code, name, qualification,
    });
  }

  const placesByInn = new Map();
  let placesSkipped = 0;
  for (const row of branchRows) {
    const inn = text(row.inn);
    if (!inn) continue;
    if (!placesByInn.has(inn)) placesByInn.set(inn, new Map());

    for (const raw of text(row.places).split(";")) {
      const address = raw.trim();
      // «не предусмотрено» — это отметка реестра об отсутствии отдельных мест,
      // а не адрес. В список её пускать нельзя.
      if (!address || /не предусмотрен/i.test(address)) {
        placesSkipped += 1;
        continue;
      }
      placesByInn.get(inn).set(hash(address), address);
    }
  }

  /* --- строки организаций -------------------------------------------------- */

  const unmappedRegions = new Map();
  let leadingZeroCount = 0;

  const orgs = [];
  for (const [inn, licenses] of byInn) {
    // Шапка — из самой свежей лицензии: у 18 ИНН названия в разных лицензиях
    // расходятся, и старая версия названия уже недействительна.
    const head = licenses.reduce((a, b) => (b.license_id > a.license_id ? b : a));

    const company = companies.get(inn) || {};
    const accred = accreditation.get(inn) || {};
    const agency = bus.get(inn) || {};
    const place = geo.get(inn) || {};

    const programs = programsByInn.get(inn) || new Map();
    const places = placesByInn.get(inn) || new Map();

    const levels = new Set([...programs.values()].map((program) => program.level));
    const hasSpo = levels.has("Среднее профессиональное образование");
    const hasVo = [...levels].some((level) => level.startsWith("Высшее образование"));
    const kind = hasSpo && hasVo ? "both" : hasVo ? "university" : "college";

    const regionCode = text(head.subject_code).padStart(2, "0");
    const region = text(head.subject_rf);
    const regionPortal = REGION_BY_CODE[regionCode] || byNormalized.get(normalizeRegion(region)) || "";

    if (!regionPortal) {
      unmappedRegions.set(regionCode, region);
    }

    if (inn.startsWith("0")) {
      leadingZeroCount += 1;
    }

    const fullName = capitalize(head.full_name);
    const shortName = text(head.short_name) || text(company.name_short) || fullName;
    const city = text(company.city);
    const settlement = text(place.settlement);

    // Рейтинг независимой оценки: -1.0 означает «не рассчитан», не ноль.
    const rawRating = toNumber(agency.rating);
    const rating = rawRating != null && rawRating >= 0 ? rawRating : null;

    orgs.push({
      inn,
      full_name: fullName,
      short_name: shortName,
      kind,
      // Организация с обеими ступенями показывается как вуз: СПО при вузе —
      // его отделение, а не отдельный колледж.
      type: kind === "college" ? "Колледж" : "ВУЗ",
      region,
      region_code: regionCode,
      region_portal: regionPortal,
      city,
      settlement,
      address: text(head.address) || text(company.address),
      postal_code: text(place.postal_code) || text(company.postal_code),
      oktmo: text(place.oktmo),
      kladr_id: text(place.kladr_id),
      lat: toNumber(company.geo_lat),
      lon: toNumber(company.geo_lon),
      ogrn: text(head.ogrn) || text(company.ogrn),
      kpp: text(head.kpp) || text(company.kpp),
      opf: text(company.opf),
      okved: text(company.okved),
      state_status: text(company.state_status),
      registration_date: text(company.registration_date),
      management_name: text(company.management_name),
      management_post: text(company.management_post),
      // Контакты: реестр аккредитации, при пробеле — реестр госучреждений.
      // companies.phones/emails/sites в выгрузке пусты полностью (0 из 29763).
      head_name: text(accred.head_name) || text(company.management_name),
      head_post: text(accred.head_post) || text(company.management_post),
      phone: text(accred.phone) || text(agency.phone),
      email: text(accred.email),
      website: text(accred.website) || text(agency.website),
      // NULL и 0 здесь разные вещи: «в реестре аккредитации нет» и «есть,
      // но действующих свидетельств не осталось».
      active_certs: accreditation.has(inn) ? Number(accred.active_certs ?? 0) : null,
      rating,
      programs_count: programs.size,
      places_count: places.size,
      licenses_count: licenses.length,
      search_text: [fullName, shortName, inn, city, settlement]
        .join(" ")
        .toLowerCase()
        .replaceAll("ё", "е"),
      source_date: SOURCE_DATE,
    });
  }

  orgs.sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"));

  /* --- запись --------------------------------------------------------------- */

  let programCount = 0;
  let placeCount = 0;

  target.transaction(() => {
    for (const org of orgs) {
      insertOrg.run(org);

      for (const license of byInn.get(org.inn)) {
        insertLicense.run({
          license_id: license.license_id,
          inn: org.inn,
          reg_num: text(license.reg_num),
          licensing_body: text(license.licensing_body),
          status: text(license.status),
          decision: text(license.decision),
          changed_at: text(license.changed_at),
        });
      }

      for (const [program_key, program] of programsByInn.get(org.inn) || []) {
        insertProgram.run({ inn: org.inn, program_key, ...program });
        programCount += 1;
      }

      for (const [place_key, address] of placesByInn.get(org.inn) || []) {
        insertPlace.run({ inn: org.inn, place_key, address });
        placeCount += 1;
      }
    }

    for (const [key, value] of [
      ["source_date", SOURCE_DATE],
      ["orgs", String(orgs.length)],
      ["licenses", String(licenseRows.length)],
      ["programs", String(programCount)],
      ["places", String(placeCount)],
    ]) {
      insertMeta.run(key, value);
    }
  })();

  target.exec("VACUUM");
  target.close();

  /* --- приёмка -------------------------------------------------------------- */

  const problems = [];

  if (unmappedRegions.size > 0) {
    const shown = [...unmappedRegions].map(([code, name]) => `${code} ${name}`).join("; ");
    problems.push(`не сопоставлено с public/data/regions.txt субъектов: ${unmappedRegions.size} (${shown})`);
  }
  if (orgs.length === 0) problems.push("справочник пуст");
  if (programCount === 0) problems.push("не собрано ни одной программы");
  if (placeCount === 0) problems.push("не собрано ни одного адреса занятий");
  if (leadingZeroCount === 0) problems.push("ни одного ИНН с ведущим нулём — значит где-то произошло приведение к числу");

  const sizeMb = (fs.statSync(TARGET_PATH).size / 1024 / 1024).toFixed(1);
  const regionCodes = new Set(orgs.map((org) => org.region_code));

  console.log("");
  console.log(`Организаций:        ${orgs.length}`);
  console.log(`Лицензий:           ${licenseRows.length}`);
  console.log(`Программ:           ${programCount}`);
  console.log(`Адресов занятий:    ${placeCount} (отсеяно пустых и «не предусмотрено»: ${placesSkipped})`);
  console.log(`Субъектов РФ:       ${regionCodes.size}, все сопоставлены со справочником портала`);
  console.log(`ИНН с ведущим нулём:${String(leadingZeroCount).padStart(6)}`);
  console.log(`Колледжи/вузы/оба:  ${orgs.filter((o) => o.kind === "college").length} / ` +
    `${orgs.filter((o) => o.kind === "university").length} / ${orgs.filter((o) => o.kind === "both").length}`);
  console.log(`Размер файла:       ${sizeMb} МБ`);

  if (problems.length > 0) {
    console.error("\nСборка не принята:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log("\nГотово.");
}

build();
