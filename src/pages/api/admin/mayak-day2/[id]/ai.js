import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import { computeStage, getDayTwoDay, updateDayTwoDay } from "@/lib/mayakDayTwoStore";
import { aiBriefTables, aiRewriteCard, aiTableTexts } from "@/lib/mayakDayTwoAi";

// День 2: сборка нейросетью (H5–H7). POST /api/admin/mayak-day2/<id>/ai
//   {action:"brief", text}  — реплики заказчика → три стола (адреса столов сохраняются);
//   {action:"card", num}    — одна карточка под продукты столов;
//   {action:"cards"}        — все карточки по очереди; не прошедшие проверку остаются прежними;
//   {action:"texts", table} — семь шагов приёмки и заготовка карты → notes[table].
// Ответ {success, data:{day, stage, report:[{label, ok, problems}]}}. При сбое нейросети —
// {success:false, error:"Нейросеть не ответила: …"}: только путь, статус и причина, без ключей.
// Карточки пишутся тем же путём, что PATCH cards (updateDayTwoDay → cardsUpdatedAt).
function ok(res, day, report) {
    return res.status(200).json({ success: true, data: { day, stage: computeStage(day), report } });
}

function cardLabel(card) {
    return `${card.num} · ${card.title || "без заголовка"}`;
}

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Метод не поддерживается" });
    }

    const id = String(req.query.id || "");
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const action = String(body.action || "");

    try {
        const day = await getDayTwoDay(id);
        if (!day) return res.status(404).json({ success: false, error: "День не найден" });

        if (action === "brief") {
            const text = typeof body.text === "string" ? body.text : "";
            const tables = await aiBriefTables(day, text);
            const updated = await updateDayTwoDay(id, { briefText: text, tables });
            const report = tables.map((table) => ({ label: `Стол ${table.n} — ${table.product}`, ok: true, problems: [] }));
            return ok(res, updated, report);
        }

        if (action === "card" || action === "cards") {
            const cards = Array.isArray(day.cards) ? day.cards : [];
            const targets = action === "card" ? cards.filter((card) => String(card.num) === String(body.num)) : cards;
            if (!targets.length) return res.status(400).json({ success: false, error: action === "card" ? "Карточка не найдена" : "Колода пуста" });
            const next = cards.slice();
            const report = [];
            let changed = false;
            for (const card of targets) {
                try {
                    const { card: rewritten, problems } = await aiRewriteCard(day, card);
                    if (problems.length) {
                        report.push({ num: card.num, label: cardLabel(card), ok: false, problems });
                    } else {
                        next[cards.indexOf(card)] = rewritten;
                        changed = true;
                        report.push({ num: card.num, label: cardLabel(rewritten), ok: true, problems: [] });
                    }
                } catch (error) {
                    if (action === "card") throw error;
                    report.push({ num: card.num, label: cardLabel(card), ok: false, problems: [error.message || "сбой"] });
                }
            }
            const updated = changed ? await updateDayTwoDay(id, { cards: next }) : day;
            return ok(res, updated, report);
        }

        if (action === "texts") {
            const texts = await aiTableTexts(day, body.table);
            const key = String(Number.parseInt(String(body.table), 10));
            const updated = await updateDayTwoDay(id, { notes: { [key]: { ...(day.notes?.[key] || {}), ...texts } } });
            return ok(res, updated, [{ label: `Стол ${key}: семь шагов и шесть строк карты`, ok: true, problems: [] }]);
        }

        return res.status(400).json({ success: false, error: "Неизвестное действие: brief, card, cards или texts" });
    } catch (error) {
        const message = error?.message || "Не удалось выполнить действие";
        return res.status(message.startsWith("Нейросеть не ответила") ? 502 : 400).json({ success: false, error: message });
    }
}
