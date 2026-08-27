#!/usr/bin/env node
/**
 * Проверка связи справочника с метриками конкурса.
 *
 *   node scripts/edu-participation-check.mjs
 *
 * Требует поднятого orgs_service (шлюз на RSK_API_BASE). Проверяет три вещи,
 * каждая из которых ломала бы объединённую карточку организации по-своему.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

// PORTAL_API_BASE читается из .env.local так же, как это делает Next:
// отдельного загрузчика переменных в скриптах проекта нет.
const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

// Импорт после чтения .env.local: PORTAL_API_BASE вычисляется на импорте модуля.
const { fetchEduParticipation, fetchInnByPortalId } = await import("../src/lib/eduParticipation.js");

const DB_PATH =
  process.env.EDU_DB_PATH || path.join(process.cwd(), ".tools", "edu", "edu.sqlite");
const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

const checks = [];
const check = (name, fn) => checks.push([name, fn]);

check("организация справочника находится в портале по ИНН", async () => {
  const org = db
    .prepare("SELECT inn, short_name FROM edu_orgs WHERE short_name <> '' ORDER BY inn LIMIT 1")
    .get();

  const result = await fetchEduParticipation({ inn: org.inn, shortName: org.short_name });

  // Метрик пока нет ни у кого — конкурс не запущен. Проверяем не значения,
  // а что связь состоялась: портальный id найден по ИНН из справочника.
  assert.ok(result.portalId, `организация ${org.inn} не найдена в orgs_service`);
  assert.equal(result.participates, false, "метрики появились — проверку пора обновить");
  assert.equal(result.axes.length, 6, "осей индекса должно быть шесть");
});

check("чужой ИНН не выдаётся за свой", async () => {
  const org = db.prepare("SELECT short_name FROM edu_orgs WHERE short_name <> '' LIMIT 1").get();

  // Под поиск по имени попадает несколько организаций; сверка идёт по ИНН,
  // и с несуществующим ИНН результат обязан быть пустым, а не «первой попавшейся».
  const result = await fetchEduParticipation({ inn: "0000000000", shortName: org.short_name });

  assert.equal(result.participates, false);
  assert.equal(result.portalId, undefined, "вернулась чужая организация");
});

check("старая ссылка по числовому id ведёт к ИНН", async () => {
  const org = db.prepare("SELECT inn, short_name FROM edu_orgs WHERE short_name <> '' ORDER BY inn LIMIT 1").get();
  const { portalId } = await fetchEduParticipation({ inn: org.inn, shortName: org.short_name });

  const inn = await fetchInnByPortalId(portalId);
  assert.equal(inn, org.inn, "по id вернулся не тот ИНН");

  assert.equal(await fetchInnByPortalId("999999999"), null, "несуществующий id должен давать null");
  assert.equal(await fetchInnByPortalId("не число"), null);
});

check("недоступный портал не роняет справочник", async () => {
  // Порт 9 — discard, соединение отвергается сразу. Адрес передаётся
  // параметром, а не подменой окружения: иначе пришлось бы обходить кэш
  // модулей, и проверка проверяла бы этот обход, а не отказоустойчивость.
  const dead = { baseUrl: "http://127.0.0.1:9" };

  const result = await fetchEduParticipation({ inn: "0263002030", shortName: "ГБПОУ ММПК", ...dead });

  assert.equal(result.participates, false, "при недоступном портале должен быть тихий отказ");
  assert.equal(await fetchInnByPortalId("1", dead), null);
});

let failed = 0;

for (const [name, fn] of checks) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${name}\n      ${error.message}`);
  }
}

db.close();
console.log(`\n${checks.length - failed} из ${checks.length} проверок пройдено.`);
process.exit(failed > 0 ? 1 : 0);
