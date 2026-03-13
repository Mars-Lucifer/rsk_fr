import { readMayakActiveUser } from "./readMayakActiveUser";

export async function saveMayakRankingTest({ results, setRankingDelta5 }) {
    try {
        if (results?.level5?.delta !== undefined) {
            setRankingDelta5(results.level5.delta);
        }

        const activeUser = readMayakActiveUser();
        const payload = {
            date: new Date().toISOString(),
            user: activeUser.id,
            type: "ranking_test",
            results,
            totalDelta: Object.values(results).reduce((sum, r) => sum + r.delta, 0),
        };

        await fetch("/api/mayak/saveDeltaTest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    } catch (err) {
        console.error("Ошибка сохранения ranking test:", err);
    }
}
