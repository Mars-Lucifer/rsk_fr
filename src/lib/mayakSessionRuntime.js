import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

import { completeMayakSession, getMayakSessionById } from "@/lib/mayakSessions";
import { readJsonFile, withJsonFileLock, writeJsonFileAtomic } from "@/lib/jsonFileLock";
import { convertToPdf, logLibreOffice } from "@/lib/libreofficeConverter";
import { pickRandomMissionForRole } from "@/lib/mayakSecretMissions";

const SESSION_RUNTIME_FILE = path.join(process.cwd(), "data", "mayak-session-runtime.json");
const SESSION_FILES_ROOT = path.join(process.cwd(), "data", "mayak-session-files");
const DEFAULT_REVIEW_TIMEOUT_SECONDS = 130;
const DEFAULT_REWORK_TIMEOUT_SECONDS = 180;
const PREVIEW_PROCESSING_TIMEOUT_MS = 90 * 1000;
const MAX_SESSION_UPLOAD_FILE_SIZE = 30 * 1024 * 1024;
export const INSPECTOR_ROLE = "\u0418\u043d\u0441\u043f\u0435\u043a\u0442\u043e\u0440";
const REVIEWER_ROLES = new Set([INSPECTOR_ROLE]);

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".avif"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".ogg"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx", ...IMAGE_EXTENSIONS, ...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS]);
const EXECUTABLE_EXTENSIONS = new Set([".exe", ".msi", ".bat", ".cmd", ".com", ".ps1", ".sh", ".js", ".jar", ".dll", ".scr", ".vbs"]);

