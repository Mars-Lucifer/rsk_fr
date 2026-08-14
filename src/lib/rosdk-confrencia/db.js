import fs from "node:fs";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { DATA_DIR, DB_PATH } from "./paths.js";
import { STATUS_DOCX_GENERATED, statusFor } from "./slots.js";

let db = null;

/** Колонки, добавленные после первого релиза: имя -> DDL для ALTER TABLE. */
const ADDED_COLUMNS = [
  ["delegate_phone", "TEXT NOT NULL DEFAULT ''"],
  ["photo_path", "TEXT"],
  ["delegate_email", "TEXT NOT NULL DEFAULT ''"],
  ["delegate_address", "TEXT NOT NULL DEFAULT ''"],
  ["votes_against", "INTEGER NOT NULL DEFAULT 0"],
  ["votes_abstain", "INTEGER NOT NULL DEFAULT 0"],
  ["attendees", "TEXT NOT NULL DEFAULT '[]'"],
  ["files", "TEXT NOT NULL DEFAULT '{}'"],
  // Паспорт и адрес хранятся собранными строками — для бланков этого хватает,
  // а форме нужно вернуть их по полям, когда отделение открывает блок на правку.
  ["delegate_fields", "TEXT NOT NULL DEFAULT '{}'"],
];

/** Кто в отделении отвечает за пакет: Оргкомитет ведёт этот список сам. */
const ADDED_LINK_COLUMNS = [
  ["responsible_name", "TEXT NOT NULL DEFAULT ''"],
  ["responsible_phone", "TEXT NOT NULL DEFAULT ''"],
  ["responsible_max", "TEXT NOT NULL DEFAULT ''"],
];

