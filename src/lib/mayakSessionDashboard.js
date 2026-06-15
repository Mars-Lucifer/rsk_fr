import { promises as fs } from "fs";
import path from "path";

import { getMayakSessionById } from "@/lib/mayakSessions";
import { getSectionBundle } from "@/lib/mayakContentStorage";
import { readSessionRuntimeParticipants, readSessionReviews } from "@/lib/mayakSessionRuntime";

const DELTA_TEST_FILE = path.join(process.cwd(), "data", "DeltaTest.json");

// Граница частей внутри стола (по базовому номеру задания = taskIndex + 1).
// Часть «Я» — задания с базой 10..50, часть «Мы» — с базой 51..99.
const YA_RANGE = { from: 10, to: 50 };
const WE_RANGE = { from: 51, to: 99 };
// Сколько одобренных заданий части «Я» нужно для зажжённой звезды.
export const YA_STAR_TARGET = 4;

const YA_VALID_CONTENT_TYPES = new Set([
    "текст",
    "аудио",
    "изображение",
    "интерактив",
    "видео",
    "данные",
    "карта настроения"
]);

// Шесть направлений части «Мы» (снизу вверх — в порядке отображения звёзд).
// key — стабильный идентификатор, label — подпись, match — нормализованные значения contentType.
export const WE_DIRECTIONS = [
    { key: "KNOWLEDGE", label: "Знания и навыки", match: ["знания и навыки", "знания", "навыки"] },
    { key: "INTERACTION", label: "Внешние взаимодействия", match: ["внешние взаимодействия", "внешнее взаимодействие"] },
    { key: "ENVIRONMENT", label: "Единое цифровое пространство", match: ["единое цифровое пространство"] },
    { key: "PROTECTION", label: "Защита данных", match: ["защита данных"] },
    { key: "DATA", label: "Данные и аналитика", match: ["данные и аналитика"] },
    { key: "AUTOMATION", label: "Автоматизация", match: ["автоматизация"] },
];

function normalizeContentType(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/ /g, " ")
        .replace(/\s+/g, " ");
}

const DIRECTION_LOOKUP = (() => {
    const map = new Map();
    WE_DIRECTIONS.forEach((direction) => {
        direction.match.forEach((variant) => {
            map.set(normalizeContentType(variant), direction.key);
        });
    });
    return map;
})();

function resolveDirectionKey(contentType) {
    return DIRECTION_LOOKUP.get(normalizeContentType(contentType)) || null;
}

