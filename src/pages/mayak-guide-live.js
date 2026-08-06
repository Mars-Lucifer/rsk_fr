"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import FieldPlayerYa from "@/components/features/mayak-guide/FieldPlayerYa";
import FieldPlayerMy from "@/components/features/mayak-guide/FieldPlayerMy";
import CardAnatomy3D from "@/components/features/mayak-guide/CardAnatomy3D";

// Интерактивный дубль руководства мастера: камера висит над столом, предметы лежат
// на нём как в реальной партии. Наведение поднимает предмет, клик — подводит камеру
// и открывает разбор. Старая страница /mayak-guide не тронута.
//
// Камера — это transform самого стола, а не отдельная сущность:
//   обзор  — rotateX(TILT), scale 1;
//   разбор — rotateX(0), scale k, стол сдвинут так, чтобы предмет встал в центр.
// Сдвиг считается в процентах от НЕмасштабированной ширины стола, поэтому
// translate(...) scale(k) даёт ровно центрирование: смещение точки от центра
// после масштаба равно (x - 50) * k процентов.

const A = "/mayak-guide";

const TILT = 52; // наклон стола в обзоре: «камера над столом», но предметы ещё читаемы

const ROLES = [
    { img: "role_kapitan.jpg", nm: "Капитан", vice: "формирует требовательность", ln: "Постоянно: внутренний гарант дисциплины и выполнения ролевых функций." },
    { img: "role_mediator.jpg", nm: "Медиатор", vice: "противоядие от недоверия", ln: "Постоянно: создаёт безопасную атмосферу диалога, вовлекает «тихих»." },
    { img: "role_inspector.jpg", nm: "Инспектор", vice: "борется с безответственностью", ln: "Активно: выносит вердикт с аргументацией. Молчание две минуты — задание принято." },
    { img: "role_hranitel.jpg", nm: "Хранитель Маяка", vice: "противостоит боязни конфликта", ln: "Постоянно: держит темп и энергию, не даёт «огню» погаснуть." },
    { img: "role_engineer.jpg", nm: "Инженер", vice: "убирает технический барьер", ln: "Постоянно: следит за доступностью инструментов, решает технические вопросы." },
    { img: "role_letopisec.jpg", nm: "Летописец", vice: "лечит безразличие к результату", ln: "Постоянно: снимает фото и видео прорывов, эмоций, командной работы." },
];

const PINS = {
    back: [
        { x: 14, y: 9, t: "Идентификатор этапа", d: "Метка «Я» или «МЫ» в овале." },
        { x: 86, y: 9, t: "Номер", d: "Порядковый номер задания внутри раздела." },
        { x: 50, y: 21, t: "Название раздела", d: "Тип контента на этапе «Я» или направление «ЗВЕЗДЫ» на этапе «МЫ»." },
        { x: 50, y: 50, t: "Цветной гекс с иконкой", d: "По нему карта опознаётся, не переворачивая." },
    ],
    face: [
        { x: 11, y: 6, t: "Знак вопроса", d: "Есть дополнительные материалы. Нет знака — задание выполняется без них." },
        { x: 51, y: 6, t: "Раздел колоды", d: "К какому разделу относится задание." },
        { x: 87, y: 6, t: "Номер карты", d: "Ключ к дополнительным материалам в тренажёре." },
        { x: 50, y: 13, t: "Название задания", d: "Короткий заголовок-крючок." },
        { x: 50, y: 24, t: "История", d: "Контекст-ситуация, в которую попадает участник." },
        { x: 50, y: 91, t: "Задание", d: "Что конкретно нужно сделать и какой результат сдать." },
    ],
};

// Предметы на столе. x/y — центр предмета в процентах от стола, w — ширина в процентах.
// k — во сколько раз камера приближается, когда предмет берут в разбор.
// Поле одно и оно двустороннее: «МЫ» и «Я» — это две стороны одного планшета,
// поэтому на столе лежит один предмет, который переворачивается, а не два.
const FACES = {
    my: {
        nm: "Поле «МЫ»",
        sub: "Командная сторона",
        img: `${A}/pole_my.png`,
        flip: "Перевернуть на «Я»",
    },
    ya: {
        nm: "Поле «Я»",
        sub: "Личная сторона",
        img: `${A}/pole_ya.png`,
        flip: "Перевернуть на «МЫ»",
    },
};

