import {
    QWEN_EVALUATION_SYSTEM_PROMPT,
    buildQwenEvaluationUserMessage,
    classifyQwenFailure,
    isValidQwenEvaluationShape,
    maskSecret,
    normalizeQwenEvaluation,
    parseQwenEvaluation,
} from "../../../lib/mayakQwen.js";
import { CODEX_API_URL, getStoredCodexConfig } from "../../../lib/mayakCodex.js";
import { readMayakSettings } from "../../../lib/mayakSettings.js";

// Активная проверка полей МАЯК-ОКО идёт через Codex Sale (OpenAI-совместимый).
// Логика разбора/нормализации общая с Qwen и переиспользуется как есть.
// OpenRouter остаётся как запасной канал, если Codex Sale временно недоступен.

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_BACKUP_MODEL = "google/gemini-3-flash-preview";
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
                    content: systemPrompt || QWEN_EVALUATION_SYSTEM_PROMPT,
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
    const parsedEvaluation = parseQwenEvaluation(rawMessage);

    if (!parsedEvaluation || !isValidQwenEvaluationShape(parsedEvaluation)) {
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
    return normalizeQwenEvaluation(parsedEvaluation, {
        fields,
        taskContext,
    });
}

async function handleCodexPromptEvaluation({ res, userMessageContent, fields, taskContext, systemPrompt, settings }) {
    const { token, model } = await getStoredCodexConfig();
    const openRouterFallbackToken = String(
        settings?.finalFileOpenrouterApiKey ||
            settings?.openrouterApiKey ||
            process.env.MAYAK_FINAL_FILE_OPENROUTER_API_KEY ||
            process.env.OPENROUTER_API_KEY ||
            ""
    ).trim();

    if (!token && !openRouterFallbackToken) {
        return res.status(503).json({
            error: "Codex Sale token is not configured",
            message: TEMP_UNAVAILABLE_MESSAGE,
        });
    }

    const failures = [];

    if (token) {
        try {
            const result = await requestStructuredEvaluation({
                apiUrl: `${CODEX_API_URL}/chat/completions`,
                token,
                model,
                systemPrompt,
                userMessageContent,
                responseFormat: { type: "json_object" },
            });

            if (result.ok) {
                const evaluation = buildNormalizedEvaluation(result.parsedEvaluation, {
                    fields,
                    taskContext,
                });

                return res.status(200).json(toClientPayload(evaluation));
            }

            if (result.parseFailed) {
                failures.push({ provider: "codex", status: 502, reason: "parse_failed", token: maskSecret(token) });
                console.error("[PromptEvaluation] Invalid Codex Sale response:", result.errorText);
            } else {
                const failure = classifyQwenFailure(result.status, result.errorText);
                failures.push({ provider: "codex", status: result.status, reason: failure.reason, token: maskSecret(token) });
                console.error("[PromptEvaluation] Codex Sale API error:", result.status, failure.reason, maskSecret(token), result.errorText);
            }
        } catch (err) {
            failures.push({ provider: "codex", status: 0, reason: "request_failed", token: maskSecret(token) });
            console.error("[PromptEvaluation] Codex Sale request error:", maskSecret(token), err.message);
        }
    }

    if (openRouterFallbackToken) {
        try {
            const result = await requestStructuredEvaluation({
                apiUrl: `${OPENROUTER_API_URL}/chat/completions`,
                token: openRouterFallbackToken,
                model: settings?.finalFileModel || OPENROUTER_BACKUP_MODEL,
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

            failures.push({
                provider: "openrouter",
                status: result.status,
                reason: result.parseFailed ? "openrouter_parse_failed" : "openrouter_failed",
                token: maskSecret(openRouterFallbackToken),
            });
        } catch (err) {
            failures.push({
                provider: "openrouter",
                status: 0,
                reason: "openrouter_request_failed",
                token: maskSecret(openRouterFallbackToken),
            });
            console.error("[PromptEvaluation] OpenRouter fallback request error:", maskSecret(openRouterFallbackToken), err.message);
        }
    }

    console.error("[PromptEvaluation] Codex Sale evaluation failed:", failures);
    return res.status(503).json({
        error: "Codex Sale evaluation failed",
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

    const userMessageContent = buildQwenEvaluationUserMessage({
        taskContext,
        fields,
    });

    const settings = await readMayakSettings();
    const systemPrompt = typeof settings.sovaPrompt === "string" && settings.sovaPrompt.trim() ? settings.sovaPrompt.trim() : QWEN_EVALUATION_SYSTEM_PROMPT;

    return handleCodexPromptEvaluation({
        res,
        userMessageContent,
        fields,
        taskContext,
        systemPrompt,
        settings,
    });
}
