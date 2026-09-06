import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Доступ к справочнику колледжей и вузов.
 *
 * Единственный модуль, знающий про better-sqlite3 и про раскладку таблиц.
 * На втором этапе, когда справочник переедет в orgs_service, заменяется
 * целиком на HTTP-клиент — страницы и роуты не меняются, в этом и смысл.
 *
 * Файл базы лежит ВНЕ каталога data/: в рабочих копиях data/ — junction на
 * общий рантайм, и файл, отслеживаемый git только в одной ветке, ломает
 * `git merge` во всех остальных копиях. Сборка ведётся скриптом
 * scripts/edu-registry-build.mjs, на прод файл доставляется копированием.
 */

const DB_PATH =
  process.env.EDU_DB_PATH || path.join(process.cwd(), ".tools", "edu", "edu.sqlite");

export class EduRegistryMissingError extends Error {
  constructor(dbPath) {
    super(
      `Справочник образовательных организаций не собран: ${dbPath}. ` +
        `Соберите его: node scripts/edu-registry-build.mjs <baza.sqlite3>`
    );
    this.name = "EduRegistryMissingError";
    this.code = "EDU_REGISTRY_MISSING";
  }
}

export function getEduDb() {
  // Соединение живёт в globalThis, а не в модульной переменной: в dev-режиме
  // Next пересобирает модуль на каждую правку, и хэндлы копились бы десятками.
  // На Windows открытый хэндл вдобавок не даёт пересобрать сам файл справочника.
  if (!globalThis.__eduRegistryDb) {
    // Проверка до открытия, а не через перехват ошибки: better-sqlite3 бросает
    // SQLITE_CANTOPEN, только когда каталог есть, а файла в нём нет. Если нет
    // самого каталога — прилетает TypeError вообще без кода. А именно так и
    // выглядит свежий клон: .tools/ лежит в .gitignore и не существует, то есть
    // на новом окружении отрабатывал бы как раз необработанный случай.
    if (!fs.existsSync(DB_PATH)) {
      throw new EduRegistryMissingError(DB_PATH);
    }

    try {
      globalThis.__eduRegistryDb = new Database(DB_PATH, {
        // Писать в справочник нечего: он производный, обновляется пересборкой.
        // readonly заодно не создаёт рядом -wal и -shm.
        readonly: true,
        // Без этого better-sqlite3 молча создаст пустой файл, и вместо честного
        // «справочник не собран» портал покажет «найдено 0 организаций».
        fileMustExist: true,
      });
    } catch (error) {
      if (error?.code === "SQLITE_CANTOPEN") {
        throw new EduRegistryMissingError(DB_PATH);
      }
      throw error;
    }
  }

  return globalThis.__eduRegistryDb;
}

/** Служебное: закрыть соединение (нужно проверкам, чтобы не держать файл). */
export function closeEduDb() {
  globalThis.__eduRegistryDb?.close();
  globalThis.__eduRegistryDb = undefined;
}

/**
 * `%` и `_` во вводе — шаблоны LIKE, а не буквы. Без экранирования запрос
 * «100%» находит лишнее, а «_» совпадает с любым символом.
 */
function likePattern(value) {
  const escaped = value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
  return `%${escaped}%`;
}

/** Поисковая колонка хранится уже приведённой: LIKE в SQLite и в PostgreSQL
 *  регистронезависим только к латинице, для кириллицы приводить надо самим. */
const normalizeQuery = (value) => String(value || "").trim().toLowerCase().replaceAll("ё", "е");

// 'university' в справочнике не встречается: чистые вузы в него не отбираются.
// Значение оставлено в схеме и здесь — расширение выборки правится одной
// строкой в сборщике, и фильтр тогда не придётся вспоминать.
const KIND_VALUES = new Set(["college", "both", "university"]);

/**
 * Сравнимая форма названия субъекта. Порт normalize_region из
 * orgs_service/app/cruds/orgs_crud.py — сравнение должно давать один результат
 * по обе стороны.
 *
 * Нужна затем, что один и тот же субъект пишется по-разному: реестр печатает
 * «Архангельская обл», справочник портала — «Архангельская область», и в
 * feat/concurs этот файл как раз переводят на полные слова. Сверка по
 * нормализованной форме переживает такую замену, сверка по строке — нет.
 */
