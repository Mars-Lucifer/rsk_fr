import { completeMayakSessionWithRuntimeCleanup } from "@/lib/mayakSessionRuntime";
import { getAuthenticatedMayakUserIdFromRequest } from "@/lib/mayakRequestAuth";
import { getMayakSessionById } from "@/lib/mayakSessions";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const userId = await getAuthenticatedMayakUserIdFromRequest(req);
    if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    try {
        const sessionId = String(req.query?.id || "");
        const session = await getMayakSessionById(sessionId);

        if (!session) {
            return res.status(404).json({ success: false, error: "Сессия не найдена" });
        }

        if (String(session.source || "") !== "delegated-admin" || String(session.ownerUserId || "") !== String(userId)) {
            return res.status(403).json({ success: false, error: "Недостаточно прав для завершения сессии" });
        }

        const completed = await completeMayakSessionWithRuntimeCleanup(sessionId);
        return res.status(200).json({ success: true, data: completed });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось завершить сессию" });
    }
}
