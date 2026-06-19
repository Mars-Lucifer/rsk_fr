import { validateToken, useToken as consumeLegacyToken } from "@/utils/mayakTokens";
import { useMayakSessionToken as consumeMayakSessionToken, validateMayakSessionToken } from "@/lib/mayakSessionTokens";
import { findActiveMayakSessionByTokenId } from "@/lib/mayakSessions";

const DEV_BYPASS_TOKEN = "fffff";
const MAYAK_GUEST_SUFFIX = "aaaaa";
const MAYAK_TEMP_GUEST_TOKEN = "aaaaa";

function normalizeMayakToken(rawToken) {
    const token = String(rawToken || "").trim();
    if (!token) {
        return "";
    }

    if (token.toLowerCase() === MAYAK_TEMP_GUEST_TOKEN) {
        return MAYAK_TEMP_GUEST_TOKEN;
    }

    if (token.toLowerCase().endsWith(MAYAK_GUEST_SUFFIX)) {
        return token.slice(0, -MAYAK_GUEST_SUFFIX.length).trim();
    }

    return token;
}

function isLocalMayakBypassEnabled(req) {
    const host = String(req.headers.host || "").toLowerCase();
    const isLocalHost = host.includes("localhost") || host.includes("127.0.0.1");
    const isServerBypassEnabled = String(process.env.MAYAK_ENABLE_SERVER_BYPASS || "").toLowerCase() === "true";
    return (process.env.NODE_ENV !== "production" && isLocalHost) || isServerBypassEnabled;
}

// Админ-bypass: вход администратором с режимом «Отладка».
// Политика «везде, но с секретом»:
//   - на любом хосте (включая прод) суффикс токена должен совпадать с
//     MAYAK_ADMIN_BYPASS_SECRET из env — без env-секрета бэкдора нет;
//   - на localhost / при MAYAK_ENABLE_SERVER_BYPASS дополнительно работает
//     встроенный суффикс "fffff" без секрета (удобство локальной отладки).
// Токен сюда приходит уже нормализованным (суффикс гостя "aaaaa" снят).
function detectAdminBypass(req, token) {
    const t = String(token || "");
    const secret = String(process.env.MAYAK_ADMIN_BYPASS_SECRET || "").trim();
    if (secret && t.length > secret.length && t.endsWith(secret)) {
        return true;
    }
    if (isLocalMayakBypassEnabled(req)) {
        if (t === DEV_BYPASS_TOKEN) return true;
        if (t.length > DEV_BYPASS_TOKEN.length && t.toLowerCase().endsWith(DEV_BYPASS_TOKEN)) {
            return true;
        }
    }
    return false;
}

function buildBypassValidationResponse(sessionData = null) {
    return {
        success: true,
        valid: true,
        error: null,
        remainingAttempts: 1,
        usageLimit: 1,
        usedCount: 0,
        taskRange: sessionData?.taskRange || null,
        sectionId: sessionData?.sectionId || null,
        isExhausted: false,
        isActive: true,
        isBypass: true,
        adminBypass: true,
        // Если под суффиксом админ-байпаса лежит активный сессионный токен,
        // отдаём режим "session" — тогда тренажёр поднимет сессию (роли,
        // очередь инспектора), как при обычном входе по токену, но с правами
        // администратора. Иначе остаётся обычный generic-байпас.
        tokenType: sessionData ? "session" : "bypass",
        sessionId: sessionData?.sessionId || null,
        sessionName: sessionData?.sessionName || null,
        tableCount: sessionData?.tableCount || 0,
    };
}

// Восстанавливает «базовый» токен из-под суффикса админ-байпаса: снимает
// admin-суффикс (env-секрет или встроенный "fffff"), затем — гостевой суффикс
// "aaaaa", если суффиксы были наложены друг на друга. Возвращает "" если под
// байпасом нет содержательного токена (например, голый "fffff").
function getAdminBypassBaseToken(req, token) {
    const t = String(token || "");
    const secret = String(process.env.MAYAK_ADMIN_BYPASS_SECRET || "").trim();
    let base = null;

    if (secret && t.length > secret.length && t.endsWith(secret)) {
        base = t.slice(0, -secret.length);
    } else if (isLocalMayakBypassEnabled(req)) {
        if (t === DEV_BYPASS_TOKEN) {
            base = "";
        } else if (t.length > DEV_BYPASS_TOKEN.length && t.toLowerCase().endsWith(DEV_BYPASS_TOKEN)) {
            base = t.slice(0, -DEV_BYPASS_TOKEN.length);
        }
    }

    if (base === null) {
        return "";
    }

    // Снимаем возможный гостевой суффикс, наложенный поверх базового токена.
    return normalizeMayakToken(base.trim());
}

// Если под админ-байпасом лежит активный сессионный токен — возвращает данные
// этой сессии, иначе null (тогда вход остаётся обычным generic-байпасом).
async function resolveAdminBypassSession(req, token) {
    const baseToken = getAdminBypassBaseToken(req, token);
    if (!baseToken) {
        return null;
    }

    try {
        const sessionResult = await validateMayakSessionToken(baseToken);
        if (!sessionResult.token?.id) {
            return null;
        }

        const session = await findActiveMayakSessionByTokenId(sessionResult.token.id);
        if (!session) {
            return null;
        }

        return {
            sessionId: session.id,
            sessionName: session.name || "",
            tableCount: session.tableCount || 0,
            sectionId: sessionResult.token?.sectionId || null,
            taskRange: sessionResult.token?.taskRange || null,
        };
    } catch (error) {
        console.error("Error resolving admin bypass session:", error);
        return null;
    }
}

