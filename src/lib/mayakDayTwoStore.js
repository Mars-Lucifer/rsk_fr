// День 2: хранилище дней администратора — data/mayak-day2/days.json.
// День = бриф + колода + привязка к разделу и сессии + треки + заметки.
// Чистая модель (шаблон, проверки, computeStage) лежит в mayakDayTwoModel.js и
// реэкспортируется отсюда, чтобы серверный код импортировал одно место.

import path from "path";
import crypto from "crypto";

import { readJsonFile, withJsonFileLock, writeJsonFileAtomic } from "@/lib/jsonFileLock";
import { buildDayFromTemplate, cloneTemplateCards, emptyTracks, normalizeCard, normalizeTable, DAY_TWO_TRACKS, TRACK_MARKS } from "@/lib/mayakDayTwoModel";

export * from "@/lib/mayakDayTwoModel";

const DAYS_FILE = path.join(process.cwd(), "data", "mayak-day2", "days.json");

function createEmptyStore() {
    return { days: [] };
}

function str(value) {
    return typeof value === "string" ? value.trim() : "";
}

async function readStore() {
    const parsed = await readJsonFile(DAYS_FILE, createEmptyStore());
    return { days: Array.isArray(parsed?.days) ? parsed.days : [] };
}

function sortDays(days) {
    return days.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export async function listDayTwoDays() {
    const store = await readStore();
    return sortDays(store.days);
}

export async function getDayTwoDay(id) {
    const normalizedId = str(String(id || ""));
    if (!normalizedId) return null;
    const store = await readStore();
    return store.days.find((day) => day.id === normalizedId) || null;
}

async function insertDay(brief, cards = null) {
    const now = new Date().toISOString();
    const day = {
        id: crypto.randomUUID(),
        ...buildDayFromTemplate(brief),
        createdAt: now,
        updatedAt: now,
        cardsUpdatedAt: now,
    };
    if (Array.isArray(cards)) day.cards = cards;
    await withJsonFileLock(DAYS_FILE, async () => {
        const store = await readJsonFile(DAYS_FILE, createEmptyStore());
        store.days = Array.isArray(store?.days) ? store.days : [];
        store.days.push(day);
        await writeJsonFileAtomic(DAYS_FILE, store);
    });
    return day;
}

export async function createDayTwoDay(brief = {}) {
    return insertDay(brief);
}

// H4d: копия дня — бриф (без даты: её ставит админ), столы, папка, логотип и
// колода. Раздел, сессия, снимок, треки, заметки и отметки не копируются.
export async function copyDayTwoDay(sourceId) {
    const source = await getDayTwoDay(sourceId);
    if (!source) throw new Error("День для копирования не найден");
    const cards = (Array.isArray(source.cards) ? source.cards : []).map((card) => normalizeCard(JSON.parse(JSON.stringify(card))));
    return insertDay(
        {
            org: source.org,
            date: "",
            tables: source.tables,
            folder_url: source.folder_url,
            logo: source.logo,
            allowed_files: source.allowed_files,
            fromTemplate: false,
        },
        cards
    );
}

// Произвольное изменение дня под блокировкой файла: mutator получает копию
// записи и возвращает новую (или меняет на месте). Для служебных полей —
// раздел, сессия, снимок результатов.
export async function mutateDayTwoDay(id, mutator) {
    const normalizedId = str(String(id || ""));
    let result = null;
    await withJsonFileLock(DAYS_FILE, async () => {
        const store = await readJsonFile(DAYS_FILE, createEmptyStore());
        store.days = Array.isArray(store?.days) ? store.days : [];
        const index = store.days.findIndex((day) => day.id === normalizedId);
        if (index === -1) {
            throw new Error("День не найден");
        }
        const current = JSON.parse(JSON.stringify(store.days[index]));
        const next = (await mutator(current)) || current;
        next.updatedAt = new Date().toISOString();
        store.days[index] = next;
        await writeJsonFileAtomic(DAYS_FILE, store);
        result = next;
    });
    return result;
}

function normalizeTracks(input, tables) {
    const base = emptyTracks(tables);
    if (!input || typeof input !== "object") return base;
    Object.keys(base).forEach((key) => {
        const row = Array.isArray(input[key]) ? input[key] : [];
        base[key] = DAY_TWO_TRACKS.map((_, i) => (TRACK_MARKS.includes(row[i]) ? row[i] : ""));
    });
    return base;
}

function normalizeNotes(input) {
    if (!input || typeof input !== "object") return {};
    const notes = {};
    Object.keys(input).forEach((key) => {
        const item = input[key] && typeof input[key] === "object" ? input[key] : {};
        notes[String(key)] = { roadmap: str(item.roadmap), point0: str(item.point0) };
    });
    return notes;
}

// Правка дня из формы: бриф, карточки, треки, заметки, отметки. Поля раздела и
// сессии отсюда не меняются — их пишут publish и session.
export async function updateDayTwoDay(id, patch = {}) {
    return mutateDayTwoDay(id, (day) => {
        ["org", "date", "folder_url", "logo", "allowed_files"].forEach((key) => {
            if (typeof patch[key] === "string") day[key] = patch[key].trim();
        });
        if (Array.isArray(patch.tables)) {
            day.tables = patch.tables.map(normalizeTable);
            day.tracks = normalizeTracks(day.tracks, day.tables);
        }
        if (Array.isArray(patch.cards)) {
            const cards = patch.cards.map(normalizeCard);
            if (cards.length === 0) throw new Error("Колода пуста");
            if (cards.some((card) => !card.num)) throw new Error("У каждой карточки нужен номер (num)");
            day.cards = cards;
            day.cardsUpdatedAt = new Date().toISOString();
        }
        if (patch.fromTemplate === true) {
            if ((day.cards || []).length > 0) throw new Error("Колода уже собрана — очистите её загрузкой JSON, если нужно пересобрать");
            day.cards = cloneTemplateCards();
            day.cardsUpdatedAt = new Date().toISOString();
        }
        if (patch.tracks && typeof patch.tracks === "object") {
            day.tracks = normalizeTracks(patch.tracks, day.tables);
        }
        if (patch.notes && typeof patch.notes === "object") {
            day.notes = { ...normalizeNotes(day.notes), ...normalizeNotes(patch.notes) };
        }
        if (typeof patch.mailed === "boolean") {
            if (patch.mailed && !day.session?.id) throw new Error("Сначала создайте сессию");
            day.mailed = patch.mailed;
        }
        if (typeof patch.completed === "boolean") {
            if (patch.completed && !day.results?.at) throw new Error("Сначала сделайте снимок результатов");
            day.completed = patch.completed;
        }
        return day;
    });
}
