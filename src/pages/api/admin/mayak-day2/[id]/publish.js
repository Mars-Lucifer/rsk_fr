import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import { sanitizeSectionId } from "@/lib/mayakContentStorage";
import { computeStage, getDayTwoDay, mutateDayTwoDay, validateDay } from "@/lib/mayakDayTwoStore";
import { nextFreeSectionId, sectionNumbers, writeDayToSection } from "@/lib/mayakDayTwoPublish";

// День 2: запись раздела. GET — предлагаемый sectionId (первый свободный в
// категории); POST {sectionId?} — записать карточки, тексты, карты, манифест.
// После записи номера карточек дня становятся номерами раздела.
export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    const id = String(req.query.id || "");

    if (req.method === "GET") {
        try {
            const day = await getDayTwoDay(id);
            if (!day) return res.status(404).json({ success: false, error: "День не найден" });
            const suggested = day.sectionId || (await nextFreeSectionId(day.cards?.[0]?.num || 8101));
            return res.status(200).json({ success: true, data: { sectionId: suggested } });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось подобрать раздел" });
        }
    }

    if (req.method === "POST") {
        try {
            const day = await getDayTwoDay(id);
            if (!day) return res.status(404).json({ success: false, error: "День не найден" });
            const checks = validateDay(day);
            if (!checks.ok) {
                return res.status(400).json({ success: false, error: `Колода не прошла проверки: ${checks.problems.join("; ")}` });
            }
            const requested = sanitizeSectionId(String(req.body?.sectionId || ""));
            const sectionId = requested || day.sectionId || (await nextFreeSectionId(day.cards[0].num));
            if (day.session?.id && day.sectionId && sectionId !== day.sectionId) {
                return res.status(400).json({ success: false, error: `Сессия уже создана на раздел ${day.sectionId} — записывать можно только в него` });
            }
            const numbers = sectionNumbers(day, sectionId);
            const written = await writeDayToSection(day, sectionId);
            const updated = await mutateDayTwoDay(id, (current) => {
                current.cards = (current.cards || []).map((card, i) => ({ ...card, num: numbers[i] ?? card.num }));
                current.sectionId = sectionId;
                current.published = { sectionId, at: new Date().toISOString(), cardCount: written.cardCount };
                return current;
            });
            return res.status(200).json({ success: true, data: { day: updated, stage: computeStage(updated), written } });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось записать раздел" });
        }
    }

    return res.status(405).json({ success: false, error: "Метод не поддерживается" });
}
