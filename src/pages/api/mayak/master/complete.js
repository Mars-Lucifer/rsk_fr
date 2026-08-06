import { completeMayakSessionWithRuntimeCleanup } from "@/lib/mayakSessionRuntime";
import { getMayakSessionById } from "@/lib/mayakSessions";
import { resolveMasterSecret, deleteSessionLinks } from "@/lib/mayakSessionLinks";

// Завершение сессии мастером по мастер-секрету. После завершения гасим доп.
// ссылки (обычный токен, мастер-токен, запись реестра).
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const secret = String(req.body?.secret || req.query?.secret || "");
    const record = await resolveMasterSecret(secret);
    if (!record) {
        return res.status(401).json({ success: false, error: "Ссылка недействительна" });
    }

    const session = await getMayakSessionById(record.sessionId);
    if (!session) {
        await deleteSessionLinks(record.sessionId).catch(() => {});
        return res.status(404).json({ success: false, error: "Сессия не найдена или уже завершена" });
    }

    try {
        await completeMayakSessionWithRuntimeCleanup(record.sessionId);
        await deleteSessionLinks(record.sessionId).catch(() => {});
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось завершить сессию" });
    }
}
