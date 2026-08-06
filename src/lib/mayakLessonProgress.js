import path from "path";

import { readJsonFile, withJsonFileLock, writeJsonFileAtomic } from "@/lib/jsonFileLock";

// Прогресс видеоуроков мастера, привязанный к доступу (accessId), а не к
// устройству: мастер открывает свою ссылку с любого компьютера и видит, какие
// уроки уже пройдены. Пройденный урок остаётся доступным — его можно пересмотреть
// и пройти тест заново, поэтому храним просто множество пройденных id.
const PROGRESS_FILE = path.join(process.cwd(), "data", "mayak-lesson-progress.json");

function createEmptyStore() {
    return { progress: {} };
}

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

export async function getLessonProgress(accessId) {
    const key = normalizeString(accessId);
    if (!key) return [];
    const store = await readJsonFile(PROGRESS_FILE, createEmptyStore());
    const entry = store?.progress?.[key];
    return Array.isArray(entry?.lessonIds) ? entry.lessonIds : [];
}

export async function markLessonPassed(accessId, lessonId) {
    const key = normalizeString(accessId);
    const lesson = normalizeString(lessonId);
    if (!key || !lesson) return [];

    return withJsonFileLock(PROGRESS_FILE, async () => {
        const store = await readJsonFile(PROGRESS_FILE, createEmptyStore());
        const progress = store?.progress && typeof store.progress === "object" ? store.progress : {};
        const current = Array.isArray(progress[key]?.lessonIds) ? progress[key].lessonIds : [];
        const lessonIds = current.includes(lesson) ? current : [...current, lesson];

        progress[key] = { lessonIds, updatedAt: new Date().toISOString() };
        await writeJsonFileAtomic(PROGRESS_FILE, { progress });
        return lessonIds;
    });
}
