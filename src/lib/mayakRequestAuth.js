import { getLocalProfileMockUserId, shouldUseLocalProfileMock } from "@/lib/localProfileMock";

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function decodeJwtPayload(token) {
    try {
        const [, payload = ""] = String(token || "").split(".");
        if (!payload) return null;

        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
        return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    } catch {
        return null;
    }
}

export function getPortalAuthHeadersFromRequest(req) {
    const cookieToken = normalizeString(req?.cookies?.users_access_token);
    const authHeader = normalizeString(req?.headers?.authorization);
    const headers = {
        Accept: "application/json",
    };

    if (cookieToken) {
        headers.Cookie = `users_access_token=${cookieToken}`;
    } else if (authHeader) {
        headers.Authorization = authHeader;
    }

    return {
        headers,
        hasAuth: Boolean(cookieToken || authHeader),
    };
}

export async function getAuthenticatedMayakUserIdFromRequest(req) {
    if (shouldUseLocalProfileMock(req, { fallbackWhenAuthMissing: true })) {
        return getLocalProfileMockUserId();
    }

    const cookieToken =
        normalizeString(req?.cookies?.users_access_token) ||
        normalizeString(req?.cookies?.access_token) ||
        normalizeString(req?.cookies?.token);
    const authHeader = normalizeString(req?.headers?.authorization).replace(/^Bearer\s+/i, "");
    const tokenSource = cookieToken || authHeader;
    const payload = decodeJwtPayload(tokenSource);
    return normalizeString(payload?.sub ? String(payload.sub) : "");
}
