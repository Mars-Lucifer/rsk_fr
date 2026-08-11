import { formatShortDate } from "./format.js";
import { regions } from "./regions.js";

const requiredFields = [
  "region",
  "city",
  "meetingDate",
  "protocolNumber",
  "totalMembers",
  "votesFor",
  "delegateName",
  "delegatePhone",
  "delegateEmail",
  "delegateAddress",
  "passportData",
  "chairName",
  "secretaryName",
];

const FIO_REGEX = /^[а-яё\-]+$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zа-яё]{2,}$/i;

function validateFioServer(value) {
  const trimmed = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "Заполните поле.";
  const parts = trimmed.split(" ");
  if (parts.length !== 3) {
    return "должно состоять ровно из 3 слов (Фамилия Имя Отчество).";
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

/** Серия — 4 цифры, номер — 6. Формат проверяется на сервере, чтобы его нельзя было обойти. */
export const PASSPORT_SERIES_LENGTH = 4;
export const PASSPORT_NUMBER_LENGTH = 6;

export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
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
      contact: text(item?.contact),
    }))
    .filter(
      (item) =>
        item.fullName ||
        item.passportSeries ||
        item.passportNumber ||
        item.documentRef ||
        item.contact,
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

export function parseSubmissionInput(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Некорректные данные формы.");
  }

  const data = value;
  const attendees = parseAttendees(data.attendees);
  const input = {
    region: text(data.region),
    city: text(data.city),
    meetingDate: text(data.meetingDate),
    protocolNumber: text(data.protocolNumber) || "1",
    presentMembers: attendees.length,
    totalMembers: numberValue(data.totalMembers),
    votesFor: numberValue(data.votesFor),
    votesAgainst: numberValue(data.votesAgainst),
    votesAbstain: numberValue(data.votesAbstain),
    delegateName: text(data.delegateName),
    delegatePhone: text(data.delegatePhone),
    delegateEmail: text(data.delegateEmail),
    delegateAddress: delegateAddress(data),
    passportData: passportData(data),
    chairName: text(data.chairName),
    secretaryName: text(data.secretaryName),
    attendees,
  };

  for (const field of requiredFields) {
    if (input[field] === "" || Number.isNaN(input[field])) {
      throw new Error("Заполните все обязательные поля.");
    }
  }

  if (Number.isNaN(input.votesAgainst) || Number.isNaN(input.votesAbstain)) {
    throw new Error("Укажите результаты голосования: «За», «Против», «Воздержались».");
  }

  // 1. Субъект РФ — только из справочника, иначе реестр по регионам не собрать
  if (!regions.includes(input.region)) {
    throw new Error("Выберите субъект Российской Федерации из списка.");
  }

  // 2. Явочный лист
  if (attendees.length === 0) {
    throw new Error("Добавьте в явочный лист хотя бы одного присутствующего члена отделения.");
  }

  attendees.forEach((attendee, index) => {
    const fioError = validateFioServer(attendee.fullName);
    if (fioError) {
      throw new Error(`Явочный лист, строка ${index + 1}: Ф.И.О. ${fioError}`);
    }

    if (attendee.passportSeries || attendee.passportNumber || !attendee.documentRef) {
      if (attendee.passportSeries.length !== PASSPORT_SERIES_LENGTH) {
        throw new Error(
          `Явочный лист, строка ${index + 1}: серия паспорта — ${PASSPORT_SERIES_LENGTH} цифры.`,
        );
      }
      if (attendee.passportNumber.length !== PASSPORT_NUMBER_LENGTH) {
        throw new Error(
          `Явочный лист, строка ${index + 1}: номер паспорта — ${PASSPORT_NUMBER_LENGTH} цифр.`,
        );
      }
      attendee.documentRef = formatPassportRef(attendee.passportSeries, attendee.passportNumber);
    }

    if (!attendee.contact) {
      throw new Error(`Явочный лист, строка ${index + 1}: укажите телефон или e-mail.`);
    }
  });

  // 3. Кворум — более половины членов, состоящих на учёте
  if (input.presentMembers > input.totalMembers) {
    throw new Error(
      "В явочном листе больше человек, чем всего членов, состоящих на учёте в отделении.",
    );
  }

  const quorum = requiredQuorum(input.totalMembers);
  if (input.presentMembers < quorum) {
    throw new Error(
      `Собрание неправомочно: кворум — более половины членов отделения (минимум ${quorum}).`,
    );
  }

  // 4. Голосование по делегату — не менее 2/3 голосов присутствующих
  const votesTotal = input.votesFor + input.votesAgainst + input.votesAbstain;
  if (votesTotal !== input.presentMembers) {
    throw new Error(
      `Сумма голосов («За» + «Против» + «Воздержались») должна равняться числу присутствующих (${input.presentMembers}), получено ${votesTotal}.`,
    );
  }

  const minimumVotes = requiredVotesFor(input.presentMembers);
  if (input.votesFor < minimumVotes) {
    throw new Error(
      `Делегат не избран: «За» должно быть не менее 2/3 от присутствующих (минимум ${minimumVotes}).`,
    );
  }

  // 5. Ф.И.О. президиума и делегата
  const fioLabels = {
    delegateName: "ФИО делегата",
    chairName: "Председатель собрания",
    secretaryName: "Секретарь собрания",
  };

  for (const [field, label] of Object.entries(fioLabels)) {
    const error = validateFioServer(input[field]);
    if (error) {
      throw new Error(`Ошибка в поле "${label}": ${error}`);
    }
  }

  // 6. Дата собрания
  const meetingDateParsed = new Date(`${input.meetingDate}T00:00:00`);
  const todayDate = new Date();
  todayDate.setHours(23, 59, 59, 999);
  if (Number.isNaN(meetingDateParsed.getTime())) {
    throw new Error("Некорректная дата проведения собрания.");
  }
  if (meetingDateParsed > todayDate) {
    throw new Error("Дата проведения собрания не может быть в будущем.");
  }

  // 7. Контакты делегата
  const phoneDigits = input.delegatePhone.replace(/\D/g, "");
  if (phoneDigits.length !== 11) {
    throw new Error("Некорректный номер телефона делегата (должно быть 11 цифр).");
  }

  if (!EMAIL_REGEX.test(input.delegateEmail)) {
    throw new Error("Некорректный e-mail делегата.");
  }

  return input;
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
