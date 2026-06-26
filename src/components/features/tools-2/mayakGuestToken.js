// Чистые хелперы разбора токена/идентичности для экрана входа MAYAK
// (вынесено из settings.js, этап 5). Без состояния и кириллических строк —
// чистая логика, проверяемая юнит-тестом.
import { normalizePortalProfile } from "@/lib/portalProfile";

// Гость без базового токена — спец-значение "aaaaa"; либо обычный токен с
// суффиксом "aaaaa" → гостевой режим поверх базового токена.
export const MAYAK_GUEST_SUFFIX = "aaaaa";
export const MAYAK_TEMP_GUEST_TOKEN = "aaaaa";

// Портал-профиль считается «полным для MAYAK», только если есть фамилия и имя
// (сертификаты/история зависят от ФИО).
export function hasPortalIdentityFields(payload) {
    const profile = normalizePortalProfile(payload);
    return Boolean(String(profile.surname || "").trim() && String(profile.name || "").trim());
}

// Разбор введённого токена: определяет гостевой режим и базовый токен.
export function parseMayakGuestToken(tokenValue) {
    const normalized = String(tokenValue || "").trim();
    if (!normalized) {
        return { rawToken: "", baseToken: "", isGuestMode: false };
    }

    if (normalized.toLowerCase() === MAYAK_TEMP_GUEST_TOKEN) {
        return {
            rawToken: normalized,
            baseToken: MAYAK_TEMP_GUEST_TOKEN,
            isGuestMode: true,
            isTemporaryGuestToken: true,
        };
    }

    if (normalized.toLowerCase().endsWith(MAYAK_GUEST_SUFFIX)) {
        return {
            rawToken: normalized,
            baseToken: normalized.slice(0, -MAYAK_GUEST_SUFFIX.length).trim(),
            isGuestMode: true,
            isTemporaryGuestToken: false,
        };
    }

    return {
        rawToken: normalized,
        baseToken: normalized,
        isGuestMode: false,
        isTemporaryGuestToken: false,
    };
}

// Стабильный псевдо-уникальный id для гостевого участника сессии.
export function buildMayakGuestUserId(sessionInfo = {}) {
    const sessionPart = String(sessionInfo?.sessionId || sessionInfo?.tokenType || "guest")
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, "-");
    const randomPart =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return `guest-${sessionPart || "guest"}-${randomPart}`;
}
