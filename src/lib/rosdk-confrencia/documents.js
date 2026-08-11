import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { formatLongDate, regionInPrepositional } from "./format.js";
import { CONFERENCE_DATE } from "./slots.js";

/** Наименование Организации — правится здесь, а не по тексту бланков. */
export const ORG_NAME =
  "Общероссийская общественная организация «Российское содружество колледжей»";
export const ORG_GENITIVE =
  "Общероссийской общественной организации «Российское содружество колледжей»";

export { CONFERENCE_DATE };

const FONT = "Times New Roman";
const SIZE = 24; // 12 pt, docx считает в полуточках
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const BLANK_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};

function run(text, bold = false) {
  return new TextRun({ text, font: FONT, size: SIZE, bold });
}

function p(text, options = {}) {
  const chunks = Array.isArray(text) ? text : [text];
  return new Paragraph({
    alignment: options.align,
    spacing: { after: options.after ?? 120 },
    children: chunks.map((chunk) =>
      typeof chunk === "string" ? run(chunk, options.bold) : chunk,
    ),
  });
}

function cell(children, width) {
  return new TableCell({
    borders: BLANK_BORDERS,
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    children: Array.isArray(children) ? children : [children],
  });
}

/** Таблица без рамок — для «г. X ... дата» и блоков подписей. */
function layoutTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BLANK_BORDERS,
    rows,
  });
}

function signatureBlock(chairName, secretaryName) {
  return layoutTable([
    new TableRow({
      children: [
        cell(p("Председательствующий собрания", { after: 0 }), 45),
        cell(p("_______________", { after: 0, align: AlignmentType.CENTER }), 20),
        cell(p(`/ ${chairName} /`, { after: 0, align: AlignmentType.CENTER }), 35),
      ],
    }),
    new TableRow({
      children: [
        cell(p("Секретарь собрания", { after: 0 }), 45),
        cell(p("_______________", { after: 0, align: AlignmentType.CENTER }), 20),
        cell(p(`/ ${secretaryName} /`, { after: 0, align: AlignmentType.CENTER }), 35),
      ],
    }),
  ]);
}

function quorumPercent(presentMembers, totalMembers) {
  if (!totalMembers) {
    return 0;
  }
  return Math.round((presentMembers / totalMembers) * 100);
}

function documentOf(title, children) {
  return new Document({
    creator: ORG_NAME,
    title,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SIZE },
        },
      },
    },
    sections: [{ children }],
  });
}

