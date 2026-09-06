// Одна сборка таблицы на всю панель: общий реестр по кнопке «Все заявки XLSX» и
// таблица внутри ZIP отделения строятся из одного описания строки, иначе колонки
// в этих двух выгрузках разъезжаются.

import * as XLSX from "xlsx";
import { STATUS_LABELS, UPLOAD_SLOTS, uploadProgress } from "./slots.js";
import { formatShortDate } from "./format.js";

/** Реестр делегатов для Мандатной комиссии: одна строка на заявку. */
export function toRegistryRow(submission, index) {
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

  row["Ссылка на заявку"] = `/conferencia?id=${submission.id}`;

  return row;
}

function sheetOf(rows) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = Object.keys(rows[0] ?? { "№": 1 }).map((key) => ({
    wch: Math.min(42, Math.max(10, key.length + 4)),
  }));

  return sheet;
}

function toBuffer(book) {
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}

/** Общая выгрузка: все отделения одной таблицей. */
export function buildRegistryWorkbook(submissions) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheetOf(submissions.map(toRegistryRow)), "Реестр делегатов");

  return toBuffer(book);
}

/**
 * Таблица одного отделения для его архива: те же поля плюс явочный лист —
 * ради него Оргкомитет и открывает пакет.
 */
export function buildSubmissionWorkbook(submission) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheetOf([toRegistryRow(submission, 0)]), "Заявка");

  const attendees = (submission.attendees ?? []).map((item, index) => ({
    "№": index + 1,
    "Ф.И.О.": item.fullName ?? "",
    "Серия паспорта": item.passportSeries ?? "",
    "Номер паспорта": item.passportNumber ?? "",
    Контакт: item.contact ?? item.phone ?? item.email ?? "",
  }));

  if (attendees.length > 0) {
    XLSX.utils.book_append_sheet(book, sheetOf(attendees), "Явочный лист");
  }

  return toBuffer(book);
}
