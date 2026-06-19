import { promises as fs } from "fs";
import path from "path";

export const GROQ_API_URL = "https://api.groq.com/openai/v1";
export const GROQ_MODEL = "llama-3.3-70b-versatile";

export const MAYAK_OKO_GROQ_FIELDS = [
    {
        code: "m",
        label: "Миссия",
        description: "Главная цель: что нужно сделать.",
    },
    {
        code: "a",
        label: "Аудитория",
        description: "Для кого нужен результат.",
    },
    {
        code: "y",
        label: "Роль",
        description: "Какой специалист или эксперт лучше всего это сделает.",
    },
    {
        code: "k",
        label: "Критерии",
        description: "По каким признакам понять, что результат хороший.",
    },
    {
        code: "o1",
        label: "Ограничения",
        description: "Какие условия, ограничения, количество или важные акценты нужно учесть.",
    },
    {
        code: "k2",
        label: "Контекст",
        description: "Как и где будет использоваться результат.",
    },
    {
        code: "o2",
        label: "Оформление",
        description: "Как оформить результат.",
    },
];

export const GROQ_EVALUATION_SYSTEM_PROMPT = `Ты — строгий, но конструктивный эксперт по методологии МАЯК-ОКО.

Твоя задача — оценить каждое поле структуры МАЯК-ОКО отдельно, но всегда в связи с исходным заданием.

Ты обязан вернуть только один JSON-объект строго заданной структуры.
Любой другой формат ответа считается ошибкой.
Нельзя добавлять верхнеуровневые ключи, менять схему ответа, писать markdown или пояснения вне JSON.

Смысл полей МАЯК-ОКО:
- m — Миссия: главная цель. Что нужно сделать.
- a — Аудитория: для кого нужен результат.
- y — Роль: какой специалист или эксперт лучше всего это сделает.
- k — Критерии: по каким признакам понять, что результат хороший.
- o1 — Ограничения: какие условия, ограничения, количество или важные акценты нужно учесть.
- k2 — Контекст: как и где будет использоваться результат.
- o2 — Оформление: как оформить результат.

Пример сильного набора полей:
Задание: нужно подготовить описание нового городского онлайн-сервиса для предпринимателей.
Хороший вариант полей:
- m: создать понятное описание нового цифрового сервиса администрации для предпринимателей
- a: владельцы кафе и ресторанов, которым важно быстро понять выгоду и порядок подачи заявки
- y: копирайтер для B2G/B2B-коммуникаций простым языком
- k: польза для бизнеса, понятность, простота, экономия времени
- o1: без канцелярита, коротко, без цитат из регламента
- k2: текст для публикации на городском портале о новом сервисе подачи заявок на летние кафе
- o2: короткий структурированный текст с заголовком и 3-5 абзацами

Правила оценки:
1. Сначала пойми, какой результат реально требуется по исходному заданию. В задании передаются только description и task.
2. Затем оцени по отдельности поля: m, a, y, k, o1, k2, o2.
3. Оцени не красоту формулировки, а полезность поля для решения этой задачи.
4. Не наказывай участника за полезную детализацию, даже если она не написана в задании напрямую.
5. Поле получает green только если оно действительно помогает решить задачу.
6. Если поле слишком общее, пустое, случайное, из другого домена или слабо помогает задаче, это red.
7. Если миссия просит другой результат или уводит в другой жанр, предмет или тип работы, поле m не может быть green.
8. Если роль выглядит декоративной и не помогает задаче, поле y не может быть green.
9. Не придумывай сильные стороны ради мягкости ответа.
10. В summary говори по-человечески и не упоминай технические ключи вроде task_context, mayak_oko_fields или field_assessments.

Зоны:
- green: поле уместное, конкретное и помогает задаче.
- red: поле слабое, слишком общее, нерелевантное или противоречит задаче.

Верни только JSON без markdown и без пояснений вне JSON.

Точный формат ответа:
{
  "summary": "2-3 предложения: общая оценка относительно задания.",
  "field_assessments": [
    {
      "code": "m",
      "zone": "<green|red>"
    },
    {
      "code": "a",
      "zone": "<green|red>"
    },
    {
      "code": "y",
      "zone": "<green|red>"
    },
    {
      "code": "k",
      "zone": "<green|red>"
    },
    {
      "code": "o1",
      "zone": "<green|red>"
    },
    {
      "code": "k2",
      "zone": "<green|red>"
    },
    {
      "code": "o2",
      "zone": "<green|red>"
    }
  ]
}`;

