import { requireMayakAdmin } from "../../../../../lib/mayakAdminAuth.js";
import {
    listMayakSessionParticipants,
    setMayakSessionParticipantRole,
    moveMayakSessionParticipantTable,
    setMayakSessionParticipantHidden,
    removeMayakSessionParticipant,
} from "../../../../../lib/mayakSessionRuntime.js";

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    const sessionId = String(req.query?.id || "");

    if (req.method === "GET") {
        try {
            const participants = await listMayakSessionParticipants(sessionId);
            return res.status(200).json({ success: true, data: participants });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432 \u0441\u0435\u0441\u0441\u0438\u0438" });
        }
    }

    if (req.method === "PATCH") {
        try {
            const { userId, role, tableNumber, hidden } = req.body || {};
            const normalizedUserId = String(userId || "");

            // \u0421\u043a\u0440\u044b\u0442\u044c/\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430 \u0432 \u0434\u0430\u0448\u0431\u043e\u0440\u0434\u0435 (\u0440\u0435\u0436\u0438\u043c \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440\u0430). \u0414\u0430\u043d\u043d\u044b\u0435 \u0438
            // \u0441\u0435\u0441\u0441\u0438\u044f \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430 \u043d\u0435 \u0442\u0440\u043e\u0433\u0430\u044e\u0442\u0441\u044f \u2014 \u0442\u043e\u043b\u044c\u043a\u043e \u0432\u0438\u0434\u0438\u043c\u043e\u0441\u0442\u044c \u0432 \u043c\u0435\u0442\u0440\u0438\u043a\u0430\u0445.
            if (hidden !== undefined) {
                const participant = await setMayakSessionParticipantHidden({
                    sessionId,
                    userId: normalizedUserId,
                    hidden: Boolean(hidden),
                });
                return res.status(200).json({ success: true, data: participant });
            }

            // \u041f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u0435 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430 \u0437\u0430 \u0434\u0440\u0443\u0433\u043e\u0439 \u0441\u0442\u043e\u043b (\u0440\u0435\u0436\u0438\u043c \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440\u0430 \u0434\u0430\u0448\u0431\u043e\u0440\u0434\u0430).
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
            return res.status(400).json({ success: false, error: error.message || "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430" });
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
