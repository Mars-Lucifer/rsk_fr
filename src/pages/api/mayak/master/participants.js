import { resolveDashboardSecret } from "@/lib/mayakSessionLinks";
import {
    listMayakSessionParticipants,
    setMayakSessionParticipantRole,
    moveMayakSessionParticipantTable,
    setMayakSessionParticipantHidden,
    removeMayakSessionParticipant,
} from "@/lib/mayakSessionRuntime";

// Управление участниками сессии из дашборда мастера (редактор): роли, столы,
// скрытие, удаление. Зеркало admin-эндпоинта, но авторизация по секрету в URL.
export default async function handler(req, res) {
    const secret = String(req.query?.secret || "");
    const record = await resolveDashboardSecret(secret);
    if (!record) {
        return res.status(401).json({ success: false, error: "Ссылка недействительна" });
    }

    const sessionId = record.sessionId;

    if (req.method === "GET") {
        try {
            const participants = await listMayakSessionParticipants(sessionId);
            return res.status(200).json({ success: true, data: participants });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось загрузить участников сессии" });
        }
    }

    if (req.method === "PATCH") {
        try {
            const { userId, role, tableNumber, hidden } = req.body || {};
            const normalizedUserId = String(userId || "");

            if (hidden !== undefined) {
                const participant = await setMayakSessionParticipantHidden({
                    sessionId,
                    userId: normalizedUserId,
                    hidden: Boolean(hidden),
                });
                return res.status(200).json({ success: true, data: participant });
            }

            if (tableNumber !== undefined && tableNumber !== null && tableNumber !== "") {
                const participant = await moveMayakSessionParticipantTable({
                    sessionId,
                    userId: normalizedUserId,
                    tableNumber,
                });
                return res.status(200).json({ success: true, data: participant });
            }

            const participant = await setMayakSessionParticipantRole({
                sessionId,
                userId: normalizedUserId,
                role: String(role || ""),
            });
            return res.status(200).json({ success: true, data: participant });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось изменить участника" });
        }
    }

    if (req.method === "DELETE") {
        try {
            const { userId } = req.body || {};
            const result = await removeMayakSessionParticipant({
                sessionId,
                userId: String(userId || ""),
            });
            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось удалить участника" });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
