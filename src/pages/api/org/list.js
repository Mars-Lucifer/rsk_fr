import { PORTAL_API_BASE } from "@/lib/portalApiBase";

export default async function getOrganizations(req, res) {
    try {
        const token = req.cookies.users_access_token;
        if (!token) return res.status(401).json({ success: false, error: "No token provided" });

        const { region } = req.query;

        const params = new URLSearchParams();
        if (region) params.append("region", region);

        const response = await fetch(`${PORTAL_API_BASE}/orgs/organizations/all?${params.toString()}`, {
            headers: {
                Accept: "application/json",
                Cookie: req.headers.cookie || "",
            },
        });

        if (!response.ok) {
            const text = await response.text();
            return res.status(response.status).json({ success: false, error: text });
        }

        const data = await response.json();
        return res.json({ 
            success: true, 
            data: data.data || [] });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
