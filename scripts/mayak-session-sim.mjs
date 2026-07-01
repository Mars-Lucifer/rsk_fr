// Симуляция реальной сессии МАЯК: 18 участников, 3 стола.
// Прогоняет полный путь (вход по токену -> стол -> регистрация -> роль ->
// задания -> кольцевое ревью -> джокеры) и печатает PASS/FAIL по каждому пункту.
//
// Запуск (dev-сервер должен быть поднят на 1234):
//   node scripts/mayak-session-sim.mjs
//
// Ничего не мокает: бьёт по реальным API и пишет в реальные data/*.json.
// Раздел контента — 1-100 (поддерживает полный путь Я->Мы).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const BASE = process.env.MAYAK_BASE || "http://localhost:1234";
const ADMIN_PASSWORD = process.env.MAYAK_ADMIN_PASSWORD || "a12345";
const SECTION_ID = "1-100";
const TABLE_COUNT = 3;
const PER_TABLE = 6; // 3 стола * 6 = 18
const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, "public", "tasks-2", "v2", SECTION_ID, "index.json");

// ---------------------------------------------------------------------------
// Копия словарей из src/lib/mayakProgressModel.js (держать синхронно). Скрипт
// автономен и не импортирует модули Next, поэтому воспроизводим нормализацию.
// ---------------------------------------------------------------------------
function normalizeContentType(v) {
    return String(v || "").trim().toLowerCase().replace(/ё/g, "е").replace(/[ \s]+/g, " ");
}
const YA_FORMAT_TYPES = [
    { key: "текст", match: ["текст"] },
    { key: "аудио", match: ["аудио"] },
    { key: "изображение", match: ["изображение", "статика", "изобр"] },
    { key: "интерактив", match: ["интерактив"] },
    { key: "видео", match: ["видео", "динамика"] },
    { key: "данные", match: ["данные"] },
];
const WE_DIRECTIONS = [
    { key: "KNOWLEDGE", match: ["знания и навыки", "знание и навыки", "знания", "навыки"] },
    { key: "INTERACTION", match: ["внешние взаимодействия", "внешнее взаимодействие", "внешнение взаимодействия"] },
    { key: "ENVIRONMENT", match: ["единое цифровое пространство", "единое цифрвоое пространство"] },
    { key: "PROTECTION", match: ["защита данных"] },
    { key: "DATA", match: ["данные и аналитика"] },
    { key: "AUTOMATION", match: ["автоматизация"] },
];
const FORMAT_LOOKUP = new Map();
YA_FORMAT_TYPES.forEach((f) => f.match.forEach((v) => FORMAT_LOOKUP.set(normalizeContentType(v), f.key)));
const DIRECTION_LOOKUP = new Map();
WE_DIRECTIONS.forEach((d) => d.match.forEach((v) => DIRECTION_LOOKUP.set(normalizeContentType(v), d.key)));
const resolveFormatKey = (ct) => FORMAT_LOOKUP.get(normalizeContentType(ct)) || null;
const resolveDirectionKey = (ct) => DIRECTION_LOOKUP.get(normalizeContentType(ct)) || null;

// ---------------------------------------------------------------------------
// Ассерты
// ---------------------------------------------------------------------------
let passCount = 0;
let failCount = 0;
const failures = [];
function check(name, cond, detail = "") {
    if (cond) {
        passCount += 1;
        console.log(`  ✓ ${name}`);
    } else {
        failCount += 1;
        failures.push(name + (detail ? ` — ${detail}` : ""));
        console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    }
}
function section(title) {
    console.log(`\n=== ${title} ===`);
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
let adminCookie = "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Транзиентные 500 в этой среде: (1) dev-сервер Next под параллельной нагрузкой
// роняет loadManifest («Unexpected end of JSON input») ДО хендлера — побочных
// эффектов нет; (2) Windows EPERM на rename при атомарной записи JSON — запись
// не персистится (инкремент теряется целиком, не частично). Оба безопасно
// ретраить. Это сглаживает СРЕДУ, не маскируя логику (лок сериализует записи).
async function api(method, pathname, { json, formFactory, admin = false, query, retries = 6 } = {}) {
    let url = BASE + pathname;
    if (query) {
        const qs = new URLSearchParams(query).toString();
        url += (url.includes("?") ? "&" : "?") + qs;
    }
    for (let attempt = 0; ; attempt++) {
        const headers = {};
        if (admin && adminCookie) headers.Cookie = adminCookie;
        let body;
        if (json !== undefined) {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(json);
        } else if (formFactory !== undefined) {
            body = formFactory(); // пересобираем FormData на каждую попытку
        }
        let res;
        try {
            res = await fetch(url, { method, headers, body });
        } catch (e) {
            if (attempt < retries) { await sleep(120 * (attempt + 1)); continue; }
            throw e;
        }
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = text;
        }
        // Ретраим только транзиентные 500 среды (dev-манифест / Windows EPERM).
        const transient = res.status === 500 && (typeof data !== "object" || data === null);
        if (transient && attempt < retries) {
            await sleep(120 * (attempt + 1));
            continue;
        }
        return { status: res.status, data, headers: res.headers };
    }
}

