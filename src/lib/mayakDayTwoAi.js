// День 2: сборка брифа, карточек и текстов стола нейросетью (H5–H7;
// КОНСТРУКТОР_ДНЯ2.md, раздел 3 «три промпта, не один»). Вызов идёт тем же
// путём, что сова (sova-check.js): OpenAI-совместимый API из настроек
// data/mayak-settings.json — sovaApiBase + sovaModel + пул sovaApiKeys по
// кругу, запасной путь — openrouterApiKey + evaluationModel через OpenRouter.
// Промпты — редактируемые файлы data/mayak-day2/prompts/{brief,cards,texts}.md;
// если файла нет, он создаётся из встроенного значения ниже. Ключи наружу не
// отдаются: в ошибках только путь, статус и причина. Серверный файл (fs) —
// в браузер не импортировать.

import { promises as fs } from "fs";
import path from "path";

import { readMayakSettings } from "@/lib/mayakSettings";
import { classifySovaFailure, parseSovaEvaluation } from "@/lib/mayakSova";
import { BRIEF_TEXT_MAX, countTaskWords, normalizeCard, normalizeTable, validateDay } from "@/lib/mayakDayTwoModel";
import { tablePoint0 } from "@/lib/mayakDayTwoTexts";

const PROMPTS_DIR = path.join(process.cwd(), "data", "mayak-day2", "prompts");
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const TIMEOUT_MS = 60 * 1000;
const MAX_PRIMARY_KEYS = 3;
const PROMPT_MAX = 20000;

export const BRIEF_FIELD_MAX = 120;
export const TRACK_LABELS = ["2 недели", "4 недели", "7 недель", "3 месяца", "5 месяцев", "6 месяцев"];
export const DAY_TWO_PROMPT_NAMES = ["brief", "cards", "texts"];

const BRIEF_FIELDS = [
    ["product", "продукт"],
    ["user", "кому"],
    ["pain", "боль"],
    ["after6m", "через полгода"],
];
const HINT_KEYS = ["m", "a", "ya", "k", "o1", "k2", "o2"];
const SUBMIT_MARK = /\.[a-z]{2,5}\b|текстом в окно/i;
const FAILURE_LABELS = {
    token_expired_or_invalid: "ключ отклонён",
    token_limit_reached: "лимит ключа",
    upstream_error: "ошибка провайдера",
};

