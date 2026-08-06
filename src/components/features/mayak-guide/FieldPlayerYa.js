"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

// Автоплеер раскладки этапа «Я».
// Координаты гексов сняты из векторного исходника поля (Поле я.pdf) и заданы в системе
// экспортированного SVG: viewBox 0 0 1984 1559. Поэтому стопки и миплы попадают точно в ячейки.
//
// Модель поля:
//   центр СТАРТ            — миплы начинают отсюда; стопка «Старт» лежит в правом верхнем углу поля;
//   внутреннее кольцо (4)   — стартовые задания, команда идёт по нему группой;
//   кольцо секторов (6)     — по одному заданию в каждом типе контента, тоже группой;
//   лучи (3 гекса на тип)   — индивидуальные задания специализации;
//   крупный гекс с иконкой  — сюда кладётся стопка карт этого типа.

const VB_W = 1984;
const VB_H = 1559;

const CENTER = { x: 1186, y: 782 };

// Порядок обхода внутреннего кольца: по часовой стрелке — вправо, вниз, влево, вверх.
// Из верхней ячейки команда выходит на кольцо типов контента.
const INNER = [
    { x: 1293, y: 782 },
    { x: 1186, y: 889 },
    { x: 1079, y: 782 },
    { x: 1186, y: 675 },
];

const TYPES = [
    { id: "text", name: "Текст", sector: { x: 1185, y: 515 }, deck: { x: 1465, y: 309 }, ray: [{ x: 1186, y: 379 }, { x: 1186, y: 251 }, { x: 1186, y: 124 }] },
    { id: "audio", name: "Аудио", sector: { x: 1413, y: 635 }, deck: { x: 1732, y: 782 }, ray: [{ x: 1535, y: 580 }, { x: 1646, y: 517 }, { x: 1756, y: 453 }] },
    { id: "image", name: "Изображение", sector: { x: 1413, y: 927 }, deck: { x: 1454, y: 1250 }, ray: [{ x: 1535, y: 983 }, { x: 1646, y: 1047 }, { x: 1756, y: 1111 }] },
    { id: "interactive", name: "Интерактив", sector: { x: 1187, y: 1049 }, deck: { x: 911, y: 1256 }, ray: [{ x: 1186, y: 1185 }, { x: 1186, y: 1312 }, { x: 1186, y: 1440 }] },
    { id: "data", name: "Данные", sector: { x: 960, y: 928 }, deck: { x: 640, y: 782 }, ray: [{ x: 837, y: 983 }, { x: 727, y: 1047 }, { x: 617, y: 1111 }] },
    { id: "video", name: "Видео", sector: { x: 959, y: 637 }, deck: { x: 914, y: 309 }, ray: [{ x: 837, y: 580 }, { x: 727, y: 517 }, { x: 617, y: 453 }] },
];

// Стопка раздела «Старт» лежит в верхнем правом углу поля, как на столе.
const START_DECK = { x: 1836, y: 196 };
// Стопка «Старт» мельче колод типов контента — она лежит на краю стола, а не в пазу.
const START_SCALE = 0.95;
// Откуда «прилетают» стопки при раскладке — из-за правого края поля.
const OFFSTAGE = { x: 2350, y: 170 };

const MEEPLES = ["#2f6fd0", "#c9503f", "#1d2126", "#e2a03f", "#6aa838", "#eef1f4"];

// Шесть фишек в ячейке: сетка 3×2 компактнее кольца и не вылезает
// на соседние гексы — на внутреннем круге фишки иначе заходили на СТАРТ.
function cluster(point, index, total = 6, spread = 1) {
    const column = index % 3;
    const row = Math.floor(index / 3);
    return {
        x: point.x + (column - 1) * 30 * spread,
        y: point.y + (row - 0.5) * 34 * spread,
    };
}

// Сдвиг от центра поля наружу: стопка лежит рядом со своим гексом, не закрывая его.
function outward(point, distance) {
    const dx = point.x - CENTER.x;
    const dy = point.y - CENTER.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: point.x + (dx / length) * distance, y: point.y + (dy / length) * distance };
}

