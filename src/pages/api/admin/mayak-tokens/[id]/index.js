import { requireMayakAdmin } from "../../../../../lib/mayakAdminAuth.js";
import { deleteToken, getTokenById, updateToken } from "@/utils/mayakTokens";

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    const { id } = req.query;

    if (req.method === "GET") {
        try {
            const token = getTokenById(id);
            if (!token) {
                return res.status(404).json({ success: false, error: "Токен не найден" });
            }
            return res.status(200).json({
                success: true,
                data: {
                    ...token,
                    remainingAttempts: token.usageLimit - token.usedCount,
                },
            });
        } catch (error) {
            console.error("Error fetching token:", error);
            return res.status(500).json({ success: false, error: "Ошибка сервера" });
        }
    }

    if (req.method === "PATCH") {
        try {
            const existingToken = getTokenById(id);
            if (!existingToken) {
                return res.status(404).json({ success: false, error: "Токен не найден" });
            }

            const { name, sectionId, taskRange, usageLimit } = req.body;
            const updates = {};
            if (name !== undefined) {
                const normalizedName = String(name || "").trim();
                if (!normalizedName) {
                    return res.status(400).json({ success: false, error: "Название токена обязательно" });
                }
                updates.name = normalizedName;
            }
            if (sectionId !== undefined) updates.sectionId = sectionId || null;
            if (taskRange !== undefined) updates.taskRange = taskRange || null;
            if (usageLimit !== undefined) {
                const normalizedLimit = Number.parseInt(String(usageLimit), 10);
                if (!Number.isFinite(normalizedLimit) || normalizedLimit < Math.max(1, existingToken.usedCount || 0)) {
                    return res.status(400).json({ success: false, error: "Лимит не может быть меньше уже использованных входов" });
                }
                updates.usageLimit = normalizedLimit;
            }
            const updated = updateToken(id, updates);

            if (!updated) {
                return res.status(500).json({ success: false, error: "Ошибка обновления токена" });
            }

            return res.status(200).json({
                success: true,
                data: { ...updated, remainingAttempts: updated.usageLimit - updated.usedCount },
            });
        } catch (error) {
            console.error("Error updating token:", error);
            return res.status(500).json({ success: false, error: "Ошибка сервера" });
        }
    }

    if (req.method === "DELETE") {
        try {
            const existingToken = getTokenById(id);
            if (!existingToken) {
                return res.status(404).json({ success: false, error: "Токен не найден" });
            }

            const deleted = deleteToken(id);
            if (!deleted) {
                return res.status(500).json({ success: false, error: "Ошибка удаления токена" });
            }

            return res.status(200).json({ success: true, data: deleted });
        } catch (error) {
            console.error("Error deleting token:", error);
            return res.status(500).json({ success: false, error: "Ошибка сервера" });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
