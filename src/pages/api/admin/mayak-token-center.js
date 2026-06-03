import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import { listMayakAdminRights } from "@/lib/mayakAdminRights";
import { listMayakSessions } from "@/lib/mayakSessions";
import { listMayakSessionTokens } from "@/lib/mayakSessionTokens";
import { getAllTokensWithStats } from "@/utils/mayakTokens";

const MAYAK_GUEST_SUFFIX = "aaaaa";

function toIsoSortValue(value) {
    return value ? String(value) : "";
}

function normalizeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function buildGuestToken(token) {
    if (!token) return "";
    const tokenValue = String(token).trim();
    return tokenValue.toLowerCase().endsWith(MAYAK_GUEST_SUFFIX) ? tokenValue : `${tokenValue}${MAYAK_GUEST_SUFFIX}`;
}

function buildTrainerLink(token) {
    const guestToken = buildGuestToken(token);
    return guestToken ? `/tools/mayak-oko?token=${encodeURIComponent(guestToken)}` : "";
}

function mapLegacyToken(token) {
    const usedCount = normalizeNumber(token.usedCount);
    const usageLimit = normalizeNumber(token.usageLimit);

    return {
        id: token.id,
        type: "legacy",
        title: token.name || "Обычный токен",
        token: buildGuestToken(token.token),
        link: buildTrainerLink(token.token),
        password: "",
        sectionId: token.sectionId || "",
        taskRange: token.taskRange || "",
        usageLimit,
        usedCount,
        remainingAttempts: Math.max(0, usageLimit - usedCount),
        status: token.isActive === false ? "inactive" : usedCount >= usageLimit ? "exhausted" : "active",
        createdAt: token.createdAt || null,
        updatedAt: token.updatedAt || null,
        sourceRef: {
            tokenId: token.id,
        },
    };
}

function mapSession(session, tokenMap) {
    const primaryTokenId = Array.isArray(session.tokenIds) ? session.tokenIds[0] : "";
    const primaryToken = primaryTokenId ? tokenMap.get(primaryTokenId) : null;
    const usedCount = normalizeNumber(primaryToken?.usedCount);
    const usageLimit = normalizeNumber(session.tokenUsageLimit || primaryToken?.usageLimit);

    return {
        id: session.id,
        type: "session",
        title: session.name || "Сессионный токен",
        token: buildGuestToken(primaryToken?.token),
        link: buildTrainerLink(primaryToken?.token),
        password: "",
        sectionId: session.sectionId || primaryToken?.sectionId || "",
        taskRange: session.taskRange || primaryToken?.taskRange || "",
        usageLimit,
        usedCount,
        remainingAttempts: Math.max(0, usageLimit - usedCount),
        status: session.status || "active",
        createdAt: session.createdAt || primaryToken?.createdAt || null,
        updatedAt: session.updatedAt || primaryToken?.updatedAt || null,
        sourceRef: {
            sessionId: session.id,
            tokenId: primaryToken?.id || "",
            tableCount: session.tableCount || 0,
            tokenUsageLimit: session.tokenUsageLimit || usageLimit,
            reviewTimeoutSeconds: session.reviewTimeoutSeconds || 130,
            reworkTimeoutSeconds: session.reworkTimeoutSeconds || 180,
        },
    };
}

function mapExternalLink(right) {
    const usedCount = normalizeNumber(right.usedParticipantLimit);
    const usageLimit = normalizeNumber(right.totalParticipantLimit);

    return {
        id: right.id,
        type: "external_link",
        title: right.title || right.fullName || "Внешняя ссылка",
        token: "",
        link: right.accessId ? `/mayak-access/${right.accessId}` : "",
        password: right.accessPassword || "",
        sectionId: right.sectionId || "",
        taskRange: right.taskRange || "",
        usageLimit,
        usedCount,
        remainingAttempts: Math.max(0, usageLimit - usedCount),
        status: right.status || "active",
        createdAt: right.grantedAt || null,
        updatedAt: right.updatedAt || right.grantedAt || null,
        sourceRef: {
            rightId: right.id,
            accessId: right.accessId || "",
            totalQuota: right.totalQuota || 0,
            usedQuota: right.usedQuota || 0,
            remainingQuota: right.remainingQuota || 0,
            totalParticipantLimit: right.totalParticipantLimit || usageLimit,
            rangeName: right.rangeName || "",
        },
    };
}

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const [legacyTokens, sessionTokens, sessions, rights] = await Promise.all([
            Promise.resolve(getAllTokensWithStats()),
            listMayakSessionTokens(),
            listMayakSessions(),
            listMayakAdminRights(),
        ]);

        const sessionTokenMap = new Map(sessionTokens.map((token) => [token.id, token]));
        const data = [
            ...legacyTokens.map(mapLegacyToken),
            ...sessions.map((session) => mapSession(session, sessionTokenMap)),
            ...rights.filter((right) => right.status !== "revoked").map(mapExternalLink),
        ].sort((left, right) => toIsoSortValue(right.updatedAt || right.createdAt).localeCompare(toIsoSortValue(left.updatedAt || left.createdAt)));

        return res.status(200).json({
            success: true,
            data,
            totals: {
                total: data.length,
                legacy: data.filter((item) => item.type === "legacy").length,
                session: data.filter((item) => item.type === "session").length,
                external_link: data.filter((item) => item.type === "external_link").length,
                active: data.filter((item) => item.status === "active").length,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message || "Не удалось загрузить центр токенов" });
    }
}