function createEmptyStore() {
    return { sessions: {} };
}

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeTableNumber(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isReviewerRole(role) {
    return REVIEWER_ROLES.has(normalizeString(role));
}

function buildTaskKey(taskNumber) {
    return String(taskNumber || "").trim();
}

function getFileExtension(filename = "") {
    return path.extname(String(filename || "")).toLowerCase();
}

function ensureAllowedFile(filename = "", size = 0) {
    const ext = getFileExtension(filename);
    if (!ext || EXECUTABLE_EXTENSIONS.has(ext) || !ALLOWED_EXTENSIONS.has(ext)) {
        throw new Error("Р­С‚РѕС‚ С‚РёРї С„Р°Р№Р»Р° РЅРµР»СЊР·СЏ Р·Р°РіСЂСѓР¶Р°С‚СЊ РІ СЃРµСЃСЃРёРѕРЅРЅСѓСЋ РїСЂРѕРІРµСЂРєСѓ");
    }
    if (size > MAX_SESSION_UPLOAD_FILE_SIZE) {
        throw new Error("Р Р°Р·РјРµСЂ С„Р°Р№Р»Р° РЅРµ РґРѕР»Р¶РµРЅ РїСЂРµРІС‹С€Р°С‚СЊ 30 РњР‘");
    }
    return ext;
}

function getPreviewKindFromExtension(ext) {
    if (ext === ".pdf") return "pdf";
    if (IMAGE_EXTENSIONS.has(ext)) return "image";
    if (AUDIO_EXTENSIONS.has(ext)) return "audio";
    if (VIDEO_EXTENSIONS.has(ext)) return "video";
    return null;
}

function isOfficePreviewFileExtension(ext) {
    return ext === ".doc" || ext === ".docx" || ext === ".ppt" || ext === ".pptx";
}

function isReviewReadyForInspector(review) {
    const ext = review?.file?.extension || "";
    if (!isOfficePreviewFileExtension(ext)) return true;
    return review?.file?.previewStatus === "ready" || review?.file?.previewStatus === "failed";
}

function isStalePreviewProcessing(file) {
    if (!file || file.previewStatus !== "processing") return false;
    if (!file.previewProcessingStartedAt) return true;
    const startedAt = Date.parse(file.previewProcessingStartedAt);
    if (!Number.isFinite(startedAt)) return true;
    return Date.now() - startedAt > PREVIEW_PROCESSING_TIMEOUT_MS;
}

async function ensureStoreFile() {
    try {
        await fs.access(SESSION_RUNTIME_FILE);
    } catch {
        await fs.mkdir(path.dirname(SESSION_RUNTIME_FILE), { recursive: true });
        await fs.writeFile(SESSION_RUNTIME_FILE, JSON.stringify(createEmptyStore(), null, 2), "utf-8");
    }
}

async function readStore() {
    await ensureStoreFile();
    const parsed = await readJsonFile(SESSION_RUNTIME_FILE, createEmptyStore());
    return parsed && typeof parsed === "object" ? parsed : createEmptyStore();
}

async function writeStore(store, touchedSessionIds = null) {
    await fs.mkdir(path.dirname(SESSION_RUNTIME_FILE), { recursive: true });
    await withJsonFileLock(SESSION_RUNTIME_FILE, async () => {
        if (Array.isArray(touchedSessionIds)) {
            const latest = await readJsonFile(SESSION_RUNTIME_FILE, createEmptyStore());
            if (!latest.sessions || typeof latest.sessions !== "object") {
                latest.sessions = {};
            }
            for (const sessionId of touchedSessionIds) {
                if (store.sessions?.[sessionId]) {
                    latest.sessions[sessionId] = store.sessions[sessionId];
                } else {
                    delete latest.sessions[sessionId];
                }
            }
            await writeJsonFileAtomic(SESSION_RUNTIME_FILE, latest);
            return;
        }

        await writeJsonFileAtomic(SESSION_RUNTIME_FILE, store);
    });
}

// Атомарная мутация рантайма: весь read-modify-write выполняется под одним
// файловым локом (как в spendJokerStarAndApproveTask). Это устраняет гонку
// «прочитали снимок вне лока → потеряли чужие параллельные изменения».
// Колбэк получает (store, bucket), мутирует store на месте и возвращает
// результат; запись на диск делается один раз после колбэка. Если колбэк
// бросает исключение — файл не перезаписывается.
// ВНИМАНИЕ: лок НЕ реентерабельный — внутри mutator нельзя вызывать функции,
// которые сами берут лок (writeStore/expirePendingReviews). Для истечения
// ревью под локом используйте applyPendingReviewExpirations(bucket).
async function mutateSessionRuntime(sessionId, mutator) {
    await ensureStoreFile();
    return withJsonFileLock(SESSION_RUNTIME_FILE, async () => {
        const store = await readJsonFile(SESSION_RUNTIME_FILE, createEmptyStore());
        if (!store.sessions || typeof store.sessions !== "object") {
            store.sessions = {};
        }
        const bucket = ensureSessionBucket(store, sessionId);
        const result = await mutator(store, bucket);
        await writeJsonFileAtomic(SESSION_RUNTIME_FILE, store);
        return result;
    });
}

function ensureSessionBucket(store, sessionId) {
    if (!store.sessions[sessionId]) {
        store.sessions[sessionId] = {
            participants: {},
            reviews: {},
        };
    }
    return store.sessions[sessionId];
}

function getInspectorTargetTable(tableNumber, tableCount) {
    if (tableCount <= 1) return tableNumber;
    return tableNumber === tableCount ? 1 : tableNumber + 1;
}

function getReviewerTableForParticipant(tableNumber, tableCount) {
    if (tableCount <= 1) return tableNumber;
    return tableNumber === 1 ? tableCount : tableNumber - 1;
}

// Debug-сессия (вход по `fffff`): один стол, один участник-админ. Для неё
// послабляем правила ревью, чтобы полный цикл (сдача → проверка) проходился
// соло при ЛЮБОЙ роли — участник сам разбирает ревью своего стола.
function isDebugSession(session) {
    return String(session?.source || "") === "debug";
}

function getReviewTimeoutSeconds(session) {
    const parsed = parseInt(session?.reviewTimeoutSeconds, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REVIEW_TIMEOUT_SECONDS;
}

function getReworkTimeoutSeconds(session) {
    const parsed = parseInt(session?.reworkTimeoutSeconds, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REWORK_TIMEOUT_SECONDS;
}

function buildExpirationMeta(expiresAt) {
    if (!expiresAt) {
        return {
            expiresAt: null,
            remainingSeconds: 0,
        };
    }

    return {
        expiresAt,
        remainingSeconds: Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000)),
    };
}

function serializeStoredFile(sessionId, reviewId, file = {}) {
    if (!file?.storedName) return null;
    const inlineFilename = file.previewStoredName || file.storedName;
    const inlineType = file.previewStoredName ? "converted" : "original";
    return {
        originalName: file.originalName || "",
        size: file.size || 0,
        mimeType: file.mimeType || "",
        extension: file.extension || "",
        previewKind: file.previewKind || null,
        previewStatus: file.previewStatus || null,
        previewError: file.previewError || "",
        previewProcessingStartedAt: file.previewProcessingStartedAt || null,
        fileUrl: `/api/mayak/session-runtime/file?sessionId=${encodeURIComponent(sessionId)}&reviewId=${encodeURIComponent(reviewId)}&type=${inlineType}&filename=${encodeURIComponent(inlineFilename)}`,
        downloadUrl: `/api/mayak/session-runtime/file?sessionId=${encodeURIComponent(sessionId)}&reviewId=${encodeURIComponent(reviewId)}&type=original&download=1&filename=${encodeURIComponent(file.storedName)}`,
    };
}

function expireReviewIfNeeded(review, participant) {
    if (!review || review.status !== "pending" || !review.expiresAt) return false;
    const now = Date.now();
    if (Date.parse(review.expiresAt) > now) return false;

    review.status = "expired";
    review.resolvedAt = new Date(now).toISOString();
    review.resolutionComment = "";
    if (participant?.tasks?.[review.taskKey]) {
        participant.tasks[review.taskKey] = {
            ...participant.tasks[review.taskKey],
            status: "expired",
            isBlocking: false,
            reviewId: review.id,
            expiresAt: null,
            reworkExpiresAt: null,
            updatedAt: review.resolvedAt,
            comment: "",
        };
    }
    return true;
}

function expireReworkIfNeeded(taskState) {
    if (!taskState || taskState.status !== "rejected" || !taskState.reworkExpiresAt) return false;
    const now = Date.now();
    if (Date.parse(taskState.reworkExpiresAt) > now) return false;

    taskState.status = "rework_expired";
    taskState.isBlocking = false;
    taskState.reworkExpiresAt = null;
    taskState.expiresAt = null;
    taskState.updatedAt = new Date(now).toISOString();
    return true;
}

// Истечение ревью/доработок на месте, БЕЗ записи на диск. Безопасно вызывать
// под локом (внутри mutateSessionRuntime). Возвращает признак изменений.
function applyPendingReviewExpirations(bucket) {
    let changed = false;

    Object.values(bucket.reviews || {}).forEach((review) => {
        const participant = bucket.participants?.[review.participantUserId];
        if (expireReviewIfNeeded(review, participant)) {
            changed = true;
        }
    });

    Object.values(bucket.participants || {}).forEach((participant) => {
        Object.values(participant?.tasks || {}).forEach((taskState) => {
            if (expireReworkIfNeeded(taskState)) {
                changed = true;
            }
        });
    });

    return changed;
}

async function expirePendingReviews(store, sessionId) {
    const bucket = ensureSessionBucket(store, sessionId);
    const changed = applyPendingReviewExpirations(bucket);
    if (changed) {
        await writeStore(store, [sessionId]);
    }
    return changed;
}

function getBlockingTaskState(participant) {
    const taskStates = Object.values(participant?.tasks || {});
    const blocking = taskStates
        .filter((task) => task && task.isBlocking)
        .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return blocking[0] || null;
}

function serializeReviewSummary(sessionId, review) {
    const remainingMs = Math.max(0, Date.parse(review.expiresAt || 0) - Date.now());
    return {
        id: review.id,
        participantUserId: review.participantUserId,
        participantName: review.participantName,
        participantTableNumber: review.participantTableNumber,
        reviewerTableNumber: review.reviewerTableNumber,
        taskKey: review.taskKey,
        taskNumber: review.taskNumber,
        taskIndex: review.taskIndex,
        taskName: review.taskName,
        taskTitle: review.taskTitle,
        contentType: review.contentType,
        description: review.description,
        taskText: review.taskText,
        status: review.status,
        createdAt: review.createdAt,
        expiresAt: review.expiresAt,
        remainingSeconds: Math.ceil(remainingMs / 1000),
        durationSeconds: review.durationSeconds || DEFAULT_REVIEW_TIMEOUT_SECONDS,
        resolutionComment: review.resolutionComment || "",
        submissionText: review.submissionText || "",
        file: serializeStoredFile(sessionId, review.id, review.file),
    };
}

async function convertWordToPdf(sourcePath, targetDir) {
    return convertToPdf(sourcePath, targetDir);
}

export async function registerMayakSessionParticipant({ sessionId, userId, name, organization, tableNumber }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        throw new Error("РЎРµСЃСЃРёСЏ РЅРµРґРѕСЃС‚СѓРїРЅР° РёР»Рё СѓР¶Рµ Р·Р°РІРµСЂС€РµРЅР°");
    }

    const normalizedTableNumber = normalizeTableNumber(tableNumber);
    if (normalizedTableNumber < 1 || normalizedTableNumber > normalizeTableNumber(session.tableCount)) {
        throw new Error("Р’С‹Р±СЂР°РЅРЅС‹Р№ СЃС‚РѕР» РЅРµ РІС…РѕРґРёС‚ РІ РґРёР°РїР°Р·РѕРЅ Р°РєС‚РёРІРЅРѕР№ СЃРµСЃСЃРёРё");
    }

    const participantLimit = normalizeTableNumber(session.participantLimit);
    return mutateSessionRuntime(sessionId, (store, bucket) => {
        const existing = bucket.participants[userId] || {};
        if (!existing.userId && participantLimit > 0 && Object.keys(bucket.participants || {}).length >= participantLimit) {
            throw new Error("Лимит участников для этого токена исчерпан");
        }
        bucket.participants[userId] = {
            userId,
            name: normalizeString(name) || existing.name || "РЈС‡Р°СЃС‚РЅРёРє",
            organization: normalizeString(organization) || existing.organization || "",
            tableNumber: normalizedTableNumber,
            role: existing.role || "",
            inspectorTargetTable: existing.inspectorTargetTable || null,
            registeredAt: existing.registeredAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tasks: existing.tasks || {},
            // Сохраняем при повторной регистрации, иначе обнулятся прогресс
            // направления и счётчик потраченных звёзд-джокеров.
            yaDirection: existing.yaDirection || "",
            jokerSpent: Number(existing.jokerSpent) || 0,
            // Сохраняем выданную тайную миссию: «получить можно один раз»,
            // повторная регистрация не должна обнулять её.
            secretMission: existing.secretMission || null,
        };
        return bucket.participants[userId];
    });
}

