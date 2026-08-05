import { PORTAL_API_BASE } from "@/lib/portalApiBase";

export default async function OAuthCallbackHandler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { code, provider } = req.body;

        if (!code || !provider) {
            return res.status(400).json({ success: false, error: "Отсутствует код или провайдер" });
        }

        // TODO: Заменить на реальный endpoint когда будет готов бэк
        // Временно возвращаем заглушку
        const backendUrl = `${PORTAL_API_BASE}/auth/oauth/callback/`;

        const response = await fetch(backendUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                accept: "application/json",
            },
            body: JSON.stringify({
                code,
                provider, // 'yandex' или 'vk'
            }),
            cache: "no-store",
            credentials: "include",
        });

        const setCookie = response.headers.get("set-cookie");

        if (setCookie) {
            res.setHeader("Set-Cookie", setCookie);
        }

        const data = await response.json();

        if (!response.ok) {
            switch (response.status) {
                case 422:
                    return res.status(422).json({ success: false, error: "Неверные данные от OAuth провайдера" });
                case 400:
                    return res.status(400).json({ success: false, error: "Неверный запрос" });
                case 401:
                    return res.status(401).json({ success: false, error: "Не удалось авторизовать пользователя" });
                case 403:
                    return res.status(403).json({ success: false, error: "Доступ запрещён" });
                case 404:
                    return res.status(404).json({ success: false, error: "Endpoint не найден" });
                default:
                    return res.status(response.status).json({ success: false, error: data.message || "Неизвестная ошибка" });
            }
        }

        // Ожидаемый формат ответа от бэка:
        // { type: 'login', success: true, ... } - пользователь существует
        // { type: 'register', success: true } - новый пользователь, письмо отправлено

        return res.json({
            success: true,
            type: data.type, // 'login' или 'register'
            data: data,
        });
    } catch (err) {
        console.error("OAuth callback error:", err);
        return res.status(500).json({ success: false, error: err.message || "Внутренняя ошибка сервера" });
    }
}
