import { normalizePortalProfile } from "@/lib/portalProfile";
import { PORTAL_API_BASE } from "@/lib/portalApiBase";
import { readLocalProfileMock, shouldUseLocalProfileMock } from "@/lib/localProfileMock";

export class PortalProfileRequestError extends Error {
    constructor(message, status = 500) {
        super(message);
        this.name = "PortalProfileRequestError";
        this.status = status;
    }
}

function parsePortalResponsePayload(text) {
    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
}

function buildPortalHeaders(req) {
    const cookieToken = String(req.cookies?.users_access_token || "").trim();
    const authHeader = String(req.headers.authorization || "").trim();
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

export async function fetchPortalProfileFromRequest(req) {
    const { headers, hasAuth } = buildPortalHeaders(req);

    if (!hasAuth) {
        throw new PortalProfileRequestError("Portal session is required", 401);
    }

    const response = await fetch(`${PORTAL_API_BASE}/users/profile_interaction/get_my_profile/`, {
        method: "GET",
        headers,
        cache: "no-store",
    });

    const responseText = await response.text();
    const payload = parsePortalResponsePayload(responseText);

    if (!response.ok) {
        const error = new PortalProfileRequestError(
            payload?.detail || payload?.error || payload?.message || payload?.raw || "Failed to fetch portal profile",
            response.status || 500
        );
        error.payload = payload;
        throw error;
    }

    return {
        payload,
        profile: normalizePortalProfile(payload),
    };
}

// Тот же ответ, что отдаёт /api/profile/info, но без похода по HTTP: нужен
// getServerSideProps, чтобы страница приезжала с данными и не мигала
// «Загружаем профиль...». Возвращает null, если профиля нет или сессия чужая —
// решение, куда отправлять пользователя, принимает вызывающий.
export async function resolveProfilePayloadForRequest(req) {
    try {
        if (shouldUseLocalProfileMock(req, { fallbackWhenAuthMissing: true })) {
            const localProfile = await readLocalProfileMock();
            return { success: true, data: localProfile.data, userId: localProfile.userId, isMock: true };
        }

        const { payload } = await fetchPortalProfileFromRequest(req);
        return { success: true, data: payload };
    } catch (error) {
        if (error instanceof PortalProfileRequestError) {
            return null;
        }
        console.error("Profile SSR: failed to resolve profile:", error);
        return null;
    }
}