export async function setMayakSessionParticipantRole({ sessionId, userId, role }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        throw new Error("\u0421\u0435\u0441\u0441\u0438\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u0438\u043b\u0438 \u0443\u0436\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430");
    }

    const normalizedRole = normalizeString(role);
    if (!normalizedRole) {
        throw new Error("\u041d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u0430 \u0440\u043e\u043b\u044c");
    }

    return mutateSessionRuntime(sessionId, (store, bucket) => {
        const participant = bucket.participants?.[userId];
        if (!participant) {
            throw new Error("\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a \u043d\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d \u0432 \u044d\u0442\u043e\u0439 \u0441\u0435\u0441\u0441\u0438\u0438");
        }

        if (isReviewerRole(normalizedRole)) {
            const takenByAnother = Object.values(bucket.participants || {}).find(
                (candidate) => candidate.userId !== userId && candidate.tableNumber === participant.tableNumber && candidate.role === normalizedRole
            );
            if (takenByAnother) {
                throw new Error(`\u0414\u043b\u044f \u0441\u0442\u043e\u043b\u0430 ${participant.tableNumber} \u0438\u043d\u0441\u043f\u0435\u043a\u0442\u043e\u0440 \u0443\u0436\u0435 \u0432\u044b\u0431\u0440\u0430\u043d`);
            }
            participant.inspectorTargetTable = getInspectorTargetTable(participant.tableNumber, normalizeTableNumber(session.tableCount));
        } else {
            participant.inspectorTargetTable = null;
        }

        // Защита от дурака: при смене роли старая тайная миссия (под прежнюю роль)
        // больше не актуальна — сбрасываем, чтобы под новую роль выдалась свежая.
        if (participant.role !== normalizedRole) {
            participant.secretMission = null;
        }

        participant.role = normalizedRole;
        participant.updatedAt = new Date().toISOString();
        return participant;
    });
}

