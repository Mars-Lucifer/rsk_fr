export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    return res.status(400).json({
        success: false,
        error: "Для завершения задания требуется прикрепить файл результата. Используйте /api/mayak/session/task-submit-upload.",
    });
}
