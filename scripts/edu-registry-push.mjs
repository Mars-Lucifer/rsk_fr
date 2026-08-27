#!/usr/bin/env node
/**
 * Выгружает справочник колледжей в SQL для таблицы organizations портала.
 *
 *   node scripts/edu-registry-push.mjs > orgs.sql
 *   docker exec -i rsk_back-rsk_orgs_db-1 psql -U postgres -d rsk_orgs < orgs.sql
 *
 * Почему SQL текстом, а не прямое подключение: в этом репозитории нет и не
 * нужен драйвер PostgreSQL — заливка разовая, раз в квартал, и делается той же
 * командой, что и на проде, где сетевого доступа к базе отсюда всё равно нет.
 *
 * Заливаются только справочные поля: ИНН, названия, регион, тип. Индекс
 * цифровой зрелости и его шесть осей остаются нулями — они принадлежат
 * конкурсу, а не реестру, и портал считает их сам.
 */

import path from "node:path";
import Database from "better-sqlite3";

const DB_PATH =
  process.env.EDU_DB_PATH || path.join(process.cwd(), ".tools", "edu", "edu.sqlite");

const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

// Ликвидированные и ликвидируемые в портал не едут: организации нет,
// а выбрать её в профиле было бы можно.
const rows = db
  .prepare(
    `SELECT inn, full_name, short_name, region_portal, type
     FROM edu_orgs
     WHERE state_status NOT IN ('LIQUIDATED', 'LIQUIDATING')
     ORDER BY full_name`
  )
  .all();

const quote = (value) => `'${String(value ?? "").replaceAll("'", "''")}'`;

const out = [];
out.push("BEGIN;");
// Реестр — источник правды по справочным полям: расхождения перетираются,
// а метрики конкурса у уже существующих организаций остаются нетронутыми.
out.push(`CREATE TEMP TABLE edu_incoming (
  inn varchar(12), full_name text, short_name text, region text, type text
) ON COMMIT DROP;`);

for (const row of rows) {
  out.push(
    `INSERT INTO edu_incoming VALUES (${quote(row.inn)}, ${quote(row.full_name)}, ` +
      `${quote(row.short_name)}, ${quote(row.region_portal)}, ${quote(row.type)});`
  );
}

out.push(`
UPDATE organizations o SET
  full_name = i.full_name,
  short_name = i.short_name,
  region = i.region,
  type = i.type::org_type_enum
FROM edu_incoming i WHERE o.inn = i.inn;

INSERT INTO organizations (inn, full_name, short_name, region, type)
SELECT i.inn, i.full_name, i.short_name, i.region, i.type::org_type_enum
FROM edu_incoming i
WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.inn = i.inn);
`);

out.push("COMMIT;");

process.stdout.write(out.join("\n") + "\n");
process.stderr.write(`Организаций к заливке: ${rows.length}\n`);
