import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

import { completeMayakSession, getMayakSessionById } from "@/lib/mayakSessions";
import { readJsonFile, withJsonFileLock, writeJsonFileAtomic } from "@/lib/jsonFileLock";
import { convertToPdf, logLibreOffice } from "@/lib/libreofficeConverter";
import { pickRandomMissionForRole } from "@/lib/mayakSecretMissions";
import { isDay2Section, DAY2_TABLE_NAMES } from "@/lib/mayakDay2Mode";
import { day2KeysFor } from "@/lib/mayakDay2Takt";
import {
    DAY2_FIRST_TAKT,
    DAY2_LAST_TAKT,
    clampDay2TaktSeconds,
    day2DefaultSeconds,
    day2TaktStatus,
} from "@/lib/mayakDay2Schedule";

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

// Второй день: номер тайла, который человек держит в руках. Это не
// идентификатор, а координата в сборке — десяток задаёт стол, позиция задаёт
// луч и партнёра по паре. Рабочих номеров восемнадцать: 11-16, 21-26, 31-36.
// Центры 10, 20, 30 — место сборки стола, их в руки не берут.
function normalizeDay2CardNumber(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        return 0;
    }
    const tens = Math.floor(parsed / 10);
    const position = parsed % 10;
    return tens >= 1 && tens <= 3 && position >= 1 && position <= 6 ? parsed : 0;
}

// Партнёр по паре: 11+12, 13+14, 15+16, одинаково на всех трёх столах.
// Партнёрство напечатано на картоне — сборка сессии его не выбирает, а получает
// как данность, и сервер считает его из номера, а не хранит отдельно.
function day2PartnerNumber(cardNumber) {
    const number = normalizeDay2CardNumber(cardNumber);
    return number ? day2KeysFor(number).partner : 0;
}

// Такт зала лежит в бакете сессии, а не в объекте сессии: он меняется по ходу
// дня, а объект сессии — это её настройка. Читается с дефолтом, поэтому сессии,
// уже лежащие на диске, не требуют миграции: у них такт просто не начат.
function readDay2Takt(bucket) {
    const stored = bucket?.day2Takt;
    return {
        index: Number(stored?.index) || DAY2_FIRST_TAKT,
        startedAt: stored?.startedAt || null,
        durationSeconds: Number(stored?.durationSeconds) || day2DefaultSeconds(Number(stored?.index) || DAY2_FIRST_TAKT),
    };
}

function getFileExtension(filename = "") {
    return path.extname(String(filename || "")).toLowerCase();
}