// Выдаёт участнику тайную миссию из пула его роли (по явному запросу — кнопкой).
// «Получить можно только один раз»: если миссия уже выдана — возвращаем её без перевыбора.
export async function assignSecretMission({ sessionId, userId }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        throw new Error("Сессия недоступна или уже завершена");
    }

    return mutateSessionRuntime(sessionId, async (store, bucket) => {
        const participant = bucket.participants?.[userId];
        if (!participant) {
            throw new Error("Участник не зарегистрирован в этой сессии");
        }
        if (!normalizeString(participant.role)) {
            throw new Error("Сначала выберите роль");
        }
        if (participant.secretMission && participant.secretMission.text) {
            return participant.secretMission;
        }

        const mission = await pickRandomMissionForRole(participant.role);
        if (!mission) {
            throw new Error("Для вашей роли тайные миссии пока не заданы");
        }

        participant.secretMission = {
            id: mission.id,
            title: mission.title,
            text: mission.text,
            assignedAt: new Date().toISOString(),
        };
        participant.updatedAt = new Date().toISOString();
        return participant.secretMission;
    });
}

// Удаляет полный текст тайной миссии из объекта участника для дашборда/аналитики:
// оператор видит факт и название выданной миссии, но не её секретный текст.
function redactSecretMission(participant) {
    if (!participant?.secretMission) {
        return participant;
    }
    const { id, title, assignedAt } = participant.secretMission;
    return { ...participant, secretMission: { id, title: title || "", assignedAt: assignedAt || null } };
}

// Возвращает сырые объекты участников рантайма (включая карту tasks) для аналитики дашборда.
export async function readSessionRuntimeParticipants(sessionId) {
    const session = await getMayakSessionById(sessionId);
    if (!session) {
        throw new Error("Сессия не найдена");
    }
    const store = await readStore();
    await expirePendingReviews(store, sessionId);
    const freshStore = await readStore();
    const bucket = ensureSessionBucket(freshStore, sessionId);
    return Object.values(bucket.participants || {}).map((participant) => redactSecretMission({ ...participant }));
}

// Перемещает участника за другой стол (режим редактора дашборда).
export async function moveMayakSessionParticipantTable({ sessionId, userId, tableNumber }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        throw new Error("Сессия недоступна или уже завершена");
    }

    const totalTables = Math.max(1, normalizeTableNumber(session.tableCount) || 1);
    const targetTable = normalizeTableNumber(tableNumber);
    if (targetTable < 1 || targetTable > totalTables) {
        throw new Error("Недопустимый номер стола");
    }

    return mutateSessionRuntime(sessionId, (store, bucket) => {
        const participant = bucket.participants?.[userId];
        if (!participant) {
            throw new Error("Участник не зарегистрирован в этой сессии");
        }

        if (participant.tableNumber === targetTable) {
            return participant;
        }

        // Проверяем уникальность роли-ревьюера на новом столе.
        if (isReviewerRole(participant.role)) {
            const conflict = Object.values(bucket.participants || {}).find(
                (candidate) => candidate.userId !== userId && candidate.tableNumber === targetTable && candidate.role === participant.role
            );
            if (conflict) {
                throw new Error(`Для стола ${targetTable} такая роль уже занята`);
            }
        }

        participant.tableNumber = targetTable;
        participant.inspectorTargetTable = isReviewerRole(participant.role)
            ? getInspectorTargetTable(targetTable, totalTables)
            : null;
        participant.updatedAt = new Date().toISOString();
        return participant;
    });
}

export async function readSessionReviews(sessionId) {
    const store = await readStore();
    const bucket = store.sessions?.[sessionId] || { reviews: {} };
    return Object.values(bucket.reviews || {});
}

