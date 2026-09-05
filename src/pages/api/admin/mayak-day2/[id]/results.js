import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import { computeStage, getDayTwoDay, mutateDayTwoDay } from "@/lib/mayakDayTwoStore";
import { exportDayResults } from "@/lib/mayakDayTwoPublish";

// День 2: результаты сессии по столам. GET — живая выгрузка из платформы
// (попутно запоминает, сколько столов сдали дорожную карту); POST {snapshot:true}
// — сохранить копию результатов внутрь дня, чтобы пережить удаление сессии.
function summarize(results) {
    return { at: results.at, tablesTotal: results.tables.length, roadmapAccepted: results.roadmapAccepted, participants: results.participants };
}

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    const id = String(req.query.id || "");

    if (req.method === "GET") {
        try {
            const day = await getDayTwoDay(id);
            if (!day) return res.status(404).json({ success: false, error: "День не найден" });
            const results = await exportDayResults(day);
            const updated = await mutateDayTwoDay(id, (current) => {
                current.dayState = summarize(results);
                return current;
            });
            return res.status(200).json({ success: true, data: { results, stage: computeStage(updated) } });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось получить результаты" });
        }
    }

    if (req.method === "POST") {
        try {
            if (req.body?.snapshot !== true) {
                return res.status(400).json({ success: false, error: "Ожидается {snapshot: true}" });
            }
            const day = await getDayTwoDay(id);
            if (!day) return res.status(404).json({ success: false, error: "День не найден" });
            const results = await exportDayResults(day);
            const updated = await mutateDayTwoDay(id, (current) => {
                current.results = results;
                current.dayState = summarize(results);
                return current;
            });
            return res.status(200).json({ success: true, data: { day: updated, stage: computeStage(updated) } });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось сделать снимок результатов" });
        }
    }

    return res.status(405).json({ success: false, error: "Метод не поддерживается" });
}
