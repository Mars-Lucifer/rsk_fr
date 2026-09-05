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
    // Статика == Изображение (СПО-колоды используют «Статика»).
    // «Фото» — так назван формат Qwen в реестре шаблонов сервисов; без синонима
    // шаблон не находился по типу задания «Изображение».
    { key: "изображение", label: "Изображение", match: ["изображение", "статика", "изобр", "фото"] },
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
    // Колода дня 2: части «Я» нет вовсе, прогресс считается только по направлениям.
    const dayTwo = typed > 0 && formats.size === 0 && missingDirections.length === 0;
    if (dayTwo) {
        warnings.push("Колода без части «Я» (день 2): прогресс только по направлениям «Мы».");
    } else if (typed > 0 && missingFormats.length > 0) {
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

    const dashboardReady = typed > 0 && missingDirections.length === 0 && (missingFormats.length === 0 || dayTwo);

    return {
        dashboardReady,
        issues,
        warnings,
        formats: Array.from(formats),
        directions: Array.from(directions),
        hasStart,
    };
}

// --- Прогресс части «Я»/«Мы» для тренажёра (клиент) -----------------------
//
// Чистый расчёт прогресса для UI тренажёра (`trainer.js`). Вынесен из
// гигантского useMemo, чтобы:
//   - снять ~260 строк доменной логики с god-компонента;
//   - покрыть формулу тестами (в истории были баги «залипания прогресса» на
//     секциях, начинающихся не с 1);
//   - держать её рядом с хелперами (classifyMoodCard/resolveFormatKey/…).
//
// ВНИМАНИЕ: серверный mayakSessionDashboard.computeYaProgress использует ту же
// формулу фаз START/CONTENT_TYPES/SPECIALIZATION. Эта функция дополнительно
// считает фазу WE_INDEX и ручной источник (bypass/админ-debug). Любая правка
// формулы должна синхронно отражаться в обоих местах, пока они не объединены.
//
// Параметры:
//   manualSource    — { phase, progress, weProgress, direction } | null.
//        Если задан (bypass-токен или клиентский админ-override сессии),
//        прогресс рисуется из него, минуя расчёт по задачам.
//   participant     — sessionRuntimeState.participant | null
//        (taskStates[], sectionId, yaDirection).
//   tasks           — колода секции (массив объектов с contentType), 0-based.
//   fallbackSectionId — sectionId токена, если у участника не задан.
// --- Раскладки колод ------------------------------------------------------
// Колоды разложены двумя способами, обе живут на проде:
//   СПО     — 6 вводных карт, форматы «Я» с 7-й по 47-ю  (1-100, 201-300)
//   базовая — 9 вводных карт, форматы «Я» с 10-й по 50-ю (401-500, 901-1000,
//             601-700, 6001-6100, 7001-7100, 8001-8100)
// Дальше в обеих идёт часть «Мы» — она начинается сразу за форматами.
//
// Раньше границы были зашиты числами базовой раскладки (1..10 и 10..50). На
// СПО это отрезало три первые карты формата и, наоборот, засчитывало четыре
// текстовые карты как вводные.
export const DECK_LAYOUTS = {
    spo: { key: "spo", startCards: 6, formatFrom: 7, formatTo: 47 },
    base: { key: "base", startCards: 9, formatFrom: 10, formatTo: 50 },
    // День 2 (стратегическая сессия): три вводные карты, части «Я» нет,
    // часть «Мы» идёт сразу с четвёртой карты. formatTo < formatFrom — форматов нет.
    day2: { key: "day2", startCards: 3, formatFrom: 4, formatTo: 3 },
};

// Колода дня 2 узнаётся по содержимому: ни одной карты формата «Я» и хотя бы
// одна карта направления «Мы». Номер о раскладке не говорит.
function isDayTwoDeck(cardByNumber) {
    let formats = 0;
    let directions = 0;
    cardByNumber.forEach((card) => {
        const info = classifyTask(card?.contentType || "");
        if (info.kind === "ya-format" || (info.kind === "mood" && info.standard && info.section === "ya")) formats += 1;
        if (info.kind === "we-direction" || (info.kind === "mood" && info.standard && info.section === "we")) directions += 1;
    });
    return formats === 0 && directions > 0;
}

