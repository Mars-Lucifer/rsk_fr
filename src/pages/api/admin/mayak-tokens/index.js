import { getAllTokensWithStats } from "@/utils/mayakTokens";

const ADMIN_PASSWORD = "a12345";

// Проверка пароля администратора
function checkAdminPassword(req) {
    // Проверяем пароль из query или body
    const password = req.query.password || req.body?.password;

    if (password === ADMIN_PASSWORD) {
        return { authorized: true };
    }

    return { authorized: false, error: "Неверный пароль" };
}

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    // Проверка пароля администратора
    const authCheck = checkAdminPassword(req);
    if (!authCheck.authorized) {
        return res.status(403).json({ success: false, error: authCheck.error });
    }

    try {
        const tokens = getAllTokensWithStats();

        return res.status(200).json({
            success: true,
            data: tokens,
            total: tokens.length,
            activeCount: tokens.filter(t => t.isActive && !t.isExhausted).length,
            exhaustedCount: tokens.filter(t => t.isExhausted).length,
        });
    } catch (error) {
        console.error("Error fetching tokens:", error);
        return res.status(500).json({ success: false, error: "Ошибка сервера" });
    }
}