export const DAY_TWO_DEFAULT_PROMPTS = {
    brief: `Ты собираешь бриф стратегической сессии «День 2» по репликам заказчика. За день три стола собирают три цифровых продукта; тебе нужно назвать эти продукты и точку 0 каждого: кому, какая боль, что изменится через полгода.

ВХОД (JSON в сообщении пользователя): organization — организация или категория заказчика; replies — реплики заказчика: переписка, стенограмма встречи, заметки.

ВЫХОД — только JSON, без пояснений и markdown:
{"tables":[{"n":1,"product":"…","user":"…","pain":"…","after6m":"…"},{"n":2,"product":"…","user":"…","pain":"…","after6m":"…"},{"n":3,"product":"…","user":"…","pain":"…","after6m":"…"}]}

ПРАВИЛА
1. Ровно три стола, n = 1, 2, 3. Три разных продукта, каждый — отдельный цифровой сервис, который стол соберёт за день и посторонний проверит с чужого телефона.
2. product — существительное или именная группа не длиннее трёх слов («Моя подписка», «Карта льгот»). Без глаголов и кавычек внутри.
3. user — один конкретный человек, кому продукт нужен: роль и обстоятельство («молодой педагог, первый год в профсоюзе»). Одна строка не длиннее 120 знаков.
4. pain — что у него сейчас не получается или чего он не знает, словами заказчика («не знает, что уже оплатил взносами»). Одна строка не длиннее 120 знаков, без канцелярита.
5. after6m — проверяемое изменение через полгода: что пользователь делает или видит, с числом или наблюдаемым действием («открывает подписку и видит сумму за год»). Одна строка не длиннее 120 знаков.
6. Продукты бери из реплик заказчика. Если заказчик назвал меньше трёх — дополни ближайшими по смыслу, а не случайными. Не выдумывай технологии, которых заказчик не упоминал.
7. Пиши по-русски. Без слов «инновационный», «эффективный», «оптимизация», «цифровая трансформация».`,

    cards: `Ты переписываешь одну карточку дня 2 стратегической сессии под продукты, которые собирают три стола. Колода одна на все столы: детали и узлы общие, поэтому продукт называй «ваш продукт», а примеры давай по продукту стола 1 или обобщённо.

ВХОД (JSON): tables — три стола (n, product, user, pain, after6m); card — карточка шаблона: num, kind, title, why, task, submit, done, hint (семь полей m, a, ya, k, o1, k2, o2 или null), notes.

ВЫХОД — только JSON с теми же полями:
{"title":"…","why":"…","task":"…","submit":"…","done":"…","hint":{"m":"…","a":"…","ya":"…","k":"…","o1":"…","k2":"…","o2":"…"},"notes":"…"}
Если hint во входе null — верни "hint": null.

ПРАВИЛА
1. Смысл карточки не меняется: тот же вид (kind), тот же шаг дня, те же файлы и инструменты. Ты меняешь слова под продукты столов, а не задание.
2. task — не длиннее 10 слов, одно действие.
3. why — одна строка без переносов: зачем этот шаг пользователю продукта.
4. submit — как сдавать: сохрани имя файла из шаблона (например uzel_11_12.docx) или слова «текстом в окно». Если в шаблоне «Файла нет» — оставь так.
5. done — проверяемый признак: число, файл, «одна строка», «каждый ответ…». Не «понятно» и не «качественно».
6. hint — если в шаблоне есть, верни семь коротких фраз (2–6 слов каждая) по ключам m, a, ya, k, o1, k2, o2; если в шаблоне null — верни null.
7. notes — заметка инспектору и образец. Если в шаблоне есть «Образец…», перепиши образец под продукт стола 1. Если notes пустые — верни пустую строку.
8. Словарь дня — используй эти слова и не заменяй их синонимами: продукт, стол, гекс, деталь, узел, изделие, такт, питч, инспектор, сова, точка 0, дорожная карта, трек, промпт, нейросеть, файл. Новых терминов не вводи: никаких «MVP», «фича», «бэклог», «спринт».
9. Пиши по-русски, коротко, без канцелярита. Кавычки — «ёлочки».`,

    texts: `Ты готовишь два текста для одного стола дня 2: семь шагов приёмки изделия и заготовку дорожной карты на шесть месяцев.

ВХОД (JSON): table — стол (n, product, user, pain, after6m); tables — все столы дня; point0 — точка 0 стола (кому · боль · через полгода), если стол её сдал; tracks — шесть треков по порядку.

ВЫХОД — только JSON:
{"acceptance_steps":["…","…","…","…","…","…","…"],"roadmap_rows":[{"track":"2 недели","what":"…","who":"…","check":"…"},{"track":"4 недели","what":"…","who":"…","check":"…"},{"track":"7 недель","what":"…","who":"…","check":"…"},{"track":"3 месяца","what":"…","who":"…","check":"…"},{"track":"5 месяцев","what":"…","who":"…","check":"…"},{"track":"6 месяцев","what":"…","who":"…","check":"…"}]}

ПРАВИЛА
1. acceptance_steps — ровно семь шагов. Каждый начинается с глагола в повелительном наклонении («Откройте…», «Введите…», «Найдите…»). Шаги проходит посторонний человек с чужого телефона по адресу продукта; стол молчит. Шаг 1 — открыть адрес продукта; шаг 7 — увидеть результат для пользователя из точки 0. В каждом шаге — что нажать и что должно появиться.
2. roadmap_rows — ровно шесть строк, по одной на трек, в порядке треков: 2 недели, 4 недели, 7 недель, 3 месяца, 5 месяцев, 6 месяцев. Поле track — подпись трека как во входе.
3. what — что сделано к этому треку, одна строка: продукт растёт от изделия дня к «через полгода» из точки 0. who — роль, кто отвечает (фамилию впишет стол). check — как проверим: число, файл или действие, которое можно увидеть («30 подписчиков», «отчёт в папке стола», «пользователь открывает и видит сумму»).
4. Это заготовка, не готовый план: короткие строки, которые стол правит на карточке «Шесть месяцев».
5. Словарь дня: продукт, стол, изделие, инспектор, точка 0, дорожная карта, трек, файл. По-русски, без канцелярита.`,
};

