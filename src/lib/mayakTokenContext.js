import { validateToken } from "@/utils/mayakTokens";
import { validateMayakSessionToken } from "@/lib/mayakSessionTokens";
import { findActiveMayakSessionByTokenId } from "@/lib/mayakSessions";

const DEV_BYPASS_TOKEN = "fffff";

function isLocalMayakBypassEnabled() {
    return String(process.env.MAYAK_ENABLE_SERVER_BYPASS || "").toLowerCase() === "true" || process.env.NODE_ENV !== "production";
}

export function parseActivatedKeyCookie(rawCookieValue) {
    if (!rawCookieValue) return "";

    try {
        const parsed = JSON.parse(rawCookieValue);
        return String(parsed?.text || "").trim();
    } catch {
        return "";
    }
}

export async function resolveMayakTokenContext(tokenValue) {
    const normalizedToken = String(tokenValue || "").trim();
    if (!normalizedToken) {
        return {
            success: false,
            valid: false,
            error: "Token is missing",
        };
    }

    if (normalizedToken === DEV_BYPASS_TOKEN && isLocalMayakBypassEnabled()) {
        return {
            success: true,
            valid: true,
            isBypass: true,
            tokenType: "bypass",
            sessionId: null,
            sessionName: "",
            sectionId: null,
            taskRange: null,
            tableCount: 0,
        };
    }

    const sessionResult = await validateMayakSessionToken(normalizedToken);
    if (sessionResult.valid || sessionResult.token) {
        const linkedSession = sessionResult.token?.id ? await findActiveMayakSessionByTokenId(sessionResult.token.id) : null;
        if (!linkedSession) {
            return {
                success: false,
                valid: false,
                error: "\u0421\u0435\u0441\u0441\u0438\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u0438\u043b\u0438 \u0443\u0436\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430",
                tokenType: "session",
                sessionId: null,
                sessionName: "",
                sectionId: sessionResult.token?.sectionId || null,
                taskRange: sessionResult.token?.taskRange || null,
                tableCount: 0,
                token: sessionResult.token || null,
            };
        }

        return {
            success: true,
            valid: sessionResult.valid || Boolean(sessionResult.token?.isActive),
            isBypass: false,
            tokenType: "session",
            sessionId: linkedSession.id,
            sessionName: linkedSession.name || "",
            sectionId: sessionResult.token?.sectionId || linkedSession.sectionId || null,
            taskRange: sessionResult.token?.taskRange || linkedSession.taskRange || null,
            tableCount: linkedSession.tableCount || 0,
            token: sessionResult.token || null,
        };
    }

    const legacyResult = validateToken(normalizedToken);
    if (legacyResult.valid || legacyResult.token) {
        return {
            success: true,
            valid: legacyResult.valid || Boolean(legacyResult.token?.isActive),
            isBypass: false,
            tokenType: "legacy",
            sessionId: null,
            sessionName: "",
            sectionId: legacyResult.token?.sectionId || null,
            taskRange: legacyResult.token?.taskRange || null,
            tableCount: 0,
            token: legacyResult.token || null,
        };
    }

    return {
        success: false,
        valid: false,
        error: legacyResult.error || sessionResult.error || "Token is invalid",
    };
}
