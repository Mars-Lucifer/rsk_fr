// node --test src/lib/mayakServiceTemplates.test.mjs
// Проверка одна: шаблон выбирается по типу задания, а не по тому, как оператор
// назвал формат. Раньше «Фото» не совпадало с типом «изображение» и молча
// подставлялся первый шаблон сервиса — задания с картинками получали текстовый.
//
// resolveFormat здесь продублирован: сам модуль тянет sharp и jszip, ради
// чистой функции их грузить незачем. Дублируется три строки; расходятся они
// только вместе с правкой в mayakServiceTemplates.js:108.

import test from "node:test";
import assert from "node:assert/strict";

import { resolveFormatKey } from "./mayakProgressModel.js";

function resolveFormat(service, formatKey, contentTypeKey) {
    if (!service || !Array.isArray(service.formats) || service.formats.length === 0) return null;
    if (formatKey) {
        const found = service.formats.find((f) => f.formatKey === formatKey);
        if (found) return found;
    }
    if (contentTypeKey) {
        const byType = service.formats.find(
            (f) => f.formatKey === contentTypeKey || resolveFormatKey(f.formatKey) === contentTypeKey
        );
        if (byType) return byType;
    }
    return service.formats[0];
}

// Реестр как на проде: у Qwen три формата, первый — текстовый.
const qwen = {
    serviceKey: "qwen",
    serviceName: "Qwen",
    formats: [
        { formatKey: "текст", formatName: "Текст", templateFile: "qwen-текст.pptx" },
        { formatKey: "фото", formatName: "Фото", templateFile: "qwen-foto.pptx" },
        { formatKey: "видео", formatName: "Видео", templateFile: "qwen-video.pptx" },
    ],
};

test("задание с картинкой получает шаблон «Фото», а не первый попавшийся", () => {
    assert.equal(resolveFormat(qwen, "", "изображение").formatKey, "фото");
});

test("«Статика» и «Динамика» из СПО-колод тоже попадают", () => {
    const spo = {
        formats: [
            { formatKey: "текст" },
            { formatKey: "статика" },
            { formatKey: "динамика" },
        ],
    };
    assert.equal(resolveFormat(spo, "", "изображение").formatKey, "статика");
    assert.equal(resolveFormat(spo, "", "видео").formatKey, "динамика");
});

test("точное совпадение работает как раньше", () => {
    assert.equal(resolveFormat(qwen, "", "текст").formatKey, "текст");
    assert.equal(resolveFormat(qwen, "", "видео").formatKey, "видео");
});

test("ручной выбор формата важнее типа задания", () => {
    assert.equal(resolveFormat(qwen, "видео", "изображение").formatKey, "видео");
});

test("нет подходящего формата — прежний фоллбэк на первый", () => {
    // Аудио-задание у Qwen: своего формата нет, остаётся текстовый шаблон.
    assert.equal(resolveFormat(qwen, "", "аудио").formatKey, "текст");
});

test("сервис без форматов не роняет выбор", () => {
    assert.equal(resolveFormat({ formats: [] }, "", "текст"), null);
    assert.equal(resolveFormat(null, "", "текст"), null);
});