export async function listMayakSessionParticipants(sessionId) {
    const session = await getMayakSessionById(sessionId);
    if (!session) {
        throw new Error("Сессия не найдена");
    }

    const store = await readStore();
    await expirePendingReviews(store, sessionId);
    const freshStore = await readStore();
    const bucket = ensureSessionBucket(freshStore, sessionId);
    const tableCount = normalizeTableNumber(session.tableCount);

    return Object.values(bucket.participants || {})
        .sort((a, b) => {
            const tableDelta = (Number(a.tableNumber) || 0) - (Number(b.tableNumber) || 0);
            if (tableDelta !== 0) return tableDelta;
            return String(a.name || "").localeCompare(String(b.name || ""), "ru");
        })
        .map((participant) => {
            const blockingTask = getBlockingTaskState(participant);
            return {
                userId: participant.userId,
                name: participant.name || "",
                organization: participant.organization || "",
                tableNumber: participant.tableNumber || 0,
                role: participant.role || "",
                reviewerTargetTable: isReviewerRole(participant.role) ? getInspectorTargetTable(participant.tableNumber, tableCount) : null,
                registeredAt: participant.registeredAt || null,
                updatedAt: participant.updatedAt || null,
                blockingTask: blockingTask
                    ? {
                          taskNumber: blockingTask.taskNumber || "",
                          taskIndex: Number(blockingTask.taskIndex) || 0,
                          status: blockingTask.status || "",
                      }
                    : null,
            };
        });
}

export async function createMayakSessionReview({
    sessionId,
    userId,
    reviewId,
    taskNumber,
    taskIndex,
    taskName,
    taskTitle,
    contentType,
    description,
    taskText,
    secondsSpent,
    storedFile,
    submissionText,
}) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        throw new Error("РЎРµСЃСЃРёСЏ РЅРµРґРѕСЃС‚СѓРїРЅР° РёР»Рё СѓР¶Рµ Р·Р°РІРµСЂС€РµРЅР°");
    }

    const taskKey = buildTaskKey(taskNumber);
    if (!taskKey) {
        throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РЅРѕРјРµСЂ Р·Р°РґР°РЅРёСЏ РґР»СЏ РїСЂРѕРІРµСЂРєРё");
    }

    return mutateSessionRuntime(sessionId, (store, bucket) => {
        applyPendingReviewExpirations(bucket);

        const participant = bucket.participants[userId];
        if (!participant) {
            throw new Error("РЈС‡Р°СЃС‚РЅРёРє РЅРµ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅ РІ СЌС‚РѕР№ СЃРµСЃСЃРёРё");
        }

        const existingTaskState = participant.tasks?.[taskKey];
        if (existingTaskState?.status === "pending_review" && existingTaskState?.isBlocking) {
            throw new Error("Р­С‚Рѕ Р·Р°РґР°РЅРёРµ СѓР¶Рµ РѕС‚РїСЂР°РІР»РµРЅРѕ РёРЅСЃРїРµРєС‚РѕСЂСѓ Рё Р¶РґС‘С‚ РїСЂРѕРІРµСЂРєРё");
        }

        const createdAt = new Date().toISOString();
        const nextReviewId = normalizeString(reviewId) || crypto.randomUUID();
        const reviewerTableNumber = getReviewerTableForParticipant(participant.tableNumber, normalizeTableNumber(session.tableCount));
        const reviewDurationSeconds = getReviewTimeoutSeconds(session);
        const review = {
            id: nextReviewId,
            sessionId,
            participantUserId: participant.userId,
            participantName: participant.name,
            participantTableNumber: participant.tableNumber,
            reviewerTableNumber,
            taskKey,
            taskNumber: normalizeString(taskNumber),
            taskIndex: Number.isFinite(taskIndex) ? taskIndex : 0,
            taskName: normalizeString(taskName) || `Задание ${taskNumber}`,
            taskTitle: normalizeString(taskTitle),
            contentType: normalizeString(contentType),
            description: normalizeString(description),
            taskText: normalizeString(taskText),
            secondsSpent: Number.isFinite(secondsSpent) ? secondsSpent : 0,
            submissionText: normalizeString(submissionText).slice(0, 10000),
            file: storedFile,
            createdAt,
            durationSeconds: reviewDurationSeconds,
            expiresAt: new Date(Date.now() + reviewDurationSeconds * 1000).toISOString(),
            status: "pending",
            resolutionComment: "",
            resolvedAt: null,
        };

        bucket.reviews[nextReviewId] = review;
        participant.tasks[taskKey] = {
            taskKey,
            taskNumber: normalizeString(taskNumber),
            taskIndex: Number.isFinite(taskIndex) ? taskIndex : 0,
            taskName: review.taskName,
            status: "pending_review",
            reviewId: nextReviewId,
            isBlocking: true,
            expiresAt: review.expiresAt,
            reworkExpiresAt: null,
            durationSeconds: reviewDurationSeconds,
            comment: "",
            updatedAt: createdAt,
        };
        participant.updatedAt = createdAt;
        return serializeReviewSummary(sessionId, review);
    });
}