function normalizeTableNumber(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeName(name) {
    return String(name || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[^а-яa-z0-9]/g, "")
        .trim();
}

function normalizeAndMapRole(roleStr) {
    if (!roleStr) return "";
    const norm = String(roleStr).trim().toUpperCase().replace(/Ё/g, "Е");
    if (norm === "ИНСПЕКТОР" || norm === "INSPECTOR" || norm === "КОНТРОЛЕР") return "ИНСПЕКТОР";
    if (norm === "АДМИНИСТРАТОР" || norm === "ADMINISTRATOR") return "АДМИНИСТРАТОР";
    if (norm === "КАПИТАН" || norm === "CAPTAIN") return "Капитан";
    if (norm === "ИНЖЕНЕР" || norm === "ENGINEER") return "Инженер";
    if (norm === "МЕДИАТОР" || norm === "MEDIATOR" || norm === "КОММУНИКАТОР") return "Медиатор";
    if (norm === "ХРАНИТЕЛЬ МАЯКА" || norm === "ХРАНИТЕЛЬ" || norm === "ЭКСПЕРТ") return "Хранитель Маяка";
    if (norm === "ЛЕТОПИСЕЦ" || norm === "CHRONICLER" || norm === "АНАЛИТИК") return "Летописец";
    // Capitalize first letter as fallback
    return roleStr.charAt(0).toUpperCase() + roleStr.slice(1);
}

function mapTypeToRole(type) {
    switch (String(type).toLowerCase().trim()) {
        case "data":
        case "данные":
            return "Летописец";
        case "interactive":
        case "интерактив":
            return "Инженер";
        case "audio":
        case "аудио":
            return "Медиатор";
        case "visual-dynamic":
        case "видео":
            return "Капитан";
        case "visual-static":
        case "изображение":
            return "Хранитель Маяка";
        case "text":
        case "текст":
            return "ИНСПЕКТОР";
        default:
            return "Участник";
    }
}

// Карта userId/name -> дельта 5-го уровня ранжирования (последняя по времени запись).
async function readDeltaByUser() {
    let raw;
    try {
        raw = await fs.readFile(DELTA_TEST_FILE, "utf8");
    } catch {
        return { byUser: {}, byName: {} };
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { byUser: {}, byName: {} };
    }
    if (!parsed || typeof parsed !== "object") return { byUser: {}, byName: {} };

    const result = {
        byUser: {},
        byName: {}
    };

    for (const userKey of Object.keys(parsed)) {
        const timestamps = parsed[userKey];
        if (!timestamps || typeof timestamps !== "object") continue;

        let latestTs = "";
        let latestEntry = null;
        for (const ts of Object.keys(timestamps)) {
            if (!latestTs || String(ts) > latestTs) {
                latestTs = String(ts);
                latestEntry = timestamps[ts];
            }
        }
        if (!latestEntry) continue;

        const delta =
            latestEntry?.results?.level5?.delta ??
            latestEntry?.levels?.level5 ??
            null;
        if (delta === null || delta === undefined || delta === "") continue;

        const numericDelta = Number(delta);
        if (Number.isFinite(numericDelta)) {
            result.byUser[userKey] = numericDelta;
            if (latestEntry.userName) {
                const normName = normalizeName(latestEntry.userName);
                if (normName) {
                    result.byName[normName] = numericDelta;
                }
            }
        }
    }
    return result;
}

function findDeltaForUser(deltaData, userId, name) {
    if (userId && deltaData.byUser?.[userId] !== undefined) {
        return deltaData.byUser[userId];
    }
    const normName = normalizeName(name);
    if (normName && deltaData.byName?.[normName] !== undefined) {
        return deltaData.byName[normName];
    }
    if (userId) {
        for (const key of Object.keys(deltaData.byUser || {})) {
            if (key.includes(userId) || userId.includes(key)) {
                return deltaData.byUser[key];
            }
        }
    }
    return null;
}

const ATTEMPTS_FILE = path.join(process.cwd(), "data", "taskAttempts.json");

async function readAttempts() {
    try {
        const raw = await fs.readFile(ATTEMPTS_FILE, "utf8");
        return JSON.parse(raw) || {};
    } catch {
        return {};
    }
}

// Карта taskIndex -> { contentType, base } из контента секции.
async function readTaskTypeMap(sectionId) {
    if (!sectionId) return new Map();
    let bundle;
    try {
        bundle = await getSectionBundle(sectionId, { includeTexts: false });
    } catch {
        return new Map();
    }
    const map = new Map();
    
    let rangeStart = 1;
    if (Number.isFinite(bundle.meta?.rangeStart)) {
        rangeStart = bundle.meta.rangeStart;
    } else {
        const match = String(sectionId || "").match(/^(\d+)-/);
        if (match) {
            rangeStart = parseInt(match[1], 10);
        }
    }
    const startPos = rangeStart - 1;

    (bundle.tasks || []).forEach((task, index) => {
        const globalIndex = startPos + index;
        map.set(globalIndex, { contentType: task?.contentType || "", base: index + 1 });
    });
    return map;
}

function emptyDirectionCounts() {
    const counts = {};
    WE_DIRECTIONS.forEach((direction) => {
        counts[direction.key] = 0;
    });
    return counts;
}

function isApprovedTask(task) {
    return task && (task.status === "approved" || task.status === "expired");
}

function computeYaProgress(approvedTasks, taskTypeMap, yaDirection) {
    // 1. Считаем выполненные задачи в диапазоне Старт (base 1..10)
    let startApprovedCount = 0;
    approvedTasks.forEach((task) => {
        const taskIndex = Number(task.taskIndex);
        const typeInfo = Number.isFinite(taskIndex) ? taskTypeMap.get(taskIndex) : null;
        const base = typeInfo ? typeInfo.base : Number(task.taskNumber) || null;
        if (base && base >= 1 && base <= 10) {
            startApprovedCount += 1;
        }
    });

    const isStartPhaseDone = startApprovedCount >= 4;

    if (!isStartPhaseDone) {
        return {
            phase: "START",
            count: startApprovedCount,
            target: 4,
            percentage: Math.min(100, Math.round((startApprovedCount / 4) * 100)),
            hasStar: false,
        };
    }

    // 2. Считаем выполненные типы контента в диапазоне Я (base 10..50)
    const YA_VALID_CONTENT_TYPES = new Set([
        "текст",
        "аудио",
        "изображение",
        "интерактив",
        "видео",
        "данные"
    ]);

    const completedContentTypes = new Set();
    approvedTasks.forEach((task) => {
        const taskIndex = Number(task.taskIndex);
        const typeInfo = Number.isFinite(taskIndex) ? taskTypeMap.get(taskIndex) : null;
        const base = typeInfo ? typeInfo.base : Number(task.taskNumber) || null;
        if (base && base >= 10 && base <= 50) {
            const ct = String(typeInfo?.contentType || "").trim().toLowerCase();
            if (YA_VALID_CONTENT_TYPES.has(ct)) {
                completedContentTypes.add(ct);
            }
        }
    });

    const isContentTypesPhaseDone = completedContentTypes.size >= 6;

    if (!isContentTypesPhaseDone) {
        return {
            phase: "CONTENT_TYPES",
            count: completedContentTypes.size,
            target: 6,
            percentage: Math.min(100, Math.round((completedContentTypes.size / 6) * 100)),
            hasStar: false,
        };
    }

    // 3. Фаза специализации
    if (!yaDirection) {
        return {
            phase: "CHOOSING_DIRECTION",
            count: 0,
            target: 4,
            percentage: 0,
            hasStar: false,
        };
    }

    let specApprovedCount = 0;
    approvedTasks.forEach((task) => {
        const taskIndex = Number(task.taskIndex);
        const typeInfo = Number.isFinite(taskIndex) ? taskTypeMap.get(taskIndex) : null;
        const base = typeInfo ? typeInfo.base : Number(task.taskNumber) || null;
        if (base && base >= 10 && base <= 50) {
            const ct = String(typeInfo?.contentType || "").trim().toLowerCase();
            if (ct === String(yaDirection).trim().toLowerCase()) {
                specApprovedCount += 1;
            }
        }
    });

    const YA_STAR_TARGET = 4;
    return {
        phase: "SPECIALIZATION",
        direction: yaDirection,
        count: specApprovedCount,
        target: YA_STAR_TARGET,
        percentage: Math.min(100, Math.round((specApprovedCount / YA_STAR_TARGET) * 100)),
        hasStar: specApprovedCount >= YA_STAR_TARGET,
    };
}

function computeParticipant(participant, taskTypeMap, deltaByUser, allAttempts, sectionId) {
    const tasks = participant.tasks && typeof participant.tasks === "object" ? Object.values(participant.tasks) : [];
    const approvedTasks = tasks.filter(isApprovedTask);

    const yaProgress = computeYaProgress(approvedTasks, taskTypeMap, participant.yaDirection);

    let yaApprovedCount = yaProgress.phase === "SPECIALIZATION" ? yaProgress.count : 0;
    let weApprovedCount = 0;
    const directionCounts = emptyDirectionCounts();

    approvedTasks.forEach((task) => {
        const taskIndex = Number(task.taskIndex);
        const typeInfo = Number.isFinite(taskIndex) ? taskTypeMap.get(taskIndex) : null;
        const base = typeInfo ? typeInfo.base : Number(task.taskNumber) || null;
        if (!base) return;

        if (base >= WE_RANGE.from && base <= WE_RANGE.to) {
            weApprovedCount += 1;
            const directionKey = typeInfo ? resolveDirectionKey(typeInfo.contentType) : null;
            if (directionKey) {
                directionCounts[directionKey] += 1;
            }
        }
    });

    const directions = WE_DIRECTIONS.map((direction) => ({
        key: direction.key,
        label: direction.label,
        count: directionCounts[direction.key],
        lit: directionCounts[direction.key] > 0,
    }));
    const weStars = directions.filter((direction) => direction.lit).length;

    // Pull role: prioritize participant.role (normalized)
    let computedRole = normalizeAndMapRole(participant.role);

    // If role is not set, fallback to mapping from the first task of the section
    if (!computedRole) {
        const userAttempts = allAttempts[participant.userId]?.tasks || {};
        let task0Attempt = null;
        for (const taskInfo of Object.values(userAttempts)) {
            const attemptsList = taskInfo.attempts || [];
            const found = attemptsList.find(att => att.taskIndex === 0 && att.sectionId === sectionId);
            if (found) {
                task0Attempt = found;
                break;
            }
        }
        if (task0Attempt?.taskDetails?.type) {
            computedRole = mapTypeToRole(task0Attempt.taskDetails.type);
        }
    }

    if (!computedRole) {
        computedRole = "Участник";
    }

    return {
        userId: participant.userId,
        name: participant.name || "",
        organization: participant.organization || "",
        tableNumber: normalizeTableNumber(participant.tableNumber),
        role: computedRole,
        inspectorTargetTable: participant.inspectorTargetTable || null,
        delta: findDeltaForUser(deltaByUser, participant.userId, participant.name),
        ya: {
            approvedCount: yaProgress.count,
            target: yaProgress.target,
            progress: yaProgress.percentage / 100,
            star: yaProgress.hasStar,
            phase: yaProgress.phase,
            direction: yaProgress.direction || null,
        },
        we: {
            approvedCount: weApprovedCount,
            stars: weStars,
            directions,
        },
        approvedTotal: yaApprovedCount + weApprovedCount,
        registeredAt: participant.registeredAt || null,
        updatedAt: participant.updatedAt || null,
    };
}

// Главная агрегация дашборда сессии.
export async function getMayakSessionDashboardData(sessionId) {
    const session = await getMayakSessionById(sessionId);
    if (!session) {
        throw new Error("Сессия не найдена");
    }

    const [taskTypeMap, deltaByUser, allAttempts] = await Promise.all([
        readTaskTypeMap(session.sectionId),
        readDeltaByUser(),
        readAttempts(),
    ]);

    // Сырые участники рантайма (с задачами) для подсчёта звёзд/прогресса.
    const participantsRaw = await readSessionRuntimeParticipants(sessionId);

    const tableCount = Math.max(1, normalizeTableNumber(session.tableCount) || 1);

    const participants = participantsRaw
        .map((participant) => computeParticipant(participant, taskTypeMap, deltaByUser, allAttempts, session.sectionId))
        .sort((a, b) => {
            const tableDelta = a.tableNumber - b.tableNumber;
            if (tableDelta !== 0) return tableDelta;
            return String(a.name).localeCompare(String(b.name), "ru");
        });

    const reviews = await readSessionReviews(sessionId);
    const approvedReviews = reviews.filter((r) => r.status === "approved" || r.status === "expired");

    const tables = [];
    for (let tableNumber = 1; tableNumber <= tableCount; tableNumber += 1) {
        const members = participants.filter((participant) => participant.tableNumber === tableNumber);
        const yaStars = members.filter((member) => member.ya.star).length;
        const weStars = members.reduce((sum, member) => sum + member.we.stars, 0);
        const approvedTotal = members.reduce((sum, member) => sum + member.approvedTotal, 0);
        const yaApproved = members.reduce((sum, member) => sum + member.ya.approvedCount, 0);
        const weApproved = members.reduce((sum, member) => sum + member.we.approvedCount, 0);

        const tableParticipantIds = new Set(members.map((m) => m.userId));
        const tableApprovedReviews = approvedReviews.filter((r) => tableParticipantIds.has(r.participantUserId));
        const tableTotalSeconds = reviews.filter((r) => tableParticipantIds.has(r.participantUserId)).reduce((sum, r) => sum + (r.secondsSpent || 0), 0);
        const tableAverageTaskTime = tableApprovedReviews.length > 0 ? Math.round(tableTotalSeconds / tableApprovedReviews.length) : 0;

        const tableMembersWithDelta = members.filter((m) => typeof m.delta === "number" && m.delta !== null);
        const tableAverageDelta = tableMembersWithDelta.length > 0
            ? Number((tableMembersWithDelta.reduce((sum, m) => sum + m.delta, 0) / tableMembersWithDelta.length).toFixed(1))
            : null;

        tables.push({
            tableNumber,
            participants: members,
            totals: { 
                participantCount: members.length, 
                yaStars, 
                weStars, 
                approvedTotal, 
                yaApproved, 
                weApproved,
                averageDelta: tableAverageDelta,
                averageTaskTime: tableAverageTaskTime
            },
        });
    }

    // Участники вне допустимого диапазона столов (если столов стало меньше) — в «нераспределённые».
    const unassigned = participants.filter(
        (participant) => participant.tableNumber < 1 || participant.tableNumber > tableCount
    );

    const participantsWithDelta = participants.filter((p) => typeof p.delta === "number" && p.delta !== null);
    const averageDelta = participantsWithDelta.length > 0
        ? Number((participantsWithDelta.reduce((sum, p) => sum + p.delta, 0) / participantsWithDelta.length).toFixed(1))
        : 0;
    const totalApproved = participants.reduce((sum, p) => sum + (p.approvedTotal || 0), 0);

    const totalSecondsSpent = reviews.reduce((sum, r) => sum + (r.secondsSpent || 0), 0);
    const averageTaskTime = approvedReviews.length > 0 ? Math.round(totalSecondsSpent / approvedReviews.length) : 0;

    const overall = {
        participantCount: participants.length,
        averageDelta,
        approvedTotal: totalApproved,
        averageTaskTime,
        tables: tables.map((table) => ({
            tableNumber: table.tableNumber,
            participantCount: table.totals.participantCount,
            approvedTotal: table.totals.approvedTotal,
            yaStars: table.totals.yaStars,
            weStars: table.totals.weStars,
        })),
    };

    return {
        session: {
            id: session.id,
            name: session.name || "",
            sectionId: session.sectionId || "",
            tableCount,
            status: session.status || "active",
        },
        directions: WE_DIRECTIONS.map(({ key, label }) => ({ key, label })),
        yaStarTarget: YA_STAR_TARGET,
        tables,
        unassigned,
        overall,
        generatedAt: new Date().toISOString(),
    };
}
