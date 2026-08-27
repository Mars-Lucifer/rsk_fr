import { setMayakSessionParticipantCardNumber } from "@/lib/mayakSessionRuntime";

// Второй день: участник называет номер тайла, который взял со стола. Отдельный
// маршрут, а не поле в регистрации: номер закрепляется один раз за сессию и
// проверяется иначе — на диапазон, на стол и на занятость соседом.
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { sessionId, userId, cardNumber } = req.body || {};
        const participant = await setMayakSessionParticipantCardNumber({
            sessionId: String(sessionId || ""),
            userId: String(userId || ""),
            cardNumber,
        });
        return res.status(200).json({ success: true, data: participant });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось закрепить номер тайла" });
    }
}
