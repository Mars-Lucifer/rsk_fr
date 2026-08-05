import { PORTAL_API_BASE } from "@/lib/portalApiBase";

export default async function changeUserRole(req, res) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({
                success: false,
                error: "Method not allowed",
            });
        }

        const token = req.cookies.users_access_token;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: "No token provided",
            });
        }

        const { user_id, role } = req.body;

        if (!user_id || !role) {
            return res.status(400).json({
                success: false,
                error: "username and role required",
            });
        }

        const response = await fetch(`${PORTAL_API_BASE}/users/profile_interaction/admin-role`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: req.headers.cookie || "",
            },
            body: JSON.stringify({
                role: role,
                user_id: user_id,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: data?.error || "API error",
            });
        }

        return res.json({
            success: true,
            data,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
}
