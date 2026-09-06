import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import { DAY_TWO_DEFAULT_PROMPTS, isDayTwoPromptName, readDayTwoPrompt, writeDayTwoPrompt } from "@/lib/mayakDayTwoAi";

// День 2: три промпта нейросети (H5–H7) — файлы data/mayak-day2/prompts/<name>.md.
// GET ?name=brief|cards|texts → {name, text, isDefault} (файла нет — создаётся из
// встроенного значения); PUT {text} — сохранить правку мастера.
function payload(name, text) {
    return { name, text, isDefault: text.trim() === DAY_TWO_DEFAULT_PROMPTS[name].trim() };
}

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    const name = String(req.query.name || "");
    if (!isDayTwoPromptName(name)) {
        return res.status(400).json({ success: false, error: "Укажите промпт: ?name=brief|cards|texts" });
    }

    try {
        if (req.method === "GET") {
            return res.status(200).json({ success: true, data: payload(name, await readDayTwoPrompt(name)) });
        }
        if (req.method === "PUT") {
            const text = await writeDayTwoPrompt(name, req.body?.text);
            return res.status(200).json({ success: true, data: payload(name, text) });
        }
        return res.status(405).json({ success: false, error: "Метод не поддерживается" });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось прочитать промпт" });
    }
}
