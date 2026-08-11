// Проверка комплекта документов РО: `node scripts/check-conferencia-package.mjs`.
//
// Ловит три вещи, которые ломаются молча: пороги кворума и голосов расходятся
// с чек-листом Оргкомитета, явочный лист принимает мусорные строки, либо
// генерация DOCX падает/теряет подставленные данные.

import assert from "node:assert";
import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import { Packer } from "docx";
import {
  sendArchiveResponse,
  sendGeneratedPackageResponse,
} from "../src/lib/rosdk-confrencia/files.js";
import {
  CONFERENCE_DATE,
  STATUS_COMPLETE,
  STATUS_DRAFT,
  STATUS_DOCX_GENERATED,
  STATUS_IN_PROGRESS,
  statusFor,
  uploadProgress,
} from "../src/lib/rosdk-confrencia/slots.js";
import { toPublicSubmission } from "../src/lib/rosdk-confrencia/storage.js";
import { checkRateLimit } from "../src/lib/rosdk-confrencia/rateLimit.js";
import {
  createSessionToken,
  isAdminConfigured,
  isPasswordValid,
  isSessionTokenValid,
} from "../src/lib/rosdk-confrencia/admin.js";
import {
  parseDelegateInput,
  parseRegistrationInput,
  parseSubmissionInput,
  parseVotesInput,
  requiredQuorum,
  requiredVotesFor,
} from "../src/lib/rosdk-confrencia/validation.js";
import { regionInPrepositional } from "../src/lib/rosdk-confrencia/format.js";
import { regions } from "../src/lib/rosdk-confrencia/regions.js";
import {
  buildAttendanceDocument,
  buildConsentDocument,
  buildProtocolDocument,
  buildRegistryDocument,
  buildTemplateSample,
  readyDocuments,
} from "../src/lib/rosdk-confrencia/documents.js";
import { renderTemplate, saveTemplate } from "../src/lib/rosdk-confrencia/templates.js";

const SURNAMES = [
  "Иванов",
  "Петров",
  "Сидоров",
  "Кузнецов",
  "Смирнов",
  "Волков",
  "Зайцев",
  "Морозов",
  "Соколов",
];

function attendees(count) {
  return Array.from({ length: count }, (_, index) => ({
    fullName: `${SURNAMES[index % SURNAMES.length]} Иван Иванович`,
    passportSeries: "4510",
    passportNumber: `12345${index}`,
    contact: `+7 (999) 000-00-0${index}`,
  }));
}

/** Форма присылает адрес по частям — строка для документов собирается на сервере. */
const addressParts = {
  addressPostalCode: "180000",
  addressRegion: "Псковская область",
  addressDistrict: "Печорский район",
  addressSettlement: "г. Псков",
  addressStreet: "Советская",
  addressHouse: "5",
  addressBuilding: "2",
  addressFlat: "12",
};

function payload(overrides = {}) {
  return {
    region: "Республика Калмыкия",
    city: "Элиста",
    meetingDate: "2026-08-01",
    protocolNumber: "7",
    totalMembers: 9,
    votesFor: 5,
    votesAgainst: 1,
    votesAbstain: 0,
    delegateName: "Лебедев Андрей Александрович",
    delegatePhone: "+7 (999) 111-22-33",
    delegateEmail: "delegate@example.ru",
    delegateAddress: "г. Элиста, ул. Ленина, д. 1, кв. 2",
    passportSeries: "4510",
    passportNumber: "123456",
    passportIssuedBy: "ОВД г. Элиста",
    passportIssuedDate: "2015-06-10",
    passportDepartmentCode: "081-001",
    chairName: "Петров Петр Петрович",
    secretaryName: "Сидорова Анна Сергеевна",
    attendees: attendees(6),
    ...overrides,
  };
}

// --- Пороги ровно те, что в чек-листе: кворум «более 50%», решение «не менее 2/3».
assert.equal(requiredQuorum(9), 5, "из 9 членов кворум — 5 человек");
assert.equal(requiredQuorum(10), 6, "ровно половина кворума не даёт");
assert.equal(requiredVotesFor(6), 4);
assert.equal(requiredVotesFor(9), 6);