/** 1. Протокол Общего собрания РО об избрании делегата. */
export function buildProtocolDocument(input) {
  const meetingDate = formatLongDate(input.meetingDate);
  const percent = quorumPercent(input.presentMembers, input.totalMembers);

  return documentOf("Протокол Общего собрания регионального отделения", [
    p(`ПРОТОКОЛ № ${input.protocolNumber}`, {
      align: AlignmentType.CENTER,
      bold: true,
      after: 0,
    }),
    p("Общего собрания членов Регионального отделения", {
      align: AlignmentType.CENTER,
      after: 0,
    }),
    p(`в ${regionInPrepositional(input.region)}`, { align: AlignmentType.CENTER, after: 0 }),
    p(ORG_GENITIVE, { align: AlignmentType.CENTER, after: 240 }),

    layoutTable([
      new TableRow({
        children: [
          cell(p(`г. ${input.city}`, { after: 0 }), 50),
          cell(p(`${meetingDate} г.`, { after: 0, align: AlignmentType.RIGHT }), 50),
        ],
      }),
    ]),
    p("", { after: 120 }),

    p(`Председательствующий: ${input.chairName}`, { after: 0 }),
    p(`Секретарь собрания: ${input.secretaryName}`, { after: 240 }),

    p("ПРИСУТСТВОВАЛИ:", { bold: true, after: 0 }),
    p(
      `Члены Регионального отделения в количестве ${input.presentMembers} человек из ${input.totalMembers} членов, состоящих на учёте.`,
      { after: 0 },
    ),
    p(
      `Кворум имеется (составляет ${percent}%). Общее собрание правомочно принимать решения по всем вопросам повестки дня.`,
      { after: 240 },
    ),

    p("ПОВЕСТКА ДНЯ:", { bold: true, after: 0 }),
    p("1. Избрание Председателя и Секретаря Общего собрания Регионального отделения.", {
      after: 0,
    }),
    p(
      `2. Избрание делегата на Конференцию ${ORG_GENITIVE}, назначенную на ${CONFERENCE_DATE}.`,
      { after: 240 },
    ),

    p("По первому вопросу повестки дня", { bold: true, after: 0 }),
    p("СЛУШАЛИ: О ведении Общего собрания и избрании Председателя и Секретаря собрания.", {
      after: 0,
    }),
    p(
      `ГОЛОСОВАЛИ: «За» — ${input.presentMembers}, «Против» — 0, «Воздержались» — 0.`,
      { after: 0 },
    ),
    p(
      `РЕШИЛИ: Избрать Председательствующим собрания ${input.chairName}, Секретарём собрания ${input.secretaryName}.`,
      { after: 240 },
    ),

    p("По второму вопросу повестки дня", { bold: true, after: 0 }),
    p(
      `СЛУШАЛИ: Информацию о созыве Президиумом ${ORG_GENITIVE} Конференции на ${CONFERENCE_DATE} (в дистанционной форме) и необходимости избрания делегата от Регионального отделения.`,
      { after: 0 },
    ),
    p(
      "ВЫСТУПИЛИ: Предложено избрать делегатом на Конференцию следующих членов Организации:",
      { after: 0 },
    ),
    p(`1. ${input.delegateName} — ${input.passportData}.`, { after: 0 }),
    p(
      `ГОЛОСОВАЛИ: «За» — ${input.votesFor}, «Против» — ${input.votesAgainst}, «Воздержались» — ${input.votesAbstain}.`,
      { after: 0 },
    ),
    p("РЕШИЛИ:", { bold: true, after: 0 }),
    p(
      `1. Избрать делегатом на Конференцию ${ORG_GENITIVE}, назначенную на ${CONFERENCE_DATE}:`,
      { after: 0 },
    ),
    p(`Ф.И.О.: ${input.delegateName}`, { after: 0 }),
    p(`Паспортные данные: ${input.passportData}`, { after: 0 }),
    p(`Адрес регистрации: ${input.delegateAddress}`, { after: 0 }),
    p(`Телефон: ${input.delegatePhone}    E-mail: ${input.delegateEmail}`, { after: 0 }),
    p(
      "2. Поручить избранному делегату представить интересы Регионального отделения на Конференции с правом голоса по всем вопросам повестки дня.",
      { after: 360 },
    ),

    signatureBlock(input.chairName, input.secretaryName),
  ]);
}