function str(value) {
    return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function pick(value, fallback) {
    return typeof value === "string" ? value : fallback;
}

// ---------- Промпты: файлы data/mayak-day2/prompts/<name>.md ----------

export function isDayTwoPromptName(name) {
    return DAY_TWO_PROMPT_NAMES.includes(name);
}

function promptFile(name) {
    if (!isDayTwoPromptName(name)) throw new Error("Промпт не найден: brief, cards или texts");
    return path.join(PROMPTS_DIR, `${name}.md`);
}

export async function readDayTwoPrompt(name) {
    const file = promptFile(name);
    try {
        return await fs.readFile(file, "utf-8");
    } catch (error) {
        if (error?.code !== "ENOENT") throw error;
    }
    const text = `${DAY_TWO_DEFAULT_PROMPTS[name]}\n`;
    await fs.mkdir(PROMPTS_DIR, { recursive: true });
    await fs.writeFile(file, text, "utf-8");
    return text;
}

export async function writeDayTwoPrompt(name, text) {
    const file = promptFile(name);
    const value = typeof text === "string" ? text.replace(/\r\n/g, "\n").trim() : "";
    if (!value) throw new Error("Промпт пустой");
    if (value.length > PROMPT_MAX) throw new Error(`Промпт длиннее ${PROMPT_MAX} знаков`);
    await fs.mkdir(PROMPTS_DIR, { recursive: true });
    await fs.writeFile(file, `${value}\n`, "utf-8");
    return `${value}\n`;
}

// ---------- Вызов нейросети ----------

// Round-robin по ключам совы, как в sova-check.js: каждый вызов начинает с другого ключа.
let keyCursor = 0;

function toKeyList(value) {
    if (!value) return [];
    const list = Array.isArray(value) ? value : String(value).split(/[,\n]/);
    return list.map((item) => String(item).trim()).filter(Boolean);
}

// Пути вызова по порядку: до трёх ключей совы (по кругу), затем один запасной —
// OpenRouter с openrouterApiKey и evaluationModel, если он отличается от основного.
function resolveRoutes(settings) {
    const primaryBase = str(process.env.SOVA_API_BASE || settings?.sovaApiBase || OPENROUTER_API_URL).replace(/\/+$/, "");
    const primaryModel = str(process.env.SOVA_MODEL || settings?.sovaModel || settings?.evaluationModel) || DEFAULT_MODEL;
    let keys = [...new Set([...toKeyList(process.env.SOVA_API_KEYS), ...toKeyList(process.env.SOVA_API_KEY), ...toKeyList(settings?.sovaApiKeys)])];
    if (keys.length > 1) {
        const offset = keyCursor % keys.length;
        keyCursor = (keyCursor + 1) % keys.length;
        keys = [...keys.slice(offset), ...keys.slice(0, offset)];
    }
    const routes = keys.slice(0, MAX_PRIMARY_KEYS).map((key, i) => ({ label: keys.length > 1 ? `сова, ключ ${i + 1}` : "сова", base: primaryBase, model: primaryModel, key }));
    const fallbackKey = str(settings?.openrouterApiKey || settings?.finalFileOpenrouterApiKey || process.env.OPENROUTER_API_KEY);
    const fallbackModel = str(settings?.evaluationModel) || DEFAULT_MODEL;
    const same = routes.some((route) => route.key === fallbackKey && route.base === OPENROUTER_API_URL && route.model === fallbackModel);
    if (fallbackKey && !same) routes.push({ label: "запасной путь", base: OPENROUTER_API_URL, model: fallbackModel, key: fallbackKey });
    return routes;
}

async function requestJson(route, { system, user }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(`${route.base}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${route.key}`,
                "X-OpenRouter-Title": "MAYAK day2",
            },
            body: JSON.stringify({
                model: route.model,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: user },
                ],
                temperature: 0.3,
                max_tokens: 2000,
                response_format: { type: "json_object" },
            }),
            signal: controller.signal,
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            const failure = classifySovaFailure(response.status, text);
            return { ok: false, reason: `${response.status} ${FAILURE_LABELS[failure.reason] || failure.reason}` };
        }
        const data = await response.json();
        const parsed = parseSovaEvaluation(data?.choices?.[0]?.message?.content || "");
        if (!parsed || typeof parsed !== "object") return { ok: false, reason: "ответ не JSON" };
        return { ok: true, data: parsed };
    } catch (error) {
        return { ok: false, reason: error?.name === "AbortError" ? "нет ответа за 60 с" : "сбой запроса" };
    } finally {
        clearTimeout(timer);
    }
}

