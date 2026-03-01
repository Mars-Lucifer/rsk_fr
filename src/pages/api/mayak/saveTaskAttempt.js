import fs from "fs";
import path from "path";

let lockPromise = Promise.resolve();

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { user, taskName, taskIndex, timestamp, timeSpent, secondsSpent, completed, taskDetails, sectionId } = req.body;

    // Проверка обязательных полей
    if (!user || !taskName || timeSpent === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // Очередь для предотвращения race condition при записи в файл
    let release;
    const prev = lockPromise;
    lockPromise = new Promise(resolve => { release = resolve; });
    await prev;

    try {
        // Путь к файлу данных
        const filePath = path.join(process.cwd(), "data", "taskAttempts.json");

        // Создаем папку data, если её нет
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        // Читаем существующие данные или создаем новую структуру
        let allData = {};
        if (fs.existsSync(filePath)) {
            allData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        }

        // Инициализируем структуру для пользователя, если её нет
        if (!allData[user]) {
            allData[user] = {
                tasks: {},
                stats: {
                    totalTasksCompleted: 0,
                    totalTimeSpent: 0,
                    lastActivity: null,
                },
            };
        }

        // Добавляем/обновляем информацию о задании
        if (!allData[user].tasks[taskName]) {
            allData[user].tasks[taskName] = {
                attempts: [],
                bestTime: null,
                lastAttempt: null,
            };
        }

        const attemptData = {
            timestamp,
            timeSpent,
            secondsSpent,
            taskIndex,
            completed,
            taskDetails,
            sectionId,
        };

        allData[user].tasks[taskName].attempts.push(attemptData);
        allData[user].tasks[taskName].lastAttempt = timestamp;

        // Обновляем лучший результат, если текущий лучше или это первая попытка
        if (completed) {
            const currentBest = allData[user].tasks[taskName].bestTime;
            if (currentBest === null || timeSpent < currentBest) {
                allData[user].tasks[taskName].bestTime = timeSpent;
            }

            // Обновляем общую статистику пользователя
            allData[user].stats.totalTasksCompleted += 1;
            allData[user].stats.totalTimeSpent += timeSpent;
            allData[user].stats.lastActivity = timestamp;
        }

        // Сохраняем данные
        fs.writeFileSync(filePath, JSON.stringify(allData, null, 2));

        res.status(200).json({
            success: true,
            data: {
                userStats: allData[user].stats,
                taskStats: allData[user].tasks[taskName],
            },
        });
    } catch (error) {
        console.error("Error saving task attempt:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    } finally {
        release();
    }
}
