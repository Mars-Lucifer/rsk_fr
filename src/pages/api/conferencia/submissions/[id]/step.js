import {
  getStoredSubmission,
  toPublicSubmission,
  updateStoredSubmission,
} from "@/lib/rosdk-confrencia/storage";
import { generateSubmissionDocuments } from "@/lib/rosdk-confrencia/documents";
import { readyDocuments } from "@/lib/rosdk-confrencia/documents";
import {
  parseDelegateInput,
  parseRegistrationInput,
  parseVotesInput,
  votesAreStale,
} from "@/lib/rosdk-confrencia/validation";
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

    // Правка уже внесённых данных: явочный лист меняется — вместе с ним и бланки,
    // где печатается явка, председатель и субъект.
    if (step === "registration") {
      const patch = parseRegistrationInput({ ...req.body, region: submission.region });
      // Номер протокола выдан при создании заявки по субъекту — значит и субъект,
      // и номер после создания заморожены: иначе нумерация региона разъедется.
      patch.protocolNumber = submission.protocolNumber;
      patch.region = submission.region;

      // Явка изменилась, а голоса считались от прежней. Отказать нельзя: новые
      // голоса тоже сверяются с явкой, и отделение осталось бы с заявкой, которую
      // не починить ни с одной стороны. Поэтому протокол отзываем, а блок
      // «Голосование» снова просит цифры — уже под новую явку.
      const votesTotal = submission.votesFor + submission.votesAgainst + submission.votesAbstain;
      const votesStale = votesAreStale(submission, patch.presentMembers);

      if (votesStale) {
        patch.votesFor = 0;
        patch.votesAgainst = 0;
        patch.votesAbstain = 0;
      }

      const merged = { ...submission, ...patch };
      const documents = await generateSubmissionDocuments(merged, readyDocuments(merged));

      if (votesStale) {
        documents.protocolDocx = null;
      }

      return res.status(200).json({
        submission: toPublicSubmission(await updateStoredSubmission(id, patch, documents)),
        notice: votesStale
          ? `В явочном листе теперь ${patch.presentMembers} человек, а в голосовании было учтено ${votesTotal}. ` +
            "Протокол отозван: откройте блок «Голосование», внесите результаты заново и распечатайте протокол ещё раз."
          : null,
      });
    }

    if (step === "delegate") {
      const patch = parseDelegateInput(req.body);
      const merged = { ...submission, ...patch };
      const documents = await generateSubmissionDocuments(
        merged,
        readyDocuments(merged).filter((slot) => slot !== "attendanceDocx")
      );

      return res.status(200).json({
        submission: toPublicSubmission(await updateStoredSubmission(id, patch, documents)),
      });
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

      return res.status(200).json({
        submission: toPublicSubmission(await updateStoredSubmission(id, patch, documents)),
      });
    }

    return res.status(400).json({ error: "Неизвестный шаг." });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Не удалось сохранить данные." });
  }
}
