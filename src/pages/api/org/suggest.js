import { PORTAL_API_BASE } from "@/lib/portalApiBase";

// Подсказки организаций из реестра: участник вводит название или ИНН.
// Ничего не сохраняет — организация появляется в базе только после выбора.
export default async function SuggestOrgs(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const query = String(req.query.query || "").trim();
    if (query.length < 3) {
        return res.status(200).json({ success: true, data: [] });
    }

    try {
        const params = new URLSearchParams({ query, count: String(req.query.count || 10) });
        // Регион сужает подсказки по названию на стороне реестра.
        const region = String(req.query.region || "").trim();
        if (region) {
            params.append("region", region);
        }
        const response = await fetch(`${PORTAL_API_BASE}/orgs/organizations/suggest?${params.toString()}`, {
            headers: {
                Accept: "application/json",
                Cookie: req.headers.cookie || "",
            },
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: data?.detail || "Реестр организаций недоступен",
            });
        }

        return res.status(200).json({ success: true, data: Array.isArray(data) ? data : [] });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
