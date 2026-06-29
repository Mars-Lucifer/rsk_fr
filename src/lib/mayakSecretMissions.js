import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// Хранилище пула «тайных миссий» МАЯК.
// Структура файла: { _meta: {...}, missions: { "<Роль>": [ { id, title, text } ] } }
// Ключи missions — это точные value ролей из ROLE_OPTIONS (dashboardConstants.js),
// чтобы выдача не требовала отдельного слоя маппинга.

const SECRET_MISSIONS_FILE = path.join(process.cwd(), "data", "mayak-secret-missions.json");

function createEmptyConfig() {
    return { _meta: { source: "", version: 1, roles: [] }, missions: {} };
}

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

// Приводит произвольный объект к безопасной форме пула миссий.
function normalizeConfig(raw) {
    const config = createEmptyConfig();
    if (!raw || typeof raw !== "object") {
        return config;
    }

    if (raw._meta && typeof raw._meta === "object") {
        config._meta = {
            source: normalizeString(raw._meta.source),
            version: Number(raw._meta.version) || 1,
            roles: Array.isArray(raw._meta.roles) ? raw._meta.roles.map(normalizeString).filter(Boolean) : [],
        };
    }

    const missions = raw.missions && typeof raw.missions === "object" ? raw.missions : {};
    for (const [role, list] of Object.entries(missions)) {
        const normalizedRole = normalizeString(role);
        if (!normalizedRole || !Array.isArray(list)) continue;
        const items = [];
        list.forEach((item, index) => {
            if (!item || typeof item !== "object") return;
            const text = normalizeString(item.text);
            if (!text) return;
            items.push({
                id: normalizeString(item.id) || `${normalizedRole}-${index + 1}`,
                title: normalizeString(item.title),
                text,
            });
        });
        config.missions[normalizedRole] = items;
    }

    return config;
}

async function writeJsonAtomic(filePath, value, indent = 2) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const tempPath = path.join(dir, `.${path.basename(filePath)}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
    await fs.writeFile(tempPath, JSON.stringify(value, null, indent), "utf-8");
    await fs.rename(tempPath, filePath);
}

// Возвращает нормализованную конфигурацию пула (пустую, если файла нет).
export async function getSecretMissionsConfig() {
    try {
        const raw = await fs.readFile(SECRET_MISSIONS_FILE, "utf-8");
        return normalizeConfig(JSON.parse(raw));
    } catch {
        return createEmptyConfig();
    }
}

// Ключ для регистронезависимого сравнения ролей. В коде роль приходит в разном
// регистре (например, «ИНЖЕНЕР» из попапа выбора роли против «Инженер» в пуле
// миссий), поэтому матчим по верхнему регистру с нормализацией Ё→Е.
function normalizeRoleKey(value) {
    return normalizeString(value).toUpperCase().replace(/Ё/g, "Е");
}

export async function getMissionsForRole(role) {
    const normalizedRole = normalizeString(role);
    if (!normalizedRole) return [];
    const config = await getSecretMissionsConfig();
    if (config.missions[normalizedRole]) return config.missions[normalizedRole];

    const target = normalizeRoleKey(normalizedRole);
    const matchKey = Object.keys(config.missions).find((key) => normalizeRoleKey(key) === target);
    return matchKey ? config.missions[matchKey] : [];
}

// Случайно выбирает миссию из пула роли. crypto — чтобы выбор не был предсказуемым.
export async function pickRandomMissionForRole(role) {
    const items = await getMissionsForRole(role);
    if (!items.length) return null;
    const index = crypto.randomInt(0, items.length);
    const picked = items[index];
    return { id: picked.id, title: picked.title, text: picked.text };
}

export async function getMissionById(role, missionId) {
    const id = normalizeString(missionId);
    if (!id) return null;
    const items = await getMissionsForRole(role);
    return items.find((item) => item.id === id) || null;
}

// Сохраняет конфигурацию пула (для админ-редактора). Возвращает нормализованную копию.
export async function saveSecretMissionsConfig(rawConfig) {
    const config = normalizeConfig(rawConfig);
    config._meta.roles = Object.keys(config.missions);
    await writeJsonAtomic(SECRET_MISSIONS_FILE, config);
    return config;
}
