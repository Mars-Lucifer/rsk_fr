import { createDelegatedMayakSessionForUser, getMayakDelegatedAccessOverview } from "@/lib/mayakAdminRights";
import { getAuthenticatedMayakUserIdFromRequest } from "@/lib/mayakRequestAuth";

function serializeOverviewItem(item = {}) {
    const session = item.session || {};
    const token = item.token || null;
    const expiresAt = token?.expiresAt || session?.expiresAt || null;
    const expiresTs = expiresAt ? Date.parse(expiresAt) : NaN;
    const isExpired = Number.isFinite(expiresTs) ? expiresTs <= Date.now() : false;

    return {
        sessionId: session.id || "",
        sessionName: session.name || "",
        sectionId: session.sectionId || "",
        taskRange: session.taskRange || "",
        tableCount: session.tableCount || 0,
        participantLimit: session.participantLimit || token?.usageLimit || 0,
        createdAt: session.createdAt || token?.createdAt || null,
        expiresAt,
        isExpired,
        token: token
            ? {
                  id: token.id,
                  value: token.token,
                  usedCount: token.usedCount || 0,
                  usageLimit: token.usageLimit || 0,
                  remainingAttempts: token.remainingAttempts || 0,
                  isActive: token.isActive !== false,
                  isExhausted: Boolean(token.isExhausted),
              }
            : null,
    };
}

export default async function handler(req, res) {
    const userId = await getAuthenticatedMayakUserIdFromRequest(req);
    if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (req.method === "GET") {
        try {
            const overview = await getMayakDelegatedAccessOverview(userId);
            return res.status(200).json({
                success: true,
                data: {
                    right: overview.right,
                    sessions: Array.isArray(overview.sessions) ? overview.sessions.map(serializeOverviewItem) : [],
                },
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message || "Не удалось загрузить данные МАЯК" });
        }
    }

    if (req.method === "POST") {
        try {
            const created = await createDelegatedMayakSessionForUser({
                userId,
                sessionName: req.body?.sessionName,
                tableCount: req.body?.tableCount,
                participantLimit: req.body?.participantLimit || 30,
            });

            return res.status(200).json({
                success: true,
                data: {
                    right: created.right,
                    session: serializeOverviewItem({
                        session: created.session,
                        token: created.token,
                    }),
                },
            });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось создать session-токен" });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
