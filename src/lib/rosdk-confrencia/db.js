import fs from "node:fs";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { DATA_DIR, DB_PATH } from "./paths.js";

let db = null;

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
    const columns = db.prepare("PRAGMA table_info(submissions)").all();
    if (!columns.some((column) => column.name === "delegate_phone")) {
      db.exec("ALTER TABLE submissions ADD COLUMN delegate_phone TEXT NOT NULL DEFAULT ''");
    }
    if (!columns.some((column) => column.name === "photo_path")) {
      db.exec("ALTER TABLE submissions ADD COLUMN photo_path TEXT");
    }
  }

  return db;
}

function toSubmission(row) {
  return {
    id: row.id,
    region: row.region,
    city: row.city,
    meetingDate: row.meeting_date,
    protocolNumber: row.protocol_number,
    presentMembers: row.present_members,
    totalMembers: row.total_members,
    votesFor: row.votes_for,
    delegateName: row.delegate_name,
    delegatePhone: row.delegate_phone,
    passportData: row.passport_data,
    chairName: row.chair_name,
    secretaryName: row.secretary_name,
    status: row.status,
    docxPath: row.docx_path,
    pdfPath: row.pdf_path,
    photoPath: row.photo_path || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSubmission(
  input,
  docxPath,
  submissionId = crypto.randomUUID(),
) {
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `INSERT INTO submissions (
        id, region, city, meeting_date, protocol_number, present_members,
        total_members, votes_for, delegate_name, delegate_phone, passport_data, chair_name,
        secretary_name, status, docx_path, pdf_path, created_at, updated_at
      ) VALUES (
        @id, @region, @city, @meetingDate, @protocolNumber, @presentMembers,
        @totalMembers, @votesFor, @delegateName, @delegatePhone, @passportData, @chairName,
        @secretaryName, @status, @docxPath, NULL, @createdAt, @updatedAt
      )`,
    )
    .run({
      ...input,
      id: submissionId,
      status: "docx_generated",
      docxPath,
      createdAt: now,
      updatedAt: now,
    });

  return getSubmission(submissionId);
}

export function getSubmission(id) {
  const row = getDb()
    .prepare("SELECT * FROM submissions WHERE id = ?")
    .get(id);

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

export function listSignedSubmissionsByRegion(region = "") {
  const q = `%${region.trim().toLowerCase()}%`;
  const rows = getDb()
    .prepare(
      `SELECT * FROM submissions
       WHERE status = 'signed_uploaded'
       AND (@query = '%%' OR lower(region) LIKE @query)
       ORDER BY created_at DESC`,
    )
    .all({ query: q });

  return rows.map(toSubmission);
}

export function attachSignedPdfAndPhoto(id, pdfPath, photoPath) {
  getDb()
    .prepare(
      `UPDATE submissions
       SET pdf_path = ?, photo_path = ?, status = 'signed_uploaded', updated_at = ?
       WHERE id = ?`,
    )
    .run(pdfPath, photoPath, new Date().toISOString(), id);

  return getSubmission(id);
}
