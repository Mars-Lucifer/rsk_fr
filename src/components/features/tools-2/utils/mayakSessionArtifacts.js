export function buildMayakRankingData(currentRanking, previousRanking) {
    return [1, 2, 3, 4, 5].map((level) => {
        const current = currentRanking[`level${level}`];
        const previous = previousRanking[`level${level}`];
        const currentDelta = current?.delta;
        const previousDelta = previous?.delta;
        const currentTime = current?.time || 0;
        const previousTime = previous?.time || 0;
        let progress = "?";
        let color = "#333";

        if (currentDelta !== undefined && previousDelta !== undefined) {
            const diff = previousDelta - currentDelta;
            progress = `${Math.abs(diff)}`;
            if (diff > 0) color = "#28a745";
            else if (diff < 0) color = "#dc3545";
            else {
                progress = "0";
                color = "#6c757d";
            }
        }

        return {
            in: previousDelta ?? null,
            out: currentDelta ?? null,
            inTime: previousTime,
            outTime: currentTime,
            progress,
            color,
        };
    });
}

// Защитный разбор JSON из localStorage: повреждённое значение не должно ронять
// сборку артефактов (а с ней и всё завершение сессии). Возвращаем fallback.
function safeParse(raw, fallback) {
    try {
        const parsed = JSON.parse(raw);
        return parsed == null ? fallback : parsed;
    } catch {
        return fallback;
    }
}

export async function buildMayakSessionArtifacts({ getStorageKey, tokenSectionId }) {
    const currentRanking = safeParse(localStorage.getItem("trainer_v2_rankingTestResults"), {});
    const previousRanking = safeParse(localStorage.getItem("trainer_v2_rankingTestResults_previous"), {});
    const rankingData = buildMayakRankingData(currentRanking, previousRanking);

    const parsedLog = safeParse(localStorage.getItem(getStorageKey("session_tasks_log")), []);
    const rawLog = Array.isArray(parsedLog) ? parsedLog : [];
    const completedTasksData = rawLog.filter((task) => task && task.finalPrompt && task.finalPrompt !== "");

    let avgTimes = {};
    if (tokenSectionId) {
        try {
            const avgResponse = await fetch(`/api/mayak/avg-times?sectionId=${tokenSectionId}`);
            if (avgResponse.ok) {
                avgTimes = await avgResponse.json();
            }
        } catch (error) {
            console.warn("Failed to fetch avg times:", error);
        }
    }

    const enrichedTasks = completedTasksData.map((task) => ({
        ...task,
        avgTime: avgTimes[String(task.number)] || null,
    }));

    const startTime = parseInt(localStorage.getItem(getStorageKey("sessionStartTime")) || Date.now().toString(), 10);
    const totalSessionSeconds = Math.floor((Date.now() - startTime) / 1000);

    return {
        rankingData,
        enrichedTasks,
        totalSessionSeconds,
    };
}

export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
