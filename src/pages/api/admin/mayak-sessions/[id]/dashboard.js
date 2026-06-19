import { requireMayakAdmin } from "../../../../../lib/mayakAdminAuth.js";
import { getMayakSessionDashboardData } from "../../../../../lib/mayakSessionDashboard.js";

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const sessionId = String(req.query?.id || "");

    try {
        const data = await getMayakSessionDashboardData(sessionId);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось загрузить дашборд сессии" });
    }
}
