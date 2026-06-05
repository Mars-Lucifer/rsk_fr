import { attachStoredSignedPdfAndPhoto, getStoredSubmission } from "@/lib/rosdk-confrencia/storage";
import { IncomingForm } from "formidable";

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024,
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query;
    const submission = await getStoredSubmission(id);

    if (!submission) {
      return res.status(404).json({ error: "Заявка не найдена." });
    }

    const { files } = await parseForm(req);
    const pdfFile = getSingleFile(files.file);
    const photoFile = getSingleFile(files.photo);

    if (!pdfFile) {
      return res.status(400).json({ error: "Загрузите фото/скан подписанного протокола." });
    }

    const pdfName = pdfFile.originalFilename || pdfFile.name || "";
    const pdfNameLower = pdfName.toLowerCase();
    const pdfMime = pdfFile.mimetype || "";
    const isValidFile =
      pdfMime === "application/pdf" ||
      pdfMime.startsWith("image/") ||
      pdfNameLower.endsWith(".pdf") ||
      pdfNameLower.endsWith(".jpg") ||
      pdfNameLower.endsWith(".jpeg") ||
      pdfNameLower.endsWith(".png");

    if (!isValidFile) {
      return res.status(400).json({ error: "Допустимы только файлы PDF или изображения (JPG, JPEG, PNG)." });
    }

    if (!photoFile) {
      return res.status(400).json({ error: "Загрузите фотографию/скриншот с конференции." });
    }

    const photoName = photoFile.originalFilename || photoFile.name || "";
    const photoNameLower = photoName.toLowerCase();
    const photoMime = photoFile.mimetype || "";
    const isValidImage =
      photoMime.startsWith("image/") ||
      photoNameLower.endsWith(".png") ||
      photoNameLower.endsWith(".jpg") ||
      photoNameLower.endsWith(".jpeg") ||
      photoNameLower.endsWith(".webp");

    if (!isValidImage) {
      return res.status(400).json({
        error: "Допустимы только файлы изображений (PNG, JPG, JPEG, WEBP).",
      });
    }

    const updated = await attachStoredSignedPdfAndPhoto(id, pdfFile, photoFile);

    return res.status(200).json({ submission: updated });
  } catch (error) {
    return res.status(400).json({
      error: error.message || "Ошибка загрузки файлов.",
    });
  }
}
