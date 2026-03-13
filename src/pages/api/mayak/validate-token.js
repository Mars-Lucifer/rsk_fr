import { getMayakSessionByToken } from "@/lib/mayakSessions";
import { validateToken, useToken } from "@/utils/mayakTokens";

const DEV_BYPASS_TOKEN = "fffff";

function isLocalMayakBypassEnabled(req) {
    const host = String(req.headers.host || "").toLowerCase();
    const isLocalHost = host.includes("localhost") || host.includes("127.0.0.1");
    const isServerBypassEnabled = String(process.env.MAYAK_ENABLE_SERVER_BYPASS || "").toLowerCase() === "true";
    return (process.env.NODE_ENV !== "production" && isLocalHost) || isServerBypassEnabled;
}

function buildSessionMeta(session) {
    if (!session) return null;
    return {
        id: session.id,
        name: session.name,
        status: session.status,
        tables: session.tables || [],
        inspectorAssignments: session.inspectorAssignments || [],
        sectionId: session.sectionId || null,
        taskRange: session.taskRange || null,
    };
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
        session: null,
    };
}

export default async function handler(req, res) {
    if (req.method === "GET") {
        try {
            const { token } = req.query;

            if (!token || typeof token !== "string") {
                return res.status(400).json({ success: false, valid: false, error: "Токен не указан" });
            }

            if (token === DEV_BYPASS_TOKEN && isLocalMayakBypassEnabled(req)) {
                return res.status(200).json(buildBypassValidationResponse());
            }

            const result = validateToken(token);
            const session = getMayakSessionByToken(token);

            return res.status(200).json({
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
                session: buildSessionMeta(session),
            });
        } catch (error) {
            console.error("Error validating token:", error);
            return res.status(500).json({ success: false, valid: false, error: "Ошибка сервера" });
        }
    }

    if (req.method === "POST") {
        try {
            const { token } = req.body;

            if (!token || typeof token !== "string") {
                return res.status(400).json({ success: false, error: "Токен не указан" });
            }

            if (token === DEV_BYPASS_TOKEN && isLocalMayakBypassEnabled(req)) {
                return res.status(200).json({ success: true, message: "Локальный bypass-токен использован", remainingAttempts: 1, isBypass: true });
            }

            const result = useToken(token);

            if (!result.success) {
                return res.status(403).json({ success: false, error: result.error, remainingAttempts: 0 });
            }

            return res.status(200).json({ success: true, message: "Токен использован", remainingAttempts: result.remainingAttempts, isBypass: false });
        } catch (error) {
            console.error("Error using token:", error);
            return res.status(500).json({ success: false, error: "Ошибка сервера" });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
