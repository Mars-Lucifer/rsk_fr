import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import { computeStage, getDayTwoDay, updateDayTwoDay } from "@/lib/mayakDayTwoStore";

// День 2: один день. GET — день и рассчитанный этап; PATCH — бриф, карточки,
// треки, заметки, отметки «разослано» и «завершено».
export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    const id = String(req.query.id || "");

    if (req.method === "GET") {
        try {
            const day = await getDayTwoDay(id);
            if (!day) return res.status(404).json({ success: false, error: "День не найден" });
            return res.status(200).json({ success: true, data: { day, stage: computeStage(day) } });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message || "Не удалось загрузить день" });
        }
    }

    if (req.method === "PATCH") {
        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const day = await updateDayTwoDay(id, body);
            return res.status(200).json({ success: true, data: { day, stage: computeStage(day) } });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось сохранить день" });
        }
    }

    return res.status(405).json({ success: false, error: "Метод не поддерживается" });
}
