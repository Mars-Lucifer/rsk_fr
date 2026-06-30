import { promises as fs } from "fs";
import path from "path";

const SETTINGS_FILE = path.join(process.cwd(), "data", "mayak-settings.json");
export const DEFAULT_PROMPT_EVALUATION_PROVIDER = "openrouter";
export const DEFAULT_PROMPT_EVALUATION_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
export const DEFAULT_PROMPT_EVALUATION_OLLAMA_MODEL = "gemma4:e2b";

export function normalizeMayakQuestionnaireUrl(value) {
    return typeof value === "string" ? value.trim() : "";
}

export function normalizePromptEvaluationProvider(value) {
    const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";
    return normalizedValue === "ollama" ? "ollama" : DEFAULT_PROMPT_EVALUATION_PROVIDER;
    // Поддерживаемые значения: "openrouter" (по умолчанию) или "ollama".
}

export function normalizePromptEvaluationOllamaBaseUrl(value) {
    const normalizedValue = typeof value === "string" ? value.trim() : "";
    return (normalizedValue || DEFAULT_PROMPT_EVALUATION_OLLAMA_BASE_URL).replace(/\/+$/, "");
}

export function normalizePromptEvaluationOllamaModel(value) {
    const normalizedValue = typeof value === "string" ? value.trim() : "";
    return normalizedValue || DEFAULT_PROMPT_EVALUATION_OLLAMA_MODEL;
}

export function getMayakQuestionnaireSettings(settings = {}) {
    return {
        introQuestionnaireUrl: normalizeMayakQuestionnaireUrl(settings.introQuestionnaireUrl),
        completionSurveyUrl: normalizeMayakQuestionnaireUrl(settings.completionSurveyUrl),
    };
}

export function getMayakPromptEvaluationSettings(settings = {}) {
    return {
        provider: normalizePromptEvaluationProvider(settings.promptEvaluationProvider || process.env.MAYAK_PROMPT_EVALUATION_PROVIDER),
        ollamaBaseUrl: normalizePromptEvaluationOllamaBaseUrl(
            settings.promptEvaluationOllamaBaseUrl || process.env.MAYAK_PROMPT_EVALUATION_OLLAMA_BASE_URL
        ),
        ollamaModel: normalizePromptEvaluationOllamaModel(
            settings.promptEvaluationOllamaModel || process.env.MAYAK_PROMPT_EVALUATION_OLLAMA_MODEL
        ),
    };
}

export async function readMayakSettings() {
    try {
        return JSON.parse(await fs.readFile(SETTINGS_FILE, "utf-8"));
    } catch {
        return {};
    }
}

export async function writeMayakSettings(settings) {
    const dir = path.dirname(SETTINGS_FILE);
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch {}
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}
