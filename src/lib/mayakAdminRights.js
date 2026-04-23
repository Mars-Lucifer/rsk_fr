import crypto from "crypto";
import path from "path";
import { promises as fs } from "fs";

import { sweepExpiredDelegatedMayakSessions } from "@/lib/mayakDelegatedSessionCleanup";
import { fetchMayakUsersBatchByIds } from "@/lib/mayakUserLookup";
import { createMayakSession, deleteMayakSession, listMayakSessions } from "@/lib/mayakSessions";
import { listMayakSessionTokens } from "@/lib/mayakSessionTokens";

const RIGHTS_FILE = path.join(process.cwd(), "data", "mayak-admin-rights.json");
const DEFAULT_TOTAL_QUOTA = 10;
const DEFAULT_TOKEN_USAGE_LIMIT = 30;
const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_TABLES = 6;

function createEmptyStore() {
    return { rights: [] };
}

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeNonNegativeInteger(value, fallback = 0) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizePositiveInteger(value, fallback = 0) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toStoredRight(input = {}) {
    const now = new Date().toISOString();
    const totalQuota = normalizePositiveInteger(input.totalQuota, DEFAULT_TOTAL_QUOTA);
    const usedQuota = normalizeNonNegativeInteger(input.usedQuota, 0);

    return {
        id: normalizeString(input.id) || crypto.randomUUID(),
        userId: normalizeString(input.userId),
        fullName: normalizeString(input.fullName),
        sectionId: normalizeString(input.sectionId),
        taskRange: normalizeString(input.taskRange),
        rangeName: normalizeString(input.rangeName),
        status: normalizeString(input.status) || "active",
        grantedAt: normalizeString(input.grantedAt) || now,
        updatedAt: now,
        revokedAt: normalizeString(input.revokedAt) || null,
        totalQuota,
        usedQuota,
        remainingQuota: Math.max(0, totalQuota - usedQuota),
    };
}

function toPublicRight(right = {}) {
    const totalQuota = normalizePositiveInteger(right.totalQuota, DEFAULT_TOTAL_QUOTA);
    const usedQuota = normalizeNonNegativeInteger(right.usedQuota, 0);

    return {
        ...right,
        totalQuota,
        usedQuota,
        remainingQuota: Math.max(0, totalQuota - usedQuota),
        isActive: String(right.status || "") === "active",
    };
}

function assertValidRightPayload(payload = {}) {
    const normalized = toStoredRight(payload);

    if (!normalized.userId) {
        throw new Error("Укажите ID пользователя");
    }

    if (!normalized.fullName) {
        throw new Error("Не удалось определить ФИО пользователя");
    }

    if (!normalized.sectionId || !normalized.taskRange) {
        throw new Error("Укажите колоду MAYAK");
    }

    if (normalized.totalQuota < 1) {
        throw new Error("Количество выдач должно быть не меньше 1");
    }

    return normalized;
}

async function ensureStoreFile() {
    try {
        await fs.access(RIGHTS_FILE);
    } catch {
        await fs.mkdir(path.dirname(RIGHTS_FILE), { recursive: true });
        await fs.writeFile(RIGHTS_FILE, JSON.stringify(createEmptyStore(), null, 2), "utf-8");
    }
}

