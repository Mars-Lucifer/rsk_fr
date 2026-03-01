import fs from "fs";
import path from "path";

export default async function handler(req, res) {
    // В этом проекте используется простая проверка пароля через заголовки или параметры для админки
    // Но для начала просто реализуем чтение данных
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const filePath = path.join(process.cwd(), "data", "results.json");

    try {
        if (!fs.existsSync(filePath)) {
            return res.status(200).json([]);
        }

        const allData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const flatResults = [];

        // allData имеет структуру { [tokenKey]: { [userId]: { ...data } } }
        Object.keys(allData).forEach(tokenKey => {
            const users = allData[tokenKey];
            Object.keys(users).forEach(userId => {
                const result = users[userId];

                // ВАЖНО: Выводим только тех, кто завершил тренажёр
                // (Для обратной совместимости, если флаг еще не внедрен, временно пропускаем всех,
                // но в будущем будем проверять result.isFinished)
                if (result.userData) {
                    flatResults.push({
                        id: userId,
                        tokenKey: tokenKey,
                        firstName: result.userData.firstName || "",
                        lastName: result.userData.lastName || "",
                        college: result.userData.college || "",
                        // Используем дату завершения или дату создания
                        timestamp: result.finishedAt || result.timestamp || result.createdAt || null,
                        isFinished: result.isFinished || false
                    });
                }
            });
        });

        // Если данных много, можно добавить фильтрацию по isFinished на уровне API
        // const finishedOnly = flatResults.filter(r => r.isFinished);

        // Сортировка по времени: старые сверху, новые внизу (хронологический порядок)
        // Записи без даты — в начало списка
        flatResults.sort((a, b) => {
            if (!a.timestamp && !b.timestamp) return 0;
            if (!a.timestamp) return -1;
            if (!b.timestamp) return -1;
            return new Date(a.timestamp) - new Date(b.timestamp);
        });

        res.status(200).json(flatResults);
    } catch (error) {
        console.error("Ошибка API результатов:", error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
}
