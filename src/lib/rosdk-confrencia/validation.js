import { formatShortDate } from "./format.js";
import { regions } from "./regions.js";

const FIO_REGEX = /^[а-яё\-]+$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zа-яё]{2,}$/i;

function validateFioServer(value) {
  const trimmed = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!trimmed) return "Заполните поле.";
  const parts = trimmed.split(" ");
  // Два слова тоже норма: отчества нет у изрядной части граждан, и требование
  // ровно трёх слов не пускало таких людей ни в делегаты, ни в явочный лист.
  if (parts.length < 2 || parts.length > 3) {
    return "должно состоять из 2 или 3 слов (Фамилия Имя Отчество).";
  }
  for (const part of parts) {
    if (!FIO_REGEX.test(part)) {
      return "должно содержать только русские буквы.";
    }
  }
  return null;
}

/** Кворум: собрание правомочно, если присутствует более половины членов, стоящих на учёте. */
export function requiredQuorum(totalMembers) {
  return Math.floor(totalMembers / 2) + 1;
}

/** Решение по делегату принимается не менее чем 2/3 голосов присутствующих. */
export function requiredVotesFor(presentMembers) {
  return Math.ceil((presentMembers * 2) / 3);
}

/**
 * Голоса считались от прежней явки: в явочный лист дописали опоздавших уже после
 * голосования. Протокол с такими числами недействителен — в нём «присутствовали 8»
 * и «за 5, против 1», а порог 2/3 посчитан от шести.
 */
export function votesAreStale(submission, presentMembers) {
  const total =
    (submission.votesFor ?? 0) + (submission.votesAgainst ?? 0) + (submission.votesAbstain ?? 0);

  return total > 0 && total !== presentMembers;
}

/** Серия — 4 цифры, номер — 6. Формат проверяется на сервере, чтобы его нельзя было обойти. */
export const PASSPORT_SERIES_LENGTH = 4;
export const PASSPORT_NUMBER_LENGTH = 6;

export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/** Ф.И.О. для сравнения: регистр, ё и лишние пробелы не должны разводить людей. */
export function normalizeFio(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/ё/gi, "е")
    .toLowerCase();
}

/**
 * Телефон участника — обязателен: по нему Мандатная комиссия сверяет явочный лист.
 */
export function phoneError(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "укажите телефон.";

  return digitsOnly(raw).length === 11 ? null : "телефон — 11 цифр.";
}

/** E-mail участника — по желанию, но если введён, то должен быть настоящим. */
export function emailError(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  return EMAIL_REGEX.test(raw) ? null : "некорректный e-mail.";
}

/** Совместимость: старые заявки хранят один контакт строкой. */
export function contactError(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "укажите телефон или e-mail.";
  if (raw.includes("@")) return EMAIL_REGEX.test(raw) ? null : "некорректный e-mail.";
  return digitsOnly(raw).length === 11 ? null : "телефон — 11 цифр, либо укажите e-mail.";
}

/** «45 10 № 123456» — вид, в котором реквизиты печатаются в явочном листе. */
export function formatPassportRef(series, number) {
  const cleanSeries = digitsOnly(series);
  const cleanNumber = digitsOnly(number);

  return `Паспорт: ${cleanSeries.slice(0, 2)} ${cleanSeries.slice(2)} № ${cleanNumber}`;
}

function parseAttendees(value) {
  const list = Array.isArray(value) ? value : [];

  return list
    .map((item) => ({
      fullName: text(item?.fullName).replace(/\s+/g, " "),
      passportSeries: digitsOnly(item?.passportSeries),
      passportNumber: digitsOnly(item?.passportNumber),
      // Заявки, созданные до разделения полей, приходят готовой строкой.
      documentRef: text(item?.documentRef),
      phone: text(item?.phone),
      email: text(item?.email),
      contact: text(item?.contact),
    }))
    .filter(
      (item) =>
        item.fullName ||
        item.passportSeries ||
        item.passportNumber ||
        item.documentRef ||
        item.phone ||
        item.email ||
        item.contact
    );
}

/** Адрес регистрации собирается из отдельных полей: так его нельзя ввести одной строкой мусора. */
function delegateAddress(data) {
  const legacy = text(data.delegateAddress);
  if (legacy) {
    return legacy;
  }

  const postalCode = digitsOnly(data.addressPostalCode);
  const addressRegion = text(data.addressRegion);
  const settlement = text(data.addressSettlement);
  const street = text(data.addressStreet);
  const house = text(data.addressHouse);

  if (!postalCode || !addressRegion || !settlement || !street || !house) {
    return "";
  }

  if (postalCode.length !== 6) {
    throw new Error("Почтовый индекс в адресе регистрации должен состоять из 6 цифр.");
  }

  const parts = [
    postalCode,
    addressRegion,
    text(data.addressDistrict),
    settlement,
    `ул. ${street}`,
    `д. ${house}`,
    text(data.addressBuilding) && `корп. ${text(data.addressBuilding)}`,
    text(data.addressFlat) && `кв. ${text(data.addressFlat)}`,
  ];

  return parts.filter(Boolean).join(", ");
}

