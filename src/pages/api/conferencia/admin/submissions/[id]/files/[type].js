import { isAdminSession } from "@/lib/rosdk-confrencia/admin";
import { getStoredSubmission } from "@/lib/rosdk-confrencia/storage";
import { downloadName, sendFileResponse } from "@/lib/rosdk-confrencia/files";

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

  if (type === "docx") {
    return sendFileResponse(
      res,
      submission.docxPath,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      downloadName(submission, "docx"),
    );
  }

  if (type === "pdf" && submission.pdfPath) {
    const pathLower = submission.pdfPath.toLowerCase();
    const isPdf = pathLower.endsWith(".pdf");
    const isPng = pathLower.endsWith(".png");
    let contentType = "image/jpeg";
    let ext = "jpg";
    if (isPdf) {
      contentType = "application/pdf";
      ext = "pdf";
    } else if (isPng) {
      contentType = "image/png";
      ext = "png";
    }
    return sendFileResponse(
      res,
      submission.pdfPath,
      contentType,
      downloadName(submission, ext),
    );
  }

  if (type === "photo" && submission.photoPath) {
    const pathLower = submission.photoPath.toLowerCase();
    const isPng = pathLower.endsWith(".png");
    const isWebp = pathLower.endsWith(".webp");
    let contentType = "image/jpeg";
    let ext = "jpg";
    if (isPng) {
      contentType = "image/png";
      ext = "png";
    } else if (isWebp) {
      contentType = "image/webp";
      ext = "webp";
    }
    return sendFileResponse(res, submission.photoPath, contentType, downloadName(submission, ext));
  }

  return res.status(404).json({ error: "Файл не найден." });
}
