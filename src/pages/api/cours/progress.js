import { PORTAL_API_BASE } from "@/lib/portalApiBase";

// Отметка урока пройденным. В конкурсе задание выполняется в тренажёре, и
// закрытие урока происходит по факту завершения, без очереди модерации —
// иначе на 8 уроков и сотни участников набегают тысячи ручных проверок.
export default async function CoursProgress(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const token = req.cookies.users_access_token;
        if (!token) {
            return res.status(401).json({ success: false, error: "No token provided" });
        }

        const courseId = Number(req.body?.course_id);
        if (!Number.isInteger(courseId) || courseId <= 0) {
            return res.status(400).json({ success: false, error: "course_id обязателен" });
        }

        const response = await fetch(`${PORTAL_API_BASE}/learning/api/courses/${courseId}/progress`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: req.headers.cookie || "",
            },
            body: JSON.stringify({ is_completed: req.body?.is_completed !== false }),
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return res.status(response.status).json({ success: false, error: "Не удалось сохранить прогресс", details: data });
        }

        return res.status(200).json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