const guestId = (sessionId) => `guest-${sessionId}-${crypto.randomUUID()}`;
const orgs = ["РСК", "Сенеж", "Смена", "Артек", "ВДЦ", "Долголетие"];

// Инспектор стола N проверяет стол N+1 (заворот -> 1). Значит участника стола P
// проверяет инспектор стола P-1 (заворот 1 -> TABLE_COUNT).
const reviewerTableFor = (p) => (p === 1 ? TABLE_COUNT : p - 1);

async function main() {
    console.log(`МАЯК session sim -> ${BASE}, раздел ${SECTION_ID}, ${TABLE_COUNT} стола x ${PER_TABLE} = ${TABLE_COUNT * PER_TABLE} чел.`);

    // Задания раздела: base = index+1, number, contentType, ключи форматов/направлений.
    const rawTasks = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
    const tasks = rawTasks.map((t, i) => ({
        index: i,
        base: i + 1,
        number: String(t.number || ""),
        contentType: t.contentType || "",
        title: t.title || "",
        formatKey: resolveFormatKey(t.contentType),
        directionKey: resolveDirectionKey(t.contentType),
    }));
    const pickByFormat = (fmt) => tasks.filter((t) => t.base >= 10 && t.base <= 50 && t.formatKey === fmt);
    const startTasks = tasks.filter((t) => t.base >= 1 && t.base <= 10).slice(0, 4);
    const contentTypeTasks = YA_FORMAT_TYPES.map((f) => pickByFormat(f.key)[0]).filter(Boolean);
    const specFormat = "аудио";
    const specTasks = pickByFormat(specFormat); // 14..19
    const weTask = tasks.find((t) => t.base >= 51 && t.base <= 99 && t.directionKey);
    const asTask = (t) => ({ taskNumber: t.number, taskIndex: t.index, taskName: t.title || `Задание ${t.number}` });

    // -----------------------------------------------------------------------
    section("1. Админ-логин и создание сессии");
    const authRes = await api("POST", "/api/admin/mayak-auth", { json: { password: ADMIN_PASSWORD } });
    const setCookie = authRes.headers.get("set-cookie") || "";
    const m = /mayak_admin_auth=([^;]+)/.exec(setCookie);
    adminCookie = m ? `mayak_admin_auth=${m[1]}` : "";
    check("Админ-логин успешен", authRes.status === 200 && !!adminCookie, `status=${authRes.status}`);

    const createRes = await api("POST", "/api/admin/mayak-sessions", {
        admin: true,
        json: {
            name: "ТЕСТ: 3 стола / 18 человек",
            sectionId: SECTION_ID,
            taskRange: SECTION_ID,
            tableCount: TABLE_COUNT,
            tokenUsageLimit: 40,
            reviewTimeoutSeconds: 130,
            reworkTimeoutSeconds: 180,
        },
    });
    check("Сессия создана", createRes.status === 200 && createRes.data?.success, JSON.stringify(createRes.data?.error || ""));
    const session = createRes.data?.data;
    const sessionId = session?.id;
    check("tableCount = 3", session?.tableCount === 3);
    check("Сессии выдан токен", Array.isArray(session?.tokenIds) && session.tokenIds.length >= 1);

    const tokensRes = await api("GET", "/api/admin/mayak-session-tokens", { admin: true });
    const tokenObj = (tokensRes.data?.data || []).find((t) => session?.tokenIds?.includes(t.id));
    const tokenValue = tokenObj?.token;
    check("Значение токена получено", !!tokenValue, `id=${tokenObj?.id}`);

    // -----------------------------------------------------------------------
    section("2. Вход 18 участников: токен -> стол -> регистрация -> роль");
    const participants = []; // {userId, name, table, isInspector, inspectorTargetTable}
    let prevRemaining = Infinity;
    let tokenMonotonic = true;
    for (let i = 0; i < TABLE_COUNT * PER_TABLE; i++) {
        const table = Math.floor(i / PER_TABLE) + 1;
        const isInspector = i % PER_TABLE === 0; // первый за столом
        const userId = guestId(sessionId);
        const name = `Игрок ${i + 1}`;

        const v = await api("POST", "/api/mayak/validate-token", { json: { token: tokenValue } });
        if (!(v.status === 200 && v.data?.success)) tokenMonotonic = false;
        if (typeof v.data?.remainingAttempts === "number") {
            if (v.data.remainingAttempts >= prevRemaining) tokenMonotonic = false;
            prevRemaining = v.data.remainingAttempts;
        }

        const reg = await api("POST", "/api/mayak/session-runtime/participant", {
            json: { sessionId, userId, name, organization: orgs[i % orgs.length], tableNumber: table },
        });
        if (!(reg.status === 200 && reg.data?.success)) {
            check(`Регистрация игрока ${i + 1}`, false, JSON.stringify(reg.data?.error || reg.status));
            continue;
        }

        const role = isInspector ? "Инспектор" : "Участник";
        const roleRes = await api("POST", "/api/mayak/session-runtime/role", { json: { sessionId, userId, role } });
        const okRole = roleRes.status === 200 && roleRes.data?.success;
        participants.push({
            userId,
            name,
            table,
            isInspector,
            inspectorTargetTable: roleRes.data?.data?.inspectorTargetTable || null,
        });
        if (!okRole) check(`Роль игрока ${i + 1}`, false, JSON.stringify(roleRes.data?.error || roleRes.status));
    }
    check("Зарегистрированы все 18", participants.length === 18, `факт=${participants.length}`);
    check("Расход токена монотонный, все входы валидны", tokenMonotonic);
    check("Осталось попыток = 40-18 = 22", prevRemaining === 22, `факт=${prevRemaining}`);
    check(
        "У каждого инспектора target = стол+1 (кольцо)",
        participants.filter((p) => p.isInspector).every((p) => p.inspectorTargetTable === (p.table === TABLE_COUNT ? 1 : p.table + 1))
    );

    // Дашборд: ровно 1 инспектор на стол
    const dashRes = await api("GET", `/api/admin/mayak-sessions/${sessionId}/participants`, { admin: true });
    const dash = dashRes.data?.data || [];
    const inspectorsPerTable = {};
    dash.forEach((p) => {
        if (String(p.role) === "Инспектор") inspectorsPerTable[p.tableNumber] = (inspectorsPerTable[p.tableNumber] || 0) + 1;
    });
    check("Дашборд вернул 18 участников", dash.length === 18, `факт=${dash.length}`);
    check("Ровно 1 инспектор на каждом из 3 столов", [1, 2, 3].every((t) => inspectorsPerTable[t] === 1), JSON.stringify(inspectorsPerTable));

    const byTable = (t) => participants.filter((p) => p.table === t);
    const inspectorOf = (t) => byTable(t).find((p) => p.isInspector);

    // -----------------------------------------------------------------------
    section("3. Один инспектор на стол + невалидный стол (негативные)");
    const secondCandidate = byTable(1).find((p) => !p.isInspector);
    const secondInspector = await api("POST", "/api/mayak/session-runtime/role", {
        json: { sessionId, userId: secondCandidate.userId, role: "Инспектор" },
    });
    check("Второй инспектор на столе 1 отклонён", secondInspector.status !== 200 || !secondInspector.data?.success, JSON.stringify(secondInspector.data));

    const badTableUser = guestId(sessionId);
    const badTable = await api("POST", "/api/mayak/session-runtime/participant", {
        json: { sessionId, userId: badTableUser, name: "Вне диапазона", organization: "x", tableNumber: 9 },
    });
    check("Регистрация на стол 9 (вне диапазона) отклонена", badTable.status !== 200 || !badTable.data?.success, JSON.stringify(badTable.data));

    // -----------------------------------------------------------------------
    section("4. Кольцевое ревью: сдача -> очередь инспектора -> approve/reject");
    async function submit(user, task, text) {
        const formFactory = () => {
            const fd = new FormData();
            fd.append("sessionId", sessionId);
            fd.append("userId", user.userId);
            fd.append("taskNumber", task.number);
            fd.append("taskIndex", String(task.index));
            fd.append("taskName", task.title || `Задание ${task.number}`);
            fd.append("taskTitle", task.title || "");
            fd.append("contentType", task.contentType || "");
            fd.append("submissionText", text);
            fd.append("secondsSpent", "42");
            return fd;
        };
        return api("POST", "/api/mayak/session-runtime/upload", { formFactory });
    }
    async function inspectorQueue(inspector) {
        const st = await api("GET", "/api/mayak/session-runtime/state", { query: { sessionId, userId: inspector.userId } });
        return st.data?.data?.inspectorQueue || [];
    }

    // Стол 2 -> инспектор стола 1 одобряет
    const sub2 = byTable(2).find((p) => !p.isInspector);
    const up2 = await submit(sub2, weTask || contentTypeTasks[0], "Ответ участника стола 2");
    check("Сдача задания (стол 2) создала заявку", up2.status === 200 && up2.data?.success, JSON.stringify(up2.data?.error || ""));
    const insp1 = inspectorOf(1);
    const q1 = await inspectorQueue(insp1);
    const rev2 = q1.find((r) => r.participantUserId === sub2.userId);
    check("Заявка со стола 2 попала в очередь инспектора стола 1", !!rev2, `очередь=${q1.length}`);
    if (rev2) {
        const appr = await api("POST", "/api/mayak/session-runtime/review", {
            json: { sessionId, reviewId: rev2.id, inspectorUserId: insp1.userId, action: "approve", comment: "" },
        });
        check("Инспектор одобрил заявку", appr.status === 200 && appr.data?.data?.status === "approved", JSON.stringify(appr.data?.error || appr.data?.data?.status));
    }

    // Стол 3 -> инспектор стола 2 отклоняет (+ негатив: reject без комментария)
    const sub3 = byTable(3).find((p) => !p.isInspector);
    const up3 = await submit(sub3, contentTypeTasks[1], "Ответ участника стола 3");
    check("Сдача задания (стол 3) создала заявку", up3.status === 200 && up3.data?.success);
    const insp2 = inspectorOf(2);
    const q2 = await inspectorQueue(insp2);
    const rev3 = q2.find((r) => r.participantUserId === sub3.userId);
    check("Заявка со стола 3 попала в очередь инспектора стола 2", !!rev3);
    if (rev3) {
        const rejNoComment = await api("POST", "/api/mayak/session-runtime/review", {
            json: { sessionId, reviewId: rev3.id, inspectorUserId: insp2.userId, action: "reject", comment: "" },
        });
        check("Reject без комментария отклонён", rejNoComment.status !== 200 || !rejNoComment.data?.success);

        const rej = await api("POST", "/api/mayak/session-runtime/review", {
            json: { sessionId, reviewId: rev3.id, inspectorUserId: insp2.userId, action: "reject", comment: "Переделать вступление" },
        });
        check("Инспектор отклонил заявку с доработкой", rej.status === 200 && rej.data?.data?.status === "rejected");
    }

    // Негатив: чужой инспектор (стол 1) пробует одобрить заявку стола 3 (его цель — стол 2)
    if (rev3) {
        const wrong = await api("POST", "/api/mayak/session-runtime/review", {
            json: { sessionId, reviewId: rev3.id, inspectorUserId: insp1.userId, action: "approve", comment: "" },
        });
        check("Чужой инспектор не может решать заявку не своего стола", wrong.status !== 200 || !wrong.data?.success);
    }

    // -----------------------------------------------------------------------
    section("5. Джокеры: путь Я -> звезда -> трата на «Мы» -> запрет пере-траты");
    // Auto-approve идемпотентен. На Windows атомарная запись изредка падает
    // EPERM -> хендлер отдаёт 400 (не 500) -> базовый ретрай api() не срабатывает.
    // Ретраим на уровне вызова, чтобы путь Я был детерминирован (среда, не логика).
    async function autoApprove(user, task) {
        for (let k = 0; k < 6; k++) {
            const r = await api("POST", "/api/mayak/session-runtime/auto-approve", { json: { sessionId, userId: user.userId, ...asTask(task) } });
            if (r.status === 200 && r.data?.success) return r;
            await sleep(120 * (k + 1));
        }
        return null;
    }
    async function setDirectionReliable(user, direction) {
        for (let k = 0; k < 6; k++) {
            const r = await api("POST", "/api/mayak/session-runtime/ya-direction", { json: { sessionId, userId: user.userId, direction } });
            if (r.status === 200 && r.data?.success) return r;
            await sleep(120 * (k + 1));
        }
        return null;
    }
    // Один представитель на стол (индекс 2, чтобы не пересекаться с ревью)
    for (let t = 1; t <= TABLE_COUNT; t++) {
        const rep = byTable(t)[2];
        for (const task of startTasks) await autoApprove(rep, task);
        for (const task of contentTypeTasks) await autoApprove(rep, task);
        await setDirectionReliable(rep, "Аудио");
        for (const task of specTasks) await autoApprove(rep, task); // 6 аудио -> spec>=4 -> звезда

        // Проверяем звезду через дашборд. Участники лежат в data.tables[].participants
        // (+ unassigned). Короткий поллинг — на случай чтения до персиста последней записи.
        async function getRep(userId) {
            const d = await api("GET", `/api/admin/mayak-sessions/${sessionId}/dashboard`, { admin: true });
            const all = [
                ...(d.data?.data?.tables || []).flatMap((tb) => tb.participants || []),
                ...(d.data?.data?.unassigned || []),
            ];
            return all.find((p) => p.userId === userId);
        }
        let me = null;
        for (let k = 0; k < 6; k++) {
            me = await getRep(rep.userId);
            if (me?.ya?.star === "gold") break;
            await sleep(150);
        }
        check(`Стол ${t}: участник дошёл до SPECIALIZATION`, me?.ya?.phase === "SPECIALIZATION", `phase=${me?.ya?.phase}`);
        check(`Стол ${t}: заработана звезда (gold)`, me?.ya?.star === "gold", `star=${me?.ya?.star}`);

        const spend1 = await api("POST", "/api/mayak/session-runtime/joker-spend", {
            json: { sessionId, userId: rep.userId, ...asTask(weTask) },
        });
        check(`Стол ${t}: звезда-джокер потрачена на «Мы»`, spend1.status === 200 && spend1.data?.data?.jokerBalance === 0, JSON.stringify(spend1.data?.error || spend1.data?.data?.jokerBalance));

        const spend2 = await api("POST", "/api/mayak/session-runtime/joker-spend", {
            json: { sessionId, userId: rep.userId, ...asTask(weTask) },
        });
        check(`Стол ${t}: пере-трата джокера запрещена`, spend2.status !== 200 || !spend2.data?.success);
    }

    // -----------------------------------------------------------------------
    section("6. Исчерпание токена (usageLimit=1) — отдельная сессия");
    // Токен исчерпания должен быть привязан к АКТИВНОЙ сессии, иначе
    // validate-token отклонит вход по причине «нет сессии», а не «исчерпан».
    const limitSess = await api("POST", "/api/admin/mayak-sessions", {
        admin: true,
        json: { name: "sim-limit-1", sectionId: SECTION_ID, taskRange: SECTION_ID, tableCount: 1, tokenUsageLimit: 1 },
    });
    const limitSessId = limitSess.data?.data?.id;
    const limitTokRes = await api("GET", "/api/admin/mayak-session-tokens", { admin: true });
    const limitTok = (limitTokRes.data?.data || []).find((t) => limitSess.data?.data?.tokenIds?.includes(t.id));
    const use1 = await api("POST", "/api/mayak/validate-token", { json: { token: limitTok?.token } });
    const use2 = await api("POST", "/api/mayak/validate-token", { json: { token: limitTok?.token } });
    check("Токен limit=1: первый вход успешен", use1.status === 200 && use1.data?.success, JSON.stringify(use1.data));
    check("Токен limit=1: второй вход отклонён (исчерпан)", use2.status !== 200 || !use2.data?.success, JSON.stringify(use2.data));
    if (limitSessId) await api("DELETE", `/api/admin/mayak-sessions/${limitSessId}`, { admin: true });

    // -----------------------------------------------------------------------
    section("7. Конкурентность: 12 одновременных входов по одному токену");
    // Прямая проверка сценария «много участников заходят разом»: файловая
    // блокировка (withJsonFileLock) должна сериализовать инкременты без потерь.
    const concSess = await api("POST", "/api/admin/mayak-sessions", {
        admin: true,
        json: { name: "sim-concurrency", sectionId: SECTION_ID, taskRange: SECTION_ID, tableCount: 3, tokenUsageLimit: 50 },
    });
    const concSessId = concSess.data?.data?.id;
    const concTokRes = await api("GET", "/api/admin/mayak-session-tokens", { admin: true });
    const concTok = (concTokRes.data?.data || []).find((t) => concSess.data?.data?.tokenIds?.includes(t.id));
    const CONC = 12;
    const concResults = await Promise.all(
        Array.from({ length: CONC }, () => api("POST", "/api/mayak/validate-token", { json: { token: concTok?.token } }))
    );
    const concOk = concResults.filter((r) => r.status === 200 && r.data?.success).length;
    check(`Все ${CONC} параллельных входов успешны (нет 500/таймаутов лока)`, concOk === CONC, `успешно=${concOk}/${CONC}`);
    // Параллельная регистрация 12 участников. Регистрация транзакционно-безопасна
    // (mutateSessionRuntime держит read+write под локом), но на Windows изредка
    // EPERM -> 400; ретраим на уровне вызова, чтобы проверить именно логику лока.
    async function regReliable(body) {
        for (let k = 0; k < 6; k++) {
            const r = await api("POST", "/api/mayak/session-runtime/participant", { json: body });
            if (r.status === 200 && r.data?.success) return r;
            await sleep(120 * (k + 1));
        }
        return { status: 0, data: null };
    }
    const concReg = await Promise.all(
        Array.from({ length: CONC }, (_, i) =>
            regReliable({ sessionId: concSessId, userId: guestId(concSessId), name: `Пар ${i + 1}`, organization: "conc", tableNumber: (i % 3) + 1 })
        )
    );
    const concRegOk = concReg.filter((r) => r.status === 200 && r.data?.success).length;
    check(`Все ${CONC} параллельных регистраций успешны (лок сериализует записи)`, concRegOk === CONC, `успешно=${concRegOk}/${CONC}`);
    // Нет потерянных инкрементов: usedCount ровно CONC
    const concTokAfter = await api("GET", "/api/admin/mayak-session-tokens", { admin: true });
    const concTok2 = (concTokAfter.data?.data || []).find((t) => t.id === concTok?.id);
    check(`Лок без потерь: usedCount = ${CONC}`, concTok2?.usedCount === CONC, `факт=${concTok2?.usedCount}`);
    const concDash = await api("GET", `/api/admin/mayak-sessions/${concSessId}/participants`, { admin: true });
    check(`Все ${CONC} участников в рантайме (нет гонки записи)`, (concDash.data?.data || []).length === CONC, `факт=${(concDash.data?.data || []).length}`);
    if (concSessId) await api("DELETE", `/api/admin/mayak-sessions/${concSessId}`, { admin: true });

    // -----------------------------------------------------------------------
    section("8. Кросс-проверка файлов состояния");
    try {
        const tokFile = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "mayak-session-tokens.json"), "utf-8"));
        const tok = (tokFile.tokens || []).find((x) => x.id === tokenObj?.id);
        check("В файле токенов usedCount = 18", tok?.usedCount === 18, `факт=${tok?.usedCount}`);
    } catch (e) {
        check("Чтение файла токенов", false, e.message);
    }
    try {
        const rtFile = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "mayak-session-runtime.json"), "utf-8"));
        const bucket = rtFile.sessions?.[sessionId];
        const ps = bucket ? Object.values(bucket.participants || {}) : [];
        const inspectors = ps.filter((p) => p.role === "Инспектор");
        const jokerSpenders = ps.filter((p) => Number(p.jokerSpent) > 0);
        check("В рантайме 18 участников", ps.length === 18, `факт=${ps.length}`);
        check("В рантайме 3 инспектора", inspectors.length === 3, `факт=${inspectors.length}`);
        check("3 участника потратили джокер", jokerSpenders.length === 3, `факт=${jokerSpenders.length}`);
    } catch (e) {
        check("Чтение файла рантайма", false, e.message);
    }

    // -----------------------------------------------------------------------
    console.log(`\n============================================`);
    console.log(`ИТОГ: PASS ${passCount} / FAIL ${failCount}`);
    if (failCount > 0) {
        console.log("Провалено:");
        failures.forEach((f) => console.log("  - " + f));
    }
    console.log(`Сессия для осмотра в браузере: sessionId=${sessionId}`);
    console.log(`Токен входа (гость: добавьте суффикс aaaaa): ${tokenValue}`);
    console.log(`============================================`);
    process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error("ФАТАЛЬНАЯ ОШИБКА:", e);
    process.exit(2);
});
