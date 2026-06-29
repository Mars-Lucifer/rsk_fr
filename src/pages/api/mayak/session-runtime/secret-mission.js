import { assignSecretMission } from "@/lib/mayakSessionRuntime";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { sessionId, userId } = req.body || {};
        const mission = await assignSecretMission({
            sessionId: String(sessionId || ""),
            userId: String(userId || ""),
        });
        return res.status(200).json({ success: true, data: mission });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось получить тайную миссию" });
    }
}
