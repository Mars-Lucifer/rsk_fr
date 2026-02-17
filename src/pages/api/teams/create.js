export default async function RegHandler(req, res) {
    try {
        const token = req.cookies.users_access_token;
        if (!token) {
            return res.status(401).json({ success: false, error: "No token provided" });
        }

        const response = await fetch("https://api.rosdk.ru/teams/teams/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: req.headers.cookie || "",
            },
            body: JSON.stringify({
                name: req.body.name,
                direction: "Другое",
                region: req.body.region,
                organization_id: req.body.organization_id,
            }),
            cache: "no-store",
        });

        const data = await response.json();

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
