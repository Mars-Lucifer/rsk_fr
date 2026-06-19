// Единый источник истины для расчёта прогресса MAYAK и валидации колод.
//
// Зачем этот модуль:
// - раньше словарь типов, направления «Мы» и пороги фаз были захардкожены
//   в 5 местах (сервер mayakSessionDashboard.js, клиент trainer.js, бейджи,
//   попап выбора направления). Они расходились между собой и ломались на
//   колодах с другими названиями типов (СПО: Статика/Динамика) или опечатками
//   в данных (Артек: «ЦИФРВООЕ», «Знание и навыки»).
// - теперь и клиент, и сервер зовут отсюда — расхождения исключены.
//
// Важно: контент MAYAK не версионируется в git и правится операторами вживую,
// поэтому модель ОБЯЗАНА быть толерантной к грязным данным (регистр, синонимы,
// известные опечатки). Чистка данных — косметика сверху, не несущая логика.

// --- Нормализация ---------------------------------------------------------

export function normalizeContentType(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[ \s]+/g, " ");
}

// --- Канонические форматы части «Я» --------------------------------------
// 6 форматов. Каждый канон имеет набор синонимов/известных опечаток, которые
// встречаются в реальных колодах. Все приводятся к canonical key.
export const YA_FORMAT_TYPES = [
    { key: "текст", label: "Текст", match: ["текст"] },
    { key: "аудио", label: "Аудио", match: ["аудио"] },
    // Статика == Изображение (СПО-колоды используют «Статика»)
    { key: "изображение", label: "Изображение", match: ["изображение", "статика", "изобр"] },
    { key: "интерактив", label: "Интерактив", match: ["интерактив"] },
    // Динамика == Видео (СПО-колоды используют «Динамика»)
    { key: "видео", label: "Видео", match: ["видео", "динамика"] },
    { key: "данные", label: "Данные", match: ["данные"] },
];

export const YA_FORMAT_TARGET = YA_FORMAT_TYPES.length; // 6

// --- Направления части «Мы» ----------------------------------------------
// 6 направлений. match включает известные опечатки из боевых колод:
//  - «знание и навыки» (ед.ч., колоды 401-500/6001-6100)
//  - «внешнение взаимодействия» (6001-6100)
//  - «единое цифрвоое пространство» (7001-7100, Артек)
export const WE_DIRECTIONS = [
    { key: "KNOWLEDGE", label: "Знания и навыки", match: ["знания и навыки", "знание и навыки", "знания", "навыки"] },
    { key: "INTERACTION", label: "Внешние взаимодействия", match: ["внешние взаимодействия", "внешнее взаимодействие", "внешнение взаимодействия"] },
    { key: "ENVIRONMENT", label: "Единое цифровое пространство", match: ["единое цифровое пространство", "единое цифрвоое пространство"] },
    { key: "PROTECTION", label: "Защита данных", match: ["защита данных"] },
    { key: "DATA", label: "Данные и аналитика", match: ["данные и аналитика"] },
    { key: "AUTOMATION", label: "Автоматизация", match: ["автоматизация"] },
];

// Тип «Старт».
const START_VARIANTS = ["старт", "start"];

// Базовое имя карты настроения (без префикса типа).
const MOOD_BASE = "карта настроения";

// --- Lookup-таблицы (строятся один раз) ----------------------------------

const FORMAT_LOOKUP = (() => {
    const map = new Map();
    YA_FORMAT_TYPES.forEach((fmt) => {
        fmt.match.forEach((variant) => map.set(normalizeContentType(variant), fmt.key));
    });
    return map;
})();

const DIRECTION_LOOKUP = (() => {
    const map = new Map();
    WE_DIRECTIONS.forEach((dir) => {
        dir.match.forEach((variant) => map.set(normalizeContentType(variant), dir.key));
    });
    return map;
})();

export function resolveFormatKey(contentType) {
    return FORMAT_LOOKUP.get(normalizeContentType(contentType)) || null;
}

export function resolveDirectionKey(contentType) {
    return DIRECTION_LOOKUP.get(normalizeContentType(contentType)) || null;
}

export function isStartType(contentType) {
    return START_VARIANTS.includes(normalizeContentType(contentType));
}

