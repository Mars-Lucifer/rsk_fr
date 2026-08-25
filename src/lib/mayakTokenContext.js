import { validateToken } from "@/utils/mayakTokens";
import { validateMayakSessionToken } from "@/lib/mayakSessionTokens";
import { findActiveMayakSessionByTokenId } from "@/lib/mayakSessions";
import { buildContestAccessContext, parseContestToken } from "@/lib/mayakContestAccess";

const DEV_BYPASS_TOKEN = "fffff";
const MAYAK_GUEST_SUFFIX = "aaaaa";
const MAYAK_TEMP_GUEST_TOKEN = "aaaaa";

function normalizeMayakToken(rawToken) {
    const token = String(rawToken || "").trim();
    if (!token) return "";
    if (token.toLowerCase() === MAYAK_TEMP_GUEST_TOKEN) return MAYAK_TEMP_GUEST_TOKEN;
    if (token.toLowerCase().endsWith(MAYAK_GUEST_SUFFIX)) {
        return token.slice(0, -MAYAK_GUEST_SUFFIX.length).trim();
    }
    return token;
}

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
    const normalizedToken = normalizeMayakToken(tokenValue);
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

    // Конкурсный вход (см. mayakContestAccess): ни легаси-токена, ни сессии за
    // ним нет — контекст собирается из номера урока.
    const contestToken = parseContestToken(normalizedToken);
    if (contestToken) {
        const contestContext = buildContestAccessContext(contestToken.lessonNumber);
        if (contestContext) {
            return { success: true, valid: true, isBypass: false, ...contestContext };
        }
        return { success: false, valid: false, error: "Задание к этому уроку не настроено" };
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

    if (normalizedToken === MAYAK_TEMP_GUEST_TOKEN) {
        return {
            success: true,
            valid: true,
            isBypass: false,
            tokenType: "guest",
            sessionId: null,
            sessionName: "",
            sectionId: null,
            taskRange: null,
            tableCount: 0,
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
