import { generateProtocolDocx } from "@/lib/rosdk-confrencia/docx";
import { createStoredSubmission } from "@/lib/rosdk-confrencia/storage";
import { parseSubmissionInput } from "@/lib/rosdk-confrencia/validation";
import crypto from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const input = parseSubmissionInput(req.body);
    const id = crypto.randomUUID();
    const docxBuffer = await generateProtocolDocx(input);
    const submission = await createStoredSubmission(id, input, docxBuffer);

    if (!submission) {
      throw new Error("Не удалось создать заявку.");
    }

    return res.status(201).json({ submission });
  } catch (error) {
    return res.status(400).json({
      error: error.message || "Ошибка создания заявки.",
    });
  }
}