export function getDb() {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        region TEXT NOT NULL,
        city TEXT NOT NULL,
        meeting_date TEXT NOT NULL,
        protocol_number TEXT NOT NULL,
        present_members INTEGER NOT NULL,
        total_members INTEGER NOT NULL,
        votes_for INTEGER NOT NULL,
        delegate_name TEXT NOT NULL,
        delegate_phone TEXT NOT NULL DEFAULT '',
        passport_data TEXT NOT NULL,
        chair_name TEXT NOT NULL,
        secretary_name TEXT NOT NULL,
        status TEXT NOT NULL,
        docx_path TEXT NOT NULL,
        pdf_path TEXT,
        photo_path TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS app_secrets (
        name TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS region_links (
        region TEXT PRIMARY KEY,
        sent_at TEXT
      );
    `);

    const columnsOf = (table) =>
      new Set(
        db
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .map((column) => column.name)
      );

    const existing = columnsOf("submissions");
    for (const [name, ddl] of ADDED_COLUMNS) {
      if (!existing.has(name)) {
        db.exec(`ALTER TABLE submissions ADD COLUMN ${name} ${ddl}`);
      }
    }

    const linkColumns = columnsOf("region_links");
    for (const [name, ddl] of ADDED_LINK_COLUMNS) {
      if (!linkColumns.has(name)) {
        db.exec(`ALTER TABLE region_links ADD COLUMN ${name} ${ddl}`);
      }
    }
  }

  return db;
}

/**
 * Секрет приложения, переживающий перезапуск: хранится рядом с данными, которые
 * он защищает. Так соль ссылок не зависит ни от `.env` на сервере, ни от пароля
 * админки — ссылки, разосланные в отделения, не протухают.
 */
export function persistentSecret(name) {
  const db = getDb();
  const row = db.prepare("SELECT value FROM app_secrets WHERE name = ?").get(name);

  if (row?.value) {
    return row.value;
  }

  const value = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO app_secrets (name, value) VALUES (?, ?)").run(name, value);

  return value;
}

const LINK_FIELDS = {
  responsibleName: "responsible_name",
  responsiblePhone: "responsible_phone",
  responsibleMax: "responsible_max",
};

function toRegionLink(row) {
  return {
    sentAt: row.sent_at ?? null,
    responsibleName: row.responsible_name ?? "",
    responsiblePhone: row.responsible_phone ?? "",
    responsibleMax: row.responsible_max ?? "",
  };
}

/**
 * Рассылка ведётся руками, поэтому руками же ведётся и её учёт: отметка
 * «отправлено» и контакты того, кто в отделении отвечает за пакет.
 * `patch.sent` — булево, остальные поля строковые; переданные заменяются.
 */
export function updateRegionLink(region, patch = {}) {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO region_links (region) VALUES (?)").run(region);

  const assignments = [];
  const values = { region };

  if (patch.sent !== undefined) {
    assignments.push("sent_at = @sentAt");
    values.sentAt = patch.sent ? new Date().toISOString() : null;
  }

  for (const [field, column] of Object.entries(LINK_FIELDS)) {
    if (patch[field] !== undefined) {
      assignments.push(`${column} = @${field}`);
      values[field] = String(patch[field]).trim();
    }
  }

  if (assignments.length > 0) {
    db.prepare(`UPDATE region_links SET ${assignments.join(", ")} WHERE region = @region`).run(
      values
    );
  }

  return toRegionLink(db.prepare("SELECT * FROM region_links WHERE region = ?").get(region));
}

/** Карта «субъект -> отметка и контакты». Нетронутых субъектов в ней нет. */
export function listRegionLinks() {
  const rows = getDb().prepare("SELECT * FROM region_links").all();

  return Object.fromEntries(rows.map((row) => [row.region, toRegionLink(row)]));
}

function parseJson(value, fallback) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toSubmission(row) {
  // Старые строки хранят пути только в отдельных колонках — подмешиваем их в files.
  const files = {
    ...(row.docx_path ? { protocolDocx: row.docx_path } : {}),
    ...(row.pdf_path ? { protocolScan: row.pdf_path } : {}),
    ...(row.photo_path ? { photo: row.photo_path } : {}),
    ...parseJson(row.files, {}),
  };

  return {
    id: row.id,
    region: row.region,
    city: row.city,
    meetingDate: row.meeting_date,
    protocolNumber: row.protocol_number,
    presentMembers: row.present_members,
    totalMembers: row.total_members,
    votesFor: row.votes_for,
    votesAgainst: row.votes_against ?? 0,
    votesAbstain: row.votes_abstain ?? 0,
    delegateName: row.delegate_name,
    delegatePhone: row.delegate_phone,
    delegateEmail: row.delegate_email ?? "",
    delegateAddress: row.delegate_address ?? "",
    passportData: row.passport_data,
    chairName: row.chair_name,
    secretaryName: row.secretary_name,
    attendees: parseJson(row.attendees, []),
    delegateFields: parseJson(row.delegate_fields, {}),
    // Статус выводим из состава файлов, а не из колонки: у старых строк она
    // хранит 'signed_uploaded' при неполном комплекте.
    status: statusFor(files),
    files,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Заявка живёт по шагам собрания: сначала регистрация, потом делегат,
 * потом голосование. Незаполненные поля лежат пустыми — статус выводится
 * из состава готовых документов, а не из отдельной колонки.
 */
const EMPTY_SUBMISSION = {
  region: "",
  city: "",
  meetingDate: "",
  protocolNumber: "1",
  presentMembers: 0,
  totalMembers: 0,
  votesFor: 0,
  votesAgainst: 0,
  votesAbstain: 0,
  delegateName: "",
  delegatePhone: "",
  delegateEmail: "",
  delegateAddress: "",
  passportData: "",
  chairName: "",
  secretaryName: "",
  attendees: [],
  delegateFields: {},
};

const COLUMNS = {
  region: "region",
  city: "city",
  meetingDate: "meeting_date",
  protocolNumber: "protocol_number",
  presentMembers: "present_members",
  totalMembers: "total_members",
  votesFor: "votes_for",
  votesAgainst: "votes_against",
  votesAbstain: "votes_abstain",
  delegateName: "delegate_name",
  delegatePhone: "delegate_phone",
  delegateEmail: "delegate_email",
  delegateAddress: "delegate_address",
  passportData: "passport_data",
  chairName: "chair_name",
  secretaryName: "secretary_name",
};

/** Дописывает поля следующего шага и пути к сгенерированным документам. */
export function updateSubmission(id, patch = {}, files = {}) {
  const current = getSubmission(id);
  if (!current) {
    return null;
  }

  const assignments = [];
  const values = {};

  for (const [field, column] of Object.entries(COLUMNS)) {
    if (patch[field] !== undefined) {
      assignments.push(`${column} = @${field}`);
      values[field] = patch[field];
    }
  }

  if (patch.attendees !== undefined) {
    assignments.push("attendees = @attendees");
    values.attendees = JSON.stringify(patch.attendees);
  }

  if (patch.delegateFields !== undefined) {
    assignments.push("delegate_fields = @delegateFields");
    values.delegateFields = JSON.stringify(patch.delegateFields);
  }

  // Значение null означает «файл больше не действителен»: так аннулируется
  // протокол, когда явка изменилась и голоса к ней уже не сходятся.
  const mergedFiles = { ...current.files, ...files };
  for (const [slot, value] of Object.entries(mergedFiles)) {
    if (value == null) {
      delete mergedFiles[slot];
    }
  }

  assignments.push("files = @files", "status = @status", "updated_at = @updatedAt");
  values.files = JSON.stringify(mergedFiles);
  values.status = statusFor(mergedFiles);
  values.updatedAt = new Date().toISOString();
  values.id = id;

  getDb()
    .prepare(`UPDATE submissions SET ${assignments.join(", ")} WHERE id = @id`)
    .run(values);

  return getSubmission(id);
}

/** Отделение уже прислало пакет: счётчик и вставка обязаны идти одной транзакцией. */
export const REGION_LIMIT_CODE = "REGION_LIMIT";

export function createSubmission(
  partialInput,
  files,
  submissionId = crypto.randomUUID(),
  maxPerRegion = null
) {
  const input = { ...EMPTY_SUBMISSION, ...partialInput };
  const now = new Date().toISOString();

  const insert = getDb()
    .prepare(
      `INSERT INTO submissions (
        id, region, city, meeting_date, protocol_number, present_members,
        total_members, votes_for, votes_against, votes_abstain, delegate_name,
        delegate_phone, delegate_email, delegate_address, passport_data, chair_name,
        secretary_name, attendees, delegate_fields, status, docx_path, pdf_path, files,
        created_at, updated_at
      ) VALUES (
        @id, @region, @city, @meetingDate, @protocolNumber, @presentMembers,
        @totalMembers, @votesFor, @votesAgainst, @votesAbstain, @delegateName,
        @delegatePhone, @delegateEmail, @delegateAddress, @passportData, @chairName,
        @secretaryName, @attendees, @delegateFields, @status, @docxPath, NULL, @files,
        @createdAt, @updatedAt
      )`
    );

  // Проверка лимита внутри транзакции: между COUNT и INSERT снаружи помещается
  // второе сохранение того же отделения, и субъект уезжает с двумя пакетами.
  const insertUnderLimit = getDb().transaction((values) => {
    if (maxPerRegion !== null) {
      const taken = countSubmissionsForRegion(values.region);

      if (taken >= maxPerRegion) {
        const error = new Error("Заявка от этого субъекта уже принята.");
        error.code = REGION_LIMIT_CODE;
        throw error;
      }
    }

    insert.run(values);
  });

  insertUnderLimit({
    region: input.region,
    city: input.city,
    meetingDate: input.meetingDate,
    protocolNumber: input.protocolNumber,
    presentMembers: input.presentMembers,
    totalMembers: input.totalMembers,
    votesFor: input.votesFor,
    votesAgainst: input.votesAgainst,
    votesAbstain: input.votesAbstain,
    delegateName: input.delegateName,
    delegatePhone: input.delegatePhone,
    delegateEmail: input.delegateEmail,
    delegateAddress: input.delegateAddress,
    passportData: input.passportData,
    chairName: input.chairName,
    secretaryName: input.secretaryName,
    attendees: JSON.stringify(input.attendees ?? []),
    delegateFields: JSON.stringify(input.delegateFields ?? {}),
    id: submissionId,
    status: statusFor(files),
    docxPath: files.protocolDocx ?? "",
    files: JSON.stringify(files),
    createdAt: now,
    updatedAt: now,
  });

  return getSubmission(submissionId);
}

export function getSubmission(id) {
  const row = getDb().prepare("SELECT * FROM submissions WHERE id = ?").get(id);

  return row ? toSubmission(row) : null;
}

/** Сколько заявок уже прислал субъект РФ. Регион берётся из справочника, сверка точная. */
export function countSubmissionsForRegion(region) {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS total FROM submissions WHERE region = ?")
    .get(region);

  return row?.total ?? 0;
}

/**
 * Все заявки региона, включая незавершённые: Оргкомитет должен видеть прогресс.
 *
 * Фильтр считается в Node, а не в SQL: `lower()` в SQLite приводит к нижнему
 * регистру только латиницу, поэтому «псковская» не находило «Псковская область».
 * ponytail: полный перебор, заявок здесь сотни — при десятках тысяч нужен индекс.
 */
export function listSubmissionsByRegion(region = "") {
  const rows = getDb().prepare("SELECT * FROM submissions ORDER BY created_at DESC").all();
  const found = rows.map(toSubmission);
  const needle = region.trim().toLowerCase();

  return needle ? found.filter((item) => item.region.toLowerCase().includes(needle)) : found;
}

/**
 * Дописывает пути загруженных сканов. Статус выводится из состава файлов,
 * поэтому сканы можно докладывать по одному в течение нескольких дней.
 */
export function attachSignedFiles(id, uploadedFiles) {
  const current = getSubmission(id);
  if (!current) {
    return null;
  }

  const files = { ...current.files, ...uploadedFiles };

  getDb()
    .prepare(
      `UPDATE submissions
       SET files = ?, pdf_path = ?, photo_path = ?, status = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      JSON.stringify(files),
      files.protocolScan ?? null,
      files.photo ?? null,
      statusFor(files),
      new Date().toISOString(),
      id
    );

  return getSubmission(id);
}
