import { assignMayakParticipantRole } from "@/lib/mayakSessions";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { token, userId, role } = req.body || {};
        if (!token || !userId || !role) {
            return res.status(400).json({ success: false, error: "token, userId и role обязательны" });
        }

        const result = assignMayakParticipantRole({ token: String(token), userId: String(userId), role: String(role) });
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error("Error assigning MAYAK role:", error);
        return res.status(500).json({ success: false, error: error.message || "Ошибка назначения роли" });
    }
}