// --- Валидный комплект проходит, presentMembers берётся из явочного листа.
const input = parseSubmissionInput(payload());
assert.equal(input.presentMembers, 6, "число присутствующих = длина явочного листа");
assert.equal(input.attendees.length, 6);
assert.match(input.passportData, /серия 4510, номер 123456/);
assert.match(input.passportData, /дата выдачи 10\.06\.2015/);

function rejects(overrides, pattern, message) {
  assert.throws(() => parseSubmissionInput(payload(overrides)), pattern, message);
}

// --- Минимум пять человек на собрании, сколько бы ни было на учёте.
rejects(
  { attendees: attendees(4), votesFor: 4, votesAgainst: 0 },
  /не меньше 5 членов/i,
  "четверо — меньше требуемого минимума",
);

// --- Кворум поверх минимума: 6 присутствующих из 20 на учёте — меньше половины.
rejects(
  { attendees: attendees(6), totalMembers: 20, votesFor: 6, votesAgainst: 0 },
  /кворум/i,
  "6 из 20 не кворум",
);

// --- Явочный лист не может быть длиннее списка членов отделения.
rejects({ totalMembers: 5 }, /больше человек, чем всего членов/i);

// --- Сумма голосов должна сходиться с числом присутствующих.
rejects({ votesFor: 6, votesAgainst: 3, votesAbstain: 0 }, /Сумма голосов/i);

// --- Меньше 2/3 «За» — делегат не избран (4 за, 2 против из 6 присутствующих).
rejects({ votesFor: 3, votesAgainst: 3, votesAbstain: 0 }, /не менее 2\/3/i);

// --- Пустой явочный лист.
rejects({ attendees: [] }, /явочный лист/i);

// --- Субъект в бланке стоит в предложном падеже: «Регионального отделения в ...».
assert.equal(regionInPrepositional("Псковская область"), "Псковской области");
assert.equal(regionInPrepositional("Краснодарский край"), "Краснодарском крае");
assert.equal(regionInPrepositional("Республика Калмыкия"), "Республике Калмыкия");
assert.equal(regionInPrepositional("Донецкая Народная Республика"), "Донецкой Народной Республике");
assert.equal(
  regionInPrepositional("Ямало-Ненецкий автономный округ"),
  "Ямало-Ненецком автономном округе",
);
assert.equal(
  regionInPrepositional("город федерального значения Москва"),
  "городе федерального значения Москва",
);

// Ни один субъект справочника не должен остаться в именительном падеже.
const notDeclined = regions.filter((region) => regionInPrepositional(region) === region);
assert.deepEqual(notDeclined, [], `не склоняются: ${notDeclined.join("; ")}`);

// --- Один человек дважды: иначе кворум и 2/3 считаются от завышенного числа.
const withDuplicate = attendees(6);
withDuplicate[4] = { ...withDuplicate[1], passportNumber: "999999" };
rejects({ attendees: withDuplicate }, /встречается дважды/i);

// --- Тот же паспорт под разными фамилиями тоже не проходит.
const withSamePassport = attendees(6);
withSamePassport[3] = { ...withSamePassport[3], passportNumber: withSamePassport[0].passportNumber };
rejects({ attendees: withSamePassport }, /один и тот же паспорт/i);

// --- Контакт участника: либо 11 цифр телефона, либо e-mail.
const badContact = attendees(6);
badContact[2] = { ...badContact[2], contact: "позвонить в колледж" };
rejects({ attendees: badContact }, /телефон — 11 цифр/i);

const shortPhone = attendees(6);
shortPhone[0] = { ...shortPhone[0], contact: "+7 999 12-34" };
rejects({ attendees: shortPhone }, /телефон — 11 цифр/i);

const emailContact = attendees(6);
emailContact[0] = { ...emailContact[0], contact: "member@college.ru" };
assert.equal(
  parseSubmissionInput(payload({ attendees: emailContact })).attendees[0].contact,
  "member@college.ru",
  "e-mail вместо телефона допустим",
);

// --- Реквизиты паспорта в явочном листе собираются на сервере из серии и номера.
assert.equal(
  input.attendees[0].documentRef,
  "Паспорт: 45 10 № 123450",
  "серия печатается парами цифр, как в бланке",
);

