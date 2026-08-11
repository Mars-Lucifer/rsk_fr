import { getStoredSubmission } from "@/lib/rosdk-confrencia/storage";
import {
  GENERATED_SLOTS,
  UPLOAD_SLOTS,
  contentTypeFor,
  sendFileResponse,
  sendGeneratedPackageResponse,
} from "@/lib/rosdk-confrencia/files";
import path from "node:path";

// По ссылке заявки отделение забирает и бланки, и собственные загруженные сканы.
const SLOTS = [...GENERATED_SLOTS, ...UPLOAD_SLOTS];

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
