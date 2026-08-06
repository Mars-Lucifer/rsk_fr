"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import FieldPlayerYa from "@/components/features/mayak-guide/FieldPlayerYa";
import FieldPlayerMy from "@/components/features/mayak-guide/FieldPlayerMy";
import CardAnatomy3D from "@/components/features/mayak-guide/CardAnatomy3D";

// Руководство мастера: как вести тренажёр МАЯК.
// Открывается из консоли доступа мастера (/mayak-access/[accessId]) в новой вкладке.
// Страница публичная и статичная: внутри нет данных сессии, только правила и разбор поля.

const A = "/mayak-guide";

const NAV = [
    { id: "s1", n: "01", t: "Общее" },
    { id: "s2", n: "02", t: "Роли и карты" },
    { id: "s3", n: "03", t: "Этап «Я»" },
    { id: "s4", n: "04", t: "Этап «МЫ»" },
];

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

const DIRS = [
    { name: "Знания и навыки", color: "#e2a03f", face: "jeton_1.png", back: "jeton_2.png" },
    { name: "Внешние взаимодействия", color: "#c9503f", face: "jeton_3.png", back: "jeton_4.png" },
    { name: "Единое цифровое пространство", color: "#9fc9d9", face: "jeton_7.png", back: "jeton_8.png" },
    { name: "Защита данных", color: "#8cc63f", face: "jeton_5.png", back: "jeton_6.png" },
    { name: "Данные и аналитика", color: "#29abe2", face: "jeton_9.png", back: "jeton_10.png" },
    { name: "Автоматизация", color: "#1b5486", face: "jeton_11.png", back: "jeton_12.png" },
];

