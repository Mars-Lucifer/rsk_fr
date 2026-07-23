import {
    SOVA_EVALUATION_SYSTEM_PROMPT,
    buildSovaEvaluationUserMessage,
    classifySovaFailure,
    isValidSovaEvaluationShape,
    maskSecret,
    normalizeSovaEvaluation,
    parseSovaEvaluation,
} from "../../../lib/mayakSova.js";
import { readMayakSettings } from "../../../lib/mayakSettings.js";

// Активная проверка полей МАЯК-ОКО (СОВА) идёт через OpenRouter (OpenAI-совместимый).
// Модель по умолчанию — google/gemini-3-flash-preview: стабильно отдаёт строгий
// JSON и стоит дёшево. Логика разбора/нормализации общая и живёт в mayakSova.js.
// При невалидной структуре ответа делаем один повтор тем же провайдером —
// это компенсирует отсутствие второго провайдера и редкие сбои формата у модели.

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODEL = "google/gemini-3-flash-preview";
const MAX_ATTEMPTS = 2;
const TEMP_UNAVAILABLE_MESSAGE = "Проверка временно недоступна";

function toClientPayload(evaluation) {
    return {
        message: evaluation.summary,
        zone: evaluation.overallZone,
        strongFields: evaluation.strongFields,
        weakFields: evaluation.weakFields,
        greenCount: evaluation?.counts?.green || 0,
        totalFields: Array.isArray(evaluation?.fieldAssessments) ? evaluation.fieldAssessments.length : 7,
    };
}

async function requestStructuredEvaluation({ apiUrl, token, model, systemPrompt, userMessageContent, responseFormat, reasoningEffort, extraHeaders = {} }) {
    const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...extraHeaders,
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "system",
                    content: systemPrompt || SOVA_EVALUATION_SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: userMessageContent,
                },
            ],
            temperature: 0.1,
            max_tokens: 700,
            ...(responseFormat ? { response_format: responseFormat } : {}),
            // Для reasoning-моделей (qwen3 и т.п.) отключаем «размышления»: экономит
            // ~30% токенов и стабилизирует JSON. Задаётся через SOVA_REASONING_EFFORT.
            ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
        }),
    });

    if (!response.ok) {
        return {
            ok: false,
            status: response.status,
            errorText: await response.text(),
        };
    }

    const data = await response.json();
    const rawMessage = data.choices?.[0]?.message?.content || "";
    const parsedEvaluation = parseSovaEvaluation(rawMessage);

    if (!parsedEvaluation || !isValidSovaEvaluationShape(parsedEvaluation)) {
        return {
            ok: false,
            status: 502,
            errorText: rawMessage,
            parseFailed: true,
        };
    }

    return {
        ok: true,
        parsedEvaluation,
    };
}

function buildNormalizedEvaluation(parsedEvaluation, { fields, taskContext }) {
    return normalizeSovaEvaluation(parsedEvaluation, {
        fields,
        taskContext,
    });
}

// Round-robin счётчик, чтобы нагрузка распределялась по ключам между запросами.
let providerKeyCursor = 0;

// Приводит значение (массив, строка через запятую/перевод строки) к списку ключей.
function toKeyList(value) {
    if (!value) return [];
    const arr = Array.isArray(value) ? value : String(value).split(/[,\n]/);
    return arr.map((s) => String(s).trim()).filter(Boolean);
}

