import { requireMayakAdmin } from "../../../../../lib/mayakAdminAuth.js";
import { getMayakSessionById, updateMayakSession } from "@/lib/mayakSessions";

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    const sessionId = String(req.query.id || "");
    if (!sessionId) {
        return res.status(400).json({ success: false, error: "Session id is required" });
    }

    if (req.method === "GET") {
        const session = getMayakSessionById(sessionId);
        if (!session) {
            return res.status(404).json({ success: false, error: "Сессия не найдена" });
        }
        return res.status(200).json({ success: true, data: session });
    }

    if (req.method === "PATCH") {
        try {
            const { name, status, tables, inspectorAssignments } = req.body || {};
            const updated = updateMayakSession(sessionId, {
                ...(name !== undefined ? { name: String(name || "").trim() } : {}),
                ...(status !== undefined ? { status } : {}),
                ...(tables !== undefined ? { tables } : {}),
                ...(inspectorAssignments !== undefined ? { inspectorAssignments } : {}),
            });

            if (!updated) {
                return res.status(404).json({ success: false, error: "Сессия не найдена" });
            }

            return res.status(200).json({ success: true, data: updated });
        } catch (error) {
            console.error("Error updating MAYAK session:", error);
            return res.status(500).json({ success: false, error: error.message || "Ошибка обновления сессии" });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