async function readStore() {
    await ensureStoreFile();
    try {
        const raw = await fs.readFile(RIGHTS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return {
            rights: Array.isArray(parsed?.rights) ? parsed.rights : [],
        };
    } catch {
        return createEmptyStore();
    }
}

async function writeStore(store) {
    await fs.mkdir(path.dirname(RIGHTS_FILE), { recursive: true });
    const tempFile = `${RIGHTS_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(store, null, 2), "utf-8");
    await fs.rename(tempFile, RIGHTS_FILE);
}

function sortRights(rights = []) {
    return rights
        .slice()
        .sort((left, right) => {
            const leftActive = String(left.status || "") === "active" ? 0 : 1;
            const rightActive = String(right.status || "") === "active" ? 0 : 1;
            if (leftActive !== rightActive) return leftActive - rightActive;
            return String(right.updatedAt || right.grantedAt || "").localeCompare(String(left.updatedAt || left.grantedAt || ""));
        })
        .map(toPublicRight);
}

export async function listMayakAdminRights() {
    await sweepExpiredDelegatedMayakSessions();
    const store = await readStore();
    return sortRights(store.rights);
}

export async function getMayakAdminRightByUserId(userId, { includeInactive = false } = {}) {
    const normalizedUserId = normalizeString(String(userId || ""));
    if (!normalizedUserId) return null;

    const store = await readStore();
    const right =
        store.rights.find((item) => normalizeString(item.userId) === normalizedUserId && (includeInactive || String(item.status || "") === "active")) ||
        null;
    return right ? toPublicRight(right) : null;
}

export async function getMayakAdminRightById(rightId) {
    const normalizedId = normalizeString(String(rightId || ""));
    if (!normalizedId) return null;

    const store = await readStore();
    const right = store.rights.find((item) => normalizeString(item.id) === normalizedId) || null;
    return right ? toPublicRight(right) : null;
}

export async function grantMayakAdminRight(req, payload = {}) {
    const requestedUserId = normalizeString(String(payload.userId || ""));
    const batchUsers = await fetchMayakUsersBatchByIds(req, [requestedUserId]);
    const resolvedUser = batchUsers[requestedUserId];
    if (!resolvedUser?.id) {
        throw new Error("Пользователь с таким ID не найден");
    }

    const store = await readStore();
    const existingIndex = store.rights.findIndex((item) => normalizeString(item.userId) === requestedUserId);
    const normalized = assertValidRightPayload({
        ...payload,
        userId: requestedUserId,
        fullName: resolvedUser.fullName,
    });

    if (existingIndex >= 0) {
        const current = store.rights[existingIndex];
        const nextRight = toStoredRight({
            ...current,
            sectionId: normalized.sectionId,
            taskRange: normalized.taskRange,
            rangeName: normalized.rangeName,
            fullName: normalized.fullName,
            totalQuota: normalized.totalQuota,
            status: "active",
            revokedAt: null,
            updatedAt: new Date().toISOString(),
        });
        store.rights[existingIndex] = nextRight;
        await writeStore(store);
        return toPublicRight(nextRight);
    }

    store.rights.push(normalized);
    await writeStore(store);
    return toPublicRight(normalized);
}

export async function updateMayakAdminRight(req, rightId, payload = {}) {
    const normalizedId = normalizeString(String(rightId || ""));
    const store = await readStore();
    const index = store.rights.findIndex((item) => normalizeString(item.id) === normalizedId);
    if (index === -1) {
        throw new Error("Право администратора не найдено");
    }

    const current = store.rights[index];
    let fullName = current.fullName;
    if (normalizeString(String(payload.userId || "")) && normalizeString(String(payload.userId || "")) !== normalizeString(current.userId)) {
        throw new Error("Смена пользователя для уже выданного права не поддерживается");
    }

    if (!fullName) {
        const batchUsers = await fetchMayakUsersBatchByIds(req, [current.userId]);
        fullName = batchUsers[current.userId]?.fullName || current.fullName;
    }

    const normalized = assertValidRightPayload({
        ...current,
        ...payload,
        id: current.id,
        userId: current.userId,
        fullName,
        grantedAt: current.grantedAt,
        status: current.status,
        revokedAt: current.revokedAt,
        totalQuota: payload.totalQuota ?? current.totalQuota,
        usedQuota: current.usedQuota,
    });

    store.rights[index] = normalized;
    await writeStore(store);
    return toPublicRight(normalized);
}

export async function revokeMayakAdminRight(rightId) {
    const normalizedId = normalizeString(String(rightId || ""));
    const store = await readStore();
    const index = store.rights.findIndex((item) => normalizeString(item.id) === normalizedId);
    if (index === -1) {
        throw new Error("Право администратора не найдено");
    }

    const current = store.rights[index];
    const revokedAt = new Date().toISOString();
    const nextRight = toStoredRight({
        ...current,
        status: "revoked",
        revokedAt,
        updatedAt: revokedAt,
    });

    store.rights[index] = nextRight;
    await writeStore(store);
    return toPublicRight(nextRight);
}

export async function createDelegatedMayakSessionForUser({ userId, sessionName, tableCount }) {
    await sweepExpiredDelegatedMayakSessions();

    const normalizedUserId = normalizeString(String(userId || ""));
    if (!normalizedUserId) {
        throw new Error("Не удалось определить пользователя");
    }

    const normalizedTableCount = normalizePositiveInteger(tableCount, 0);
    if (normalizedTableCount < 1 || normalizedTableCount > DEFAULT_MAX_TABLES) {
        throw new Error("Количество столов должно быть от 1 до 6");
    }

    const store = await readStore();
    const index = store.rights.findIndex((item) => normalizeString(item.userId) === normalizedUserId && String(item.status || "") === "active");
    if (index === -1) {
        throw new Error("У пользователя нет активных админ-прав MAYAK");
    }

    const currentRight = toPublicRight(store.rights[index]);
    if (currentRight.remainingQuota < 1) {
        throw new Error("Лимит создания токенов исчерпан");
    }

    const expiresAt = new Date(Date.now() + DEFAULT_TOKEN_TTL_MS).toISOString();
    const normalizedSessionName = normalizeString(sessionName);
    const resolvedSessionName = normalizedSessionName || `Сессия ${currentRight.fullName} #${currentRight.usedQuota + 1}`;

    let createdSession = null;

    try {
        createdSession = await createMayakSession({
            name: resolvedSessionName,
            sectionId: currentRight.sectionId,
            taskRange: currentRight.taskRange,
            tableCount: normalizedTableCount,
            tokenUsageLimit: DEFAULT_TOKEN_USAGE_LIMIT,
            ownerUserId: currentRight.userId,
            ownerFullName: currentRight.fullName,
            source: "delegated-admin",
            expiresAt,
            participantLimit: DEFAULT_TOKEN_USAGE_LIMIT,
        });

        const nextRight = toStoredRight({
            ...store.rights[index],
            usedQuota: normalizeNonNegativeInteger(store.rights[index].usedQuota, 0) + 1,
        });
        store.rights[index] = nextRight;
        await writeStore(store);

        const tokens = await listMayakSessionTokens();
        const tokenMap = new Map(tokens.map((token) => [token.id, token]));
        const primaryToken =
            (Array.isArray(createdSession?.tokenIds) ? createdSession.tokenIds : []).map((tokenId) => tokenMap.get(tokenId)).find(Boolean) || null;

        return {
            right: toPublicRight(nextRight),
            session: createdSession,
            token: primaryToken,
        };
    } catch (error) {
        if (createdSession?.id) {
            await deleteMayakSession(createdSession.id).catch(() => {});
        }
        throw error;
    }
}

export async function getMayakDelegatedAccessOverview(userId) {
    await sweepExpiredDelegatedMayakSessions();

    const normalizedUserId = normalizeString(String(userId || ""));
    const [right, sessions, tokens] = await Promise.all([getMayakAdminRightByUserId(normalizedUserId, { includeInactive: true }), listMayakSessions(), listMayakSessionTokens()]);

    const tokenMap = new Map(tokens.map((token) => [token.id, token]));
    const delegatedSessions = sessions
        .filter((session) => String(session.source || "") === "delegated-admin" && normalizeString(session.ownerUserId) === normalizedUserId)
        .filter((session) => String(session.status || "") === "active")
        .map((session) => {
            const primaryToken =
                (Array.isArray(session?.tokenIds) ? session.tokenIds : []).map((tokenId) => tokenMap.get(tokenId)).find(Boolean) || null;

            return {
                session,
                token: primaryToken,
            };
        })
        .sort((left, right) => String(right.session?.createdAt || "").localeCompare(String(left.session?.createdAt || "")));

    return {
        right,
        sessions: delegatedSessions,
    };
}
