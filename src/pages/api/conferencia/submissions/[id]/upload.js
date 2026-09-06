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

// Формат скана не важен: важно, чтобы файл дошёл. Отсекаем только явно чужое —
// исполняемые файлы и документы Word, которые присылают вместо скана по ошибке.
const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".zip",
  ".rar",
  ".7z",
];

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

// Снимок прямо с камеры телефона приходит без внятного имени — для него
// расширение берём из mime. Обратный ход запрещён: с `image/png` приезжал
// `паспорт.html` и ложился в архив Оргкомитету под именем скана паспорта.
const MIME_EXTENSIONS = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

/** Расширение, под которым файл ляжет на диск, либо null — такое не принимаем. */
function safeExtension(file) {
  const name = (file.originalFilename || file.name || "").toLowerCase();
  const byName = ALLOWED_EXTENSIONS.find((extension) => name.endsWith(extension));

  return byName ?? MIME_EXTENSIONS[file.mimetype] ?? null;
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

      const extension = safeExtension(file);

      if (!extension) {
        return res.status(400).json({
          error: `«${label}»: подойдёт фотография, PDF или архив (JPG, PNG, HEIC, PDF, ZIP).`,
        });
      }

      file.safeExtension = extension;
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