// Выданная карта кладётся рядом с ячейкой, чтобы её не перекрывали миплы.
function beside(point, distance = 96) {
    return outward(point, distance);
}

// Каждая карта — отдельная сущность: 4 в стопке «Старт» (по числу ячеек внутреннего круга)
// и по 4 в каждом типе (1 на кольце + 3 по лучу). Верхняя карта типа — с цифрой «1»,
// нижние лежат обычной рубашкой без номера.
const CARDS_PER_DECK = 4;
const CARDS = [
    ...Array.from({ length: CARDS_PER_DECK }, (_, idx) => ({
        id: `start-${idx}`,
        deck: "start",
        idx,
        img: `/mayak-guide/cards-ya/start-${idx + 1}.png`,
    })),
    ...TYPES.flatMap((type) =>
        Array.from({ length: CARDS_PER_DECK }, (_, idx) => ({
            id: `${type.id}-${idx}`,
            deck: type.id,
            idx,
            img: idx === 0 ? `/mayak-guide/cards/${type.id}.png?v=2` : `/mayak-guide/cards-ya/${type.id}-back.png`,
        }))
    ),
];

// Смещение карты внутри стопки и точка, куда участники уносят взятые карты.
const SLOT_DX = 4;
const SLOT_DY = -4;
const HAND = { x: 1900, y: 1470 };

const emptyTaken = () => ({ start: 0, ...Object.fromEntries(TYPES.map((type) => [type.id, 0])) });

function buildScript() {
    const steps = [];
    const taken = emptyTaken();

    steps.push({
        phase: 0,
        caption: "Стопки карт ложатся на свои гексы: шесть колод по типам контента и стопка раздела «Старт» в верхнем правом углу. Миплы встают на СТАРТ.",
        meeples: MEEPLES.map((_, i) => cluster(CENTER, i)),
        taken: { ...taken },
        delays: {},
        restack: {},
        hold: 2200,
    });

    INNER.forEach((cell, index) => {
        steps.push({
            phase: 1,
            caption: `Внутренний круг, стартовое задание ${index + 1} из 4. Карта берётся из стопки «Старт», команда решает её вместе и двигается дальше по кольцу.`,
            meeples: MEEPLES.map((_, i) => cluster(cell, i, 6, 0.86)),
            taken: { ...taken, start: (taken.start += 1) },
            delays: { [`start-${index}`]: 0 },
            restack: { start: 0 },
            hold: 1500,
        });
    });

    // Внешний круг: команда встаёт на одиночный гекс типа и получает оттуда первую карту.
    // Это задание №1 из четырёх — дальше три задания по лучу.
    TYPES.forEach((type) => {
        steps.push({
            phase: 2,
            caption: `Внешний круг, ${type.name.toLowerCase()}: команда идёт по ячейке кольца и берёт первую карту этого типа — задание 1 из 4.`,
            meeples: MEEPLES.map((_, i) => cluster(type.sector, i, 6, 0.95)),
            taken: { ...taken, [type.id]: (taken[type.id] += 1) },
            delays: { [`${type.id}-0`]: 0 },
            restack: { [type.id]: 0 },
            hold: 1400,
        });
    });

    steps.push({
        phase: 3,
        caption: "Выбор специализации: участники расходятся, каждый встаёт на сектор своего типа контента.",
        meeples: TYPES.map((type) => type.sector),
        taken: { ...taken },
        delays: {},
        restack: {},
        hold: 1700,
    });

    for (let level = 0; level < 3; level += 1) {
        steps.push({
            phase: 3,
            caption: `Задание ${level + 2} из 4: мипл делает шаг по лучу и берёт следующую карту своего типа.`,
            meeples: TYPES.map((type) => type.ray[level]),
            taken: TYPES.reduce((acc, type) => ({ ...acc, [type.id]: (taken[type.id] += 1) }), { ...taken }),
            delays: Object.fromEntries(TYPES.map((type, order) => [`${type.id}-${level + 1}`, order * 0.08])),
            restack: Object.fromEntries(TYPES.map((type, order) => [type.id, order * 0.08])),
            hold: 1700,
        });
    }

    steps.push({
        phase: 4,
        caption: "Одиночный гекс дал первую карту, луч — ещё три. Четыре выполненных задания. Участник приносит команде красную Звезду-Джокер.",
        meeples: TYPES.map((type) => type.ray[2]),
        taken: { ...taken },
        delays: {},
        restack: {},
        hold: 3000,
    });

    return steps;
}

