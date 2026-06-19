import { setMayakSessionParticipantDebugProgress } from "@/lib/mayakSessionRuntime";

// Админ-отладка: переопределяет ВИТРИННЫЙ прогресс части «Я» участника сессии
// (этап/счётчик/направление/джокер) для панели отладки в тренажёре. Реальные
// задачи/ревью не меняются, серверный расчёт прогресса и расход джокера
// (mayakSessionDashboard) этот override игнорируют — обхода инспектора нет.
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { sessionId, userId, debugProgress } = req.body || {};
        const participant = await setMayakSessionParticipantDebugProgress({
            sessionId: String(sessionId || ""),
            userId: String(userId || ""),
            debugProgress: debugProgress ?? null,
        });

        return res.status(200).json({ success: true, data: participant });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось обновить отладочный прогресс" });
    }
}
