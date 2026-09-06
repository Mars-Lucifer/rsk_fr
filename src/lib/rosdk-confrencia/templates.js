// Свои бланки вместо встроенных: Оргкомитет загружает .docx с плейсхолдерами,
// подстановка идёт прямо в word/document.xml через JSZip — отдельного движка
// шаблонов не нужно, а лишняя зависимость на бланки не заводится.
//
// Word режет текст на runs, поэтому «{{delegateName}}» в файле нередко лежит
// кусками. Подстановка идёт по абзацу целиком: тексты всех runs склеиваются,
// заменяются и кладутся обратно в первый run — так разрезанный плейсхолдер
// собирается сам.

import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { DATA_DIR } from "./paths.js";

export const TEMPLATES_DIR = path.join(DATA_DIR, "templates");
const INDEX_PATH = path.join(TEMPLATES_DIR, "index.json");

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Бланки, которые можно заменить своим файлом. */
export const TEMPLATE_KINDS = [
  {
    key: "protocol",
    slot: "protocolDocx",
    label: "Протокол собрания РО",
    listName: "attendees",
    listLabel: "строка явочного листа",
  },
  {
    key: "attendance",
    slot: "attendanceDocx",
    label: "Список присутствовавших (Приложение № 1)",
    listName: "attendees",
    listLabel: "строка явочного листа",
  },
  {
    key: "consent",
    slot: "consentDocx",
    label: "Согласие делегата",
    listName: null,
    listLabel: null,
  },
  {
    key: "registry",
    slot: null,
    label: "Реестр делегатов (для Мандатной комиссии)",
    listName: "rows",
    listLabel: "строка реестра",
  },
];

export function templateKind(key) {
  return TEMPLATE_KINDS.find((item) => item.key === key) ?? null;
}

function filePathFor(key) {
  return path.join(TEMPLATES_DIR, `${key}.docx`);
}

async function readIndex() {
  try {
    return JSON.parse(await fs.readFile(INDEX_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function writeIndex(index) {
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
  await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2));
}

/** Загруженный бланк или null, если действует встроенный. */
export async function loadTemplate(key) {
  if (!templateKind(key)) {
    return null;
  }

  return fs.readFile(filePathFor(key)).catch(() => null);
}

export async function listTemplates() {
  const index = await readIndex();

  return TEMPLATE_KINDS.map((kind) => ({
    ...kind,
    custom: Boolean(index[kind.key]),
    uploadedAt: index[kind.key]?.uploadedAt ?? null,
    originalName: index[kind.key]?.originalName ?? null,
    size: index[kind.key]?.size ?? null,
  }));
}

export async function saveTemplate(key, buffer, originalName) {
  if (!templateKind(key)) {
    throw new Error("Неизвестный бланк.");
  }

  // Проверяем, что это действительно .docx, а не переименованный .doc:
  // иначе подстановка молча ничего не сделает.
  const zip = await JSZip.loadAsync(buffer).catch(() => null);
  if (!zip || !zip.file("word/document.xml")) {
    throw new Error(
      "Это не файл .docx. Откройте документ в Word и сохраните как «Документ Word (*.docx)».",
    );
  }

  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
  await fs.writeFile(filePathFor(key), buffer);

  const index = await readIndex();
  index[key] = {
    uploadedAt: new Date().toISOString(),
    originalName: originalName || `${key}.docx`,
    size: buffer.length,
  };
  await writeIndex(index);

  return index[key];
}

/** Возврат к встроенному бланку. */
export async function removeTemplate(key) {
  await fs.rm(filePathFor(key), { force: true });

  const index = await readIndex();
  delete index[key];
  await writeIndex(index);
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

function substitute(text, values) {
  return text.replace(PLACEHOLDER, (match, name) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name] ?? "") : match,
  );
}

const TEXT_TAG = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g;

/** Подстановка внутри одного абзаца: тексты runs склеиваются и заменяются. */
function renderParagraph(paragraphXml, values) {
  const parts = [...paragraphXml.matchAll(TEXT_TAG)];

  if (parts.length === 0) {
    return paragraphXml;
  }

  const joined = parts.map((part) => part[2]).join("");
  if (!joined.includes("{{")) {
    return paragraphXml;
  }

  const replaced = substitute(decodeXml(joined), values);
  let index = 0;

  return paragraphXml.replace(TEXT_TAG, (match, open, _text, close) => {
    const value = index === 0 ? escapeXml(replaced) : "";
    index += 1;
    // xml:space нужен, иначе Word съедает пробелы по краям подставленного текста.
    const openTag = open.includes("xml:space") ? open : open.replace(/>$/, ' xml:space="preserve">');
    return `${openTag}${value}${close}`;
  });
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const ROW_TAG = /<w:tr\b[\s\S]*?<\/w:tr>/g;
const PARAGRAPH_TAG = /<w:p\b[\s\S]*?<\/w:p>/g;

function renderRows(xml, listName, items) {
  if (!listName) {
    return xml;
  }

  const prefix = `{{${listName}.`;

  return xml.replace(ROW_TAG, (rowXml) => {
    const text = [...rowXml.matchAll(TEXT_TAG)].map((part) => part[2]).join("");
    if (!text.includes(prefix) && !text.includes(`{{ ${listName}.`)) {
      return rowXml;
    }

    return items
      .map((item) => {
        const values = {};
        for (const [key, value] of Object.entries(item)) {
          values[`${listName}.${key}`] = value;
        }
        return rowXml.replace(PARAGRAPH_TAG, (paragraph) => renderParagraph(paragraph, values));
      })
      .join("");
  });
}

/**
 * Подставляет данные заявки в загруженный бланк.
 * `values` — плоский словарь, `list` — повторяющиеся строки таблицы.
 */
export async function renderTemplate(buffer, { values, listName = null, items = [] }) {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file("word/document.xml");

  if (!file) {
    throw new Error("В файле нет word/document.xml — это не .docx.");
  }

  let xml = await file.async("string");
  xml = renderRows(xml, listName, items);
  xml = xml.replace(PARAGRAPH_TAG, (paragraph) => renderParagraph(paragraph, values));

  zip.file("word/document.xml", xml);

  return zip.generateAsync({ type: "nodebuffer", mimeType: DOCX_MIME });
}
