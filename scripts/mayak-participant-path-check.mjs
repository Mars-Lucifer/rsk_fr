// Сверка «что делает участник» и «что видит мастер в дашборде».
//
// Проходит путь одного живого участника по ссылке сессии и после каждого шага
// сравнивает его состояние (/session-runtime/state — то, что рисует тренажёр)
// с данными дашборда (/api/mayak/master/dashboard — то, что видит мастер).
//
// Запуск:
//   node scripts/mayak-participant-path-check.mjs http://localhost:1235 <токен инспекторской ссылки> <dashboardSecret>
//
// Внимание: это реальный вход, он списывает один вход из лимита доступа.

import crypto from "node:crypto";

const [, , baseArg, tokenArg, secretArg] = process.argv;
const BASE = baseArg || "http://localhost:1235";
const TOKEN = tokenArg;
const SECRET = secretArg;

if (!TOKEN || !SECRET) {
    console.error("Укажите токен сессии и dashboardSecret");
    process.exit(2);
}

const failures = [];
function check(label, condition, detail) {
    console.log(`${condition ? "OK  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
    if (!condition) failures.push(label);
}

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
    try {
        return { status: res.status, data: text ? JSON.parse(text) : null };
    } catch {
        return { status: res.status, data: text };
    }
}

// Дашборд иногда отвечает пустым телом, когда рантайм пишется параллельно
// (legacy-хранилище токенов читается без лока) — повторяем, а не падаем.
async function dashboard() {
    for (let attempt = 0; attempt < 4; attempt += 1) {
        if (attempt) await new Promise((r) => setTimeout(r, 200 * attempt));
        const res = await api("GET", "/api/mayak/master/dashboard", { query: { secret: SECRET } });
        if (res.data?.data?.tables) return res.data.data;
    }
    throw new Error("Дашборд не ответил данными после 4 попыток");
}
const findInDashboard = (data, userId) => data?.tables?.flatMap((t) => t.participants).find((p) => p.userId === userId) || null;

// 1. Вход по ссылке -----------------------------------------------------------
const validation = await api("GET", "/api/mayak/validate-token", { query: { token: `${TOKEN}aaaaa` } });
check("ссылка валидна", validation.data?.valid === true, `${validation.data?.tokenType}, ${validation.data?.usedCount}/${validation.data?.usageLimit}`);
const sessionId = validation.data?.sessionId;
check("тренажёр получил сессию", Boolean(sessionId), sessionId || validation.data?.error);

const spend = await api("POST", "/api/mayak/validate-token", { json: { token: `${TOKEN}aaaaa` } });
check("вход списан", spend.data?.success === true, spend.data?.error || `осталось ${spend.data?.remainingAttempts}`);

// 2. Регистрация за столом ----------------------------------------------------
const userId = `guest-${sessionId}-${crypto.randomUUID()}`;
const NAME = "Проверкин Пётр Петрович";
const TABLE = 2;
const reg = await api("POST", "/api/mayak/session-runtime/participant", {
    json: { sessionId, userId, name: NAME, organization: "Проверка", tableNumber: TABLE },
});
check("участник зарегистрирован", reg.data?.success === true, reg.data?.error || "");

let dash = await dashboard();
let mine = findInDashboard(dash, userId);
check("мастер видит участника сразу после входа", Boolean(mine), mine ? `стол ${mine.tableNumber}` : "не найден");
check("стол в дашборде совпадает с выбранным", mine?.tableNumber === TABLE, `${mine?.tableNumber} vs ${TABLE}`);
check("роль по умолчанию — Участник", (mine?.role || "Участник") === "Участник", mine?.role);

// 3. Задание сдано, но ещё не проверено ---------------------------------------
const bundle = await api("GET", "/api/mayak/content-bundle", { query: { sectionId: dash.session.sectionId } });
const tasks = (bundle.data?.data?.tasks || []).map((task, index) => ({ index, base: index + 1, ...task }));
const startTask = tasks.find((t) => t.base <= 10 && t.contentType);

const upload = await api("POST", "/api/mayak/session-runtime/upload", {
    formFactory: () => {
        const fd = new FormData();
        fd.append("sessionId", sessionId);
        fd.append("userId", userId);
        fd.append("taskNumber", startTask.number);
        fd.append("taskIndex", String(startTask.index));
        fd.append("taskName", startTask.title || "");
        fd.append("taskTitle", startTask.title || "");
        fd.append("contentType", startTask.contentType || "");
        fd.append("submissionText", "Ответ проверочного участника");
        fd.append("secondsSpent", "75");
        return fd;
    },
});
check("задание отправлено на проверку", upload.data?.success === true, upload.data?.error || "");

const myState = await api("GET", "/api/mayak/session-runtime/state", { query: { sessionId, userId } });
const myTask = (myState.data?.data?.participant?.taskStates || []).find((t) => String(t.taskNumber) === String(startTask.number));
check("участник видит задание как отправленное", myTask?.status === "pending_review", myTask?.status);

dash = await dashboard();
mine = findInDashboard(dash, userId);
check("неподтверждённое задание НЕ засчитано в дашборде", (mine?.approvedTotal || 0) === 0, `approvedTotal=${mine?.approvedTotal}`);

// 4. Инспектор соседнего стола проверяет --------------------------------------
const inspectorTable = TABLE === 1 ? dash.tables.length : TABLE - 1;
const inspector = dash.tables.find((t) => t.tableNumber === inspectorTable)?.participants.find((p) => p.role === "Инспектор");
check("у соседнего стола есть инспектор", Boolean(inspector), inspector?.name);

let queueItem = null;
for (let attempt = 0; attempt < 4 && !queueItem; attempt += 1) {
    if (attempt) await new Promise((r) => setTimeout(r, 200 * attempt));
    const state = await api("GET", "/api/mayak/session-runtime/state", { query: { sessionId, userId: inspector.userId } });
    queueItem = (state.data?.data?.inspectorQueue || []).find((r) => r.participantUserId === userId) || null;
}
check("заявка попала в очередь инспектора", Boolean(queueItem), queueItem?.taskNumber);

const review = await api("POST", "/api/mayak/session-runtime/review", {
    json: { sessionId, reviewId: queueItem?.id, inspectorUserId: inspector.userId, action: "approve", comment: "" },
});
check("инспектор одобрил", review.data?.data?.status === "approved", review.data?.error || review.data?.data?.status);

dash = await dashboard();
mine = findInDashboard(dash, userId);
check("после одобрения задание учтено", (mine?.approvedTotal || 0) === 1, `approvedTotal=${mine?.approvedTotal}`);
check("фаза «Я» — Старт 1/4", mine?.ya?.phase === "START" && mine?.ya?.approvedCount === 1, `${mine?.ya?.phase} ${mine?.ya?.approvedCount}/${mine?.ya?.target}`);

// 5. Отклонённое задание -------------------------------------------------------
const secondTask = tasks.filter((t) => t.base <= 10 && t.contentType)[1];
await api("POST", "/api/mayak/session-runtime/upload", {
    formFactory: () => {
        const fd = new FormData();
        fd.append("sessionId", sessionId);
        fd.append("userId", userId);
        fd.append("taskNumber", secondTask.number);
        fd.append("taskIndex", String(secondTask.index));
        fd.append("taskName", secondTask.title || "");
        fd.append("contentType", secondTask.contentType || "");
        fd.append("submissionText", "Слабый ответ");
        fd.append("secondsSpent", "30");
        return fd;
    },
});

let rejectItem = null;
for (let attempt = 0; attempt < 4 && !rejectItem; attempt += 1) {
    if (attempt) await new Promise((r) => setTimeout(r, 200 * attempt));
    const state = await api("GET", "/api/mayak/session-runtime/state", { query: { sessionId, userId: inspector.userId } });
    rejectItem = (state.data?.data?.inspectorQueue || []).find((r) => r.participantUserId === userId) || null;
}
const rejected = await api("POST", "/api/mayak/session-runtime/review", {
    json: { sessionId, reviewId: rejectItem?.id, inspectorUserId: inspector.userId, action: "reject", comment: "Нужны детали" },
});
check("инспектор отклонил", ["rejected", "rework"].includes(rejected.data?.data?.status), rejected.data?.data?.status || rejected.data?.error);

dash = await dashboard();
mine = findInDashboard(dash, userId);
check("отклонённое задание не засчитано", (mine?.approvedTotal || 0) === 1, `approvedTotal=${mine?.approvedTotal}`);

const afterState = await api("GET", "/api/mayak/session-runtime/state", { query: { sessionId, userId } });
const rejectedTask = (afterState.data?.data?.participant?.taskStates || []).find((t) => String(t.taskNumber) === String(secondTask.number));
check("участник видит доработку у себя", ["rejected", "rework"].includes(rejectedTask?.status), rejectedTask?.status);

// 6. Итог ----------------------------------------------------------------------
const mySeenApproved = (afterState.data?.data?.participant?.taskStates || []).filter((t) => t.status === "approved").length;
check("счётчик участника = счётчику дашборда", mySeenApproved === (mine?.approvedTotal || 0), `${mySeenApproved} vs ${mine?.approvedTotal}`);

console.log(failures.length ? `\nПРОВАЛЕНО: ${failures.length} — ${failures.join("; ")}` : "\nВсё зелёное: дашборд повторяет реальный путь участника");
process.exit(failures.length ? 1 : 0);