/** 2. Приложение № 1 — список (явочный лист) присутствующих членов РО. */
export function buildAttendanceDocument(input) {
  const meetingDate = formatLongDate(input.meetingDate);
  const percent = quorumPercent(input.presentMembers, input.totalMembers);

  const headerCells = [
    "№ п/п",
    "Ф.И.О. члена Организации",
    "Реквизиты документа (паспорт / членский билет)",
    "Контактный телефон / E-mail",
    "Личная подпись участника",
  ];

  const rows = [
    new TableRow({
      tableHeader: true,
      children: headerCells.map(
        (title) =>
          new TableCell({
            children: [p(title, { align: AlignmentType.CENTER, after: 0, bold: true })],
          }),
      ),
    }),
    ...input.attendees.map(
      (attendee, index) =>
        new TableRow({
          children: [
            new TableCell({
              children: [p(String(index + 1), { align: AlignmentType.CENTER, after: 0 })],
            }),
            new TableCell({ children: [p(attendee.fullName, { after: 0 })] }),
            new TableCell({ children: [p(attendee.documentRef, { after: 0 })] }),
            new TableCell({ children: [p(attendee.contact, { after: 0 })] }),
            new TableCell({
              children: [p("___________", { align: AlignmentType.CENTER, after: 0 })],
            }),
          ],
        }),
    ),
  ];

  return documentOf("Список присутствующих на Общем собрании регионального отделения", [
    p("Приложение № 1", { align: AlignmentType.RIGHT, after: 0 }),
    p(`к Протоколу Общего собрания № ${input.protocolNumber}`, {
      align: AlignmentType.RIGHT,
      after: 0,
    }),
    p("Регионального отделения", { align: AlignmentType.RIGHT, after: 0 }),
    p(`в ${regionInPrepositional(input.region)}`, { align: AlignmentType.RIGHT, after: 0 }),
    p(`от ${meetingDate} г.`, { align: AlignmentType.RIGHT, after: 360 }),

    p("СПИСОК (ЯВОЧНЫЙ ЛИСТ)", {
      align: AlignmentType.CENTER,
      bold: true,
      after: 0,
    }),
    p("членов Регионального отделения", { align: AlignmentType.CENTER, after: 0 }),
    p(`в ${regionInPrepositional(input.region)}`, { align: AlignmentType.CENTER, after: 0 }),
    p(`присутствующих на Общем собрании ${meetingDate} г.`, {
      align: AlignmentType.CENTER,
      after: 240,
    }),

    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
    p("", { after: 240 }),

    p("ИТОГИ РЕГИСТРАЦИИ:", { bold: true, after: 0 }),
    p(`Всего состоит на учёте в Региональном отделении: ${input.totalMembers} членов.`, {
      after: 0,
    }),
    p(`Приняли личное участие в Общем собрании: ${input.presentMembers} членов.`, {
      after: 0,
    }),
    p(`Кворум составляет ${percent}%. Собрание правомочно.`, { after: 360 }),

    signatureBlock(input.chairName, input.secretaryName),
  ]);
}