// --- Защита от дурака в явочном листе: короткая серия и короткий номер не проходят.
rejects(
  { attendees: [{ ...attendees(1)[0], passportSeries: "451" }] },
  /серия паспорта — 4 цифры/i,
);
rejects(
  { attendees: [{ ...attendees(1)[0], passportNumber: "12345" }] },
  /номер паспорта — 6 цифр/i,
);

// --- Паспорт делегата тоже проверяется на сервере, а не только маской в форме.
rejects({ passportSeries: "451" }, /Серия паспорта делегата/i);
rejects({ passportNumber: "1234567" }, /Номер паспорта делегата/i);
rejects({ passportDepartmentCode: "60-14" }, /Код подразделения/i);

// --- Адрес регистрации: части складываются в одну строку, индекс проверяется.
const byParts = parseSubmissionInput(
  payload({ delegateAddress: "", ...addressParts }),
);
assert.equal(
  byParts.delegateAddress,
  "180000, Псковская область, Печорский район, г. Псков, ул. Советская, д. 5, корп. 2, кв. 12",
);
assert.equal(
  parseSubmissionInput(
    payload({ delegateAddress: "", ...addressParts, addressBuilding: "", addressFlat: "" }),
  ).delegateAddress,
  "180000, Псковская область, Печорский район, г. Псков, ул. Советская, д. 5",
  "необязательные корпус и квартира не оставляют пустых запятых",
);
rejects(
  { delegateAddress: "", ...addressParts, addressPostalCode: "18000" },
  /индекс.*6 цифр/i,
);
rejects(
  { delegateAddress: "", ...addressParts, addressStreet: "" },
  /обязательные поля/i,
);

// --- Мусор в строке явочного листа.
rejects(
  { attendees: [...attendees(5), { fullName: "Иванов", documentRef: "", contact: "" }] },
  /строка 6/i,
);

// --- Контакты делегата.
rejects({ delegateEmail: "not-an-email" }, /e-mail/i);
rejects({ delegatePhone: "+7 (999) 111-22" }, /телефон/i);
rejects({ delegateAddress: "" }, /обязательные поля/i);

// --- Дата собрания в будущем.
const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
rejects({ meetingDate: future }, /в будущем/i);

// --- Генерация: три файла открываются как DOCX и содержат подставленные данные.
async function documentText(document) {
  const buffer = await Packer.toBuffer(document);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml").async("string");
  return xml.replace(/<[^>]+>/g, "");
}

const protocolText = await documentText(buildProtocolDocument(input));
assert.match(protocolText, /ПРОТОКОЛ № 7/);
// Субъект в шапке — в предложном падеже: «...отделения в Республике Калмыкия».
assert.match(protocolText, /в Республике Калмыкия/);
assert.match(protocolText, /«01» августа 2026 г\./);
assert.match(protocolText, /в количестве 6 человек из 9 членов/);
assert.match(protocolText, /Кворум имеется \(составляет 67%\)/);
assert.match(protocolText, /«За» — 5, «Против» — 1, «Воздержались» — 0/);
assert.match(protocolText, /Лебедев Андрей Александрович/);
assert.match(protocolText, /delegate@example\.ru/);
assert.match(protocolText, /ул\. Ленина, д\. 1, кв\. 2/);

const attendanceText = await documentText(buildAttendanceDocument(input));
assert.match(attendanceText, /Приложение № 1/);
assert.match(attendanceText, /к Протоколу Общего собрания № 7/);
assert.match(attendanceText, /Приняли личное участие в Общем собрании: 6 членов/);
assert.equal(
  (attendanceText.match(/Паспорт: 45 10 №/g) ?? []).length,
  6,
  "в явочном листе печатается строка на каждого присутствующего",
);

const consentText = await documentText(buildConsentDocument(input));
assert.match(consentText, /СОГЛАСИЕ/);
assert.match(consentText, /152-ФЗ/);
// Дата берётся из константы: перенос Конференции не должен ронять проверку.
assert.ok(
  consentText.includes(CONFERENCE_DATE),
  `в согласии нет даты Конференции (${CONFERENCE_DATE})`,
);
assert.match(consentText, /Лебедев Андрей Александрович/);
assert.match(consentText, /Делегат от: Регионального отделения в Республике Калмыкия/);

