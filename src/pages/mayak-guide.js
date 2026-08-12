"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import FieldPlayerYa from "@/components/features/mayak-guide/FieldPlayerYa";
import FieldPlayerMy from "@/components/features/mayak-guide/FieldPlayerMy";
import CardAnatomy3D from "@/components/features/mayak-guide/CardAnatomy3D";
import { PINS } from "@/components/features/mayak-guide/cardPins.mjs";

// Руководство мастера: как вести тренажёр МАЯК.
// Открывается из консоли доступа мастера (/mayak-access/[accessId]) в новой вкладке.
// Страница публичная и статичная: внутри нет данных сессии, только правила и разбор поля.

const A = "/mayak-guide";

const NAV = [
    { id: "s2", n: "01", t: "Роли и карты" },
    { id: "s3", n: "02", t: "Этап «Я»" },
    { id: "s4", n: "03", t: "Этап «МЫ»" },
];

const ROLES = [
    { img: "role_kapitan.jpg", nm: "Капитан", vice: "формирует требовательность", ln: "Постоянно: внутренний гарант дисциплины и выполнения ролевых функций." },
    { img: "role_mediator.jpg", nm: "Медиатор", vice: "противоядие от недоверия", ln: "Постоянно: создаёт безопасную атмосферу диалога, вовлекает «тихих»." },
    { img: "role_inspector.jpg", nm: "Инспектор", vice: "борется с безответственностью", ln: "Активно: выносит вердикт с аргументацией. Молчание две минуты — задание принято." },
    { img: "role_hranitel.jpg", nm: "Хранитель Маяка", vice: "противостоит боязни конфликта", ln: "Постоянно: держит темп и энергию, не даёт «огню» погаснуть." },
    { img: "role_engineer.jpg", nm: "Инженер", vice: "убирает технический барьер", ln: "Постоянно: следит за доступностью инструментов, решает технические вопросы." },
    { img: "role_letopisec.jpg", nm: "Летописец", vice: "лечит безразличие к результату", ln: "Постоянно: снимает фото и видео прорывов, эмоций, командной работы." },
];


