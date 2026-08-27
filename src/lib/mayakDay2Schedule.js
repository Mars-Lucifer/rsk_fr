// Расписание тактов второго дня: 90 · 70 · 45 минут.
//
// Такт начинается и кончается у всех одновременно — не «когда команда готова»
// и не «кто раньше». Если одна команда закончит такт 1 на десять минут раньше,
// её пары начнут раньше, а на сборке всё равно будут ждать: разнобой не
// ускоряет, он копит рассинхрон (ТЗ, раздел В10).
//
// Отсюда два решения, и оба здесь:
//   1. время такта задаёт сервер, клиент только отображает;
//   2. отметки внутри такта привязаны к тому же серверному времени, поэтому
//      всплывают у всех разом.
//
// Модуль чистый: ни fs, ни сети, ни Date.now() внутри расчёта — момент всегда
// передаётся снаружи. Так его считает и сервер, и браузер, и тест.

export const DAY2_TAKTS = [
    { index: 1, key: "DETAIL", label: "Такт 1 · деталь", minutes: 90 },
    { index: 2, key: "NODE", label: "Такт 2 · узел", minutes: 70 },
    { index: 3, key: "PRODUCT", label: "Такт 3 · изделие", minutes: 45 },
];

export const DAY2_FIRST_TAKT = 1;
export const DAY2_LAST_TAKT = DAY2_TAKTS.length;

// Границы сдвига. Ведущий двигает такт «одной кнопкой», но не на любое число:
// час туда-сюда — это уже не поправка на реальность, а другой сценарий дня.
const MIN_TAKT_SECONDS = 5 * 60;
const MAX_TAKT_SECONDS = 4 * 60 * 60;

export function day2TaktByIndex(index) {
    return DAY2_TAKTS.find((takt) => takt.index === Number(index)) || null;
}

export function day2DefaultSeconds(index) {
    const takt = day2TaktByIndex(index);
    return takt ? takt.minutes * 60 : 0;
}

export function clampDay2TaktSeconds(seconds) {
    const parsed = Math.round(Number(seconds));
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(MAX_TAKT_SECONDS, Math.max(MIN_TAKT_SECONDS, parsed));
}

/**
 * Три отметки, всплывающие сами (ТЗ, раздел В3).
 *
 * Первая ловит главный дефект дня — проверку продукта на машине автора. Без
 * неё он всплывает на защите, когда чинить уже нечем.
 *
 * Отметка возвращается, пока идёт её окно: она не событие, а состояние такта,
 * и клиент может опоздать с опросом на пять секунд, не пропустив её.
 */
const MARKS = [
    {
        id: "detail-check-on-neighbour",
        takt: 1,
        // за 30 минут до конца и до самого конца
        applies: ({ remainingSeconds }) => remainingSeconds <= 30 * 60,
        text: "Возьмите телефон соседа и пройдите то, что уже готово.",
    },
    {
        id: "node-mismatch-is-normal",
        takt: 2,
        // через 25 минут после начала, окно — четверть часа
        applies: ({ elapsedSeconds }) => elapsedSeconds >= 25 * 60 && elapsedSeconds <= 40 * 60,
        text: "Не сошлось — это нормально. Введите вашу пару и слово «не сошлось».",
    },
    {
        id: "product-acceptance-checks",
        takt: 3,
        applies: ({ remainingSeconds }) => remainingSeconds <= 10 * 60,
        text: "Приёмочные проверки написаны?",
    },
];

/**
 * Состояние такта на заданный момент.
 *
 * @param takt {index, startedAt, durationSeconds} — как лежит на сервере
 * @param nowMs текущий момент в миллисекундах
 */
export function day2TaktStatus(takt, nowMs) {
    const index = Number(takt?.index) || DAY2_FIRST_TAKT;
    const plan = day2TaktByIndex(index) || DAY2_TAKTS[0];
    const durationSeconds = clampDay2TaktSeconds(takt?.durationSeconds || day2DefaultSeconds(index));
    const startedMs = takt?.startedAt ? Date.parse(takt.startedAt) : NaN;

    if (!Number.isFinite(startedMs)) {
        return {
            index,
            key: plan.key,
            label: plan.label,
            running: false,
            durationSeconds,
            elapsedSeconds: 0,
            remainingSeconds: durationSeconds,
            expiresAt: null,
            overdue: false,
            mark: null,
        };
    }

    const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
    const remainingSeconds = durationSeconds - elapsedSeconds;
    const status = {
        index,
        key: plan.key,
        label: plan.label,
        running: true,
        durationSeconds,
        elapsedSeconds,
        remainingSeconds: Math.max(0, remainingSeconds),
        expiresAt: new Date(startedMs + durationSeconds * 1000).toISOString(),
        // Такт не гасится сам: время вышло — это повод ведущему нажать кнопку,
        // а не команде потерять экран посреди работы.
        overdue: remainingSeconds <= 0,
    };

    const mark = MARKS.find(
        (candidate) => candidate.takt === index && !status.overdue && candidate.applies(status)
    );
    return { ...status, mark: mark ? { id: mark.id, text: mark.text } : null };
}

/** MM:SS для строки участника. Часы не нужны: самый длинный такт — 90 минут. */
export function formatDay2Remaining(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
