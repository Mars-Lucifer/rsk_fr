import { PORTAL_API_BASE } from "@/lib/portalApiBase";

export default async function VKCallbackProxy(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        // Проксируем запрос на реальный бэкенд
        const response = await fetch(`${PORTAL_API_BASE}/auth/users_interaction/auth/vk/callback`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                accept: "application/json",
            },
            body: JSON.stringify(req.body),
            cache: "no-store",
            credentials: "include",
        });

        // Получаем cookies от бэкенда
        const setCookie = response.headers.get("set-cookie");

        // Пробрасываем их клиенту
        if (setCookie) {
            res.setHeader("Set-Cookie", setCookie);
        }

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);
    } catch (err) {
        console.error("VK Proxy Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
