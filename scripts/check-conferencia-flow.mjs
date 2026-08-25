// Сквозной путь отделения: `node scripts/check-conferencia-flow.mjs`.
//
// В отличие от check-conferencia-package.mjs здесь работает настоящая база —
// поэтому CONFERENCIA_DATA_DIR переводится на временный каталог до первого
// импорта, и весь файл идёт через await import: боевой data/ не трогаем.
//
// Ловит то, что видно только на живой заявке: персональную ссылку с другого
// устройства, лимит «одна заявка от субъекта» под гонкой и отзыв протокола,
// когда явочный лист правят уже после голосования.
import assert from "node:assert";
import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";

const dataDir = await mkdtemp(path.join(tmpdir(), "conferencia-flow-"));
process.env.CONFERENCIA_DATA_DIR = dataDir;
process.env.CONFERENCIA_LINK_SECRET = "соль-для-проверки";

const {
  createStoredSubmission,
  findStoredSubmissionByRegion,
  getStoredSubmission,
  updateStoredSubmission,
} = await import("../src/lib/rosdk-confrencia/storage.js");
const { generateSubmissionDocuments, readyDocuments } = await import(
  "../src/lib/rosdk-confrencia/documents.js"
);
const { parseDelegateInput, parseRegistrationInput, parseVotesInput, votesAreStale } = await import(
  "../src/lib/rosdk-confrencia/validation.js"
);
const { regionByToken, regionToken } = await import("../src/lib/rosdk-confrencia/regionLinks.js");
const { MAX_SUBMISSIONS_PER_REGION } = await import("../src/lib/rosdk-confrencia/slots.js");

const REGION = "Псковская область";
const NAMES = ["Иванов", "Петров", "Сидоров", "Кузнецов", "Смирнов", "Волков", "Зайцев", "Морозов"];
const attendees = (count) =>
  Array.from({ length: count }, (_, index) => ({
    fullName: `${NAMES[index]} Иван Иванович`,
    passportSeries: "4510",
    passportNumber: `12345${index}`,
    phone: `+7 (999) 000-00-0${index}`,
  }));

const registrationBody = (count) => ({
  region: REGION,
  city: "Псков",
  meetingDate: "2026-08-01",
  chairName: "Иванов Иван Иванович",
  secretaryName: "Петров Иван Иванович",
  attendees: attendees(count),
});

// --- Шаг 1: отделение пришло по персональной ссылке.
const token = regionToken(REGION);
assert.equal(regionByToken(token), REGION, "токен ссылки разбирается обратно в субъект");

const input = parseRegistrationInput(registrationBody(6));
input.protocolNumber = "60/1";
const id = crypto.randomUUID();
let submission = await createStoredSubmission(
  id,
  input,
  await generateSubmissionDocuments(input, ["attendanceDocx"]),
  MAX_SUBMISSIONS_PER_REGION
);
assert.ok(submission.files.attendanceDocx, "явочный лист собрался сразу");

// --- Второе отделение того же субъекта: лимит держится транзакцией.
await assert.rejects(
  async () =>
    createStoredSubmission(
      crypto.randomUUID(),
      input,
      await generateSubmissionDocuments(input, ["attendanceDocx"]),
      MAX_SUBMISSIONS_PER_REGION
    ),
  (error) => error.code === "REGION_LIMIT",
  "вторая заявка от субъекта отбита внутри транзакции"
);

// --- Шаги 2 и 3: делегат и голоса. Протокол появляется последним.
const delegatePatch = parseDelegateInput({
  delegateName: "Ким Виктор",
  delegatePhone: "+7 (999) 111-22-33",
  delegateEmail: "delegate@example.ru",
  passportSeries: "4510",
  passportNumber: "123456",
  passportIssuedBy: "УМВД по Псковской области",
  passportIssuedDate: "2015-06-10",
  passportDepartmentCode: "600-014",
  addressPostalCode: "180000",
  addressRegion: REGION,
  addressSettlement: "г. Псков",
  addressStreet: "Советская",
  addressHouse: "5",
});
submission = await updateStoredSubmission(
  id,
  delegatePatch,
  await generateSubmissionDocuments(
    { ...submission, ...delegatePatch },
    readyDocuments({ ...submission, ...delegatePatch }).filter((slot) => slot !== "attendanceDocx")
  )
);
assert.equal(submission.delegateName, "Ким Виктор", "делегат без отчества сохранился");
assert.ok(submission.files.consentDocx, "согласие собралось");

