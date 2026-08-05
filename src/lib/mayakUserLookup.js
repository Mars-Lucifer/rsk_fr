import { readLocalProfileMockStore, shouldUseLocalProfileMock } from "@/lib/localProfileMock";
import { getPortalAuthHeadersFromRequest } from "@/lib/mayakRequestAuth";
import { PORTAL_API_BASE } from "@/lib/portalApiBase";

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function buildFullName(data = {}, fallbackId = "") {
    const fullName = [data.Surname, data.NameIRL, data.Patronymic]
        .map((value) => normalizeString(String(value || "")))
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || normalizeString(data.username) || normalizeString(data.email) || `Пользователь ${fallbackId}`;
}

function normalizeBatchUser(userId, data = {}) {
    return {
        id: normalizeString(String(data.id ?? userId ?? "")),
        username: normalizeString(data.username),
        email: normalizeString(data.email),
        name: normalizeString(data.NameIRL),
        surname: normalizeString(data.Surname),
        patronymic: normalizeString(data.Patronymic),
        fullName: buildFullName(data, userId),
        raw: data,
    };
}

export async function fetchMayakUsersBatchByIds(req, userIds = []) {
    const normalizedIds = Array.from(
        new Set(
            userIds
                .map((value) => normalizeString(String(value || "")))
                .filter(Boolean)
        )
    );

    if (normalizedIds.length === 0) {
        return {};
    }

    if (shouldUseLocalProfileMock(req, { fallbackWhenAuthMissing: true })) {
        const localStore = await readLocalProfileMockStore();
        const localUsers = Object.fromEntries(
            (Array.isArray(localStore?.profiles) ? localStore.profiles : []).map((profile) => {
                const localUserId = normalizeString(String(profile?.userId || profile?.data?.id || ""));
                return [localUserId, normalizeBatchUser(localUserId, profile?.data || {})];
            })
        );

        const matchedEntries = normalizedIds
            .map((id) => [id, localUsers[id]])
            .filter(([, user]) => Boolean(user));

        if (matchedEntries.length > 0) {
            return Object.fromEntries(matchedEntries);
        }
    }

    const { headers, hasAuth } = getPortalAuthHeadersFromRequest(req);
    if (!hasAuth) {
        throw new Error("Нужна авторизация портала для поиска пользователя по ID");
    }

    const response = await fetch(`${PORTAL_API_BASE}/users/profile_interaction/get_users_batch`, {
        method: "POST",
        headers: {
            ...headers,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            user_ids: normalizedIds
                .map((value) => Number.parseInt(value, 10))
                .filter((value) => Number.isFinite(value)),
        }),
        cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || payload?.message || "Не удалось получить данные пользователя");
    }

    return Object.fromEntries(
        Object.entries(payload || {}).map(([userId, userData]) => [normalizeString(userId), normalizeBatchUser(userId, userData)])
    );
}
