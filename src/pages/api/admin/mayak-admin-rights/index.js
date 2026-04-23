import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import { grantMayakAdminRight, listMayakAdminRights } from "@/lib/mayakAdminRights";

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method === "GET") {
        try {
            const rights = await listMayakAdminRights();
            return res.status(200).json({ success: true, data: rights });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message || "Не удалось загрузить админ-права" });
        }
    }

    if (req.method === "POST") {
        try {
            const right = await grantMayakAdminRight(req, req.body || {});
            return res.status(200).json({ success: true, data: right });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось выдать админ-права" });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
