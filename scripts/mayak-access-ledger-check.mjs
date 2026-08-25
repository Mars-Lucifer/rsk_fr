// Проверка учёта входов доступа МАЯК: журнал списаний должен переживать
// истечение сессии и удаление токенов свипом.
//
// Запуск (сервер уже поднят, доступ существует):
//   node scripts/mayak-access-ledger-check.mjs http://localhost:1235 <accessId> <пароль>
//
// Что проверяется:
//   1. вход по сессионному токену увеличивает израсходованный лимит;
//   2. запись попадает в data/mayak-access-ledger.json;
//   3. после истечения сессии и её вычистки свипом расход НЕ обнуляется;
//   4. повторные чтения кабинета не задваивают журнал (baseline идемпотентен).

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [, , baseUrlArg, accessIdArg, passwordArg] = process.argv;
const BASE = baseUrlArg || "http://localhost:1235";
const ACCESS_ID = accessIdArg;
const PASSWORD = passwordArg;

if (!ACCESS_ID || !PASSWORD) {
    console.error("Укажите accessId и пароль: node scripts/mayak-access-ledger-check.mjs <base> <accessId> <пароль>");
    process.exit(2);
}

const SESSIONS_FILE = path.join(process.cwd(), "data", "mayak-sessions.json");
const TOKENS_FILE = path.join(process.cwd(), "data", "mayak-session-tokens.json");
const LEDGER_FILE = path.join(process.cwd(), "data", "mayak-access-ledger.json");

const failures = [];

function check(label, condition, detail) {
    const mark = condition ? "OK  " : "FAIL";
    console.log(`${mark} ${label}${detail ? ` — ${detail}` : ""}`);
    if (!condition) failures.push(label);
}

async function readJson(file, fallback) {
    try {
        return JSON.parse(await readFile(file, "utf-8"));
    } catch {
        return fallback;
    }
}

function accessApi(body) {
    return fetch(`${BASE}/api/mayak/delegated-access/${encodeURIComponent(ACCESS_ID)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: PASSWORD, ...body }),
    }).then((response) => response.json());
}

function consumeToken(token) {
    return fetch(`${BASE}/api/mayak/validate-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: `${token}aaaaa` }),
    }).then((response) => response.json());
}

async function ledgerCount() {
    const store = await readJson(LEDGER_FILE, { entries: [] });
    return (store.entries || []).filter((entry) => entry.accessId === ACCESS_ID).length;
}

// Двигаем срок жизни сессии и её токенов в прошлое — так выглядит сессия
// назавтра. Свип запускается сам при следующем чтении кабинета.
async function expireSession(sessionId) {
    const past = new Date(Date.now() - 60_000).toISOString();

    const sessions = await readJson(SESSIONS_FILE, { sessions: [] });
    const session = (sessions.sessions || []).find((item) => item.id === sessionId);
    if (!session) throw new Error("Сессия не найдена в хранилище");
    session.expiresAt = past;
    await writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf-8");

    const tokens = await readJson(TOKENS_FILE, { tokens: [] });
    for (const token of tokens.tokens || []) {
        if ((session.tokenIds || []).includes(token.id)) token.expiresAt = past;
    }
    await writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf-8");
}

const overviewBefore = await accessApi({ action: "overview" });
if (!overviewBefore.success) {
    console.error("Не удалось открыть кабинет:", overviewBefore.error);
    process.exit(2);
}
const usedBefore = overviewBefore.data.right.usedParticipantLimit;
const ledgerBefore = await ledgerCount();
check("baseline: журнал не меньше расхода по живым токенам", ledgerBefore >= usedBefore, `журнал ${ledgerBefore}, кабинет ${usedBefore}`);

const created = await accessApi({ action: "create_session", sessionName: "Проверка журнала", tableCount: "1" });
if (!created.success) {
    console.error("Не удалось создать сессию:", created.error);
    process.exit(2);
}
const session = created.data.createdSession;

const consumed = await consumeToken(session.token.value);
check("вход по сессионному токену прошёл", consumed.success === true, consumed.error || "");

const afterEntry = await accessApi({ action: "overview" });
const usedAfterEntry = afterEntry.data.right.usedParticipantLimit;
check("расход вырос на 1", usedAfterEntry === usedBefore + 1, `${usedBefore} → ${usedAfterEntry}`);
check("списание записано в журнал", (await ledgerCount()) === ledgerBefore + 1, `журнал ${await ledgerCount()}`);

const repeated = await accessApi({ action: "overview" });
check(
    "повторное чтение кабинета не задваивает журнал",
    (await ledgerCount()) === ledgerBefore + 1 && repeated.data.right.usedParticipantLimit === usedAfterEntry,
    `журнал ${await ledgerCount()}, кабинет ${repeated.data.right.usedParticipantLimit}`
);

await expireSession(session.sessionId);
const afterExpiry = await accessApi({ action: "overview" });
const usedAfterExpiry = afterExpiry.data.right.usedParticipantLimit;
check("расход пережил истечение сессии", usedAfterExpiry === usedAfterEntry, `${usedAfterEntry} → ${usedAfterExpiry}`);

const tokensLeft = await readJson(TOKENS_FILE, { tokens: [] });
const sessionGone = !(tokensLeft.tokens || []).some((token) => token.id === session.token.id);
check("свип действительно удалил токены истёкшей сессии", sessionGone, sessionGone ? "" : "токен ещё на месте — проверка неполная");

console.log(failures.length ? `\nПРОВАЛЕНО: ${failures.length}` : "\nВсе проверки пройдены");
process.exit(failures.length ? 1 : 0);