// --- Реестр делегатов: одна строка на отделение, повторные заявки схлопываются.
const registryInput = [
  { region: "Республика Калмыкия", delegateName: "Лебедев Андрей Александрович", protocolNumber: "7", meetingDate: "2026-08-01", delegateEmail: "a@example.ru", delegatePhone: "+7 (999) 111-22-33", files: { protocolDocx: "x" } },
  { region: "Республика Калмыкия", delegateName: "Петров Петр Петрович", protocolNumber: "8", meetingDate: "2026-08-02", delegateEmail: "b@example.ru", delegatePhone: "+7 (999) 222-33-44", files: { protocolDocx: "x", protocolScan: "y", photo: "z" } },
  { region: "город федерального значения Москва", delegateName: "Актуганов Антон Николаевич", protocolNumber: "2", meetingDate: "2026-08-10", delegateEmail: "c@example.ru", delegatePhone: "+7 (999) 333-44-55", files: {} },
];

const registryText = await documentText(buildRegistryDocument(registryInput));
assert.match(registryText, /РЕЕСТР ДЕЛЕГАТОВ И РЕГИСТРАЦИИ УЧАСТНИКОВ/);
assert.match(registryText, /Региональное отделение в г\. Москве/, "город федерального значения — «в г. Москве»");
assert.match(registryText, /Региональное отделение в Республике Калмыкия/);
assert.match(registryText, /Протокол № 8 от 02\.08\.2026/, "берётся самая полная заявка региона");
assert.ok(
  !registryText.includes("Лебедев Андрей Александрович"),
  "менее полная заявка того же региона в реестр не попадает",
);
assert.match(registryText, /Избрано делегатов: 2 человек от 2 региональных отделений/);
assert.match(registryText, /Видеокамера \+ Паспорт/);

// --- Шаги собрания разбираются по отдельности: регистрация не требует делегата.
const registration = parseRegistrationInput(payload({ delegateName: "", votesFor: undefined }));
assert.equal(registration.presentMembers, 6);
assert.equal(registration.delegateName, undefined, "регистрация не знает про делегата");

const delegate = parseDelegateInput(payload());
assert.match(delegate.passportData, /серия 4510/);
assert.match(delegate.delegateAddress, /Элиста/);

assert.deepEqual(parseVotesInput({ votesFor: 6, votesAgainst: 0, votesAbstain: 0 }, 6), {
  votesFor: 6,
  votesAgainst: 0,
  votesAbstain: 0,
});
assert.throws(
  () => parseVotesInput({ votesFor: 3, votesAgainst: 3, votesAbstain: 0 }, 6),
  /не менее 2\/3/i,
);
assert.throws(() => parseDelegateInput({ delegateName: "Иванов Иван Иванович" }), /Делегат/i);

// Документ появляется только тогда, когда для него есть данные.
assert.deepEqual(readyDocuments({ attendees: [{ fullName: "Иванов Иван Иванович" }] }), [
  "attendanceDocx",
]);
assert.deepEqual(
  readyDocuments({
    attendees: [{ fullName: "Иванов Иван Иванович" }],
    delegateName: "Лебедев Андрей Александрович",
    passportData: "серия 4510",
    votesFor: 6,
    votesAgainst: 0,
    votesAbstain: 0,
  }),
  ["attendanceDocx", "consentDocx", "protocolDocx"],
);

// --- Свой бланк: подстановка меток, в том числе разрезанных Word-ом на runs.
const templateXml = `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>
<w:p><w:r><w:t>Протокол № </w:t></w:r><w:r><w:t>{{proto</w:t></w:r><w:r><w:t>colNumber}}</w:t></w:r></w:p>
<w:p><w:r><w:t>Делегат: {{delegateName}} из {{region}}</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>{{attendees.index}}</w:t></w:r></w:p></w:tc>
<w:tc><w:p><w:r><w:t>{{attendees.fullName}}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p><w:r><w:t>{{unknownField}}</w:t></w:r></w:p>
</w:body></w:document>`;

const fakeTemplate = new JSZip();
fakeTemplate.file("word/document.xml", templateXml);
const fakeTemplateBuffer = await fakeTemplate.generateAsync({ type: "nodebuffer" });

