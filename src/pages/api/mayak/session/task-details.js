import { getSectionBundle } from "@/lib/mayakContentStorage";
import { getMayakParticipantTaskContext, getMayakTaskReviewContext } from "@/lib/mayakSessions";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const token = String(req.query.token || "").trim();
        const userId = String(req.query.userId || "").trim();
        const taskKey = String(req.query.taskKey || "").trim();
        const mode = String(req.query.mode || "inspector").trim();

        if (!token || !userId || !taskKey) {
            return res.status(400).json({ success: false, error: "token, userId и taskKey обязательны" });
        }

        const context = mode === "participant" ? getMayakParticipantTaskContext({ token, userId, taskKey }) : getMayakTaskReviewContext({ token, inspectorUserId: userId, taskKey });
        if (!context) {
            return res.status(404).json({ success: false, error: "Контекст задания не найден" });
        }

        const bundle = context.taskState?.sectionId ? await getSectionBundle(context.taskState.sectionId, { includeTexts: true }) : null;
        const taskText = Array.isArray(bundle?.texts) ? bundle.texts.find((item) => String(item.number || "") === String(context.taskState.taskNumber || "")) || null : null;

        return res.status(200).json({
            success: true,
            data: {
                session: context.session,
                participant: context.participant,
                inspector: context.inspector || null,
                taskState: context.taskState,
                taskText,
            },
        });
    } catch (error) {
        console.error("Error fetching MAYAK task details:", error);
        return res.status(500).json({ success: false, error: error.message || "Ошибка чтения задания" });
    }
}
