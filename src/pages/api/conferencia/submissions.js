import { generateSubmissionDocuments } from "@/lib/rosdk-confrencia/documents";
import {
  countStoredSubmissionsForRegion,
  createStoredSubmission,
  toPublicSubmission,
} from "@/lib/rosdk-confrencia/storage";
import { parseSubmissionInput } from "@/lib/rosdk-confrencia/validation";
import { MAX_SUBMISSIONS_PER_REGION, SUBMISSION_COOKIE } from "@/lib/rosdk-confrencia/slots";
import { CREATE_SUBMISSION_LIMIT, rejectIfRateLimited } from "@/lib/rosdk-confrencia/rateLimit";
import crypto from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (rejectIfRateLimited(res, "create-submission", req, CREATE_SUBMISSION_LIMIT)) {
    return undefined;
  }

  try {
    const input = parseSubmissionInput(req.body);

    const alreadySent = await countStoredSubmissionsForRegion(input.region);
    if (alreadySent >= MAX_SUBMISSIONS_PER_REGION) {
      return res.status(409).json({
        error:
          `От «${input.region}» уже принято заявок: ${alreadySent}. ` +
          `Больше ${MAX_SUBMISSIONS_PER_REGION} на одно отделение не предусмотрено — ` +
          "откройте ссылку на ранее созданную заявку или напишите в Оргкомитет.",
      });
    }

    const id = crypto.randomUUID();
    const documents = await generateSubmissionDocuments(input);
    const submission = await createStoredSubmission(id, input, documents);

    if (!submission) {
      throw new Error("Не удалось создать заявку.");
    }

    // Подсказка «продолжить заявку» на главной, если ссылку потеряли.
    res.setHeader(
      "Set-Cookie",
      `${SUBMISSION_COOKIE}=${submission.id}; Path=/; Max-Age=${90 * 24 * 3600}; SameSite=Lax`,
    );

    return res.status(201).json({ submission: toPublicSubmission(submission) });
  } catch (error) {
    return res.status(400).json({
      error: error.message || "Ошибка создания заявки.",
    });
  }
}
