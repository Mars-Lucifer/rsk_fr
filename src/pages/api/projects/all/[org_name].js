import { PORTAL_API_BASE } from "@/lib/portalApiBase";

// pages/api/projects/all.js
export default async function ProjectsAllHandler(req, res) {
    try {
        const token = req.cookies.users_access_token;
        if (!token) {
            return res.status(401).json({ success: false, error: "No token provided" });
        }

        // Получаем данные проектов из бекенда
        const { org_name } = req.query;
        const response = await fetch(`${PORTAL_API_BASE}/projects/zvezda/projects?organization_name=${org_name}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Cookie: req.headers.cookie || "",
                accept: "application/json",
            },
        });

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: "Failed to fetch projects",
            });
        }

        const data = await response.json();
        return res.json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
