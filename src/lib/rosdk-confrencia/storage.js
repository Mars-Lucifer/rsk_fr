import fs from "node:fs/promises";
import path from "node:path";
import {
  attachSignedPdfAndPhoto,
  createSubmission as createLocalSubmission,
  getSubmission as getLocalSubmission,
  listSignedSubmissionsByRegion as listLocalSignedSubmissionsByRegion,
} from "./db.js";
import { UPLOADS_DIR } from "./paths.js";

export function usesBlobStorage() {
  return false;
}

export async function createStoredSubmission(id, input, docxBuffer) {
  const dir = path.join(UPLOADS_DIR, id);
  await fs.mkdir(dir, { recursive: true });
  const docxPath = path.join(dir, "protocol.docx");
  await fs.writeFile(docxPath, docxBuffer);
  return createLocalSubmission(input, docxPath, id);
}

export async function getStoredSubmission(id) {
  return getLocalSubmission(id);
}

export async function listStoredSignedSubmissionsByRegion(region = "") {
  return listLocalSignedSubmissionsByRegion(region);
}

export async function attachStoredSignedPdfAndPhoto(id, pdfFile, photoFile) {
  const pdfName = pdfFile.name || pdfFile.originalFilename || "signed.pdf";
  const pdfExt = path.extname(pdfName) || ".pdf";

  const photoName = photoFile.name || photoFile.originalFilename || "photo.jpg";
  const photoExt = path.extname(photoName) || ".jpg";

  const dir = path.join(UPLOADS_DIR, id);
  await fs.mkdir(dir, { recursive: true });
  const pdfPath = path.join(dir, `signed${pdfExt}`);
  const photoPath = path.join(dir, `photo${photoExt}`);

  // Handle Formidable file object (filepath) vs standard Web File object (arrayBuffer)
  if (pdfFile.filepath) {
    await fs.copyFile(pdfFile.filepath, pdfPath);
  } else {
    await fs.writeFile(pdfPath, Buffer.from(await pdfFile.arrayBuffer()));
  }

  if (photoFile.filepath) {
    await fs.copyFile(photoFile.filepath, photoPath);
  } else {
    await fs.writeFile(photoPath, Buffer.from(await photoFile.arrayBuffer()));
  }

  return attachSignedPdfAndPhoto(id, pdfPath, photoPath);
}

export async function readStoredFile(pathname) {
  return fs.readFile(pathname);
}
