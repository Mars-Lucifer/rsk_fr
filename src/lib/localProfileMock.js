import path from "path";
import { promises as fs } from "fs";

const LOCAL_PROFILE_FILE = path.join(process.cwd(), "data", "local-profile-mock.json");
export const LOCAL_PROFILE_MOCK_COOKIE = "mayak_local_profile_mock";

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function isTruthyEnv(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function buildProfileEntry({
    userId,
    email,
    username,
    firstName,
    lastName,
    patronymic = "",
    role = "student",
    region = "Локальная среда",
    description = "Локальный тестовый профиль для проверки МАЯК.",
    organizationId = "local-org",
    organizationName = "Локальная организация",
    teamId = "local-team",
    teamName = "Локальная команда",
}) {
    const normalizedUserId = normalizeString(userId);

    return {
        userId: normalizedUserId,
        data: {
            id: normalizedUserId,
            email: normalizeString(email),
            username: normalizeString(username),
            NameIRL: firstName,
            Surname: lastName,
            Patronymic: patronymic,
            Type: role,
            Region: region,
            Description: description,
            Organization_id: organizationId,
            Organization: {
                id: organizationId,
                short_name: organizationName,
                name: organizationName,
                full_name: organizationName,
            },
            team: teamName,
            team_id: teamId,
        },
    };
}

function buildDefaultProfiles() {
    return [
        buildProfileEntry({
            userId: "900001",
            email: "mayak.local.student@example.test",
            username: "mayak.local.student",
            firstName: "Мария",
            lastName: "Тестова",
            patronymic: "Игоревна",
            region: "Москва",
            description: "Тестовый локальный профиль для проверки МАЯК admin-rights и пользовательских токенов.",
            organizationName: "Локальный МАЯК",
            teamName: "Тестовая команда МАЯК",
        }),
        buildProfileEntry({
            userId: "900002",
            email: "mayak.local.expert@example.test",
            username: "mayak.local.expert",
            firstName: "Алексей",
            lastName: "Проверкин",
            patronymic: "Сергеевич",
            region: "Казань",
            description: "Второй локальный профиль для проверки выдачи прав нескольким пользователям.",
            organizationName: "Тестовый контур МАЯК",
            teamName: "Команда проверок",
        }),
        buildProfileEntry({
            userId: "900003",
            email: "mayak.local.member@example.test",
            username: "mayak.local.member",
            firstName: "Елена",
            lastName: "Маршрутова",
            patronymic: "Павловна",
            region: "Санкт-Петербург",
            description: "Третий локальный профиль для полного прогона сценариев МАЯК.",
            organizationName: "Лаборатория МАЯК",
            teamName: "Поток 3",
        }),
    ];
}

function buildDefaultLocalProfileMockStore() {
    const profiles = buildDefaultProfiles();
    return {
        activeUserId: profiles[0].userId,
        profiles,
    };
}

function normalizeProfileEntry(entry = {}, fallbackEntry = null) {
    const fallback = fallbackEntry || buildProfileEntry({
        userId: normalizeString(entry?.userId || entry?.data?.id || "local-mayak-user"),
        email: "local-mayak@example.test",
        username: "local-mayak",
        firstName: "Тест",
        lastName: "Пользователь",
    });

    const userId = normalizeString(entry?.userId || entry?.data?.id || fallback.userId) || fallback.userId;
    const rawData = entry?.data && typeof entry.data === "object" && !Array.isArray(entry.data) ? entry.data : {};

    return {
        userId,
        data: {
            ...fallback.data,
            ...rawData,
            id: userId,
        },
    };
}

async function ensureLocalProfileMockFile() {
    try {
        await fs.access(LOCAL_PROFILE_FILE);
    } catch {
        await fs.mkdir(path.dirname(LOCAL_PROFILE_FILE), { recursive: true });
        await fs.writeFile(LOCAL_PROFILE_FILE, JSON.stringify(buildDefaultLocalProfileMockStore(), null, 2), "utf-8");
    }
}

function normalizeStoreShape(parsed) {
    const defaultStore = buildDefaultLocalProfileMockStore();

    if (parsed && Array.isArray(parsed.profiles)) {
        const profiles = parsed.profiles
            .map((entry, index) => normalizeProfileEntry(entry, defaultStore.profiles[index] || null))
            .filter((entry) => normalizeString(entry.userId));

        const safeProfiles = profiles.length > 0 ? profiles : defaultStore.profiles;
        const activeUserId = normalizeString(parsed.activeUserId);
        const resolvedActiveUserId =
            safeProfiles.find((entry) => entry.userId === activeUserId)?.userId || safeProfiles[0].userId;

        return {
            activeUserId: resolvedActiveUserId,
            profiles: safeProfiles,
        };
    }

    if (parsed && typeof parsed === "object" && parsed.userId) {
        const fallbackEntry = normalizeProfileEntry(parsed, defaultStore.profiles[0]);
        return {
            activeUserId: fallbackEntry.userId,
            profiles: [fallbackEntry, ...defaultStore.profiles.slice(1)],
        };
    }

    return defaultStore;
}

export function isLocalProfileMockEnabled() {
    return process.env.NODE_ENV !== "production" && isTruthyEnv(process.env.MAYAK_LOCAL_PROFILE_MOCK);
}

function isLocalDevHost(req) {
    const host = normalizeString(req?.headers?.host).toLowerCase();
    return host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0") || host.includes("[::1]");
}

function hasPlatformAuthToken(req) {
    return Boolean(req?.cookies?.users_access_token || req?.cookies?.access_token || req?.cookies?.token || req?.headers?.authorization);
}

function isLocalProfileMockDisabled(req) {
    const cookieValue = normalizeString(req?.cookies?.[LOCAL_PROFILE_MOCK_COOKIE]).toLowerCase();
    return cookieValue === "off" || cookieValue === "0" || cookieValue === "false";
}

export function shouldUseLocalProfileMock(req, { fallbackWhenAuthMissing = false } = {}) {
    if (isLocalProfileMockDisabled(req)) {
        return false;
    }

    if (isLocalProfileMockEnabled()) {
        return true;
    }

    if (!fallbackWhenAuthMissing || process.env.NODE_ENV === "production") {
        return false;
    }

    return isLocalDevHost(req) && !hasPlatformAuthToken(req);
}

export async function readLocalProfileMockStore() {
    await ensureLocalProfileMockFile();

    try {
        const raw = await fs.readFile(LOCAL_PROFILE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        const normalized = normalizeStoreShape(parsed);
        await fs.writeFile(LOCAL_PROFILE_FILE, JSON.stringify(normalized, null, 2), "utf-8");
        return normalized;
    } catch {
        const fallback = buildDefaultLocalProfileMockStore();
        await fs.writeFile(LOCAL_PROFILE_FILE, JSON.stringify(fallback, null, 2), "utf-8");
        return fallback;
    }
}

export async function writeLocalProfileMockStore(store) {
    const normalized = normalizeStoreShape(store);
    await fs.mkdir(path.dirname(LOCAL_PROFILE_FILE), { recursive: true });
    await fs.writeFile(LOCAL_PROFILE_FILE, JSON.stringify(normalized, null, 2), "utf-8");
    return normalized;
}

export async function listLocalProfileMocks() {
    const store = await readLocalProfileMockStore();
    return store.profiles.map((entry) => ({
        userId: entry.userId,
        fullName: [entry.data?.Surname, entry.data?.NameIRL, entry.data?.Patronymic].filter(Boolean).join(" ").trim(),
        username: entry.data?.username || "",
        email: entry.data?.email || "",
        active: entry.userId === store.activeUserId,
    }));
}

export async function setActiveLocalProfileMock(userId) {
    const store = await readLocalProfileMockStore();
    const normalizedUserId = normalizeString(String(userId || ""));
    const exists = store.profiles.find((entry) => entry.userId === normalizedUserId);
    if (!exists) {
        throw new Error("Локальный тестовый профиль не найден");
    }

    const nextStore = {
        ...store,
        activeUserId: normalizedUserId,
    };

    await writeLocalProfileMockStore(nextStore);
    return readLocalProfileMock();
}

export async function readLocalProfileMock() {
    const store = await readLocalProfileMockStore();
    return store.profiles.find((entry) => entry.userId === store.activeUserId) || store.profiles[0];
}

export async function updateLocalProfileMock(profileFields = {}) {
    const store = await readLocalProfileMockStore();
    const activeIndex = store.profiles.findIndex((entry) => entry.userId === store.activeUserId);
    const safeIndex = activeIndex >= 0 ? activeIndex : 0;
    const current = store.profiles[safeIndex];
    const nextProfile = {
        userId: current.userId,
        data: {
            ...current.data,
            ...profileFields,
            id: current.userId,
        },
    };

    const nextProfiles = [...store.profiles];
    nextProfiles[safeIndex] = nextProfile;
    await writeLocalProfileMockStore({
        ...store,
        profiles: nextProfiles,
    });
    return nextProfile;
}

export async function getLocalProfileMockUserId() {
    const profile = await readLocalProfileMock();
    return normalizeString(profile.userId);
}
