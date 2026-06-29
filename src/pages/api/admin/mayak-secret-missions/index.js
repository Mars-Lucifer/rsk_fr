import { requireMayakAdmin } from "../../../../lib/mayakAdminAuth.js";
import { getSecretMissionsConfig, saveSecretMissionsConfig } from "../../../../lib/mayakSecretMissions.js";

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method === "GET") {
        try {
            const config = await getSecretMissionsConfig();
            return res.status(200).json({ success: true, data: config });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось загрузить пул миссий" });
        }
    }

    if (req.method === "PUT") {
        try {
            const config = await saveSecretMissionsConfig(req.body || {});
            return res.status(200).json({ success: true, data: config });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось сохранить пул миссий" });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