const votesPatch = parseVotesInput({ votesFor: 5, votesAgainst: 1, votesAbstain: 0 }, 6);
submission = await updateStoredSubmission(
  id,
  votesPatch,
  await generateSubmissionDocuments({ ...submission, ...votesPatch }, ["protocolDocx"])
);
assert.ok(submission.files.protocolDocx, "протокол собрался после голосования");

// --- Другое устройство, та же ссылка: заявка находится по субъекту из токена.
const fromOtherDevice = await findStoredSubmissionByRegion(regionByToken(token));
assert.equal(fromOtherDevice.id, id, "по персональной ссылке открывается та же заявка");
assert.equal(fromOtherDevice.votesFor, 5, "голоса на месте");
assert.ok(fromOtherDevice.files.protocolDocx, "протокол на месте");
assert.equal(fromOtherDevice.attendees.length, 6, "явочный лист на месте");
assert.equal(fromOtherDevice.status, "docx_generated", "статус тот же");

// --- На собрание дописали двоих уже после голосования.
const editPatch = parseRegistrationInput({ ...registrationBody(8), region: REGION });
editPatch.protocolNumber = submission.protocolNumber;
editPatch.region = submission.region;

assert.equal(votesAreStale(submission, editPatch.presentMembers), true);
editPatch.votesFor = 0;
editPatch.votesAgainst = 0;
editPatch.votesAbstain = 0;

const merged = { ...submission, ...editPatch };
const documents = await generateSubmissionDocuments(merged, readyDocuments(merged));
documents.protocolDocx = null;
submission = await updateStoredSubmission(id, editPatch, documents);

assert.equal(submission.presentMembers, 8, "новая явка записана");
assert.equal(submission.files.protocolDocx, undefined, "протокол отозван, а не пересобран с чужими числами");
assert.ok(submission.files.attendanceDocx, "явочный лист пересобрался");
assert.ok(submission.files.consentDocx, "согласие делегата не пострадало");
assert.equal(submission.votesFor, 0, "голоса обнулены — блок снова просит цифры");
assert.equal(submission.status, "draft", "статус вернулся к «собрание идёт»");

// --- Отделение переголосовало под новую явку: протокол собирается снова.
const revote = parseVotesInput({ votesFor: 7, votesAgainst: 1, votesAbstain: 0 }, 8);
submission = await updateStoredSubmission(
  id,
  revote,
  await generateSubmissionDocuments({ ...submission, ...revote }, ["protocolDocx"])
);
assert.ok(submission.files.protocolDocx, "протокол собран заново");

const JSZip = (await import("jszip")).default;
const { readFile } = await import("node:fs/promises");
const xml = await (await JSZip.loadAsync(await readFile(submission.files.protocolDocx)))
  .file("word/document.xml")
  .async("string");
const text = xml.replace(/<[^>]+>/g, "");
assert.match(text, /в количестве 8 человек/);
assert.match(text, /«За» — 7, «Против» — 1, «Воздержались» — 0/);
assert.match(text, /Ким Виктор/);

// --- Заявка по-прежнему открывается с другого устройства по той же ссылке.
const afterEdit = await findStoredSubmissionByRegion(REGION);
assert.equal(afterEdit.id, id);
assert.equal(afterEdit.presentMembers, 8);
assert.equal(afterEdit.votesFor, 7);

// Соединение с базой держится открытым до выхода процесса — удаление по мере сил.
await rm(dataDir, { recursive: true, force: true }).catch(() => {});
console.log("OK: ссылка отделения, лимит субъекта, отзыв протокола при правке явки и переголосование");
