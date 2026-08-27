import { getDay2TeamBoard } from "@/lib/mayakSessionRuntime";

// Командный экран стола. Без входа: наружу уходят номера тайлов и их статусы,
// без имён, без содержания заданий и без соседних столов. Ноутбук команды стоит
// открытым весь день, и заставлять кого-то на нём авторизоваться — значит, что
// к обеду экран будет закрыт.
export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const board = await getDay2TeamBoard({
            sessionId: String(req.query?.sessionId || ""),
            tableNumber: req.query?.table,
        });
        return res.status(200).json({ success: true, data: board });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось собрать командный экран" });
    }
}
