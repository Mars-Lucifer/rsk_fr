import { classifyTask } from "@/lib/mayakProgressModel";

// Распознан ли contentType по стандарту (старт / формат «Я» / направление «Мы»
// / карта настроения с префиксом). Используется для подсветки ячеек «Тип».
export function isStandardContentType(value) {
    const info = classifyTask(value);
    if (info.kind === "mood") return info.standard === true;
    return info.kind === "start" || info.kind === "ya-format" || info.kind === "we-direction";
}

// Колонки таблицы (порядок как в Google Sheets)
export const COLUMNS = [
    { key: "number", label: "№", width: 50, readOnly: true, source: "task" },
    { key: "title", label: "Название", width: 140, source: "task" },
    { key: "contentType", label: "Тип", width: 100, source: "task" },
    { key: "description", label: "Описание", width: 320, source: "text", multiline: true },
    { key: "task", label: "Задание", width: 320, source: "text", multiline: true },
    { key: "toolName1", label: "Инструмент 1", width: 130, source: "task" },
    { key: "toolLink1", label: "Ссылка 1", width: 180, source: "task" },
    { key: "toolName2", label: "Инструмент 2", width: 130, source: "task" },
    { key: "toolLink2", label: "Ссылка 2", width: 180, source: "task" },
    { key: "services", label: "Сервисы", width: 200, source: "task" },
    { key: "instructionText", label: "Инструкция", width: 160, source: "task" },
    { key: "materialText", label: "Доп.материал", width: 160, source: "task" },
    { key: "mapText", label: "Карта", width: 160, source: "task" },
    { key: "sourceLink", label: "Источник", width: 180, source: "task" },
    { key: "hasInstruction", label: "◉Инстр.", width: 50, source: "task", autoCheckbox: true, boundTo: "instructionText", needsFile: true, fileField: "instruction" },
    { key: "hasFile", label: "◉Доп.м.", width: 50, source: "task", autoCheckbox: true, boundTo: "materialText", needsFile: true, fileField: "file" },
    { key: "hasMap", label: "◉Карта", width: 52, source: "task", autoCheckbox: true, boundTo: "mapText", needsFile: true, fileField: "map" },
    { key: "hasSource", label: "◉Ист.", width: 44, source: "task", autoCheckbox: true, boundTo: "sourceLink" },
    { key: "instruction", label: "Загр.инстр.", width: 160, source: "task", fileCol: "instructions" },
    { key: "file", label: "Загр.доп.мат.", width: 160, source: "task", fileCol: "files" },
    { key: "map", label: "Загр.карту", width: 160, source: "task", fileCol: "maps" },
    { key: "generate", label: "⚙ Авто-инстр.", width: 150, source: "action" },
];
