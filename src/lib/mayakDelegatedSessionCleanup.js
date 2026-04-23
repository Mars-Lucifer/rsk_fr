import path from "path";
import { promises as fs } from "fs";

const SESSIONS_FILE = path.join(process.cwd(), "data", "mayak-sessions.json");
const TOKENS_FILE = path.join(process.cwd(), "data", "mayak-session-tokens.json");
const RUNTIME_FILE = path.join(process.cwd(), "data", "mayak-session-runtime.json");
const SESSION_FILES_ROOT = path.join(process.cwd(), "data", "mayak-session-files");

function isObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
}

async function readJsonFile(filePath, fallbackValue) {
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallbackValue : parsed;
    } catch {
        return fallbackValue;
    }
}

async function writeJsonFile(filePath, value) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempFile = `${filePath}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(value, null, 2), "utf-8");
    await fs.rename(tempFile, filePath);
}

function isExpiredDelegatedItem(item, nowTs) {
    if (!isObject(item)) return false;
    if (String(item.source || "") !== "delegated-admin") return false;
    const expiresAt = String(item.expiresAt || "").trim();
    if (!expiresAt) return false;
    const expiresTs = Date.parse(expiresAt);
    return Number.isFinite(expiresTs) && expiresTs <= nowTs;
}

export async function sweepExpiredDelegatedMayakSessions({ now = Date.now() } = {}) {
    const sessionsStore = await readJsonFile(SESSIONS_FILE, { sessions: [] });
    const tokensStore = await readJsonFile(TOKENS_FILE, { tokens: [] });
    const runtimeStore = await readJsonFile(RUNTIME_FILE, { sessions: {} });

    const sessions = Array.isArray(sessionsStore?.sessions) ? sessionsStore.sessions : [];
    const tokens = Array.isArray(tokensStore?.tokens) ? tokensStore.tokens : [];
    const runtimeSessions = isObject(runtimeStore?.sessions) ? runtimeStore.sessions : {};

    const expiredSessions = sessions.filter((session) => isExpiredDelegatedItem(session, now));
    const expiredSessionIds = new Set(expiredSessions.map((session) => String(session.id || "").trim()).filter(Boolean));
    const expiredSessionTokenIds = new Set(
        expiredSessions.flatMap((session) =>
            Array.isArray(session?.tokenIds) ? session.tokenIds.map((tokenId) => String(tokenId || "").trim()).filter(Boolean) : []
        )
    );

    const expiredTokenIds = new Set(
        tokens
            .filter((token) => isExpiredDelegatedItem(token, now))
            .map((token) => String(token.id || "").trim())
            .filter(Boolean)
    );

    expiredSessionTokenIds.forEach((tokenId) => expiredTokenIds.add(tokenId));

    const nextSessions = sessions.filter((session) => !expiredSessionIds.has(String(session.id || "").trim()));
    const nextTokens = tokens.filter((token) => !expiredTokenIds.has(String(token.id || "").trim()));

    let runtimeChanged = false;
    for (const sessionId of expiredSessionIds) {
        if (runtimeSessions[sessionId]) {
            delete runtimeSessions[sessionId];
            runtimeChanged = true;
        }
    }

    if (nextSessions.length !== sessions.length) {
        await writeJsonFile(SESSIONS_FILE, { sessions: nextSessions });
    }

    if (nextTokens.length !== tokens.length) {
        await writeJsonFile(TOKENS_FILE, { tokens: nextTokens });
    }

    if (runtimeChanged) {
        await writeJsonFile(RUNTIME_FILE, { sessions: runtimeSessions });
    }

    await Promise.all(
        Array.from(expiredSessionIds).map((sessionId) =>
            fs.rm(path.join(SESSION_FILES_ROOT, sessionId), { recursive: true, force: true }).catch(() => {})
        )
    );

    return {
        expiredSessionIds: Array.from(expiredSessionIds),
        expiredTokenIds: Array.from(expiredTokenIds),
    };
}
