import { PORTAL_API_BASE } from "@/lib/portalApiBase";

export default async function RegHandler(req, res) {
    try {
        const token = req.cookies.users_access_token;
        if (!token) {
            return res.status(401).json({ success: false, error: "No token provided" });
        }

        const bodyData = req.body;
        bodyData.direction = "Наука";

        const response = await fetch(`${PORTAL_API_BASE}/teams/teams/update_team_data/${req.query.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: req.headers.cookie || "",
            },
            body: JSON.stringify(bodyData),
            cache: "no-store",
        });

        const data = await response.json();
        console.log(data);

        if (!response.ok) {
            return res.json({ success: false, data });
        }

        // возвращаем клиенту
        return res.json({ success: true, data });
    } catch (err) {
        console.log("error", err.message);
        return res.json({ success: false, error: err.message }, { status: 500 });
    }
}
