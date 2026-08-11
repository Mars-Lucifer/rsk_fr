import { PORTAL_API_BASE } from "@/lib/portalApiBase";

// Исключение участника лидером. Кого исключаем — в query `userId`, чтобы
// не заводить вложенный динамический маршрут ради одного числа.
export default async function RemoveMember(req, res) {
    if (req.method !== "DELETE") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const authToken = req.cookies.users_access_token;
    if (!authToken) {
        return res.status(401).json({ success: false, error: "No token provided" });
    }

    const teamId = req.query.id;
    const userId = Number(req.query.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ success: false, error: "userId обязателен" });
    }

    try {
        const response = await fetch(`${PORTAL_API_BASE}/teams/teams/remove_member/${teamId}/${userId}`, {
            method: "DELETE",
            headers: {
                Accept: "application/json",
                Cookie: req.headers.cookie || "",
            },
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return res.status(response.status).json({ success: false, error: data?.detail || "Не удалось исключить участника" });
        }

        return res.status(200).json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
