import { PORTAL_API_BASE } from "@/lib/portalApiBase";

export default async function ProfileUpdateHandler(req, res) {
    try {
        const token = req.cookies.users_access_token;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: "No token provided",
            });
        }

        const { id } = req.query;

        if (req.method !== "POST") {
            return res.status(405).json({
                success: false,
                error: "Method not allowed",
            });
        }

        const response = await fetch(`${PORTAL_API_BASE}/projects/zvezda/moderator/${id}/review`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: req.headers.cookie || "",
            },
            body: JSON.stringify(req.body),
            cache: "no-store",
        });

        const data = await response.json();

        return res.status(response.status).json({
            success: response.ok,
            data,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
}