function buildGuestValidationResponse() {
    return {
        success: true,
        valid: true,
        error: null,
        remainingAttempts: 1,
        usageLimit: 1,
        usedCount: 0,
        taskRange: null,
        sectionId: null,
        isExhausted: false,
        isActive: true,
        isBypass: false,
        tokenType: "guest",
        sessionId: null,
        sessionName: null,
        tableCount: 0,
    };
}

async function buildValidationResponse(result, tokenType = "legacy") {
    const session =
        tokenType === "session" && result.token?.id
            ? await findActiveMayakSessionByTokenId(result.token.id)
            : null;

    if (tokenType === "session" && result.token?.id && !session) {
        return {
            success: true,
            valid: false,
            error: "\u0421\u0435\u0441\u0441\u0438\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u0438\u043b\u0438 \u0443\u0436\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430",
            remainingAttempts: 0,
            usageLimit: result.token?.usageLimit || 0,
            usedCount: result.token?.usedCount || 0,
            taskRange: result.token?.taskRange || null,
            sectionId: result.token?.sectionId || null,
            isExhausted: false,
            isActive: false,
            isBypass: false,
            tokenType: "session",
            sessionId: null,
            sessionName: null,
            tableCount: 0,
        };
    }

    return {
        success: true,
        valid: result.valid,
        error: result.error || null,
        remainingAttempts: result.remainingAttempts || 0,
        usageLimit: result.token?.usageLimit || 0,
        usedCount: result.token?.usedCount || 0,
        taskRange: result.token?.taskRange || null,
        sectionId: result.token?.sectionId || null,
        isExhausted: result.token ? result.token.usedCount >= result.token.usageLimit : false,
        isActive: result.token?.isActive ?? false,
        isBypass: false,
        tokenType,
        sessionId: session?.id || null,
        sessionName: session?.name || null,
        tableCount: session?.tableCount || 0,
    };
}

export default async function handler(req, res) {
    if (req.method === "GET") {
        try {
            const token = normalizeMayakToken(req.query?.token);

            if (!token) {
                return res.status(400).json({
                    success: false,
                    valid: false,
                    error: "Токен не указан",
                });
            }

            if (detectAdminBypass(req, token)) {
                const sessionData = await resolveAdminBypassSession(req, token);
                return res.status(200).json(buildBypassValidationResponse(sessionData));
            }

            if (token === MAYAK_TEMP_GUEST_TOKEN) {
                return res.status(200).json(buildGuestValidationResponse());
            }

            const sessionResult = await validateMayakSessionToken(token);
            if (sessionResult.valid || sessionResult.token) {
                return res.status(200).json(await buildValidationResponse(sessionResult, "session"));
            }

            const legacyResult = validateToken(token);
            return res.status(200).json(await buildValidationResponse(legacyResult, "legacy"));
        } catch (error) {
            console.error("Error validating token:", error);
            return res.status(500).json({
                success: false,
                valid: false,
                error: "Ошибка сервера",
            });
        }
    }

    if (req.method === "POST") {
        try {
            const token = normalizeMayakToken(req.body?.token);

            if (!token) {
                return res.status(400).json({
                    success: false,
                    error: "Токен не указан",
                });
            }

            if (detectAdminBypass(req, token)) {
                return res.status(200).json({
                    success: true,
                    message: "Bypass-доступ предоставлен",
                    remainingAttempts: 1,
                    isBypass: true,
                    adminBypass: true,
                    tokenType: "bypass",
                });
            }

            const sessionValidationResult = await validateMayakSessionToken(token);
            if (sessionValidationResult.valid || sessionValidationResult.token) {
                const activeSession = sessionValidationResult.token?.id ? await findActiveMayakSessionByTokenId(sessionValidationResult.token.id) : null;
                if (!activeSession) {
                    return res.status(403).json({
                        success: false,
                        error: "\u0421\u0435\u0441\u0441\u0438\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u0438\u043b\u0438 \u0443\u0436\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430",
                        remainingAttempts: 0,
                    });
                }

                const sessionResult = await consumeMayakSessionToken(token);
                if (sessionResult.success) {
                    return res.status(200).json({
                        success: true,
                        message: "Токен использован",
                        remainingAttempts: sessionResult.remainingAttempts,
                        isBypass: false,
                        tokenType: "session",
                    });
                }

                return res.status(403).json({
                    success: false,
                    error: sessionResult.error || sessionValidationResult.error,
                    remainingAttempts: sessionResult.remainingAttempts || sessionValidationResult.remainingAttempts || 0,
                });
            }

            if (token === MAYAK_TEMP_GUEST_TOKEN) {
                return res.status(200).json({
                    success: true,
                    message: "Временный гостевой токен использован",
                    remainingAttempts: 1,
                    isBypass: false,
                    tokenType: "guest",
                });
            }

            const legacyResult = consumeLegacyToken(token);
            if (legacyResult.success) {
                return res.status(200).json({
                    success: true,
                    message: "Токен использован",
                    remainingAttempts: legacyResult.remainingAttempts,
                    isBypass: false,
                    tokenType: "legacy",
                });
            }

            return res.status(403).json({
                success: false,
                error: legacyResult.error,
                remainingAttempts: legacyResult.remainingAttempts || 0,
            });
        } catch (error) {
            console.error("Error using token:", error);
            return res.status(500).json({
                success: false,
                error: "Ошибка сервера",
            });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
