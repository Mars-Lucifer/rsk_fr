import { PORTAL_API_BASE } from "@/lib/portalApiBase";

// Создание организации по выбранной подсказке. Передаём только ИНН: название,
// регион и тип берутся из реестра на бэкенде, поэтому подменить их нельзя.
// Идемпотентно: если организация уже заведена, вернётся существующая.
export default async function CreateOrg(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const token = req.cookies.users_access_token;
    if (!token) {
        return res.status(401).json({ success: false, error: "No token provided" });
    }

    const inn = String(req.body?.inn || "").trim();
    if (!/^\d{10}$|^\d{12}$/.test(inn)) {
        return res.status(400).json({ success: false, error: "ИНН должен состоять из 10 или 12 цифр" });
    }

    try {
        const response = await fetch(`${PORTAL_API_BASE}/orgs/organizations/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Cookie: req.headers.cookie || "",
            },
            body: JSON.stringify({ inn }),
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: data?.detail || "Не удалось добавить организацию",
            });
        }

        return res.status(200).json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
