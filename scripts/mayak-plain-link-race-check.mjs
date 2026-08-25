// Проверка гонки на ссылке «Без инспектора»: N одновременных входов должны
// увеличить счётчик ровно на N, без потерянных инкрементов.
//
// Запуск (сервер поднят, доступ существует):
//   node scripts/mayak-plain-link-race-check.mjs http://localhost:1235 <accessId> <пароль> [N]
//
// Внимание: N реальных входов, они списывают лимит доступа. По умолчанию 10.

import { readFile } from "node:fs/promises";
import path from "node:path";

const [, , baseArg, accessIdArg, passwordArg, countArg] = process.argv;
const BASE = baseArg || "http://localhost:1235";
const ACCESS_ID = accessIdArg;
const PASSWORD = passwordArg;
const COUNT = Number(countArg) || 10;

if (!ACCESS_ID || !PASSWORD) {
    console.error("Укажите accessId и пароль");
    process.exit(2);
}

const LINKS_FILE = path.join(process.cwd(), "data", "mayak-session-links.json");
const LEGACY_FILE = path.join(process.cwd(), "data", "mayakTokens.json");
const LEDGER_FILE = path.join(process.cwd(), "data", "mayak-access-ledger.json");

const failures = [];
function check(label, condition, detail) {
    console.log(`${condition ? "OK  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
    if (!condition) failures.push(label);
}

async function readJson(file, fallback) {
    try {
        return JSON.parse(await readFile(file, "utf-8"));
    } catch {
        return fallback;
    }
}

const cabinet = (action, body = {}) =>
    fetch(`${BASE}/api/mayak/delegated-access/${encodeURIComponent(ACCESS_ID)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, password: PASSWORD, ...body }),
    }).then((r) => r.json());

const created = await cabinet("create_session", { sessionName: "race-check", tableCount: 1 });
const session = created?.data?.createdSession;
if (!session?.sessionId) {
    console.error("Не удалось создать сессию:", created?.error || created);
    process.exit(1);
}

try {
    const links = await readJson(LINKS_FILE, { links: [] });
    const record = (links.links || []).find((item) => item.sessionId === session.sessionId);
    const plainToken = record?.plainToken;

    const before = (await readJson(LEGACY_FILE, { tokens: [] })).tokens.find((t) => t.token === plainToken);
    const ledgerBefore = (await readJson(LEDGER_FILE, { entries: [] })).entries.length;

    // Все запросы уходят одной пачкой — именно так входит группа со сцены.
    const results = await Promise.all(
        Array.from({ length: COUNT }, () =>
            fetch(`${BASE}/api/mayak/validate-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: `${plainToken}aaaaa` }),
            }).then((r) => r.json())
        )
    );

    const okCount = results.filter((r) => r.success).length;
    check(`все ${COUNT} входов приняты`, okCount === COUNT, `успешных ${okCount}`);

    const after = (await readJson(LEGACY_FILE, { tokens: [] })).tokens.find((t) => t.token === plainToken);
    const grew = (after?.usedCount || 0) - (before?.usedCount || 0);
    check(
        `счётчик токена вырос ровно на ${COUNT}`,
        grew === COUNT,
        `${before?.usedCount} → ${after?.usedCount} (+${grew})`
    );

    const ledgerAfter = (await readJson(LEDGER_FILE, { entries: [] })).entries.length;
    check(
        `в журнал доступа попало ${COUNT} записей`,
        ledgerAfter - ledgerBefore === COUNT,
        `${ledgerBefore} → ${ledgerAfter}`
    );

    // Остаток в ответе — справочный: он читается после списания, но вне того же
    // лока, поэтому два одновременных ответа могут показать одно значение.
    // Инвариант тут другой: ни один ответ не обещает больше, чем было до пачки,
    // и не уходит в минус. Точный учёт держат две проверки выше.
    const startRemaining = Math.max(0, (before?.usageLimit || 0) - (before?.usedCount || 0));
    const remaining = results.map((r) => r.remainingAttempts).filter((v) => Number.isFinite(v));
    check(
        "остаток в ответах не завышен и не отрицателен",
        remaining.every((value) => value >= 0 && value <= startRemaining),
        `диапазон ${Math.min(...remaining)}..${Math.max(...remaining)} при старте ${startRemaining}`
    );
} finally {
    await cabinet("complete_session", { sessionId: session.sessionId });
}

console.log(failures.length ? `\nПРОВАЛЕНО: ${failures.length}` : "\nВсё зелёное: инкременты не теряются");
process.exit(failures.length ? 1 : 0);
