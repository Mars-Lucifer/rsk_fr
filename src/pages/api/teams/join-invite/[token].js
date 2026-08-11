import { PORTAL_API_BASE } from "@/lib/portalApiBase";

// Вступление в команду по ссылке-приглашению — единственный путь в команду
// в конкурсе. Все проверки (этап «Я», организация, состав 3+1) делает
// teams_service, здесь только проксирование и понятная ошибка.
export default async function JoinByInvite(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const authToken = req.cookies.users_access_token;
    if (!authToken) {
        return res.status(401).json({ success: false, error: "No token provided" });
    }

    try {
        const response = await fetch(`${PORTAL_API_BASE}/teams/teams/join_by_invite/${encodeURIComponent(req.query.token)}`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                Cookie: req.headers.cookie || "",
            },
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return res.status(response.status).json({ success: false, error: data?.detail || "Не удалось вступить в команду" });
        }

        return res.status(200).json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
