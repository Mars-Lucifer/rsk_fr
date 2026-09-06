// Наполнение сессии реальными данными для просмотра дашборда.
//
// В отличие от mayak-session-sim.mjs (это тест с ассертами и негативными
// сценариями) здесь только наполнение: сессия создаётся от лица внешнего
// доступа — так же, как её создаёт мастер в кабинете, — и в неё заводятся
// участники, роли, сданные и проверенные задания.
//
// Запуск (сервер поднят, доступ существует):
//   node scripts/mayak-session-fill.mjs http://localhost:1235 <accessId> <пароль>
//
// Внимание: каждый участник — реальный вход, он списывает вход из лимита
// доступа. 18 участников = 18 входов.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const [, , baseArg, accessIdArg, passwordArg] = process.argv;
const BASE = baseArg || "http://localhost:1235";
const ACCESS_ID = accessIdArg;
const PASSWORD = passwordArg;
const TABLE_COUNT = Number(process.env.TABLES || 3);
const PER_TABLE = Number(process.env.PER_TABLE || 6);

if (!ACCESS_ID || !PASSWORD) {
    console.error("Укажите accessId и пароль: node scripts/mayak-session-fill.mjs <base> <accessId> <пароль>");
    process.exit(2);
}

const orgs = ["РСК", "Сенеж", "Смена", "Артек", "ВДЦ", "Долголетие"];
// Полные ФИО: в дашборде колонка участника должна проверяться на реальной
// длине строки, а не на «Анна А.».
const names = [
    "Астахова Анна Петровна", "Белов Борис Игоревич", "Воронцова Вера Сергеевна",
    "Гаврилов Глеб Андреевич", "Дмитриева Дарья Олеговна", "Ершов Егор Максимович",
    "Жукова Жанна Валерьевна", "Зайцев Захар Дмитриевич", "Ильина Ирина Николаевна",
    "Ковалёв Кирилл Артёмович", "Лебедева Лариса Викторовна", "Морозов Максим Павлович",
    "Никитина Нина Аркадьевна", "Орлов Олег Тимофеевич", "Панкратова Полина Романовна",
    "Рожков Роман Степанович", "Соловьёва Софья Ильинична", "Тарасов Тимур Русланович",
];

async function api(method, pathname, { json, formFactory, query } = {}) {
    const url = new URL(pathname, BASE);
    if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    const init = { method, headers: {} };
    if (json) {
        init.headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(json);
    }
    if (formFactory) init.body = formFactory();
    const res = await fetch(url, init);
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }
    return { status: res.status, data };
}

const cabinet = (action, body = {}) =>
    api("POST", `/api/mayak/delegated-access/${encodeURIComponent(ACCESS_ID)}`, { json: { action, password: PASSWORD, ...body } });

// Инспектор стола N проверяет стол N+1 (кольцо), значит участника стола P
// проверяет инспектор стола P-1.
const reviewerTableFor = (table) => (table === 1 ? TABLE_COUNT : table - 1);

// CLEANUP=1 — завершить остальные активные сессии доступа, чтобы в кабинете
// осталась только эта демонстрационная.
if (process.env.CLEANUP === "1") {
    const overview = await cabinet("overview");
    for (const item of overview?.data?.data?.sessions || []) {
        await cabinet("complete_session", { sessionId: item.sessionId });
        console.log(`завершена прежняя сессия: ${item.sessionName || item.sessionId}`);
    }
}

const created = await cabinet("create_session", { sessionName: `Демо ${TABLE_COUNT}×${PER_TABLE}`, tableCount: TABLE_COUNT });
const session = created?.data?.data?.createdSession;
if (!session?.sessionId) {
    console.error("Не удалось создать сессию:", created?.data?.error || created?.data || created);
    process.exit(1);
}
const { sessionId, sectionId } = session;
const tokenValue = session.token.value;

