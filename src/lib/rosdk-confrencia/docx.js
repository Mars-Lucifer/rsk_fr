import fs from "node:fs/promises";
import JSZip from "jszip";
import { TEMPLATE_PATH } from "./paths.js";

const paragraphPattern = /<w:p[\s\S]*?<\/w:p>/g;
const textPattern = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;

export async function generateProtocolDocx(input) {
  const template = await fs.readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(template);
  const document = zip.file("word/document.xml");

  if (!document) {
    throw new Error("В шаблоне не найден word/document.xml.");
  }

  const xml = await document.async("string");
  const updatedXml = replaceParagraphText(xml, input);
  zip.file("word/document.xml", updatedXml);

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  return buffer;
}

function replaceParagraphText(xml, input) {
  return xml.replace(paragraphPattern, (paragraph) => {
    const originalText = getParagraphText(paragraph);
    if (!originalText.trim()) {
      return paragraph;
    }

    const nextText = materializeText(originalText, input);
    if (nextText === originalText) {
      return paragraph;
    }

    let replacedFirstText = false;
    return paragraph.replace(textPattern, (match, attributes = "") => {
      if (!replacedFirstText) {
        replacedFirstText = true;
        return `<w:t${attributes}>${escapeXml(nextText)}</w:t>`;
      }

      return match.replace(/>([\s\S]*?)<\/w:t>/, "></w:t>");
    });
  });
}

function getParagraphText(paragraph) {
  const parts = [...paragraph.matchAll(textPattern)].map((match) =>
    decodeXml(match[2]),
  );

  return parts.join("");
}

function materializeText(text, input) {
  const date = formatRussianDate(input.meetingDate);

  return text
    .replace("[Название субъекта РФ]", input.region)
    .replace("[Город]", input.city)
    .replace("№ __", `№ ${input.protocolNumber}`)
    .replace(/г\. .*? г\./, `г. ${input.city} ${date} г.`)
    .replace(
      /Присутствовали: _ из _ членов отделения/,
      `Присутствовали: ${input.presentMembers} из ${input.totalMembers} членов отделения`,
    )
    .replace("[ФИО делегата]", input.delegateName)
    .replace("[данные]", input.passportData)
    .replace(/Голосование: «За» —\s*/, `Голосование: «За» — ${input.votesFor} `)
    .replace(
      /Председатель собрания ___________\s*/,
      `Председатель собрания ___________ ${input.chairName}`,
    )
    .replace(
      /Секретарь собрания ___________\s*/,
      `Секретарь собрания ___________ ${input.secretaryName}`,
    );
}

function formatRussianDate(value) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).formatToParts(parsed);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";

  return `«${day}» ${month} ${year}`;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function decodeXml(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}
