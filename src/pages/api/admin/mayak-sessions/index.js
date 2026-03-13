import { requireMayakAdmin } from "../../../../lib/mayakAdminAuth.js";
import { createMayakSession, getAllMayakSessions } from "@/lib/mayakSessions";
import { createToken } from "@/utils/mayakTokens";

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method === "GET") {
        try {
            const sessions = getAllMayakSessions();
            return res.status(200).json({ success: true, data: sessions });
        } catch (error) {
            console.error("Error fetching MAYAK sessions:", error);
            return res.status(500).json({ success: false, error: "Ошибка загрузки сессий" });
        }
    }

    if (req.method === "POST") {
        try {
            const { name, usageLimit, taskRange, sectionId, tables, inspectorAssignments, tokenName, customToken } = req.body || {};
            if (!name || !String(name).trim()) {
                return res.status(400).json({ success: false, error: "Название сессии обязательно" });
            }

            const parsedUsageLimit = parseInt(usageLimit, 10);
            if (!parsedUsageLimit || parsedUsageLimit <= 0) {
                return res.status(400).json({ success: false, error: "Лимит использований токена должен быть положительным" });
            }

            const normalizedTables = Array.isArray(tables) ? tables.map((value) => String(value || "").trim()).filter(Boolean) : [];
            if (normalizedTables.length === 0) {
                return res.status(400).json({ success: false, error: "Добавьте хотя бы один стол" });
            }

            const newToken = createToken(
                String(tokenName || name).trim(),
                parsedUsageLimit,
                taskRange || null,
                customToken ? String(customToken).trim() : null,
                sectionId || null
            );

            const session = createMayakSession({
                name: String(name).trim(),
                tokenId: newToken.id,
                token: newToken.token,
                sectionId: sectionId || null,
                taskRange: taskRange || null,
                tables: normalizedTables,
                inspectorAssignments: Array.isArray(inspectorAssignments) ? inspectorAssignments : [],
            });

            return res.status(201).json({ success: true, data: { session, token: newToken } });
        } catch (error) {
            console.error("Error creating MAYAK session:", error);
            return res.status(500).json({ success: false, error: error.message || "Ошибка создания сессии" });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
