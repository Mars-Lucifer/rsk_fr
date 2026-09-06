// Разовое продление живых мастерских сессий до 48 часов от их создания.
//
// Зачем: срок жизни ссылок вырос с 24 до 48 часов (DEFAULT_TOKEN_TTL_MS в
// mayakAdminRights.js), но константа применяется только при создании — уже
// выданные сессии несут старый expiresAt в данных. Без миграции занятия,
// начатые до выкатки, оборвутся на суточной границе, хотя мастеру обещаны
// двое суток.
//
// Что делает: живым сессиям source === "delegated-admin" ставит
// expiresAt = createdAt + 48ч, их токенам (по tokenIds сессии) — новый срок
// сессии. Срок только растёт: записи, у которых он уже 48ч или длиннее,
// не трогаются, повторный запуск ничего не меняет. Истёкшие не воскрешает:
// их токены мог уже удалить свип, и «ожившая» карточка осталась бы без
// работающих ссылок.
//
// Запуск на сервере из корня проекта, сервер останавливать не нужно —
// запись идёт через тот же файловый лок, что использует рантайм:
//
//   node scripts/extend-delegated-sessions-48h.mjs          # показать план
//   node scripts/extend-delegated-sessions-48h.mjs --apply  # применить

import path from "node:path";
import { readJsonFile, withJsonFileLock, writeJsonFileAtomic } from "../src/lib/jsonFileLock.js";

const TTL_MS = 48 * 60 * 60 * 1000;
const APPLY = process.argv.includes("--apply");

const SESSIONS_FILE = path.join(process.cwd(), "data", "mayak-sessions.json");
const TOKENS_FILE = path.join(process.cwd(), "data", "mayak-session-tokens.json");

const now = Date.now();

// Новый срок или null, если продлевать нечего (не делегированная, истекла,
// уже 48ч и длиннее, битые даты).
function extendedExpiry(session) {
    if (String(session?.source || "") !== "delegated-admin") return null;
    const createdTs = Date.parse(session?.createdAt || "");
    const currentTs = Date.parse(session?.expiresAt || "");
    if (!Number.isFinite(createdTs) || !Number.isFinite(currentTs)) return null;
    if (currentTs <= now) return null;
    const nextTs = createdTs + TTL_MS;
    // Допуск в минуту: expiresAt при создании считается на миллисекунды раньше
    // createdAt, и без допуска скрипт «продлевал» бы 48-часовые записи на эти
    // миллисекунды при каждом запуске.
    if (nextTs <= currentTs + 60 * 1000) return null;
    return new Date(nextTs).toISOString();
}

// tokenId -> новый срок его сессии. Собирается на этапе сессий, применяется
// на этапе токенов: у токена нет ссылки на сессию, связь хранит сессия.
const tokenExpiry = new Map();
let sessionsTouched = 0;

await withJsonFileLock(SESSIONS_FILE, async () => {
    const store = await readJsonFile(SESSIONS_FILE, { sessions: [] });
    const sessions = Array.isArray(store?.sessions) ? store.sessions : [];

    for (const session of sessions) {
        const next = extendedExpiry(session);
        if (!next) continue;

        console.log(`сессия «${String(session.name || session.id).slice(0, 40)}»: ${session.expiresAt} -> ${next}`);
        sessionsTouched += 1;
        for (const tokenId of Array.isArray(session.tokenIds) ? session.tokenIds : []) {
            tokenExpiry.set(String(tokenId), next);
        }
        if (APPLY) session.expiresAt = next;
    }

    if (APPLY && sessionsTouched) await writeJsonFileAtomic(SESSIONS_FILE, store);
});

let tokensTouched = 0;
await withJsonFileLock(TOKENS_FILE, async () => {
    const store = await readJsonFile(TOKENS_FILE, { tokens: [] });
    const tokens = Array.isArray(store?.tokens) ? store.tokens : [];

    for (const token of tokens) {
        const next = tokenExpiry.get(String(token?.id || ""));
        if (!next) continue;
        const currentTs = Date.parse(token?.expiresAt || "");
        if (Number.isFinite(currentTs) && currentTs >= Date.parse(next)) continue;

        console.log(`токен «${String(token.name || token.token).slice(0, 40)}»: ${token.expiresAt || "—"} -> ${next}`);
        tokensTouched += 1;
        if (APPLY) token.expiresAt = next;
    }

    if (APPLY && tokensTouched) await writeJsonFileAtomic(TOKENS_FILE, store);
});

console.log(`\nСессий к продлению: ${sessionsTouched}, токенов: ${tokensTouched}.`);
console.log(APPLY ? "Применено." : "Ничего не записано — сухой прогон. Применить: --apply");
