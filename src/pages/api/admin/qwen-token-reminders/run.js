import { isMayakAdminConfigured, isMayakAdminAuthenticated } from "../../../../lib/mayakAdminAuth.js";
import { runQwenReminderCheck } from "../../../../lib/mayakQwenReminderService.js";
import { readMayakSettings } from "../../../../lib/mayakSettings.js";

function readBearerToken(req) {
    const authHeader = String(req.headers.authorization || "").trim();
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : "";
}

async function isCronAuthorized(req) {
    const settings = await readMayakSettings();
    const expectedSecret = String(settings.qwenReminderCronSecret || process.env.MAYAK_QWEN_REMINDER_CRON_SECRET || "").trim();
    if (!expectedSecret) {
        return false;
    }

    const providedSecret =
        String(req.headers["x-mayak-cron-secret"] || "").trim() ||
        readBearerToken(req);

    return providedSecret === expectedSecret;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const cronAuthorized = await isCronAuthorized(req);
    const adminAuthorized = isMayakAdminConfigured() && isMayakAdminAuthenticated(req);

    if (!cronAuthorized && !adminAuthorized) {
        return res.status(401).json({
            success: false,
            error: "Требуется авторизация администратора или cron-secret",
        });
    }

    try {
        const result = await runQwenReminderCheck();
        return res.status(200).json({
            success: true,
            triggeredBy: cronAuthorized ? "cron_secret" : "admin_session",
            ...result,
        });
    } catch (error) {
        console.error("[QwenReminder API] Ошибка запуска:", error);
        return res.status(500).json({
            success: false,
            error: "Не удалось выполнить проверку Qwen-токенов",
            details: error.message,
        });
    }
}
