import { validateToken, useToken as consumeLegacyToken } from "@/utils/mayakTokens";
import { useMayakSessionToken as consumeMayakSessionToken, validateMayakSessionToken } from "@/lib/mayakSessionTokens";
import { findActiveMayakSessionByTokenId } from "@/lib/mayakSessions";

const DEV_BYPASS_TOKEN = "fffff";
const MAYAK_GUEST_SUFFIX = "aaaaa";

function normalizeMayakToken(rawToken) {
    const token = String(rawToken || "").trim();
    if (!token) {
        return "";
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

function buildBypassValidationResponse() {
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
        isBypass: true,
        tokenType: "bypass",
    };
}

async function buildValidationResponse(result, tokenType = "legacy") {
    const session =
        tokenType === "session" && result.token?.id
            ? await findActiveMayakSessionByTokenId(result.token.id)
            : null;

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

            if (token === DEV_BYPASS_TOKEN && isLocalMayakBypassEnabled(req)) {
                return res.status(200).json(buildBypassValidationResponse());
            }

            const legacyResult = validateToken(token);
            if (legacyResult.valid || legacyResult.token) {
                return res.status(200).json(await buildValidationResponse(legacyResult, "legacy"));
            }

            const sessionResult = await validateMayakSessionToken(token);
            return res.status(200).json(await buildValidationResponse(sessionResult, "session"));
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

            if (token === DEV_BYPASS_TOKEN && isLocalMayakBypassEnabled(req)) {
                return res.status(200).json({
                    success: true,
                    message: "Локальный bypass-токен использован",
                    remainingAttempts: 1,
                    isBypass: true,
                    tokenType: "bypass",
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
                error: sessionResult.error || legacyResult.error,
                remainingAttempts: sessionResult.remainingAttempts || 0,
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
