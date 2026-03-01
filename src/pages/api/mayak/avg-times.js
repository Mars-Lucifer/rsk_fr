import fs from "fs";
import path from "path";

export default function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { sectionId } = req.query;

    if (!sectionId) {
        return res.status(400).json({ error: "sectionId is required" });
    }

    try {
        const filePath = path.join(process.cwd(), "data", "taskAttempts.json");

        if (!fs.existsSync(filePath)) {
            return res.status(200).json({});
        }

        const allData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

        // Группируем время по номеру задания
        // Ключ — номер задания (из taskName или taskIndex), значение — массив secondsSpent
        const timesPerTask = {};

        for (const userId of Object.keys(allData)) {
            const userTasks = allData[userId]?.tasks;
            if (!userTasks) continue;

            for (const taskName of Object.keys(userTasks)) {
                const taskData = userTasks[taskName];
                if (!taskData?.attempts) continue;

                for (const attempt of taskData.attempts) {
                    if (
                        attempt.sectionId === sectionId &&
                        attempt.completed === true &&
                        typeof attempt.secondsSpent === "number" &&
                        attempt.secondsSpent > 0
                    ) {
                        // Извлекаем номер задания из taskName (например "Задание 101" -> "101")
                        const taskNumber = taskName.replace(/\D/g, "") || String(attempt.taskIndex);
                        if (!taskNumber) continue;

                        if (!timesPerTask[taskNumber]) {
                            timesPerTask[taskNumber] = [];
                        }
                        timesPerTask[taskNumber].push(attempt.secondsSpent);
                    }
                }
            }
        }

        // Считаем среднее
        const avgTimes = {};
        for (const [taskNumber, times] of Object.entries(timesPerTask)) {
            const sum = times.reduce((a, b) => a + b, 0);
            avgTimes[taskNumber] = Math.round(sum / times.length);
        }

        return res.status(200).json(avgTimes);
    } catch (error) {
        console.error("Error calculating avg times:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