// Провайдер оценки настраивается через env ИЛИ настройки (OpenAI-совместимый API:
// OpenRouter, Groq, свой шлюз). Дефолт — OpenRouter.
// Ключи собираются из ВСЕХ источников и объединяются в общий пул ротации:
//   env SOVA_API_KEYS / SOVA_API_KEY  +  settings.sovaApiKeys (массив или строка).
// Настройки читаются на каждый запрос (readMayakSettings) — можно ДОБАВЛЯТЬ ключи
// в data/mayak-settings.json на лету, без пересборки и рестарта: новый ключ сразу
// попадает в ротацию. Ключи РАЗНЫХ аккаунтов складывают лимиты; при 429/невалидном
// ключе переходим к следующему.
// baseUrl: env SOVA_API_BASE → settings.sovaApiBase → OpenRouter.
// model:   env SOVA_MODEL → settings.sovaModel → settings.evaluationModel → дефолт.
function resolveProviderConfig(settings) {
    const baseUrl = String(process.env.SOVA_API_BASE || settings?.sovaApiBase || OPENROUTER_API_URL)
        .trim()
        .replace(/\/+$/, "");

    // Пул ключей из env + настроек, с сохранением порядка и без дубликатов.
    const pooled = [...toKeyList(process.env.SOVA_API_KEYS), ...toKeyList(process.env.SOVA_API_KEY), ...toKeyList(settings?.sovaApiKeys)];
    let tokens = [...new Set(pooled)];

    // Фолбэк на старые одиночные поля (совместимость с прежним OpenRouter-конфигом).
    if (!tokens.length) {
        const single = String(
            settings?.finalFileOpenrouterApiKey || settings?.openrouterApiKey || process.env.MAYAK_FINAL_FILE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || ""
        ).trim();
        if (single) tokens = [single];
    }

    // Round-robin: на каждый запрос стартуем с другого ключа, дальше по кругу.
    if (tokens.length > 1) {
        const offset = providerKeyCursor % tokens.length;
        providerKeyCursor = (providerKeyCursor + 1) % tokens.length;
        tokens.push(...tokens.splice(0, offset));
    }

    const model = String(process.env.SOVA_MODEL || settings?.sovaModel || settings?.evaluationModel || OPENROUTER_DEFAULT_MODEL).trim() || OPENROUTER_DEFAULT_MODEL;

    return { baseUrl, tokens, model };
}

async function handlePromptEvaluation({ res, userMessageContent, fields, taskContext, systemPrompt, settings }) {
    const { baseUrl, tokens, model } = resolveProviderConfig(settings);

    if (!tokens.length) {
        return res.status(503).json({
            error: "Evaluation provider token is not configured",
            message: TEMP_UNAVAILABLE_MESSAGE,
        });
    }

    const failures = [];

    // Внешний цикл — по ключам (разные аккаунты складывают лимиты). При лимите/
    // невалидном ключе переходим к следующему. Внутри — повтор при битом JSON.
    for (const token of tokens) {
        let tokenExhausted = false;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                const result = await requestStructuredEvaluation({
                    apiUrl: `${baseUrl}/chat/completions`,
                    token,
                    model,
                    systemPrompt,
                    userMessageContent,
                    responseFormat: { type: "json_object" },
                    extraHeaders: {
                        "X-OpenRouter-Title": "MAYAK",
                    },
                });

                if (result.ok) {
                    const evaluation = buildNormalizedEvaluation(result.parsedEvaluation, {
                        fields,
                        taskContext,
                    });

                    return res.status(200).json(toClientPayload(evaluation));
                }

                if (result.parseFailed) {
                    failures.push({ attempt, status: 502, reason: "parse_failed", token: maskSecret(token) });
                    console.error(`[PromptEvaluation] Invalid provider response (attempt ${attempt}):`, result.errorText);
                    continue;
                }

                const failure = classifySovaFailure(result.status, result.errorText);
                failures.push({ attempt, status: result.status, reason: failure.reason, token: maskSecret(token) });
                console.error("[PromptEvaluation] Provider API error:", result.status, failure.reason, maskSecret(token), result.errorText);
                // Лимит/невалидный ключ — пробуем следующий ключ; иначе останавливаемся.
                if (failure.shouldTryNextToken) {
                    tokenExhausted = true;
                }
                break;
            } catch (err) {
                failures.push({ attempt, status: 0, reason: "request_failed", token: maskSecret(token) });
                console.error("[PromptEvaluation] Provider request error:", maskSecret(token), err.message);
            }
        }

        // Если ключ исчерпан (лимит/невалиден) — идём к следующему ключу.
        // Иначе (upstream_error/сетевой сбой) — тоже пробуем следующий, вдруг поможет.
        void tokenExhausted;
    }

    console.error("[PromptEvaluation] Evaluation failed on all keys:", failures);
    return res.status(503).json({
        error: "Evaluation failed",
        message: TEMP_UNAVAILABLE_MESSAGE,
        details: failures,
    });
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { fields, taskContext } = req.body;
    if (!fields || typeof fields !== "object") {
        return res.status(400).json({ error: "fields are required" });
    }

    const userMessageContent = buildSovaEvaluationUserMessage({
        taskContext,
        fields,
    });

    const settings = await readMayakSettings();
    const systemPrompt = typeof settings.sovaPrompt === "string" && settings.sovaPrompt.trim() ? settings.sovaPrompt.trim() : SOVA_EVALUATION_SYSTEM_PROMPT;

    return handlePromptEvaluation({
        res,
        userMessageContent,
        fields,
        taskContext,
        systemPrompt,
        settings,
    });
}
