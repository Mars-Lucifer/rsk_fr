import { PORTAL_API_BASE } from "@/lib/portalApiBase";

export default async function CoursID(req, res) {
    try {
        const token = req.cookies.users_access_token;
        if (!token) {
            return res.status(401).json({ success: false, error: "No token provided" });
        }

        const { id } = req.query;

        // Получаем основную инфу профиля
        const response_info = await fetch(`${PORTAL_API_BASE}/learning/api/courses/${id}`, {
            headers: {
                "Content-Type": "application/json",
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

        return res.json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