const PHASES = [
    { id: 0, label: "Раскладка", text: "Стопка «Старт» ложится в верхний правый угол поля, шесть колод по типам контента — на свои гексы. Миплы встают на центральный гекс СТАРТ." },
    { id: 1, label: "Внутренний круг", text: "Четыре ячейки вокруг центра. Команда идёт по часовой стрелке — вправо, вниз, влево, вверх — и решает стартовые задания вместе. Из верхней ячейки выходит на кольцо типов." },
    { id: 2, label: "Внешний круг", text: "Команда обходит шесть ячеек кольца — по одной на каждый тип контента. На каждой берёт первую карту типа: это задание 1 из 4." },
    { id: 3, label: "Специализация", text: "Участники расходятся по своим типам. Каждый идёт по лучу наружу: ещё три задания, три гекса — задания 2, 3 и 4." },
    { id: 4, label: "Итог", text: "Первая карта — на одиночном гексе внешнего круга, ещё три — по лучу. Итого четыре задания. Участник приносит команде красную Звезду-Джокер." },
];

// Наклон стопки: верх карты смотрит от центра поля наружу — карта развёрнута
// к игроку, который сидит с этой стороны стола.
function deckTilt(point) {
    const raw = (Math.atan2(point.y - CENTER.y, point.x - CENTER.x) * 180) / Math.PI + 90;
    // приводим к диапазону -180..180. Карту на 180° не «складываем»: у неё есть верх
    // с названием, и нижние стопки (Интерактив, Изображение) должны читаться снаружи поля.
    return ((raw + 540) % 360) - 180;
}

// Стопка ложится точно в свой паз — на крупный гекс с иконкой типа контента.
const DECKS = [
    { id: "start", point: START_DECK, img: "start", rot: 0, scale: START_SCALE },
    ...TYPES.map((type) => ({ id: type.id, point: type.deck, img: type.id, rot: deckTilt(type.deck) })),
];

const DECK_BY_ID = DECKS.reduce((acc, deck, order) => ({ ...acc, [deck.id]: { ...deck, order } }), {});

const pct = (value, total) => `${(value / total) * 100}%`;
const MOVE = { duration: 0.95, ease: [0.33, 0, 0.2, 1] };

