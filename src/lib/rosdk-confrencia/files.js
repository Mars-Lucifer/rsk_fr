import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { readStoredFile } from "./storage.js";

export function downloadName(submission, extension) {
  const safeRegion = slug(submission.region);
  const safeDelegate = slug(submission.delegateName);
  return `protocol-${safeRegion}-${safeDelegate}.${extension}`;
}

export async function sendFileResponse(res, filePath, contentType, name) {
  const buffer = await readStoredFile(filePath);

  if (!buffer) {
    return res.status(404).json({ error: "Файл не найден." });
  }

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Content-Length", String(buffer.byteLength));
  return res.status(200).send(buffer);
}

export async function sendArchiveResponse(res, submission) {
  const zip = new JSZip();
  const docx = await readStoredFile(submission.docxPath);
  const pdf = submission.pdfPath ? await readStoredFile(submission.pdfPath) : null;
  const photo = submission.photoPath ? await readStoredFile(submission.photoPath) : null;

  if (!docx) {
    return res.status(404).json({ error: "DOCX не найден." });
  }

  zip.file("submission.json", JSON.stringify(submission, null, 2));
  zip.file("protocol.docx", docx);

  if (pdf) {
    zip.file("signed.pdf", pdf);
  }

  if (photo) {
    const photoExt = path.extname(submission.photoPath) || ".jpg";
    zip.file(`photo${photoExt}`, photo);
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(downloadName(submission, "zip"))}`);
  res.setHeader("Content-Length", String(buffer.byteLength));
  return res.status(200).send(buffer);
}

export async function ensureFileInsideUploads(filePath) {
  const resolved = path.resolve(filePath);
  await fs.access(resolved);
  return resolved;
}

function slug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
