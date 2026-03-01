import { deleteToken, getTokenById, updateToken } from "@/utils/mayakTokens";

const ADMIN_PASSWORD = "a12345";

// Проверка пароля администратора
function checkAdminPassword(req) {
    const password = req.query.password || req.body?.password;

    if (password === ADMIN_PASSWORD) {
        return { authorized: true };
    }

    return { authorized: false, error: "Неверный пароль" };
}

export default async function handler(req, res) {
    // Проверка пароля администратора
    const authCheck = checkAdminPassword(req);
    if (!authCheck.authorized) {
        return res.status(403).json({ success: false, error: authCheck.error });
    }

    const { id } = req.query;

    // GET - получить конкретный токен
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

    // PATCH - перепривязка токена к другому разделу
    if (req.method === "PATCH") {
        try {
            const existingToken = getTokenById(id);
            if (!existingToken) {
                return res.status(404).json({ success: false, error: "Токен не найден" });
            }

            const { sectionId, taskRange } = req.body;
            const updates = {};
            if (sectionId !== undefined) updates.sectionId = sectionId || null;
            if (taskRange !== undefined) updates.taskRange = taskRange || null;
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

    // DELETE - удалить токен
    if (req.method === "DELETE") {
        try {
            const existingToken = getTokenById(id);
            if (!existingToken) {
                return res.status(404).json({ success: false, error: "Токен не найден" });
            }

            const deletedToken = deleteToken(id);

            if (!deletedToken) {
                return res.status(500).json({ success: false, error: "Ошибка удаления токена" });
            }

            return res.status(200).json({
                success: true,
                message: "Токен удален",
                data: deletedToken,
            });
        } catch (error) {
            console.error("Error deleting token:", error);
            return res.status(500).json({ success: false, error: "Ошибка сервера" });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