const TACT_STEPS = [
    ["Планирование", "Команда выбирает до 9 задач такта из шести направлений «ЗВЕЗДЫ». Это общее решение, а не сумма личных предпочтений."],
    ["Выкладка", "Девять жетонов выбранных направлений кладутся на поле такта белой рубашкой вверх. План зафиксирован."],
    ["Разбор", "Участники сами берут жетон и соответствующую карту задания."],
    ["Выполнение", "Задача решается через МАЯК-ОКО и ИИ-сервисы, результат отправляется на проверку."],
    ["Вердикт инспектора", "Инспектор соседней команды принимает или отклоняет с аргументом. Молчание две минуты — принято."],
    ["Переворот", "Жетон переворачивается цветной стороной вверх, на трек индекса ставится звезда в это направление."],
];

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
                    <span className="eyebrow">Команда</span>
                    <h2>Шесть ролей и устройство карты</h2>
                    <p className="lede">
                        Роль — не должность, а функция, без которой команда буксует. Каждая закрывает одну типовую болезнь: недоверие,
                        уход от спора, размытую ответственность, нетребовательность, безразличие к результату.
                    </p>
                    <p className="hint spaced">
                        Карты раздаются рубашкой вверх, каждый берёт одну. У роли два действия: постоянное — фон на весь день, активное —
                        поступок в конкретный момент.
                    </p>

                    <div className="rolesbar">
                        <span className="rolesnote">Шесть ролей команды — пролистайте ленту</span>
                        <span className="arrows">
                            <button type="button" onClick={() => slide(-1)} disabled={edge.start} aria-label="Предыдущие роли">
                                ‹
                            </button>
                            <button type="button" onClick={() => slide(1)} disabled={edge.end} aria-label="Следующие роли">
                                ›
                            </button>
                        </span>
                    </div>

                    <div className="roles" ref={railRef} onScroll={syncEdges}>
                        {ROLES.map((role) => (
                            <article key={role.nm} className="role">
                                <span className="shot">
                                    <img src={`${A}/${role.img}`} alt={`Карточка роли «${role.nm}»`} />
                                </span>
                                <div className="b">
                                    <span className="nm">{role.nm}</span>
                                    <span className="vice">{role.vice}</span>
                                    <span className="ln">{role.ln}</span>
                                </div>
                            </article>
                        ))}
                    </div>

                    <div className="block spaced">
                        <h3>Если участников меньше шести</h3>
                        <p>В первую очередь сохраняются Инспектор и Капитан: без них ломается проверка и темп. Летописец и Хранитель Маяка совмещаются.</p>
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
                                Наведите на строку — на карте подсветится нужный элемент. Кнопка под картой переворачивает её, карту
                                можно и просто крутить мышью.
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
                    <span className="eyebrow">Этап 1 · Я — цифровой эксперт</span>
                    <h2>Как читается поле и что делает участник</h2>
                    <p className="lede">
                        Цель этапа: каждый осваивает работу с ИИ через МАЯК-ОКО и углубляется в один тип контента, чтобы на командном
                        этапе не тратить силы на инструменты.
                    </p>

                    <div className="kit">
                        {[
                            "Поле стороной «Я» вверх",
                            "6 карт ролей",
                            "Миплы по одному на участника",
                            "Планшет игрока",
                            "Раздел «Старт» — 9 карт",
                            "Первые карты шести типов",
                            "Шесть разделов по типам контента",
                        ].map((item) => (
                            <span key={item}>{item}</span>
                        ))}
                    </div>

                    <div className="playerwrap">
                        <FieldPlayerYa />
                    </div>

                    

                    <h3 className="sub-h">Ход этапа</h3>
                    <ol className="steps">
                        <li>
                            <b>Внутренний круг — стартовые задания, вся команда вместе</b>
                            <span>
                                Проходятся все девять карт раздела «Старт», по порядку и без пропусков: распределение ролей, входной бланк,
                                ранжирование промптов, затем задания на составление промпта по методологии МАЯК-ОКО.
                            </span>
                        </li>
                        <li>
                            <b>Внешний круг — по одному заданию в каждом типе контента</b>
                            <span>
                                Задание обозначено цифрой 1 на рубашке карты своего типа и кладётся первой картой. Команда проходит все шесть
                                типов и видит весь спектр возможностей ИИ.
                            </span>
                        </li>
                        <li>
                            <b>Выбор специализации</b>
                            <span>
                                Каждый участник выбирает одно направление типа контента и переходит к индивидуальному выполнению заданий по
                                нему. Мипл двигается по лучу: одно выполненное задание — один гекс.
                            </span>
                        </li>
                    </ol>

                    <div className="end">
                        <b>Конец этапа.</b> Этап заканчивается, когда в одной из команд все участники выполнили по 4 задания своей
                        специализации. Возможен вариант с ограничением по таймеру. За 4 выполненных задания участник приносит команде
                        красную Звезду-Джокер — она понадобится на этапе «МЫ».
                    </div>
                </section>

                {/* 03 — этап «МЫ» */}
                <section id="s4">
                    <span className="eyebrow">Этап 2 · МЫ — цифровая организация</span>
                    <h2>Такт: от девяти жетонов до девяти звёзд</h2>
                    <p className="lede">Цель этапа: закрыть трек индекса цифровой зрелости по всем шести направлениям «ЗВЕЗДЫ» раньше соперников.</p>

                    <div className="kit">
                        {[
                            "Поле стороной «МЫ» вверх",
                            "36 жетонов, по 6 на направление",
                            "Обычные звёзды",
                            "Красные Звёзды-Джокеры с этапа «Я»",
                            "Шесть разделов колоды по направлениям",
                        ].map((item) => (
                            <span key={item}>{item}</span>
                        ))}
                    </div>

                    <div className="playerwrap">
                        <FieldPlayerMy />
                    </div>

                    <h3 className="sub-h">Ход такта</h3>
                    <ol className="steps">
                        {TACT_STEPS.map(([title, text]) => (
                            <li key={title}>
                                <b>{title}</b>
                                <span>{text}</span>
                            </li>
                        ))}
                    </ol>

                    <div className="rules">
                        {RULES.map(([title, text]) => (
                            <div key={title} className="rule">
                                <b>{title}</b>
                                <span>{text}</span>
                            </div>
                        ))}
                    </div>

                    <div className="end">
                        <b>Конец тренажёра.</b> Этап и весь тренажёр заканчиваются, как только одна из команд проходит все четыре такта и
                        закрывает трек индекса цифровой зрелости. Остальные команды фиксируют результат на момент финиша.
                    </div>
                </section>
            </main>


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
                    padding: 64px 40px 76px;
                    max-width: 1760px;
                    margin: 0 auto;
                    border-bottom: 1px solid var(--line);
                }
                .eyebrow {
                    display: block;
                    font-size: 11px;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                    color: var(--muted);
                    margin-bottom: 16px;
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
                .lede {
                    margin-top: 20px;
                    font-size: 18px;
                    color: #3f5058;
                    max-width: 62ch;
                }
                .hint {
                    font-size: 13.5px;
                    color: var(--muted);
                }
                .spaced {
                    margin-top: 26px;
                }
                .playerwrap {
                    margin-top: 34px;
                    /* поле не должно перерастать экран: ограничиваем ширину плеера,
                       чтобы сцена вместе с боковой колонкой помещалась по высоте */
                    max-width: 1280px;
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
                .kit {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 18px;
                }
                .kit :global(span) {
                    font-size: 13.5px;
                    color: #46565f;
                    border: 1px solid var(--line);
                    border-radius: 999px;
                    padding: 7px 14px;
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
                .rolesbar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 20px;
                    margin-top: 30px;
                }
                .rolesnote {
                    font-size: 13.5px;
                    color: var(--muted);
                }
                .arrows {
                    display: flex;
                    gap: 8px;
                }
                .arrows button {
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
                .arrows button:hover:not(:disabled) {
                    background: var(--wash);
                }
                .arrows button:disabled {
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
                    scrollbar-width: none;
                    padding-bottom: 4px;
                }
                .roles::-webkit-scrollbar {
                    display: none;
                }
                .role {
                    scroll-snap-align: start;
                }
                .role {
                    border: 1px solid var(--line);
                    border-radius: 16px;
                    overflow: hidden;
                    background: #fff;
                    transition: border-color 0.2s ease, transform 0.2s ease;
                }
                .role:hover {
                    border-color: var(--line-strong);
                    transform: translateY(-2px);
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
                    font-size: 14px;
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
                .steps {
                    list-style: none;
                    counter-reset: s;
                    margin: 22px 0 0;
                    padding: 0;
                    max-width: 76ch;
                }
                .steps :global(li) {
                    counter-increment: s;
                    position: relative;
                    padding-left: 46px;
                    margin-bottom: 20px;
                }
                .steps :global(li)::before {
                    content: counter(s, decimal-leading-zero);
                    position: absolute;
                    left: 0;
                    top: 1px;
                    font-size: 12.5px;
                    font-weight: 700;
                    color: var(--signal);
                    border: 1px solid var(--line-strong);
                    border-radius: 6px;
                    padding: 3px 7px;
                }
                .steps :global(b) {
                    display: block;
                    font-size: 16px;
                    margin-bottom: 3px;
                }
                .steps :global(span) {
                    font-size: 15px;
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
                .end {
                    border: 1px solid var(--line-strong);
                    border-radius: 14px;
                    padding: 20px 22px;
                    margin-top: 34px;
                    background: var(--wash);
                    font-size: 15.5px;
                    color: #33444d;
                }
                .end b {
                    color: var(--signal);
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
