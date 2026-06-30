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

async function requestStructuredEvaluation({ apiUrl, token, model, systemPrompt, userMessageContent, responseFormat, extraHeaders = {} }) {
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

function resolveOpenRouterConfig(settings) {
    const token = String(
        settings?.finalFileOpenrouterApiKey ||
            settings?.openrouterApiKey ||
            process.env.MAYAK_FINAL_FILE_OPENROUTER_API_KEY ||
            process.env.OPENROUTER_API_KEY ||
            ""
    ).trim();
    const model = String(settings?.evaluationModel || OPENROUTER_DEFAULT_MODEL).trim() || OPENROUTER_DEFAULT_MODEL;

    return { token, model };
}

async function handlePromptEvaluation({ res, userMessageContent, fields, taskContext, systemPrompt, settings }) {
    const { token, model } = resolveOpenRouterConfig(settings);

    if (!token) {
        return res.status(503).json({
            error: "OpenRouter token is not configured",
            message: TEMP_UNAVAILABLE_MESSAGE,
        });
    }

    const failures = [];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const result = await requestStructuredEvaluation({
                apiUrl: `${OPENROUTER_API_URL}/chat/completions`,
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
                failures.push({ provider: "openrouter", attempt, status: 502, reason: "parse_failed", token: maskSecret(token) });
                console.error(`[PromptEvaluation] Invalid OpenRouter response (attempt ${attempt}):`, result.errorText);
                continue;
            }

            const failure = classifySovaFailure(result.status, result.errorText);
            failures.push({ provider: "openrouter", attempt, status: result.status, reason: failure.reason, token: maskSecret(token) });
            console.error("[PromptEvaluation] OpenRouter API error:", result.status, failure.reason, maskSecret(token), result.errorText);
            break;
        } catch (err) {
            failures.push({ provider: "openrouter", attempt, status: 0, reason: "request_failed", token: maskSecret(token) });
            console.error("[PromptEvaluation] OpenRouter request error:", maskSecret(token), err.message);
        }
    }

    console.error("[PromptEvaluation] OpenRouter evaluation failed:", failures);
    return res.status(503).json({
        error: "OpenRouter evaluation failed",
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
