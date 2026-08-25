import { PORTAL_API_BASE } from "@/lib/portalApiBase";

export default async function handler(req, res) {
    if (req.method !== "DELETE") {
        return res.status(405).json({ success: false, error: "Method Not Allowed" });
    }

    try {
        const { team_id } = req.query;
        console.log("API Route: Received DELETE request for team_id:", team_id);

        const externalApiUrl = `${PORTAL_API_BASE}/teams/teams/delete_team/${team_id}`;
        console.log("API Route: Calling external API URL:", externalApiUrl);

        const response = await fetch(externalApiUrl, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
        });

        const data = await response.json();

        if (response.ok) {
            console.log("API Route: External API responded successfully (200 OK).");
            console.log("API Route: Data from external API:", data);
            res.status(200).json({ success: true, data });
        } else {
            console.error("API Route: External API responded with an error.");
            console.error("API Route: Status:", response.status);
            console.error("API Route: Status Text:", response.statusText);
            console.error("API Route: Error details from external API:", data);
            res.status(response.status).json({ success: false, error: data.message || data.detail || "Something went wrong", details: data });
        }
    } catch (error) {
        console.error("API Route: Error in try-catch block:", error);
        res.status(500).json({ success: false, error: error.message || "Internal Server Error", details: error });
    }
}