function ensureAllowedFile(filename = "", size = 0) {
    const ext = getFileExtension(filename);
    if (!ext || EXECUTABLE_EXTENSIONS.has(ext) || !ALLOWED_EXTENSIONS.has(ext)) {
        throw new Error("Этот тип файла нельзя загружать в сессионную проверку");
    }
    if (size > MAX_SESSION_UPLOAD_FILE_SIZE) {
        throw new Error("Размер файла не должен превышать 30 МБ");
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
        participantCardNumber: review.participantCardNumber || null,
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
        throw new Error("Сессия недоступна или уже завершена");
    }

    const normalizedTableNumber = normalizeTableNumber(tableNumber);
    if (normalizedTableNumber < 1 || normalizedTableNumber > normalizeTableNumber(session.tableCount)) {
        throw new Error("Выбранный стол не входит в диапазон активной сессии");
    }

    const participantLimit = normalizeTableNumber(session.participantLimit);
    return mutateSessionRuntime(sessionId, (store, bucket) => {
        const existing = bucket.participants[userId] || {};
        if (!existing.userId && participantLimit > 0 && Object.keys(bucket.participants || {}).length >= participantLimit) {
            throw new Error("Лимит участников для этого токена исчерпан");
        }
        bucket.participants[userId] = {
            userId,
            name: normalizeString(name) || existing.name || "Участник",
            organization: normalizeString(organization) || existing.organization || "",
            tableNumber: normalizedTableNumber,
            role: existing.role || "",
            inspectorTargetTable: existing.inspectorTargetTable || null,
            // Номер тайла второго дня. У сессий, которые уже лежат на диске,
            // поля нет — дефолт обязателен, иначе ensureSessionBucket отдаст
            // undefined и участник во втором дне окажется без стола.
            cardNumber: existing.cardNumber || null,
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

/**
 * Второй день: закрепить за участником номер его тайла.
 *
 * До этого номер жил только в состоянии вкладки: человек называл его сам первым
 * набором, и проверка «это чужой стол» сравнивала его выбор с его же выбором.
 * Стол, партнёр по паре и содержимое командного экрана считаются из номера,
 * поэтому он обязан лежать на сервере.
 */
export async function setMayakSessionParticipantCardNumber({ sessionId, userId, cardNumber }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        throw new Error("Сессия недоступна или уже завершена");
    }
    if (!isDay2Section(session.sectionId)) {
        throw new Error("Номер тайла есть только во втором дне");
    }

    const number = normalizeDay2CardNumber(cardNumber);
    if (!number) {
        throw new Error("Такого тайла нет. Номера идут 11–16, 21–26, 31–36");
    }

    const debugSession = isDebugSession(session);

    return mutateSessionRuntime(sessionId, (store, bucket) => {
        const participant = bucket.participants?.[userId];
        if (!participant) {
            throw new Error("Участник не зарегистрирован в этой сессии");
        }
        if (participant.cardNumber === number) {
            return participant;
        }

        // Сменить номер можно, пока по нему ничего не сдано. Иначе такт
        // пересчитается по чужой истории, и человек окажется в третьем такте,
        // не сделав ни одной детали.
        if (participant.cardNumber && Object.keys(participant.tasks || {}).length) {
            throw new Error("Номер уже нельзя сменить: по нему есть сданные задания");
        }

        // Стол задаёт тайл, а не выбор на входе: на столе лежат только свои шесть
        // номеров, взять чужой можно лишь встав из-за стола. В debug-сессии стол
        // один, и это ограничение сделало бы её непроходимой — там оно снято,
        // ровно как снят запрет на чужую проверку.
        const table = Math.floor(number / 10);
        if (!debugSession && table !== normalizeTableNumber(participant.tableNumber)) {
            throw new Error(`Тайл ${number} лежит на столе ${table}, а вы за столом ${participant.tableNumber}`);
        }

        const takenByAnother = Object.values(bucket.participants || {}).find(
            (candidate) => candidate.userId !== userId && candidate.cardNumber === number
        );
        if (takenByAnother) {
            throw new Error(`Тайл ${number} уже взят за этим столом`);
        }

        participant.cardNumber = number;
        participant.updatedAt = new Date().toISOString();
        return participant;
    });
}

/**
 * Пульт ведущего: такт зала.
 *
 * Время такта задаёт сервер, участники его только показывают. Иначе три
 * команды разойдутся на минуты, а к финалу — на четверть часа, и на сборке всё
 * равно будут ждать друг друга (ТЗ, раздел В10).
 *
 * Действия ровно четыре, и все нажимает человек:
 *   start — запустить текущий такт от сейчас;
 *   next  — перейти к следующему и запустить его;
 *   shift — прибавить или убавить минут текущему такту, пересчитав остаток;
 *   stop  — снять запуск, оставив номер такта (перерыв, эвакуация, что угодно).
 */
export async function controlDay2Takt({ sessionId, action, minutes }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        throw new Error("Сессия недоступна или уже завершена");
    }
    if (!isDay2Section(session.sectionId)) {
        throw new Error("Такты есть только во втором дне");
    }

    const normalizedAction = normalizeString(action);
    return mutateSessionRuntime(sessionId, (store, bucket) => {
        const current = readDay2Takt(bucket);
        const now = new Date().toISOString();

        if (normalizedAction === "start") {
            bucket.day2Takt = { ...current, startedAt: now };
        } else if (normalizedAction === "next") {
            if (current.index >= DAY2_LAST_TAKT) {
                throw new Error("Это последний такт дня");
            }
            const index = current.index + 1;
            bucket.day2Takt = { index, startedAt: now, durationSeconds: day2DefaultSeconds(index) };
        } else if (normalizedAction === "shift") {
            const delta = Math.round(Number(minutes));
            if (!Number.isFinite(delta) || delta === 0) {
                throw new Error("Сдвиг задаётся в минутах");
            }
            bucket.day2Takt = {
                ...current,
                durationSeconds: clampDay2TaktSeconds(current.durationSeconds + delta * 60),
            };
        } else if (normalizedAction === "stop") {
            bucket.day2Takt = { ...current, startedAt: null };
        } else {
            throw new Error("Неизвестное действие с тактом");
        }

        return day2TaktStatus(bucket.day2Takt, Date.now());
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

// Удаляет участника из активной сессии (режим редактора дашборда): убирает его
// из рантайма вместе с его заявками на проверку. Слот токена освобождается
// автоматически (лимит считается по числу участников). На устройстве участника
// тренажёр при следующем поллинге увидит participant=null и завершит сессию.
export async function removeMayakSessionParticipant({ sessionId, userId }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        throw new Error("Сессия недоступна или уже завершена");
    }

    const normalizedUserId = String(userId || "");
    if (!normalizedUserId) {
        throw new Error("Не указан участник");
    }

    return mutateSessionRuntime(sessionId, (store, bucket) => {
        if (!bucket.participants?.[normalizedUserId]) {
            throw new Error("Участник не зарегистрирован в этой сессии");
        }
        delete bucket.participants[normalizedUserId];
        // Чистим его заявки на проверку, чтобы они не висели в очереди инспектора.
        if (bucket.reviews) {
            for (const reviewId of Object.keys(bucket.reviews)) {
                if (bucket.reviews[reviewId]?.participantUserId === normalizedUserId) {
                    delete bucket.reviews[reviewId];
                }
            }
        }
        return { userId: normalizedUserId, removed: true };
    });
}

// Скрывает/показывает участника в дашборде (режим редактора). В отличие от
// removeMayakSessionParticipant НЕ трогает данные: тренажёр скрытого работает
// как обычно (getMayakSessionRuntimeState флаг hidden не смотрит), прогресс и
// заявки сохраняются. Дашборд исключает hidden из столов/средних/звёзд/времён
// (фильтр в mayakSessionDashboard), поэтому админ может скрыть себя, не искажая
// метрики; сняв флаг — вернуть с уже накопленным прогрессом.
export async function setMayakSessionParticipantHidden({ sessionId, userId, hidden }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        throw new Error("Сессия недоступна или уже завершена");
    }

    const normalizedUserId = String(userId || "");
    if (!normalizedUserId) {
        throw new Error("Не указан участник");
    }

    return mutateSessionRuntime(sessionId, (store, bucket) => {
        const participant = bucket.participants?.[normalizedUserId];
        if (!participant) {
            throw new Error("Участник не зарегистрирован в этой сессии");
        }
        participant.hidden = Boolean(hidden);
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
        throw new Error("Сессия недоступна или уже завершена");
    }

    const taskKey = buildTaskKey(taskNumber);
    if (!taskKey) {
        throw new Error("Не удалось определить номер задания для проверки");
    }

    return mutateSessionRuntime(sessionId, (store, bucket) => {
        applyPendingReviewExpirations(bucket);

        const participant = bucket.participants[userId];
        if (!participant) {
            throw new Error("Участник не зарегистрирован в этой сессии");
        }

        // Второй день: сдать можно только СВОИ четыре ключа — деталь, узел,
        // переходник и изделие своего стола. Ворота на клиенте (canOpenDay2)
        // отговаривают, но запрос в обход экрана они не остановят, а чужая
        // сдача сломает и такт соседа, и очередь его партнёра.
        //
        // Это же и есть ограничение по столу из ТЗ (раздел В9): стол закодирован
        // в самом номере, поэтому проверять достаточно принадлежность ключа.
        if (isDay2Section(session.sectionId)) {
            const own = normalizeDay2CardNumber(participant.cardNumber);
            if (!own) {
                throw new Error("Сначала наберите номер своего тайла");
            }
            const keys = day2KeysFor(own);
            const allowed = new Set([keys.detail, keys.node, keys.adapter, keys.assembly]);
            if (!allowed.has(taskKey)) {
                throw new Error(`Задание ${taskKey} не ваше: ваш тайл ${own}`);
            }
        }

        const existingTaskState = participant.tasks?.[taskKey];
        if (existingTaskState?.status === "pending_review" && existingTaskState?.isBlocking) {
            throw new Error("Это задание уже отправлено инспектору и ждёт проверки");
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
            // Второй день адресует проверку не столу, а партнёру по паре, и
            // номер должен лежать в самой заявке: участник может к моменту
            // разбора уже уйти дальше по такту.
            participantCardNumber: participant.cardNumber || null,
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
            throw new Error("Заявка на проверку не найдена");
        }
        if (review.status !== "pending") {
            throw new Error("Эта заявка уже обработана");
        }

        const inspector = bucket.participants?.[inspectorUserId];
        const debugSession = isDebugSession(session);
        if (!inspector) {
            throw new Error("Проверку может выполнить только инспектор");
        }
        // Второй день меняет не механику проверки, а её смысл: шов смотрит не
        // назначенный инспектор, а партнёр по паре — тот, с чьей частью этот шов
        // обязан сойтись (ТЗ, раздел В4). Роли во втором дне нет вообще.
        if (!debugSession) {
            if (isDay2Section(session?.sectionId)) {
                const partner = day2PartnerNumber(inspector.cardNumber);
                if (!partner || partner !== normalizeDay2CardNumber(review.participantCardNumber)) {
                    throw new Error("Эту работу проверяет партнёр по паре");
                }
            } else {
                if (!isReviewerRole(inspector.role)) {
                    throw new Error("Проверку может выполнить только инспектор");
                }
                if (inspector.inspectorTargetTable !== review.participantTableNumber) {
                    throw new Error("Этот инспектор не закреплён за выбранным столом");
                }
            }
        }

        const participant = bucket.participants?.[review.participantUserId];
        if (!participant) {
            throw new Error("Участник проверки не найден");
        }

        const normalizedAction = normalizeString(action);
        const normalizedComment = normalizeString(comment);
        if (normalizedAction === "reject" && !normalizedComment) {
            throw new Error("При отклонении нужно указать причину");
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
    // Кого этот участник проверяет.
    //
    // Первый день: назначенного инспектора закрепляют за соседним столом.
    // Второй день: роли нет, шов смотрит партнёр по паре — тот, с чьей частью
    // он обязан сойтись (ТЗ, раздел В4).
    // В debug-сессии (соло, один стол) оба правила сняты: очередь видна при
    // любой роли и равна собственному столу, иначе соло-прогон не пройти.
    const debugSession = isDebugSession(session);
    const day2Session = isDay2Section(session?.sectionId);
    const day2Partner = day2Session ? day2PartnerNumber(participant.cardNumber) : 0;
    const queueTargetTable = participant.inspectorTargetTable || (debugSession ? participant.tableNumber : null);

    const mayReview = day2Session && !debugSession
        ? day2Partner > 0
        : Boolean(queueTargetTable) && (debugSession || isReviewerRole(participant.role));
    const belongsToQueue = day2Session && !debugSession
        ? (review) => normalizeDay2CardNumber(review.participantCardNumber) === day2Partner
        : (review) => review.participantTableNumber === queueTargetTable;

    const inspectorQueue = mayReview
        ? Object.values(bucket.reviews || {})
              .filter((review) => review.status === "pending" && belongsToQueue(review))
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
        // Такт зала: один на всех, считается от серверной метки старта.
        // Участнику из него нужна одна строка — какой такт и сколько осталось.
        day2Takt: day2Session ? day2TaktStatus(readDay2Takt(bucket), Date.now()) : null,
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

/**
 * Командный экран: седьмая ячейка стола.
 *
 * Один ноутбук команды открыт на этой странице весь день. На нём видно, что
 * происходит с шестью тайлами, пока сами тайлы лежат врозь: кто сдал, кто нет,
 * сколько собрано, сколько осталось до конца такта.
 *
 * Чего здесь нет намеренно (ТЗ, раздел В11):
 *   — содержания заданий: за содержанием человек идёт в свой телефон;
 *   — чужих команд: соседний стол — не их дело;
 *   — имён и персональных показателей. Кто сдал — общее дело, как кто работал —
 *     не общее. Поэтому наружу уходят номера, а не люди, и страница не требует
 *     входа: показывать по ней нечего, кроме шести галочек.
 */
export async function getDay2TeamBoard({ sessionId, tableNumber }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        throw new Error("Сессия недоступна или уже завершена");
    }
    if (!isDay2Section(session.sectionId)) {
        throw new Error("Командный экран есть только во втором дне");
    }

    const table = normalizeTableNumber(tableNumber);
    if (table < 1 || table > normalizeTableNumber(session.tableCount)) {
        throw new Error("Такого стола в этой сессии нет");
    }

    const store = await readStore();
    const bucket = store.sessions?.[sessionId] || { participants: {}, reviews: {} };
    const participants = Object.values(bucket.participants || {});

    // Статус ключа берётся у того, кто этот тайл держит. Узел общий на двоих,
    // поэтому засчитывается по любому из партнёров: сдаёт один, и это сдача пары.
    const statusOfKey = (key, holders) => {
        const states = holders
            .map((holder) => holder?.tasks?.[key]?.status)
            .filter(Boolean);
        if (states.includes("approved")) return "approved";
        if (states.includes("pending_review")) return "pending";
        if (states.includes("rejected")) return "rejected";
        return "none";
    };

    const holderOf = (cardNumber) => participants.find((p) => p.cardNumber === cardNumber) || null;

    const tiles = [1, 2, 3, 4, 5, 6].map((position) => {
        const number = table * 10 + position;
        const holder = holderOf(number);
        return {
            number,
            taken: Boolean(holder),
            status: holder ? statusOfKey(String(number), [holder]) : "none",
        };
    });

    const nodes = [1, 3, 5].map((position) => {
        const low = table * 10 + position;
        const high = low + 1;
        const key = `${low}-${high}`;
        const holders = [holderOf(low), holderOf(high)].filter(Boolean);
        return {
            key,
            status: statusOfKey(key, holders),
            adapterOpened: holders.some((holder) => Boolean(holder?.tasks?.[`${key}:adapter`])),
        };
    });

    const assemblyKey = String(table * 10);
    const assembly = statusOfKey(assemblyKey, participants.filter((p) => normalizeTableNumber(p.tableNumber) === table));

    return {
        sessionId,
        table,
        name: DAY2_TABLE_NAMES[table] || `Стол ${table}`,
        takt: day2TaktStatus(readDay2Takt(bucket), Date.now()),
        tiles,
        nodes,
        assembly,
        counts: {
            details: tiles.filter((tile) => tile.status === "approved").length,
            detailsTotal: tiles.length,
            nodes: nodes.filter((node) => node.status === "approved").length,
            nodesTotal: nodes.length,
            adapters: nodes.filter((node) => node.adapterOpened).length,
        },
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



