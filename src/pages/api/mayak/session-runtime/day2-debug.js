import { setDay2DebugTakt } from "@/lib/mayakSessionRuntime";

// Отладка второго дня: перепрыгнуть в нужный такт и вернуться обратно.
// Право проверяет сам рантайм — маршрут работает только на отладочной сессии,
// в настоящей он отвечает отказом.
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { sessionId, userId, takt } = req.body || {};
        const state = await setDay2DebugTakt({
            sessionId: String(sessionId || ""),
            userId: String(userId || ""),
            takt,
        });
        return res.status(200).json({ success: true, data: state });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось сменить такт" });
    }
}
