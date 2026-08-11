import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { GENERATED_SLOTS, UPLOAD_SLOTS } from "./slots.js";

export { GENERATED_SLOTS, UPLOAD_SLOTS };

const CONTENT_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Читаем файл напрямую: модуль не должен тянуть слой БД ради fs.readFile.
function readFile(filePath) {
  return fs.readFile(filePath).catch(() => null);
}

export function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export function downloadName(submission, extension) {
  const safeRegion = slug(submission.region);
  const safeDelegate = slug(submission.delegateName);
  return `protocol-${safeRegion}-${safeDelegate}.${extension}`;
}

export async function sendFileResponse(res, filePath, contentType, name) {
  const buffer = await readFile(filePath);

  if (!buffer) {
    return res.status(404).json({ error: "Файл не найден." });
  }

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Content-Length", String(buffer.byteLength));
  return res.status(200).send(buffer);
}

async function buildZip(submission, slots) {
  const zip = new JSZip();
  let added = 0;

  for (const { slot, archiveName } of slots) {
    const filePath = submission.files?.[slot];
    if (!filePath) {
      continue;
    }

    const buffer = await readFile(filePath);
    if (!buffer) {
      continue;
    }

    const extension = path.extname(archiveName) || path.extname(filePath);
    const name = path.extname(archiveName) ? archiveName : `${archiveName}${extension}`;
    zip.file(name, buffer);
    added += 1;
  }

  return added > 0 ? zip : null;
}

async function sendZip(res, zip, name) {
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Content-Length", String(buffer.byteLength));
  return res.status(200).send(buffer);
}

/** Комплект бланков для печати — то, что РО скачивает на шаге 2. */
export async function sendGeneratedPackageResponse(res, submission) {
  const zip = await buildZip(submission, GENERATED_SLOTS);

  if (!zip) {
    return res.status(404).json({ error: "Документы не найдены." });
  }

  return sendZip(res, zip, downloadName(submission, "zip"));
}

/** Полный архив заявки для Оргкомитета: бланки, сканы, фото и метаданные. */
export async function sendArchiveResponse(res, submission) {
  const zip = await buildZip(submission, [...GENERATED_SLOTS, ...UPLOAD_SLOTS]);

  if (!zip) {
    return res.status(404).json({ error: "Файлы заявки не найдены." });
  }

  zip.file("submission.json", JSON.stringify(submission, null, 2));

  return sendZip(res, zip, downloadName(submission, "zip"));
}

function slug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