export async function resolveMayakSessionReview({ sessionId, reviewId, inspectorUserId, action, comment }) {
    const session = await getMayakSessionById(sessionId);

    return mutateSessionRuntime(sessionId, (store, bucket) => {
        applyPendingReviewExpirations(bucket);

        const review = bucket.reviews?.[reviewId];
        if (!review) {
            throw new Error("Р—Р°СЏРІРєР° РЅР° РїСЂРѕРІРµСЂРєСѓ РЅРµ РЅР°Р№РґРµРЅР°");
        }
        if (review.status !== "pending") {
            throw new Error("Р­С‚Р° Р·Р°СЏРІРєР° СѓР¶Рµ РѕР±СЂР°Р±РѕС‚Р°РЅР°");
        }

        const inspector = bucket.participants?.[inspectorUserId];
        const debugSession = isDebugSession(session);
        if (!inspector || (!debugSession && !isReviewerRole(inspector.role))) {
            throw new Error("РџСЂРѕРІРµСЂРєСѓ РјРѕР¶РµС‚ РІС‹РїРѕР»РЅРёС‚СЊ С‚РѕР»СЊРєРѕ РёРЅСЃРїРµРєС‚РѕСЂ");
        }
        if (!debugSession && inspector.inspectorTargetTable !== review.participantTableNumber) {
            throw new Error("Р­С‚РѕС‚ РёРЅСЃРїРµРєС‚РѕСЂ РЅРµ Р·Р°РєСЂРµРїР»С‘РЅ Р·Р° РІС‹Р±СЂР°РЅРЅС‹Рј СЃС‚РѕР»РѕРј");
        }

        const participant = bucket.participants?.[review.participantUserId];
        if (!participant) {
            throw new Error("РЈС‡Р°СЃС‚РЅРёРє РїСЂРѕРІРµСЂРєРё РЅРµ РЅР°Р№РґРµРЅ");
        }

        const normalizedAction = normalizeString(action);
        const normalizedComment = normalizeString(comment);
        if (normalizedAction === "reject" && !normalizedComment) {
            throw new Error("РџСЂРё РѕС‚РєР»РѕРЅРµРЅРёРё РЅСѓР¶РЅРѕ СѓРєР°Р·Р°С‚СЊ РїСЂРёС‡РёРЅСѓ");
        }

        const resolvedAt = new Date().toISOString();
        const isApproved = normalizedAction === "approve";
        const reworkDurationSeconds = getReworkTimeoutSeconds(session);
        const reworkExpiresAt = isApproved ? null : new Date(Date.now() + reworkDurationSeconds * 1000).toISOString();
        review.status = isApproved ? "approved" : "rejected";
        review.resolutionComment = normalizedComment;
        review.resolvedAt = resolvedAt;
        participant.tasks[review.taskKey] = {
            ...(participant.tasks[review.taskKey] || {}),
            taskKey: review.taskKey,
            taskNumber: review.taskNumber,
            taskIndex: review.taskIndex,
            taskName: review.taskName,
            reviewId,
            updatedAt: resolvedAt,
            comment: normalizedComment,
            status: isApproved ? "approved" : "rejected",
            isBlocking: !isApproved,
            expiresAt: null,
            reworkExpiresAt,
            durationSeconds: isApproved ? null : reworkDurationSeconds,
        };
        participant.updatedAt = resolvedAt;
        return serializeReviewSummary(sessionId, review);
    });
}

export async function getMayakSessionRuntimeState({ sessionId, userId }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        return {
            sessionActive: false,
            participant: null,
            blockingTask: null,
            inspectorQueue: [],
        };
    }

    const store = await readStore();
    await expirePendingReviews(store, sessionId);
    const freshStore = await readStore();
    const bucket = ensureSessionBucket(freshStore, sessionId);
    Object.values(bucket.reviews || {}).forEach((review) => {
        const isOfficePreviewFile = isOfficePreviewFileExtension(review?.file?.extension || "");
        if (review?.file?.previewStatus === "pending" && isOfficePreviewFile) {
            void startMayakSessionBackgroundPreviewConversion({ sessionId, reviewId: review.id }).catch(() => {});
        } else if (isStalePreviewProcessing(review?.file) && isOfficePreviewFile) {
            void startMayakSessionBackgroundPreviewConversion({ sessionId, reviewId: review.id }).catch(() => {});
        }
    });
    const participant = bucket.participants?.[userId] || null;

    if (!participant) {
        return {
            sessionActive: true,
            participant: null,
            blockingTask: null,
            inspectorQueue: [],
        };
    }

    const blockingTask = getBlockingTaskState(participant);
    // В debug-сессии (соло, 1 стол) очередь видна при любой роли: целевой стол
    // проверки = собственный стол участника, иначе — закреплённый стол инспектора.
    const debugSession = isDebugSession(session);
    const queueTargetTable = participant.inspectorTargetTable || (debugSession ? participant.tableNumber : null);
    const inspectorQueue =
        queueTargetTable && (debugSession || isReviewerRole(participant.role))
            ? Object.values(bucket.reviews || {})
                  .filter((review) => review.status === "pending" && review.participantTableNumber === queueTargetTable)
                  .filter((review) => isReviewReadyForInspector(review))
                  .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
                  .map((review) => serializeReviewSummary(sessionId, review))
            : [];

    const taskStates = Object.values(participant.tasks || {})
        .sort((a, b) => (Number(a.taskIndex) || 0) - (Number(b.taskIndex) || 0))
        .map((task) => ({
            taskKey: task.taskKey,
            taskNumber: task.taskNumber,
            taskIndex: task.taskIndex,
            status: task.status,
            comment: task.comment || "",
            isBlocking: Boolean(task.isBlocking),
            reviewId: task.reviewId || null,
            updatedAt: task.updatedAt || null,
        }));

    const tableDirections = Object.values(bucket.participants || {})
        .filter((p) => p.userId !== userId && p.tableNumber === participant.tableNumber && p.yaDirection)
        .map((p) => String(p.yaDirection).trim().toLowerCase());

    return {
        sessionActive: true,
        participant: {
            ...participant,
            sectionId: session.sectionId,
            tasks: undefined,
            taskStates,
        },
        tableDirections,
        blockingTask: blockingTask
            ? {
                  taskKey: blockingTask.taskKey,
                  taskNumber: blockingTask.taskNumber,
                  taskIndex: blockingTask.taskIndex,
                  status: blockingTask.status,
                  comment: blockingTask.comment || "",
                  reviewId: blockingTask.reviewId || null,
                  durationSeconds: blockingTask.durationSeconds || bucket.reviews?.[blockingTask.reviewId]?.durationSeconds || 0,
                  ...buildExpirationMeta(blockingTask.status === "pending_review" ? blockingTask.expiresAt || bucket.reviews?.[blockingTask.reviewId]?.expiresAt || null : blockingTask.reworkExpiresAt || null),
              }
            : null,
        inspectorQueue,
    };
}

