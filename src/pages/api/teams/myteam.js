import { PORTAL_API_BASE } from "@/lib/portalApiBase";

export default async function getMyTeam(req, res) {
    try {
        const token = req.cookies.users_access_token;
        if (!token) {
            return res.status(401).json({ success: false, error: "No token provided" });
        }

        const response_info = await fetch(`${PORTAL_API_BASE}/teams/teams/my_teams/`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Cookie: req.headers.cookie || "",
            },
        });

        if (!response_info.ok) {
            return res.status(response_info.status).json({
                success: false,
                error: "Failed to fetch profile",
            });
        }

        const data = await response_info.json();

        if (!data || data.length === 0) {
            return res.json({ success: false, data });
        }

        return res.json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
