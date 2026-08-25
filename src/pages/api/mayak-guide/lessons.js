import { LESSONS } from "@/components/features/mayak-guide/lessons.mjs";

// Список уроков мастера для консоли доступа. Тела блоков наружу не отдаём: консоли нужны
// только карточка и адрес, а содержание урока рисует сама страница урока.
export default function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ success: false, error: "Method Not Allowed" });
    }

    const list = LESSONS.map(({ id, title, duration, summary, url }) => ({ id, title, duration, summary, url }));
    return res.status(200).json({ success: true, data: list });
}