export async function saveMayakSessionUploadFile({ sessionId, userId, reviewId, file }) {
    const originalName = normalizeString(file?.originalFilename) || "file";
    const size = Number(file?.size) || 0;
    const extension = ensureAllowedFile(originalName, size);

    const userDir = path.join(SESSION_FILES_ROOT, sessionId, userId);
    await fs.mkdir(userDir, { recursive: true });

    const storedName = `${reviewId}${extension}`;
    const targetPath = path.join(userDir, storedName);
    await fs.copyFile(file.filepath, targetPath);
    await fs.rm(file.filepath, { force: true });

    let previewStoredName = null;
    let previewKind = getPreviewKindFromExtension(extension);
    let previewStatus = previewKind ? "ready" : null;
    let previewError = "";

    if (extension === ".doc" || extension === ".docx" || extension === ".ppt" || extension === ".pptx") {
        previewStatus = "pending";
    }

    return {
        originalName,
        storedName,
        previewStoredName,
        size,
        extension,
        mimeType: normalizeString(file?.mimetype),
        previewKind,
        previewStatus,
        previewError,
        previewProcessingStartedAt: null,
    };
}

export async function getMayakSessionReviewFile({ sessionId, reviewId, type, filename }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        throw new Error("Сессия недоступна или уже завершена");
    }

    const store = await readStore();
    const bucket = ensureSessionBucket(store, sessionId);
    const review = bucket.reviews?.[reviewId];
    if (!review?.file) {
        throw new Error("Файл проверки не найден");
    }

    const selectedName = type === "converted" ? review.file.previewStoredName : review.file.storedName;
    if (!selectedName || selectedName !== filename) {
        throw new Error("Файл проверки не найден");
    }

    const fullPath = path.join(SESSION_FILES_ROOT, sessionId, review.participantUserId, selectedName);
    await fs.access(fullPath);
    return {
        fullPath,
        file: review.file,
    };
}

export async function cleanupMayakSessionRuntime(sessionId) {
    const store = await readStore();
    if (store.sessions?.[sessionId]) {
        delete store.sessions[sessionId];
        await writeStore(store, [sessionId]);
    }
    await fs.rm(path.join(SESSION_FILES_ROOT, sessionId), { recursive: true, force: true });
}

export async function completeMayakSessionWithRuntimeCleanup(sessionId) {
    const completedSession = await completeMayakSession(sessionId);
    await cleanupMayakSessionRuntime(sessionId);
    return completedSession;
}


export async function startMayakSessionBackgroundPreviewConversion({ sessionId, reviewId }) {
    const store = await readStore();
    const bucket = ensureSessionBucket(store, sessionId);
    const review = bucket.reviews?.[reviewId];
    const file = review?.file;
    if (!review || !file?.storedName) return false;
    if (!(file.extension === ".doc" || file.extension === ".docx" || file.extension === ".ppt" || file.extension === ".pptx")) return false;
    if (file.previewStoredName) return false;
    if (file.previewStatus === "processing" && !isStalePreviewProcessing(file)) return false;

    file.previewStatus = "processing";
    file.previewError = "";
    file.previewProcessingStartedAt = new Date().toISOString();
    logLibreOffice("background-preview-start", {
        sessionId,
        reviewId,
        storedName: file.storedName,
        previewStatus: file.previewStatus,
    });
    await writeStore(store, [sessionId]);

    try {
        const userDir = path.join(SESSION_FILES_ROOT, sessionId, review.participantUserId);
        const sourcePath = path.join(userDir, file.storedName);
        const pdfPath = await convertWordToPdf(sourcePath, userDir);

        const freshStore = await readStore();
        const freshBucket = ensureSessionBucket(freshStore, sessionId);
        const freshReview = freshBucket.reviews?.[reviewId];
        if (!freshReview?.file) return false;

        freshReview.file.previewStoredName = path.basename(pdfPath);
        freshReview.file.previewKind = "pdf";
        freshReview.file.previewStatus = "ready";
        freshReview.file.previewError = "";
        freshReview.file.previewProcessingStartedAt = null;
        await writeStore(freshStore, [sessionId]);
        logLibreOffice("background-preview-success", {
            sessionId,
            reviewId,
            previewStoredName: freshReview.file.previewStoredName,
        });
        return true;
    } catch (error) {
        const freshStore = await readStore();
        const freshBucket = ensureSessionBucket(freshStore, sessionId);
        const freshReview = freshBucket.reviews?.[reviewId];
        if (freshReview?.file) {
            freshReview.file.previewKind = null;
            freshReview.file.previewStatus = "failed";
            freshReview.file.previewError = error.message || "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u0438\u0442\u044c \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0444\u0430\u0439\u043b\u0430.";
            freshReview.file.previewProcessingStartedAt = null;
            await writeStore(freshStore, [sessionId]);
        }
        logLibreOffice("background-preview-failed", {
            sessionId,
            reviewId,
            message: error?.message || "Unknown background preview error",
        });
        return false;
    }
}

