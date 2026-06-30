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
import { SOVA_EVALUATION_SYSTEM_PROMPT, maskSecret } from "../../../lib/mayakSova.js";

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
        const openrouterApiKey = settings.openrouterApiKey || process.env.OPENROUTER_API_KEY || "";
        const finalFileOpenrouterApiKey =
            settings.finalFileOpenrouterApiKey || process.env.MAYAK_FINAL_FILE_OPENROUTER_API_KEY || openrouterApiKey || "";
        const finalFileModel = settings.finalFileModel || process.env.MAYAK_FINAL_FILE_MODEL || "google/gemini-3-flash-preview";
        const baseUrl = settings.baseUrl || process.env.BASE_URL || "";
        const questionnaires = getMayakQuestionnaireSettings(settings);
        const promptEvaluation = getMayakPromptEvaluationSettings(settings);
        const sovaPrompt = typeof settings.sovaPrompt === "string" && settings.sovaPrompt.trim() ? settings.sovaPrompt : SOVA_EVALUATION_SYSTEM_PROMPT;
        const analyticsPrompt =
            typeof settings.analyticsPrompt === "string" && settings.analyticsPrompt.trim()
                ? settings.analyticsPrompt
                : DEFAULT_ANALYTICS_PROMPT_FOR_ADMIN;

        return res.status(200).json({
            success: true,
            data: {
                openrouterApiKey: maskSecret(openrouterApiKey),
                openrouterApiKeyIsSet: !!openrouterApiKey,
                finalFileOpenrouterApiKey: maskSecret(finalFileOpenrouterApiKey),
                finalFileOpenrouterApiKeyIsSet: !!finalFileOpenrouterApiKey,
                finalFileModel,
                baseUrl,
                baseUrlIsSet: !!baseUrl,
                introQuestionnaireUrl: questionnaires.introQuestionnaireUrl,
                introQuestionnaireUrlIsSet: !!questionnaires.introQuestionnaireUrl,
                completionSurveyUrl: questionnaires.completionSurveyUrl,
                completionSurveyUrlIsSet: !!questionnaires.completionSurveyUrl,
                promptEvaluationProvider: promptEvaluation.provider,
                promptEvaluationOllamaBaseUrl: promptEvaluation.ollamaBaseUrl,
                promptEvaluationOllamaModel: promptEvaluation.ollamaModel,
                sovaPrompt,
                analyticsPrompt,
            },
        });
    }

    if (req.method === "POST") {
        const {
            openrouterApiKey,
            finalFileOpenrouterApiKey,
            finalFileModel,
            baseUrl,
            introQuestionnaireUrl,
            completionSurveyUrl,
            promptEvaluationProvider,
            promptEvaluationOllamaBaseUrl,
            promptEvaluationOllamaModel,
            sovaPrompt,
            analyticsPrompt,
        } = req.body;

        const settings = await readMayakSettings();

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

        if (sovaPrompt !== undefined) {
            settings.sovaPrompt = typeof sovaPrompt === "string" ? sovaPrompt : "";
        }

        if (analyticsPrompt !== undefined) {
            settings.analyticsPrompt = typeof analyticsPrompt === "string" ? analyticsPrompt : "";
        }

        await writeMayakSettings(settings);

        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
