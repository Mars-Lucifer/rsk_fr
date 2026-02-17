import { createToken } from "@/utils/mayakTokens";

const ADMIN_PASSWORD = "a12345";

// Проверка пароля администратора
function checkAdminPassword(req) {
    const password = req.body?.password;

    if (password === ADMIN_PASSWORD) {
        return { authorized: true };
    }

    return { authorized: false, error: "Неверный пароль" };
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    // Проверка пароля администратора
    const authCheck = checkAdminPassword(req);
    if (!authCheck.authorized) {
        return res.status(403).json({ success: false, error: authCheck.error });
    }

    try {
        const { name, usageLimit, taskRange, customToken } = req.body;

        // Валидация входных данных
        if (!name || typeof name !== "string" || name.trim() === "") {
            return res.status(400).json({ success: false, error: "Название токена обязательно" });
        }

        if (!usageLimit || isNaN(parseInt(usageLimit, 10)) || parseInt(usageLimit, 10) <= 0) {
            return res.status(400).json({ success: false, error: "Лимит использований должен быть положительным числом" });
        }

        const newToken = createToken(name.trim(), usageLimit, taskRange, customToken ? customToken.trim() : null);

        return res.status(201).json({
            success: true,
            data: newToken,
        });
    } catch (error) {
        console.error("Error generating token:", error);
        return res.status(500).json({ success: false, error: error.message || "Ошибка сервера" });
    }
}
