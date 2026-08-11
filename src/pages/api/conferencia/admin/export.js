import * as XLSX from "xlsx";
import { isAdminSession } from "@/lib/rosdk-confrencia/admin";
import { listStoredSubmissionsByRegion } from "@/lib/rosdk-confrencia/storage";
import { STATUS_LABELS, UPLOAD_SLOTS, uploadProgress } from "@/lib/rosdk-confrencia/slots";
import { formatShortDate } from "@/lib/rosdk-confrencia/format";

/** Реестр делегатов для Мандатной комиссии: одна строка на заявку. */
function toRow(submission, index) {
  const progress = uploadProgress(submission.files);

  const row = {
    "№": index + 1,
    "Субъект РФ": submission.region,
    Город: submission.city,
    "Дата собрания": formatShortDate(submission.meetingDate),
    "№ протокола": submission.protocolNumber,
    "Ф.И.О. делегата": submission.delegateName,
    "E-mail": submission.delegateEmail,
    Телефон: submission.delegatePhone,
    "Адрес регистрации": submission.delegateAddress,
    "Паспортные данные": submission.passportData,
    "Членов на учёте": submission.totalMembers,
    Присутствовало: submission.presentMembers,
    За: submission.votesFor,
    Против: submission.votesAgainst,
    Воздержались: submission.votesAbstain,
    "Председатель собрания": submission.chairName,
    "Секретарь собрания": submission.secretaryName,
    Статус: STATUS_LABELS[submission.status] ?? submission.status,
    "Документов загружено": `${progress.done} из ${progress.total}`,
  };

  for (const slot of UPLOAD_SLOTS) {
    row[slot.short] = submission.files?.[slot.slot] ? "да" : "нет";
  }

  row["Ссылка на заявку"] = `/conferencia/${submission.id}`;

  return row;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAdminSession(req)) {
    return res.status(401).json({ error: "Требуется вход в админ-панель." });
  }

  const region = req.query.region || "";
  const submissions = await listStoredSubmissionsByRegion(region);
  const rows = submissions.map(toRow);

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = Object.keys(rows[0] ?? { "№": 1 }).map((key) => ({
    wch: Math.min(42, Math.max(10, key.length + 4)),
  }));

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Реестр делегатов");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });

  const name = `реестр-делегатов-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Content-Length", String(buffer.byteLength));

  return res.status(200).send(buffer);
}
