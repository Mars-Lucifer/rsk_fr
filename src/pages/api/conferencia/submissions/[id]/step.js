import {
  getStoredSubmission,
  toPublicSubmission,
  updateStoredSubmission,
} from "@/lib/rosdk-confrencia/storage";
import { generateSubmissionDocuments } from "@/lib/rosdk-confrencia/documents";
import { parseDelegateInput, parseVotesInput } from "@/lib/rosdk-confrencia/validation";
import { CREATE_SUBMISSION_LIMIT, rejectIfRateLimited } from "@/lib/rosdk-confrencia/rateLimit";

/**
 * Шаги 2 и 3 собрания: делегат и голосование. Каждый дописывает свои поля
 * и сразу отдаёт готовый документ — согласие и протокол соответственно.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (rejectIfRateLimited(res, "submission-step", req, CREATE_SUBMISSION_LIMIT)) {
    return undefined;
  }

  try {
    const { id } = req.query;
    const submission = await getStoredSubmission(id);

    if (!submission) {
      return res.status(404).json({ error: "Заявка не найдена." });
    }

    const step = String(req.body?.step ?? "");

    if (step === "delegate") {
      const patch = parseDelegateInput(req.body);
      const documents = await generateSubmissionDocuments({ ...submission, ...patch }, [
        "consentDocx",
      ]);

      return res
        .status(200)
        .json({ submission: toPublicSubmission(await updateStoredSubmission(id, patch, documents)) });
    }

    if (step === "votes") {
      // Протокол печатает и явку, и делегата: без второго шага его не собрать.
      if (!submission.delegateName || !submission.passportData) {
        return res.status(400).json({ error: "Сначала заполните блок «Делегат»." });
      }

      const patch = parseVotesInput(req.body, submission.presentMembers);
      const documents = await generateSubmissionDocuments({ ...submission, ...patch }, [
        "protocolDocx",
      ]);

      return res
        .status(200)
        .json({ submission: toPublicSubmission(await updateStoredSubmission(id, patch, documents)) });
    }

    return res.status(400).json({ error: "Неизвестный шаг." });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Не удалось сохранить данные." });
  }
}