const ZONES = [
    {
        id: "field",
        nm: "Игровое поле",
        sub: "Двустороннее",
        lede: "Одна сторона — командный этап «МЫ», другая — личный этап «Я». Поле переворачивается, а не меняется.",
        x: 40,
        y: 46,
        w: 54,
        k: 1.32,
        left: 11, // уводим кадр влево: справа стоит пульт управления полем
    },
    {
        // Колода лежит справа вверху — ровно там, откуда плееры выводят карты на поле
        // (OFFSTAGE в FieldPlayerMy/FieldPlayerYa). Карта уходит из этой стопки, а не из-за края.
        id: "card",
        nm: "Колода заданий",
        sub: "Анатомия карты",
        lede: "Все карты собраны одинаково. Разберите одну — дальше участники читают любую сами.",
        img: `${A}/card_back2.png`,
        x: 79,
        y: 20,
        w: 9,
        k: 3.2,
        left: 10,
    },
    {
        id: "roles",
        nm: "Карты ролей",
        sub: "Шесть функций команды",
        lede: "Роль — не должность, а функция, без которой команда буксует. Каждая закрывает одну типовую болезнь.",
        x: 84,
        y: 62,
        w: 17,
        k: 3.4,
        left: 13,
    },
];

// Запас жетонов направлений — кучкой у нижнего края стола, рядом с полем.
// Это реквизит: кликов не ловит, только показывает, что жетоны лежат на столе.
const SCATTER = [
    { n: 1, x: 30, y: 90, r: -14 },
    { n: 4, x: 35, y: 93, r: 22 },
    { n: 9, x: 40, y: 89, r: 8 },
    { n: 11, x: 45, y: 93, r: -26 },
    { n: 6, x: 50, y: 89, r: 12 },
    { n: 3, x: 55, y: 93, r: -8 },
    { n: 5, x: 33, y: 96, r: 17 },
    { n: 7, x: 43, y: 97, r: -19 },
    { n: 12, x: 53, y: 96, r: 6 },
];

// Запас звёзд индекса — тем же реквизитом, рядом с жетонами.
const STARS = [
    { x: 62, y: 90, r: -12, s: 1 },
    { x: 66, y: 94, r: 14, s: 0.86 },
    { x: 70, y: 89, r: -6, s: 0.94 },
    { x: 73, y: 94, r: 22, s: 0.8 },
    { x: 77, y: 91, r: -18, s: 0.9 },
];

