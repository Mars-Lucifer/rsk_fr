import crypto from "crypto";
import path from "path";

import { readJsonFile, withJsonFileLock, writeJsonFileAtomic } from "@/lib/jsonFileLock";
import { createMayakSessionToken, deleteMayakSessionToken } from "@/lib/mayakSessionTokens";
import { attachTokenIdToMayakSession, getMayakSessionById } from "@/lib/mayakSessions";
import {
    createToken as createLegacyToken,
    getTokenByValue as getLegacyTokenByValue,
    updateToken as updateLegacyToken,
} from "@/utils/mayakTokens";

// Реестр дополнительных ссылок сессии: помимо базовой инспекторской ссылки
// (session-токен delegated-admin, который считается в лимит доступа) на каждую
// сессию заводим:
//   - plainToken   — обычная ссылка без инспектора (независимый legacy-токен);
//   - masterToken  — мастер-вход: session-токен той же сессии, но НЕ учитывается
//                    (source != delegated-admin → не попадает в счётчик входов);
//   - masterSecret / dashboardSecret — секреты для страниц мастера и дашборда,
//                    авторизация по секрету в URL, без admin-пароля.
const LINKS_FILE = path.join(process.cwd(), "data", "mayak-session-links.json");
const MASTER_TOKEN_USAGE_LIMIT = 100000;
const DEFAULT_PLAIN_USAGE_LIMIT = 180;

function createEmptyStore() {
    return { links: [] };
}

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function generateSecret() {
    return crypto.randomBytes(24).toString("hex");
}

async function readStore() {
    const parsed = await readJsonFile(LINKS_FILE, createEmptyStore());
    return { links: Array.isArray(parsed?.links) ? parsed.links : [] };
}

async function upsertRecord(record) {
    await withJsonFileLock(LINKS_FILE, async () => {
        const store = await readJsonFile(LINKS_FILE, createEmptyStore());
        store.links = Array.isArray(store?.links) ? store.links : [];
        const index = store.links.findIndex((item) => item.sessionId === record.sessionId);
        if (index === -1) {
            store.links.push(record);
        } else {
            store.links[index] = record;
        }
        await writeJsonFileAtomic(LINKS_FILE, store);
    });
}

async function removeRecord(sessionId) {
    await withJsonFileLock(LINKS_FILE, async () => {
        const store = await readJsonFile(LINKS_FILE, createEmptyStore());
        const links = Array.isArray(store?.links) ? store.links : [];
        await writeJsonFileAtomic(LINKS_FILE, { links: links.filter((item) => item.sessionId !== sessionId) });
    });
}

export async function createSessionLinks({ session, accessId } = {}) {
    if (!session?.id) {
        throw new Error("Для создания ссылок нужна сессия");
    }

    const sectionId = normalizeString(session.sectionId);
    const taskRange = normalizeString(session.taskRange) || sectionId;
    const parsedLimit = Number.parseInt(session.participantLimit, 10);
    const plainUsageLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PLAIN_USAGE_LIMIT;
    const baseName = normalizeString(session.name) || "Сессия";

    // 1. Обычная ссылка — независимый legacy-токен на ту же колоду. Тренажёр
    //    поднимет его как tokenType "legacy" (без инспектора/ролей/ревью).
    const legacyToken = createLegacyToken(`${baseName} — обычная`, plainUsageLimit, taskRange, null, sectionId);

    // 2. Мастер-токен — session-токен той же сессии, но источник delegated-master:
    //    расход по нему не учитывается в лимите доступа (счётчик берёт только
    //    delegated-admin), а функционал полный, как у инспекторской ссылки.
    const masterToken = await createMayakSessionToken({
        name: `${baseName} — мастер`,
        usageLimit: MASTER_TOKEN_USAGE_LIMIT,
        sectionId,
        taskRange,
        ownerUserId: normalizeString(session.ownerUserId),
        ownerFullName: normalizeString(session.ownerFullName),
        source: "delegated-master",
        expiresAt: session.expiresAt || null,
    });
    await attachTokenIdToMayakSession(session.id, masterToken.id);

    const record = {
        sessionId: session.id,
        accessId: normalizeString(accessId) || normalizeString(session.ownerUserId),
        plainToken: legacyToken.token,
        masterTokenId: masterToken.id,
        masterToken: masterToken.token,
        masterSecret: generateSecret(),
        dashboardSecret: generateSecret(),
        createdAt: new Date().toISOString(),
    };
    await upsertRecord(record);
    return record;
}

export async function getSessionLinksBySessionId(sessionId) {
    const normalizedId = normalizeString(String(sessionId || ""));
    if (!normalizedId) return null;
    const store = await readStore();
    return store.links.find((item) => item.sessionId === normalizedId) || null;
}

// Дашборд открывается по дашборд-секрету ИЛИ по мастер-секрету (мастер видит всё).
export async function resolveDashboardSecret(secret) {
    const normalized = normalizeString(secret);
    if (!normalized) return null;
    const store = await readStore();
    return store.links.find((item) => item.dashboardSecret === normalized || item.masterSecret === normalized) || null;
}

// Мастер-действия (демо-вход, завершение) — только по мастер-секрету.
export async function resolveMasterSecret(secret) {
    const normalized = normalizeString(secret);
    if (!normalized) return null;
    const store = await readStore();
    return store.links.find((item) => item.masterSecret === normalized) || null;
}

// Подчистка при завершении сессии: гасим обычный legacy-токен, удаляем мастер
// session-токен (сессия к этому моменту уже не активна, удаление разрешено) и
// убираем запись реестра.
export async function deleteSessionLinks(sessionId) {
    const record = await getSessionLinksBySessionId(sessionId);
    if (!record) return;

    try {
        const legacy = getLegacyTokenByValue(record.plainToken);
        if (legacy) {
            updateLegacyToken(legacy.id, { isActive: false });
        }
    } catch {}

    try {
        if (record.masterTokenId) {
            await deleteMayakSessionToken(record.masterTokenId);
        }
    } catch {}

    await removeRecord(sessionId);
}

// Ленивое самолечение: если сессия из-под секрета исчезла (истекла и вычищена
// свипом) — гасим её обычный токен и убираем запись, чтобы ссылки не жили вечно.
export async function pruneSessionLinksIfSessionGone(sessionId) {
    const record = await getSessionLinksBySessionId(sessionId);
    if (!record) return;
    const session = await getMayakSessionById(sessionId);
    if (session) return;
    await deleteSessionLinks(sessionId);
}
