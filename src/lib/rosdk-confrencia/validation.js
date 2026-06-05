const requiredFields = [
  "region",
  "city",
  "meetingDate",
  "protocolNumber",
  "presentMembers",
  "totalMembers",
  "votesFor",
  "delegateName",
  "delegatePhone",
  "passportData",
  "chairName",
  "secretaryName",
];

function validateFioServer(value) {
  const trimmed = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "Заполните поле.";
  const parts = trimmed.split(" ");
  if (parts.length !== 3) {
    return "должно состоять ровно из 3 слов (Фамилия Имя Отчество).";
  }
  const nameRegex = /^[а-яё\-]+$/i;
  for (const part of parts) {
    if (!nameRegex.test(part)) {
      return "должно содержать только русские буквы.";
    }
  }
  return null;
}

export function parseSubmissionInput(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Некорректные данные формы.");
  }

  const data = value;
  const input = {
    region: text(data.region),
    city: text(data.city),
    meetingDate: text(data.meetingDate),
    protocolNumber: "1",
    presentMembers: numberValue(data.presentMembers),
    totalMembers: numberValue(data.totalMembers),
    votesFor: numberValue(data.votesFor),
    delegateName: text(data.delegateName),
    delegatePhone: text(data.delegatePhone),
    passportData: passportData(data),
    chairName: text(data.chairName),
    secretaryName: text(data.secretaryName),
  };

  for (const field of requiredFields) {
    if (input[field] === "" || Number.isNaN(input[field])) {
      throw new Error("Заполните все обязательные поля.");
    }
  }

  // 1. Quorum
  const requiredQuorum = Math.ceil((input.totalMembers * 2) / 3);
  if (input.presentMembers < requiredQuorum) {
    throw new Error(`Собрание нелегитимно. Должно присутствовать не менее 2/3 членов (минимум ${requiredQuorum}).`);
  }

  if (input.presentMembers > input.totalMembers) {
    throw new Error("Присутствующих не может быть больше общего числа членов.");
  }

  if (input.votesFor > input.presentMembers) {
    throw new Error("Голосов за не может быть больше числа присутствующих.");
  }

  // 2. Votes For
  const minimumVotes = Math.ceil((input.presentMembers * 2) / 3);
  if (input.votesFor < minimumVotes) {
    throw new Error(`Голосов за должно быть не меньше 2/3 от присутствующих: минимум ${minimumVotes}.`);
  }

  // 3. FIO check
  const fioFields = ["delegateName", "chairName", "secretaryName"];
  const fioLabels = {
    delegateName: "ФИО делегата",
    chairName: "Председатель собрания",
    secretaryName: "Секретарь собрания"
  };

  for (const field of fioFields) {
    const error = validateFioServer(input[field]);
    if (error) {
      throw new Error(`Ошибка в поле "${fioLabels[field]}": ${error}`);
    }
  }

  // 4. Date check
  const meetingDateParsed = new Date(`${input.meetingDate}T00:00:00`);
  const todayDate = new Date();
  todayDate.setHours(23, 59, 59, 999);
  if (meetingDateParsed > todayDate) {
    throw new Error("Дата проведения собрания не может быть в будущем.");
  }

  // 5. Phone check
  const phoneDigits = input.delegatePhone.replace(/\D/g, "");
  if (phoneDigits.length !== 11) {
    throw new Error("Некорректный номер телефона делегата (должно быть 11 цифр).");
  }

  return input;
}

function passportData(data) {
  const legacy = text(data.passportData);
  if (legacy) {
    return legacy;
  }

  const series = text(data.passportSeries);
  const number = text(data.passportNumber);
  const issuedBy = text(data.passportIssuedBy);
  const issuedDate = text(data.passportIssuedDate);
  const departmentCode = text(data.passportDepartmentCode);

  if (!series || !number || !issuedBy || !issuedDate || !departmentCode) {
    return "";
  }

  return [
    `серия ${series}`,
    `номер ${number}`,
    `выдан ${issuedBy}`,
    `дата выдачи ${formatDate(issuedDate)}`,
    `код подразделения ${departmentCode}`,
  ].join(", ");
}

function formatDate(value) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU").format(parsed);
}

function text(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}
