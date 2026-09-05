import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import { getDayTwoDay } from "@/lib/mayakDayTwoStore";
import { buildIndexCard } from "@/lib/mayakDayTwoPublish";
import { renderDayTwoCardSvg } from "@/lib/mayakDayTwoCard";

// День 2: превью карты карточки дня в SVG до записи раздела.
// GET /api/admin/mayak-day2/<id>/card?number=8106
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
        const number = String(req.query.number || "").trim();
        const card = (day.cards || []).find((item) => String(item.num) === number);
        if (!card) return res.status(404).json({ success: false, error: "Карточка не найдена" });
        res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        return res.status(200).send(renderDayTwoCardSvg(buildIndexCard(card, card.num, day)));
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось нарисовать карту" });
    }
}
