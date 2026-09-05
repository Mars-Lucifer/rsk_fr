import { getSectionBundle, sanitizeSectionId } from "@/lib/mayakContentStorage";
import { renderDayTwoCardSvg } from "@/lib/mayakDayTwoCard";

// День 2: карта задания в SVG по данным раздела.
// GET /api/mayak/day2/card?sectionId=8101-8200&number=8106
// Только для карточек с полем day2 — у остальных колод карты нарисованы заранее.
export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }
    try {
        const sectionId = sanitizeSectionId(String(req.query.sectionId || ""));
        const number = String(req.query.number || "").trim();
        if (!sectionId || !number) {
            return res.status(400).json({ success: false, error: "Нужны sectionId и number" });
        }
        const bundle = await getSectionBundle(sectionId, { includeTexts: false });
        const card = (bundle?.tasks || []).find((t) => String(t?.number) === number);
        if (!card || !card.day2) {
            return res.status(404).json({ success: false, error: "Карточка дня 2 не найдена" });
        }
        res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        return res.status(200).send(renderDayTwoCardSvg(card));
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось нарисовать карту" });
    }
}
