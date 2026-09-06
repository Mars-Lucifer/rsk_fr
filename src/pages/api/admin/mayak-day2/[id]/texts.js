import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import { getDayTwoDay } from "@/lib/mayakDayTwoStore";
import { buildAssemblerPrompt } from "@/lib/mayakDayTwoTexts";

// День 2: промпт сборщику стола (H4f). GET /api/admin/mayak-day2/<id>/texts?table=N → {prompt}.
// Доступ к серверу (пользователь, папка, пароль) в текст не попадает — его говорит ведущий.
export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Метод не поддерживается" });
    }

    try {
        const day = await getDayTwoDay(String(req.query.id || ""));
        if (!day) return res.status(404).json({ success: false, error: "День не найден" });
        const table = Number.parseInt(String(req.query.table || ""), 10);
        if (!Number.isFinite(table) || !(day.tables || []).some((item) => Number(item.n) === table)) {
            return res.status(400).json({ success: false, error: "Укажите стол из брифа: ?table=N" });
        }
        return res.status(200).json({ success: true, data: { table, prompt: buildAssemblerPrompt(day, table) } });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось собрать промпт" });
    }
}
