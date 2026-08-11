// Описание файлов заявки. Модуль без серверных зависимостей — импортируется и формой,
// и API, поэтому здесь не должно появляться fs / better-sqlite3.

/** Дата Конференции. Правится здесь — попадает и в бланки, и в текст страницы. */
export const CONFERENCE_DATE = "21 сентября 2026 года";

/** Три бланка, которые генерирует шаг 2 и печатает РО. */
export const GENERATED_SLOTS = [
  {
    slot: "protocolDocx",
    short: "Протокол",
    label: "Протокол собрания РО",
    archiveName: "1-протокол.docx",
  },
  {
    slot: "attendanceDocx",
    short: "Явочный лист",
    label: "Список присутствовавших (Приложение № 1)",
    archiveName: "2-явочный-лист.docx",
  },
  {
    slot: "consentDocx",
    short: "Согласие",
    label: "Согласие делегата на обработку персданных",
    archiveName: "3-согласие.docx",
  },
];

const SCAN_ACCEPT = "application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png";

/** Пакет от РО по чек-листу Оргкомитета: четыре скана и фото собрания. */
export const UPLOAD_SLOTS = [
  {
    slot: "protocolScan",
    short: "Протокол",
    label: "Подписанный протокол собрания РО",
    accept: SCAN_ACCEPT,
    archiveName: "1-протокол-подписанный",
  },
  {
    slot: "attendanceScan",
    short: "Явочный лист",
    label: "Подписанный список присутствовавших",
    accept: SCAN_ACCEPT,
    archiveName: "2-явочный-лист-подписанный",
  },
  {
    slot: "consentScan",
    short: "Согласие",
    label: "Подписанное согласие делегата",
    accept: SCAN_ACCEPT,
    archiveName: "3-согласие-подписанное",
  },
  {
    slot: "passportScan",
    short: "Паспорт",
    label: "Копия паспорта делегата (главная страница + регистрация)",
    accept: SCAN_ACCEPT,
    archiveName: "4-паспорт-делегата",
  },
  {
    slot: "photo",
    short: "Фото",
    label: "Фото с собрания регионального отделения",
    accept: "image/*",
    archiveName: "5-фото-собрания",
  },
];

/** Кукис с id последней заявки: только подсказка «продолжить», не авторизация. */
export const SUBMISSION_COOKIE = "conferencia_submission";

/** Сколько заявок допустимо от одного субъекта РФ: запас на исправление ошибок. */
export const MAX_SUBMISSIONS_PER_REGION = 3;

export const STATUS_DRAFT = "draft";
export const STATUS_DOCX_GENERATED = "docx_generated";
export const STATUS_IN_PROGRESS = "in_progress";
export const STATUS_COMPLETE = "signed_uploaded";

export const STATUS_LABELS = {
  [STATUS_DRAFT]: "Собрание идёт",
  [STATUS_DOCX_GENERATED]: "Бланки сформированы",
  [STATUS_IN_PROGRESS]: "Сканы загружаются",
  [STATUS_COMPLETE]: "Пакет собран",
};

/**
 * Шаги собрания. Готовность шага видна по появившемуся документу, отдельного
 * поля состояния не нужно: документ есть — значит данные приняты.
 */
export const STEPS = [
  {
    key: "registration",
    title: "Регистрация",
    document: "attendanceDocx",
    scan: "attendanceScan",
  },
  { key: "delegate", title: "Делегат", document: "consentDocx", scan: "consentScan" },
  { key: "votes", title: "Голосование", document: "protocolDocx", scan: "protocolScan" },
];

export function stepDone(files = {}, key) {
  const step = STEPS.find((item) => item.key === key);
  return Boolean(step && files[step.document]);
}

/** Сколько сканов из пяти уже загружено и каких не хватает. */
export function uploadProgress(files = {}) {
  const uploaded = UPLOAD_SLOTS.filter((item) => files[item.slot]);
  const missing = UPLOAD_SLOTS.filter((item) => !files[item.slot]);

  return {
    done: uploaded.length,
    total: UPLOAD_SLOTS.length,
    missing,
    isComplete: missing.length === 0,
  };
}

export function statusFor(files = {}) {
  const { done, isComplete } = uploadProgress(files);

  if (isComplete) return STATUS_COMPLETE;
  if (done > 0) return STATUS_IN_PROGRESS;

  // Протокол появляется последним: пока его нет, собрание ещё идёт.
  return files.protocolDocx ? STATUS_DOCX_GENERATED : STATUS_DRAFT;
}
