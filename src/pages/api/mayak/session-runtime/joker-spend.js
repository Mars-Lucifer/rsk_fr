import { spendJokerStarAndApproveTask } from "@/lib/mayakSessionRuntime";
import { getJokerSpendContext } from "@/lib/mayakSessionDashboard";

// Расход звезды-джокера: мгновенно одобряет задание направления части «Мы»
// без проверки инспектора. Earned/баланс и принадлежность задания к «Мы»
// проверяются на сервере (анти-чит), сам расход атомарен (см. рантайм).
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { sessionId, userId, taskNumber, taskIndex, taskName } = req.body || {};
        const sid = String(sessionId || "");
        const uid = String(userId || "");
        const idx = Number(taskIndex);

        if (!sid || !uid) {
            return res.status(400).json({ success: false, error: "Не указаны параметры сессии" });
        }

        const ctx = await getJokerSpendContext(sid, uid, idx);
        if (!ctx.isWeDirectionTask) {
            return res.status(400).json({
                success: false,
                error: "Звезду-джокер можно потратить только на задание направления части «Мы»",
            });
        }
        if (ctx.balance < 1) {
            return res.status(400).json({ success: false, error: "Нет доступных звёзд-джокеров" });
        }

        const result = await spendJokerStarAndApproveTask({
            sessionId: sid,
            userId: uid,
            taskNumber: String(taskNumber || ""),
            taskIndex: idx,
            taskName: String(taskName || ""),
            earnedJokerStars: ctx.earned,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось использовать звезду-джокер" });
    }
}
