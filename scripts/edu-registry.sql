-- Справочник образовательных организаций: колледжи и вузы.
-- Источник — выгрузка реестров Рособрнадзора, ЕГРЮЛ, bus.gov.ru и реестра
-- аккредитации (baza.sqlite3, 25.08.2026). Сборщик — scripts/edu-registry-build.mjs.
--
-- Этот файл исполняется ДОСЛОВНО в двух СУБД: в SQLite на первом этапе и в
-- PostgreSQL (orgs_service) на втором. Поэтому здесь нет ничего, что есть
-- только в одной из них: ни INTEGER PRIMARY KEY как алиаса rowid, ни
-- WITHOUT ROWID, ни FTS5, ни COLLATE NOCASE, ни ON CONFLICT, ни AUTOINCREMENT.
-- Дедупликация делается в сборщике до вставки, а не декларацией.
--
-- Собственных идентификаторов у организаций нет намеренно. Ключ — ИНН строкой.
-- Причина не в стиле: 298 организаций из 5180 имеют значащий ведущий ноль
-- (0101001963, 0263002030), и одно Number(inn) в любом звене цепочки их теряет.
-- Второе следствие важнее первого: раз локального id не существует, его нечего
-- по ошибке записать в Organization_id профиля. Диапазоны id этого справочника
-- и таблицы organizations в orgs_service пересекаются, внешнего ключа там нет,
-- и подмена прошла бы молча.

CREATE TABLE edu_orgs (
  inn               TEXT NOT NULL PRIMARY KEY CHECK (length(inn) IN (10, 12)),
  full_name         TEXT NOT NULL,
  short_name        TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('college', 'university', 'both')),
  -- type дублирует kind в терминах OrgType из orgs_service: на втором этапе
  -- значение уходит в org_type_enum как есть, без сопоставления на лету.
  type              TEXT NOT NULL CHECK (type IN ('Колледж', 'ВУЗ')),
  region            TEXT NOT NULL,                -- subject_rf реестра, канон показа
  region_code       TEXT NOT NULL,                -- subject_code, два знака: ключ сопоставления
  region_portal     TEXT NOT NULL,                -- строка из public/data/regions.txt
  city              TEXT NOT NULL DEFAULT '',
  settlement        TEXT NOT NULL DEFAULT '',
  address           TEXT NOT NULL DEFAULT '',
  postal_code       TEXT NOT NULL DEFAULT '',
  oktmo             TEXT NOT NULL DEFAULT '',
  kladr_id          TEXT NOT NULL DEFAULT '',
  lat               DOUBLE PRECISION,
  lon               DOUBLE PRECISION,
  ogrn              TEXT NOT NULL DEFAULT '',
  kpp               TEXT NOT NULL DEFAULT '',
  opf               TEXT NOT NULL DEFAULT '',
  okved             TEXT NOT NULL DEFAULT '',
  -- Пустая строка означает «организации нет в ЕГРЮЛ-выгрузке», а не «неизвестно».
  state_status      TEXT NOT NULL DEFAULT '',
  registration_date TEXT NOT NULL DEFAULT '',
  management_name   TEXT NOT NULL DEFAULT '',
  management_post   TEXT NOT NULL DEFAULT '',
  head_name         TEXT NOT NULL DEFAULT '',
  head_post         TEXT NOT NULL DEFAULT '',
  phone             TEXT NOT NULL DEFAULT '',
  email             TEXT NOT NULL DEFAULT '',
  website           TEXT NOT NULL DEFAULT '',
  -- Единственное поле, где NULL несёт смысл: организации нет в реестре
  -- аккредитации вовсе. Ноль означает другое — свидетельства были и истекли.
  active_certs      INTEGER,
  -- Независимая оценка качества bus.gov.ru. Шкала 0..100, не 0..5;
  -- «не рассчитан» приходит как -1.0 и здесь становится NULL.
  rating            DOUBLE PRECISION,
  programs_count    INTEGER NOT NULL,
  places_count      INTEGER NOT NULL,
  licenses_count    INTEGER NOT NULL,
  -- Нижний регистр и ё->е уже применены: LIKE регистронезависим только к ASCII
  -- в обеих СУБД, приводить регистр на лету одинаково бесполезно и там и там.
  search_text       TEXT NOT NULL,
  source_date       TEXT NOT NULL
);

CREATE INDEX edu_orgs_region_idx ON edu_orgs (region_portal);
CREATE INDEX edu_orgs_kind_idx ON edu_orgs (kind);

CREATE TABLE edu_licenses (
  -- Идентификатор реестра, не суррогат: по нему карточка сверяется с источником.
  license_id     BIGINT NOT NULL PRIMARY KEY,
  inn            TEXT NOT NULL,
  reg_num        TEXT NOT NULL DEFAULT '',
  licensing_body TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT '',
  decision       TEXT NOT NULL DEFAULT '',
  changed_at     TEXT NOT NULL DEFAULT ''
);

CREATE INDEX edu_licenses_inn_idx ON edu_licenses (inn);

-- Ключ — хеш, а не сами поля. Составной ключ из (level, code, name,
-- qualification) в этой выборке доходит до 8557 байт: SQLite такое проглотит,
-- а PostgreSQL откажет — предел индексного кортежа btree 2704 байта. То есть
-- ровно на этой таблице сломался бы перенос, ради которого схема и писалась
-- одним текстом на две СУБД.
CREATE TABLE edu_programs (
  inn           TEXT NOT NULL,
  program_key   TEXT NOT NULL,
  level         TEXT NOT NULL DEFAULT '',
  code          TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL DEFAULT '',
  qualification TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (inn, program_key)
);

CREATE INDEX edu_programs_inn_idx ON edu_programs (inn);

-- Тот же приём и по той же причине: самый длинный адрес занятий — 2636 байт
-- при пределе 2704. Зазор в 68 байт съест первое же обновление реестра.
CREATE TABLE edu_places (
  inn       TEXT NOT NULL,
  place_key TEXT NOT NULL,
  address   TEXT NOT NULL,
  PRIMARY KEY (inn, place_key)
);

CREATE INDEX edu_places_inn_idx ON edu_places (inn);

-- Одна строка на сборку: дата выгрузки источника и контрольные числа.
-- Нужна затем, чтобы карточка могла честно сказать, на какое число сведения,
-- а проверка — сверить, что база собрана этим сборщиком, а не осталась старой.
CREATE TABLE edu_meta (
  key   TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL
);