const SETTINGS_FILE = path.join(process.cwd(), "data", "mayak-settings.json");

const groqTokenLoadState = globalThis.__mayakGroqTokenLoadState || {
    activeCounts: new Map(),
    rrCursor: 0,
};
globalThis.__mayakGroqTokenLoadState = groqTokenLoadState;

export function maskSecret(value) {
    if (!value) return null;
    if (value.length <= 8) return "****";
    return `${value.slice(0, 4)}...${value.slice(-3)}`;
}

export function getGroqTokenExpiryInfo(token, now = Date.now()) {
    // Groq tokens are api keys and do not expire on their own.
    return {
        expiresAt: null,
        expiresTs: null,
        remainingMs: null,
        status: "active",
    };
}

export function normalizeGroqTokenEntries(tokens) {
    const source = Array.isArray(tokens) ? tokens : typeof tokens === "string" ? tokens.split(/\r?\n/) : tokens && typeof tokens === "object" ? [tokens] : [];
    const seen = new Set();

    return source
        .map((entry) => {
            if (typeof entry === "string") {
                return {
                    name: "",
                    token: entry.trim(),
                    email: "",
                    account: "",
                    sessionAccount: "",
                };
            }

            if (!entry || typeof entry !== "object") {
                return {
                    name: "",
                    token: "",
                };
            }

            return {
                name: typeof entry.name === "string" ? entry.name.trim() : "",
                token: typeof entry.token === "string" ? entry.token.trim() : "",
                email: typeof entry.email === "string" ? entry.email.trim() : "",
                account: typeof entry.account === "string" ? entry.account.trim() : "",
                sessionAccount: typeof entry.sessionAccount === "string" ? entry.sessionAccount.trim() : "",
            };
        })
        .filter((entry) => entry.token)
        .filter((entry) => {
            if (seen.has(entry.token)) return false;
            seen.add(entry.token);
            return true;
        });
}

export function normalizeGroqTokens(tokens) {
    return normalizeGroqTokenEntries(tokens).map((entry) => entry.token);
}

export async function readMayakSettings() {
    try {
        return JSON.parse(await fs.readFile(SETTINGS_FILE, "utf-8"));
    } catch {
        return {};
    }
}

export async function getStoredGroqTokens() {
    const settings = await readMayakSettings();
    return normalizeGroqTokens(settings.groqTokens);
}

export async function getStoredGroqTokenEntries() {
    const settings = await readMayakSettings();
    return normalizeGroqTokenEntries(settings.groqTokens);
}

export async function getStoredGroqBackupToken() {
    const settings = await readMayakSettings();
    return normalizeGroqTokens([settings.groqBackupToken])[0] || "";
}

export async function getGroqTokenPool() {
    return getStoredGroqTokens();
}

function syncGroqTokenLoadState(tokenPool) {
    const validTokens = new Set(tokenPool);

    for (const token of groqTokenLoadState.activeCounts.keys()) {
        if (!validTokens.has(token)) {
            groqTokenLoadState.activeCounts.delete(token);
        }
    }

    for (const token of tokenPool) {
        if (!groqTokenLoadState.activeCounts.has(token)) {
            groqTokenLoadState.activeCounts.set(token, 0);
        }
    }
}