// Звезда индекса — тот же силуэт, что плеер ставит на трек поля.
function TableStar({ id }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <defs>
                <linearGradient id={`tablestar-${id}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffdc7d" />
                    <stop offset="45%" stopColor="#f2b02f" />
                    <stop offset="100%" stopColor="#c9861b" />
                </linearGradient>
            </defs>
            <path
                fill={`url(#tablestar-${id})`}
                stroke="rgba(140, 88, 12, 0.55)"
                strokeWidth="0.6"
                strokeLinejoin="round"
                d="M12 2.4l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6-5.9-3.2-5.9 3.2 1.2-6.6L2.5 9.4l6.6-.9z"
            />
            <path fill="rgba(255, 255, 255, 0.45)" d="M12 2.4l2.9 6.1-2.9 1.5-2.9-1.5z" />
        </svg>
    );
}

// Узкий экран: пульт уезжает под стол, поэтому кадр смещается не влево, а вверх.
const NARROW = "(max-width: 900px)";
const subscribeNarrow = (notify) => {
    const mq = window.matchMedia(NARROW);
    mq.addEventListener("change", notify);
    return () => mq.removeEventListener("change", notify);
};

const EASE = [0.16, 1, 0.3, 1];
// Переворот доски — движение «туда и обратно», поэтому ease-in-out, а не ease-out.
const SOFT = [0.65, 0, 0.35, 1];
const FLIP_MS = 900;
// Доска отрывается от стола быстрее, чем ложится обратно: подъём — усилие, укладка — вес.
const FLIP_TIMES = [0, 0.26, 0.7, 1];

export default function MayakGuideLivePage() {
    const [active, setActive] = useState(null); // id предмета, взятого в разбор
    const [hover, setHover] = useState(null);
    const [side, setSide] = useState("back");
    // Состояние плеера поля, поднятое наверх: само поле лежит в 3D-сцене и масштабируется
    // камерой, а управлять им надо из обычного, немасштабированного слоя.
    const [player, setPlayer] = useState(null);
    const [face, setFace] = useState("my"); // какая сторона двустороннего поля смотрит вверх
    const [role, setRole] = useState(0); // какая карта роли вынута из веера
    const [flipping, setFlipping] = useState(false);
    // Какая сторона реально отрисована живым плеером. Меняется в середине переворота,
    // когда поле стоит ребром к зрителю, — подмена содержимого там не видна.
    const [shownFace, setShownFace] = useState("my");
    const reduce = useReducedMotion();
    const narrow = useSyncExternalStore(
        subscribeNarrow,
        () => window.matchMedia(NARROW).matches,
        () => false
    );

    const zone = ZONES.find((item) => item.id === active) || null;

    const flip = useCallback(() => {
        const next = face === "my" ? "ya" : "my";
        setFace(next);
        if (reduce) {
            setShownFace(next);
            return;
        }
        setFlipping(true);
        setTimeout(() => setShownFace(next), FLIP_MS / 2);
        setTimeout(() => setFlipping(false), FLIP_MS);
    }, [face, reduce]);

    const close = useCallback(() => {
        setActive(null);
    }, []);

    useEffect(() => {
        const onKey = (event) => {
            if (event.key === "Escape") close();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [close]);

    // Положение камеры: в обзоре стол наклонён, в разборе — выровнен и подведён к предмету.
    const camera = zone
        ? {
              x: `${-(zone.x - 50) * zone.k - (narrow ? 0 : zone.left ?? 0)}%`,
              y: `${-(zone.y - 50) * zone.k - (narrow ? 24 : 0)}%`,
              // на время переворота камера чуть отходит — как будто отвели руку, чтобы перевернуть
              scale: zone.k * (narrow ? 1.25 : 1) * (flipping ? 0.93 : 1),
              rotateX: 0,
          }
        : { x: "0%", y: "0%", scale: 1, rotateX: TILT };

    return (
        <main className="mgl">
            <header className="hud">
                <div className="brand">
                    <span className="dot" />
                    <span>МАЯК · стол мастера</span>
                </div>
                <p className="hudhint">{zone ? "Esc или «Назад к столу» — вернуться к обзору" : "Наведите на предмет, чтобы поднять. Клик — рассмотреть."}</p>
                <Link className="plain" href="/mayak-guide">
                    Текстовое руководство
                </Link>
            </header>

            <div className="scene">
                <motion.div
                    className="table"
                    animate={camera}
                    initial={false}
                    transition={reduce ? { duration: 0 } : { duration: flipping ? FLIP_MS / 1000 : 0.85, ease: SOFT }}>
                    <div className="cloth" />

                    {SCATTER.map((token) => (
                        <img
                            key={`${token.n}-${token.x}`}
                            className="jeton"
                            src={`${A}/jeton_${token.n}.png`}
                            alt=""
                            aria-hidden="true"
                            style={{ left: `${token.x}%`, top: `${token.y}%`, transform: `translate(-50%, -50%) rotate(${token.r}deg)` }}
                        />
                    ))}

                    {STARS.map((star, index) => (
                        <span
                            key={`star-${index}`}
                            className="tablestar"
                            aria-hidden="true"
                            style={{ left: `${star.x}%`, top: `${star.y}%`, transform: `translate(-50%, -50%) rotate(${star.r}deg) scale(${star.s})` }}>
                            <TableStar id={index} />
                        </span>
                    ))}

                    {ZONES.map((item) => {
                        const lifted = hover === item.id || active === item.id;
                        const dimmed = active && active !== item.id;
                        return (
                            <motion.button
                                key={item.id}
                                type="button"
                                className={`zone ${dimmed ? "dim" : ""}`}
                                style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%` }}
                                animate={{ opacity: dimmed ? 0.25 : 1 }}
                                transition={reduce ? { duration: 0 } : { duration: 0.4, ease: EASE }}
                                onMouseEnter={() => setHover(item.id)}
                                onMouseLeave={() => setHover((current) => (current === item.id ? null : current))}
                                onFocus={() => setHover(item.id)}
                                onBlur={() => setHover((current) => (current === item.id ? null : current))}
                                // Берём предмет по pointerdown: поднятый предмет успевает уехать
                                // из-под курсора до mouseup, и обычный click тогда не рождается.
                                // onClick оставлен для клавиатуры (Enter/Space), setActive идемпотентен.
                                onPointerDown={() => setActive(item.id)}
                                onClick={() => setActive(item.id)}
                                aria-label={`${item.nm}: ${item.sub}`}>
                                {/* Поднимается вложенный слой, а не сама кнопка. И именно масштабом,
                                    а не translateZ: подъём по Z на наклонённом столе уводит предмет
                                    из-под курсора, и клик по нему перестаёт попадать. */}
                                <motion.span
                                    className="lift"
                                    animate={{ scale: lifted ? 1.05 : 1 }}
                                    transition={reduce ? { duration: 0 } : { duration: 0.4, ease: EASE }}>
                                    {item.id === "field" ? (
                                        // Обе стороны лежат в одной плоскости: переворот — поворот
                                        // по Y, а не подмена картинки. Живой плеер живёт только на
                                        // той стороне, что сейчас смотрит вверх.
                                        <>
                                        <motion.span
                                            className="boardshadow"
                                            aria-hidden="true"
                                            animate={flipping ? { scale: [1, 0.82, 0.82, 1], opacity: [0.55, 0.2, 0.2, 0.55] } : { scale: 1, opacity: 0.55 }}
                                            initial={false}
                                            transition={reduce ? { duration: 0 } : { duration: FLIP_MS / 1000, ease: SOFT, times: FLIP_TIMES }}
                                        />
                                        <motion.span
                                            className="board"
                                            animate={
                                                flipping
                                                    // без translateZ: сцена уже масштабирована камерой,
                                                    // и подъём по Z раздувает поле во весь экран.
                                                    // Подъём читается наклоном к зрителю плюс лёгким разворотом в плоскости стола.
                                                    ? {
                                                          rotateY: face === "ya" ? 180 : 0,
                                                          rotateX: [0, -11, -11, 0],
                                                          rotateZ: [0, -1.5, 1.5, 0],
                                                          scale: [1, 1.05, 1.05, 1],
                                                      }
                                                    : { rotateY: face === "ya" ? 180 : 0, rotateX: 0, scale: 1 }
                                            }
                                            initial={false}
                                            transition={reduce ? { duration: 0 } : { duration: FLIP_MS / 1000, ease: SOFT, times: FLIP_TIMES }}>
                                            <span className="boardface">
                                                {active === "field" && shownFace === "my" ? (
                                                    <FieldPlayerMy bare onPlayer={setPlayer} />
                                                ) : (
                                                    <img src={FACES.my.img} alt="" aria-hidden="true" draggable="false" />
                                                )}
                                            </span>
                                            <span className="boardface flipped">
                                                {active === "field" && shownFace === "ya" ? (
                                                    <FieldPlayerYa bare onPlayer={setPlayer} />
                                                ) : (
                                                    <img src={FACES.ya.img} alt="" aria-hidden="true" draggable="false" />
                                                )}
                                            </span>
                                            {/* блик: скользящий свет по доске в момент, когда она поднята */}
                                            <motion.span
                                                className="sheen"
                                                aria-hidden="true"
                                                animate={flipping ? { opacity: [0, 0.35, 0.35, 0] } : { opacity: 0 }}
                                                initial={false}
                                                transition={reduce ? { duration: 0 } : { duration: FLIP_MS / 1000, ease: SOFT, times: FLIP_TIMES }}
                                            />
                                        </motion.span>
                                        </>
                                    ) : item.id === "roles" ? (
                                        <span className={`fan ${active === "roles" ? "open" : ""}`}>
                                            {ROLES.map((item2, index) => {
                                                const picked = active === "roles" && index === role;
                                                const spread = active === "roles" ? 12 : 7;
                                                return (
                                                    <motion.img
                                                        key={item2.nm}
                                                        src={`${A}/${item2.img}`}
                                                        alt=""
                                                        aria-hidden="true"
                                                        animate={{
                                                            rotate: (index - 2.5) * spread,
                                                            y: Math.abs(index - 2.5) * (active === "roles" ? 12 : 5) - (picked ? 34 : 0),
                                                            scale: picked ? 1.12 : 1,
                                                        }}
                                                        initial={false}
                                                        transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE }}
                                                        style={{ zIndex: picked ? 10 : index }}
                                                    />
                                                );
                                            })}
                                        </span>
                                    ) : item.id === "card" && active === "card" ? (
                                        <CardAnatomy3D side={side} onSide={setSide} pins={PINS} />
                                    ) : item.id === "card" ? (
                                        <span className="pile">
                                            {[3, 2, 1, 0].map((depth) => (
                                                <img
                                                    key={depth}
                                                    src={item.img}
                                                    alt=""
                                                    aria-hidden="true"
                                                    draggable="false"
                                                    style={{ transform: `translate(${depth * 1.6}px, ${depth * -1.6}px) rotate(${(depth - 1.5) * 1.4}deg)`, zIndex: 4 - depth }}
                                                />
                                            ))}
                                        </span>
                                    ) : (
                                        <img src={item.img} alt="" aria-hidden="true" draggable="false" />
                                    )}
                                </motion.span>

                                <AnimatePresence>
                                    {hover === item.id && !active ? (
                                        <motion.span
                                            className="tag"
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 6 }}
                                            transition={{ duration: 0.18 }}>
                                            <span className="tagnm">{item.id === "field" ? FACES[shownFace].nm : item.nm}</span>
                                            <span className="tagsub">{item.id === "field" ? FACES[shownFace].sub : item.sub}</span>
                                        </motion.span>
                                    ) : null}
                                </AnimatePresence>
                            </motion.button>
                        );
                    })}
                </motion.div>
            </div>

            {/* Пульт поля: само поле раскладывается на столе, а кнопки живут здесь,
                вне масштабируемой сцены, иначе камера растянула бы и их. */}
            <AnimatePresence>
                {zone && (zone.id !== "field" || player) ? (
                    <motion.div
                        className="pult"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={reduce ? { duration: 0 } : { duration: 0.4, ease: EASE, delay: 0.55 }}>
                        <div className="pulthead">
                            <span className="eyebrow">{zone.id === "field" ? FACES[shownFace].sub : zone.sub}</span>
                            <b>{zone.id === "field" ? FACES[shownFace].nm : zone.nm}</b>
                            {zone.id === "field" ? (
                                <button type="button" className="flip" onClick={flip} disabled={flipping}>
                                    ⟲ {FACES[shownFace].flip}
                                </button>
                            ) : null}
                            <button type="button" className="totable" onClick={close}>
                                Назад к столу
                            </button>
                        </div>

                        {zone.id === "field" && player ? (
                            <>
                                <div className="pultrow">
                                    <button
                                        type="button"
                                        className="play"
                                        onClick={player.started ? (player.playing ? player.api.pause : player.api.play) : player.api.start}>
                                        <span aria-hidden="true">{player.started && player.playing ? "❚❚" : "▶"}</span>
                                        {player.playLabel}
                                    </button>
                                    <button type="button" className="again" onClick={player.api.start}>
                                        Начать сначала
                                    </button>
                                    <span className="count">{player.counter}</span>
                                </div>

                                <div className="phases">
                                    {player.phases.map((phase, order) => (
                                        <button
                                            key={phase.id}
                                            type="button"
                                            className={`ph ${player.started && player.phase === phase.id ? "on" : ""}`}
                                            onClick={() => player.api.jumpToPhase(phase.id)}>
                                            <i>{String(order + 1).padStart(2, "0")}</i>
                                            {phase.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="bar">
                                    <span style={{ transform: `scaleX(${player.progress})` }} />
                                </div>
                                <p className="cap">{player.caption}</p>
                            </>
                        ) : null}

                        {zone.id === "card" ? (
                            <>
                                <div className="pultrow">
                                    <button type="button" className={`ph ${side === "back" ? "on" : ""}`} onClick={() => setSide("back")}>
                                        Рубашка
                                    </button>
                                    <button type="button" className={`ph ${side === "face" ? "on" : ""}`} onClick={() => setSide("face")}>
                                        Лицо
                                    </button>
                                </div>
                                <ol className="pins">
                                    {PINS[side].map((pin, index) => (
                                        <li key={pin.t}>
                                            <i>{String(index + 1).padStart(2, "0")}</i>
                                            <span>
                                                <b>{pin.t}</b>
                                                {pin.d}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                                <p className="cap">Потяните карту мышью, чтобы повернуть. Двойной клик — перевернуть.</p>
                            </>
                        ) : null}

                        {zone.id === "roles" ? (
                            <>
                                <div className="phases">
                                    {ROLES.map((item2, index) => (
                                        <button
                                            key={item2.nm}
                                            type="button"
                                            className={`ph ${index === role ? "on" : ""}`}
                                            onClick={() => setRole(index)}>
                                            <i>{String(index + 1).padStart(2, "0")}</i>
                                            {item2.nm}
                                        </button>
                                    ))}
                                </div>
                                <p className="cap">
                                    <b className="rolevice">{ROLES[role].vice}</b>
                                    {ROLES[role].ln}
                                </p>
                            </>
                        ) : null}
                    </motion.div>
                ) : null}
            </AnimatePresence>

            <style jsx global>{`
                .mgl {
                    --ink: #152022;
                    --muted: #7c8a94;
                    --accent: #c9503f;
                    min-height: 100vh;
                    background: radial-gradient(120% 90% at 50% 0%, #1d282c 0%, #0d1415 62%, #080d0e 100%);
                    color: #eef3f4;
                    overflow: hidden;
                }
                .mgl .hud {
                    position: fixed;
                    inset: 0 0 auto 0;
                    z-index: 30;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 18px;
                    padding: 16px 26px;
                    font-size: 13px;
                }
                .mgl .brand {
                    display: inline-flex;
                    align-items: center;
                    gap: 9px;
                    font-weight: 600;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    font-size: 11.5px;
                }
                .mgl .dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--accent);
                    box-shadow: 0 0 12px var(--accent);
                }
                .mgl .hudhint {
                    margin: 0;
                    color: rgba(238, 243, 244, 0.55);
                }
                .mgl .plain {
                    color: rgba(238, 243, 244, 0.72);
                    text-decoration: none;
                    border-bottom: 1px solid rgba(238, 243, 244, 0.28);
                    padding-bottom: 1px;
                }
                .mgl .plain:hover {
                    color: #fff;
                }

                .mgl .scene {
                    position: relative;
                    height: 100vh;
                    display: grid;
                    place-items: center;
                    perspective: 1700px;
                    perspective-origin: 50% 42%;
                }
                .mgl .table {
                    position: relative;
                    width: min(1420px, 92vw);
                    aspect-ratio: 16 / 10;
                    transform-style: preserve-3d;
                    will-change: transform;
                }
                .mgl .cloth {
                    position: absolute;
                    inset: -6% -4%;
                    border-radius: 26px;
                    background: linear-gradient(160deg, #22343a 0%, #16262b 45%, #101d21 100%);
                    box-shadow: inset 0 0 120px rgba(0, 0, 0, 0.55), 0 60px 120px -40px rgba(0, 0, 0, 0.8);
                    /* сукно — только фон: тень у него больше стола и иначе перехватывает клики по предметам */
                    pointer-events: none;
                }
                .mgl .jeton {
                    position: absolute;
                    width: 3.4%;
                    filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.55));
                    pointer-events: none;
                }

                .mgl .zone {
                    position: absolute;
                    translate: -50% -50%;
                    padding: 0;
                    border: 0;
                    background: none;
                    cursor: pointer;
                    transform-style: preserve-3d;
                    outline: none;
                }
                .mgl .lift > img {
                    display: block;
                    width: 100%;
                    height: auto;
                    border-radius: 6px;
                    filter: drop-shadow(0 18px 26px rgba(0, 0, 0, 0.55));
                    transition: filter 0.3s ease;
                }
                .zone:hover img,
                .mgl .zone:focus-visible img {
                    filter: drop-shadow(0 34px 44px rgba(0, 0, 0, 0.62)) brightness(1.06);
                }
                .mgl .zone:focus-visible {
                    box-shadow: 0 0 0 2px var(--accent);
                    border-radius: 8px;
                }
                .mgl .lift {
                    display: block;
                    width: 100%;
                    transform-style: preserve-3d;
                }
                /* Живое поле внутри зоны обязано занимать ровно её бокс: у плеера свои
                   размеры, а зона на столе задана процентом от стола. */
                .mgl .lift > .player,
                .mgl .lift .player .stage {
                    width: 100%;
                    min-width: 0;
                    max-width: 100%;
                }
                .mgl .board {
                    display: block;
                    position: relative;
                    width: 100%;
                    transform-style: preserve-3d;
                }
                .mgl .boardface {
                    display: block;
                    width: 100%;
                    backface-visibility: hidden;
                    transform-style: preserve-3d;
                }
                /* грани разнесены по глубине — у доски появляется толщина,
                   и на ребре она не схлопывается в ноль */
                .mgl .boardface {
                    transform: translateZ(3px);
                }
                .mgl .boardface.flipped {
                    position: absolute;
                    inset: 0;
                    transform: rotateY(180deg) translateZ(3px);
                }
                .mgl .boardshadow {
                    position: absolute;
                    inset: 4% -3% -6% -3%;
                    border-radius: 24px;
                    background: radial-gradient(60% 60% at 50% 55%, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0) 72%);
                    filter: blur(18px);
                    pointer-events: none;
                }
                .mgl .sheen {
                    position: absolute;
                    inset: 0;
                    border-radius: 8px;
                    background: linear-gradient(105deg, rgba(255, 255, 255, 0) 32%, rgba(255, 255, 255, 0.55) 50%, rgba(255, 255, 255, 0) 68%);
                    mix-blend-mode: screen;
                    pointer-events: none;
                }
                /* backface-visibility в Chrome местами игнорируется — прячем грань явно */
                .mgl .boardface.away {
                    opacity: 0;
                    pointer-events: none;
                }
                .mgl .boardface > img {
                    display: block;
                    width: 100%;
                    height: auto;
                    border-radius: 8px;
                    filter: drop-shadow(0 18px 26px rgba(0, 0, 0, 0.55));
                }
                /* номера-подсказки на карте живут в сцене, которую камера увеличивает в 3.2x;
                   гасим этот масштаб обратно, иначе кружки закрывают текст задания */
                .mgl .lift .pin {
                    scale: 0.32;
                }
                /* собственная подпись карты не нужна: она уехала в пульт,
                   а внутри сцены её растянула бы камера */
                .mgl .lift .tip {
                    display: none;
                }
                .mgl .pins {
                    display: grid;
                    gap: 8px;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                }
                .mgl .pins li {
                    display: flex;
                    gap: 9px;
                    font-size: 12.5px;
                    line-height: 1.45;
                    color: rgba(238, 243, 244, 0.7);
                }
                .mgl .pins i {
                    font-style: normal;
                    font-weight: 700;
                    color: var(--accent);
                }
                .mgl .pins b {
                    display: block;
                    color: #fff;
                    font-weight: 600;
                }
                .mgl .rolevice {
                    display: block;
                    margin-bottom: 4px;
                    color: var(--accent);
                }
                .mgl .tablestar {
                    position: absolute;
                    width: 2.2%;
                    filter: drop-shadow(0 5px 8px rgba(0, 0, 0, 0.5));
                    pointer-events: none;
                }
                .mgl .tablestar svg {
                    display: block;
                    width: 100%;
                    height: auto;
                }
                .mgl .pile {
                    display: block;
                    position: relative;
                }
                .mgl .pile img {
                    display: block;
                    width: 100%;
                    height: auto;
                    border-radius: 6px;
                    filter: drop-shadow(0 14px 20px rgba(0, 0, 0, 0.5));
                }
                .mgl .pile img:not(:last-child) {
                    position: absolute;
                    inset: 0;
                }
                .mgl .fan {
                    display: flex;
                    justify-content: center;
                }
                .mgl .fan img {
                    width: 34%;
                    margin: 0 -7%;
                    transform-origin: 50% 100%;
                }

                .mgl .tag {
                    position: absolute;
                    left: 50%;
                    bottom: -14px;
                    translate: -50% 100%;
                    display: grid;
                    gap: 2px;
                    padding: 8px 13px;
                    border-radius: 9px;
                    background: rgba(9, 15, 16, 0.92);
                    border: 1px solid rgba(238, 243, 244, 0.12);
                    white-space: nowrap;
                    text-align: left;
                    pointer-events: none;
                }
                .mgl .tagnm {
                    font-size: 13.5px;
                    font-weight: 650;
                    color: #fff;
                }
                .mgl .tagsub {
                    font-size: 11.5px;
                    color: rgba(238, 243, 244, 0.55);
                }

                .mgl .pult {
                    position: fixed;
                    align-content: start;
                    z-index: 25;
                    right: 24px;
                    top: 50%;
                    translate: 0 -50%;
                    width: min(340px, calc(100vw - 40px));
                    max-height: calc(100vh - 120px);
                    overflow-y: auto;
                    display: grid;
                    gap: 12px;
                    padding: 16px 20px 18px;
                    border-radius: 16px;
                    background: rgba(10, 17, 18, 0.82);
                    backdrop-filter: blur(14px);
                    border: 1px solid rgba(238, 243, 244, 0.12);
                    box-shadow: 0 30px 70px -25px rgba(0, 0, 0, 0.8);
                }
                .mgl .pulthead {
                    display: grid;
                    gap: 4px;
                }
                .mgl .pulthead b {
                    font-size: 15px;
                }
                .mgl .pulthead .flip:disabled {
                    opacity: 0.5;
                    cursor: default;
                }
                .mgl .pulthead .flip {
                    margin-top: 8px;
                    justify-self: start;
                    width: auto;
                    padding: 8px 14px;
                    border-radius: 9px;
                    border: 1px solid var(--accent);
                    background: rgba(201, 80, 63, 0.16);
                    color: #fff;
                    font-size: 13px;
                    cursor: pointer;
                }
                .mgl .pulthead .totable {
                    margin-top: 6px;
                    justify-self: start;
                    background: rgba(238, 243, 244, 0.08);
                    border-color: rgba(238, 243, 244, 0.18);
                    color: #eef3f4;
                    padding: 7px 13px;
                }
                .mgl .pultrow {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 8px;
                }
                .mgl .pultrow .play,
                .mgl .pultrow .again {
                    width: auto;
                    gap: 8px;
                    padding: 9px 16px;
                    border-radius: 9px;
                    border: 1px solid rgba(238, 243, 244, 0.18);
                    background: rgba(238, 243, 244, 0.08);
                    color: #eef3f4;
                    font-size: 13px;
                    cursor: pointer;
                }
                .mgl .pultrow .play {
                    background: var(--accent);
                    border-color: var(--accent);
                }
                .mgl .count {
                    width: 100%;
                    font-size: 12.5px;
                    color: rgba(238, 243, 244, 0.6);
                }
                .mgl .phases {
                    display: grid;
                    gap: 6px;
                }
                .mgl .phases .ph {
                    justify-content: flex-start;
                    text-align: left;
                }
                .mgl .pultrow .ph {
                    width: auto;
                    flex: 0 0 auto;
                    justify-content: center;
                }
                .mgl .phases .ph {
                    width: auto;
                    gap: 7px;
                    padding: 7px 12px;
                    border-radius: 8px;
                    border: 1px solid rgba(238, 243, 244, 0.12);
                    background: none;
                    color: rgba(238, 243, 244, 0.72);
                    font-size: 12.5px;
                    cursor: pointer;
                }
                .mgl .phases .ph.on {
                    background: rgba(238, 243, 244, 0.12);
                    color: #fff;
                    border-color: rgba(238, 243, 244, 0.3);
                }
                .mgl .phases .ph i {
                    font-style: normal;
                    color: var(--accent);
                    font-weight: 700;
                }
                .mgl .bar {
                    height: 3px;
                    border-radius: 3px;
                    background: rgba(238, 243, 244, 0.12);
                    overflow: hidden;
                }
                .mgl .bar span {
                    display: block;
                    height: 100%;
                    width: 100%;
                    transform-origin: 0 50%;
                    background: var(--accent);
                    transition: transform 0.3s ease;
                }
                .mgl .cap {
                    margin: 0;
                    font-size: 13px;
                    line-height: 1.5;
                    color: rgba(238, 243, 244, 0.75);
                }

                .mgl .sheet {
                    position: fixed;
                    inset: auto 0 0 0;
                    z-index: 20;
                    max-height: 82vh;
                    overflow-y: auto;
                    padding: 26px clamp(18px, 4vw, 54px) 40px;
                    background: #fbfbf9;
                    color: var(--ink);
                    border-radius: 22px 22px 0 0;
                    box-shadow: 0 -30px 80px -20px rgba(0, 0, 0, 0.65);
                }
                .mgl .sheethead {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 24px;
                    margin-bottom: 22px;
                }
                .mgl .sheethead > div {
                    flex: 1;
                    min-width: 0;
                }
                .mgl .eyebrow {
                    display: block;
                    font-size: 11px;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    color: var(--accent);
                    margin-bottom: 6px;
                }
                .mgl .sheethead h1 {
                    margin: 0 0 8px;
                    font-size: clamp(22px, 3vw, 30px);
                    line-height: 1.15;
                }
                .mgl .sheethead p {
                    margin: 0;
                    max-width: 68ch;
                    color: var(--muted);
                    font-size: 14.5px;
                    line-height: 1.55;
                }
                .mgl .totable {
                    /* в проекте есть глобальный button { width: 100% } — иначе кнопка съедает шапку */
                    width: auto;
                    white-space: nowrap;
                    flex: none;
                    padding: 10px 16px;
                    border-radius: 9px;
                    border: 1px solid rgba(21, 32, 34, 0.18);
                    background: #fff;
                    color: var(--ink);
                    font-size: 13px;
                    cursor: pointer;
                }
                .mgl .back:hover {
                    border-color: var(--accent);
                    color: var(--accent);
                }

                .mgl .anatomy {
                    display: grid;
                    grid-template-columns: minmax(240px, 340px) 1fr;
                    gap: 34px;
                    align-items: start;
                }
                .mgl .switch {
                    display: inline-flex;
                    gap: 4px;
                    padding: 3px;
                    border-radius: 9px;
                    background: rgba(21, 32, 34, 0.06);
                    margin-bottom: 10px;
                }
                .mgl .switch button {
                    width: auto;
                    padding: 7px 14px;
                    border: 0;
                    border-radius: 7px;
                    background: none;
                    color: var(--ink);
                    font-size: 13px;
                    cursor: pointer;
                }
                .mgl .switch button.on {
                    background: #fff;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
                }
                .mgl .legend .row {
                    display: flex;
                    gap: 12px;
                    padding: 10px 0;
                    border-bottom: 1px solid rgba(21, 32, 34, 0.08);
                }
                .mgl .legend .k {
                    flex: none;
                    font-size: 12px;
                    color: var(--accent);
                    font-weight: 700;
                    padding-top: 2px;
                }
                .mgl .legend .v {
                    display: grid;
                    gap: 3px;
                    font-size: 13.5px;
                    line-height: 1.5;
                }
                .mgl .legend .v span {
                    color: var(--muted);
                }

                .mgl .roles {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                }
                .mgl .role {
                    display: flex;
                    gap: 14px;
                }
                .mgl .shot {
                    flex: none;
                    width: 92px;
                }
                .mgl .shot img {
                    width: 100%;
                    border-radius: 8px;
                    display: block;
                }
                .mgl .role .b {
                    display: grid;
                    gap: 4px;
                    align-content: start;
                }
                .mgl .nm {
                    font-weight: 650;
                    font-size: 15px;
                }
                .mgl .vice {
                    font-size: 12px;
                    color: var(--accent);
                }
                .mgl .ln {
                    font-size: 13px;
                    line-height: 1.5;
                    color: var(--muted);
                }

                @media (max-width: 900px) {
                    .mgl .pult {
                        right: 16px;
                        left: 16px;
                        top: auto;
                        bottom: 16px;
                        width: auto;
                        translate: 0 0;
                        max-height: 46vh;
                        padding: 14px 16px 16px;
                    }
                    .mgl .pulthead .flip {
                        margin-top: 6px;
                    }
                    .mgl .hudhint {
                        display: none;
                    }
                    .mgl .anatomy {
                        grid-template-columns: 1fr;
                    }
                    .mgl .sheet {
                        max-height: 88vh;
                    }
                }
                @media (prefers-reduced-motion: reduce) {
                    .mgl .lift > img {
                        transition: none;
                    }
                }
            `}</style>
        </main>
    );
}
