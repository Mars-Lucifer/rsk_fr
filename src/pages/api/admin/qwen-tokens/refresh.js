import { requireMayakAdmin } from "../../../../lib/mayakAdminAuth.js";
import { readMayakSettings, writeMayakSettings } from "../../../../lib/mayakSettings.js";
import { refreshStoredQwenTokens } from "../../../../lib/mayakQwenRefresh.js";

export const config = {
    api: {
        responseLimit: false,
    },
};

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const settings = await readMayakSettings();
        const index = req.body?.index ?? null;
        const { tokens, updated } = await refreshStoredQwenTokens(settings, { index });

        settings.qwenTokens = tokens;
        await writeMayakSettings(settings);

        return res.status(200).json({
            success: true,
            updated,
        });
    } catch (error) {
        console.error("[QwenTokens] refresh failed:", error);
        return res.status(500).json({
            success: false,
            error: error.message || "Не удалось обновить Qwen-токены",
        });
    }
}
