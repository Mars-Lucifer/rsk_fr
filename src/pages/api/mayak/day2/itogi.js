import { getDayTwoDay } from "@/lib/mayakDayTwoStore";
import { renderItogiHtml, renderTableHtml } from "@/lib/mayakDayTwoTexts";

// День 2: публичная страница итогов (H4g) — без админского входа, доступ только по
// секрету снимка. GET /api/mayak/day2/itogi?day=<id>&k=<resultsSecret>[&table=N][&download=1]
// Без table — таблица столов и треков (как itogi.html из export_day2.py), с table=N —
// страница стола (stolN.html). Данные — только из снимка day.results.
// download=1 отдаёт файл для ctr5; ссылки между страницами в нём относительные
// (itogi.html ↔ stolN.html), чтобы секрет не уходил в выложенный файл.
function notFound(res, text = "Не найдено") {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(404).send(text);
}

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Метод не поддерживается" });
    }

    const dayId = String(req.query.day || "");
    const key = String(req.query.k || "");
    const download = String(req.query.download || "") === "1";
    const tableQuery = String(req.query.table || "").trim();

    try {
        const day = dayId ? await getDayTwoDay(dayId) : null;
        if (!day || !key || typeof day.resultsSecret !== "string" || key !== day.resultsSecret) return notFound(res);
        if (!day.results?.at) return notFound(res, "Снимок не сделан");

        const base = `/api/mayak/day2/itogi?day=${encodeURIComponent(day.id)}&k=${encodeURIComponent(day.resultsSecret)}`;
        let html;
        let filename;
        if (tableQuery) {
            const table = Number.parseInt(tableQuery, 10);
            html = Number.isFinite(table) ? renderTableHtml(day, table, { backHref: download ? "itogi.html" : base }) : null;
            if (!html) return notFound(res, "Стола нет в снимке");
            filename = `stol${table}.html`;
        } else {
            html = renderItogiHtml(day, { tableHref: (n) => (download ? `stol${n}.html` : `${base}&table=${n}`) });
            filename = `itogi-${day.date || "day2"}.html`;
        }

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        if (download) res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.status(200).send(html);
    } catch (error) {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.status(400).send(error.message || "Не удалось собрать страницу итогов");
    }
}
