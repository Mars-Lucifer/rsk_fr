"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import FieldPlayerYa from "@/components/features/mayak-guide/FieldPlayerYa";
import FieldPlayerMy from "@/components/features/mayak-guide/FieldPlayerMy";
import CardAnatomy3D from "@/components/features/mayak-guide/CardAnatomy3D";

// Руководство мастера: как вести тренажёр МАЯК.
// Открывается из консоли доступа мастера (/mayak-access/[accessId]) в новой вкладке.
// Страница публичная и статичная: внутри нет данных сессии, только правила и разбор поля.

const A = "/mayak-guide";

const NAV = [
    { id: "s2", n: "01", t: "Роли и карты" },
    { id: "s3", n: "02", t: "Этап «Я»" },
    { id: "s4", n: "03", t: "Этап «МЫ»" },
];

// Что делает роль — короткими утверждениями, по одному на строку. Пометки
// «Постоянно» / «Активно» убраны: они делили роли на два сорта, хотя в игре
// разница считывается из самого действия.
const ROLES = [
    {
        img: "role_kapitan.jpg",
        nm: "Капитан",
        vice: "Формирует требовательность",
        ln: ["Внутренний гарант дисциплины.", "Следит за выполнением ролевых функций."],
    },
    {
        img: "role_mediator.jpg",
        nm: "Медиатор",
        vice: "Противоядие от недоверия",
        ln: ["Создаёт безопасную атмосферу диалога.", "Вовлекает «тихих»."],
    },
    {
        img: "role_inspector.jpg",
        nm: "Инспектор",
        vice: "Борется с безответственностью",
        ln: ["Выносит вердикт с аргументацией.", "Молчание две минуты — задание принято."],
    },
    {
        img: "role_hranitel.jpg",
        nm: "Хранитель Маяка",
        vice: "Противостоит боязни конфликта",
        ln: ["Держит темп и энергию.", "Не даёт «огню» погаснуть."],
    },
    {
        img: "role_engineer.jpg",
        nm: "Инженер",
        vice: "Убирает технический барьер",
        ln: ["Следит за доступностью инструментов.", "Решает технические вопросы."],
    },
    {
        img: "role_letopisec.jpg",
        nm: "Летописец",
        vice: "Лечит безразличие к результату",
        ln: ["Снимает фото и видео прорывов.", "Фиксирует эмоции и командную работу."],
    },
];

// Элемент карты — это область, а не точка: x/y — левый верхний угол, w/h — размер,
// всё в процентах от карты. При наведении на строку легенды подсвечивается обводка
// области, а номер стоит у края карты и ничего не перекрывает.
//
// Границы сняты не на глаз: обе картинки разобраны попиксельно (public/mayak-guide/
// cards/text.png — 297×420, cards-ya/text-face-sample.png — 481×667), у каждого
// элемента взят его bounding box плюс 3 пикселя воздуха. Если картинки карт
// заменят — пересчитать, а не подгонять руками.
const PINS = {
    back: [
        { x: 4.7, y: 4, w: 12.8, h: 6.4, t: "Идентификатор этапа", d: "Метка «Я» или «МЫ» в овале." },
        { x: 82.5, y: 4, w: 12.8, h: 6.2, t: "Номер", d: "Порядковый номер задания внутри раздела." },
        { x: 38.4, y: 16.2, w: 22.9, h: 5.7, t: "Название раздела", d: "Тип контента на этапе «Я» или направление «ЗВЕЗДЫ» на этапе «МЫ»." },
        { x: 20.2, y: 30.2, w: 60.6, h: 40.5, t: "Цветной гекс с иконкой", d: "По нему карта опознаётся, не переворачивая." },
    ],
    face: [
        { x: 6, y: 4.8, w: 7.3, h: 5.2, t: "Знак вопроса", d: "Есть дополнительные материалы. Нет знака — задание выполняется без них." },
        { x: 34.9, y: 4.6, w: 30.1, h: 5.5, t: "Раздел колоды", d: "К какому разделу относится задание." },
        { x: 81.5, y: 4.6, w: 12.1, h: 5.5, t: "Номер карты", d: "Ключ к дополнительным материалам в тренажёре." },
        { x: 16.8, y: 12.1, w: 63.2, h: 4.6, t: "Название задания", d: "Короткий заголовок-крючок." },
        { x: 9.8, y: 17.5, w: 81.7, h: 19.8, t: "История", d: "Контекст-ситуация, в которую попадает участник." },
        { x: 7.9, y: 77.2, w: 83.6, h: 13.8, t: "Задание", d: "Что конкретно нужно сделать и какой результат сдать." },
    ],
};


