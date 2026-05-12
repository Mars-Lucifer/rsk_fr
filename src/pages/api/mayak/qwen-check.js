import {
    QWEN_API_URL,
    QWEN_EVALUATION_SYSTEM_PROMPT,
    QWEN_MODEL,
    acquireLeastLoadedQwenToken,
    buildQwenEvaluationUserMessage,
    classifyQwenFailure,
    getQwenTokenActiveLoad,
    getStoredQwenBackupToken,
    getQwenTokenPool,
    isValidQwenEvaluationShape,
    maskSecret,
    normalizeQwenEvaluation,
    parseQwenEvaluation,
    releaseQwenToken,
} from "../../../lib/mayakQwen.js";
import { readMayakSettings } from "../../../lib/mayakSettings.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_BACKUP_MODEL = "google/gemini-3-flash-preview";
const TEMP_UNAVAILABLE_MESSAGE = "Проверка временно недоступна";
function isOpenRouterToken(token) {
    return typeof token === "string" && token.trim().startsWith("sk-or-v1");
}

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

async function requestStructuredEvaluation({
    apiUrl,
    token,
    model,
    systemPrompt,
    userMessageContent,
    responseFormat,
    extraHeaders = {},
}) {
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

async function handleQwenPromptEvaluation({ res, userMessageContent, fields, taskContext, systemPrompt, settings }) {
    const tokenPool = await getQwenTokenPool();
    const backupToken = await getStoredQwenBackupToken();
    const openRouterFallbackToken = String(
        settings?.finalFileOpenrouterApiKey ||
            settings?.openrouterApiKey ||
            process.env.MAYAK_FINAL_FILE_OPENROUTER_API_KEY ||
            process.env.OPENROUTER_API_KEY ||
            ""
    ).trim();

    if (tokenPool.length === 0 && !backupToken && !openRouterFallbackToken) {
        return res.status(503).json({
            error: "Qwen tokens are not configured",
            message: TEMP_UNAVAILABLE_MESSAGE,
        });
    }

    const failures = [];
    const triedTokens = new Set();

    while (triedTokens.size < tokenPool.length) {
        const token = acquireLeastLoadedQwenToken(tokenPool, Array.from(triedTokens));
        if (!token) {
            break;
        }

        triedTokens.add(token);

        try {
            const result = await requestStructuredEvaluation({
                apiUrl: `${QWEN_API_URL}/v1/chat/completions`,
                token,
                model: QWEN_MODEL,
                systemPrompt,
                userMessageContent,
            });

            if (!result.ok) {
                if (result.parseFailed) {
                    console.error("[PromptEvaluation] Invalid Qwen response:", result.errorText);
                    return res.status(502).json({
                        error: "Qwen response parse failed",
                        message: TEMP_UNAVAILABLE_MESSAGE,
                        details: result.errorText,
                    });
                }

                const failure = classifyQwenFailure(result.status, result.errorText);
                failures.push({
                    provider: "qwen",
                    status: result.status,
                    reason: failure.reason,
                    token: maskSecret(token),
                    activeLoad: getQwenTokenActiveLoad(token),
                });

                console.error("[PromptEvaluation] Qwen API error:", result.status, failure.reason, maskSecret(token), result.errorText);

                if (failure.shouldTryNextToken) {
                    continue;
                }

                return res.status(502).json({
                    error: "Qwen API error",
                    message: TEMP_UNAVAILABLE_MESSAGE,
                    details: result.errorText,
                });
            }

            const evaluation = buildNormalizedEvaluation(result.parsedEvaluation, {
                fields,
                taskContext,
            });

            return res.status(200).json(toClientPayload(evaluation));
        } catch (err) {
            console.error("[PromptEvaluation] Qwen request error:", maskSecret(token), err.message);
            return res.status(502).json({
                error: "Qwen request failed",
                message: TEMP_UNAVAILABLE_MESSAGE,
                details: err.message,
            });
        } finally {
            releaseQwenToken(token);
        }
    }

    if (backupToken && !triedTokens.has(backupToken)) {
        const backupProvider = isOpenRouterToken(backupToken) ? "openrouter" : "qwen";
        const backupApiUrl = backupProvider === "openrouter" ? `${OPENROUTER_API_URL}/chat/completions` : `${QWEN_API_URL}/v1/chat/completions`;
        const backupModel = backupProvider === "openrouter" ? OPENROUTER_BACKUP_MODEL : QWEN_MODEL;

        try {
            const result = await requestStructuredEvaluation({
                apiUrl: backupApiUrl,
                token: backupToken,
                model: backupModel,
                systemPrompt,
                userMessageContent,
                responseFormat: backupProvider === "openrouter" ? { type: "json_object" } : null,
                extraHeaders:
                    backupProvider === "openrouter"
                        ? {
                              "X-OpenRouter-Title": "MAYAK",
                          }
                        : {},
            });

            if (result.ok) {
                const evaluation = buildNormalizedEvaluation(result.parsedEvaluation, {
                    fields,
                    taskContext,
                });

                return res.status(200).json(toClientPayload(evaluation));
            }

            failures.push({
                provider: backupProvider,
                status: result.status,
                reason: result.parseFailed ? "backup_parse_failed" : "backup_token_failed",
                token: maskSecret(backupToken),
            });

            console.error("[PromptEvaluation] Backup error:", backupProvider, result.status, maskSecret(backupToken), result.errorText);
        } catch (err) {
            failures.push({
                provider: backupProvider,
                status: 0,
                reason: "backup_token_request_failed",
                token: maskSecret(backupToken),
            });
            console.error("[PromptEvaluation] Backup request error:", backupProvider, maskSecret(backupToken), err.message);
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

    console.error("[PromptEvaluation] All configured Qwen tokens failed:", failures);
    return res.status(503).json({
        error: "Qwen token pool exhausted",
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

    return handleQwenPromptEvaluation({
        res,
        userMessageContent,
        fields,
        taskContext,
        systemPrompt,
        settings,
    });
}
