import { markMayakTaskStarted } from "@/lib/mayakSessions";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { token, userId, taskNumber, taskName, sectionId } = req.body || {};
        if (!token || !userId || !taskNumber) {
            return res.status(400).json({ success: false, error: "token, userId и taskNumber обязательны" });
        }

        const session = markMayakTaskStarted({
            token: String(token),
            userId: String(userId),
            taskNumber: String(taskNumber),
            taskName: taskName ? String(taskName) : null,
            sectionId: sectionId ? String(sectionId) : null,
        });

        return res.status(200).json({ success: true, data: session });
    } catch (error) {
        console.error("Error marking MAYAK task start:", error);
        return res.status(500).json({ success: false, error: error.message || "Ошибка старта задания" });
    }
}
