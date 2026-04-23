import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

import { sweepExpiredDelegatedMayakSessions } from "@/lib/mayakDelegatedSessionCleanup";

const SESSION_TOKENS_FILE = path.join(process.cwd(), "data", "mayak-session-tokens.json");
const SESSIONS_FILE = path.join(process.cwd(), "data", "mayak-sessions.json");

function createEmptyStore() {
    return { tokens: [] };
}

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeUsageLimit(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isExpiredToken(token) {
    if (!token?.expiresAt) return false;
    const expiresTs = Date.parse(token.expiresAt);
    return Number.isFinite(expiresTs) && expiresTs <= Date.now();
}

async function ensureStoreFile() {
    try {
        await fs.access(SESSION_TOKENS_FILE);
    } catch {
        await fs.mkdir(path.dirname(SESSION_TOKENS_FILE), { recursive: true });
        await fs.writeFile(SESSION_TOKENS_FILE, JSON.stringify(createEmptyStore(), null, 2), "utf-8");
    }
}

async function writeStore(store) {
    await fs.mkdir(path.dirname(SESSION_TOKENS_FILE), { recursive: true });
    const tempFile = `${SESSION_TOKENS_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(store, null, 2), "utf-8");
    await fs.rename(tempFile, SESSION_TOKENS_FILE);
}

async function readStore() {
    await ensureStoreFile();
    try {
        const raw = await fs.readFile(SESSION_TOKENS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return {
            tokens: Array.isArray(parsed?.tokens) ? parsed.tokens : [],
        };
    } catch {
        return createEmptyStore();
    }
}

async function readSessionsStore() {
    try {
        const raw = await fs.readFile(SESSIONS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.sessions) ? parsed.sessions : [];
    } catch {
        return [];
    }
}

function toTokenWithStats(token) {
    return {
        ...token,
        remainingAttempts: Math.max(0, token.usageLimit - token.usedCount),
        isExhausted: token.usedCount >= token.usageLimit,
        isExpired: isExpiredToken(token),
    };
}

function normalizeSessionToken(input = {}) {
    const now = new Date().toISOString();
    return {
        id: normalizeString(input.id) || crypto.randomUUID(),
        name: normalizeString(input.name),
        token: normalizeString(input.token) || crypto.randomBytes(32).toString("hex"),
        sectionId: normalizeString(input.sectionId),
        taskRange: normalizeString(input.taskRange),
        usageLimit: normalizeUsageLimit(input.usageLimit),
        usedCount: Number.isFinite(input.usedCount) ? input.usedCount : 0,
        isActive: input.isActive !== false,
        ownerUserId: normalizeString(input.ownerUserId),
        ownerFullName: normalizeString(input.ownerFullName),
        source: normalizeString(input.source),
        expiresAt: normalizeString(input.expiresAt) || null,
        createdAt: normalizeString(input.createdAt) || now,
        updatedAt: now,
    };
}

function assertValidTokenPayload(payload) {
    const normalized = normalizeSessionToken(payload);

    if (!normalized.name) {
        throw new Error("Укажите название session-токена");
    }

    if (!normalized.sectionId || !normalized.taskRange) {
        throw new Error("Session-токен должен быть привязан к разделу MAYAK");
    }

    if (normalized.usageLimit < 1) {
        throw new Error("Лимит использований должен быть не меньше 1");
    }

    return normalized;
}

export async function listMayakSessionTokens() {
    await sweepExpiredDelegatedMayakSessions();
    const store = await readStore();
    return store.tokens
        .map(toTokenWithStats)
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function getMayakSessionTokenById(tokenId) {
    const normalizedId = normalizeString(tokenId);
    if (!normalizedId) return null;
    const tokens = await listMayakSessionTokens();
    return tokens.find((token) => token.id === normalizedId) || null;
}

export async function getMayakSessionTokenByValue(tokenValue) {
    const normalizedValue = normalizeString(tokenValue);
    if (!normalizedValue) return null;
    await sweepExpiredDelegatedMayakSessions();
    const store = await readStore();
    const token = store.tokens.find((item) => item.token === normalizedValue);
    return token ? toTokenWithStats(token) : null;
}

export async function validateMayakSessionToken(tokenValue) {
    const token = await getMayakSessionTokenByValue(tokenValue);

    if (!token) {
        return { valid: false, error: "Токен не найден" };
    }

    if (!token.isActive) {
        return { valid: false, error: "Токен деактивирован", token };
    }

    if (token.isExpired) {
        return { valid: false, error: "Срок действия токена истёк", token, remainingAttempts: 0 };
    }

    if (token.usedCount >= token.usageLimit) {
        return {
            valid: false,
            error: "Лимит использований исчерпан",
            token,
            remainingAttempts: 0,
        };
    }

    return {
        valid: true,
        token,
        remainingAttempts: Math.max(0, token.usageLimit - token.usedCount),
    };
}

export async function useMayakSessionToken(tokenValue) {
    const normalizedValue = normalizeString(tokenValue);
    await sweepExpiredDelegatedMayakSessions();
    const store = await readStore();
    const index = store.tokens.findIndex((item) => item.token === normalizedValue);

    if (index === -1) {
        return { success: false, error: "Токен не найден" };
    }

    const current = store.tokens[index];
    if (!current.isActive) {
        return { success: false, error: "Токен деактивирован" };
    }

    if (isExpiredToken(current)) {
        return { success: false, error: "Срок действия токена истёк", remainingAttempts: 0 };
    }

    if (current.usedCount >= current.usageLimit) {
        return { success: false, error: "Лимит использований исчерпан", remainingAttempts: 0 };
    }

    store.tokens[index] = {
        ...current,
        usedCount: current.usedCount + 1,
        updatedAt: new Date().toISOString(),
    };
    await writeStore(store);

    return {
        success: true,
        token: toTokenWithStats(store.tokens[index]),
        remainingAttempts: Math.max(0, store.tokens[index].usageLimit - store.tokens[index].usedCount),
    };
}

export async function createMayakSessionToken(payload) {
    const store = await readStore();
    const normalized = assertValidTokenPayload({
        ...payload,
        token: normalizeString(payload.customToken) || normalizeString(payload.token),
    });

    if (store.tokens.some((token) => token.token === normalized.token)) {
        throw new Error("Session-токен с таким значением уже существует");
    }

    store.tokens.push(normalized);
    await writeStore(store);
    return toTokenWithStats(normalized);
}

export async function updateMayakSessionToken(tokenId, payload) {
    const store = await readStore();
    const index = store.tokens.findIndex((token) => token.id === tokenId);
    if (index === -1) {
        throw new Error("Session-токен не найден");
    }

    const current = store.tokens[index];
    const normalized = assertValidTokenPayload({
        ...current,
        ...payload,
        id: current.id,
        token: current.token,
        createdAt: current.createdAt,
        usedCount: current.usedCount,
        isActive: current.isActive,
    });

    if (normalized.usageLimit < current.usedCount) {
        throw new Error("Лимит использований не может быть меньше уже использованных попыток");
    }

    store.tokens[index] = normalized;
    await writeStore(store);
    return toTokenWithStats(normalized);
}

export async function deleteMayakSessionToken(tokenId) {
    const sessions = await readSessionsStore();
    const activeSession = sessions.find(
        (session) => session.status === "active" && Array.isArray(session.tokenIds) && session.tokenIds.includes(tokenId)
    );
    if (activeSession) {
        throw new Error(`Session-токен используется в активной сессии "${activeSession.name}"`);
    }

    const store = await readStore();
    const index = store.tokens.findIndex((token) => token.id === tokenId);
    if (index === -1) {
        throw new Error("Session-токен не найден");
    }

    const [removed] = store.tokens.splice(index, 1);
    await writeStore(store);
    return toTokenWithStats(removed);
}
