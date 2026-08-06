"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Автоплеер раскладки этапа «МЫ».
// Координаты сняты с растрового поля public/mayak-guide/pole_my.png (1400×1105)
// автоматическим поиском белых панелей и линий сетки, поэтому жетоны попадают в клетки.
//
// Модель поля:
//   четыре планшета такта   — в каждом сетка 3×3, девять задач такта;
//   шесть карточек направлений «ЗВЕЗДЫ» — на них лежат разделы колоды заданий;
//   трек индекса цифровой зрелости — 6 строк по направлениям × 6 звёзд.

const VB_W = 1400;
const VB_H = 1105;

// Левые верхние углы планшетов тактов.
const TACTS = [
    { label: "Такт 1", x: 37, y: 242 },
    { label: "Такт 2", x: 372, y: 242 },
    { label: "Такт 3", x: 37, y: 656 },
    { label: "Такт 4", x: 372, y: 656 },
];

// Шаг сетки 3×3 внутри планшета такта (снят по линиям сетки поля).
const CELL_DX = 99;
const CELL_DY = 98;
const CELL_X0 = 58;
const CELL_Y0 = 122;

function cellPoint(tact, index) {
    return {
        x: tact.x + CELL_X0 + (index % 3) * CELL_DX,
        y: tact.y + CELL_Y0 + Math.floor(index / 3) * CELL_DY,
    };
}

// Порядок направлений совпадает с раскладкой карточек на поле: сверху вниз, слева направо.
const DIRS = [
    // deck — центр паза направления на поле (панель 206×291), стопка ложится ровно в него.
    // jeton: цветная сторона; серая рубашка того же направления — следующий файл набора.
    { id: "knowledge", name: "Знания и навыки", color: "#e7a847", jeton: 1, deck: { x: 829, y: 201 } },
    { id: "external", name: "Внешние взаимодействия", color: "#cd5f44", jeton: 3, deck: { x: 1047, y: 201 } },
    { id: "space", name: "Единое цифровое пространство", color: "#9fc9d3", jeton: 7, deck: { x: 1265, y: 201 } },
    { id: "security", name: "Защита данных", color: "#90c743", jeton: 5, deck: { x: 828, y: 501 } },
    { id: "analytics", name: "Данные и аналитика", color: "#0eb4e9", jeton: 9, deck: { x: 1046, y: 501 } },
    { id: "automation", name: "Автоматизация", color: "#245a94", jeton: 11, deck: { x: 1264, y: 501 } },
];

// Обложки и задания разделов сняты из боевого набора «Маяк ВУЗЫ» (по PDF на каждое направление).
// Рубашка стопки — обложка направления из набора; лицевые стороны — карты заданий.
const cover = (dir) => `/mayak-guide/cards-my/${DIRS[dir].id}-cover.png`;

// Клетка трека индекса: строка — направление, столбец — закрытая задача.
const STAR_X0 = 885.5;
const STAR_DX = 81.6;
const STAR_Y0 = 732;
const STAR_DY = 56.2;

function starPoint(dirIndex, column) {
    return { x: STAR_X0 + column * STAR_DX, y: STAR_Y0 + dirIndex * STAR_DY };
}

// План каждого такта: какое направление легло в каждую из девяти клеток.
// Сумма по всем тактам — ровно 6 задач на направление, 36 жетонов и 36 звёзд.
const PLANS = [
    [0, 3, 1, 4, 2, 5, 0, 1, 4],
    [2, 5, 0, 3, 1, 4, 3, 5, 2],
    [1, 4, 0, 2, 5, 3, 0, 1, 2],
    [5, 2, 3, 0, 4, 1, 4, 5, 3],
];

// Откуда «прилетают» стопки при раскладке — из-за правого нижнего угла поля.
const OFFSTAGE = { x: 1700, y: 120 };

// Куда уходят взятые карты — влево за планшет такта 3, в одну точку (рука команды).
const HAND = { x: -40, y: 850 };