// bare / onPlayer — см. FieldPlayerMy: режим «только поле» для интерактивного стола,
// где поле лежит в 3D-сцене, а кнопки живут в немасштабируемом слое.
export default function FieldPlayerYa({ bare = false, onPlayer }) {
    const script = useMemo(() => buildScript(), []);
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [started, setStarted] = useState(false);
    // run растёт при каждом запуске и входит в ключи — иначе повтор не переигрывает анимации.
    const [run, setRun] = useState(0);
    const timerRef = useRef(null);

    // Отладочный режим: /mayak-guide?step=6 открывает конкретный шаг без анимации.
    // Нужен, чтобы проверять раскладку скриншотом — headless-браузер анимацию не проигрывает.
    const [frozen, setFrozen] = useState(false);

    const step = script[index];

    useEffect(() => {
        const raw = new URLSearchParams(window.location.search).get("step");
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

    const start = useCallback(() => {
        setIndex(0);
        setStarted(true);
        setPlaying(true);
        setRun((value) => value + 1);
    }, []);

    const restart = useCallback(() => {
        setIndex(0);
        setPlaying(false);
        setStarted(false);
    }, []);

    const jumpToPhase = useCallback(
        (phase) => {
            const target = script.findIndex((item) => item.phase === phase);
            if (target >= 0) {
                setIndex(target);
                setStarted(true);
                setPlaying(true);
                // возврат на раскладку — переигрываем прилёт карт
                if (phase === 0) setRun((value) => value + 1);
            }
        },
        [script]
    );

    const finished = index === script.length - 1 && !playing && started;
    // Номер шага внутри своей фазы — чтобы в списке справа было видно «3 из 4».
    const phaseSteps = script.filter((item) => item.phase === step.phase);
    const phasePosition = phaseSteps.indexOf(step) + 1;

    const idle = "Нажмите «Показать раскладку» — поле разложится само: стопки карт, стартовые задания, внешний круг и лучи специализации.";

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
            counter: finished ? "раскладка пройдена" : "",
            playLabel: !started ? "Показать раскладку" : playing ? "Пауза" : "Продолжить",
            api: { start, play: () => setPlaying(true), pause: () => setPlaying(false), jumpToPhase },
        });
    }, [onPlayer, started, playing, index, step, phasePosition, phaseSteps.length, script.length, finished, start, jumpToPhase, idle]);

    return (
        <div className={`player ${bare ? "bare" : ""}`}>
            <div className="stage">
                <img className="fieldimg" src="/mayak-guide/field-ya.svg" alt="Поле МАЯК, сторона «Я»" />

                {/* Карты как реальные предметы: лежат в стопке, при взятии улетают со стола,
                    и стопка оседает в тот же момент. Стопка «Старт» после внутреннего круга
                    исчезает целиком — её четыре карты разобраны. */}
                {(started ? CARDS : []).map((card) => {
                    const deck = DECK_BY_ID[card.deck];
                    const slot = card.idx - step.taken[card.deck];
                    const gone = slot < 0;
                    const leaving = step.delays[card.id] !== undefined;
                    const delay = step.delays[card.id] ?? 0;
                    const settle = step.restack?.[card.deck];
                    const point = gone
                        ? HAND
                        : { x: deck.point.x + slot * SLOT_DX, y: deck.point.y + slot * SLOT_DY };
                    return (
                        <motion.span
                            key={`card-${card.id}-${run}`}
                            className="deck"
                            style={{
                                transform: `translate(-50%, -50%) rotate(${deck.rot}deg) scale(${deck.scale ?? 1})`,
                                zIndex: 2 + CARDS_PER_DECK - card.idx,
                            }}
                            initial={frozen ? false : { left: pct(OFFSTAGE.x, VB_W), top: pct(OFFSTAGE.y, VB_H), opacity: 0 }}
                            animate={{ left: pct(point.x, VB_W), top: pct(point.y, VB_H), opacity: 1 }}
                            transition={
                                leaving
                                    ? { ...MOVE, delay }
                                    : { ...MOVE, duration: settle !== undefined ? 0.34 : MOVE.duration, delay: gone ? 0 : settle ?? deck.order * 0.12 }
                            }>
                            <motion.img
                                src={card.img}
                                alt=""
                                initial={frozen ? false : { scale: 1, opacity: 1, rotate: 0, y: 0 }}
                                animate={
                                    leaving
                                        ? { scale: [1, 1.07, 0.95, 0.34], opacity: [1, 1, 1, 0], rotate: [0, -3, -8, -16], y: [0, -16, -10, 6] }
                                        : gone
                                        ? { scale: 0.34, opacity: 0, rotate: -16, y: 6 }
                                        : { scale: 1, opacity: 1, rotate: 0, y: 0 }
                                }
                                transition={
                                    leaving
                                        ? { duration: MOVE.duration, ease: "easeInOut", times: [0, 0.18, 0.45, 1], delay }
                                        : gone
                                        ? { duration: 0 }
                                        : { ...MOVE, duration: settle !== undefined ? 0.34 : MOVE.duration, delay: settle ?? 0 }
                                }
                            />
                        </motion.span>
                    );
                })}

                {step.meeples.map((point, i) => (
                    <motion.span
                        key={`meeple-${i}-${frozen ? index : "live"}`}
                        className="meeple"
                        style={{ color: MEEPLES[i] }}
                        initial={frozen ? false : { left: pct(CENTER.x, VB_W), top: pct(CENTER.y, VB_H), opacity: 0 }}
                        animate={{ left: pct(point.x, VB_W), top: pct(point.y, VB_H), opacity: 1 }}
                        transition={MOVE}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                fill="currentColor"
                                stroke="rgba(16,24,32,.5)"
                                strokeWidth="1"
                                d="M12 2c1.9 0 3.4 1.5 3.4 3.4 0 .9-.3 1.7-.9 2.3 2.6 1 4.4 3.2 4.4 5.8 0 .7-.6 1.2-1.3 1.2-1.4 0-2.6-.5-3.4-1.3l1.2 7.4c.1.7-.4 1.2-1 1.2H9.6c-.7 0-1.2-.6-1-1.2l1.2-7.4c-.9.8-2 1.3-3.4 1.3-.7 0-1.3-.5-1.3-1.2 0-2.6 1.8-4.8 4.4-5.8-.6-.6-.9-1.4-.9-2.3C8.6 3.5 10.1 2 12 2z"
                            />
                        </svg>
                    </motion.span>
                ))}
            </div>

            {bare ? null : (
            <aside className="side">
                <button type="button" className={`play ${started && playing ? "is-playing" : ""}`} onClick={started && playing ? () => setPlaying(false) : started ? () => setPlaying(true) : start}>
                    <span className="ico" aria-hidden="true">
                        {started && playing ? "❚❚" : "▶"}
                    </span>
                    {!started ? "Показать раскладку" : playing ? "Пауза" : "Продолжить"}
                </button>

                <ol className="phases">
                    {PHASES.map((phase, order) => {
                        const isActive = started && step.phase === phase.id;
                        const isPassed = started && step.phase > phase.id;
                        const total = script.filter((item) => item.phase === phase.id).length;
                        return (
                            <li key={phase.id}>
                                <button
                                    type="button"
                                    className={`phase ${isActive ? "on" : ""} ${isPassed ? "passed" : ""}`}
                                    onClick={() => jumpToPhase(phase.id)}>
                                    <span className="num">{isPassed ? "✓" : String(order + 1).padStart(2, "0")}</span>
                                    <span className="txt">
                                        <b>
                                            {phase.label}
                                            {isActive && total > 1 ? <i>{`шаг ${phasePosition} из ${total}`}</i> : null}
                                        </b>
                                        <span className="desc">{phase.text}</span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>

                <div className="bar">
                    <span className="fill" style={{ width: `${started ? ((index + 1) / script.length) * 100 : 0}%` }} />
                </div>

                <p className="caption">{started ? step.caption : "Нажмите «Показать раскладку» — поле разложится само: стопки карт, стартовые задания, внешний круг и лучи специализации."}</p>

                <button type="button" className="reset" onClick={restart} disabled={!started}>
                    {finished ? "Показать заново" : "В начало"}
                </button>
            </aside>
            )}

            <style jsx>{`
                .player {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) 360px;
                    gap: 26px;
                    align-items: start;
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
                .player :global(.deck),
                .player :global(.card),
                .player :global(.meeple) {
                    /* глобальный стиль страницы вешает на span белую рамку 1.33px — снимаем */
                    border: 0;
                }
                .player :global(.deck) {
                    position: absolute;
                    display: block;
                    width: 13.4%;
                    transform: translate(-50%, -50%);
                    z-index: 2;
                    /* тень на всей стопке, а не на каждом слое — подложка выглядит цельной */
                    filter: drop-shadow(3px 5px 7px rgba(0, 0, 0, 0.32));
                }
                .player :global(.deck img) {
                    position: relative;
                    z-index: 1;
                    width: 100%;
                    display: block;
                    border-radius: 10px;
                }
                .player :global(.card) {
                    position: absolute;
                    width: 9%;
                    transform: translate(-50%, -50%);
                    z-index: 4;
                }
                .player :global(.card img) {
                    width: 100%;
                    display: block;
                    background: #fff;
                    border-radius: 7px;
                    box-shadow: 3px 5px 7px rgba(0, 0, 0, 0.32);
                }
                .player :global(.meeple) {
                    position: absolute;
                    width: 3.1%;
                    transform: translate(-50%, -62%);
                    z-index: 5;
                    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
                }
                .player :global(.meeple svg) {
                    width: 100%;
                    display: block;
                }
                .side {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    position: sticky;
                    top: 24px;
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
