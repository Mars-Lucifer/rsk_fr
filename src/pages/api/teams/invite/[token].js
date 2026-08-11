import { PORTAL_API_BASE } from "@/lib/portalApiBase";

// Что за команда по ссылке-приглашению и пустят ли в неё. Нужна странице
// приглашения: показать состав до вступления и объяснить отказ заранее.
export default async function InvitePreview(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const authToken = req.cookies.users_access_token;
    if (!authToken) {
        return res.status(401).json({ success: false, error: "No token provided" });
    }

    try {
        const response = await fetch(`${PORTAL_API_BASE}/teams/teams/invite/${encodeURIComponent(req.query.token)}`, {
            headers: {
                Accept: "application/json",
                Cookie: req.headers.cookie || "",
            },
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return res.status(response.status).json({ success: false, error: data?.detail || "Ссылка недействительна" });
        }

        return res.status(200).json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
