import { requireMayakAdmin } from "../../../lib/mayakAdminAuth.js";
import {
    getMayakPromptEvaluationSettings,
    getMayakQuestionnaireSettings,
    normalizePromptEvaluationOllamaBaseUrl,
    normalizePromptEvaluationOllamaModel,
    normalizePromptEvaluationProvider,
    readMayakSettings,
    writeMayakSettings,
} from "../../../lib/mayakSettings.js";
import { QWEN_EVALUATION_SYSTEM_PROMPT, getQwenTokenExpiryInfo, maskSecret, normalizeQwenTokenEntries } from "../../../lib/mayakQwen.js";
import { CODEX_DEFAULT_MODEL, normalizeCodexModel, normalizeCodexToken } from "../../../lib/mayakCodex.js";

const DEFAULT_ANALYTICS_PROMPT_FOR_ADMIN = `Ты — эксперт-аналитик тренажера МАЯК.

Сформируй итоговую аналитику по данным прохождения участника.
Оцени качество работы с методологией МАЯК-ОКО, выдели сильные стороны, проблемные зоны и практические рекомендации.
Пиши понятно, профессионально и без лишней воды.
Используй только названия "МАЯК" и "МАЯК-ОКО".`;

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method === "GET") {
        const settings = await readMayakSettings();
        const telegramBotToken = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
        const openrouterApiKey = settings.openrouterApiKey || process.env.OPENROUTER_API_KEY || "";
        const finalFileOpenrouterApiKey =
            settings.finalFileOpenrouterApiKey || process.env.MAYAK_FINAL_FILE_OPENROUTER_API_KEY || openrouterApiKey || "";
        const finalFileModel = settings.finalFileModel || process.env.MAYAK_FINAL_FILE_MODEL || "google/gemini-3-flash-preview";
        const codexToken = settings.codexToken || process.env.CODEX_SALE_API_KEY || "";
        const codexModel = settings.codexModel || process.env.CODEX_SALE_MODEL || CODEX_DEFAULT_MODEL;
        const qwenReminderCronSecret =
            settings.qwenReminderCronSecret || process.env.MAYAK_QWEN_REMINDER_CRON_SECRET || "";
        const telegramBotUsername = settings.telegramBotUsername || process.env.TELEGRAM_BOT_USERNAME || "";
        const telegramWebhookUrl = settings.telegramWebhookUrl || process.env.TELEGRAM_WEBHOOK_URL || "";
        const telegramApiBase = settings.telegramApiBase || process.env.TELEGRAM_API_BASE || "";
        const telegramGatewaySecret = settings.telegramGatewaySecret || process.env.TELEGRAM_GATEWAY_SECRET || "";
        const telegramPortalSecret = settings.telegramPortalSecret || process.env.TELEGRAM_PORTAL_SECRET || "";
        const qwenReminderChatIds = Array.isArray(settings.qwenReminderChatIds)
            ? settings.qwenReminderChatIds.map((value) => String(value).trim()).filter(Boolean)
            : [];
        const baseUrl = settings.baseUrl || process.env.BASE_URL || "";
        const qwenTokens = normalizeQwenTokenEntries(settings.qwenTokens);
        const qwenBackupEntry = normalizeQwenTokenEntries(settings.qwenBackupToken)[0] || null;
        const qwenBackupToken = qwenBackupEntry?.token || "";
        const questionnaires = getMayakQuestionnaireSettings(settings);
        const promptEvaluation = getMayakPromptEvaluationSettings(settings);
        const sovaPrompt = typeof settings.sovaPrompt === "string" && settings.sovaPrompt.trim() ? settings.sovaPrompt : QWEN_EVALUATION_SYSTEM_PROMPT;
        const analyticsPrompt =
            typeof settings.analyticsPrompt === "string" && settings.analyticsPrompt.trim()
                ? settings.analyticsPrompt
                : DEFAULT_ANALYTICS_PROMPT_FOR_ADMIN;

        return res.status(200).json({
            success: true,
            data: {
                telegramBotToken: maskSecret(telegramBotToken),
                telegramBotTokenIsSet: !!telegramBotToken,
                openrouterApiKey: maskSecret(openrouterApiKey),
                openrouterApiKeyIsSet: !!openrouterApiKey,
                finalFileOpenrouterApiKey: maskSecret(finalFileOpenrouterApiKey),
                finalFileOpenrouterApiKeyIsSet: !!finalFileOpenrouterApiKey,
                finalFileModel,
                codexToken: maskSecret(codexToken),
                codexTokenIsSet: !!codexToken,
                codexModel,
                qwenReminderCronSecret: maskSecret(qwenReminderCronSecret),
                qwenReminderCronSecretIsSet: !!qwenReminderCronSecret,
                telegramBotUsername,
                telegramBotUsernameIsSet: !!telegramBotUsername,
                telegramWebhookUrl,
                telegramWebhookUrlIsSet: !!telegramWebhookUrl,
                telegramApiBase,
                telegramApiBaseIsSet: !!telegramApiBase,
                telegramGatewaySecret: maskSecret(telegramGatewaySecret),
                telegramGatewaySecretIsSet: !!telegramGatewaySecret,
                telegramPortalSecret: maskSecret(telegramPortalSecret),
                telegramPortalSecretIsSet: !!telegramPortalSecret,
                qwenReminderChatIds,
                qwenReminderChatIdsCount: qwenReminderChatIds.length,
                baseUrl,
                baseUrlIsSet: !!baseUrl,
                introQuestionnaireUrl: questionnaires.introQuestionnaireUrl,
                introQuestionnaireUrlIsSet: !!questionnaires.introQuestionnaireUrl,
                completionSurveyUrl: questionnaires.completionSurveyUrl,
                completionSurveyUrlIsSet: !!questionnaires.completionSurveyUrl,
                promptEvaluationProvider: promptEvaluation.provider,
                promptEvaluationOllamaBaseUrl: promptEvaluation.ollamaBaseUrl,
                promptEvaluationOllamaModel: promptEvaluation.ollamaModel,
                qwenTokens: qwenTokens.map((entry, index) => ({
                    index,
                    name: entry.name || `Токен ${index + 1}`,
                    email: entry.email || "",
                    account: entry.account || entry.sessionAccount || `acc${String(index + 1).padStart(2, "0")}`,
                    token: entry.token,
                    mask: maskSecret(entry.token),
                    expiry: getQwenTokenExpiryInfo(entry.token),
                })),
                qwenTokensCount: qwenTokens.length,
                qwenTokensIsSet: qwenTokens.length > 0,
                qwenBackupToken: qwenBackupToken,
                qwenBackupTokenName: qwenBackupEntry?.name || "Резервный токен",
                qwenBackupTokenMask: maskSecret(qwenBackupToken),
                qwenBackupTokenIsSet: !!qwenBackupToken,
                qwenBackupTokenExpiry: getQwenTokenExpiryInfo(qwenBackupToken),
                sovaPrompt,
                analyticsPrompt,
            },
        });
    }

    if (req.method === "POST") {
        const {
            telegramBotToken,
            openrouterApiKey,
            finalFileOpenrouterApiKey,
            finalFileModel,
            codexToken,
            codexModel,
            qwenReminderCronSecret,
            telegramBotUsername,
            telegramWebhookUrl,
            telegramApiBase,
            telegramGatewaySecret,
            telegramPortalSecret,
            qwenReminderChatIds,
            baseUrl,
            introQuestionnaireUrl,
            completionSurveyUrl,
            promptEvaluationProvider,
            promptEvaluationOllamaBaseUrl,
            promptEvaluationOllamaModel,
            qwenTokens,
            qwenTokenAdd,
            qwenTokenRemoveIndex,
            qwenBackupToken,
            sovaPrompt,
            analyticsPrompt,
        } = req.body;

        const settings = await readMayakSettings();
        let botRestarted = false;
        const shouldRestartBot =
            telegramBotToken !== undefined ||
            telegramWebhookUrl !== undefined ||
            telegramApiBase !== undefined ||
            telegramGatewaySecret !== undefined;

        if (telegramBotToken !== undefined) {
            settings.telegramBotToken = telegramBotToken;
            process.env.TELEGRAM_BOT_TOKEN = telegramBotToken;
        }

        if (openrouterApiKey !== undefined) {
            settings.openrouterApiKey = openrouterApiKey;
            process.env.OPENROUTER_API_KEY = openrouterApiKey;
        }

        if (finalFileOpenrouterApiKey !== undefined) {
            settings.finalFileOpenrouterApiKey = typeof finalFileOpenrouterApiKey === "string" ? finalFileOpenrouterApiKey.trim() : "";
            process.env.MAYAK_FINAL_FILE_OPENROUTER_API_KEY = settings.finalFileOpenrouterApiKey;
        }

        if (finalFileModel !== undefined) {
            settings.finalFileModel = typeof finalFileModel === "string" ? finalFileModel.trim() : "";
            process.env.MAYAK_FINAL_FILE_MODEL = settings.finalFileModel;
        }

        if (codexToken !== undefined) {
            settings.codexToken = normalizeCodexToken(codexToken);
            process.env.CODEX_SALE_API_KEY = settings.codexToken;
        }

        if (codexModel !== undefined) {
            settings.codexModel = normalizeCodexModel(codexModel);
            process.env.CODEX_SALE_MODEL = settings.codexModel;
        }

        if (qwenReminderCronSecret !== undefined) {
            settings.qwenReminderCronSecret = typeof qwenReminderCronSecret === "string" ? qwenReminderCronSecret.trim() : "";
            process.env.MAYAK_QWEN_REMINDER_CRON_SECRET = settings.qwenReminderCronSecret;
        }

        if (telegramBotUsername !== undefined) {
            settings.telegramBotUsername = telegramBotUsername;
            process.env.TELEGRAM_BOT_USERNAME = telegramBotUsername;
        }

        if (telegramWebhookUrl !== undefined) {
            settings.telegramWebhookUrl = telegramWebhookUrl;
            process.env.TELEGRAM_WEBHOOK_URL = telegramWebhookUrl;
        }

        if (telegramApiBase !== undefined) {
            settings.telegramApiBase = typeof telegramApiBase === "string" ? telegramApiBase.trim() : "";
            process.env.TELEGRAM_API_BASE = settings.telegramApiBase;
        }

        if (telegramGatewaySecret !== undefined) {
            settings.telegramGatewaySecret = typeof telegramGatewaySecret === "string" ? telegramGatewaySecret.trim() : "";
            process.env.TELEGRAM_GATEWAY_SECRET = settings.telegramGatewaySecret;
        }

        if (telegramPortalSecret !== undefined) {
            settings.telegramPortalSecret = typeof telegramPortalSecret === "string" ? telegramPortalSecret.trim() : "";
            process.env.TELEGRAM_PORTAL_SECRET = settings.telegramPortalSecret;
        }

        if (qwenReminderChatIds !== undefined) {
            const normalizedChatIds = (Array.isArray(qwenReminderChatIds) ? qwenReminderChatIds : String(qwenReminderChatIds).split(/[,\r\n]+/))
                .map((value) => String(value || "").trim())
                .filter(Boolean);
            settings.qwenReminderChatIds = normalizedChatIds;
        }

        if (baseUrl !== undefined) {
            settings.baseUrl = baseUrl;
        }

        if (introQuestionnaireUrl !== undefined) {
            settings.introQuestionnaireUrl = typeof introQuestionnaireUrl === "string" ? introQuestionnaireUrl.trim() : "";
        }

        if (completionSurveyUrl !== undefined) {
            settings.completionSurveyUrl = typeof completionSurveyUrl === "string" ? completionSurveyUrl.trim() : "";
        }

        if (promptEvaluationProvider !== undefined) {
            settings.promptEvaluationProvider = normalizePromptEvaluationProvider(promptEvaluationProvider);
            process.env.MAYAK_PROMPT_EVALUATION_PROVIDER = settings.promptEvaluationProvider;
        }

        if (promptEvaluationOllamaBaseUrl !== undefined) {
            settings.promptEvaluationOllamaBaseUrl = normalizePromptEvaluationOllamaBaseUrl(promptEvaluationOllamaBaseUrl);
            process.env.MAYAK_PROMPT_EVALUATION_OLLAMA_BASE_URL = settings.promptEvaluationOllamaBaseUrl;
        }

        if (promptEvaluationOllamaModel !== undefined) {
            settings.promptEvaluationOllamaModel = normalizePromptEvaluationOllamaModel(promptEvaluationOllamaModel);
            process.env.MAYAK_PROMPT_EVALUATION_OLLAMA_MODEL = settings.promptEvaluationOllamaModel;
        }

        if (qwenTokens !== undefined) {
            settings.qwenTokens = normalizeQwenTokenEntries(qwenTokens);
        }

        if (qwenBackupToken !== undefined) {
            const backupEntry = normalizeQwenTokenEntries(qwenBackupToken)[0] || null;
            settings.qwenBackupToken = backupEntry || "";
        }

        if (sovaPrompt !== undefined) {
            settings.sovaPrompt = typeof sovaPrompt === "string" ? sovaPrompt : "";
        }

        if (analyticsPrompt !== undefined) {
            settings.analyticsPrompt = typeof analyticsPrompt === "string" ? analyticsPrompt : "";
        }

        if (qwenTokenAdd !== undefined) {
            const entriesToAdd = normalizeQwenTokenEntries(qwenTokenAdd);
            if (entriesToAdd.length === 0) {
                return res.status(400).json({ success: false, error: "Не найдено ни одного Qwen-токена" });
            }

            settings.qwenTokens = normalizeQwenTokenEntries([...normalizeQwenTokenEntries(settings.qwenTokens), ...entriesToAdd]);
        }

        if (qwenTokenRemoveIndex !== undefined) {
            const index = Number.parseInt(qwenTokenRemoveIndex, 10);
            const currentTokens = normalizeQwenTokenEntries(settings.qwenTokens);

            if (Number.isNaN(index) || index < 0 || index >= currentTokens.length) {
                return res.status(400).json({ success: false, error: "Qwen-токен для удаления не найден" });
            }

            currentTokens.splice(index, 1);
            settings.qwenTokens = currentTokens;
        }

        await writeMayakSettings(settings);

        if (shouldRestartBot) {
            try {
                const { restartBot } = await import("../../../lib/telegramBot.js");
                await restartBot();
                botRestarted = true;
            } catch (err) {
                console.error("[Settings] Ошибка перезапуска бота:", err.message);
            }
        }

        return res.status(200).json({
            success: true,
            botRestarted,
        });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
