// Сквозная проверка синхронного такта второго дня.
//
// Главное требование ТЗ (раздел В10) — время такта задаёт СЕРВЕР, а не клиент:
// иначе три команды разойдутся на минуты, а к финалу на четверть часа. Проверять
// это глазами бессмысленно — расхождение видно только когда участников много и
// день уже идёт. Поэтому здесь два участника за разными столами спрашивают
// состояние независимо и обязаны получить одну и ту же метку конца такта.
//
//     node scripts/check-day2-takt.mjs [--base http://localhost:1239]

import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const args = process.argv.slice(2);
const baseArg = args.indexOf("--base");
const BASE = baseArg >= 0 ? args[baseArg + 1] : "http://localhost:1239";

const A = { userId: "day2-takt-a", name: "Первый", table: 1, card: 11 };
const B = { userId: "day2-takt-b", name: "Второй", table: 2, card: 21 };

let cookie = "";
let passed = 0;

function check(name, fn) {
    try {
        fn();
        passed += 1;
        console.log(`  ok  ${name}`);
    } catch (error) {
        console.error(`  FAIL ${name}\n       ${error.message}`);
        process.exitCode = 1;
    }
}

async function api(path, { method = "GET", body } = {}) {
    const headers = { ...(cookie ? { cookie } : {}) };
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const raw of response.headers.getSetCookie?.() || []) {
        if (raw.startsWith("mayak_admin_auth=")) cookie = raw.split(";")[0];
    }
    const text = await response.text();
    try {
        return { status: response.status, json: JSON.parse(text) };
    } catch {
        return { status: response.status, json: { raw: text.slice(0, 200) } };
    }
}

const taktOf = async (person, sessionId) => {
    const state = await api(`/api/mayak/session-runtime/state?sessionId=${sessionId}&userId=${person.userId}`);
    return state.json?.data?.day2Takt ?? state.json?.day2Takt ?? null;
};

async function main() {
    console.log(`Проверка такта второго дня на ${BASE}`);

    const env = await readFile(new URL("../.env.local", import.meta.url), "utf8");
    const password = env.match(/^MAYAK_ADMIN_PASSWORD=(.*)$/m)?.[1]?.trim();
    assert.ok(password, "в .env.local нет MAYAK_ADMIN_PASSWORD");
    const auth = await api("/api/admin/mayak-auth", { method: "POST", body: { password } });
    assert.equal(auth.json?.success, true, "админский пароль не подошёл");

    const created = await api("/api/admin/mayak-sessions", {
        method: "POST",
        body: {
            name: "__day2_takt_check__",
            sectionId: "day2",
            taskRange: "day2",
            tableCount: 3,
            tokenUsageLimit: 100,
            participantLimit: 30,
        },
    });
    assert.equal(created.json?.success, true, `сессия не создалась: ${created.json?.error}`);
    const sessionId = created.json.data.id;
    const takt = (action, minutes) =>
        api("/api/mayak/master/day2-takt", { method: "POST", body: { sessionId, action, minutes } });

    try {
        for (const person of [A, B]) {
            await api("/api/mayak/session-runtime/participant", {
                method: "POST",
                body: { sessionId, userId: person.userId, name: person.name, organization: "проверка", tableNumber: person.table },
            });
            await api("/api/mayak/session-runtime/card-number", {
                method: "POST",
                body: { sessionId, userId: person.userId, cardNumber: person.card },
            });
        }

        const before = await taktOf(A, sessionId);
        check("до старта такт первый и не идёт", () => {
            assert.equal(before?.index, 1);
            assert.equal(before?.running, false);
            assert.equal(before?.remainingSeconds, 90 * 60);
            assert.equal(before?.expiresAt, null);
        });

        const started = await takt("start");
        check("ведущий запускает такт", () => {
            assert.equal(started.json?.success, true, started.json?.error);
            assert.equal(started.json?.data?.running, true);
        });

        const [seenByA, seenByB] = await Promise.all([taktOf(A, sessionId), taktOf(B, sessionId)]);
        check("оба стола видят один и тот же конец такта", () => {
            assert.ok(seenByA?.expiresAt, "у первого нет метки конца");
            assert.equal(seenByA.expiresAt, seenByB.expiresAt);
            assert.equal(seenByA.index, seenByB.index);
        });
        check("остаток близок к 90 минутам и считается сервером", () => {
            assert.ok(seenByA.remainingSeconds > 89 * 60, `остаток ${seenByA.remainingSeconds}`);
            assert.ok(seenByA.remainingSeconds <= 90 * 60);
        });

        const shifted = await takt("shift", 10);
        check("сдвиг на десять минут пересчитывает конец такта", () => {
            assert.equal(shifted.json?.success, true, shifted.json?.error);
            assert.equal(shifted.json?.data?.durationSeconds, 100 * 60);
        });

        const afterShift = await taktOf(B, sessionId);
        check("сдвиг доехал до участника другого стола", () => {
            assert.equal(afterShift.durationSeconds, 100 * 60);
            assert.notEqual(afterShift.expiresAt, seenByB.expiresAt);
        });

        const next = await takt("next");
        check("следующий такт — семьдесят минут", () => {
            assert.equal(next.json?.success, true, next.json?.error);
            assert.equal(next.json?.data?.index, 2);
            assert.equal(next.json?.data?.durationSeconds, 70 * 60);
            assert.match(String(next.json?.data?.label), /узел/i);
        });

        await takt("next");
        const past = await takt("next");
        check("за третьим тактом такта нет", () => {
            assert.equal(past.json?.success, false);
            assert.match(String(past.json?.error), /последний/i);
        });

        const stopped = await takt("stop");
        check("такт снимается, номер остаётся", () => {
            assert.equal(stopped.json?.success, true, stopped.json?.error);
            assert.equal(stopped.json?.data?.running, false);
            assert.equal(stopped.json?.data?.index, 3);
        });

        const noSecret = await fetch(`${BASE}/api/mayak/master/day2-takt`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId, action: "start" }),
        });
        check("без пароля и без ссылки такт не двигается", () => {
            assert.equal(noSecret.status, 401);
        });
    } finally {
        await api(`/api/admin/mayak-sessions/${sessionId}`, { method: "DELETE" });
    }

    console.log(process.exitCode ? "\nЕсть падения." : `\nВсё сошлось: ${passed} проверок.`);
}

main().catch((error) => {
    console.error("Проверка не доехала:", error.message);
    process.exitCode = 1;
});
