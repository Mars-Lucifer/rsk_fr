import { PORTAL_API_BASE } from "@/lib/portalApiBase";

// Ссылка-приглашение команды. GET — показать, POST — перевыпустить.
// Права проверяет teams_service: и то, и другое доступно только лидеру.
export default async function InviteLink(req, res) {
    const token = req.cookies.users_access_token;
    if (!token) {
        return res.status(401).json({ success: false, error: "No token provided" });
    }

    const teamId = req.query.id;
    const isRegenerate = req.method === "POST";
    if (!isRegenerate && req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const url = isRegenerate
            ? `${PORTAL_API_BASE}/teams/teams/invite_link/${teamId}/regenerate`
            : `${PORTAL_API_BASE}/teams/teams/invite_link/${teamId}`;

        const response = await fetch(url, {
            method: isRegenerate ? "POST" : "GET",
            headers: {
                Accept: "application/json",
                Cookie: req.headers.cookie || "",
            },
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return res.status(response.status).json({ success: false, error: data?.detail || "Не удалось получить ссылку" });
        }

        return res.status(200).json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