export function acquireLeastLoadedGroqToken(tokenPool, excludedTokens = []) {
    const normalizedPool = normalizeGroqTokens(tokenPool);
    if (normalizedPool.length === 0) {
        return null;
    }

    syncGroqTokenLoadState(normalizedPool);
    const excluded = new Set(normalizeGroqTokens(excludedTokens));
    const availableTokens = normalizedPool.filter((token) => !excluded.has(token));
    if (availableTokens.length === 0) {
        return null;
    }

    const rankedTokens = availableTokens.map((token, index) => ({
        token,
        load: groqTokenLoadState.activeCounts.get(token) || 0,
        orderOffset: (index - (groqTokenLoadState.rrCursor % availableTokens.length) + availableTokens.length) % availableTokens.length,
    }));

    rankedTokens.sort((left, right) => {
        if (left.load !== right.load) {
            return left.load - right.load;
        }

        return left.orderOffset - right.orderOffset;
    });

    const selected = rankedTokens[0];
    groqTokenLoadState.activeCounts.set(selected.token, selected.load + 1);
    groqTokenLoadState.rrCursor = (groqTokenLoadState.rrCursor + 1) % Math.max(availableTokens.length, 1);

    return selected.token;
}

export function releaseGroqToken(token) {
    if (!token || !groqTokenLoadState.activeCounts.has(token)) {
        return;
    }

    const currentLoad = groqTokenLoadState.activeCounts.get(token) || 0;
    if (currentLoad <= 1) {
        groqTokenLoadState.activeCounts.set(token, 0);
        return;
    }

    groqTokenLoadState.activeCounts.set(token, currentLoad - 1);
}

export function getGroqTokenActiveLoad(token) {
    return groqTokenLoadState.activeCounts.get(token) || 0;
}

export function classifyGroqFailure(status, errorText = "") {
    const haystack = `${status} ${errorText}`.toLowerCase();

    const authIssue =
        status === 401 ||
        status === 403 ||
        haystack.includes("invalid api key") ||
        haystack.includes("unauthorized") ||
        haystack.includes("forbidden") ||
        haystack.includes("session expired") ||
        haystack.includes("token is no longer valid");

    const limitIssue =
        status === 429 ||
        haystack.includes("rate limit") ||
        haystack.includes("too many requests") ||
        haystack.includes("quota") ||
        haystack.includes("limit exceeded") ||
        haystack.includes("insufficient") ||
        haystack.includes("credit");

    if (authIssue) {
        return {
            shouldTryNextToken: true,
            reason: "token_expired_or_invalid",
            userMessage: "Groq отклонил текущий токен как невалидный.",
        };
    }

    if (limitIssue) {
        return {
            shouldTryNextToken: true,
            reason: "token_limit_reached",
            userMessage: "Groq отклонил текущий токен из-за лимита или rate limit.",
        };
    }

    return {
        shouldTryNextToken: false,
        reason: "upstream_error",
        userMessage: "Сервис проверки Groq временно недоступен.",
    };
}

export function buildGroqEvaluationUserMessage({ taskContext, fields }) {
    const responseTemplate = {
        summary: "",
        field_assessments: MAYAK_OKO_GROQ_FIELDS.map((field) => ({
            code: field.code,
            zone: "<green|red>",
        })),
    };

    const payload = {
        task_context: taskContext || {
            description: "",
            task: "Задание не указано",
        },
        mayak_oko_fields: MAYAK_OKO_GROQ_FIELDS.map((field) => ({
            code: field.code,
            label: field.label,
            description: field.description,
            value: typeof fields?.[field.code] === "string" ? fields[field.code].trim() : "",
        })),
    };

    return `Оцени входные данные по правилам системного промпта.
Важно: task_context передает только description и task. Смотри на смысл задания и на поля МАЯК-ОКО. Не штрафуй за полезную детализацию, если она помогает решить задачу. В пользовательском summary не упоминай технические ключи вроде task_context, mayak_oko_fields или field_assessments.

Верни только JSON без markdown.

Скопируй и заполни именно этот шаблон ответа. Не меняй названия ключей, не добавляй новые ключи и не меняй порядок field_assessments. Для отдельных полей используй только zone = green или zone = red. Оценивай, насколько каждое поле помогает именно этой задаче:

${JSON.stringify(responseTemplate, null, 2)}

${JSON.stringify(payload, null, 2)}`;
}

