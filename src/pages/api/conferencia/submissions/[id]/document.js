import { getStoredSubmission } from "@/lib/rosdk-confrencia/storage";
import { downloadName, sendFileResponse } from "@/lib/rosdk-confrencia/files";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  const submission = await getStoredSubmission(id);

  if (!submission) {
    return res.status(404).json({ error: "Заявка не найдена." });
  }

  return sendFileResponse(
    res,
    submission.docxPath,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    downloadName(submission, "docx"),
  );
}