/** 3. Согласие делегата на обработку персданных, видеозапись и использование изображения. */
export function buildConsentDocument(input) {
  return documentOf("Согласие делегата на обработку персональных данных", [
    p("СОГЛАСИЕ", { align: AlignmentType.CENTER, bold: true, after: 0 }),
    p(
      "субъекта персональных данных на обработку персональных данных, видеозапись и использование изображения",
      { align: AlignmentType.CENTER, after: 240 },
    ),

    p("Я, нижеподписавшийся(ая):", { after: 120 }),
    p(`Ф.И.О.: ${input.delegateName}`, { after: 0 }),
    p(`Паспортные данные: ${input.passportData}`, { after: 0 }),
    p(`Адрес регистрации: ${input.delegateAddress}`, { after: 0 }),
    p(`Телефон: ${input.delegatePhone}    E-mail: ${input.delegateEmail}`, { after: 0 }),
    p(`Делегат от: Регионального отделения в ${regionInPrepositional(input.region)}`, { after: 240 }),

    p(
      [
        run(
          "в соответствии с требованиями Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» и статьи 152.1 Гражданского кодекса Российской Федерации настоящим даю своё свободное, своей волей и в своем интересе согласие ",
        ),
        run(ORG_NAME, true),
        run(
          " (далее — Оператор) на обработку моих персональных данных и использование моего изображения на следующих условиях:",
        ),
      ],
      { after: 240 },
    ),

    p("1. Перечень персональных данных, на обработку которых дается согласие:", {
      bold: true,
      after: 0,
    }),
    p("— фамилия, имя, отчество;", { after: 0 }),
    p(
      "— паспортные данные (серия, номер, кем и когда выдан, код подразделения, адрес регистрации);",
      { after: 0 },
    ),
    p("— контактные данные (номер телефона, адрес электронной почты);", { after: 0 }),
    p("— сведения об избрании делегатом на Конференцию Организации;", { after: 0 }),
    p(
      "— фотоизображение, биометрические данные в виде аудиозаписи голоса и видеоизображения в формате видеопотока, фиксируемого во время проведения Конференции в дистанционной (онлайн) форме.",
      { after: 240 },
    ),

    p("2. Цели обработки персональных данных и видеозаписи:", { bold: true, after: 0 }),
    p(
      `— учет и регистрация делегатов Конференции Организации, назначаемой на ${CONFERENCE_DATE};`,
      { after: 0 },
    ),
    p(
      "— обеспечение идентификации личности при дистанционном (онлайн) подключении к заседаниям;",
      { after: 0 },
    ),
    p(
      "— непрерывная видео- и аудиофиксация хода Конференции в соответствии с требованиями статьи 181.2 Гражданского кодекса РФ;",
      { after: 0 },
    ),
    p("— формирование официального Протокола Конференции и материалов к нему;", {
      after: 0,
    }),
    p(
      "— представление сведений и документов в Министерство юстиции Российской Федерации, Федеральную налоговую службу и иные уполномоченные государственные органы РФ;",
      { after: 0 },
    ),
    p("— архивное хранение документов Организации.", { after: 240 }),

    p("3. Перечень действий с персональными данными:", { bold: true, after: 0 }),
    p(
      "Оператор имеет право осуществлять следующие действия (операции) с персональными данными: сбор, запись, систематизация, накопление, хранение, уточнение (обновление, изменение), извлечение, использование, передача (предоставление, доступ уполномоченным органам власти), обезличивание, блокирование, удаление и уничтожение персональных данных с использованием средств автоматизации или без использования таких средств.",
      { after: 240 },
    ),

    p("4. Согласие на видеозапись и трансляцию:", { bold: true, after: 0 }),
    p(
      `Даю согласие на осуществление видео- и аудиозаписи моего участия в Конференции ${CONFERENCE_DATE} на платформе онлайн-связи, а также на использование такой записи исключительно в юридических и архивных целях Организации.`,
      { after: 240 },
    ),

    p("5. Срок действия согласия и порядок его отзыва:", { bold: true, after: 0 }),
    p(
      "Настоящее согласие действует со дня его подписания в течение 5 (пяти) лет либо до момента достижения целей обработки данных. Согласие может быть отозвано путем направления письменного заявления Оператору.",
      { after: 360 },
    ),

    layoutTable([
      new TableRow({
        children: [
          cell(p(`${formatLongDate(input.meetingDate)} г.`, { after: 0 }), 34),
          cell(p("_______________", { after: 0, align: AlignmentType.CENTER }), 22),
          cell(p(`/ ${input.delegateName} /`, { after: 0, align: AlignmentType.CENTER }), 44),
        ],
      }),
      new TableRow({
        children: [
          cell(p("", { after: 0 }), 34),
          cell(
            p("(личная подпись)", { after: 0, align: AlignmentType.CENTER }),
            22,
          ),
          cell(
            p("(расшифровка подписи: Ф.И.О.)", { after: 0, align: AlignmentType.CENTER }),
            44,
          ),
        ],
      }),
    ]),
  ]);
}

/** Комплект РО: три бланка, которые печатаются и подписываются на собрании. */
export const GENERATED_DOCUMENTS = [
  { key: "protocolDocx", fileName: "protocol.docx", build: buildProtocolDocument },
  { key: "attendanceDocx", fileName: "attendance.docx", build: buildAttendanceDocument },
  { key: "consentDocx", fileName: "consent.docx", build: buildConsentDocument },
];

export async function generateSubmissionDocuments(input) {
  const entries = await Promise.all(
    GENERATED_DOCUMENTS.map(async ({ key, fileName, build }) => [
      key,
      { fileName, buffer: await Packer.toBuffer(build(input)) },
    ]),
  );

  return Object.fromEntries(entries);
}
