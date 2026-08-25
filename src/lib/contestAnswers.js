// Ответы участников на задания конкурса.
//
// Хранятся рядом с остальными файловыми данными МАЯКа: сам файл в
// data/contest-answers/<userId>/<lessonId>/, метаданные и текст — в
// data/contest-answers/index.json.
//
// ponytail: файловое хранилище, а не learning_service. У submissions есть
// только file_url на 500 символов — ни текста ответа, ни вложения туда не
// положить. Переезд в БД — вместе с полями track/trainer_* (docs/contest-core.md).

import path from "path";
import { promises as fs } from "fs";
import crypto from "crypto";

import { updateJsonFile, readJsonFile } from "@/lib/jsonFileLock";

const ANSWERS_ROOT = path.join(process.cwd(), "data", "contest-answers");
const ANSWERS_INDEX = path.join(ANSWERS_ROOT, "index.json");

export const MAX_ANSWER_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_ANSWER_TEXT_LENGTH = 20000;

function sanitizeSegment(value, fallback = "unknown") {
    const normalized = String(value || "").trim();
    if (!normalized) return fallback;
    return normalized.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function sanitizeFileName(value) {
    const normalized = String(value || "").trim() || "answer";
    // Оставляем расширение читаемым, но выкидываем всё, чем можно уйти вверх по дереву.
    return normalized.replace(/[\\/:*?"<>|]/g, "_").slice(-120);
}

export async function saveContestAnswer({ userId, lessonId, lessonNumber, text, file }) {
    const userSegment = sanitizeSegment(userId);
    const lessonSegment = sanitizeSegment(lessonId);
    const answerId = crypto.randomUUID();

    let storedFile = null;
    if (file?.filepath) {
        const targetDir = path.join(ANSWERS_ROOT, userSegment, lessonSegment);
        await fs.mkdir(targetDir, { recursive: true });

        const fileName = sanitizeFileName(file.originalFilename);
        const targetPath = path.join(targetDir, `${answerId}__${fileName}`);
        await fs.copyFile(file.filepath, targetPath);
        await fs.rm(file.filepath, { force: true }).catch(() => {});

        storedFile = {
            fileName,
            size: file.size || 0,
            contentType: file.mimetype || "application/octet-stream",
            storedPath: path.relative(process.cwd(), targetPath),
        };
    }

    const entry = {
        id: answerId,
        userId: String(userId),
        lessonId: Number(lessonId),
        lessonNumber: Number(lessonNumber) || null,
        text: String(text || "").slice(0, MAX_ANSWER_TEXT_LENGTH),
        file: storedFile,
        createdAt: new Date().toISOString(),
    };

    await updateJsonFile(ANSWERS_INDEX, { entries: [] }, (store) => {
        const entries = Array.isArray(store?.entries) ? store.entries : [];
        return { entries: [...entries, entry] };
    });

    return entry;
}

export async function listContestAnswers(userId, lessonId) {
    const store = await readJsonFile(ANSWERS_INDEX, { entries: [] });
    const entries = Array.isArray(store?.entries) ? store.entries : [];

    return entries.filter((entry) => {
        if (String(entry.userId) !== String(userId)) return false;
        if (lessonId !== undefined && Number(entry.lessonId) !== Number(lessonId)) return false;
        return true;
    });
}
