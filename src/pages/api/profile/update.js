export default async function ProfileUpdateHandler(req, res) {
    try {
        const token = req.cookies.users_access_token;
        if (!token) {
            return res.status(401).json({ success: false, error: "No token provided" });
        }

        // Проверка метода
        if (req.method !== "POST") {
            return res.status(405).json({ success: false, error: "Method not allowed" });
        }

        // Формируем тело запроса для API из тела запроса клиента
        const bodyData = req.body; // ожидаем объект с изменёнными полями
        delete bodyData.token;
        console.log(bodyData);

        const response = await fetch("https://api.rosdk.ru/users/profile_interaction/update_my_profile/", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: req.headers.cookie || "",
            },
            body: JSON.stringify(bodyData),
            cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
            switch (response.status) {
                case 422:
                    return res.status(422).json({ success: false, error: JSON.stringify(data) });
                case 400:
                    return res.status(400).json({ success: false, error: "Неверные данные" });
                case 401:
                    return res.status(401).json({ success: false, error: "Неавторизованный запрос" });
                case 403:
                    return res.status(403).json({ success: false, error: "Доступ запрещён" });
                case 404:
                    return res.status(404).json({ success: false, error: "Ресурс не найден" });
                default:
                    return res.status(response.status).json({ success: false, error: data });
            }
        }

        // Возвращаем клиенту
        return res.json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
