import { getMayakSessionByToken, registerMayakSessionParticipant } from "@/lib/mayakSessions";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { token, userId, userData } = req.body || {};
        if (!token || !userId || !userData) {
            return res.status(400).json({ success: false, error: "token, userId и userData обязательны" });
        }

        const session = getMayakSessionByToken(String(token));
        if (!session) {
            return res.status(404).json({ success: false, error: "Сессия по токену не найдена" });
        }

        const result = registerMayakSessionParticipant({ token: String(token), userId: String(userId), userData });
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error("Error registering MAYAK participant:", error);
        return res.status(500).json({ success: false, error: error.message || "Ошибка регистрации участника" });
    }
}
