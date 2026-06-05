import { isAdminSession } from "@/lib/rosdk-confrencia/admin";
import { getStoredSubmission } from "@/lib/rosdk-confrencia/storage";
import { sendArchiveResponse } from "@/lib/rosdk-confrencia/files";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAdminSession(req)) {
    return res.status(401).json({ error: "Требуется вход в админ-панель." });
  }

  const { id } = req.query;
  const submission = await getStoredSubmission(id);

  if (!submission) {
    return res.status(404).json({ error: "Заявка не найдена." });
  }

  return sendArchiveResponse(res, submission);
}
