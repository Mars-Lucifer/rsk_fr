import { promises as fs } from "fs";
import path from "path";

import { getMayakSessionById } from "@/lib/mayakSessions";
import { getSectionBundle } from "@/lib/mayakContentStorage";
import { readSessionRuntimeParticipants, readSessionReviews, getDay2TaktStatus } from "@/lib/mayakSessionRuntime";
import { isDay2Section } from "@/lib/mayakDay2Mode";
import {
    WE_DIRECTIONS,
    resolveFormatKey,
    resolveDirectionKey,
    classifyMoodCard,
    validateDeckStandard,
} from "@/lib/mayakProgressModel";

const DELTA_TEST_FILE = path.join(process.cwd(), "data", "DeltaTest.json");

// Кэш парсинга больших JSON по mtime файла. DeltaTest.json (~1 МБ) и
// taskAttempts.json (~5.5 МБ) читаются на КАЖДЫЙ запрос дашборда (поллинг 5с у
// каждого открытого экрана). Полное чтение+парсинг каждый раз — лишняя нагрузка.
// Инвалидация по mtime: файл не менялся — отдаём разобранное из памяти, дёшево.
const _jsonMtimeCache = new Map();
async function readJsonCachedByMtime(file, transform) {
    let stat;
    try {
        stat = await fs.stat(file);
    } catch {
        _jsonMtimeCache.delete(file);
        return transform(null);
    }
    const cached = _jsonMtimeCache.get(file);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
        return cached.value;
    }
    let raw = null;
    try {
        raw = await fs.readFile(file, "utf8");
    } catch {
        raw = null;
    }
    const value = transform(raw);
    _jsonMtimeCache.set(file, { mtimeMs: stat.mtimeMs, value });
    return value;
}

// Граница частей внутри стола (по базовому номеру задания = taskIndex + 1).
// Часть «Я» — задания с базой 10..50, часть «Мы» — с базой 51..99.
const YA_RANGE = { from: 10, to: 50 };
const WE_RANGE = { from: 51, to: 99 };
// Сколько одобренных заданий части «Я» нужно для зажжённой звезды.
export const YA_STAR_TARGET = 4;

// Шесть направлений части «Мы» (снизу вверх — в порядке отображения звёзд).
// key — стабильный идентификатор, label — подпись, match — нормализованные значения contentType.
// WE_DIRECTIONS импортируется из mayakProgressModel (единый источник истины).

// normalizeContentType / DIRECTION_LOOKUP / resolveDirectionKey вынесены в mayakProgressModel.

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
    if (norm === "ИНСПЕКТОР" || norm === "INSPECTOR" || norm === "КОНТРОЛЕР") return "Инспектор";
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
            return "Инспектор";
        default:
            return "Участник";
    }
}