// План такта: какие направления команда взяла в девять клеток.
const PLAN = [0, 0, 1, 1, 2, 3, 4, 4, 5];

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
    const [flipped, setFlipped] = useState(false);
    const [side, setSide] = useState("back");
    const [active, setActive] = useState("s1");
    const [done, setDone] = useState(() => PLAN.map(() => false));

    const stars = useMemo(() => {
        const acc = DIRS.map(() => 0);
        PLAN.forEach((dir, i) => {
            if (done[i]) acc[dir] += 1;
        });
        return acc;
    }, [done]);

    const totalStars = stars.reduce((sum, value) => sum + value, 0);
    const doneCount = done.filter(Boolean).length;

    const toggleCell = useCallback((index) => {
        setDone((current) => current.map((value, i) => (i === index ? !value : value)));
    }, []);

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
            <aside className="rail">
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
                <div className="railfoot">
                    <img src="/images/logo.png" alt="РСК" />
                </div>
            </aside>

            <main>
                {/* 01 — общее */}
                <section id="s1">
                    <span className="eyebrow">Тренажёр МАЯК · для мастера</span>
                    <h1>
                        Один день,
                        <br />
                        два этапа,
                        <br />
                        одно поле.
                    </h1>
                    <p className="lede">
                        МАЯК — командный тренажёр цифровой трансформации. Поле двухстороннее: сначала участники работают каждый за
                        себя, потом переворачивают его и работают как организация.
                    </p>

                    <div className="facts">
                        <span className="fact">
                            <b>18</b> участников
                        </span>
                        <span className="fact">
                            <b>3</b> команды по <b>6</b> человек
                        </span>
                        <span className="fact">
                            <b>1</b> двухстороннее поле на команду
                        </span>
                        <span className="fact">
                            <b>4</b> такта на этапе «МЫ»
                        </span>
                    </div>

                    <div className="split">
                        <div>
                            <div className="flipwrap">
                                <div className={`flip ${flipped ? "turned" : ""}`}>
                                    <div className="face">
                                        <img src={`${A}/pole_ya.png`} alt="Сторона поля «Я»" />
                                        <span className="stamp">Сторона «Я»</span>
                                    </div>
                                    <div className="face back">
                                        <img src={`${A}/pole_my.png`} alt="Сторона поля «МЫ»" />
                                        <span className="stamp">Сторона «МЫ»</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flipbar">
                                <button type="button" className="act" onClick={() => setFlipped((value) => !value)}>
                                    Перевернуть поле
                                </button>
                                <span className="hint">Переворот поля — публичный момент перехода между этапами, а не техническая операция.</span>
                            </div>
                        </div>

                        <div className="stack">
                            <div className="block">
                                <h3>Этап «Я» — цифровой эксперт</h3>
                                <p>Каждый участник осваивает свой тип контента и инструменты ИИ через генератор МАЯК-ОКО.</p>
                            </div>
                            <div className="block">
                                <h3>Этап «МЫ» — цифровая организация</h3>
                                <p>Команда закрывает задачи по шести направлениям индекса цифровой зрелости «ЗВЕЗДА».</p>
                            </div>
                            <div className="block">
                                <h3>В наборе команды</h3>
                                <div className="kit">
                                    {["Игровое поле", "6 карт ролей", "Миплы", "36 жетонов", "Звёзды", "Колода заданий", "Планшет игрока"].map((item) => (
                                        <span key={item}>{item}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="block">
                                <h3>Колода сменная</h3>
                                <p>Под вуз, бизнес, НКО или госуправление меняется содержание карт. Механика, роли и модель «ЗВЕЗДА» остаются теми же.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 02 — роли и карты */}
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

                    <div className="roles">
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
                        <div>
                            <div className="switch">
                                <button type="button" className={side === "back" ? "on" : ""} onClick={() => setSide("back")}>
                                    Рубашка
                                </button>
                                <button type="button" className={side === "face" ? "on" : ""} onClick={() => setSide("face")}>
                                    Лицо
                                </button>
                            </div>
                            <CardAnatomy3D side={side} onSide={setSide} pins={PINS} />
                        </div>
                        <div className="legend">
                            {PINS[side].map((pin, index) => (
                                <div key={pin.t} className="row">
                                    <span className="k">{String(index + 1).padStart(2, "0")}</span>
                                    <span className="v">
                                        <b>{pin.t}</b>
                                        <span>{pin.d}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="block spaced">
                        <h3>Карты настроения</h3>
                        <p>
                            В конце каждого раздела колоды лежит карта настроения — не задание, а короткое командное действие для снятия
                            напряжения. Звёзды за неё не начисляются. Инициирует Хранитель Маяка.
                        </p>
                    </div>
                </section>

                {/* 03 — этап «Я» */}
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

                {/* 04 — этап «МЫ» */}
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

                    <div className="sim">
                        <div className="panel">
                            <div className="cap">
                                <span className="t">Такт 1 · поле такта</span>
                                <span className="count">
                                    <b>{doneCount}</b>/9 закрыто
                                </span>
                            </div>
                            <div className="grid9">
                                {PLAN.map((dir, index) => (
                                    <button
                                        key={`cell-${index}`}
                                        type="button"
                                        className={`cell ${done[index] ? "done" : ""}`}
                                        title={DIRS[dir].name}
                                        onClick={() => toggleCell(index)}>
                                        <img src={`${A}/${done[index] ? DIRS[dir].face : DIRS[dir].back}`} alt={DIRS[dir].name} />
                                    </button>
                                ))}
                            </div>
                            <div className="simbar">
                                <button type="button" className="act ghost" onClick={() => setDone(PLAN.map(() => false))}>
                                    Сбросить такт
                                </button>
                                <span className="hint">Нажмите на жетон — задание принято инспектором, жетон переворачивается цветной стороной.</span>
                            </div>
                        </div>

                        <div className="panel">
                            <div className="cap">
                                <span className="t">Индекс цифровой зрелости</span>
                                <span className="count">
                                    <b>{totalStars}</b>/36 звёзд
                                </span>
                            </div>
                            {DIRS.map((dir, index) => (
                                <div key={dir.name} className="trow">
                                    <span className="lbl">
                                        <i style={{ background: dir.color }} />
                                        {dir.name}
                                    </span>
                                    <span className="cells">
                                        {Array.from({ length: 6 }, (_, cell) => (
                                            <i key={`${dir.name}-${cell}`} className={`star ${cell < stars[index] ? "lit" : ""}`}>
                                                ★
                                            </i>
                                        ))}
                                    </span>
                                </div>
                            ))}
                            <p className="hint">
                                36 жетонов = 6 направлений × 6 = 4 такта × 9 задач = 36 клеток трека. Числа не сошлись — забыли перевернуть
                                жетон или поставить звезду.
                            </p>
                        </div>
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
                    --rail: 260px;
                    min-height: 100vh;
                    background: var(--paper);
                    color: var(--ink);
                    font-family: "Manrope", "Segoe UI", system-ui, sans-serif;
                    font-size: 16px;
                    line-height: 1.55;
                }
                .rail {
                    position: fixed;
                    inset: 0 auto 0 0;
                    width: var(--rail);
                    padding: 28px 22px;
                    display: flex;
                    flex-direction: column;
                    gap: 26px;
                    border-right: 1px solid var(--line);
                    background: var(--paper);
                    z-index: 5;
                }
                .brand {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
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
                    flex-direction: column;
                    gap: 2px;
                }
                .nav a {
                    display: flex;
                    gap: 12px;
                    align-items: baseline;
                    padding: 10px 12px;
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
                .railfoot {
                    margin-top: auto;
                }
                .railfoot img {
                    width: 108px;
                    opacity: 0.75;
                }
                main {
                    margin-left: var(--rail);
                }
                section {
                    padding: 76px 56px 84px;
                    max-width: 1560px;
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
                .facts {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 26px;
                }
                .fact {
                    border: 1px solid var(--line);
                    border-radius: 999px;
                    padding: 8px 16px;
                    font-size: 14px;
                    color: #3f5058;
                }
                .fact b {
                    color: var(--ink);
                }
                .split {
                    display: grid;
                    grid-template-columns: 1.05fr 0.95fr;
                    gap: 48px;
                    align-items: start;
                    margin-top: 40px;
                }
                .playerwrap {
                    margin-top: 34px;
                }
                .legendgrid {
                    margin-top: 40px;
                }
                .legendgrid .stack {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 22px 40px;
                }
                .stack {
                    display: flex;
                    flex-direction: column;
                    gap: 22px;
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
                .tag {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: var(--signal);
                    color: #fff;
                    font-size: 12px;
                    margin-right: 8px;
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
                .flipwrap {
                    perspective: 1600px;
                }
                .flip {
                    position: relative;
                    width: 100%;
                    aspect-ratio: 1 / 0.79;
                    transform-style: preserve-3d;
                    transition: transform 0.85s cubic-bezier(0.2, 0.7, 0.2, 1);
                }
                .flip.turned {
                    transform: rotateY(180deg);
                }
                .face {
                    position: absolute;
                    inset: 0;
                    backface-visibility: hidden;
                    border-radius: 18px;
                    overflow: hidden;
                    border: 1px solid var(--line);
                    background: #000;
                    box-shadow: 0 12px 34px rgba(16, 24, 32, 0.12);
                }
                .face.back {
                    transform: rotateY(180deg);
                }
                .face :global(img) {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .stamp {
                    position: absolute;
                    left: 14px;
                    bottom: 12px;
                    font-size: 10.5px;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    color: #fff;
                    background: rgba(0, 0, 0, 0.55);
                    padding: 5px 12px;
                    border-radius: 999px;
                }
                .flipbar {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-top: 16px;
                    flex-wrap: wrap;
                }
                .act {
                    font: inherit;
                    flex: 0 0 auto;
                    width: auto;
                    align-self: flex-start;
                    font-size: 14px;
                    font-weight: 700;
                    color: #fff;
                    background: #152022;
                    border: 1px solid #152022;
                    border-radius: 10px;
                    padding: 11px 20px;
                    cursor: pointer;
                    transition: transform 0.18s ease, background 0.18s ease;
                }
                .act:hover {
                    transform: translateY(-1px);
                }
                .act.ghost {
                    background: #fff;
                    color: #152022;
                    border-color: var(--line-strong);
                }
                .act.ghost:hover {
                    background: var(--wash);
                }
                .roles {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 18px;
                    margin-top: 34px;
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
                    /* карточка целиком, но не выше трети экрана: все шесть ролей влезают в один экран */
                    width: auto;
                    max-width: 100%;
                    height: min(300px, 30vh);
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
                    grid-template-columns: minmax(220px, 320px) 1fr;
                    gap: 40px;
                    margin-top: 26px;
                    align-items: start;
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
                .cardshot {
                    position: relative;
                    border-radius: 14px;
                    overflow: hidden;
                    border: 1px solid var(--line);
                    background: #fff;
                }
                .cardshot :global(img) {
                    width: 100%;
                    display: block;
                }
                .pin {
                    position: absolute;
                    width: 25px;
                    height: 25px;
                    border-radius: 50%;
                    background: var(--signal);
                    color: #fff;
                    font-size: 12px;
                    font-weight: 700;
                    display: grid;
                    place-items: center;
                    box-shadow: 0 2px 8px rgba(16, 24, 32, 0.25);
                    transform: translate(-50%, -50%);
                }
                .legend {
                    display: flex;
                    flex-direction: column;
                }
                .legend .row {
                    display: grid;
                    grid-template-columns: 26px 1fr;
                    gap: 14px;
                    padding: 12px 0;
                    border-bottom: 1px solid var(--line);
                }
                .legend .row:last-child {
                    border-bottom: 0;
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
                .board {
                    position: relative;
                    border-radius: 16px;
                    overflow: hidden;
                    border: 1px solid var(--line);
                }
                .board :global(img) {
                    width: 100%;
                    display: block;
                }
                .board :global(svg) {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
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
                .sim {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 32px;
                    margin-top: 34px;
                    align-items: start;
                }
                .panel {
                    border: 1px solid var(--line);
                    border-radius: 16px;
                    background: var(--wash);
                    padding: 22px;
                }
                .cap {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    gap: 16px;
                    margin-bottom: 14px;
                }
                .cap .t {
                    font-size: 12.5px;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    color: var(--muted);
                }
                .count {
                    font-size: 13px;
                    color: var(--muted);
                    font-variant-numeric: tabular-nums;
                }
                .count b {
                    color: var(--ink);
                }
                .grid9 {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                }
                .cell {
                    aspect-ratio: 1;
                    border-radius: 10px;
                    border: 1px dashed var(--line-strong);
                    background: #fff;
                    padding: 8px;
                    cursor: pointer;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease;
                }
                .cell:hover {
                    border-color: #152022;
                }
                .cell.done {
                    border-style: solid;
                    border-color: transparent;
                    box-shadow: 0 2px 10px rgba(16, 24, 32, 0.08);
                }
                .cell :global(img) {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    border-radius: 6px;
                }
                .simbar {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-top: 16px;
                    flex-wrap: wrap;
                }
                .trow {
                    display: grid;
                    grid-template-columns: 190px 1fr;
                    align-items: center;
                    gap: 14px;
                    margin-bottom: 8px;
                }
                .lbl {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    color: #46565f;
                    line-height: 1.25;
                }
                .lbl :global(i) {
                    width: 10px;
                    height: 10px;
                    border-radius: 3px;
                    flex: 0 0 auto;
                }
                .cells {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 6px;
                }
                .star {
                    height: 22px;
                    border-radius: 5px;
                    background: #fff;
                    border: 1px solid var(--line);
                    display: grid;
                    place-items: center;
                    font-size: 12px;
                    font-style: normal;
                    color: transparent;
                    transition: all 0.25s ease;
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
                    .guide {
                        --rail: 0px;
                    }
                    .rail {
                        position: static;
                        width: auto;
                        flex-direction: row;
                        align-items: center;
                        gap: 16px;
                        flex-wrap: wrap;
                        border-right: 0;
                        border-bottom: 1px solid var(--line);
                    }
                    .railfoot {
                        display: none;
                    }
                    .nav {
                        flex-direction: row;
                        flex-wrap: wrap;
                    }
                    main {
                        margin-left: 0;
                    }
                    section {
                        padding: 48px 20px 56px;
                    }
                    .split,
                    .anatomy,
                    .sim,
                    .rules,
                    .roles {
                        grid-template-columns: 1fr;
                        gap: 28px;
                    }
                }
                @media (prefers-reduced-motion: reduce) {
                    .flip,
                    .role,
                    .act,
                    .star {
                        transition: none;
                    }
                }
            `}</style>
        </div>
    );
}
