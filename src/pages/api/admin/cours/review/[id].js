import { PORTAL_API_BASE } from "@/lib/portalApiBase";

export default async function ProfileUpdateHandler(req, res) {
    try {
        const token = req.cookies.users_access_token;
        if (!token) {
            return res.status(401).json({ success: false, error: "No token provided" });
        }

        const id = req.query;

        // Проверка метода
        if (req.method !== "PATCH") {
            return res.status(405).json({ success: false, error: "Method not allowed" });
        }

        const response = await fetch(`${PORTAL_API_BASE}/learning/api/moderator/${id.id}/review`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: req.headers.cookie || "",
            },
            body: JSON.stringify(req.body),
            cache: "no-store",
        });

        const data = await response.json();
        console.log(data);

        // Возвращаем клиенту
        return res.json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
