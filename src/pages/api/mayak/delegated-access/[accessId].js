import { completeMayakSessionWithRuntimeCleanup } from "@/lib/mayakSessionRuntime";
import {
    createDelegatedMayakSessionForAccess,
    getMayakDelegatedAccessOverviewByAccess,
    getMayakAdminRightByAccessId,
    validateDelegatedAccessPassword,
} from "@/lib/mayakAdminRights";
import { getMayakSessionById } from "@/lib/mayakSessions";
import { listMayakTokenMaterials } from "@/lib/mayakTokenMaterials";

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

function serializeOverview(overview = {}) {
    return {
        right: overview.right,
        sessions: Array.isArray(overview.sessions) ? overview.sessions.map(serializeOverviewItem) : [],
        materials: Array.isArray(overview.materials) ? overview.materials : [],
    };
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const accessId = String(req.query?.accessId || "");
    const action = String(req.body?.action || "overview");
    const password = String(req.body?.password || "");

    try {
        if (action === "login" || action === "overview") {
            const overview = await getMayakDelegatedAccessOverviewByAccess({ accessId, password });
            const materials = await listMayakTokenMaterials();
            return res.status(200).json({ success: true, data: serializeOverview({ ...overview, materials }) });
        }

        if (action === "create_session") {
            const created = await createDelegatedMayakSessionForAccess({
                accessId,
                password,
                sessionName: req.body?.sessionName,
                tableCount: req.body?.tableCount,
                participantLimit: req.body?.participantLimit,
            });

            const [overview, materials] = await Promise.all([
                getMayakDelegatedAccessOverviewByAccess({ accessId, password }),
                listMayakTokenMaterials(),
            ]);
            return res.status(200).json({
                success: true,
                data: {
                    ...serializeOverview({ ...overview, materials }),
                    createdSession: serializeOverviewItem({ session: created.session, token: created.token }),
                },
            });
        }

        if (action === "complete_session") {
            const right = await getMayakAdminRightByAccessId(accessId);
            if (!right || !validateDelegatedAccessPassword(right, password)) {
                return res.status(403).json({ success: false, error: "Неверный пароль" });
            }

            const sessionId = String(req.body?.sessionId || "");
            const session = await getMayakSessionById(sessionId);
            if (!session) {
                return res.status(404).json({ success: false, error: "Сессия не найдена" });
            }

            if (String(session.source || "") !== "delegated-admin" || String(session.ownerUserId || "") !== String(right.userId || right.accessId)) {
                return res.status(403).json({ success: false, error: "Недостаточно прав для завершения сессии" });
            }

            await completeMayakSessionWithRuntimeCleanup(sessionId);
            const [overview, materials] = await Promise.all([
                getMayakDelegatedAccessOverviewByAccess({ accessId, password }),
                listMayakTokenMaterials(),
            ]);
            return res.status(200).json({ success: true, data: serializeOverview({ ...overview, materials }) });
        }

        return res.status(400).json({ success: false, error: "Неизвестное действие" });
    } catch (error) {
        const message = error.message || "Не удалось выполнить действие";
        const status = message === "Неверный пароль" ? 403 : 400;
        return res.status(status).json({ success: false, error: message });
    }
}