export function normalizeRegionName(value) {
  let cleaned = String(value || "").toLowerCase().replaceAll("ё", "е");

  for (const char of "().,-—–") {
    cleaned = cleaned.replaceAll(char, " ");
  }

  const noise = new Set([
    "обл", "область", "респ", "республика", "край",
    "ао", "аобл", "автономный", "автономная", "округ",
    "г", "город",
  ]);

  return cleaned.split(/\s+/).filter((word) => word && !noise.has(word)).join(" ");
}

/** Все субъекты, встречающиеся в справочнике. Их 89, список неизменен между
 *  пересборками — читаем один раз за жизнь процесса. */
function allRegions() {
  if (!globalThis.__eduRegionList) {
    globalThis.__eduRegionList = getEduDb()
      .prepare("SELECT DISTINCT region_portal FROM edu_orgs ORDER BY region_portal")
      .all()
      .map((row) => row.region_portal);
  }

  return globalThis.__eduRegionList;
}

/** Субъекты для подсказок на странице. Берутся из самого справочника, а не из
 *  public/data/regions.txt: тот файл принадлежит портальному контуру и меняется
 *  независимо, а подсказка обязана предлагать то, что в справочнике есть. */
export const listEduRegions = () => allRegions();

/**
 * Субъекты, подходящие под введённый текст. null — фильтра нет вовсе,
 * пустой массив — введено то, чему не соответствует ни один субъект.
 *
 * Точное совпадение имеет приоритет: «Респ Тыва» не должно тянуть за собой
 * ничего лишнего, даже если подстрока встречается ещё где-то.
 */
export function matchRegions(region) {
  const needle = String(region || "").trim().toLowerCase().replaceAll("ё", "е");

  if (!needle) {
    return null;
  }

  const regions = allRegions();
  const normalized = regions.map((name) => name.toLowerCase().replaceAll("ё", "е"));

  const exact = normalized.indexOf(needle);
  if (exact >= 0) {
    return [regions[exact]];
  }

  return regions.filter((_, index) => normalized[index].includes(needle));
}

/**
 * Условие выборки, общее для списка и счётчика: иначе «показано 20 из 187»
 * однажды разъедется на разных фильтрах.
 */
