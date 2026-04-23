import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import { revokeMayakAdminRight, updateMayakAdminRight } from "@/lib/mayakAdminRights";

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    const rightId = String(req.query?.id || "");

    if (req.method === "PATCH") {
        try {
            const right = await updateMayakAdminRight(req, rightId, req.body || {});
            return res.status(200).json({ success: true, data: right });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось обновить админ-права" });
        }
    }

    if (req.method === "DELETE") {
        try {
            const right = await revokeMayakAdminRight(rightId);
            return res.status(200).json({ success: true, data: right });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось отозвать админ-права" });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