export function cleanGroqText(rawText = "") {
    return String(rawText)
        .replace(/<details>.*?<\/details>/gis, "")
        .replace(/Response ID:.*?Request ID:[^\n]+/gis, "")
        .replace(/```json/gi, "```")
        .replace(/```/g, "")
        .trim();
}

function tryJsonParse(candidate) {
    if (!candidate) return null;

    const variants = [candidate, candidate.replace(/,\s*([}\]])/g, "$1")];
    for (const variant of variants) {
        try {
            return JSON.parse(variant);
        } catch {
            // ignore parse attempt and continue
        }
    }

    return null;
}

export function parseGroqEvaluation(rawText = "") {
    const cleaned = cleanGroqText(rawText);
    if (!cleaned) return null;

    const direct = tryJsonParse(cleaned);
    if (direct) return direct;

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
        return tryJsonParse(cleaned.slice(start, end + 1));
    }

    return null;
}

export function isValidGroqEvaluationShape(parsed) {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return false;
    }

    if (!Array.isArray(parsed.field_assessments) || parsed.field_assessments.length !== MAYAK_OKO_GROQ_FIELDS.length) {
        return false;
    }

    const expectedCodes = MAYAK_OKO_GROQ_FIELDS.map((field) => field.code);
    const actualCodes = parsed.field_assessments.map((field) => (typeof field?.code === "string" ? field.code.trim() : ""));

    return expectedCodes.every((code, index) => actualCodes[index] === code);
}

export function normalizeGroqZone(zone) {
    const value = String(zone || "")
        .trim()
        .toLowerCase();

    if (value === "green" || value.includes("зел")) return "green";
    if (value === "yellow" || value.includes("жел")) return "red";
    if (value === "red" || value.includes("крас")) return "red";

    return "red";
}

function normalizeShortText(value, fallback) {
    if (typeof value !== "string") return fallback;
    const normalized = value.trim();
    return normalized || fallback;
}

function sanitizeGroqSummaryText(value = "") {
    return String(value)
        .replace(/\btask_context\b/gi, "задания")
        .replace(/\bmayak_oko_fields\b/gi, "полей")
        .replace(/\bfield_assessments\b/gi, "оценок")
        .replace(/\s*\((?:m|a|y|k|o1|k2|o2)\)/gi, "")
        .replace(/из\s+задания/gi, "задачи")
        .replace(/по\s+задания/gi, "по заданию")
        .replace(/относительно\s+задания/gi, "относительно задания")
        .replace(/\s+/g, " ")
        .trim();
}

function formatFieldLabels(labels) {
    if (!Array.isArray(labels) || labels.length === 0) {
        return "";
    }

    if (labels.length === 1) {
        return labels[0];
    }

    if (labels.length === 2) {
        return `${labels[0]} и ${labels[1]}`;
    }

    return `${labels.slice(0, -1).join(", ")} и ${labels[labels.length - 1]}`;
}

function normalizeTaskText(value = "") {
    return String(value)
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[^a-zа-я0-9\s-]/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenizeTaskText(value = "") {
    return normalizeTaskText(value)
        .split(" ")
        .map((token) => token.trim())
        .filter(Boolean);
}

function applyFieldSpecificityGuards(fieldAssessments, { fields = {} } = {}) {
    return fieldAssessments.map((field) => {
        if (field.zone !== "green") {
            return field;
        }

        const rawValue = typeof fields?.[field.code] === "string" ? fields[field.code].trim() : "";
        const tokens = tokenizeTaskText(rawValue);

        if (rawValue.length < 2 || tokens.length === 0) {
            return {
                ...field,
                zone: "red",
            };
        }

        return field;
    });
}

export function deriveGroqOverallZone(fieldAssessments) {
    const counts = fieldAssessments.reduce(
        (acc, field) => {
            acc[field.zone] += 1;
            return acc;
        },
        { green: 0, red: 0 }
    );

    if (counts.green >= 6) {
        return { overallZone: "green", counts };
    }

    if (counts.green >= 3) {
        return { overallZone: "yellow", counts };
    }

    return { overallZone: "red", counts };
}

function buildFallbackSummary({ overallZone, strongFields, weakFields }) {
    const strongText = formatFieldLabels(strongFields);
    const weakText = formatFieldLabels(weakFields);

    if (overallZone === "green") {
        if (strongText) {
            return `Промпт в целом соответствует задаче. Лучше всего работают ${strongText}.`;
        }

        return "Промпт в целом соответствует задаче и не уводит её в сторону.";
    }

    if (overallZone === "yellow") {
        if (strongText) {
            return `Основа промпта рабочая, но часть полей пока слабо поддерживает задачу. Лучше всего получились ${strongText}.`;
        }

        if (weakText) {
            return `Промпт частично соответствует задаче, но части полей пока не хватает точности.`;
        }

        return "Промпт частично соответствует задаче, но части полей пока не хватает точности.";
    }

    if (strongText) {
        return `Поля заметно расходятся с задачей. Отдельно помогают ${strongText}, но этого пока недостаточно.`;
    }

    if (weakText) {
        return "Поля заметно расходятся с задачей и в таком виде не дадут нужный результат.";
    }

    return "Промпт в текущем виде требует заметной доработки, чтобы модель действительно решала это задание.";
}

function buildWeakFieldsSummaryAddon(weakFields) {
    if (!Array.isArray(weakFields) || weakFields.length === 0) {
        return "";
    }

    if (weakFields.length >= 5) {
        return "Пересобери слабые поля под саму задачу: цель, адресат, условия и формат ответа должны ей прямо соответствовать.";
    }

    if (weakFields.length >= 3) {
        return `Доработай ${formatFieldLabels(weakFields).toLowerCase()}: они должны точнее поддерживать задачу.`;
    }

    return `Уточни ${formatFieldLabels(weakFields).toLowerCase()}: сейчас эти поля не дотягивают до задачи.`;
}

export function normalizeGroqEvaluation(parsed, context = {}) {
    const sourceAssessments = Array.isArray(parsed?.field_assessments) ? parsed.field_assessments : [];
    const byCode = new Map();

    for (const entry of sourceAssessments) {
        const code = typeof entry?.code === "string" ? entry.code.trim() : "";
        if (!code || byCode.has(code)) continue;
        byCode.set(code, entry);
    }

    const fieldAssessments = MAYAK_OKO_GROQ_FIELDS.map((field) => {
        const source = byCode.get(field.code) || {};
        const zone = normalizeGroqZone(source.zone);

        return {
            code: field.code,
            label: field.label,
            zone,
        };
    });

    const adjustedFieldAssessments = applyFieldSpecificityGuards(fieldAssessments, context);
    const { overallZone, counts } = deriveGroqOverallZone(adjustedFieldAssessments);
    const strongFields = adjustedFieldAssessments.filter((field) => field.zone === "green").map((field) => field.label);
    const weakFields = adjustedFieldAssessments.filter((field) => field.zone !== "green").map((field) => field.label);
    const fallbackSummary = buildFallbackSummary({ overallZone, strongFields, weakFields });
    const didAdjustZones = adjustedFieldAssessments.some((field, index) => field.zone !== fieldAssessments[index].zone);
    const baseSummary = didAdjustZones ? fallbackSummary : normalizeShortText(parsed?.summary, fallbackSummary);
    const summaryAddon = buildWeakFieldsSummaryAddon(weakFields);
    const finalSummary = [baseSummary, summaryAddon].filter(Boolean).join(" ");

    return {
        summary: sanitizeGroqSummaryText(finalSummary),
        overallZone,
        counts,
        fieldAssessments: adjustedFieldAssessments,
        strongFields,
        weakFields,
    };
}
