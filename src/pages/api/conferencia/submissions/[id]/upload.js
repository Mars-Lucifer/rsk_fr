import {
  attachStoredUploads,
  getStoredSubmission,
  toPublicSubmission,
} from "@/lib/rosdk-confrencia/storage";
import { UPLOAD_SLOTS } from "@/lib/rosdk-confrencia/files";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_LIMIT,
  rejectIfRateLimited,
} from "@/lib/rosdk-confrencia/rateLimit";
import { IncomingForm } from "formidable";

export const config = {
  api: {
    bodyParser: false,
  },
};

const DOCUMENT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: MAX_UPLOAD_BYTES,
      multiples: true,
    });

    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ fields, files });
    });
  });
}

function getSingleFile(fileField) {
  if (!fileField) return null;
  return Array.isArray(fileField) ? fileField[0] : fileField;
}

function isAllowed(file, extensions) {
  const name = (file.originalFilename || file.name || "").toLowerCase();
  const mime = file.mimetype || "";

  if (mime === "application/pdf" && extensions.includes(".pdf")) {
    return true;
  }
  if (mime.startsWith("image/")) {
    return true;
  }

  return extensions.some((extension) => name.endsWith(extension));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (rejectIfRateLimited(res, "upload", req, UPLOAD_LIMIT)) {
    return undefined;
  }

  try {
    const { id } = req.query;
    const submission = await getStoredSubmission(id);

    if (!submission) {
      return res.status(404).json({ error: "Заявка не найдена." });
    }

    const { files } = await parseForm(req);
    const uploads = {};

    for (const { slot, label } of UPLOAD_SLOTS) {
      const file = getSingleFile(files[slot]);

      // Сканы можно докладывать по одному: принимаем то, что пришло.
      if (!file) {
        continue;
      }

      const isPhoto = slot === "photo";
      const extensions = isPhoto ? IMAGE_EXTENSIONS : DOCUMENT_EXTENSIONS;

      if (!isAllowed(file, extensions)) {
        return res.status(400).json({
          error: isPhoto
            ? `«${label}»: допустимы только изображения (PNG, JPG, JPEG, WEBP).`
            : `«${label}»: допустимы только PDF или изображения (JPG, JPEG, PNG).`,
        });
      }

      uploads[slot] = file;
    }

    if (Object.keys(uploads).length === 0) {
      return res.status(400).json({ error: "Не выбрано ни одного файла." });
    }

    const updated = await attachStoredUploads(id, uploads);

    return res.status(200).json({ submission: toPublicSubmission(updated) });
  } catch (error) {
    const tooLarge =
      error?.code === "ETOOBIG" || /maxFileSize|exceeded/i.test(error?.message ?? "");

    return res.status(400).json({
      error: tooLarge
        ? `Файл слишком большой. Ограничение — ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} МБ на файл: уменьшите разрешение скана или сохраните в JPG.`
        : error.message || "Ошибка загрузки файлов.",
    });
  }
}
