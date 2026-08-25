import { getMayakSessionById } from "@/lib/mayakSessions";
import { resolveMasterSecret, pruneSessionLinksIfSessionGone } from "@/lib/mayakSessionLinks";

// Данные для консоли мастера: статус сессии + мастер-токен (для демо-входа без
// учёта) + дашборд-секрет (для перехода в дашборд). Только по мастер-секрету.
export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const secret = String(req.query?.secret || "");
    const record = await resolveMasterSecret(secret);
    if (!record) {
        return res.status(401).json({ success: false, error: "Ссылка недействительна" });
    }

    const session = await getMayakSessionById(record.sessionId);
    if (!session) {
        await pruneSessionLinksIfSessionGone(record.sessionId).catch(() => {});
        return res.status(404).json({ success: false, error: "Сессия не найдена или завершена" });
    }

    return res.status(200).json({
        success: true,
        data: {
            sessionId: session.id,
            sessionName: session.name || "",
            status: session.status || "active",
            sectionId: session.sectionId || "",
            taskRange: session.taskRange || "",
            tableCount: session.tableCount || 0,
            expiresAt: session.expiresAt || null,
            masterToken: record.masterToken || "",
            dashboardSecret: record.dashboardSecret || "",
        },
    });
}