// Общий вызов: system — текст промпта из файла, user — данные JSON-строкой,
// jsonSchemaHint — форма ответа, дописывается в конец сообщения. Возвращает
// разобранный объект; при сбое всех путей бросает «Нейросеть не ответила: …».
export async function callDayTwoLlm({ system, user, jsonSchemaHint = "" }) {
    const routes = resolveRoutes(await readMayakSettings());
    if (!routes.length) throw new Error("Нейросеть не ответила: ключи не настроены (sovaApiKeys или openrouterApiKey в настройках МАЯК)");
    const userText = jsonSchemaHint ? `${user}\n\nОтвет — только JSON вида:\n${jsonSchemaHint}` : user;
    const failures = [];
    for (const route of routes) {
        const result = await requestJson(route, { system, user: userText });
        if (result.ok) return result.data;
        failures.push(`${route.label}: ${result.reason}`);
        console.error("[DayTwoAi]", route.label, route.model, result.reason);
    }
    throw new Error(`Нейросеть не ответила: ${failures.join("; ")}`);
}

// ---------- H5. Бриф → столы ----------

function tablesInput(day) {
    return (Array.isArray(day?.tables) ? day.tables : []).map((table) => ({ n: table.n, product: table.product, user: table.user, pain: table.pain, after6m: table.after6m }));
}

export function checkBriefTables(tables) {
    if (!Array.isArray(tables) || tables.length !== 3) return [`столов ${Array.isArray(tables) ? tables.length : 0} вместо 3`];
    const problems = [];
    tables.forEach((table, i) => {
        const n = i + 1;
        BRIEF_FIELDS.forEach(([key, label]) => {
            const value = str(table?.[key]);
            if (!value) problems.push(`стол ${n}: пусто «${label}»`);
            else if (value.length > BRIEF_FIELD_MAX) problems.push(`стол ${n}: «${label}» ${value.length} знаков, больше ${BRIEF_FIELD_MAX}`);
            else if (value.includes("\n")) problems.push(`стол ${n}: «${label}» не одна строка`);
        });
        if (countTaskWords(table?.product) > 3) problems.push(`стол ${n}: продукт длиннее трёх слов`);
    });
    return problems;
}

// Реплики заказчика → три стола. Адреса продуктов (url) берутся из текущих столов.
export async function aiBriefTables(day, text) {
    const replies = str(text);
    if (!replies) throw new Error("Вставьте реплики заказчика");
    if (replies.length > BRIEF_TEXT_MAX) throw new Error(`Реплики длиннее ${BRIEF_TEXT_MAX} знаков: ${replies.length}`);
    const system = await readDayTwoPrompt("brief");
    const user = JSON.stringify({ organization: str(day?.org), replies }, null, 2);
    const out = await callDayTwoLlm({
        system,
        user,
        jsonSchemaHint: '{"tables":[{"n":1,"product":"…","user":"…","pain":"…","after6m":"…"},{"n":2,"product":"…","user":"…","pain":"…","after6m":"…"},{"n":3,"product":"…","user":"…","pain":"…","after6m":"…"}]}',
    });
    const problems = checkBriefTables(out?.tables);
    if (problems.length) throw new Error(`Столы не прошли проверку: ${problems.join("; ")}`);
    const existing = Array.isArray(day?.tables) ? day.tables : [];
    return out.tables.map((table, i) => normalizeTable({ ...table, n: i + 1, url: existing[i]?.url || "" }, i));
}

// ---------- H6. Столы → карточка ----------

// Проверки переписанной карточки: правила validateDay для этой карточки плюс
// «сдать» с именем файла или «текстом в окно» (если так было в шаблоне) и
// подсказка из семи коротких фраз (если в шаблоне была).
export function checkAiCard(day, original, candidate) {
    const num = original.num;
    const deck = (Array.isArray(day?.cards) ? day.cards : []).map((card) => (card.num === num ? candidate : card));
    const prefix = `${num}: `;
    const problems = validateDay({ cards: deck })
        .problems.filter((problem) => problem.startsWith(prefix))
        .map((problem) => problem.slice(prefix.length));
    if (!str(candidate.task)) problems.push("нет задания");
    if (str(original.why) && !str(candidate.why)) problems.push("нет «зачем»");
    if (SUBMIT_MARK.test(str(original.submit)) && !SUBMIT_MARK.test(str(candidate.submit))) problems.push("в «сдать» нет имени файла или «текстом в окно»");
    if (original.hint) {
        if (!candidate.hint) problems.push("подсказка пропала");
        else
            HINT_KEYS.forEach((key) => {
                const value = str(candidate.hint[key]);
                if (!value) problems.push(`подсказка ${key}: пусто`);
                else if (countTaskWords(value) > 8) problems.push(`подсказка ${key}: длиннее восьми слов`);
            });
    }
    return problems;
}

