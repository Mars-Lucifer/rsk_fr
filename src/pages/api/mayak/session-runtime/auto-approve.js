import { autoApproveMayakSessionTask } from "@/lib/mayakSessionRuntime";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { sessionId, userId, taskNumber, taskIndex, taskName } = req.body || {};
        const taskState = await autoApproveMayakSessionTask({
            sessionId: String(sessionId || ""),
            userId: String(userId || ""),
            taskNumber: String(taskNumber || ""),
            taskIndex: Number.isFinite(taskIndex) ? taskIndex : 0,
            taskName: String(taskName || ""),
        });
        return res.status(200).json({ success: true, data: taskState });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось автоматически одобрить задание" });
    }
}