// Задания колоды: base = позиция в колоде, index — то, чем оперирует рантайм.
const bundle = await api("GET", "/api/mayak/content-bundle", { query: { sectionId } });
const rawTasks = bundle.data?.data?.tasks || [];
const tasks = rawTasks.map((task, index) => ({
    index,
    base: index + 1,
    number: String(task.number || ""),
    title: task.title || "",
    contentType: task.contentType || "",
}));
if (tasks.length === 0) {
    console.error("Колода пуста — нечего сдавать. Проверьте MAYAK_CONTENT_DIR.");
    process.exit(1);
}

const startTasks = tasks.filter((t) => t.base <= 10 && t.contentType);
const yaTasks = tasks.filter((t) => t.base > 10 && t.base <= 50 && t.contentType && !/карта настроения/i.test(t.contentType));
const weTasks = tasks.filter((t) => t.base > 50 && t.contentType && !/карта настроения/i.test(t.contentType));

console.log(`Сессия «${session.sessionName}» (${sectionId}): ${TABLE_COUNT} стола × ${PER_TABLE} = ${TABLE_COUNT * PER_TABLE} чел.`);

// 1. Входы, регистрация, роли ------------------------------------------------
const participants = [];
for (let i = 0; i < TABLE_COUNT * PER_TABLE; i += 1) {
    const table = Math.floor(i / PER_TABLE) + 1;
    const isInspector = i % PER_TABLE === 0;
    const userId = `guest-${sessionId}-${crypto.randomUUID()}`;
    const name = names[i % names.length];

    const entry = await api("POST", "/api/mayak/validate-token", { json: { token: tokenValue } });
    if (!entry.data?.success) {
        console.error(`Вход участника ${i + 1} отклонён:`, entry.data?.error);
        break;
    }

    const reg = await api("POST", "/api/mayak/session-runtime/participant", {
        json: { sessionId, userId, name, organization: orgs[i % orgs.length], tableNumber: table },
    });
    if (!reg.data?.success) {
        console.error(`Регистрация ${name} не прошла:`, reg.data?.error);
        continue;
    }

    await api("POST", "/api/mayak/session-runtime/role", {
        json: { sessionId, userId, role: isInspector ? "Инспектор" : "Участник" },
    });
    participants.push({ userId, name, table, isInspector });
}
console.log(`Зарегистрировано: ${participants.length}, инспекторов: ${participants.filter((p) => p.isInspector).length}`);

// 2. Задания и кольцевое ревью ------------------------------------------------
const inspectorOf = (table) => participants.find((p) => p.isInspector && p.table === table);

async function submit(participant, task) {
    return api("POST", "/api/mayak/session-runtime/upload", {
        formFactory: () => {
            const fd = new FormData();
            fd.append("sessionId", sessionId);
            fd.append("userId", participant.userId);
            fd.append("taskNumber", task.number);
            fd.append("taskIndex", String(task.index));
            fd.append("taskName", task.title || `Задание ${task.number}`);
            fd.append("taskTitle", task.title || "");
            fd.append("contentType", task.contentType || "");
            fd.append("submissionText", `Ответ ${participant.name} по заданию ${task.number}`);
            fd.append("secondsSpent", String(60 + ((task.index * 7) % 240)));
            return fd;
        },
    });
}

async function reviewLatest(participant, approve) {
    const inspector = inspectorOf(reviewerTableFor(participant.table));
    if (!inspector) return false;

    // Заявка появляется в очереди инспектора не мгновенно: сдача и чтение
    // состояния идут через разные локи рантайма. Без ретрая теряется первая
    // сдача участника, и он навсегда остаётся на предыдущей фазе.
    let item = null;
    for (let attempt = 0; attempt < 4 && !item; attempt += 1) {
        if (attempt) await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        const state = await api("GET", "/api/mayak/session-runtime/state", { query: { sessionId, userId: inspector.userId } });
        const queue = state.data?.data?.inspectorQueue || [];
        item = queue.find((r) => r.participantUserId === participant.userId) || null;
    }
    if (!item) return false;
    const res = await api("POST", "/api/mayak/session-runtime/review", {
        json: {
            sessionId,
            reviewId: item.id,
            inspectorUserId: inspector.userId,
            action: approve ? "approve" : "reject",
            comment: approve ? "" : "Не хватает конкретики, доработайте",
        },
    });
    return res.data?.success === true;
}

