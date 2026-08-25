import { PORTAL_API_BASE } from "@/lib/portalApiBase";

export default async function ResetPasswordHandler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {
        const response = await fetch(`${PORTAL_API_BASE}/auth/users_interaction/reset-password/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ email_or_login: req.body.email_or_login }),
        });

        const data = await response.json();
        const errorMessage = data?.error || data?.detail || "Не удалось отправить письмо";

        if (!response.ok) {
            return res.status(response.status).json({ success: false, error: errorMessage });
        }

        return res.json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