// Раскладку определяем по самой колоде, а не по списку номеров: номер о ней
// ничего не говорит (201-300 — СПО, 401-500 — базовая, обе «не с единицы»),
// и такой список пришлось бы дописывать при каждой новой колоде.
// Признак — что лежит на 7-й карте: у СПО там уже формат, у базовой ещё вводная.
export function detectDeckLayout(cardByNumber, rangeStart) {
    if (isDayTwoDeck(cardByNumber)) return DECK_LAYOUTS.day2;
    const probe = cardByNumber.get(String(rangeStart + DECK_LAYOUTS.spo.formatFrom - 1));
    const rawType = probe?.contentType || "";
    const mood = classifyMoodCard(rawType);
    const isYaFormat = mood.isMood ? mood.standard && mood.section === "ya" : Boolean(resolveFormatKey(rawType));
    // Неразмеченная колода до сюда доходит с пустым типом — остаётся базовая,
    // то есть поведение как было.
    return isYaFormat ? DECK_LAYOUTS.spo : DECK_LAYOUTS.base;
}

export function computeTrainerYaProgress({
    manualSource = null,
    participant = null,
    tasks = [],
    fallbackSectionId = "",
} = {}) {
    if (manualSource) {
        const WE_INDEX_TARGET = 36;
        const targetMap = {
            START: 4,
            CONTENT_TYPES: YA_FORMAT_TARGET,
            CHOOSING_DIRECTION: 4,
            SPECIALIZATION: 4,
            WE_INDEX: WE_INDEX_TARGET,
        };
        const currentPhase = manualSource.phase;

        if (currentPhase === "WE_INDEX") {
            // Часть «Я» уже завершена (звезда специализации зажжена), показываем
            // «Индекс цифровой зрелости» части «Мы»: weDone из 36.
            const weDone = Math.min(Math.max(0, manualSource.weProgress), WE_INDEX_TARGET);
            return {
                phase: "WE_INDEX",
                count: weDone,
                target: WE_INDEX_TARGET,
                percentage: Math.min(100, Math.round((weDone / WE_INDEX_TARGET) * 100)),
                hasStar: true,
                yaStarEarned: true,
                direction: manualSource.direction || null,
                completedTypes: [],
            };
        }

        const target = targetMap[currentPhase] || 4;
        const count = Math.min(manualSource.progress, target);
        const percentage = Math.min(100, Math.round((count / target) * 100));
        const hasStar = currentPhase === "SPECIALIZATION" && count >= target;

        return {
            phase: currentPhase,
            count,
            target,
            percentage,
            hasStar,
            direction: currentPhase === "SPECIALIZATION" ? manualSource.direction : null,
            completedTypes: currentPhase !== "START" ? YA_FORMAT_TYPES.slice(0, count).map((t) => t.key) : [],
        };
    }

    if (!participant?.taskStates || !tasks.length) {
        return { phase: "START", count: 0, target: 4, hasStar: false, percentage: 0 };
    }

    const activeSectionId = participant.sectionId || fallbackSectionId || "";
    const match = String(activeSectionId).match(/^(\d+)-/);
    const rangeStart = match ? parseInt(match[1], 10) : 1;

    // Карту ищем по номеру задания, а не по позиции в массиве. Тренажёр
    // раскладывает колоду по ГЛОБАЛЬНЫМ индексам (у 401-500 первые 400 ячеек —
    // заглушки), и любой отсчёт от начала массива промахивался в пустоту: тип
    // читался как пустой, форматы не засчитывались, прогресс залипал на «0 из 6»
    // у всех колод, кроме 1-100. Номер же от раскладки массива не зависит.
    const cardByNumber = new Map();
    (tasks || []).forEach((card) => {
        const num = String(card?.number ?? "").trim();
        if (num) cardByNumber.set(num, card);
    });

    const layout = detectDeckLayout(cardByNumber, rangeStart);

    // Номер задания → позиция внутри колоды (1..100). taskIndex глобальный и
    // равен номеру минус один — он и остаётся запасным вариантом для старых
    // записей рантайма без taskNumber.
    const baseNumberOf = (source) => {
        const num = Number(source?.taskNumber ?? source?.number);
        const resolved = Number.isFinite(num) ? num : Number(source?.taskIndex) + 1;
        return Number.isFinite(resolved) ? resolved - rangeStart + 1 : null;
    };
    const cardOf = (ts) => {
        const num = Number(ts?.taskNumber);
        if (Number.isFinite(num)) return cardByNumber.get(String(num)) || null;
        const fallback = Number(ts?.taskIndex) + 1;
        return Number.isFinite(fallback) ? cardByNumber.get(String(fallback)) || null : null;
    };

    const completedTasks = participant.taskStates.filter(
        (ts) => ts.status === "approved" || ts.status === "expired" || ts.status === "rework_expired"
    );

    // 1. Вводные карты. Их шесть или девять — смотри detectDeckLayout.
    let startApprovedCount = 0;
    completedTasks.forEach((ts) => {
        const baseNumber = baseNumberOf(ts);
        if (baseNumber !== null && baseNumber >= 1 && baseNumber <= layout.startCards) {
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

    // 2. Считаем освоенные форматы части «Я» через общий словарь
    // (Статика→изображение, Динамика→видео). Карта настроения засчитывается
    // только если названа «<Формат> - Карта настроения».
    const completedContentTypes = new Set();
    completedTasks.forEach((ts) => {
        const baseNumber = baseNumberOf(ts);
        if (baseNumber === null || baseNumber < layout.formatFrom || baseNumber > layout.formatTo) {
            return;
        }

        const rawType = cardOf(ts)?.contentType || "";
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
    });

    const isContentTypesPhaseDone = completedContentTypes.size >= YA_FORMAT_TARGET;

    if (!isContentTypesPhaseDone) {
        return {
            phase: "CONTENT_TYPES",
            count: completedContentTypes.size,
            target: YA_FORMAT_TARGET,
            percentage: Math.min(100, Math.round((completedContentTypes.size / YA_FORMAT_TARGET) * 100)),
            hasStar: false,
            completedTypes: Array.from(completedContentTypes),
        };
    }

    // 3. Фаза специализации (yaDirection)
    const yaDirection = participant.yaDirection;

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
    // yaDirection — canonical-ключ формата; сравниваем нормализованные ключи.
    const targetFormatKey = resolveFormatKey(yaDirection);
    completedTasks.forEach((ts) => {
        const baseNumber = baseNumberOf(ts);
        if (baseNumber === null || baseNumber < layout.formatFrom || baseNumber > layout.formatTo) {
            return;
        }

        const rawType = cardOf(ts)?.contentType || "";
        const mood = classifyMoodCard(rawType);
        const fmtKey = mood.isMood
            ? (mood.standard && mood.section === "ya" ? mood.key : null)
            : resolveFormatKey(rawType);
        if (fmtKey && targetFormatKey && fmtKey === targetFormatKey) {
            specTasks.push(ts);
        }
    });

    specTasks.sort((a, b) => {
        const timeA = a.updatedAt ? Date.parse(a.updatedAt) : 0;
        const timeB = b.updatedAt ? Date.parse(b.updatedAt) : 0;
        if (timeA !== timeB) return timeA - timeB;
        return Number(a.taskIndex) - Number(b.taskIndex);
    });

    // specTasks — ВСЕ выполненные задания выбранного формата в base 10..50,
    // включая то одно «вводное», которое участник обязательно сделал на
    // фазе «Типы контента». Его вычитаем (-1), чтобы специализация засчитывала
    // только 4 НОВЫХ задания после выбора направления. Звезда зажигается на 4.
    if (specTasks.length > 1) {
        specApprovedCount = specTasks.length - 1;
    } else {
        specApprovedCount = 0;
    }

    const YA_STAR_TARGET = 4;
    const yaHasStar = specApprovedCount >= YA_STAR_TARGET;

    if (!yaHasStar) {
        return {
            phase: "SPECIALIZATION",
            direction: yaDirection,
            count: specApprovedCount,
            target: YA_STAR_TARGET,
            percentage: Math.min(100, Math.round((specApprovedCount / YA_STAR_TARGET) * 100)),
            hasStar: false,
        };
    }

    // 4. Часть «Я» завершена → «Индекс цифровой зрелости» части «Мы»: сколько
    // заданий распознанных направлений выполнено из всех таких в колоде.
    // Карта настроения засчитывается направлению только по стандарту.
    const WE_FROM = layout.formatTo + 1;
    const WE_TO = 99;
    const recognizeDirection = (rawType) => {
        const mood = classifyMoodCard(rawType);
        return mood.isMood
            ? (mood.standard && mood.section === "we" ? mood.key : null)
            : resolveDirectionKey(rawType);
    };

    let weTotal = 0;
    (tasks || []).forEach((card) => {
        const base = baseNumberOf(card);
        if (base !== null && base >= WE_FROM && base <= WE_TO && recognizeDirection(card?.contentType || "")) {
            weTotal += 1;
        }
    });

    let weDone = 0;
    completedTasks.forEach((ts) => {
        const baseNumber = baseNumberOf(ts);
        if (baseNumber !== null && baseNumber >= WE_FROM && baseNumber <= WE_TO) {
            if (recognizeDirection(cardOf(ts)?.contentType || "")) {
                weDone += 1;
            }
        }
    });

    return {
        phase: "WE_INDEX",
        direction: yaDirection,
        count: weDone,
        target: weTotal,
        percentage: weTotal > 0 ? Math.min(100, Math.round((weDone / weTotal) * 100)) : 0,
        // Звезда специализации части «Я» заработана и сохраняется (джокер
        // продолжает начисляться от неё). Считаем фазу «с звездой».
        hasStar: true,
        yaStarEarned: true,
    };
}
