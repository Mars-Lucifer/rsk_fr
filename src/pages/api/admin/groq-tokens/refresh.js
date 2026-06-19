import { requireMayakAdmin } from "../../../../lib/mayakAdminAuth.js";

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    // Groq tokens do not expire, so refreshing is a successful no-op.
    return res.status(200).json({
        success: true,
        updated: [],
    });
}