// Описание фазы — единственное место, где рассказан ход такта. Раньше то же самое
// дублировалось списком «Ход такта» и блоком «Конец тренажёра» под плеером.
const PHASES = [
    {
        id: 0,
        label: "Раскладка и выкладка",
        text: "Разделы колоды ложатся на карточки направлений «ЗВЕЗДЫ», и одновременно команда выкладывает девять жетонов такта рубашкой вверх. План зафиксирован.",
        more: "До девяти задач такта команда выбирает из шести направлений «ЗВЕЗДЫ». Это общее решение, а не сумма личных предпочтений.",
    },
    {
        id: 1,
        label: "Разбор и выполнение",
        text: "На каждый выложенный жетон из его раздела уходит карта задания: участник забирает её, решает через МАЯК-ОКО и сдаёт инспектору соседней команды.",
        more: "Жетон и карту участники разбирают сами. Инспектор принимает работу или отклоняет с аргументом; молчание две минуты — принято.",
    },
    {
        id: 2,
        label: "Переворот",
        text: "Задание принято — жетон переворачивается цветной стороной вверх, на трек индекса встаёт звезда в это направление.",
    },
    {
        id: 3,
        label: "Итог",
        text: "Четыре такта по девять задач: 36 жетонов и 36 звёзд. Такт не начинается, пока предыдущий не закрыт целиком.",
        more: "Тренажёр заканчивается, как только одна из команд проходит все четыре такта и закрывает трек индекса. Остальные команды фиксируют результат на момент финиша.",
    },
];

// Каждая карта — отдельная сущность: шесть штук в каждом разделе, всего 36.
// Она живёт от раскладки до момента, когда её забирают со стола, поэтому анимация
// перелёта — это движение одного и того же элемента, а не появление нового.
const CARDS_PER_DECK = 6;
const CARDS = DIRS.flatMap((dir, dirIndex) =>
    Array.from({ length: CARDS_PER_DECK }, (_, idx) => ({ id: `${dir.id}-${idx}`, dir: dirIndex, idx }))
);

// Смещение карты внутри стопки: верхняя лежит ровно в пазу, нижние выглядывают из-под неё.
const SLOT_DX = 4;
const SLOT_DY = -4;
const SLOT_TILT = 1.1;

function buildScript() {
    const steps = [];
    // Накопленные состояния: жетоны на поле, звёзды и число разобранных карт по разделам.
    const tokens = [];
    const stars = DIRS.map(() => 0);
    const taken = DIRS.map(() => 0);

    PLANS.forEach((plan, tactIndex) => {
        const tact = TACTS[tactIndex];

        // Выкладка: девять жетонов рубашкой вверх. В первом такте одновременно с ними
        // на карточки направлений прилетают разделы колоды — это один такт действия.
        // order — очередь жетона в выкладке и в перевороте, отсюда берётся задержка анимации.
        const laid = plan.map((dir, cell) => ({
            id: `${tactIndex}-${cell}`,
            dir,
            order: cell,
            point: cellPoint(tact, cell),
            flipped: false,
        }));
        tokens.push(...laid);

        steps.push({
            phase: 0,
            caption:
                tactIndex === 0
                    ? `${tact.label}: разделы колоды ложатся на карточки направлений, и одновременно команда выкладывает девять жетонов такта рубашкой вверх.`
                    : `${tact.label}: команда выбрала девять задач и выложила жетоны направлений рубашкой вверх. План зафиксирован и больше не меняется.`,
            tokens: tokens.map((token) => ({ ...token })),
            stars: [...stars],
            taken: [...taken],
            delays: {},
            hold: 2600,
        });

        // Разбор: со стопки уходит конкретная верхняя карта — по одной на каждый жетон.
        // restack — момент, когда стопка этого раздела должна осесть: ровно тогда,
        // когда из неё забрали карту, иначе просадка стопки отстаёт от перелёта.
        const delays = {};
        const restack = {};
        laid.forEach((token) => {
            const card = `${DIRS[token.dir].id}-${taken[token.dir]}`;
            delays[card] = token.order * STAGGER;
            restack[token.dir] = token.order * STAGGER;
            taken[token.dir] += 1;
        });

        steps.push({
            phase: 1,
            caption: `${tact.label}: под каждый жетон из его раздела уходит карта задания. Участники решают их через МАЯК-ОКО и сдают инспектору соседней команды.`,
            tokens: tokens.map((token) => ({ ...token })),
            stars: [...stars],
            taken: [...taken],
            delays,
            restack,
            hold: 3000,
        });

        // Переворот: жетоны цветной стороной, звёзды на трек индекса.
        laid.forEach((token) => {
            token.flipped = true;
            stars[token.dir] += 1;
        });

        steps.push({
            phase: 2,
            caption: `${tact.label} закрыт: девять жетонов перевёрнуты цветной стороной, девять звёзд встали на трек индекса. Всего закрыто ${tokens.length} из 36.`,
            tokens: tokens.map((token) => ({ ...token })),
            stars: [...stars],
            taken: [...taken],
            delays: {},
            hold: 2400,
        });
    });

    steps.push({
        phase: 3,
        caption: "Все четыре такта пройдены: 36 карт разобраны, 36 жетонов перевёрнуты, трек индекса заполнен по всем шести направлениям.",
        tokens: tokens.map((token) => ({ ...token })),
        stars: [...stars],
        taken: [...taken],
        delays: {},
        hold: 3200,
    });

    return steps;
}