/** Минимум участников на собрании — общее требование Оргкомитета. */
export const MIN_PRESENT_MEMBERS = 5;

/** Шаг 1: собрание и явочный лист. Из него собирается список присутствовавших. */
export function parseRegistrationInput(value) {
  const data = requireObject(value);
  const attendees = parseAttendees(data.attendees);

  const input = {
    region: text(data.region),
    city: text(data.city),
    meetingDate: text(data.meetingDate),
    protocolNumber: text(data.protocolNumber),
    presentMembers: attendees.length,
    // Списочного состава у отделений нет — в протоколе печатается только явка.
    totalMembers: attendees.length,
    chairName: text(data.chairName),
    secretaryName: text(data.secretaryName),
    attendees,
  };

  for (const field of ["region", "city", "meetingDate", "chairName", "secretaryName"]) {
    if (!input[field]) {
      throw new Error("Заполните все обязательные поля блока «Регистрация».");
    }
  }

  // Субъект РФ — только из справочника, иначе реестр по регионам не собрать.
  if (!regions.includes(input.region)) {
    throw new Error("Выберите субъект Российской Федерации из списка.");
  }

  checkAttendees(attendees);

  if (input.presentMembers < MIN_PRESENT_MEMBERS) {
    throw new Error(
      `На собрании должно присутствовать не меньше ${MIN_PRESENT_MEMBERS} участников, в явочном листе ${input.presentMembers}.`
    );
  }

  for (const [field, label] of [
    ["chairName", "Председатель собрания"],
    ["secretaryName", "Секретарь собрания"],
  ]) {
    const error = validateFioServer(input[field]);
    if (error) {
      throw new Error(`Ошибка в поле "${label}": ${error}`);
    }
  }

  checkMeetingDate(input.meetingDate);

  return input;
}

/** Шаг 2: делегат. Из него собирается согласие на обработку данных. */
export function parseDelegateInput(value) {
  const data = requireObject(value);

  const input = {
    delegateName: text(data.delegateName),
    delegatePhone: text(data.delegatePhone),
    delegateEmail: text(data.delegateEmail),
    delegateAddress: delegateAddress(data),
    passportData: passportData(data),
  };

  for (const field of Object.keys(input)) {
    if (!input[field]) {
      throw new Error("Заполните все обязательные поля блока «Делегат».");
    }
  }

  const fioError = validateFioServer(input.delegateName);
  if (fioError) {
    throw new Error(`Ошибка в поле "ФИО делегата": ${fioError}`);
  }

  if (digitsOnly(input.delegatePhone).length !== 11) {
    throw new Error("Некорректный номер телефона делегата (должно быть 11 цифр).");
  }

  if (!EMAIL_REGEX.test(input.delegateEmail)) {
    throw new Error("Некорректный e-mail делегата.");
  }

  // Паспорт и адрес уходят в бланки одной строкой. Отдельно храним и разобранные
  // поля: без них форма не заполнится обратно, когда блок открывают на правку.
  input.delegateFields = Object.fromEntries(
    DELEGATE_RAW_FIELDS.map((field) => [field, text(data[field])])
  );

  return input;
}

/** Поля формы делегата как есть: из них собраны passportData и delegateAddress. */
const DELEGATE_RAW_FIELDS = [
  "passportSeries",
  "passportNumber",
  "passportIssuedDate",
  "passportIssuedBy",
  "passportDepartmentCode",
  "addressPostalCode",
  "addressRegion",
  "addressDistrict",
  "addressSettlement",
  "addressStreet",
  "addressHouse",
  "addressBuilding",
  "addressFlat",
];

/** Шаг 3: голосование. Из него собирается протокол. */
export function parseVotesInput(value, presentMembers) {
  const data = requireObject(value);

  const input = {
    votesFor: numberValue(data.votesFor),
    votesAgainst: numberValue(data.votesAgainst),
    votesAbstain: numberValue(data.votesAbstain),
  };

  if (Object.values(input).some((count) => Number.isNaN(count))) {
    throw new Error("Укажите результаты голосования: «За», «Против», «Воздержались».");
  }

  const votesTotal = input.votesFor + input.votesAgainst + input.votesAbstain;
  if (votesTotal !== presentMembers) {
    throw new Error(
      `Сумма голосов («За» + «Против» + «Воздержались») должна равняться числу присутствующих (${presentMembers}), получено ${votesTotal}.`
    );
  }

  const minimumVotes = requiredVotesFor(presentMembers);
  if (input.votesFor < minimumVotes) {
    throw new Error(
      `Делегат не избран: «За» должно быть не менее 2/3 от присутствующих (минимум ${minimumVotes}).`
    );
  }

  return input;
}

/** Полный комплект одним куском — обратная совместимость и самопроверка. */
export function parseSubmissionInput(value) {
  const registration = parseRegistrationInput(value);

  return {
    ...registration,
    ...parseDelegateInput(value),
    ...parseVotesInput(value, registration.presentMembers),
  };
}

