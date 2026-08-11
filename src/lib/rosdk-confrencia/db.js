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

    const existing = new Set(
      db.prepare("PRAGMA table_info(submissions)").all().map((column) => column.name),
    );
    for (const [name, ddl] of ADDED_COLUMNS) {
      if (!existing.has(name)) {
        db.exec(`ALTER TABLE submissions ADD COLUMN ${name} ${ddl}`);
      }
    }
  }

  return db;
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
    // Статус выводим из состава файлов, а не из колонки: у старых строк она
    // хранит 'signed_uploaded' при неполном комплекте.
    status: statusFor(files),
    files,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSubmission(input, files, submissionId = crypto.randomUUID()) {
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `INSERT INTO submissions (
        id, region, city, meeting_date, protocol_number, present_members,
        total_members, votes_for, votes_against, votes_abstain, delegate_name,
        delegate_phone, delegate_email, delegate_address, passport_data, chair_name,
        secretary_name, attendees, status, docx_path, pdf_path, files, created_at, updated_at
      ) VALUES (
        @id, @region, @city, @meetingDate, @protocolNumber, @presentMembers,
        @totalMembers, @votesFor, @votesAgainst, @votesAbstain, @delegateName,
        @delegatePhone, @delegateEmail, @delegateAddress, @passportData, @chairName,
        @secretaryName, @attendees, @status, @docxPath, NULL, @files, @createdAt, @updatedAt
      )`,
    )
    .run({
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
      id: submissionId,
      status: STATUS_DOCX_GENERATED,
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

export function listSubmissions(query = "", status = "") {
  const q = `%${query.trim().toLowerCase()}%`;
  const statusFilter = status.trim();
  const rows = getDb()
    .prepare(
      `SELECT * FROM submissions
       WHERE (@status = '' OR status = @status)
       AND (
        @query = '%%'
        OR lower(region) LIKE @query
        OR lower(city) LIKE @query
        OR lower(delegate_name) LIKE @query
        OR lower(protocol_number) LIKE @query
       )
       ORDER BY created_at DESC`,
    )
    .all({ query: q, status: statusFilter });

  return rows.map(toSubmission);
}

/** Сколько заявок уже прислал субъект РФ. Регион берётся из справочника, сверка точная. */
export function countSubmissionsForRegion(region) {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS total FROM submissions WHERE region = ?")
    .get(region);

  return row?.total ?? 0;
}

/** Все заявки региона, включая незавершённые: Оргкомитет должен видеть прогресс. */
export function listSubmissionsByRegion(region = "") {
  const q = `%${region.trim().toLowerCase()}%`;
  const rows = getDb()
    .prepare(
      `SELECT * FROM submissions
       WHERE @query = '%%' OR lower(region) LIKE @query
       ORDER BY created_at DESC`,
    )
    .all({ query: q });

  return rows.map(toSubmission);
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
       WHERE id = ?`,
    )
    .run(
      JSON.stringify(files),
      files.protocolScan ?? null,
      files.photo ?? null,
      statusFor(files),
      new Date().toISOString(),
      id,
    );

  return getSubmission(id);
}
