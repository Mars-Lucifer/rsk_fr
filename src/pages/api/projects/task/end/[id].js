import { PORTAL_API_BASE } from "@/lib/portalApiBase";

export default async function endProjectTask(req, res) {
    try {
        const token = req.cookies.users_access_token;
        if (!token) {
            return res.status(401).json({ success: false, error: "No token provided" });
        }
        const bodyData = req.body;

        const response_info = await fetch(`${PORTAL_API_BASE}/projects/zvezda/tasks/${req.query.id}/submit`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Cookie: req.headers.cookie || "",
            },
            body: JSON.stringify(bodyData),
        });

        const data = await response_info.json();
        console.log("End: ", data);

        return res.json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