function requireObject(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Некорректные данные формы.");
  }
  return value;
}

/**
 * Сутки допуска сверх сегодняшнего дня сервера: собрание в Петропавловске
 * (UTC+12) идёт, когда сервер в UTC ещё во вчера, — и без запаса отклонялись
 * заявки именно дальневосточных отделений, уже после заполнения явочного листа.
 */
export const MEETING_DATE_SLACK_DAYS = 1;

function checkMeetingDate(meetingDate) {
  const parsed = new Date(`${meetingDate}T00:00:00`);
  const latest = new Date();
  latest.setHours(23, 59, 59, 999);
  latest.setDate(latest.getDate() + MEETING_DATE_SLACK_DAYS);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Некорректная дата проведения собрания.");
  }
  if (parsed > latest) {
    throw new Error("Дата проведения собрания не может быть в будущем.");
  }
}

function checkAttendees(attendees) {
  if (attendees.length === 0) {
    throw new Error("Добавьте в явочный лист хотя бы одного присутствующего члена отделения.");
  }

  const seenNames = new Map();
  const seenPassports = new Map();

  attendees.forEach((attendee, index) => {
    const fioError = validateFioServer(attendee.fullName);
    if (fioError) {
      throw new Error(`Явочный лист, строка ${index + 1}: Ф.И.О. ${fioError}`);
    }

    // Одного человека нельзя посчитать дважды: от числа присутствующих
    // зависят и кворум, и порог в 2/3 голосов.
    const nameKey = normalizeFio(attendee.fullName);
    if (seenNames.has(nameKey)) {
      throw new Error(
        `Явочный лист: «${attendee.fullName}» встречается дважды — строки ${seenNames.get(nameKey) + 1} и ${index + 1}.`
      );
    }
    seenNames.set(nameKey, index);

    const passportKey = `${attendee.passportSeries}${attendee.passportNumber}`;
    if (passportKey.length > 0 && seenPassports.has(passportKey)) {
      throw new Error(
        `Явочный лист: один и тот же паспорт в строках ${seenPassports.get(passportKey) + 1} и ${index + 1}.`
      );
    }
    if (passportKey) {
      seenPassports.set(passportKey, index);
    }

    if (attendee.passportSeries || attendee.passportNumber || !attendee.documentRef) {
      if (attendee.passportSeries.length !== PASSPORT_SERIES_LENGTH) {
        throw new Error(
          `Явочный лист, строка ${index + 1}: серия паспорта — ${PASSPORT_SERIES_LENGTH} цифры.`
        );
      }
      if (attendee.passportNumber.length !== PASSPORT_NUMBER_LENGTH) {
        throw new Error(
          `Явочный лист, строка ${index + 1}: номер паспорта — ${PASSPORT_NUMBER_LENGTH} цифр.`
        );
      }
      attendee.documentRef = formatPassportRef(attendee.passportSeries, attendee.passportNumber);
    }

    // Старые заявки хранят один контакт строкой, новые — телефон и почту отдельно.
    if (attendee.phone || attendee.email || !attendee.contact) {
      const phoneProblem = phoneError(attendee.phone);
      if (phoneProblem) {
        throw new Error(`Явочный лист, строка ${index + 1}: ${phoneProblem}`);
      }

      const emailProblem = emailError(attendee.email);
      if (emailProblem) {
        throw new Error(`Явочный лист, строка ${index + 1}: ${emailProblem}`);
      }

      attendee.contact = [attendee.phone, attendee.email].filter(Boolean).join(", ");
    } else {
      const contactProblem = contactError(attendee.contact);
      if (contactProblem) {
        throw new Error(`Явочный лист, строка ${index + 1}: ${contactProblem}`);
      }
    }
  });
}

function passportData(data) {
  const legacy = text(data.passportData);
  if (legacy) {
    return legacy;
  }

  const series = digitsOnly(data.passportSeries);
  const number = digitsOnly(data.passportNumber);
  const issuedBy = text(data.passportIssuedBy);
  const issuedDate = text(data.passportIssuedDate);
  const departmentCode = text(data.passportDepartmentCode);

  if (!series || !number || !issuedBy || !issuedDate || !departmentCode) {
    return "";
  }

  if (series.length !== PASSPORT_SERIES_LENGTH) {
    throw new Error(`Серия паспорта делегата — ${PASSPORT_SERIES_LENGTH} цифры.`);
  }
  if (number.length !== PASSPORT_NUMBER_LENGTH) {
    throw new Error(`Номер паспорта делегата — ${PASSPORT_NUMBER_LENGTH} цифр.`);
  }
  if (digitsOnly(departmentCode).length !== 6) {
    throw new Error("Код подразделения — 6 цифр.");
  }

  return [
    `серия ${series}`,
    `номер ${number}`,
    `выдан ${issuedBy}`,
    `дата выдачи ${formatShortDate(issuedDate)}`,
    `код подразделения ${departmentCode}`,
  ].join(", ");
}

function text(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}
