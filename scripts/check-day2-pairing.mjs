// Сквозная проверка правила второго дня: шов принимает ПАРТНЁР ПО ПАРЕ.
//
// В debug-сессии это правило снято — там соло-прогон разбирает очередь своего
// стола при любой роли, иначе один человек не прошёл бы день. Значит настоящая
// маршрутизация проверяется только на обычной сессии, и проверить её можно
// только тремя участниками сразу: партнёром, автором и посторонним за тем же
// столом. Отсюда скрипт: поднимать это руками в браузере — три вкладки и
// двадцать минут, а ломается оно молча.
//
// Скрипт заводит свою сессию через админский API, гоняет сценарий и удаляет её
// за собой. Нужен запущенный дев-сервер.
//
//     node scripts/check-day2-pairing.mjs [--base http://localhost:1239]
//
// Если первый запуск сразу после правки исходника падает с пустым ответом —
// это не продукт, а дев-сервер: Next в этот момент пересобирает маршрут и
// отвечает до того, как он готов. Повторный запуск проходит.

import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const args = process.argv.slice(2);
const baseArg = args.indexOf("--base");
const BASE = baseArg >= 0 ? args[baseArg + 1] : "http://localhost:1239";

const SESSION_NAME = "__day2_pairing_check__";
const TABLE = 1;
// 13 и 14 — пара, 15 за тем же столом, но из другой пары.
const AUTHOR = { userId: "day2-check-author", name: "Автор", card: 13 };
const PARTNER = { userId: "day2-check-partner", name: "Партнёр", card: 14 };
const OUTSIDER = { userId: "day2-check-outsider", name: "Посторонний", card: 15 };

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

async function api(path, { method = "GET", body, form } = {}) {
    const headers = { ...(cookie ? { cookie } : {}) };
    let payload;
    if (form) {
        payload = form;
    } else if (body !== undefined) {
        headers["content-type"] = "application/json";
        payload = JSON.stringify(body);
    }
    const response = await fetch(`${BASE}${path}`, { method, headers, body: payload });
    const setCookie = response.headers.getSetCookie?.() || [];
    for (const raw of setCookie) {
        if (raw.startsWith("mayak_admin_auth=")) cookie = raw.split(";")[0];
    }
    const text = await response.text();
    let json = null;
    try {
        json = JSON.parse(text);
    } catch {
        json = { raw: text.slice(0, 200) };
    }
    return { status: response.status, json };
}

async function adminPassword() {
    const env = await readFile(new URL("../.env.local", import.meta.url), "utf8");
    const found = env.match(/^MAYAK_ADMIN_PASSWORD=(.*)$/m);
    if (!found) throw new Error("в .env.local нет MAYAK_ADMIN_PASSWORD");
    return found[1].trim();
}

async function register(person, sessionId) {
    const registered = await api("/api/mayak/session-runtime/participant", {
        method: "POST",
        body: { sessionId, userId: person.userId, name: person.name, organization: "проверка", tableNumber: TABLE },
    });
    assert.equal(
        registered.json?.success,
        true,
        `регистрация ${person.name}: HTTP ${registered.status} ${JSON.stringify(registered.json)}`
    );

    const claimed = await api("/api/mayak/session-runtime/card-number", {
        method: "POST",
        body: { sessionId, userId: person.userId, cardNumber: person.card },
    });
    assert.equal(claimed.json?.success, true, `номер ${person.card}: ${claimed.json?.error}`);
    return claimed.json.data;
}

async function submitDetail(person, sessionId) {
    const form = new FormData();
    form.set("sessionId", sessionId);
    form.set("userId", person.userId);
    form.set("taskNumber", String(person.card));
    form.set("taskName", `Деталь ${person.card}`);
    form.set("contentType", "Деталь");
    form.set("taskIndex", "0");
    form.set("secondsSpent", "42");
    form.set("submissionText", "https://example.org/deталь — проверка пары");
    const sent = await api("/api/mayak/session-runtime/upload", { method: "POST", form });
    assert.equal(sent.json?.success, true, `сдача детали: ${sent.json?.error}`);
    return sent.json.data;
}

const queueOf = async (person, sessionId) => {
    const state = await api(`/api/mayak/session-runtime/state?sessionId=${sessionId}&userId=${person.userId}`);
    return state.json?.data?.inspectorQueue ?? state.json?.inspectorQueue ?? [];
};

