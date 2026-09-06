// Проверка ссылки «Без инспектора»: она живёт ровно столько же, сколько сессия,
// и расходует входы из того же оплаченного лимита доступа.
//
// Запуск (сервер уже поднят, доступ существует):
//   node scripts/mayak-plain-link-check.mjs http://localhost:1235 <accessId> <пароль>
//
// Что проверяется:
//   1. у обычной ссылки новой сессии проставлен expiresAt, равный сроку сессии;
//   2. пока сессия жива — токен валиден, счётчик показывает общий лимит доступа;
//   3. вход по обычной ссылке увеличивает израсходованный лимит доступа и
//      попадает в журнал списаний;
//   4. после отматывания expiresAt в прошлое вход по ссылке отбивается;
//   5. ручные токены из админки (без expiresAt) остаются бессрочными.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [, , baseUrlArg, accessIdArg, passwordArg] = process.argv;
const BASE = baseUrlArg || "http://localhost:1235";
const ACCESS_ID = accessIdArg;
const PASSWORD = passwordArg;

if (!ACCESS_ID || !PASSWORD) {
    console.error("Укажите accessId и пароль: node scripts/mayak-plain-link-ttl-check.mjs <base> <accessId> <пароль>");
    process.exit(2);
}

const LINKS_FILE = path.join(process.cwd(), "data", "mayak-session-links.json");
const LEGACY_FILE = path.join(process.cwd(), "data", "mayakTokens.json");
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

async function api(action, body = {}) {
    const response = await fetch(`${BASE}/api/mayak/delegated-access/${encodeURIComponent(ACCESS_ID)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, password: PASSWORD, ...body }),
    });
    return response.json();
}

async function validate(token) {
    const response = await fetch(`${BASE}/api/mayak/validate-token?token=${encodeURIComponent(`${token}aaaaa`)}`);
    return response.json();
}

async function consume(token) {
    const response = await fetch(`${BASE}/api/mayak/validate-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: `${token}aaaaa` }),
    });
    return response.json();
}

async function usedByAccess() {
    const overview = await api("overview");
    return overview?.data?.right?.usedParticipantLimit ?? -1;
}

const created = await api("create_session", { sessionName: "ttl-check", tableCount: 1 });
const sessionId = created?.data?.createdSession?.sessionId;
if (!sessionId) {
    console.error("Не удалось создать сессию:", created?.error || created);
    process.exit(1);
}

try {
    const links = await readJson(LINKS_FILE, { links: [] });
    const record = (links.links || []).find((item) => item.sessionId === sessionId);
    const legacyStore = await readJson(LEGACY_FILE, { tokens: [] });
    const plain = (legacyStore.tokens || []).find((item) => item.token === record?.plainToken);

    check("обычная ссылка создана", Boolean(plain), plain?.name);
    check(
        "у обычной ссылки есть expiresAt сессии",
        plain?.expiresAt && plain.expiresAt === created.data.createdSession.expiresAt,
        plain?.expiresAt || "нет поля"
    );

    const before = await validate(record.plainToken);
    check("живая ссылка валидна", before.valid === true, before.error || "");

    const usedBefore = await usedByAccess();
    const ledgerBefore = (await readJson(LEDGER_FILE, { entries: [] })).entries.length;
    check(
        "счётчик обычной ссылки — общий лимит доступа",
        before.usedCount === usedBefore,
        `${before.usedCount}/${before.usageLimit} при ${usedBefore} у доступа`
    );

    const spent = await consume(record.plainToken);
    check("вход по обычной ссылке прошёл", spent.success === true, spent.error || "");

    const usedAfter = await usedByAccess();
    const ledgerAfter = (await readJson(LEDGER_FILE, { entries: [] })).entries.length;
    check("израсходованный лимит доступа вырос на 1", usedAfter === usedBefore + 1, `${usedBefore} → ${usedAfter}`);
    check("запись попала в журнал списаний", ledgerAfter === ledgerBefore + 1, `${ledgerBefore} → ${ledgerAfter}`);

    // Отматываем срок в прошлое — эмуляция истечения суток.
    const store = await readJson(LEGACY_FILE, { tokens: [] });
    const index = store.tokens.findIndex((item) => item.token === record.plainToken);
    store.tokens[index].expiresAt = new Date(Date.now() - 60_000).toISOString();
    await writeFile(LEGACY_FILE, JSON.stringify(store, null, 2), "utf-8");

    const after = await validate(record.plainToken);
    check("истёкшая ссылка невалидна", after.valid === false, after.error || "");

    const manual = (store.tokens || []).find((item) => !item.expiresAt);
    if (manual) {
        const manualResult = await validate(manual.token);
        check(
            "ручной токен без expiresAt не сломан",
            manualResult.error !== "Срок действия ссылки истёк",
            manualResult.error || "валиден"
        );
    }
} finally {
    await api("complete_session", { sessionId });
}

console.log(failures.length ? `\nПРОВАЛЕНО: ${failures.length}` : "\nВсё зелёное");
process.exit(failures.length ? 1 : 0);
