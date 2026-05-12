import crypto from "crypto";
import path from "path";
import { promises as fs } from "fs";

import { sweepExpiredDelegatedMayakSessions } from "@/lib/mayakDelegatedSessionCleanup";
import { createMayakSession, deleteMayakSession, listMayakSessions } from "@/lib/mayakSessions";
import { listMayakSessionTokens } from "@/lib/mayakSessionTokens";

const RIGHTS_FILE = path.join(process.cwd(), "data", "mayak-admin-rights.json");
const DEFAULT_TOTAL_QUOTA = 10;
const DEFAULT_TOTAL_PARTICIPANT_LIMIT = 180;
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

function generateAccessId() {
    return crypto.randomBytes(8).toString("hex");
}

export function generateDelegatedAccessPassword() {
    return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function toStoredRight(input = {}) {
    const now = new Date().toISOString();
    const totalQuota = normalizePositiveInteger(input.totalQuota, DEFAULT_TOTAL_QUOTA);
    const usedQuota = normalizeNonNegativeInteger(input.usedQuota, 0);
    const totalParticipantLimit = normalizePositiveInteger(input.totalParticipantLimit, DEFAULT_TOTAL_PARTICIPANT_LIMIT);
    const usedParticipantLimit = normalizeNonNegativeInteger(input.usedParticipantLimit, 0);
    const title = normalizeString(input.title || input.fullName || input.name);

    return {
        id: normalizeString(input.id) || crypto.randomUUID(),
        title,
        userId: normalizeString(input.userId),
        fullName: normalizeString(input.fullName) || title,
        accessId: normalizeString(input.accessId) || generateAccessId(),
        accessPassword: normalizeString(input.accessPassword) || generateDelegatedAccessPassword(),
        sectionId: normalizeString(input.sectionId),
        taskRange: normalizeString(input.taskRange),
        rangeName: normalizeString(input.rangeName),
        status: normalizeString(input.status) || "active",
        grantedAt: normalizeString(input.grantedAt) || now,
        updatedAt: normalizeString(input.updatedAt) || now,
        revokedAt: normalizeString(input.revokedAt) || null,
        totalQuota,
        usedQuota,
        remainingQuota: Math.max(0, totalQuota - usedQuota),
        totalParticipantLimit,
        usedParticipantLimit,
        remainingParticipantLimit: Math.max(0, totalParticipantLimit - usedParticipantLimit),
    };
}

function isActiveTokenForUsage(token = {}) {
    if (token.isActive === false) return false;
    const expiresTs = Date.parse(token.expiresAt || "");
    return !Number.isFinite(expiresTs) || expiresTs > Date.now();
}

function getActualUsedParticipantLimit(right = {}, tokens = []) {
    const ownerKeys = new Set([normalizeString(right.accessId), normalizeString(right.userId)].filter(Boolean));
    if (ownerKeys.size === 0) return 0;

    return tokens
        .filter((token) => String(token.source || "") === "delegated-admin")
        .filter((token) => ownerKeys.has(normalizeString(token.ownerUserId)))
        .filter(isActiveTokenForUsage)
        .reduce((sum, token) => sum + normalizeNonNegativeInteger(token.usedCount, 0), 0);
}

function toPublicRight(right = {}, tokens = []) {
    const stored = toStoredRight({
        ...right,
        usedParticipantLimit: getActualUsedParticipantLimit(right, tokens),
    });
    return stored;
}

function assertValidRightPayload(payload = {}) {
    const normalized = toStoredRight(payload);

    if (!normalized.title) {
        throw new Error("Укажите название доступа");
    }

    if (!normalized.sectionId || !normalized.taskRange) {
        throw new Error("Укажите колоду МАЯК");
    }

    if (normalized.totalQuota < 1) {
        throw new Error("Лимит сессий должен быть не меньше 1");
    }

    if (normalized.totalParticipantLimit < 1) {
        throw new Error("Общий лимит входов должен быть не меньше 1");
    }

    if (normalized.usedQuota > normalized.totalQuota) {
        throw new Error("Лимит сессий не может быть меньше уже созданных");
    }

    return normalized;
}

async function writeStore(store) {
    await fs.mkdir(path.dirname(RIGHTS_FILE), { recursive: true });
    const tempFile = `${RIGHTS_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(store, null, 2), "utf-8");
    await fs.rename(tempFile, RIGHTS_FILE);
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
        const rights = Array.isArray(parsed?.rights) ? parsed.rights : [];
        let changed = false;
        const hydratedRights = rights.map((right) => {
            if (right.accessId && right.accessPassword && right.totalParticipantLimit && right.title) {
                return right;
            }
            changed = true;
            return toStoredRight(right);
        });
        if (changed) {
            await writeStore({ rights: hydratedRights });
        }
        return { rights: hydratedRights };
    } catch {
        return createEmptyStore();
    }
}

function sortRights(rights = [], tokens = []) {
    return rights
        .slice()
        .sort((left, right) => {
            const leftActive = String(left.status || "") === "active" ? 0 : 1;
            const rightActive = String(right.status || "") === "active" ? 0 : 1;
            if (leftActive !== rightActive) return leftActive - rightActive;
            return String(right.updatedAt || right.grantedAt || "").localeCompare(String(left.updatedAt || left.grantedAt || ""));
        })
        .map((right) => toPublicRight(right, tokens));
}

function getRightOwnerKey(right = {}) {
    return normalizeString(right.accessId || right.userId);
}

async function collectDelegatedSessionsForRight(right) {
    const [sessions, tokens] = await Promise.all([listMayakSessions(), listMayakSessionTokens()]);
    const tokenMap = new Map(tokens.map((token) => [token.id, token]));
    const ownerKeys = new Set([normalizeString(right.accessId), normalizeString(right.userId)].filter(Boolean));

    return sessions
        .filter((session) => String(session.source || "") === "delegated-admin")
        .filter((session) => ownerKeys.has(normalizeString(session.ownerUserId)))
        .filter((session) => String(session.status || "") === "active")
        .map((session) => {
            const primaryToken =
                (Array.isArray(session?.tokenIds) ? session.tokenIds : []).map((tokenId) => tokenMap.get(tokenId)).find(Boolean) || null;
            return { session, token: primaryToken };
        })
        .sort((left, rightItem) => String(rightItem.session?.createdAt || "").localeCompare(String(left.session?.createdAt || "")));
}

export async function listMayakAdminRights() {
    await sweepExpiredDelegatedMayakSessions();
    const [store, tokens] = await Promise.all([readStore(), listMayakSessionTokens()]);
    return sortRights(store.rights, tokens);
}

export async function getMayakAdminRightByUserId(userId, { includeInactive = false } = {}) {
    const normalizedUserId = normalizeString(String(userId || ""));
    if (!normalizedUserId) return null;

    const [store, tokens] = await Promise.all([readStore(), listMayakSessionTokens()]);
    const right =
        store.rights.find((item) => normalizeString(item.userId) === normalizedUserId && (includeInactive || String(item.status || "") === "active")) ||
        null;
    return right ? toPublicRight(right, tokens) : null;
}

export async function getMayakAdminRightByAccessId(accessId) {
    const normalizedAccessId = normalizeString(String(accessId || ""));
    if (!normalizedAccessId) return null;

    const [store, tokens] = await Promise.all([readStore(), listMayakSessionTokens()]);
    const right = store.rights.find((item) => normalizeString(item.accessId) === normalizedAccessId) || null;
    return right ? toPublicRight(right, tokens) : null;
}

export async function getMayakAdminRightById(rightId) {
    const normalizedId = normalizeString(String(rightId || ""));
    if (!normalizedId) return null;

    const [store, tokens] = await Promise.all([readStore(), listMayakSessionTokens()]);
    const right = store.rights.find((item) => normalizeString(item.id) === normalizedId) || null;
    return right ? toPublicRight(right, tokens) : null;
}

export function validateDelegatedAccessPassword(right, password) {
    return Boolean(right?.status === "active" && normalizeString(right.accessPassword) && normalizeString(password) === normalizeString(right.accessPassword));
}

export async function grantMayakAdminRight(_req, payload = {}) {
    const store = await readStore();
    const normalized = assertValidRightPayload(payload);

    store.rights.push(normalized);
    await writeStore(store);
    return toPublicRight(normalized);
}

export async function updateMayakAdminRight(_req, rightId, payload = {}) {
    const normalizedId = normalizeString(String(rightId || ""));
    const store = await readStore();
    const index = store.rights.findIndex((item) => normalizeString(item.id) === normalizedId);
    if (index === -1) {
        throw new Error("Доступ не найден");
    }

    const current = store.rights[index];
    const normalized = assertValidRightPayload({
        ...current,
        ...payload,
        id: current.id,
        userId: current.userId,
        accessId: current.accessId,
        grantedAt: current.grantedAt,
        status: current.status,
        revokedAt: current.revokedAt,
        totalQuota: payload.totalQuota ?? current.totalQuota,
        totalParticipantLimit: payload.totalParticipantLimit ?? current.totalParticipantLimit,
        usedQuota: current.usedQuota,
        usedParticipantLimit: current.usedParticipantLimit,
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
        throw new Error("Доступ не найден");
    }

    const revokedAt = new Date().toISOString();
    const nextRight = toStoredRight({
        ...store.rights[index],
        status: "revoked",
        revokedAt,
        updatedAt: revokedAt,
    });

    store.rights[index] = nextRight;
    await writeStore(store);
    return toPublicRight(nextRight);
}

export async function deleteMayakAdminRight(rightId) {
    const normalizedId = normalizeString(String(rightId || ""));
    const store = await readStore();
    const index = store.rights.findIndex((item) => normalizeString(item.id) === normalizedId);
    if (index === -1) {
        throw new Error("Доступ не найден");
    }

    const [deleted] = store.rights.splice(index, 1);
    await writeStore(store);
    return toPublicRight(deleted);
}

async function createDelegatedMayakSessionForRightIndex(store, index, { sessionName, tableCount }) {
    const normalizedTableCount = normalizePositiveInteger(tableCount, 0);
    if (normalizedTableCount < 1 || normalizedTableCount > DEFAULT_MAX_TABLES) {
        throw new Error("Количество столов должно быть от 1 до 6");
    }

    const currentRight = toPublicRight(store.rights[index]);
    if (currentRight.status !== "active") {
        throw new Error("Доступ неактивен");
    }

    if (currentRight.remainingQuota < 1) {
        throw new Error("Лимит создания сессий исчерпан");
    }

    const expiresAt = new Date(Date.now() + DEFAULT_TOKEN_TTL_MS).toISOString();
    const normalizedSessionName = normalizeString(sessionName);
    const resolvedSessionName = normalizedSessionName || `Сессия ${currentRight.title || currentRight.accessId} #${currentRight.usedQuota + 1}`;

    let createdSession = null;

    try {
        createdSession = await createMayakSession({
            name: resolvedSessionName,
            sectionId: currentRight.sectionId,
            taskRange: currentRight.taskRange,
            tableCount: normalizedTableCount,
            tokenUsageLimit: currentRight.totalParticipantLimit,
            ownerUserId: getRightOwnerKey(currentRight),
            ownerFullName: currentRight.title,
            source: "delegated-admin",
            expiresAt,
            participantLimit: currentRight.totalParticipantLimit,
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
            right: toPublicRight(nextRight, tokens),
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

export async function createDelegatedMayakSessionForUser({ userId, sessionName, tableCount }) {
    await sweepExpiredDelegatedMayakSessions();

    const normalizedUserId = normalizeString(String(userId || ""));
    if (!normalizedUserId) {
        throw new Error("Не удалось определить пользователя");
    }

    const store = await readStore();
    const index = store.rights.findIndex((item) => normalizeString(item.userId) === normalizedUserId && String(item.status || "") === "active");
    if (index === -1) {
        throw new Error("У пользователя нет активного доступа МАЯК");
    }

    return createDelegatedMayakSessionForRightIndex(store, index, { sessionName, tableCount });
}

export async function createDelegatedMayakSessionForAccess({ accessId, password, sessionName, tableCount }) {
    await sweepExpiredDelegatedMayakSessions();

    const store = await readStore();
    const index = store.rights.findIndex((item) => normalizeString(item.accessId) === normalizeString(accessId));
    if (index === -1) {
        throw new Error("Доступ не найден");
    }

    const tokens = await listMayakSessionTokens();
    const currentRight = toPublicRight(store.rights[index], tokens);
    if (!validateDelegatedAccessPassword(currentRight, password)) {
        throw new Error("Неверный пароль");
    }

    return createDelegatedMayakSessionForRightIndex(store, index, { sessionName, tableCount });
}

export async function getMayakDelegatedAccessOverview(userId) {
    await sweepExpiredDelegatedMayakSessions();

    const right = await getMayakAdminRightByUserId(userId, { includeInactive: true });

    return {
        right,
        sessions: right ? await collectDelegatedSessionsForRight(right) : [],
    };
}

export async function getMayakDelegatedAccessOverviewByAccess({ accessId, password }) {
    await sweepExpiredDelegatedMayakSessions();

    const right = await getMayakAdminRightByAccessId(accessId);
    if (!right) {
        throw new Error("Доступ не найден");
    }
    if (!validateDelegatedAccessPassword(right, password)) {
        throw new Error("Неверный пароль");
    }

    return {
        right,
        sessions: await collectDelegatedSessionsForRight(right),
    };
}
