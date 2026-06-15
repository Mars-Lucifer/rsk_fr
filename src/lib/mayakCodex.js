import { readMayakSettings } from "./mayakSettings.js";

// Codex Sale — OpenAI-совместимый провайдер (POST {base}/chat/completions).
// Это активный провайдер оценки полей МАЯК-ОКО, заменивший Qwen в тренажёре.
// Сам контракт оценки (системный промпт, парсинг, нормализация ответа) общий
// и переиспользуется из mayakQwen.js — здесь различаются только endpoint,
// модель и токен. Токен и модель хранятся в data/mayak-settings.json и
// меняются через админку, поэтому в коде их хардкодить нельзя.

export const CODEX_API_URL = "https://codex.sale/v1";
export const CODEX_DEFAULT_MODEL = "gpt-5.4-mini";
export const CODEX_ALLOWED_MODELS = ["gpt-5.3-codex", "gpt-5.4", "gpt-5.4-mini", "gpt-5.5"];

export function normalizeCodexModel(value) {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || CODEX_DEFAULT_MODEL;
}

export function normalizeCodexToken(value) {
    return typeof value === "string" ? value.trim() : "";
}

export async function getStoredCodexConfig() {
    const settings = await readMayakSettings();
    const token = normalizeCodexToken(settings.codexToken) || normalizeCodexToken(process.env.CODEX_SALE_API_KEY);
    const model = normalizeCodexModel(settings.codexModel || process.env.CODEX_SALE_MODEL);

    return {
        token,
        model,
        baseUrl: CODEX_API_URL,
    };
}
