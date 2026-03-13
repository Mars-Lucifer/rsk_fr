import { getMayakSessionSnapshot } from "@/lib/mayakSessions";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const token = String(req.query.token || "").trim();
        const userId = String(req.query.userId || "").trim();
        if (!token || !userId) {
            return res.status(400).json({ success: false, error: "token и userId обязательны" });
        }

        const snapshot = getMayakSessionSnapshot({ token, userId });
        if (!snapshot) {
            return res.status(404).json({ success: false, error: "Сессия не найдена" });
        }

        return res.status(200).json({ success: true, data: snapshot });
    } catch (error) {
        console.error("Error fetching MAYAK session snapshot:", error);
        return res.status(500).json({ success: false, error: error.message || "Ошибка чтения состояния сессии" });
    }
}
