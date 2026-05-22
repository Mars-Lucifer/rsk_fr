import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

import { sweepExpiredDelegatedMayakSessions } from "@/lib/mayakDelegatedSessionCleanup";
import { readJsonFile, withJsonFileLock, writeJsonFileAtomic } from "@/lib/jsonFileLock";

const SESSION_TOKENS_FILE = path.join(process.cwd(), "data", "mayak-session-tokens.json");
const SESSIONS_FILE = path.join(process.cwd(), "data", "mayak-sessions.json");
const RIGHTS_FILE = path.join(process.cwd(), "data", "mayak-admin-rights.json");

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

async function writeStore(store, touchedTokenIds = null) {
    await withJsonFileLock(SESSION_TOKENS_FILE, async () => {
        if (Array.isArray(touchedTokenIds)) {
            const latest = await readJsonFile(SESSION_TOKENS_FILE, createEmptyStore());
            latest.tokens = Array.isArray(latest?.tokens) ? latest.tokens : [];
            const tokenById = new Map(latest.tokens.map((token) => [token.id, token]));
            for (const tokenId of touchedTokenIds) {
                const nextToken = store.tokens.find((token) => token.id === tokenId);
                if (nextToken) {
                    tokenById.set(tokenId, nextToken);
                } else {
                    tokenById.delete(tokenId);
                }
            }
            await writeJsonFileAtomic(SESSION_TOKENS_FILE, { tokens: Array.from(tokenById.values()) });
            return;
        }

        await writeJsonFileAtomic(SESSION_TOKENS_FILE, store);
    });
}

async function readStore() {
    await ensureStoreFile();
    const parsed = await readJsonFile(SESSION_TOKENS_FILE, createEmptyStore());
    return {
        tokens: Array.isArray(parsed?.tokens) ? parsed.tokens : [],
    };
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

async function readRightsStore() {
    try {
        const raw = await fs.readFile(RIGHTS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.rights) ? parsed.rights : [];
    } catch {
        return [];
    }
}

async function getDelegatedOwnerUsageState(ownerUserId, tokens = []) {
    const ownerKey = normalizeString(ownerUserId);
    if (!ownerKey) return null;

    const rights = await readRightsStore();
    const right = rights.find(
        (item) =>
            String(item.status || "") === "active" &&
            (normalizeString(item.accessId) === ownerKey || normalizeString(item.userId) === ownerKey)
    );
    if (!right) return null;

    const totalLimit = normalizeUsageLimit(right.totalParticipantLimit || 180);
    const usedCount = tokens
        .filter((token) => String(token.source || "") === "delegated-admin")
        .filter((token) => normalizeString(token.ownerUserId) === ownerKey)
        .filter((token) => token.isActive !== false && !isExpiredToken(token))
        .reduce((sum, token) => sum + Math.max(0, Number(token.usedCount) || 0), 0);

    return {
        totalLimit,
        usedCount,
        remainingAttempts: Math.max(0, totalLimit - usedCount),
    };
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

    const store = await readStore();
    const delegatedUsageState =
        String(token.source || "") === "delegated-admin" ? await getDelegatedOwnerUsageState(token.ownerUserId, store.tokens) : null;

    if (delegatedUsageState && delegatedUsageState.remainingAttempts < 1) {
        return {
            valid: false,
            error: "Лимит входов по доступу исчерпан",
            token,
            remainingAttempts: 0,
        };
    }

    if (!delegatedUsageState && token.usedCount >= token.usageLimit) {
        return {
            valid: false,
            error: "Лимит использований исчерпан",
            token,
            remainingAttempts: 0,
        };
    }

    const responseToken = delegatedUsageState
        ? {
              ...token,
              usageLimit: delegatedUsageState.totalLimit,
              usedCount: delegatedUsageState.usedCount,
          }
        : token;

    return {
        valid: true,
        token: responseToken,
        remainingAttempts: delegatedUsageState?.remainingAttempts ?? Math.max(0, token.usageLimit - token.usedCount),
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

    const delegatedUsageState =
        String(current.source || "") === "delegated-admin" ? await getDelegatedOwnerUsageState(current.ownerUserId, store.tokens) : null;
    if (delegatedUsageState && delegatedUsageState.remainingAttempts < 1) {
        return { success: false, error: "Лимит входов по доступу исчерпан", remainingAttempts: 0 };
    }

    if (!delegatedUsageState && current.usedCount >= current.usageLimit) {
        return { success: false, error: "Лимит использований исчерпан", remainingAttempts: 0 };
    }

    store.tokens[index] = {
        ...current,
        usedCount: current.usedCount + 1,
        updatedAt: new Date().toISOString(),
    };
    await writeStore(store, [current.id]);

    const responseToken = delegatedUsageState
        ? {
              ...store.tokens[index],
              usageLimit: delegatedUsageState.totalLimit,
              usedCount: delegatedUsageState.usedCount + 1,
          }
        : store.tokens[index];

    return {
        success: true,
        token: toTokenWithStats(responseToken),
        remainingAttempts: delegatedUsageState
            ? Math.max(0, delegatedUsageState.remainingAttempts - 1)
            : Math.max(0, store.tokens[index].usageLimit - store.tokens[index].usedCount),
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
    await writeStore(store, [normalized.id]);
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
    await writeStore(store, [normalized.id]);
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
    await writeStore(store, [removed.id]);
    return toTokenWithStats(removed);
}
