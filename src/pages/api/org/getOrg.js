import { PORTAL_API_BASE } from "@/lib/portalApiBase";

export default async function getOrg(req, res) {
    try {
        const token = req.cookies.users_access_token;
        if (!token) {
            return res.status(401).json({ success: false, error: "No token provided" });
        }

        // читаем skip, limit и search из query
        const { skip = 0, limit = 20, search = "" } = req.query;

        const response_info = await fetch(`${PORTAL_API_BASE}/orgs/organizations/?skip=${skip}&limit=${limit}&search=${encodeURIComponent(search)}`, {
            headers: {
                Accept: "application/json",
                Cookie: req.headers.cookie || "",
            },
        });

        if (!response_info.ok) {
            return res.status(response_info.status).json({
                success: false,
                error: "Failed to fetch orgs",
            });
        }

        const data = await response_info.json();

        return res.json({
            success: true,
            organizations: data || [],
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
