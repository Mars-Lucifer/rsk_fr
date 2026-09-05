import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import { computeStage, createDayTwoDay, listDayTwoDays } from "@/lib/mayakDayTwoStore";

// День 2: список дней и создание дня из брифа (колода — из шаблона).
export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method === "GET") {
        try {
            const days = await listDayTwoDays();
            const data = days.map((day) => {
                const { stage } = computeStage(day);
                return { id: day.id, org: day.org, date: day.date, sectionId: day.sectionId || "", stage, updatedAt: day.updatedAt };
            });
            return res.status(200).json({ success: true, data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message || "Не удалось загрузить дни" });
        }
    }

    if (req.method === "POST") {
        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const day = await createDayTwoDay(body);
            return res.status(200).json({ success: true, data: day });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось создать день" });
        }
    }

    return res.status(405).json({ success: false, error: "Метод не поддерживается" });
}
