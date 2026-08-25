import { PORTAL_API_BASE } from "@/lib/portalApiBase";

// pages/api/learning.js
export default async function getLessons(req, res) {
    try {
        const response = await fetch(`${PORTAL_API_BASE}/learning/`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Cookie: req.headers.cookie || "",
            },
        });

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: "Failed to fetch lessons",
            });
        }

        const data = await response.json();
        return res.json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