async function main() {
    console.log(`Проверка пары второго дня на ${BASE}`);

    const password = await adminPassword();
    const auth = await api("/api/admin/mayak-auth", { method: "POST", body: { password } });
    assert.equal(auth.json?.success, true, "админский пароль не подошёл");

    const created = await api("/api/admin/mayak-sessions", {
        method: "POST",
        body: {
            name: SESSION_NAME,
            sectionId: "day2",
            taskRange: "day2",
            tableCount: 3,
            tokenUsageLimit: 100,
            participantLimit: 30,
        },
    });
    assert.equal(created.json?.success, true, `сессия не создалась: ${created.json?.error}`);
    const sessionId = created.json.data.id;

    try {
        await register(AUTHOR, sessionId);
        await register(PARTNER, sessionId);
        await register(OUTSIDER, sessionId);

        // Берёт зарегистрированный участник, а не выдуманный: незарегистрированного
        // отсекает более ранняя проверка, и занятость тайла осталась бы непройденной.
        const taken = await api("/api/mayak/session-runtime/card-number", {
            method: "POST",
            body: { sessionId, userId: OUTSIDER.userId, cardNumber: AUTHOR.card },
        });
        check("занятый тайл вторым не берётся", () => {
            assert.equal(taken.json?.success, false, JSON.stringify(taken.json));
            assert.match(String(taken.json?.error), /взят/i);
        });

        const stranger = await api("/api/mayak/session-runtime/card-number", {
            method: "POST",
            body: { sessionId, userId: "day2-check-stranger", cardNumber: 16 },
        });
        check("незарегистрированный номер не получает", () => {
            assert.equal(stranger.json?.success, false, JSON.stringify(stranger.json));
        });

        const wrongTable = await api("/api/mayak/session-runtime/card-number", {
            method: "POST",
            body: { sessionId, userId: OUTSIDER.userId, cardNumber: 25 },
        });
        check("тайл чужого стола не берётся", () => {
            assert.equal(wrongTable.json?.success, false);
            assert.match(String(wrongTable.json?.error), /стол/i);
        });

        const foreign = new FormData();
        foreign.set("sessionId", sessionId);
        foreign.set("userId", AUTHOR.userId);
        foreign.set("taskNumber", String(OUTSIDER.card));
        foreign.set("taskName", "Чужая деталь");
        foreign.set("submissionText", "попытка сдать не своё");
        const sentForeign = await api("/api/mayak/session-runtime/upload", { method: "POST", form: foreign });
        check("чужое задание не сдаётся даже в обход экрана", () => {
            assert.equal(sentForeign.json?.success, false, JSON.stringify(sentForeign.json));
            assert.match(String(sentForeign.json?.error), /не ваше/i);
        });

        const review = await submitDetail(AUTHOR, sessionId);
        const reviewId = review?.review?.id || review?.reviewId || review?.id;
        assert.ok(reviewId, "сервер не вернул id заявки");

        const partnerQueue = await queueOf(PARTNER, sessionId);
        check("партнёр видит шов в своей очереди", () => {
            assert.equal(partnerQueue.length, 1);
            assert.equal(String(partnerQueue[0].taskNumber), String(AUTHOR.card));
        });

        const outsiderQueue = await queueOf(OUTSIDER, sessionId);
        check("сосед по столу из другой пары шва не видит", () => {
            assert.equal(outsiderQueue.length, 0);
        });

        const authorQueue = await queueOf(AUTHOR, sessionId);
        check("автор не проверяет сам себя", () => {
            assert.equal(authorQueue.length, 0);
        });

        const byOutsider = await api("/api/mayak/session-runtime/review", {
            method: "POST",
            body: { sessionId, reviewId, inspectorUserId: OUTSIDER.userId, action: "approve" },
        });
        check("посторонний не может принять шов", () => {
            assert.equal(byOutsider.json?.success, false);
            assert.match(String(byOutsider.json?.error), /партнёр/i);
        });

        const byPartner = await api("/api/mayak/session-runtime/review", {
            method: "POST",
            body: { sessionId, reviewId, inspectorUserId: PARTNER.userId, action: "approve" },
        });
        check("партнёр принимает шов", () => {
            assert.equal(byPartner.json?.success, true, byPartner.json?.error);
        });

        // Нечётный состав стола: тайл 16 не взял никто, поэтому шов держателя 15
        // не увидит партнёр — его нет. Такой шов открывается всему столу, иначе
        // человек заперт до вечера.
        const orphanReview = await submitDetail(OUTSIDER, sessionId);
        const orphanId = orphanReview?.review?.id || orphanReview?.reviewId || orphanReview?.id;

        const seenByAuthor = await queueOf(AUTHOR, sessionId);
        check("шов без партнёра виден соседу по столу", () => {
            assert.equal(seenByAuthor.length, 1, JSON.stringify(seenByAuthor.map((r) => r.taskNumber)));
            assert.equal(String(seenByAuthor[0].taskNumber), String(OUTSIDER.card));
        });

        const orphanBySelf = await api("/api/mayak/session-runtime/review", {
            method: "POST",
            body: { sessionId, reviewId: orphanId, inspectorUserId: OUTSIDER.userId, action: "approve" },
        });
        check("но сам себе его не принять и без партнёра", () => {
            assert.equal(orphanBySelf.json?.success, false, JSON.stringify(orphanBySelf.json));
        });

        const orphanByNeighbour = await api("/api/mayak/session-runtime/review", {
            method: "POST",
            body: { sessionId, reviewId: orphanId, inspectorUserId: AUTHOR.userId, action: "approve" },
        });
        check("сосед принимает шов без партнёра", () => {
            assert.equal(orphanByNeighbour.json?.success, true, orphanByNeighbour.json?.error);
        });

        const authorState = await api(`/api/mayak/session-runtime/state?sessionId=${sessionId}&userId=${AUTHOR.userId}`);
        const states = authorState.json?.data?.participant?.taskStates ?? authorState.json?.participant?.taskStates ?? [];
        check("деталь автора стала принятой", () => {
            const own = states.find((task) => String(task.taskNumber) === String(AUTHOR.card));
            assert.ok(own, "задания нет в состоянии участника");
            assert.equal(own.status, "approved");
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
