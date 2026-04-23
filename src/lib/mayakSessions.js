import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

import { sweepExpiredDelegatedMayakSessions } from "@/lib/mayakDelegatedSessionCleanup";
import {
    createMayakSessionToken,
    deleteMayakSessionToken,
    listMayakSessionTokens,
    updateMayakSessionToken,
} from "@/lib/mayakSessionTokens";

const SESSIONS_FILE = path.join(process.cwd(), "data", "mayak-sessions.json");
const SESSION_FILES_ROOT = path.join(process.cwd(), "data", "mayak-session-files");
const DEFAULT_REVIEW_TIMEOUT_SECONDS = 130;
const DEFAULT_REWORK_TIMEOUT_SECONDS = 180;

function createEmptyStore() {
    return { sessions: [] };
}

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeTokenIds(tokenIds) {
    if (!Array.isArray(tokenIds)) return [];
    return Array.from(
        new Set(
            tokenIds
                .map((value) => normalizeString(value))
                .filter(Boolean)
        )
    );
}

function normalizePositiveInteger(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function ensureStoreFile() {
    try {
        await fs.access(SESSIONS_FILE);
    } catch {
        await fs.mkdir(path.dirname(SESSIONS_FILE), { recursive: true });
        await fs.writeFile(SESSIONS_FILE, JSON.stringify(createEmptyStore(), null, 2), "utf-8");
    }
}

async function writeStore(store) {
    await fs.mkdir(path.dirname(SESSIONS_FILE), { recursive: true });
    const tempFile = `${SESSIONS_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(store, null, 2), "utf-8");
    await fs.rename(tempFile, SESSIONS_FILE);
}

export async function readMayakSessionsStore() {
    await ensureStoreFile();
    try {
        const raw = await fs.readFile(SESSIONS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return {
            sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
        };
    } catch {
        return createEmptyStore();
    }
}

export function normalizeMayakSession(input = {}) {
    const now = new Date().toISOString();
    const tableCount = normalizePositiveInteger(input.tableCount);
    const tokenUsageLimit = normalizePositiveInteger(input.tokenUsageLimit);
    const reviewTimeoutSeconds = normalizePositiveInteger(input.reviewTimeoutSeconds, DEFAULT_REVIEW_TIMEOUT_SECONDS);
    const reworkTimeoutSeconds = normalizePositiveInteger(input.reworkTimeoutSeconds, DEFAULT_REWORK_TIMEOUT_SECONDS);
    const participantLimit = normalizePositiveInteger(input.participantLimit, 0);

    return {
        id: normalizeString(input.id) || crypto.randomUUID(),
        name: normalizeString(input.name),
        sectionId: normalizeString(input.sectionId),
        taskRange: normalizeString(input.taskRange),
        tableCount,
        tokenUsageLimit,
        reviewTimeoutSeconds,
        reworkTimeoutSeconds,
        requiresTableSelection: tableCount > 0,
        participantLimit,
        ownerUserId: normalizeString(input.ownerUserId),
        ownerFullName: normalizeString(input.ownerFullName),
        source: normalizeString(input.source),
        expiresAt: normalizeString(input.expiresAt) || null,
        tokenIds: normalizeTokenIds(input.tokenIds),
        status: normalizeString(input.status) || "active",
        createdAt: normalizeString(input.createdAt) || now,
        updatedAt: now,
        completedAt: normalizeString(input.completedAt) || null,
    };
}

function assertValidSessionPayload(payload) {
    const normalized = normalizeMayakSession(payload);

    if (!normalized.name) {
        throw new Error("Укажите название сессии");
    }

    if (!normalized.sectionId || !normalized.taskRange) {
        throw new Error("Для сессии нужен привязанный раздел MAYAK");
    }

    if (normalized.tableCount < 1) {
        throw new Error("Количество столов должно быть не меньше 1");
    }

    if (normalized.tokenUsageLimit < 1) {
        throw new Error("Количество использований токена должно быть не меньше 1");
    }

    if (normalized.reviewTimeoutSeconds < 1) {
        throw new Error("Таймер проверки должен быть не меньше 1 секунды");
    }

    if (normalized.reworkTimeoutSeconds < 1) {
        throw new Error("Таймер исправления должен быть не меньше 1 секунды");
    }

    if (normalized.source === "delegated-admin") {
        if (!normalized.ownerUserId) {
            throw new Error("Для пользовательской сессии нужен владелец");
        }
        if (!normalized.expiresAt) {
            throw new Error("Для пользовательской сессии нужен срок действия");
        }
        if (normalized.participantLimit < 1) {
            throw new Error("Для пользовательской сессии нужен лимит участников");
        }
    }

    if (normalized.tokenIds.length === 0) {
        throw new Error("Привяжите хотя бы один токен к сессии");
    }

    const tokens = Array.isArray(payload?._tokens) ? payload._tokens : [];
    const knownTokenIds = new Set(tokens.map((token) => token.id));
    const unknownTokenIds = normalized.tokenIds.filter((tokenId) => !knownTokenIds.has(tokenId));
    if (unknownTokenIds.length > 0) {
        throw new Error("В сессии есть несуществующие токены");
    }

    const invalidSectionTokens = tokens.filter((token) => {
        if (!normalized.tokenIds.includes(token.id)) return false;
        return token.sectionId !== normalized.sectionId || token.taskRange !== normalized.taskRange;
    });
    if (invalidSectionTokens.length > 0) {
        throw new Error("Все токены сессии должны быть привязаны к выбранному разделу");
    }

    return { normalized, tokens };
}

function assertNoActiveTokenOverlap(sessions, tokenIds, existingSessionId = null) {
    const conflictingSession = sessions.find((session) => {
        if (session.status !== "active") return false;
        if (existingSessionId && session.id === existingSessionId) return false;
        return Array.isArray(session.tokenIds) && session.tokenIds.some((tokenId) => tokenIds.includes(tokenId));
    });

    if (conflictingSession) {
        throw new Error(`Один или несколько токенов уже привязаны к активной сессии "${conflictingSession.name}"`);
    }
}

export async function listMayakSessions() {
    await sweepExpiredDelegatedMayakSessions();
    const store = await readMayakSessionsStore();
    return store.sessions
        .slice()
        .sort((a, b) => {
            const aCompleted = a.status === "completed" ? 1 : 0;
            const bCompleted = b.status === "completed" ? 1 : 0;
            if (aCompleted !== bCompleted) return aCompleted - bCompleted;
            return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
        });
}

export async function getMayakSessionById(sessionId) {
    const normalizedId = normalizeString(String(sessionId || ""));
    if (!normalizedId) return null;
    const sessions = await listMayakSessions();
    return sessions.find((session) => session.id === normalizedId) || null;
}

export async function findActiveMayakSessionByTokenId(tokenId) {
    const sessions = await listMayakSessions();
    return (
        sessions.find(
            (session) =>
                session.status === "active" &&
                Array.isArray(session.tokenIds) &&
                session.tokenIds.includes(tokenId)
        ) || null
    );
}

export async function createMayakSession(payload) {
    const store = await readMayakSessionsStore();
    const basePayload = normalizeMayakSession(payload);

    if (!basePayload.name) {
        throw new Error("Укажите название сессии");
    }

    if (!basePayload.sectionId || !basePayload.taskRange) {
        throw new Error("Для сессии нужен привязанный раздел MAYAK");
    }

    if (basePayload.tableCount < 1) {
        throw new Error("Количество столов должно быть не меньше 1");
    }

    if (basePayload.tokenUsageLimit < 1) {
        throw new Error("Количество использований токена должно быть не меньше 1");
    }

    const autoToken = await createMayakSessionToken({
        name: `${basePayload.name} - token`,
        usageLimit: basePayload.tokenUsageLimit,
        sectionId: basePayload.sectionId,
        taskRange: basePayload.taskRange,
        ownerUserId: basePayload.ownerUserId,
        ownerFullName: basePayload.ownerFullName,
        source: basePayload.source,
        expiresAt: basePayload.expiresAt,
    });

    const tokens = await listMayakSessionTokens();
    const { normalized } = assertValidSessionPayload({
        ...payload,
        reviewTimeoutSeconds: basePayload.reviewTimeoutSeconds,
        reworkTimeoutSeconds: basePayload.reworkTimeoutSeconds,
        tokenUsageLimit: basePayload.tokenUsageLimit,
        participantLimit: basePayload.participantLimit,
        ownerUserId: basePayload.ownerUserId,
        ownerFullName: basePayload.ownerFullName,
        source: basePayload.source,
        expiresAt: basePayload.expiresAt,
        tokenIds: [autoToken.id],
        _tokens: tokens,
    });
    assertNoActiveTokenOverlap(store.sessions, normalized.tokenIds);

    const session = {
        ...normalized,
        status: "active",
        completedAt: null,
    };

    store.sessions.push(session);
    await writeStore(store);
    return session;
}

export async function updateMayakSession(sessionId, payload) {
    const store = await readMayakSessionsStore();
    const tokens = await listMayakSessionTokens();
    const index = store.sessions.findIndex((session) => session.id === sessionId);
    if (index === -1) {
        throw new Error("Сессия не найдена");
    }

    const current = store.sessions[index];
    if (current.status === "completed") {
        throw new Error("Завершённую сессию нельзя редактировать");
    }

    const { normalized } = assertValidSessionPayload({
        ...current,
        ...payload,
        _tokens: tokens,
        id: current.id,
        createdAt: current.createdAt,
        status: current.status,
        completedAt: current.completedAt,
        ownerUserId: current.ownerUserId,
        ownerFullName: current.ownerFullName,
        source: current.source,
        expiresAt: current.expiresAt,
    });

    assertNoActiveTokenOverlap(store.sessions, normalized.tokenIds, current.id);

    const primaryTokenId = Array.isArray(current.tokenIds) ? current.tokenIds[0] : "";
    if (primaryTokenId) {
        await updateMayakSessionToken(primaryTokenId, {
            name: `${normalized.name} - token`,
            sectionId: normalized.sectionId,
            taskRange: normalized.taskRange,
            usageLimit: normalized.tokenUsageLimit,
            ownerUserId: normalized.ownerUserId,
            ownerFullName: normalized.ownerFullName,
            source: normalized.source,
            expiresAt: normalized.expiresAt,
        });
    }

    store.sessions[index] = {
        ...normalized,
        status: current.status,
        completedAt: current.completedAt,
    };
    await writeStore(store);
    return store.sessions[index];
}

export async function deleteMayakSession(sessionId) {
    const store = await readMayakSessionsStore();
    const index = store.sessions.findIndex((session) => session.id === sessionId);
    if (index === -1) {
        throw new Error("Сессия не найдена");
    }

    const [removed] = store.sessions.splice(index, 1);
    await writeStore(store);

    for (const tokenId of Array.isArray(removed.tokenIds) ? removed.tokenIds : []) {
        try {
            await deleteMayakSessionToken(tokenId);
        } catch {}
    }

    const sessionFilesDir = path.join(SESSION_FILES_ROOT, sessionId);
    await fs.rm(sessionFilesDir, { recursive: true, force: true });

    return removed;
}

export async function completeMayakSession(sessionId) {
    const store = await readMayakSessionsStore();
    const index = store.sessions.findIndex((session) => session.id === sessionId);
    if (index === -1) {
        throw new Error("Сессия не найдена");
    }

    const current = store.sessions[index];
    if (current.status === "completed") {
        return current;
    }

    const completedAt = new Date().toISOString();
    store.sessions[index] = {
        ...current,
        status: "completed",
        completedAt,
        updatedAt: completedAt,
    };
    await writeStore(store);

    const sessionFilesDir = path.join(SESSION_FILES_ROOT, sessionId);
    await fs.rm(sessionFilesDir, { recursive: true, force: true });

    return store.sessions[index];
}