export async function setMayakSessionParticipantYaDirection({ sessionId, userId, direction }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        throw new Error("Сессия недоступна или уже завершена");
    }

    const normalizedDirection = String(direction || "").trim().toLowerCase();
    return mutateSessionRuntime(sessionId, (store, bucket) => {
        const participant = bucket.participants?.[userId];
        if (!participant) {
            throw new Error("Участник не зарегистрирован в этой сессии");
        }

        if (normalizedDirection) {
            const takenByAnother = Object.values(bucket.participants || {}).find(
                (candidate) =>
                    candidate.userId !== userId &&
                    candidate.tableNumber === participant.tableNumber &&
                    String(candidate.yaDirection || "").trim().toLowerCase() === normalizedDirection
            );
            if (takenByAnother) {
                throw new Error(`Направление "${direction}" уже выбрано другим участником за вашим столом (${takenByAnother.name}).`);
            }
        }

        participant.yaDirection = direction;
        participant.updatedAt = new Date().toISOString();
        return participant;
    });
}

export async function autoApproveMayakSessionTask({ sessionId, userId, taskNumber, taskIndex, taskName }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        throw new Error("Сессия недоступна или уже завершена");
    }

    const taskKey = buildTaskKey(taskNumber);
    if (!taskKey) {
        throw new Error("Не удалось определить номер задания");
    }

    return mutateSessionRuntime(sessionId, (store, bucket) => {
        const participant = bucket.participants?.[userId];
        if (!participant) {
            throw new Error("Участник не зарегистрирован в этой сессии");
        }

        const createdAt = new Date().toISOString();
        participant.tasks[taskKey] = {
            taskKey,
            taskNumber: normalizeString(taskNumber),
            taskIndex: Number.isFinite(taskIndex) ? taskIndex : 0,
            taskName: normalizeString(taskName) || `Задание ${taskNumber}`,
            status: "approved",
            reviewId: null,
            isBlocking: false,
            expiresAt: null,
            reworkExpiresAt: null,
            durationSeconds: 0,
            comment: "",
            updatedAt: createdAt,
        };
        participant.updatedAt = createdAt;
        return participant.tasks[taskKey];
    });
}

// Атомарный расход звезды-джокера: уменьшает баланс и мгновенно одобряет
// задание части «Мы» без инспектора (status "approved", viaJoker:true).
// earnedJokerStars вычисляется вызывающим (роутом) по прогрессу «Я».
// Весь read-modify-write обёрнут в один withJsonFileLock: при двух
// одновременных нажатиях второй увидит увеличенный jokerSpent и получит отказ.
export async function spendJokerStarAndApproveTask({ sessionId, userId, taskNumber, taskIndex, taskName, earnedJokerStars }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        throw new Error("Сессия недоступна или уже завершена");
    }
    const taskKey = buildTaskKey(taskNumber);
    if (!taskKey) {
        throw new Error("Не удалось определить номер задания");
    }

    return await withJsonFileLock(SESSION_RUNTIME_FILE, async () => {
        const store = await readJsonFile(SESSION_RUNTIME_FILE, createEmptyStore());
        const bucket = ensureSessionBucket(store, sessionId);
        const participant = bucket.participants?.[userId];
        if (!participant) {
            throw new Error("Участник не зарегистрирован в этой сессии");
        }

        const spent = Number(participant.jokerSpent) || 0;
        const earned = Number(earnedJokerStars) || 0;
        if (earned - spent < 1) {
            throw new Error("Нет доступных звёзд-джокеров");
        }

        const createdAt = new Date().toISOString();
        participant.jokerSpent = spent + 1;
        participant.tasks[taskKey] = {
            taskKey,
            taskNumber: normalizeString(taskNumber),
            taskIndex: Number.isFinite(taskIndex) ? taskIndex : 0,
            taskName: normalizeString(taskName) || `Задание ${taskNumber}`,
            status: "approved",
            reviewId: null,
            isBlocking: false,
            expiresAt: null,
            reworkExpiresAt: null,
            durationSeconds: 0,
            comment: "Одобрено звездой-джокером",
            viaJoker: true,
            updatedAt: createdAt,
        };
        participant.updatedAt = createdAt;
        await writeJsonFileAtomic(SESSION_RUNTIME_FILE, store);
        return {
            jokerBalance: earned - participant.jokerSpent,
            taskState: participant.tasks[taskKey],
        };
    });
}



