import { generateSubmissionDocuments } from "@/lib/rosdk-confrencia/documents";
import {
  REGION_LIMIT_CODE,
  countStoredSubmissionsForRegion,
  createStoredSubmission,
  toPublicSubmission,
} from "@/lib/rosdk-confrencia/storage";
import { parseRegistrationInput } from "@/lib/rosdk-confrencia/validation";
import {
  MAX_SUBMISSIONS_PER_REGION,
  SUBMISSION_COOKIE,
  buildProtocolNumber,
} from "@/lib/rosdk-confrencia/slots";
import { regions } from "@/lib/rosdk-confrencia/regions";
import { regionByToken } from "@/lib/rosdk-confrencia/regionLinks";
import { CREATE_SUBMISSION_LIMIT, rejectIfRateLimited } from "@/lib/rosdk-confrencia/rateLimit";
import crypto from "node:crypto";

/** Один текст на оба заслона: и на проверку до сборки бланков, и на транзакцию. */
const regionTakenMessage = (region) =>
  `От «${region}» заявка уже принята. Одно отделение подаёт один пакет: ` +
  "откройте свою персональную ссылку и правьте заявку там — " +
  "или напишите в Оргкомитет, если нужна замена.";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (rejectIfRateLimited(res, "create-submission", req, CREATE_SUBMISSION_LIMIT)) {
    return undefined;
  }

  // Субъект нужен и в обработчике ошибки, поэтому живёт снаружи try.
  let region = "";

  try {
    // Шаг 1 собрания: регистрация. Заявка появляется сразу, чтобы ссылка была
    // на руках до того, как отделение дойдёт до делегата и голосования.
    // Пришли по персональной ссылке — субъект берём из её токена, а не из тела
    // запроса: иначе отделение случайно (или намеренно) отправит пакет за другое.
    const linkedRegion = regionByToken(String(req.body?.linkToken ?? ""));
    const input = parseRegistrationInput(
      linkedRegion ? { ...req.body, region: linkedRegion } : req.body
    );

    region = input.region;

    const alreadySent = await countStoredSubmissionsForRegion(input.region);
    if (alreadySent >= MAX_SUBMISSIONS_PER_REGION) {
      return res.status(409).json({ error: regionTakenMessage(input.region) });
    }

    // Номер протокола присваиваем сами: у каждого субъекта своя нумерация.
    input.protocolNumber = buildProtocolNumber(regions.indexOf(input.region), alreadySent);

    const id = crypto.randomUUID();
    const documents = await generateSubmissionDocuments(input, ["attendanceDocx"]);
    const submission = await createStoredSubmission(
      id,
      input,
      documents,
      MAX_SUBMISSIONS_PER_REGION
    );

    if (!submission) {
      throw new Error("Не удалось создать заявку.");
    }

    // Подсказка «продолжить заявку» на главной, если ссылку потеряли. Кука даёт
    // доступ к заявке целиком, поэтому не читается скриптами и по открытому http
    // в проде не уходит.
    const cookie = [
      `${SUBMISSION_COOKIE}=${submission.id}`,
      "Path=/",
      `Max-Age=${90 * 24 * 3600}`,
      "SameSite=Lax",
      "HttpOnly",
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");

    res.setHeader("Set-Cookie", cookie);

    return res.status(201).json({ submission: toPublicSubmission(submission) });
  } catch (error) {
    // Гонка двух одновременных сохранений одного отделения: транзакция отбила
    // вторую вставку — отвечаем тем же 409, что и проверка до сборки бланков.
    if (error?.code === REGION_LIMIT_CODE) {
      return res.status(409).json({ error: regionTakenMessage(region) });
    }

    return res.status(400).json({
      error: error.message || "Ошибка создания заявки.",
    });
  }
}
