import { PORTAL_API_BASE } from "@/lib/portalApiBase";

// /pages/api/auth/logout.js
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false });
    }

    try {
        await fetch(`${PORTAL_API_BASE}/auth/users_interaction/logout/`, {
            method: "POST",
            headers: {
                Cookie: req.headers.cookie || "",
            },
        });

        res.setHeader("Set-Cookie", ["users_access_token=; Domain=.rosdk.ru; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None"]);

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
}
