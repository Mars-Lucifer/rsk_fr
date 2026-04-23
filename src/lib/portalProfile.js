function getProfileData(payload) {
    if (!payload || typeof payload !== "object") {
        return {};
    }

    if (payload.data && typeof payload.data === "object") {
        if (payload.data.data && typeof payload.data.data === "object") {
            return payload.data.data;
        }
        return payload.data;
    }

    return payload;
}

function pickString(candidates = []) {
    for (const candidate of candidates) {
        const value = String(candidate ?? "").trim();
        if (value) {
            return value;
        }
    }
    return "";
}

function pickId(data) {
    return pickString([
        data?.id,
        data?.user_id,
        data?.userId,
        data?.ID,
        data?.pk,
        data?.profile_id,
        data?.profileId,
        data?.User?.id,
        data?.User?.user_id,
        data?.user?.id,
        data?.user?.user_id,
    ]);
}

function pickStablePortalUserId(payload, data) {
    return pickString([
        pickId(data),
        payload?.userId,
        payload?.user_id,
        data?.email,
        data?.mail,
        data?.username,
        data?.login,
        data?.nickname,
    ]);
}

function firstPositiveOrganizationId(data) {
    const candidates = [
        data?.Organization_id,
        data?.organization_id,
        data?.organizationId,
        data?.Organization?.id,
        data?.organization?.id,
    ];

    for (const raw of candidates) {
        if (raw === null || raw === undefined || raw === "") {
            continue;
        }
        const n = typeof raw === "number" ? raw : Number.parseInt(String(raw).trim(), 10);
        if (Number.isFinite(n) && n >= 1) {
            return String(n);
        }
    }

    return "";
}

export function getPortalOrganizationId(payload) {
    const data = getProfileData(payload);
    return firstPositiveOrganizationId(data);
}

export function getPortalOrganizationLabel(payload) {
    const data = getProfileData(payload);
    const nested = pickString([
        data?.Organization?.short_name,
        data?.Organization?.name,
        data?.organization?.short_name,
        data?.organization?.name,
        data?.organization_name,
        data?.Organization_name,
    ]);

    if (nested) {
        return nested;
    }

    const idStr = firstPositiveOrganizationId(data);
    if (idStr) {
        return `Организация №${idStr}`;
    }

    return "";
}

export function buildPortalFullName(payload) {
    const data = getProfileData(payload);
    return [
        data?.Surname,
        data?.surname,
        data?.last_name,
        data?.lastName,
        data?.NameIRL,
        data?.name,
        data?.first_name,
        data?.firstName,
        data?.Patronymic,
        data?.middle_name,
        data?.middleName,
    ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .reduce((acc, value) => {
            if (!acc.includes(value)) {
                acc.push(value);
            }
            return acc;
        }, [])
        .join(" ")
        .trim();
}

export function normalizePortalProfile(payload) {
    const data = getProfileData(payload);
    const fullName = buildPortalFullName(data);
    const organizationId = getPortalOrganizationId(data);
    const organizationLabel = getPortalOrganizationLabel(data);
    const stableUserId = pickStablePortalUserId(payload, data);
    const name = pickString([data?.NameIRL, data?.name, data?.first_name, data?.firstName]);
    const surname = pickString([data?.Surname, data?.surname, data?.last_name, data?.lastName]);
    const patronymic = pickString([data?.Patronymic, data?.middle_name, data?.middleName]);
    const username = pickString([data?.username, data?.login, data?.nickname]);
    const email = pickString([data?.email, data?.mail]);

    return {
        raw: data,
        id: stableUserId,
        email,
        username,
        name,
        surname,
        patronymic,
        fullName: fullName || name || username || email || "Участник",
        region: pickString([data?.Region, data?.region]),
        role: pickString([data?.role, data?.Type, "student"]),
        organizationId,
        organizationLabel,
    };
}

export function isPortalProfileComplete(payload) {
    const profile = normalizePortalProfile(payload);
    return Boolean(profile.name && profile.surname && profile.organizationId);
}

export function buildPortalUserCookiePayload(payload, extra = {}) {
    const profile = normalizePortalProfile(payload);
    return {
        id: profile.id,
        name: profile.fullName || "Участник",
        organization: profile.organizationLabel,
        organizationId: profile.organizationId,
        portalUserId: profile.id,
        ...extra,
    };
}

export function buildPortalAuthCookieSnapshot(payload) {
    const profile = normalizePortalProfile(payload);
    return {
        email: profile.email,
        username: profile.name || profile.username || profile.email,
    };
}