const RULES = [
    ["Такт закрывается целиком", "Такт 2 не начинается, пока не закрыты все девять задач такта 1."],
    ["Команда ждёт отстающего", "Один не успевает — команда помогает. Переход «в долг» запрещён."],
    ["Штраф за невыполненное", "Минус одна звезда индекса по этому направлению, но не ниже нуля."],
    ["Звезда-Джокер", "Закрывает любую задачу без выполнения, в любой момент. Максимум шесть — резерв, а не спасательный круг."],
    ["Все четыре такта одинаковы", "Механика не меняется от такта к такту."],
    ["Рефлексия в конце", "После объявления результата мастер смещает фокус с очков на опыт и проводит финальную рефлексию."],
];

export default function MayakGuidePage() {
    const [side, setSide] = useState("back");
    const [active, setActive] = useState("s2");
    const [hint, setHint] = useState(null);

    // Лента ролей: прокрутка на одну карточку за нажатие, как в галерее кейсов.
    const railRef = useRef(null);
    const [edge, setEdge] = useState({ start: true, end: false });

    const syncEdges = useCallback(() => {
        const node = railRef.current;
        if (!node) return;
        setEdge({ start: node.scrollLeft < 8, end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 8 });
    }, []);

    const slide = useCallback(
        (direction) => {
            const node = railRef.current;
            if (!node) return;
            const card = node.querySelector(".role");
            const step = card ? card.getBoundingClientRect().width + 18 : node.clientWidth * 0.8;
            node.scrollBy({ left: step * direction, behavior: "smooth" });
        },
        []
    );

    useEffect(syncEdges, [syncEdges]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) setActive(entry.target.id);
                });
            },
            { rootMargin: "-45% 0px -50% 0px" }
        );
        NAV.forEach((item) => {
            const node = document.getElementById(item.id);
            if (node) observer.observe(node);
        });
        return () => observer.disconnect();
    }, []);

    return (
        <div className="guide">
            <header className="topbar">
                <div className="brand">
                    <span className="wm">МАЯК</span>
                    <span className="sub">Руководство мастера</span>
                </div>
                <nav className="nav">
                    {NAV.map((item) => (
                        <a key={item.id} href={`#${item.id}`} className={active === item.id ? "on" : ""}>
                            <span className="n">{item.n}</span>
                            <span className="t">{item.t}</span>
                        </a>
                    ))}
                </nav>
            </header>

            <main>
                {/* 01 — роли и карты */}
                <section id="s2">
                    <h2 className="stagehead">Команда · Шесть ролей и устройство карты</h2>
                    <p className="lede">
                        Роль — не должность, а функция, без которой команда буксует. Каждая закрывает одну типовую болезнь: недоверие,
                        уход от спора, размытую ответственность, нетребовательность, безразличие к результату.
                    </p>

                    <div className="roles" ref={railRef} onScroll={syncEdges}>
                        {ROLES.map((role) => (
                            <article key={role.nm} className="role">
                                <span className="shot">
                                    <img src={`${A}/${role.img}`} alt={`Карточка роли «${role.nm}»`} />
                                </span>
                                <div className="b">
                                    <span className="nm">{role.nm}</span>
                                    <span className="vice">{role.vice}</span>
                                    <ul className="ln">
                                        {role.ln.map((line) => (
                                            <li key={line}>{line}</li>
                                        ))}
                                    </ul>
                                </div>
                            </article>
                        ))}
                    </div>

                    {/* Стрелки стоят под лентой по центру — прямо под карточкой,
                        которая в этот момент главная. */}
                    <div className="rolesbar">
                        <button type="button" onClick={() => slide(-1)} disabled={edge.start} aria-label="Предыдущие роли">
                            ‹
                        </button>
                        <button type="button" onClick={() => slide(1)} disabled={edge.end} aria-label="Следующие роли">
                            ›
                        </button>
                    </div>

                    <h3 className="sub-h">Из чего устроена карта задания</h3>
                    <p className="hint">Все карты собраны одинаково. Мастер разбирает одну — дальше участники читают любую сами.</p>

                    <div className="anatomy">
                        <CardAnatomy3D side={side} onSide={setSide} pins={PINS} hint={hint} />

                        <div className="legendcol">
                            <div className="sidehead">
                                <span className="t">{side === "back" ? "Рубашка" : "Лицо"}</span>
                                <span className="c">{PINS[side].length} элементов</span>
                            </div>
                            <div className="legend" onMouseLeave={() => setHint(null)}>
                                {PINS[side].map((pin, index) => (
                                    <div
                                        key={pin.t}
                                        className={`row ${hint === index ? "on" : ""}`}
                                        onMouseEnter={() => setHint(index)}
                                        onFocus={() => setHint(index)}
                                        tabIndex={0}>
                                        <span className="k">{String(index + 1).padStart(2, "0")}</span>
                                        <span className="v">
                                            <b>{pin.t}</b>
                                            <span>{pin.d}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <p className="hint spaced">
                                Наведите на строку — на карте подсветится нужный элемент.
                            </p>

                            <div className="block">
                                <h3>Карты настроения</h3>
                                <p>
                                    В конце каждого раздела колоды лежит карта настроения — не задание, а короткое командное действие для
                                    снятия напряжения. Звёзды за неё не начисляются. Инициирует Хранитель Маяка.
                                </p>
                            </div>
                        </div>
                    </div>

                </section>

                {/* 02 — этап «Я» */}
                <section id="s3">
                    <h2 className="stagehead">Этап 1 · Я — цифровой эксперт</h2>
                    <p className="lede">
                        Цель этапа: каждый осваивает работу с ИИ через МАЯК-ОКО и углубляется в один тип контента, чтобы на командном
                        этапе не тратить силы на инструменты.
                    </p>

                    <div className="playerwrap">
                        <FieldPlayerYa />
                    </div>

                </section>

                {/* 03 — этап «МЫ» */}
                <section id="s4">
                    <h2 className="stagehead">Этап 2 · МЫ — цифровая организация</h2>
                    <p className="lede">Цель этапа: закрыть трек индекса цифровой зрелости по всем шести направлениям «ЗВЕЗДЫ» раньше соперников.</p>

                    <div className="playerwrap">
                        <FieldPlayerMy />
                    </div>

                    <div className="rules spaced">
                        {RULES.map(([title, text]) => (
                            <div key={title} className="rule">
                                <b>{title}</b>
                                <span>{text}</span>
                            </div>
                        ))}
                    </div>

                </section>
            </main>

            {/* Переход по разделам меню — плавная прокрутка. Живёт в global-блоке,
                потому что scroll-behavior работает только на самом документе. */}
            <style jsx global>{`
                html {
                    scroll-behavior: smooth;
                }
                @media (prefers-reduced-motion: reduce) {
                    html {
                        scroll-behavior: auto;
                    }
                }
            `}</style>

            <style jsx>{`
                .guide {
                    --ink: #101820;
                    --muted: #64748b;
                    --line: #e3eaef;
                    --line-strong: #cbd6de;
                    --paper: #ffffff;
                    --wash: #f5f8fa;
                    --signal: #c9503f;
                    min-height: 100vh;
                    background: var(--paper);
                    color: var(--ink);
                    font-family: "Manrope", "Segoe UI", system-ui, sans-serif;
                    font-size: 16px;
                    line-height: 1.55;
                }
                /* Шапка вместо боковой колонки: разделы идут вправо, контент занимает всю ширину. */
                .topbar {
                    position: sticky;
                    top: 0;
                    z-index: 5;
                    display: flex;
                    align-items: center;
                    gap: 40px;
                    padding: 14px 40px;
                    background: rgba(255, 255, 255, 0.92);
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid var(--line);
                }
                .brand {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    flex: 0 0 auto;
                }
                .wm {
                    font-size: 24px;
                    font-weight: 800;
                    letter-spacing: -0.04em;
                }
                .sub {
                    font-size: 11px;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    color: var(--muted);
                }
                .nav {
                    display: flex;
                    gap: 4px;
                    overflow-x: auto;
                }
                .nav a {
                    display: flex;
                    gap: 10px;
                    align-items: baseline;
                    white-space: nowrap;
                    padding: 9px 14px;
                    border-radius: 8px;
                    text-decoration: none;
                    color: var(--muted);
                    transition: background 0.2s ease, color 0.2s ease;
                }
                .nav a:hover {
                    background: var(--wash);
                    color: var(--ink);
                }
                .nav a.on {
                    background: var(--wash);
                    color: var(--ink);
                }
                .nav .n {
                    font-size: 11px;
                    letter-spacing: 0.1em;
                    font-variant-numeric: tabular-nums;
                }
                .nav a.on .n {
                    color: var(--signal);
                }
                .nav .t {
                    font-size: 14.5px;
                    font-weight: 600;
                }
                section {
                    padding: 34px 40px 40px;
                    max-width: 1760px;
                    margin: 0 auto;
                    border-bottom: 1px solid var(--line);
                    /* переход по меню — плавный докрут, а не прыжок; отступ сверху,
                       чтобы заголовок раздела не уезжал под липкую шапку */
                    scroll-margin-top: 78px;
                }
                                h1 {
                    margin: 0;
                    font-size: clamp(38px, 5vw, 62px);
                    line-height: 1.02;
                    letter-spacing: -0.035em;
                    font-weight: 800;
                }
                h2 {
                    margin: 0;
                    font-size: clamp(28px, 3.2vw, 40px);
                    line-height: 1.05;
                    letter-spacing: -0.025em;
                    font-weight: 800;
                }
                /* Раздел открывается одной строкой-заголовком: подпись-надзаголовок и
                   второй заголовок убраны, чтобы этап помещался в экран без прокрутки. */
                .stagehead {
                    font-size: clamp(24px, 2.1vw, 30px);
                }
                h3 {
                    margin: 0 0 10px;
                    font-size: 17px;
                    font-weight: 800;
                    letter-spacing: -0.01em;
                }
                .sub-h {
                    margin-top: 56px;
                    font-size: 22px;
                }
                p {
                    margin: 0 0 12px;
                }
                /* лид идёт по ширине поля, а не узкой колонкой: под ним стоит плеер,
                   и разная ширина двух соседних блоков читалась как сбой вёрстки */
                .lede {
                    margin-top: 12px;
                    margin-bottom: 0;
                    font-size: 17px;
                    color: #3f5058;
                    max-width: 1280px;
                }
                .hint {
                    font-size: 13.5px;
                    color: var(--muted);
                }
                .spaced {
                    margin-top: 26px;
                }
                .playerwrap {
                    margin-top: 20px;
                    /* ширину держит сам плеер: поле ограничено своей колонкой грида,
                       а боковая колонка забирает остаток строки */
                }
                .block {
                    border-top: 1px solid var(--line);
                    padding-top: 16px;
                }
                .block p {
                    font-size: 15.5px;
                    color: #46565f;
                    margin: 0;
                }
                                                .flip.turned {
                    transform: rotateY(180deg);
                }
                .face.back {
                    transform: rotateY(180deg);
                }
                .act.ghost {
                    background: #fff;
                    color: #152022;
                    border-color: var(--line-strong);
                }
                .act.ghost:hover {
                    background: var(--wash);
                }
                /* стрелки под лентой, по центру — под той карточкой, что сейчас главная */
                .rolesbar {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    margin-top: 14px;
                }
                .rolesbar button {
                    width: 38px;
                    height: 38px;
                    border-radius: 50%;
                    border: 1px solid var(--line-strong);
                    background: #fff;
                    color: var(--ink);
                    font-size: 18px;
                    line-height: 1;
                    cursor: pointer;
                    transition: background 0.18s ease, opacity 0.18s ease;
                }
                .rolesbar button:hover:not(:disabled) {
                    background: var(--wash);
                }
                .rolesbar button:disabled {
                    opacity: 0.35;
                    cursor: default;
                }
                                                                                                /* лента ролей: видно три карточки, остальные листаются вбок */
                .roles {
                    display: grid;
                    grid-auto-flow: column;
                    grid-auto-columns: calc((100% - 36px) / 3);
                    gap: 18px;
                    margin-top: 14px;
                    overflow-x: auto;
                    scroll-snap-type: x mandatory;
                    /* листаем кнопками под лентой, полосу прокрутки прячем */
                    scrollbar-width: none;
                    padding-bottom: 2px;
                }
                .roles::-webkit-scrollbar {
                    display: none;
                }
                .role {
                    scroll-snap-align: center;
                    border: 1px solid var(--line);
                    border-radius: 16px;
                    overflow: hidden;
                    background: #fff;
                    transition: border-color 0.2s ease;
                    /* Карусель: карточка в середине ленты крупнее и ярче соседних.
                       Прогресс считает сам браузер по положению карточки в скролле
                       (scroll-driven animation) — без обработчиков скролла в JS.
                       Где нет поддержки — лента просто едет без масштаба. */
                    animation: carousel linear both;
                    animation-timeline: view(inline);
                    animation-range: entry 0% exit 100%;
                    transform-origin: center 42%;
                }
                /* дальние карточки не гасим — их должно быть видно и читаемо;
                   разница только в размере, поэтому центр читается как главный */
                @keyframes carousel {
                    0% {
                        transform: scale(0.93);
                    }
                    50% {
                        transform: scale(1.02);
                    }
                    100% {
                        transform: scale(0.93);
                    }
                }
                .role:hover {
                    border-color: var(--line-strong);
                }
                @media (prefers-reduced-motion: reduce) {
                    .role {
                        animation: none;
                    }
                }
                .shot {
                    display: grid;
                    place-items: center;
                    padding: 10px 10px 0;
                }
                .role :global(img) {
                    /* карточка целиком; в ленте помещается три штуки, поэтому можно крупнее */
                    width: auto;
                    max-width: 100%;
                    height: min(430px, 46vh);
                    object-fit: contain;
                    display: block;
                }
                .role .b {
                    padding: 10px 14px 13px;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    /* подпись выровнена по центру карточки — как сама карта роли */
                    text-align: center;
                }
                .nm {
                    font-weight: 800;
                    font-size: 16px;
                }
                .vice {
                    font-size: 11.5px;
                    color: var(--signal);
                    letter-spacing: 0.04em;
                }
                .ln {
                    list-style: none;
                    margin: 4px 0 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    font-size: 14px;
                    line-height: 1.35;
                    color: #46565f;
                }
                .anatomy {
                    display: grid;
                    grid-template-columns: minmax(280px, 380px) 1fr;
                    gap: 48px;
                    margin-top: 26px;
                    align-items: start;
                }
                .legendcol {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .sidehead {
                    display: flex;
                    align-items: baseline;
                    gap: 12px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid var(--line);
                }
                .sidehead .t {
                    font-size: 19px;
                    font-weight: 800;
                }
                .sidehead .c {
                    font-size: 13px;
                    color: var(--muted);
                }
                .switch {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 14px;
                }
                .switch button {
                    font: inherit;
                    font-size: 13px;
                    padding: 8px 16px;
                    border-radius: 999px;
                    cursor: pointer;
                    background: #fff;
                    color: var(--muted);
                    border: 1px solid var(--line-strong);
                }
                .switch button.on {
                    background: #152022;
                    color: #fff;
                    border-color: #152022;
                    font-weight: 700;
                }
                /* две колонки: правая часть больше не пустует */
                .legend {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 6px 28px;
                }
                .legend .row {
                    display: grid;
                    grid-template-columns: 26px 1fr;
                    gap: 14px;
                    padding: 12px 12px 12px 10px;
                    border-radius: 10px;
                    border: 1px solid transparent;
                    outline: none;
                    cursor: default;
                    transition: background 0.16s ease, border-color 0.16s ease;
                }
                .legend .row.on {
                    background: #fdf1ef;
                    border-color: #f0c7c0;
                }
                .legend .k {
                    font-size: 12px;
                    font-weight: 800;
                    color: var(--signal);
                    font-variant-numeric: tabular-nums;
                }
                .legend .v {
                    display: flex;
                    flex-direction: column;
                }
                .legend .v b {
                    font-size: 15px;
                    margin-bottom: 2px;
                }
                .legend .v span {
                    font-size: 14px;
                    color: #46565f;
                }
                                                                                                .cap .t {
                    font-size: 12.5px;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    color: var(--muted);
                }
                .cell.done {
                    border-style: solid;
                    border-color: transparent;
                    box-shadow: 0 2px 10px rgba(16, 24, 32, 0.08);
                }
                .star.lit {
                    background: #fdf1ef;
                    border-color: var(--signal);
                    color: var(--signal);
                }
                .rules {
                    margin-top: 36px;
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                }
                .rule {
                    border-left: 2px solid var(--signal);
                    padding-left: 16px;
                }
                .rule b {
                    display: block;
                    font-size: 15px;
                    margin-bottom: 3px;
                }
                .rule span {
                    font-size: 14.5px;
                    color: #46565f;
                }
                                                @media (max-width: 1080px) {
                    .topbar {
                        padding: 12px 20px;
                        gap: 20px;
                    }
                    section {
                        padding: 48px 20px 56px;
                    }
                    .anatomy,
                    .rules,
                    .roles {
                        grid-template-columns: 1fr;
                        gap: 28px;
                    }
                }
                @media (prefers-reduced-motion: reduce) {
                    .role {
                        transition: none;
                    }
                }
            `}</style>
        </div>
    );
}
