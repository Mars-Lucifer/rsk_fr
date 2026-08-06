import { getMayakSessionDashboardData } from "@/lib/mayakSessionDashboard";
import { resolveDashboardSecret, pruneSessionLinksIfSessionGone } from "@/lib/mayakSessionLinks";

// Дашборд сессии для мастера: авторизация по секрету в URL (дашборд- или
// мастер-секрет), без admin-пароля. Зеркалит admin-эндпоинт по данным.
export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const secret = String(req.query?.secret || "");
    const record = await resolveDashboardSecret(secret);
    if (!record) {
        return res.status(401).json({ success: false, error: "Ссылка недействительна" });
    }

    try {
        const data = await getMayakSessionDashboardData(record.sessionId);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        // Сессия могла истечь и быть вычищена свипом — подчистим ссылки.
        await pruneSessionLinksIfSessionGone(record.sessionId).catch(() => {});
        return res.status(400).json({ success: false, error: error.message || "Не удалось загрузить дашборд сессии" });
    }
}