// --- Карта настроения -----------------------------------------------------
// Стандарт (по решению владельца продукта): карта настроения засчитывается
// в прогресс ТОЛЬКО если названа «<Тип> - Карта настроения», напр.
// «Текст - Карта настроения». Бесхозная «Карта настроения» без префикса —
// не по стандарту: в прогресс не идёт, но колоду не дисквалифицирует
// (поднимается мягкое предупреждение в валидаторе).
//
// Возвращает:
//   { isMood: false }                                  — не карта настроения
//   { isMood: true, standard: false }                  — карта без префикса (не по стандарту)
//   { isMood: true, standard: true, section, key }     — карта по стандарту,
//        section: "ya" | "we", key: canonical key формата/направления
export function classifyMoodCard(contentType) {
    const norm = normalizeContentType(contentType);
    if (!norm.includes(MOOD_BASE)) {
        return { isMood: false };
    }
    // Отделяем префикс типа от «карта настроения».
    // Поддерживаем разделители: " - ", "-", ":", "—".
    const prefix = norm
        .replace(MOOD_BASE, "")
        .replace(/[-—:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!prefix) {
        return { isMood: true, standard: false };
    }
    const fmtKey = resolveFormatKey(prefix);
    if (fmtKey) {
        return { isMood: true, standard: true, section: "ya", key: fmtKey };
    }
    const dirKey = resolveDirectionKey(prefix);
    if (dirKey) {
        return { isMood: true, standard: true, section: "we", key: dirKey };
    }
    // Префикс есть, но не распознан как тип/направление.
    return { isMood: true, standard: false };
}

// --- Классификация одной задачи ------------------------------------------
// Возвращает { kind, key }:
//   kind: "start" | "ya-format" | "we-direction" | "mood" | "unknown"
//   key:  canonical key (для ya-format/we-direction) либо null
export function classifyTask(contentType) {
    if (isStartType(contentType)) {
        return { kind: "start", key: null };
    }
    const mood = classifyMoodCard(contentType);
    if (mood.isMood) {
        return { kind: "mood", key: mood.standard ? mood.key : null, section: mood.section || null, standard: mood.standard };
    }
    const fmtKey = resolveFormatKey(contentType);
    if (fmtKey) {
        return { kind: "ya-format", key: fmtKey };
    }
    const dirKey = resolveDirectionKey(contentType);
    if (dirKey) {
        return { kind: "we-direction", key: dirKey };
    }
    return { kind: "unknown", key: null };
}

// --- Валидация колоды по стандарту ---------------------------------------
// tasks: массив объектов задач из index.json (содержат поле contentType).
// Возвращает:
//   {
//     dashboardReady: boolean,   // показывать ли дашборд прогресса
//     issues: string[],          // человекочитаемые проблемы (жёсткие)
//     warnings: string[],        // мягкие предупреждения (карты не по стандарту и т.п.)
//     formats: string[],         // найденные canonical-форматы части «Я»
//     directions: string[],      // найденные canonical-направления части «Мы»
//     hasStart: boolean,
//   }
//
// Колода считается готовой к дашборду, если в ней распознаны хотя бы
// форматы части «Я» и направления части «Мы» полностью (по 6). Старт
// необязателен (часть боевых колод без старт-блока).
export function validateDeckStandard(tasks) {
    const issues = [];
    const warnings = [];
    const list = Array.isArray(tasks) ? tasks : [];

    if (list.length === 0) {
        return {
            dashboardReady: false,
            issues: ["Колода пуста или не загружена"],
            warnings: [],
            formats: [],
            directions: [],
            hasStart: false,
        };
    }

    let typed = 0;
    let hasStart = false;
    const formats = new Set();
    const directions = new Set();
    let moodTotal = 0;
    let moodNonStandard = 0;
    const unknownTypes = new Set();

    list.forEach((task) => {
        const ct = task && task.contentType;
        if (ct === undefined || ct === null || String(ct).trim() === "") {
            return;
        }
        typed += 1;
        const info = classifyTask(ct);
        switch (info.kind) {
            case "start":
                hasStart = true;
                break;
            case "ya-format":
                formats.add(info.key);
                break;
            case "we-direction":
                directions.add(info.key);
                break;
            case "mood":
                moodTotal += 1;
                if (!info.standard) moodNonStandard += 1;
                break;
            default:
                // Тип заполнен, но не распознан как старт/формат/направление/
                // карта настроения — такие задания не попадают в прогресс
                // «Я»/«Мы». Собираем для предупреждения оператору.
                unknownTypes.add(String(ct).trim());
                break;
        }
    });

    if (typed === 0) {
        issues.push("У задач не заполнен contentType");
    }
    const missingFormats = YA_FORMAT_TYPES.filter((f) => !formats.has(f.key));
    const missingDirections = WE_DIRECTIONS.filter((d) => !directions.has(d.key));
    if (typed > 0 && missingFormats.length > 0) {
        issues.push(`Часть «Я»: не распознаны типы — ${missingFormats.map((f) => f.label).join(", ")}`);
    }
    if (typed > 0 && missingDirections.length > 0) {
        issues.push(`Часть «Мы»: не распознаны направления — ${missingDirections.map((d) => d.label).join(", ")}`);
    }
    if (moodNonStandard > 0) {
        warnings.push(
            `Карты настроения не по стандарту: ${moodNonStandard} из ${moodTotal}. ` +
            `Ожидается имя вида «Текст - Карта настроения».`
        );
    }
    if (unknownTypes.size > 0) {
        const sample = Array.from(unknownTypes).slice(0, 8);
        const more = unknownTypes.size > sample.length ? ` и ещё ${unknownTypes.size - sample.length}` : "";
        warnings.push(
            `Нераспознанные типы контента (не засчитываются в прогресс «Я»/«Мы»): ` +
            `${sample.map((t) => `«${t}»`).join(", ")}${more}.`
        );
    }

    const dashboardReady = typed > 0 && missingFormats.length === 0 && missingDirections.length === 0;

    return {
        dashboardReady,
        issues,
        warnings,
        formats: Array.from(formats),
        directions: Array.from(directions),
        hasStart,
    };
}
