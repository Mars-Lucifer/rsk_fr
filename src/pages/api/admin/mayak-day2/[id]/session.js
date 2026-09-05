import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import { computeStage, formatMsk, getDayTwoDay, mutateDayTwoDay, sessionEarliestAt, DEFAULT_PARTICIPANT_LIMIT, DEFAULT_TABLE_COUNT } from "@/lib/mayakDayTwoStore";
import { createDayTwoSession } from "@/lib/mayakDayTwoPublish";

// День 2: создание сессии {tableCount, participantLimit}. Только после записи
// раздела и не раньше чем за 47 часов до 20:00 дня — сессия живёт 48 часов.
export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Метод не поддерживается" });
    }

    try {
        const id = String(req.query.id || "");
        const day = await getDayTwoDay(id);
        if (!day) return res.status(404).json({ success: false, error: "День не найден" });
        if (!day.published?.sectionId || day.published.sectionId !== day.sectionId) {
            return res.status(400).json({ success: false, error: "Сначала запишите раздел" });
        }
        if (day.session?.id) {
            return res.status(400).json({ success: false, error: "Сессия уже создана" });
        }
        const earliest = sessionEarliestAt(day.date);
        if (!Number.isFinite(earliest)) {
            return res.status(400).json({ success: false, error: "В брифе нет даты дня" });
        }
        if (Date.now() < earliest) {
            return res.status(400).json({ success: false, error: `Сессию можно создать с ${formatMsk(earliest)} (МСК): она живёт 48 часов` });
        }
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const session = await createDayTwoSession(day, {
            tableCount: body.tableCount ?? DEFAULT_TABLE_COUNT,
            participantLimit: body.participantLimit ?? DEFAULT_PARTICIPANT_LIMIT,
        });
        const updated = await mutateDayTwoDay(id, (current) => {
            current.session = session;
            return current;
        });
        return res.status(200).json({ success: true, data: { day: updated, stage: computeStage(updated) } });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось создать сессию" });
    }
}
