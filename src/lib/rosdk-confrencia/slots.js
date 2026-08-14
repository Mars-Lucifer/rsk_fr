// Описание файлов заявки. Модуль без серверных зависимостей — импортируется и формой,
// и API, поэтому здесь не должно появляться fs / better-sqlite3.

/** Дата Конференции. Правится здесь — попадает и в бланки, и в текст страницы. */
export const CONFERENCE_DATE = "21 сентября 2026 года";

/** До этого дня Оргкомитет ждёт пакет: позже отделение остаётся без делегата. */
export const DEADLINE_DATE = "13 сентября 2026 года";

/**
 * Каналы Оргкомитета в MAX. Пустая строка означает «QR не рисуем, показываем
 * заглушку»: неверная ссылка в коде хуже её отсутствия.
 */
export const MAX_LINKS = {
  channel: "https://max.ru/join/qY8xxk4mk5bYtqJ4Lj4Znm1_mY5HA8WvohMMuU1_6jw",
  chat: "https://max.ru/join/gCtbHvkvHXUfc48wPUEIShNIvuWkUE_S0n4CH9maaAs",
  delegates: "https://max.ru/join/zZDlrAXKtBloocaWy_HBkCSYDSx2FgAkJpVzYjr-Ow8",
};

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

// Скан приходит с чего угодно: телефон даёт JPG, МФУ — PDF, кто-то шлёт архив.
// Отказывать из-за формата дороже, чем принять и разобрать руками.
const SCAN_ACCEPT =
  "application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/heic,.heic,.zip,.rar,.7z";

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
    short: "Паспорт: разворот",
    label: "Паспорт делегата: страницы 2–3 — разворот с фотографией",
    hint: "Фамилия, имя, отчество, дата и место рождения, кем и когда выдан, код подразделения.",
    accept: SCAN_ACCEPT,
    archiveName: "4-паспорт-делегата-разворот",
  },
  {
    slot: "passportRegistrationScan",
    short: "Паспорт: прописка",
    label: "Паспорт делегата: страница с регистрацией (страницы 5–12)",
    hint: "Разворот со штампом «Зарегистрирован»: адрес и дата регистрации должны читаться.",
    accept: SCAN_ACCEPT,
    archiveName: "5-паспорт-делегата-регистрация",
  },
  {
    slot: "photo",
    short: "Фото",
    label: "Фото с собрания регионального отделения",
    hint: "Общий план: видно всех участников, их можно пересчитать по явочному листу.",
    accept: "image/*,.zip,.rar,.7z",
    archiveName: "6-фото-собрания",
  },
];

/**
 * Сканы паспорта живут в блоке «Делегат», рядом с его данными: их снимают с того
 * же человека и в тот же момент. В последнем блоке остаётся только общее фото.
 */
export const DELEGATE_SCAN_SLOTS = ["passportScan", "passportRegistrationScan"];

/**
 * Номер протокола отделение не придумывает: он собирается из кода субъекта в
 * справочнике и порядкового номера заявки этого субъекта — «17/1», «17/2».
 * Так номера не повторяются между отделениями и не зависят от чужих заявок.
 */
export function buildProtocolNumber(regionIndex, alreadySent) {
  return `${regionIndex + 1}/${alreadySent + 1}`;
}

/** Кукис с id последней заявки: только подсказка «продолжить», не авторизация. */
export const SUBMISSION_COOKIE = "conferencia_submission";

/**
 * Одно отделение — одна заявка. Запас на «переделать» не нужен: заявка правится
 * на месте, а несколько заявок от субъекта Мандатной комиссии не с чем сверять.
 */
export const MAX_SUBMISSIONS_PER_REGION = 1;

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
