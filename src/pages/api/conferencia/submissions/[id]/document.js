import { getStoredSubmission } from "@/lib/rosdk-confrencia/storage";
import {
  GENERATED_SLOTS,
  contentTypeFor,
  sendFileResponse,
  sendGeneratedPackageResponse,
} from "@/lib/rosdk-confrencia/files";
import path from "node:path";

// Только бланки. Загруженные сканы отсюда не отдаются: эндпоинт открыт без
// авторизации — достаточно знать id заявки из адресной строки, а среди сканов
// лежат развороты паспорта делегата. Отделению они и не нужны: оригиналы у него
// на руках, а интерфейс кнопки скачивания скана никогда не показывал.
const SLOTS = GENERATED_SLOTS;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id, slot } = req.query;
  const submission = await getStoredSubmission(id);

  if (!submission) {
    return res.status(404).json({ error: "Заявка не найдена." });
  }

  if (!slot) {
    return sendGeneratedPackageResponse(res, submission);
  }

  const descriptor = SLOTS.find((item) => item.slot === slot);
  const filePath = descriptor && submission.files?.[slot];

  if (!filePath) {
    return res.status(404).json({ error: "Документ не найден." });
  }

  const parsed = path.parse(descriptor.archiveName);
  const extension = path.extname(filePath) || parsed.ext;

  return sendFileResponse(
    res,
    filePath,
    contentTypeFor(filePath),
    `${parsed.name}-${submission.region}${extension}`,
  );
}