const rendered = await renderTemplate(fakeTemplateBuffer, {
  values: { protocolNumber: "7", delegateName: "Лебедев Андрей Александрович", region: "Псковская область" },
  listName: "attendees",
  items: [
    { index: 1, fullName: "Иванов Иван Иванович" },
    { index: 2, fullName: "Петрова Анна & Ко <тест>" },
  ],
});

const renderedXml = await (await JSZip.loadAsync(rendered)).file("word/document.xml").async("string");
const renderedText = renderedXml.replace(/<[^>]+>/g, " ");

assert.match(renderedText, /Протокол № 7/, "метка, разрезанная Word-ом на runs, собирается");
assert.match(renderedText, /Лебедев Андрей Александрович/);
assert.ok(!renderedText.includes("{{delegateName}}"), "метки не остаются в готовом документе");
assert.match(renderedText, /Иванов Иван Иванович/);
assert.match(renderedText, /Петрова Анна/, "строка таблицы повторяется по числу участников");
assert.match(renderedXml, /Анна &amp; Ко &lt;тест&gt;/, "спецсимволы экранируются, файл не рвётся");
assert.match(renderedText, /\{\{unknownField\}\}/, "неизвестная метка остаётся видимой, а не пустеет");

// Переименованный .doc — не .docx: подстановка молча ничего бы не сделала.
await assert.rejects(
  () => saveTemplate("protocol", Buffer.from("не zip"), "протокол.doc"),
  /не файл \.docx/i,
);

// Образец бланка: вместо значений — те самые метки.
const sampleText = await documentText(buildTemplateSample("attendance"));
assert.match(sampleText, /\{\{attendees\.fullName\}\}/);
assert.match(sampleText, /\{\{quorumPercent\}\}/, "процент кворума в образце тоже метка");

// --- Архив комплекта: имена внутри ZIP не зависят от расширений загруженных сканов.
const tempDir = await mkdtemp(path.join(tmpdir(), "conferencia-check-"));
const filePathFor = async (name) => {
  const filePath = path.join(tempDir, name);
  await writeFile(filePath, "test");
  return filePath;
};

const storedSubmission = {
  region: "Республика Калмыкия",
  delegateName: "Лебедев Андрей Александрович",
  files: {
    protocolDocx: await filePathFor("protocol.docx"),
    attendanceDocx: await filePathFor("attendance.docx"),
    consentDocx: await filePathFor("consent.docx"),
    protocolScan: await filePathFor("protocolScan.jpg"),
    passportScan: await filePathFor("passportScan.pdf"),
    photo: await filePathFor("photo.png"),
  },
};

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    setHeader() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

const packageRes = fakeRes();
await sendGeneratedPackageResponse(packageRes, storedSubmission);
assert.equal(packageRes.statusCode, 200);
const packageNames = Object.keys((await JSZip.loadAsync(packageRes.body)).files).sort();
assert.deepEqual(packageNames, ["1-протокол.docx", "2-явочный-лист.docx", "3-согласие.docx"]);

const archiveRes = fakeRes();
await sendArchiveResponse(archiveRes, storedSubmission);
assert.equal(archiveRes.statusCode, 200);
const archiveNames = Object.keys((await JSZip.loadAsync(archiveRes.body)).files);
assert.ok(archiveNames.includes("1-протокол-подписанный.jpg"), "скан протокола сохраняет .jpg");
assert.ok(archiveNames.includes("4-паспорт-делегата.pdf"), "копия паспорта сохраняет .pdf");
assert.ok(archiveNames.includes("5-фото-собрания.png"));
assert.ok(archiveNames.includes("submission.json"));
assert.ok(
  !archiveNames.includes("2-явочный-лист-подписанный"),
  "отсутствующий скан не попадает в архив пустышкой",
);