// Карта userId/name -> дельта 5-го уровня ранжирования (последняя по времени запись).
function parseDeltaByUser(raw) {
    if (raw === null) return { byUser: {}, byName: {} };
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

function readDeltaByUser() {
    return readJsonCachedByMtime(DELTA_TEST_FILE, parseDeltaByUser);
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

function parseAttempts(raw) {
    if (raw === null) return {};
    try {
        return JSON.parse(raw) || {};
    } catch {
        return {};
    }
}

function readAttempts() {
    return readJsonCachedByMtime(ATTEMPTS_FILE, parseAttempts);
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
        const info = { contentType: task?.contentType || "", base: index + 1 };
        map.set(globalIndex, info);
        map.set(index, info);
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
    return task && (task.status === "approved" || task.status === "expired" || task.status === "rework_expired");
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

    // 2. Считаем освоенные форматы части «Я» (base 10..50).
    // Тип распознаётся через общий словарь (Статика→изображение, Динамика→видео).
    // Карта настроения засчитывается только если названа по стандарту
    // «<Формат> - Карта настроения» (тогда даёт соответствующий формат).
    const completedContentTypes = new Set();
    approvedTasks.forEach((task) => {
        const taskIndex = Number(task.taskIndex);
        const typeInfo = Number.isFinite(taskIndex) ? taskTypeMap.get(taskIndex) : null;
        const base = typeInfo ? typeInfo.base : Number(task.taskNumber) || null;
        if (base && base >= 10 && base <= 50) {
            const rawType = typeInfo?.contentType || "";
            const mood = classifyMoodCard(rawType);
            if (mood.isMood) {
                if (mood.standard && mood.section === "ya" && mood.key) {
                    completedContentTypes.add(mood.key);
                }
                return;
            }
            const fmtKey = resolveFormatKey(rawType);
            if (fmtKey) {
                completedContentTypes.add(fmtKey);
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
    const specTasks = [];
    // yaDirection — canonical-ключ формата (резолвится через общий словарь),
    // поэтому сравниваем нормализованные ключи, а не сырые строки.
    const targetFormatKey = resolveFormatKey(yaDirection) || resolveFormatKey(String(yaDirection));
    approvedTasks.forEach((task) => {
        const taskIndex = Number(task.taskIndex);
        const typeInfo = Number.isFinite(taskIndex) ? taskTypeMap.get(taskIndex) : null;
        const base = typeInfo ? typeInfo.base : Number(task.taskNumber) || null;
        if (base && base >= 10 && base <= 50) {
            const rawType = typeInfo?.contentType || "";
            const mood = classifyMoodCard(rawType);
            const fmtKey = mood.isMood
                ? (mood.standard && mood.section === "ya" ? mood.key : null)
                : resolveFormatKey(rawType);
            if (fmtKey && targetFormatKey && fmtKey === targetFormatKey) {
                specTasks.push(task);
            }
        }
    });

    specTasks.sort((a, b) => {
        const timeA = a.updatedAt ? Date.parse(a.updatedAt) : 0;
        const timeB = b.updatedAt ? Date.parse(b.updatedAt) : 0;
        if (timeA !== timeB) return timeA - timeB;
        return (Number(a.taskIndex) || 0) - (Number(b.taskIndex) || 0);
    });

    // -1: одно «вводное» задание этого формата уже зачтено на фазе «Типы
    // контента» (по одному заданию каждого из 6 форматов). Специализация
    // считает только 4 НОВЫХ задания после выбора направления; звезда на 4.
    // Та же формула в trainer.js (yaProgress) — держать синхронно.
    if (specTasks.length > 1) {
        specApprovedCount = specTasks.length - 1;
    } else {
        specApprovedCount = 0;
    }

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

    let yaApprovedCount = yaProgress.count;
    let yaTarget = yaProgress.target;
    let yaStarType = null;
    if (yaProgress.phase === "SPECIALIZATION") {
        if (yaProgress.count >= 4) {
            yaStarType = "gold";
        } else if (yaProgress.count === 3) {
            yaStarType = "joker";
        }
    }

    let weApprovedCount = 0;
    const directionCounts = emptyDirectionCounts();
    // Направления, закрытые звездой-джокером (авто-зачёт) — в дашборде они
    // показываются красной звездой, в отличие от обычных выполненных.
    const directionViaJoker = {};

    approvedTasks.forEach((task) => {
        const taskIndex = Number(task.taskIndex);
        const typeInfo = Number.isFinite(taskIndex) ? taskTypeMap.get(taskIndex) : null;
        const base = typeInfo ? typeInfo.base : Number(task.taskNumber) || null;
        if (!base) return;

        if (base >= WE_RANGE.from && base <= WE_RANGE.to) {
            weApprovedCount += 1;
            const rawType = typeInfo?.contentType || "";
            const mood = classifyMoodCard(rawType);
            // Карта настроения засчитывается направлению только если названа
            // по стандарту «<Направление> - Карта настроения».
            const directionKey = mood.isMood
                ? (mood.standard && mood.section === "we" ? mood.key : null)
                : resolveDirectionKey(rawType);
            if (directionKey && directionCounts[directionKey] !== undefined) {
                directionCounts[directionKey] += 1;
                if (task.viaJoker) {
                    directionViaJoker[directionKey] = true;
                }
            }
        }
    });

    const directions = WE_DIRECTIONS.map((direction) => ({
        key: direction.key,
        label: direction.label,
        count: directionCounts[direction.key],
        lit: directionCounts[direction.key] > 0,
        viaJoker: Boolean(directionViaJoker[direction.key]),
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
            approvedCount: yaApprovedCount,
            target: yaTarget,
            progress: Math.min(yaApprovedCount, yaTarget) / yaTarget,
            star: yaStarType,
            phase: yaProgress.phase,
            direction: yaProgress.direction || null,
        },
        we: {
            approvedCount: weApprovedCount,
            stars: weStars,
            directions,
        },
        approvedTotal: approvedTasks.length,
        registeredAt: participant.registeredAt || null,
        updatedAt: participant.updatedAt || null,
    };
}

// Валидация колоды сессии по стандарту (для баннера/скрытия прогресса).
async function readDeckValidation(sectionId) {
    if (!sectionId) {
        return { dashboardReady: false, issues: ["У сессии не задана колода"], warnings: [] };
    }
    try {
        const bundle = await getSectionBundle(sectionId, { includeTexts: false });
        return validateDeckStandard(bundle.tasks || []);
    } catch {
        return { dashboardReady: false, issues: ["Не удалось загрузить колоду"], warnings: [] };
    }
}

// Контекст для расхода звезды-джокера: сколько джокеров заработано (1, если в
// части «Я» зажжена звезда специализации, иначе 0), сколько уже потрачено, и
// относится ли указанное задание к направлению части «Мы». Источник истины
// сервера: вычисляется по тому же прогрессу, что и дашборд.
export async function getJokerSpendContext(sessionId, userId, taskIndex) {
    const session = await getMayakSessionById(sessionId);
    if (!session) {
        throw new Error("Сессия не найдена");
    }
    const taskTypeMap = await readTaskTypeMap(session.sectionId);
    const participantsRaw = await readSessionRuntimeParticipants(sessionId);
    const participant = participantsRaw.find((p) => p.userId === userId);
    if (!participant) {
        throw new Error("Участник не зарегистрирован в этой сессии");
    }

    const tasks = participant.tasks && typeof participant.tasks === "object" ? Object.values(participant.tasks) : [];
    const approvedTasks = tasks.filter(isApprovedTask);
    const yaProgress = computeYaProgress(approvedTasks, taskTypeMap, participant.yaDirection);
    const earned = yaProgress.phase === "SPECIALIZATION" && yaProgress.hasStar ? 1 : 0;
    const jokerSpent = Number(participant.jokerSpent) || 0;

    const idx = Number(taskIndex);
    const typeInfo = Number.isFinite(idx) ? taskTypeMap.get(idx) : null;
    const base = typeInfo ? typeInfo.base : null;
    const rawType = typeInfo?.contentType || "";
    const mood = classifyMoodCard(rawType);
    const directionKey = mood.isMood
        ? (mood.standard && mood.section === "we" ? mood.key : null)
        : resolveDirectionKey(rawType);
    const isWeDirectionTask = Boolean(base && base >= WE_RANGE.from && base <= WE_RANGE.to && directionKey);

    return { earned, jokerSpent, balance: Math.max(0, earned - jokerSpent), base, directionKey, isWeDirectionTask, contentType: rawType };
}

// Главная агрегация дашборда сессии.
export async function getMayakSessionDashboardData(sessionId) {
    const session = await getMayakSessionById(sessionId);
    if (!session) {
        throw new Error("Сессия не найдена");
    }

    const [taskTypeMap, deltaByUser, allAttempts, deckValidation] = await Promise.all([
        readTaskTypeMap(session.sectionId),
        readDeltaByUser(),
        readAttempts(),
        readDeckValidation(session.sectionId),
    ]);

    // Сырые участники рантайма (с задачами) для подсчёта звёзд/прогресса.
    // Администратор-отладка (userId "dev-bypass") заходит в сессию для проверки
    // инспектора/отладки и НЕ должен попадать в дашборд и учитываться в
    // столах/счётчиках/средних — отсекаем его на уровне источника данных.
    // Демо-вход мастера (master-demo-*) — как и dev-bypass, служебный: мастер
    // заходит показать игру, его прогресс не должен искажать столы и средние.
    const allRuntimeRaw = (await readSessionRuntimeParticipants(sessionId)).filter(
        (participant) => participant.userId !== "dev-bypass" && !String(participant.userId || "").startsWith("master-demo-")
    );

    // Скрытые участники (флаг hidden, ставит админ через редактор) не участвуют
    // ни в столах, ни в средних/звёздах/времени — их метрики не искажают картину.
    // Отдаём их отдельным списком, чтобы редактор мог показать и вернуть обратно.
    const participantsRaw = allRuntimeRaw.filter((participant) => !participant.hidden);
    const hiddenRaw = allRuntimeRaw.filter((participant) => participant.hidden);

    const tableCount = Math.max(1, normalizeTableNumber(session.tableCount) || 1);

    const hidden = hiddenRaw
        .map((participant) => ({
            userId: participant.userId,
            name: participant.name || "",
            organization: participant.organization || "",
            tableNumber: normalizeTableNumber(participant.tableNumber),
            role: normalizeAndMapRole(participant.role) || "Участник",
        }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"));

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
        const tableTotalSeconds = tableApprovedReviews.reduce((sum, r) => sum + (r.secondsSpent || 0), 0);
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
        : null;
    const totalApproved = participants.reduce((sum, p) => sum + (p.approvedTotal || 0), 0);

    const totalSecondsSpent = approvedReviews.reduce((sum, r) => sum + (r.secondsSpent || 0), 0);
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
        // Такт зала — только для второго дня: пульту ведущего нужно знать, что
        // сейчас идёт, чтобы показать кнопку «следующий», а не «запустить».
        day2Takt: isDay2Section(session.sectionId) ? await getDay2TaktStatus(session.id) : null,
        directions: WE_DIRECTIONS.map(({ key, label }) => ({ key, label })),
        yaStarTarget: YA_STAR_TARGET,
        deck: {
            dashboardReady: deckValidation.dashboardReady,
            issues: deckValidation.issues || [],
            warnings: deckValidation.warnings || [],
        },
        tables,
        unassigned,
        hidden,
        overall,
        generatedAt: new Date().toISOString(),
    };
}
