import path from "node:path";
import { isAdminSession } from "@/lib/rosdk-confrencia/admin";
import { getStoredSubmission } from "@/lib/rosdk-confrencia/storage";
import {
  GENERATED_SLOTS,
  UPLOAD_SLOTS,
  contentTypeFor,
  sendFileResponse,
} from "@/lib/rosdk-confrencia/files";

const SLOTS = [...GENERATED_SLOTS, ...UPLOAD_SLOTS];

/** Старые ссылки админки: docx/pdf/photo -> слоты новой схемы. */
const LEGACY_ALIASES = {
  docx: "protocolDocx",
  pdf: "protocolScan",
  photo: "photo",
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAdminSession(req)) {
    return res.status(401).json({ error: "Требуется вход в админ-панель." });
  }

  const { id, type } = req.query;
  const submission = await getStoredSubmission(id);

  if (!submission) {
    return res.status(404).json({ error: "Заявка не найдена." });
  }

  const slot = LEGACY_ALIASES[type] ?? type;
  const descriptor = SLOTS.find((item) => item.slot === slot);
  const filePath = descriptor && submission.files?.[slot];

  if (!filePath) {
    return res.status(404).json({ error: "Файл не найден." });
  }

  const parsed = path.parse(descriptor.archiveName);
  const extension = path.extname(filePath) || parsed.ext;

  return sendFileResponse(
    res,
    filePath,
    contentTypeFor(filePath),
    `${parsed.name}-${submission.region}${extension}`,
    req.query.inline === "1",
  );
}
