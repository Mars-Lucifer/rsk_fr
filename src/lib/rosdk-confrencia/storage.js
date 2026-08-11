import fs from "node:fs/promises";
import path from "node:path";
import {
  attachSignedFiles,
  countSubmissionsForRegion,
  createSubmission as createLocalSubmission,
  getSubmission as getLocalSubmission,
  listSubmissionsByRegion as listLocalSubmissionsByRegion,
  updateSubmission as updateLocalSubmission,
} from "./db.js";
import { UPLOADS_DIR } from "./paths.js";

export async function createStoredSubmission(id, input, documents) {
  const dir = path.join(UPLOADS_DIR, id);
  await fs.mkdir(dir, { recursive: true });

  const files = {};
  for (const [key, { fileName, buffer }] of Object.entries(documents)) {
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, buffer);
    files[key] = filePath;
  }

  return createLocalSubmission(input, files, id);
}

export async function getStoredSubmission(id) {
  return getLocalSubmission(id);
}

/**
 * Дописывает данные следующего шага собрания и сохраняет документы,
 * которые стало возможно собрать.
 */
export async function updateStoredSubmission(id, patch, documents = {}) {
  const dir = path.join(UPLOADS_DIR, id);
  await fs.mkdir(dir, { recursive: true });

  const files = {};
  for (const [key, { fileName, buffer }] of Object.entries(documents)) {
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, buffer);
    files[key] = filePath;
  }

  return updateLocalSubmission(id, patch, files);
}

export async function listStoredSubmissionsByRegion(region = "") {
  return listLocalSubmissionsByRegion(region);
}

export async function countStoredSubmissionsForRegion(region) {
  return countSubmissionsForRegion(region);
}

/**
 * Вид заявки для самого регионального отделения: без абсолютных путей на диске
 * сервера — по ссылке хватает признака «файл загружен».
 */
export function toPublicSubmission(submission) {
  const { files, ...rest } = submission;

  return {
    ...rest,
    files: Object.fromEntries(Object.keys(files).map((slot) => [slot, true])),
  };
}

/**
 * Сохраняет загруженные сканы. `uploads` — карта «слот -> файл» (formidable или Web File).
 */
export async function attachStoredUploads(id, uploads) {
  const dir = path.join(UPLOADS_DIR, id);
  await fs.mkdir(dir, { recursive: true });

  const files = {};
  for (const [slot, file] of Object.entries(uploads)) {
    const originalName = file.originalFilename || file.name || slot;
    const extension = path.extname(originalName).toLowerCase() || ".pdf";
    const filePath = path.join(dir, `${slot}${extension}`);

    // formidable отдаёт файл на диске (filepath), Web File — arrayBuffer.
    if (file.filepath) {
      await fs.copyFile(file.filepath, filePath);
    } else {
      await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    }

    files[slot] = filePath;
  }

  return attachSignedFiles(id, files);
}

export async function readStoredFile(pathname) {
  return fs.readFile(pathname);
}