// --- Прогресс и статус выводятся из состава файлов: сканы догружаются по одному.
assert.deepEqual(
  { ...uploadProgress({}), missing: uploadProgress({}).missing.map((item) => item.slot) },
  {
    done: 0,
    total: 5,
    isComplete: false,
    missing: ["protocolScan", "attendanceScan", "consentScan", "passportScan", "photo"],
  },
);
// Пока протокола нет, собрание считается идущим: заявка заполняется по шагам.
assert.equal(statusFor({}), STATUS_DRAFT);
assert.equal(statusFor({ attendanceDocx: "/a.docx" }), STATUS_DRAFT, "один бланк — ещё не всё");
assert.equal(statusFor({ protocolDocx: "/p.docx" }), STATUS_DOCX_GENERATED);
assert.equal(statusFor({ passportScan: "/x.pdf" }), STATUS_IN_PROGRESS);
assert.equal(uploadProgress({ passportScan: "/x.pdf", photo: "/y.png" }).done, 2);
assert.equal(statusFor(storedSubmission.files), STATUS_IN_PROGRESS, "3 из 5 — ещё не пакет");
assert.equal(
  statusFor({
    protocolScan: "a",
    attendanceScan: "b",
    consentScan: "c",
    passportScan: "d",
    photo: "e",
  }),
  STATUS_COMPLETE,
);

// --- По ссылке участнику не уходят абсолютные пути на диске сервера.
const publicView = toPublicSubmission(storedSubmission);
assert.deepEqual(Object.values(publicView.files), [true, true, true, true, true, true]);
assert.doesNotMatch(JSON.stringify(publicView), /Disk D|uploads|conferencia-check/);

await rm(tempDir, { recursive: true, force: true });

// --- Модули, которые импортирует форма, обязаны оставаться клиентскими.
for (const clientModule of ["slots.js", "validation.js", "format.js"]) {
  const source = await readFile(
    new URL(`../src/lib/rosdk-confrencia/${clientModule}`, import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /from "(node:|better-sqlite3)/,
    `${clientModule} импортируется формой — серверные зависимости сломают клиентский бандл`,
  );
}

// --- Субъект РФ принимается только из справочника, иначе реестр не свести.
rejects({ region: "Моск" }, /из списка/i);
rejects({ region: "Псковская обл." }, /из списка/i);
rejects({ region: "" }, /обязательные поля/i);

// --- Лимит частоты: пропускает до max, затем отдаёт время ожидания.
const limit = { max: 3, windowMs: 60_000 };
const fakeReq = { headers: {}, socket: { remoteAddress: "10.0.0.7" } };
assert.equal(checkRateLimit("t", fakeReq, limit), null);
assert.equal(checkRateLimit("t", fakeReq, limit), null);
assert.equal(checkRateLimit("t", fakeReq, limit), null);
const retryAfter = checkRateLimit("t", fakeReq, limit);
assert.ok(retryAfter > 0 && retryAfter <= 60, `ожидали секунды ожидания, получили ${retryAfter}`);
assert.equal(
  checkRateLimit("t", { headers: {}, socket: { remoteAddress: "10.0.0.8" } }, limit),
  null,
  "лимит считается по каждому адресу отдельно",
);

// --- Сессия админки: подписанный токен со сроком жизни, пароль в кукис не попадает.
process.env.ADMIN_PASSWORD = "секрет-для-проверки";
delete process.env.CONFERENCIA_SESSION_SECRET;

assert.ok(isAdminConfigured());
assert.ok(isPasswordValid("секрет-для-проверки"));
assert.ok(!isPasswordValid("другой"));
assert.ok(!isPasswordValid(""));

const token = createSessionToken();
assert.ok(isSessionTokenValid(token), "свежий токен принимается");
assert.doesNotMatch(token, /секрет-для-проверки/, "пароль не должен попадать в токен");
assert.ok(!isSessionTokenValid(`${token}x`), "подделанная подпись отклоняется");
assert.ok(!isSessionTokenValid("999999999999.deadbeef"));
assert.ok(!isSessionTokenValid(process.env.ADMIN_PASSWORD), "старый кукис-пароль больше не пускает");
assert.ok(!isSessionTokenValid(""));
assert.ok(!isSessionTokenValid(createSessionToken(Date.now() - 24 * 3600 * 1000)), "истёкший");

process.env.ADMIN_PASSWORD = "";
assert.ok(!isAdminConfigured(), "без переменной окружения вход отключён");
assert.ok(!isPasswordValid(""), "пароля по умолчанию нет");
assert.ok(!isSessionTokenValid(token), "без пароля любые токены недействительны");

console.log(
  "OK: пороги, явочный лист, три бланка, архив, справочник регионов, лимит частоты и сессия админки проверены",
);
