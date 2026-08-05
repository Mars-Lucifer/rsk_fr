import { PORTAL_API_BASE } from "@/lib/portalApiBase";

export default async function RegHandler(req, res) {
    try {
        const response = await fetch(`${PORTAL_API_BASE}/auth/users_interaction/login/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({
                password: req.body.password,
                login: req.body.login,
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
                    return res.status(422).json({ success: false, error: JSON.stringify(data) });
                case 400:
                    return res.status(400).json({ success: false, error: "Неверный запрос" });
                case 401:
                    return res.status(401).json({ success: false, error: "Неверный логин или пароль" });
                case 403:
                    return res.status(403).json({ success: false, error: "Доступ запрещён.Проверьте почту и перейдите по ссылке подтверждения" });
                case 404:
                    return res.status(404).json({ success: false, error: "Пользователь не найден" });
                default:
                    return res.status(response.status).json({ success: false, error: data });
            }
        }

        return res.json({ success: true, data });
    } catch (err) {
        return res.json({ success: false, error: err.message }, { status: 500 });
    }
}