// Фазы прогресса «Я»: старт (нужно 4 задания base 1..10) → форматы (6 разных
// из base 10..50) → выбор направления → специализация (4 задания выбранного
// формата, даёт звезду) → часть «Мы». Раскладываем участников стола по разным
// фазам, чтобы дашборд показывал живую картину, а не один и тот же экран.
const byFormat = (formatName) => yaTasks.filter((t) => t.contentType.toLowerCase().startsWith(formatName));
const FORMATS = ["текст", "аудио", "изображение", "интерактив", "видео", "данные"];
const oneOfEachFormat = FORMATS.map((f) => byFormat(f)[0]).filter(Boolean);

// Направление специализации уникально в пределах стола — раздаём разные.
const SPEC_BY_LEVEL = { 3: "текст", 4: "аудио" };

function planFor(level) {
    if (level === 0) return { tasks: startTasks.slice(0, 2), direction: null }; // застрял на старте
    if (level === 1) return { tasks: [...startTasks.slice(0, 4), ...oneOfEachFormat.slice(0, 3)], direction: null };
    if (level === 2) return { tasks: [...startTasks.slice(0, 4), ...oneOfEachFormat], direction: null }; // ждёт выбора
    const spec = SPEC_BY_LEVEL[level];
    // Первое задание формата уже сдано в наборе «по одному каждого формата» —
    // берём следующие четыре, иначе повтор не засчитается и звезда не зажжётся.
    const specTasks = byFormat(spec).slice(1, 5);
    const base = [...startTasks.slice(0, 4), ...oneOfEachFormat, ...specTasks];
    if (level === 3) return { tasks: base, direction: spec }; // звезда
    // «Мы»: по одному заданию из разных направлений, иначе в дашборде горит
    // одна и та же строка направления.
    const weByDirection = [];
    const seenDirections = new Set();
    for (const task of weTasks) {
        const key = task.contentType.toLowerCase();
        if (seenDirections.has(key)) continue;
        seenDirections.add(key);
        weByDirection.push(task);
        if (weByDirection.length === 3) break;
    }
    return { tasks: [...base, ...weByDirection], direction: spec }; // ушёл в «Мы»
}

let approved = 0;
let rejected = 0;
const players = participants.filter((p) => !p.isInspector);
for (const [position, participant] of players.entries()) {
    const level = position % 5;
    const { tasks: plan, direction } = planFor(level);

    if (direction) {
        await api("POST", "/api/mayak/session-runtime/ya-direction", {
            json: { sessionId, userId: participant.userId, direction },
        });
    }

    for (const [step, task] of plan.entries()) {
        const submitted = await submit(participant, task);
        if (!submitted.data?.success) continue;
        // У части участников одно задание отправлено на доработку — в дашборде
        // должно быть видно и такое состояние.
        const approve = !(step === 2 && level === 1);
        const done = await reviewLatest(participant, approve);
        if (done) approve ? (approved += 1) : (rejected += 1);
    }
}

console.log(`Задания: одобрено ${approved}, отклонено ${rejected}`);

const links = session.links || {};
console.log("\nСсылки:");
console.log(`  кабинет   ${BASE}/mayak-access/${ACCESS_ID}`);
console.log(`  дашборд   ${BASE}/mayak-dashboard/${links.dashboardSecret}`);
console.log(`  мастер    ${BASE}/mayak-master/${links.masterSecret}`);
console.log(`  инспектор ${BASE}/tools/mayak-oko?token=${tokenValue}aaaaa`);
console.log(`  обычная   ${BASE}/tools/mayak-oko?token=${links.plainToken}aaaaa`);