const pct = (value, total) => `${(value / total) * 100}%`;
// Токены движения (система Stripe/Linear: вход — ease-out, уход — ease-in, стаггер 40–90 мс).
const ENTER = { duration: 0.62, ease: [0.16, 1, 0.3, 1] };
const LEAVE = { duration: 0.86, ease: [0.4, 0, 1, 1] };
const STAGGER = 0.075;

// bare — режим «только поле»: боковая панель не рендерится, а состояние и управление
// уходят наружу через onPlayer. Нужен интерактивному столу /mayak-guide-live, где поле
// лежит в 3D-сцене и масштабируется камерой, а кнопки должны остаться в обычном масштабе.
export default function FieldPlayerMy({ bare = false, onPlayer }) {
    const script = useMemo(() => buildScript(), []);
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [started, setStarted] = useState(false);
    const [run, setRun] = useState(0);
    // системная настройка «уменьшить движение»: показываем состояния мгновенно, без перелётов
    const calm = useReducedMotion();
    const timerRef = useRef(null);

    // Отладочный режим: ?mystep=6 открывает конкретный шаг без анимации — для проверки раскладки скриншотом.
    const [frozen, setFrozen] = useState(false);

    const step = script[index];
    const enter = calm ? { duration: 0 } : ENTER;
    const leave = calm ? { duration: 0 } : LEAVE;
    const stagger = calm ? 0 : STAGGER;

    useEffect(() => {
        const raw = new URLSearchParams(window.location.search).get("mystep");
        if (raw === null) return;
        const target = Math.min(Math.max(Number(raw) || 0, 0), script.length - 1);
        setIndex(target);
        setStarted(true);
        setFrozen(true);
    }, [script.length]);

    useEffect(() => {
        if (!playing) return undefined;
        timerRef.current = window.setTimeout(() => {
            setIndex((current) => (current + 1 < script.length ? current + 1 : current));
            if (index + 1 >= script.length) setPlaying(false);
        }, step.hold);
        return () => window.clearTimeout(timerRef.current);
    }, [index, playing, script.length, step.hold]);

    // run растёт при каждом запуске и входит в ключи — иначе повтор не переигрывает анимации.
    const start = useCallback(() => {
        setIndex(0);
        setStarted(true);
        setPlaying(true);
        setRun((value) => value + 1);
    }, []);

    const jumpToPhase = useCallback(
        (phase) => {
            const target = script.findIndex((item) => item.phase === phase);
            if (target >= 0) {
                setIndex(target);
                setStarted(true);
                setPlaying(true);
                // возврат на раскладку — переигрываем прилёт стопок, иначе они уже лежат на местах
                if (phase === 0) setRun((value) => value + 1);
            }
        },
        [script]
    );

    const phaseSteps = script.filter((item) => item.phase === step.phase);
    const phasePosition = phaseSteps.indexOf(step) + 1;
    const closed = started ? step.stars.reduce((sum, value) => sum + value, 0) : 0;

    const idle = "Нажмите «Показать такты» — поле «МЫ» разложится само: разделы колоды, девять жетонов такта, перевороты и звёзды индекса.";

    useEffect(() => {
        if (!onPlayer) return;
        onPlayer({
            started,
            playing,
            phase: step.phase,
            phases: PHASES,
            phasePosition,
            phaseTotal: phaseSteps.length,
            progress: started ? (index + 1) / script.length : 0,
            caption: started ? step.caption : idle,
            counter: `${closed}/36 задач закрыто`,
            playLabel: !started ? "Показать такты" : playing ? "Пауза" : "Продолжить",
            api: { start, play: () => setPlaying(true), pause: () => setPlaying(false), jumpToPhase },
        });
    }, [onPlayer, started, playing, index, step, phasePosition, phaseSteps.length, script.length, closed, start, jumpToPhase, idle]);

    return (
        <div className={`player ${bare ? "bare" : ""}`}>
            <div className="stage">
                <img className="fieldimg" src="/mayak-guide/pole_my.png" alt="Поле МАЯК, сторона «МЫ»" />

                {/* Разделы колоды заданий прилетают на карточки своих направлений.
                    До старта их нет — иначе раскладка не читается как действие. */}
                {(started ? CARDS : []).map((card) => {
                    const dir = DIRS[card.dir];
                    // slot 0 — верх стопки; отрицательный slot значит карту уже забрали.
                    const slot = card.idx - step.taken[card.dir];
                    const gone = slot < 0;
                    // задержка есть только на том шаге, где карту реально берут со стола;
                    // на следующих шагах она уже «унесена» и не должна проигрывать полёт заново
                    const leaving = step.delays[card.id] !== undefined;
                    const delay = step.delays[card.id] ?? 0;
                    // оставшиеся карты оседают в тот же момент, когда верхнюю забирают
                    const settle = step.restack?.[card.dir];
                    const point = gone
                        ? HAND
                        : { x: dir.deck.x + slot * SLOT_DX, y: dir.deck.y + slot * SLOT_DY };
                    return (
                        <motion.span
                            key={`card-${card.id}-${run}`}
                            className="card"
                            style={{ zIndex: 2 + CARDS_PER_DECK - card.idx }}
                            initial={frozen ? false : { left: pct(OFFSTAGE.x, VB_W), top: pct(dir.deck.y, VB_H), opacity: 0 }}
                            animate={{ left: pct(point.x, VB_W), top: pct(point.y, VB_H), opacity: 1 }}
                            transition={
                                leaving
                                    ? { ...leave, delay }
                                    : { ...enter, duration: settle !== undefined ? 0.34 : enter.duration, delay: gone ? 0 : settle ?? card.dir * stagger * 3 }
                            }>
                            {/* карту приподнимают со стопки, ведут по дуге и уносят, уменьшая */}
                            <motion.img
                                src={cover(card.dir)}
                                alt={`Карта раздела «${dir.name}»`}
                                initial={frozen ? false : { scale: 1, opacity: 1, rotate: 0, y: 0 }}
                                animate={
                                    leaving
                                        ? { scale: [1, 1.07, 0.95, 0.34], opacity: [1, 1, 1, 0], rotate: [0, -3, -8, -16], y: [0, -16, -10, 6] }
                                        : gone
                                        ? { scale: 0.34, opacity: 0, rotate: -16, y: 6 }
                                        : { scale: 1, opacity: 1, rotate: slot * SLOT_TILT, y: 0 }
                                }
                                transition={
                                    leaving
                                        ? { duration: leave.duration, ease: "easeInOut", times: [0, 0.18, 0.45, 1], delay }
                                        : gone
                                        ? { duration: 0 }
                                        : { ...enter, duration: settle !== undefined ? 0.34 : enter.duration, delay: settle ?? 0 }
                                }
                            />
                        </motion.span>
                    );
                })}

                {/* Жетоны в клетках тактов: рубашкой вверх, после приёмки переворачиваются цветной стороной */}
                {step.tokens.map((token) => (
                    <motion.span
                        key={`token-${token.id}-${run}`}
                        className="token"
                        initial={frozen ? false : { left: pct(OFFSTAGE.x, VB_W), top: pct(OFFSTAGE.y, VB_H), opacity: 0 }}
                        animate={{ left: pct(token.point.x, VB_W), top: pct(token.point.y, VB_H), opacity: 1 }}
                        transition={{ ...enter, delay: token.order * stagger }}>
                        {/* настоящий переворот: обе стороны на одной плоскости, поворот по Y,
                            задержка по номеру клетки — жетоны переворачиваются по очереди */}
                        <motion.span
                            className="flip"
                            initial={frozen ? false : { rotateY: 0 }}
                            animate={{ rotateY: token.flipped ? 180 : 0 }}
                            transition={{ duration: calm ? 0 : 0.5, delay: token.flipped ? token.order * stagger * 2 : 0 }}>
                            <img className="back" src={`/mayak-guide/jeton_${DIRS[token.dir].jeton + 1}.png`} alt={DIRS[token.dir].name} />
                            <img className="front" src={`/mayak-guide/jeton_${DIRS[token.dir].jeton}.png`} alt="" />
                        </motion.span>
                    </motion.span>
                ))}

                {/* Трек индекса цифровой зрелости: звезда за каждую принятую задачу */}
                {step.stars.map((count, dirIndex) =>
                    Array.from({ length: count }, (_, column) => {
                        const point = starPoint(dirIndex, column);
                        return (
                            <motion.span
                                key={`star-${dirIndex}-${column}-${run}`}
                                className="star"
                                /* звезда прилетает из-за правого нижнего угла, как и всё остальное */
                                initial={frozen ? false : { left: pct(OFFSTAGE.x, VB_W), top: pct(OFFSTAGE.y, VB_H), opacity: 0 }}
                                animate={{ left: pct(point.x, VB_W), top: pct(point.y, VB_H), opacity: 1 }}
                                transition={{ ...enter, delay: (column % 3) * stagger * 2 }}>
                                {/* объём даёт градиент по диагонали, тёмная кромка и падающая тень;
                                    масштаб анимируем внутри, чтобы не затирать центрирование обёртки */}
                                <motion.svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    initial={frozen ? false : { scale: 0.5, rotate: -25 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ duration: calm ? 0 : 0.42, ease: [0.16, 1, 0.3, 1], delay: (column % 3) * stagger * 2 }}>
                                    <defs>
                                        <linearGradient id={`starface-${dirIndex}-${column}`} x1="0" y1="0" x2="1" y2="1">
                                            <stop offset="0%" stopColor="#ffdc7d" />
                                            <stop offset="45%" stopColor="#f2b02f" />
                                            <stop offset="100%" stopColor="#c9861b" />
                                        </linearGradient>
                                    </defs>
                                    <path
                                        fill={`url(#starface-${dirIndex}-${column})`}
                                        stroke="rgba(140, 88, 12, 0.55)"
                                        strokeWidth="0.6"
                                        strokeLinejoin="round"
                                        d="M12 2.4l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6-5.9-3.2-5.9 3.2 1.2-6.6L2.5 9.4l6.6-.9z"
                                    />
                                    {/* блик по верхнему левому лучу — грань, поймавшая свет */}
                                    <path fill="rgba(255, 255, 255, 0.45)" d="M12 2.4l2.9 6.1-2.9 1.5-2.9-1.5z" />
                                </motion.svg>
                            </motion.span>
                        );
                    })
                )}
            </div>

            {bare ? null : (
            <aside className="side">
                <button type="button" className={`play ${started && playing ? "is-playing" : ""}`} onClick={started && playing ? () => setPlaying(false) : started ? () => setPlaying(true) : start}>
                    <span className="ico" aria-hidden="true">
                        {started && playing ? "❚❚" : "▶"}
                    </span>
                    {!started ? "Показать такты" : playing ? "Пауза" : "Продолжить"}
                </button>

                <ol className="phases">
                    {PHASES.map((phase, order) => {
                        const isActive = started && step.phase === phase.id;
                        const isPassed = started && step.phase > phase.id;
                        const total = script.filter((item) => item.phase === phase.id).length;
                        return (
                            <li key={phase.id}>
                                <button type="button" className={`phase ${isActive ? "on" : ""} ${isPassed ? "passed" : ""}`} onClick={() => jumpToPhase(phase.id)}>
                                    <span className="num">{isPassed ? "✓" : String(order + 1).padStart(2, "0")}</span>
                                    <span className="txt">
                                        <b>
                                            {phase.label}
                                            {isActive && total > 1 ? <i>{`такт ${phasePosition} из ${total}`}</i> : null}
                                        </b>
                                        <span className="desc">{phase.text}</span>
                                        {isActive && phase.more ? <span className="more">{phase.more}</span> : null}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>

                <div className="bar">
                    <span className="fill" style={{ width: `${started ? ((index + 1) / script.length) * 100 : 0}%` }} />
                </div>

                <p className="counter">
                    <b>{closed}</b>/36 задач закрыто
                </p>

                <p className="caption">{started ? step.caption : "Нажмите «Показать такты» — поле «МЫ» разложится само: разделы колоды, девять жетонов такта, перевороты и звёзды индекса."}</p>

                <button type="button" className="reset" onClick={start}>
                    Начать сначала
                </button>
            </aside>
            )}

            <style jsx>{`
                .player {
                    display: grid;
                    /* как в плеере «Я»: поле своего размера, остаток ширины — колонке */
                    grid-template-columns: minmax(0, 894px) minmax(360px, 1fr);
                    gap: 26px;
                    align-items: stretch;
                }
                .player.bare {
                    display: block;
                }
                .stage {
                    position: relative;
                    width: 100%;
                    aspect-ratio: ${VB_W} / ${VB_H};
                    border: 1px solid #e3eaef;
                    border-radius: 18px;
                    background: #000;
                    overflow: hidden;
                }
                .fieldimg {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    display: block;
                }
                .player :global(.card),
                .player :global(.token),
                .player :global(.star) {
                    /* глобальный стиль страницы вешает на span белую рамку 1.33px — снимаем */
                    border: 0;
                }
                .player :global(.card) {
                    position: absolute;
                    display: block;
                    /* 206 из 1400 — ровно ширина паза направления на поле */
                    width: 14.7%;
                    transform: translate(-50%, -50%);
                }
                .player :global(.card img) {
                    width: 100%;
                    display: block;
                    border-radius: 8px;
                    /* слоистая нейтральная тень: шесть слоёв с растущим радиусом
                       дают мягкую глубину вместо одного жёсткого пятна */
                    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06), 0 1px 1px -0.5px rgba(0, 0, 0, 0.06), 0 3px 3px -1.5px rgba(0, 0, 0, 0.06),
                        0 6px 6px -3px rgba(0, 0, 0, 0.06), 0 12px 12px -6px rgba(0, 0, 0, 0.06), 0 24px 24px -12px rgba(0, 0, 0, 0.06);
                }
                /* Фишка — квадратик размером с клетку такта, слегка скруглённый.
                   Рубашка и цветная сторона одного размера. */
                .player :global(.token) {
                    position: absolute;
                    width: 6.1%;
                    transform: translate(-50%, -50%);
                    z-index: 3;
                    filter: drop-shadow(2px 3px 4px rgba(0, 0, 0, 0.3));
                }
                .player :global(.token) {
                    perspective: 600px;
                }
                .player :global(.token .flip) {
                    position: relative;
                    display: block;
                    transform-style: preserve-3d;
                }
                .player :global(.token img) {
                    width: 100%;
                    aspect-ratio: 1;
                    display: block;
                    border-radius: 12%;
                    object-fit: cover;
                    backface-visibility: hidden;
                }
                .player :global(.token .front) {
                    position: absolute;
                    inset: 0;
                    transform: rotateY(180deg);
                }
                .player :global(.star) {
                    position: absolute;
                    width: 3%;
                    transform: translate(-50%, -50%);
                    z-index: 5;
                }
                .player :global(.star svg) {
                    width: 100%;
                    display: block;
                    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.28));
                }
                .side {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    height: 100%;
                }
                .play {
                    font: inherit;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    font-size: 14.5px;
                    font-weight: 700;
                    padding: 13px 16px;
                    border-radius: 12px;
                    border: 1px solid #1f9254;
                    background: #22a45d;
                    color: #fff;
                    cursor: pointer;
                    transition: background 0.18s ease, transform 0.18s ease;
                }
                .play:hover {
                    background: #1f9254;
                    transform: translateY(-1px);
                }
                .play.is-playing {
                    background: #fff;
                    color: #152022;
                    border-color: #cbd6de;
                }
                .play .ico {
                    font-size: 12px;
                    line-height: 1;
                }
                .phases {
                    list-style: none;
                    margin: 4px 0 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    flex: 1;
                    justify-content: space-between;
                }
                .phase {
                    font: inherit;
                    width: 100%;
                    display: flex;
                    align-items: flex-start;
                    justify-content: flex-start;
                    gap: 12px;
                    text-align: left;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid transparent;
                    background: transparent;
                    color: #64748b;
                    cursor: pointer;
                    transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
                }
                .phase:hover {
                    background: #f5f8fa;
                    color: #152022;
                }
                .phase .num {
                    flex: 0 0 auto;
                    margin-top: 1px;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    font-size: 11px;
                    font-weight: 700;
                    border: 1px solid #cbd6de;
                    color: #64748b;
                    font-variant-numeric: tabular-nums;
                }
                .phase .txt {
                    display: flex;
                    flex-direction: column;
                    line-height: 1.25;
                }
                .phase .txt b {
                    display: flex;
                    align-items: baseline;
                    gap: 8px;
                    font-size: 14.5px;
                    font-weight: 700;
                }
                .phase .txt i {
                    font-style: normal;
                    font-size: 11.5px;
                    font-weight: 600;
                    color: #c9503f;
                }
                .phase .desc {
                    display: block;
                    margin-top: 4px;
                    font-size: 12.8px;
                    line-height: 1.4;
                    color: #7c8a94;
                }
                .phase.on .desc {
                    color: #46565f;
                }
                /* подробность — только у активной фазы, иначе колонка становится стеной */
                .phase .more {
                    display: block;
                    margin-top: 8px;
                    padding-top: 8px;
                    border-top: 1px solid #f0c7c0;
                    font-size: 12.8px;
                    line-height: 1.45;
                    color: #46565f;
                }
                .phase.on {
                    background: #fdf1ef;
                    border-color: #f0c7c0;
                    color: #152022;
                }
                .phase.on .num {
                    background: #c9503f;
                    border-color: #c9503f;
                    color: #fff;
                }
                .phase.passed {
                    color: #46565f;
                }
                .phase.passed .num {
                    background: #eef4f0;
                    border-color: #cfe3d6;
                    color: #22a45d;
                }
                .reset {
                    font: inherit;
                    font-size: 13.5px;
                    font-weight: 600;
                    padding: 10px 16px;
                    border-radius: 10px;
                    border: 1px solid #cbd6de;
                    background: #fff;
                    color: #152022;
                    cursor: pointer;
                }
                .reset:disabled {
                    opacity: 0.45;
                    cursor: default;
                }
                .bar {
                    height: 3px;
                    border-radius: 999px;
                    background: #e3eaef;
                    overflow: hidden;
                }
                .fill {
                    display: block;
                    height: 100%;
                    background: #c9503f;
                    transition: width 0.35s ease;
                }
                .counter {
                    margin: 0;
                    font-size: 13px;
                    color: #46565f;
                    font-variant-numeric: tabular-nums;
                }
                .counter b {
                    font-size: 16px;
                    color: #152022;
                }
                .caption {
                    margin: 0;
                    font-size: 13.5px;
                    line-height: 1.45;
                    color: #46565f;
                    min-height: 76px;
                }
                @media (max-width: 900px) {
                    .player {
                        grid-template-columns: 1fr;
                    }
                    .side {
                        position: static;
                    }
                }
                @media (prefers-reduced-motion: reduce) {
                    .fill {
                        transition: none;
                    }
                }
            `}</style>
        </div>
    );
}