function buildWhere({ q, region, kind, accreditation, includeInactive }) {
  const clauses = [];
  const params = {};

  const needle = normalizeQuery(q);
  // Односимвольный запрос отдаёт почти весь справочник — толку ноль, а
  // страница на 5000 строк уходит на клиент.
  if (needle.length >= 2) {
    clauses.push("search_text LIKE @q ESCAPE '\\'");
    params.q = likePattern(needle);
  }

  // Регион приходит как свободный текст: человек печатает «Моск» и ждёт, что
  // выдача сузится сразу, не дожидаясь выбора из списка. Сводим введённое к
  // настоящим названиям здесь, а в SQL уходит точное перечисление.
  //
  // Почему не LIKE прямо в запросе: и в SQLite, и в PostgreSQL LIKE приводит
  // регистр только у латиницы, и «моск» не нашло бы «г Москва». В JS
  // toLowerCase кириллицу знает.
  const wanted = matchRegions(region);
  if (wanted !== null) {
    if (wanted.length === 0) {
      // Введено что-то, чему не соответствует ни один субъект. Пустая выдача
      // здесь честнее, чем молча показанный весь справочник.
      clauses.push("1 = 0");
    } else {
      const names = wanted.map((_, index) => `@region${index}`);
      clauses.push(`region_portal IN (${names.join(", ")})`);
      wanted.forEach((value, index) => {
        params[`region${index}`] = value;
      });
    }
  }

  // Колледж сам по себе и колледж при вузе — разные вещи для поступающего:
  // во втором случае за той же дверью есть ещё и высшее образование.
  if (KIND_VALUES.has(kind)) {
    clauses.push("kind = @kind");
    params.kind = kind;
  }

  // Аккредитация — право выдать диплом государственного образца, а не признак
  // «работает». Третье состояние (сведений в реестре нет) в фильтр не выносим:
  // отсутствие организации в реестре аккредитации ничего не говорит о ней самой.
  if (accreditation === "yes") {
    clauses.push("active_certs > 0");
  } else if (accreditation === "no") {
    clauses.push("active_certs = 0");
  }

  // Лицензия действует, а юрлицо — нет: реестр Рособрнадзора о состоянии
  // в ЕГРЮЛ не знает. Ликвидированных и ликвидируемых по умолчанию не
  // показываем, реорганизуемых оставляем — они продолжают учить.
  if (!includeInactive) {
    clauses.push("state_status NOT IN ('LIQUIDATED', 'LIQUIDATING')");
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

/**
 * Порядок выдачи. Сортировка задаётся ключом из белого списка, а не строкой из
 * запроса: значение уходит в SQL подстановкой, параметром ORDER BY не задать.
 *
 * NULL-ы всегда в конце: у 47% организаций рейтинга нет вовсе, и без этого
 * сортировка «по рейтингу» показывала бы сначала тех, о ком ничего не известно.
 */
const ORDER_BY = {
  name: "full_name ASC",
  programs: "programs_count DESC, full_name ASC",
  rating: "rating IS NULL, rating DESC, full_name ASC",
  places: "places_count DESC, full_name ASC",
};

const LIST_COLUMNS = `
  inn, full_name, short_name, kind, type, region, region_portal, city, settlement,
  programs_count, places_count, active_certs, state_status, rating
`;

export function listEduOrgs({ q, region, kind, accreditation, sort, includeInactive, limit = 20, offset = 0 } = {}) {
  const { where, params } = buildWhere({ q, region, kind, accreditation, includeInactive });
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 1000);
  const safeOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);
  const order = ORDER_BY[sort] || ORDER_BY.name;

  return getEduDb()
    .prepare(
      `SELECT ${LIST_COLUMNS} FROM edu_orgs ${where}
       ORDER BY ${order} LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: safeLimit, offset: safeOffset });
}

export function countEduOrgs({ q, region, kind, accreditation, includeInactive } = {}) {
  const { where, params } = buildWhere({ q, region, kind, accreditation, includeInactive });

  return getEduDb().prepare(`SELECT COUNT(*) AS total FROM edu_orgs ${where}`).get(params).total;
}

/** Ключи сортировки для интерфейса: список один и тот же и в странице, и в API. */
export const EDU_SORT_KEYS = Object.keys(ORDER_BY);

/**
 * Строки списка по готовому перечню ИНН, в том же порядке.
 *
 * Нужно для выдачи участников конкурса: порядок там задаёт orgs_service
 * (по индексу цифровой зрелости), а сведения об организации лежат здесь.
 * Пересортировывать нельзя — порядок и есть содержание такой выдачи.
 */
export function listEduOrgsByInns(inns = []) {
    const keys = inns.map((value) => String(value || "").trim()).filter(Boolean);

    if (keys.length === 0) {
        return [];
    }

    const placeholders = keys.map(() => "?").join(", ");
    const rows = getEduDb()
      .prepare(`SELECT ${LIST_COLUMNS} FROM edu_orgs WHERE inn IN (${placeholders})`)
      .all(keys);

    const byInn = new Map(rows.map((row) => [row.inn, row]));

    // Организации может не быть в справочнике: в портале живут и те, кого
    // завели вручную. Такие просто выпадают — выдумывать им карточку нечем.
    return keys.map((inn) => byInn.get(inn)).filter(Boolean);
}

// Колонки карточки перечислены поимённо, а не звёздочкой: всё, что вернёт этот
// запрос, уезжает на клиент в __NEXT_DATA__. Служебным здесь не место —
// search_text у иных организаций тянет под тысячу символов, и это только вес.
const CARD_COLUMNS = `
  inn, full_name, short_name, kind, type, region, region_portal, city, settlement,
  address, postal_code, oktmo, lat, lon, ogrn, kpp, opf, okved,
  state_status, registration_date, management_name, management_post,
  head_name, head_post, phone, email, website,
  active_certs, rating, programs_count, places_count, licenses_count
`;

/** Полная карточка или null. ИНН — строка: ведущий ноль значим у 298 организаций. */
export function getEduOrg(inn) {
  const key = String(inn || "").trim();
  if (!key) {
    return null;
  }

  const db = getEduDb();
  const org = db.prepare(`SELECT ${CARD_COLUMNS} FROM edu_orgs WHERE inn = ?`).get(key);
  if (!org) {
    return null;
  }

  return {
    org,
    licenses: db
      .prepare("SELECT * FROM edu_licenses WHERE inn = ? ORDER BY license_id DESC")
      .all(key),
    programs: db
      .prepare(
        `SELECT level, code, name, qualification FROM edu_programs WHERE inn = ?
         ORDER BY level, code, name`
      )
      .all(key),
    places: db.prepare("SELECT address FROM edu_places WHERE inn = ? ORDER BY address").all(key),
  };
}

/** Дата выгрузки реестров: карточка обязана сказать, на какое число сведения. */
export function getEduSourceDate() {
  return getEduDb().prepare("SELECT value FROM edu_meta WHERE key = 'source_date'").get()?.value || "";
}