// Подсказка из ответа: ключа нет — остаётся подсказка оригинала (как и другие
// пропущенные поля); явный null или не объект — подсказка пропала, это проблема.
function pickHint(value, original) {
    if (!original) return null;
    if (value === undefined) return original;
    return value && typeof value === "object" ? value : null;
}

// Одна карточка под продукты столов. Возвращает кандидата и список проблем;
// пустой список — карточку можно записать. Номер, вид, гексы, пилюля, минуты,
// фигура, инструмент и файл берутся из оригинала.
export async function aiRewriteCard(day, original) {
    const system = await readDayTwoPrompt("cards");
    const card = {
        num: original.num,
        kind: original.kind,
        title: original.title,
        why: original.why,
        task: original.task,
        submit: original.submit,
        done: original.done,
        hint: original.hint || null,
        notes: original.notes || "",
    };
    const user = JSON.stringify({ tables: tablesInput(day), card }, null, 2);
    const out = await callDayTwoLlm({
        system,
        user,
        jsonSchemaHint: original.hint
            ? '{"title":"…","why":"…","task":"…","submit":"…","done":"…","hint":{"m":"…","a":"…","ya":"…","k":"…","o1":"…","k2":"…","o2":"…"},"notes":"…"}'
            : '{"title":"…","why":"…","task":"…","submit":"…","done":"…","hint":null,"notes":"…"}',
    });
    const candidate = normalizeCard({
        ...original,
        title: pick(out?.title, original.title),
        why: pick(out?.why, original.why),
        task: pick(out?.task, original.task),
        submit: pick(out?.submit, original.submit),
        done: pick(out?.done, original.done),
        notes: pick(out?.notes, original.notes),
        hint: pickHint(out?.hint, original.hint),
    });
    return { card: candidate, problems: checkAiCard(day, original, candidate) };
}

// ---------- H7. Столы → семь шагов и заготовка карты ----------

export async function aiTableTexts(day, tableN) {
    const n = Number.parseInt(String(tableN ?? ""), 10);
    const table = (Array.isArray(day?.tables) ? day.tables : []).find((item) => Number(item.n) === n);
    if (!table) throw new Error("Укажите стол из брифа: table=N");
    const system = await readDayTwoPrompt("texts");
    const user = JSON.stringify(
        {
            table: { n: table.n, product: table.product, user: table.user, pain: table.pain, after6m: table.after6m },
            tables: tablesInput(day),
            point0: tablePoint0(day, n),
            tracks: TRACK_LABELS,
        },
        null,
        2
    );
    const out = await callDayTwoLlm({
        system,
        user,
        jsonSchemaHint: '{"acceptance_steps":["…" ×7],"roadmap_rows":[{"track":"2 недели","what":"…","who":"…","check":"…"} ×6]}',
    });
    const steps = Array.isArray(out?.acceptance_steps) ? out.acceptance_steps.map(str).filter(Boolean) : [];
    const rows = Array.isArray(out?.roadmap_rows) ? out.roadmap_rows : [];
    const problems = [];
    if (steps.length !== 7) problems.push(`шагов приёмки ${steps.length} вместо 7`);
    if (rows.length !== 6) problems.push(`строк карты ${rows.length} вместо 6`);
    const roadmapRows = TRACK_LABELS.map((label, i) => ({ track: label, what: str(rows[i]?.what), who: str(rows[i]?.who), check: str(rows[i]?.check) }));
    roadmapRows.forEach((row) => {
        if (!row.what) problems.push(`${row.track}: пусто «что сделано»`);
        if (!row.check) problems.push(`${row.track}: пусто «как проверим»`);
    });
    if (problems.length) throw new Error(`Тексты стола не прошли проверку: ${problems.join("; ")}`);
    return { acceptance_steps: steps, roadmap_rows: roadmapRows };
}
