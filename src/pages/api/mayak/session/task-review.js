import { reviewMayakTask } from "@/lib/mayakSessions";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { token, userId, taskKey, action, reason } = req.body || {};
        if (!token || !userId || !taskKey || !action) {
            return res.status(400).json({ success: false, error: "token, userId, taskKey и action обязательны" });
        }
        if (!["approve", "reject"].includes(String(action))) {
            return res.status(400).json({ success: false, error: "Некорректное действие" });
        }

        const session = reviewMayakTask({
            token: String(token),
            inspectorUserId: String(userId),
            taskKey: String(taskKey),
            action: String(action),
            reason: reason ? String(reason) : "",
        });

        return res.status(200).json({ success: true, data: session });
    } catch (error) {
        console.error("Error reviewing MAYAK task:", error);
        return res.status(500).json({ success: false, error: error.message || "Ошибка проверки задания" });
    }
}
