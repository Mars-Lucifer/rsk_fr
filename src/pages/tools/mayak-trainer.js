import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";
import Block from "@/components/features/public/Block";

const problems = [
    {
        title: "Страх и сопротивление новому",
        text: "Тренажёр создаёт безопасную среду, где барьеры вроде «ИИ заберёт работу» или «у нас это не работает» разрушаются через личный опыт.",
        color: "bg-[var(--color-red-noise)] text-[var(--color-red)]",
    },
    {
        title: "Разобщённость команды",
        text: "Участники вынуждены видеть не только свою задачу, но и общий результат. Команда работает как единое целое или проигрывает.",
        color: "bg-[var(--color-orange-noise)] text-[var(--color-orange)]",
    },
    {
        title: "Разрыв стратегии и исполнения",
        text: "Индекс цифровой зрелости «ЗВЕЗДА» превращает абстрактную трансформацию в понятную карту управленческих действий.",
        color: "bg-[var(--color-blue-noise)] text-[var(--color-blue)]",
    },
    {
        title: "Отсутствие практических навыков ИИ",
        text: "Участники не слушают лекцию про инструменты, а решают рабочие задачи и забирают навыки в следующий рабочий день.",
        color: "bg-[var(--color-green-noise)] text-[var(--color-green-peace)]",
    },
];

const metrics = [
    { value: "+68%", label: "NPS участников" },
];

const foundations = [
    {
        id: "environment",
        title: "Триада «Среда - Деятельность - Сознание»",
        text: "МАЯК не пытается менять мышление лекцией. Он проектирует среду: поле, роли, карточки, таймер, команды и цифровые инструменты. В этой среде участники действуют, спорят, проверяют гипотезы и через проживание приходят к собственным выводам.",
    },
    {
        id: "galperin",
        title: "П.Я. Гальперин: поэтапное формирование действий",
        text: "Фреймворк «МАЯК ОКО» задаёт ориентировочную основу действия. Участник не просто пишет запрос к ИИ, а учится структурировать мышление через миссию, аудиторию, роль, контекст, ожидания и ограничения.",
    },
    {
        id: "vygotsky",
        title: "Л.С. Выготский: зона ближайшего развития",
        text: "Роль Инспектора создаёт точную обратную связь. Соседняя команда помогает увидеть ошибку, которую участник сам ещё не замечает, и показывает следующий достижимый шаг.",
    },
    {
        id: "rubtsov",
        title: "В.В. Рубцов: совместная распределённая деятельность",
        text: "Во втором этапе команда проходит тактические раунды с убывающим временем. Побеждает не набор сильных игроков, а команда, которая научилась доверять, спорить и координировать действия.",
    },
    {
        id: "kolb",
        title: "Дэвид Колб: цикл обучения через опыт",
        text: "В тренажёр встроены три точки рефлексии: стартовое намерение, осмысление индивидуального этапа и финальный командный вывод. Так действие превращается в опыт, который можно применять дальше.",
    },
    {
        id: "star",
        title: "Модель «ЗВЕЗДА» и индекс цифровой зрелости",
        text: "«ЗВЕЗДА» делает цифровую трансформацию измеримой: знания, внешние взаимодействия, единое цифровое пространство, защита данных, данные и аналитика, автоматизация.",
    },
    {
        id: "lencioni",
        title: "Патрик Ленсиони: 6 ролей против дисфункций",
        text: "Роли в МАЯКЕ не являются ярлыками. Это персональные миссии, которые помогают команде пройти через недоверие, страх конфликта, безответственность и равнодушие к результату.",
    },
];

const starModel = [
    ["З", "Знания и навыки", "развитие компетенций людей"],
    ["В", "Внешние взаимодействия", "отношения с клиентами и партнёрами"],
    ["Е", "Единое цифровое пространство", "связность систем и инфраструктуры"],
    ["З", "Защита данных", "управление цифровыми рисками"],
    ["Д", "Данные и аналитика", "управленческие решения на данных"],
    ["А", "Автоматизация", "освобождение от рутины"],
];

const roles = [
    { role: "Медиатор", heals: "Недоверие", power: "создаёт атмосферу уязвимости", color: "bg-[var(--color-blue-noise)]" },
    { role: "Капитан", heals: "Страх конфликта", power: "превращает спор в поиск истины", color: "bg-[var(--color-orange-noise)]" },
    { role: "Хранитель Маяка", heals: "Безответственность", power: "держит темп и фокус", color: "bg-[var(--color-green-noise)]" },
    { role: "Инспектор", heals: "Нетребовательность", power: "создаёт культуру проверки", color: "bg-[var(--color-red-noise)]" },
    { role: "Летописец", heals: "Безразличие к результату", power: "делает победу общей", color: "bg-[var(--color-blue-noise)]" },
    { role: "Инженер", heals: "Отсутствие фундамента", power: "собирает устойчивую среду", color: "bg-[var(--color-gray-plus-50)]" },
];

const directions = [
    {
        id: "education",
        iconSrc: "/images/mayak-classification-education-icon.png",
        artSrc: "/images/mayak-classification-education-art.png",
        title: "Образование",
        color: "#2f6df6",
        text: "Подготовка команд к работе в цифровой среде.",
        focus: ["Колледж (СПО)", "ВУЗ и ДПО", "Школа"],
    },
    {
        id: "state",
        iconSrc: "/images/mayak-classification-state-icon.png",
        artSrc: "/images/mayak-classification-state-art.png",
        title: "Государство и общество",
        color: "#44bd32",
        text: "Повышение эффективности и управляемости.",
        focus: ["Муниципалитеты", "Регионы и Федерация", "Законодатели", "НКО"],
    },
    {
        id: "business",
        iconSrc: "/images/mayak-classification-business-icon.png",
        artSrc: "/images/mayak-classification-business-art.png",
        title: "Бизнес",
        color: "#ff7a00",
        text: "Ускорение внедрения ИИ и синхронизация команд.",
        focus: ["Сервис и инновации", "Промышленность"],
    },
    {
        id: "special",
        iconSrc: "/images/mayak-classification-special-icon.png",
        artSrc: "/images/mayak-classification-special-art.png",
        title: "Специализированная колода",
        color: "#8260d9",
        text: "Кастомизированная колода, созданная под вашу организацию и её задачи. Мы адаптируем содержание тренажёра:",
        focus: ["под вашу отрасль", "под ваши процессы", "под реальные вызовы команды"],
    },
];

const trainerCases = [
    {
        category: "state",
        title: "Городская Дума Нижнего Новгорода",
        text: "Командная сессия для согласования цифровых инициатив и перевода идей в понятную дорожную карту.",
        images: ["/images/mayak-classification-state-art.png", "/images/mayak-metrics-results.png"],
        color: "#44bd32",
    },
    {
        category: "business",
        title: "Мастерская управления «Сенеж»",
        text: "Практический модуль для управленческих команд: роли, быстрые раунды и проверяемый результат.",
        images: ["/images/mayak-trainer-board-hero.png"],
        color: "#2f6df6",
    },
    {
        category: "education",
        title: "Навигаторы детства",
        text: "Образовательный сценарий, где участники собирают ИИ-решения для реальных коммуникационных задач.",
        images: ["/images/mayak-classification-education-art.png", "/images/mayak-method-kolb.png"],
        color: "#2f6df6",
    },
    {
        category: "business",
        title: "Московское долголетие",
        text: "Кейс про сервисные сценарии, вовлечение аудитории и бережную настройку цифрового взаимодействия.",
        images: ["/images/mayak-metrics-growth-art-clean.png"],
        color: "#ff7a00",
    },
    {
        category: "special",
        title: "ВДЦ «Смена»",
        text: "Игровая командная механика для смен, где важно быстро распределить роли и удержать общий фокус.",
        images: ["/images/mayak-classification-special-art.png", "/images/mayak-method-roles.png"],
        color: "#8260d9",
    },
    {
        category: "education",
        title: "Колледжи из 20+ регионов",
        text: "Масштабируемый формат для СПО: участники учатся собирать рабочие промпты и проверять результат в команде.",
        images: ["/images/mayak-classification-business-art.png"],
        color: "#ff7a00",
    },
    {
        category: "state",
        title: "Региональные проектные команды",
        text: "Общая карта действий для команд, которым нужно быстро перейти от обсуждений к прототипам.",
        images: ["/images/mayak-method-star.png", "/images/mayak-metrics-tools-art-clean.png"],
        color: "#8063d7",
    },
    {
        category: "special",
        title: "Профессиональные сообщества",
        text: "Специализированные колоды под отраслевые задачи: безопасность, технологии, образование и управление.",
        images: ["/images/mayak-classification-special-icon.png", "/images/mayak-classification-special-art.png"],
        color: "#8260d9",
    },
    {
        category: "education",
        title: "Школьные команды",
        text: "Короткий формат для проектных дней: роли, задачи и быстрая проверка идей с ИИ.",
        images: ["/images/mayak-classification-education-icon.png", "/images/mayak-classification-education-art.png"],
        color: "#2f6df6",
    },
    {
        category: "education",
        title: "ВУЗ и ДПО",
        text: "Практика для слушателей, которым нужно перевести знания в рабочие инструменты.",
        images: ["/images/mayak-method-galperin.png"],
        color: "#2f6df6",
    },
    {
        category: "education",
        title: "Методические команды",
        text: "Кейс для разработки заданий, оценки результата и сборки единой логики курса.",
        images: ["/images/mayak-method-vygotsky.png", "/images/mayak-method-rubtsov.png"],
        color: "#2f6df6",
    },
    {
        category: "education",
        title: "СПО и проектные мастерские",
        text: "Команды собирают прототипы и учатся договариваться о качестве ответа.",
        images: ["/images/mayak-metrics-tools-art-clean.png"],
        color: "#2f6df6",
    },
    {
        category: "state",
        title: "Муниципальные команды",
        text: "Практика для быстрого согласования приоритетов, ограничений и карты действий.",
        images: ["/images/mayak-classification-state-icon.png", "/images/mayak-classification-state-art.png"],
        color: "#44bd32",
    },
    {
        category: "state",
        title: "НКО и социальные проекты",
        text: "Участники ищут гипотезы для услуг, коммуникаций и поддержки жителей.",
        images: ["/images/mayak-metrics-growth-art-clean.png"],
        color: "#44bd32",
    },
    {
        category: "state",
        title: "Региональные штабы",
        text: "Помогает перевести большие стратегии в набор понятных командных шагов.",
        images: ["/images/mayak-method-star.png"],
        color: "#44bd32",
    },
    {
        category: "state",
        title: "Общественные советы",
        text: "Формат для диалога между разными стейкхолдерами и общей сборки решения.",
        images: ["/images/mayak-method-roles.png", "/images/mayak-metrics-results.png"],
        color: "#44bd32",
    },
    {
        category: "business",
        title: "Сервисные команды",
        text: "Тренажёр помогает описать клиентский путь и проверить идеи на быстрых раундах.",
        images: ["/images/mayak-classification-business-icon.png", "/images/mayak-classification-business-art.png"],
        color: "#ff7a00",
    },
    {
        category: "business",
        title: "Промышленные проекты",
        text: "Команды синхронизируют данные, автоматизацию, безопасность и операционные ограничения.",
        images: ["/images/mayak-method-star.png", "/images/mayak-metrics-tools-art-clean.png"],
        color: "#ff7a00",
    },
    {
        category: "business",
        title: "Продуктовые команды",
        text: "Формат для проверки гипотез, ценности для клиента и ролей в команде.",
        images: ["/images/mayak-metrics-nps-art-clean.png"],
        color: "#ff7a00",
    },
    {
        category: "business",
        title: "Инновационные офисы",
        text: "Помогает быстро собрать первый прототип и понять, где ИИ даёт реальный эффект.",
        images: ["/images/mayak-trainer-board-hero.png"],
        color: "#ff7a00",
    },
    {
        category: "special",
        title: "Отраслевые эксперты",
        text: "Сборка специальной колоды под узкую предметную задачу и свой язык команды.",
        images: ["/images/mayak-classification-special-icon.png", "/images/mayak-classification-special-art.png"],
        color: "#8260d9",
    },
    {
        category: "special",
        title: "Наука и технологии",
        text: "Кейс для команд, где нужно быстро собрать гипотезы, протоколы и критерии проверки.",
        images: ["/images/mayak-method-galperin.png", "/images/mayak-method-kolb.png"],
        color: "#8260d9",
    },
    {
        category: "special",
        title: "Безопасность и устойчивость",
        text: "Вариант для команд, где важны риски, регламенты, доверие и прозрачность решений.",
        images: ["/images/mayak-method-vygotsky.png"],
        color: "#8260d9",
    },
    {
        category: "special",
        title: "Профессиональные ассоциации",
        text: "Тренажёр помогает экспертам разных профилей собрать общую карту действий.",
        images: ["/images/mayak-method-roles.png", "/images/mayak-metrics-results.png"],
        color: "#8260d9",
    },
];

const quickNav = [
    { href: "#overview", label: "Тренажер МАЯК" },
    { href: "#tasks", label: "Задачи" },
    { href: "#about", label: "О тренажере" },
    { href: "#metrics", label: "Цифры" },
    { href: "#methodology", label: "Методология" },
    { href: "#directions", label: "Классификация и кейсы" },
    { href: "#lead", label: "Оставить заявку" },
];

const heroPeopleSlides = [
    {
        src: "/images/mayak-hero-people-source.png",
        alt: "Команда участников тренажёра МАЯК",
        width: 2400,
        height: 1800,
        className: "mayak-hero-people",
    },
    {
        src: "/images/mayak-hero-people-alt-v3.png",
        alt: "Участники играют в тренажёр МАЯК за игровым полем",
        width: 1672,
        height: 941,
        className: "mayak-hero-people mayak-hero-people-alt",
    },
];

const flowStages = [
    {
        badge: "Этап 01",
        title: "Я — Цифровой Эксперт",
        lead: "Каждый получает рабочую ИИ-компетенцию",
        image: "/images/mayak-flow-expert.jpg",
        imageWidth: 1280,
        imageHeight: 999,
        paragraphs: [
            "Каждый участник выбирает одно из направлений: текст, данные, изображение, видео, аудио или интерактив; осваивает конкретные ИИ-инструменты и получает практический навык, который можно применять сразу.",
            "Результат: у каждого появляется «рабочая компетенция», а не просто знание.",
        ],
    },
    {
        badge: "Этап 02",
        title: "Мы — Цифровая Организация",
        lead: "Команда начинает работать как единая система",
        image: "/images/mayak-flow-organization.jpg",
        imageWidth: 1280,
        imageHeight: 1008,
        paragraphs: [
            "Команда объединяет навыки участников, решает реальные задачи, распределяет роли и ответственность, а затем вырабатывает общее решение.",
            "Результат: команда начинает работать как единая система.",
        ],
    },
    {
        badge: "Платформа",
        title: "Тренажер МАЯК",
        lead: "Цифровой слой, который превращает задания в реальные решения",
        image: "/images/mayak-flow-oko.jpg",
        imageWidth: 1600,
        imageHeight: 1000,
        paragraphs: [
            "Каждое задание в тренажёре связано с цифровой платформой: участники получают данные и инструкции, используют конкретные ИИ-инструменты и формируют решения прямо в процессе.",
            "Встроенный конструктор МАЯК-ОКО помогает правильно формулировать запросы к ИИ и получать предсказуемый результат.",
        ],
    },
];

function SectionTitle({ eyebrow, title, text, id }) {
    return (
        <div id={id} className="scroll-mt-[5rem] col-span-full flex flex-col gap-[0.5rem]">
            {eyebrow ? <span className="w-fit rounded-full bg-[var(--color-blue-noise)] px-[0.875rem] py-[0.375rem] text-[0.75rem] font-semibold text-[var(--color-blue)]">{eyebrow}</span> : null}
            <h2>{title}</h2>
            {text ? <p className="big max-w-[52rem] text-[var(--color-gray-black)]">{text}</p> : null}
        </div>
    );
}

function FlowStageCard({ stage }) {
    const imageLabel = `${stage.badge}: ${stage.title}`;

    return (
        <article className="mayak-flow-card">
            <div className="mayak-flow-copy flex flex-col gap-[0.75rem]">
                <span className="mayak-flow-badge">{stage.badge}</span>
                <h2 className="mayak-flow-title max-w-[22rem] text-[clamp(1.7rem,2.35vw,2.55rem)] leading-[1.05] text-[var(--color-black)]">{stage.title}</h2>
                <p className="max-w-[22rem] text-[clamp(1.1rem,1.5vw,1.45rem)] font-medium leading-[1.22] text-[#9ca0aa]">{stage.lead}</p>
            </div>
            <button type="button" className="mayak-flow-visual" onClick={() => window.dispatchEvent(new CustomEvent("mayak-open-image", { detail: { image: stage.image, label: imageLabel } }))} aria-label="Открыть изображение этапа">
                    <Image
                        src={stage.image}
                        alt={imageLabel}
                        width={stage.imageWidth}
                        height={stage.imageHeight}
                        className="mayak-flow-image"
                    />
            </button>
            <div className="flex flex-col gap-[1.25rem] text-[1rem] font-medium leading-[1.6] text-[#4f5664]">
                {stage.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                ))}
            </div>
        </article>
    );
}

function ProblemIcon({ index }) {
    if (index === 0) {
        return (
            <svg viewBox="0 0 48 48" aria-hidden="true">
                <path d="M24 6 38 12v11c0 9.2-5.7 15.8-14 19-8.3-3.2-14-9.8-14-19V12l14-6Z" />
                <path d="M24 17v10" />
                <path d="M24 33h.1" />
            </svg>
        );
    }

    if (index === 1) {
        return (
            <svg viewBox="0 0 48 48" aria-hidden="true">
                <path d="M19 24a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" />
                <path d="M7 40c.8-7.4 5.1-11.1 12-11.1S30.2 32.6 31 40" />
                <path d="M32 23a5.5 5.5 0 1 0 0-11" />
                <path d="M32 29c5.4.5 8.5 4 9 11" />
            </svg>
        );
    }

    if (index === 2) {
        return (
            <svg viewBox="0 0 48 48" aria-hidden="true">
                <path d="m9 34 9-9 7 7 14-18" />
                <path d="M34 14h5v5" />
                <path d="m12 14 8 8" />
                <path d="m20 14-8 8" />
                <path d="M8 39h32" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
            <path d="M8 18 24 10l16 8-16 8-16-8Z" />
            <path d="M14 22v9c0 3.3 4.5 6 10 6s10-2.7 10-6v-9" />
            <path d="M40 18v10" />
        </svg>
    );
}

function DirectionCard({ direction, isSelected, onSelect }) {
    const title =
        direction.id === "special" ? (
            <>
                Специализированная
                <br />
                колода
            </>
        ) : (
            direction.title
        );

    return (
        <button
            type="button"
            className={`mayak-direction-card mayak-direction-${direction.id} ${isSelected ? "mayak-direction-card-active" : ""}`}
            style={{ "--direction-color": direction.color }}
            onClick={onSelect}
            aria-pressed={isSelected}
        >
            <div className="mayak-direction-content relative z-[1] flex min-h-[21rem] min-w-0 flex-col">
                <div className="mayak-direction-heading mb-[1.5rem] flex min-w-0 items-start gap-[1rem]">
                    <Image src={direction.iconSrc} alt="" width={110} height={110} className="h-[4.25rem] w-[4.25rem] flex-shrink-0 rounded-[1.05rem]" />
                    <h3 className="mayak-direction-title min-w-0 break-words text-[1.02rem] font-extrabold uppercase leading-[1.18] tracking-[0.01em] text-[var(--color-black)]">{title}</h3>
                </div>
                <p className="mayak-direction-text break-words text-[0.92rem] font-medium leading-[1.55] text-[var(--color-gray-black)]">{direction.text}</p>
                <ul className="mayak-direction-list mt-auto flex min-w-0 flex-col gap-[0.75rem]">
                    {direction.focus.map((item) => (
                        <li key={item} className="flex items-start gap-[0.75rem] text-[0.9rem] font-bold leading-[1.35] text-[var(--color-black)]">
                            <span className="mt-[0.4rem] h-[0.45rem] w-[0.45rem] flex-shrink-0 rounded-full bg-[var(--direction-color)]" />
                            <span className="min-w-0 break-words">{item}</span>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="mayak-direction-mark">
                <Image src={direction.artSrc} alt="" width={410} height={500} className="h-full w-full object-contain" />
            </div>
        </button>
    );
}

function TrainerCaseCard({ caseItem, index, onOpen }) {
    const previewImage = caseItem.thumbUrl || caseItem.image;
    const imageAlt = caseItem.photoOnly ? caseItem.title || caseItem.originalName || "Фотография кейса" : `Кейс: ${caseItem.title}`;
    const caseLabel = caseItem.photoOnly
        ? "Открыть фотографию кейса"
        : `Открыть кейс: ${caseItem.title}`;

    if (caseItem.photoOnly) {
        return (
            <button type="button" className="mayak-case-card mayak-case-card-photo-only" style={{ "--case-color": caseItem.color }} onClick={() => onOpen(caseItem)} aria-label={caseLabel}>
                <div className="mayak-case-media">
                    <div className="mayak-case-photo">
                        <Image src={previewImage} alt={imageAlt} width={520} height={360} unoptimized className="h-full w-full object-cover" priority={index < 2} />
                    </div>
                </div>
            </button>
        );
    }

    return (
        <button type="button" className="mayak-case-card" style={{ "--case-color": caseItem.color }} onClick={() => onOpen(caseItem)} aria-label={caseLabel}>
            <div className={`mayak-case-media ${caseItem.images.length > 1 ? "mayak-case-media-double" : ""}`}>
                {caseItem.images.map((image, imageIndex) => (
                    <div key={image} className="mayak-case-photo">
                        <Image
                            src={image}
                            alt={imageAlt}
                            width={520}
                            height={360}
                            className="h-full w-full object-cover"
                            priority={index < 2 && imageIndex === 0}
                        />
                    </div>
                ))}
            </div>
            <div className="flex min-h-[9rem] flex-col gap-[0.75rem]">
                <h3 className="text-[1.05rem] font-extrabold leading-[1.2] text-[var(--color-black)]">{caseItem.title}</h3>
                <p className="text-[0.92rem] font-medium leading-[1.55] text-[var(--color-gray-black)]">{caseItem.text}</p>
            </div>
        </button>
    );
}

function CasePreviewModal({ caseItem, onClose }) {
    const closeButtonRef = useRef(null);
    const panelRef = useRef(null);

    useModalFocus({ isOpen: Boolean(caseItem), onClose, closeButtonRef, panelRef });

    if (!caseItem) return null;
    const images = caseItem.photoOnly ? [caseItem.image] : caseItem.images || [];
    const titleId = `case-modal-title-${caseItem.id || "static"}`;
    const imageAlt = caseItem.title || caseItem.originalName || "Фотография кейса";

    return (
        <div className="mayak-case-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
            <div className="mayak-case-modal-panel" ref={panelRef} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
                <h2 id={titleId} className="sr-only">{imageAlt}</h2>
                <button type="button" ref={closeButtonRef} className="mayak-case-modal-close" onClick={onClose} aria-label="Закрыть" autoFocus>
                    ×
                </button>
                <div className={`mayak-case-modal-media ${images.length > 1 ? "mayak-case-modal-media-grid" : ""}`}>
                    {images.map((image) => (
                        <div key={image} className="mayak-case-modal-frame">
                            <Image src={image} alt={imageAlt} width={1400} height={960} unoptimized={caseItem.photoOnly} className="h-full w-full object-contain" />
                        </div>
                    ))}
                </div>
                {!caseItem.photoOnly ? (
                    <div className="mayak-case-modal-copy">
                        <h3>{caseItem.title}</h3>
                        <p>{caseItem.text}</p>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function ImagePreviewModal({ image, label, onClose }) {
    const closeButtonRef = useRef(null);
    const panelRef = useRef(null);

    useModalFocus({ isOpen: Boolean(image), onClose, closeButtonRef, panelRef });

    if (!image) return null;
    const imageSize = getPreviewImageSize(image);

    return (
        <div className="mayak-case-modal" role="dialog" aria-modal="true" aria-label={label || "Предпросмотр изображения"} onClick={onClose}>
            <div className="mayak-case-modal-panel mayak-image-modal-panel" ref={panelRef} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
                <button type="button" ref={closeButtonRef} className="mayak-case-modal-close" onClick={onClose} aria-label="Закрыть" autoFocus>
                    ×
                </button>
                <div className="mayak-case-modal-media">
                    <div className="mayak-case-modal-frame mayak-image-modal-frame">
                        <Image src={image} alt={label || ""} width={imageSize.width} height={imageSize.height} unoptimized className="mayak-image-modal-image" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function useModalFocus({ isOpen, onClose, closeButtonRef, panelRef }) {
    useEffect(() => {
        if (!isOpen) return undefined;

        const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;

        document.body.style.overflow = "hidden";
        requestAnimationFrame(() => {
            closeButtonRef.current?.focus();
        });

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key !== "Tab" || !panelRef.current) return;

            const focusable = Array.from(
                panelRef.current.querySelectorAll(
                    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            ).filter((element) => element instanceof HTMLElement && !element.hasAttribute("disabled") && element.offsetParent !== null);

            if (!focusable.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", handleKeyDown);
            previousActiveElement?.focus?.();
        };
    }, [isOpen, onClose, closeButtonRef, panelRef]);
}

function getPreviewImageSize(image) {
    if (image.includes("mayak-flow-expert")) {
        return { width: 1280, height: 999 };
    }

    if (image.includes("mayak-flow-organization")) {
        return { width: 1280, height: 1008 };
    }

    return { width: 1600, height: 1000 };
}

function AccordionItem({ item, isOpen, onToggle }) {
    return (
        <div className={`rounded-[0.875rem] border bg-white transition ${isOpen ? "border-[var(--color-blue)] shadow-[0_0_0_3px_var(--color-blue-noise)]" : "border-[var(--color-gray-plus)]"}`}>
            <button type="button" onClick={onToggle} className={`inverted flex w-full min-w-0 items-center !justify-start !rounded-[0.875rem] text-left outline-none focus-visible:!shadow-[0_0_0_3px_var(--color-blue-noise)] hover:!bg-[var(--color-blue-noise)] ${isOpen ? "!bg-[var(--color-blue-noise)]" : "!bg-white"}`}>
                <span className="min-w-0 whitespace-normal break-words text-[0.875rem] font-semibold leading-snug text-[var(--color-black)]">{item.title}</span>
            </button>
        </div>
    );
}

function NumberedCard({ number, title, text }) {
    return (
        <div className="rounded-[1rem] border border-[var(--color-gray-plus-50)] bg-white p-[1rem] shadow-[0_0.5rem_1.5rem_rgba(0,0,0,0.03)]">
            <span className="mb-[0.75rem] flex h-[2rem] w-[2rem] items-center justify-center rounded-full bg-[var(--color-blue)] text-[0.875rem] font-bold text-white">{number}</span>
            <h6 className="text-[var(--color-black)]">{title}</h6>
            {text ? <p className="mt-[0.25rem] text-[var(--color-black)] opacity-75">{text}</p> : null}
        </div>
    );
}

function SchemeFrame({ active, title, children }) {
    return (
        <Block className="!col-span-full min-h-full !bg-[var(--color-gray-plus-50)]">
            <div className="flex flex-col gap-[0.5rem]">
                <span className="w-fit rounded-full bg-white px-[0.75rem] py-[0.375rem] text-[0.75rem] font-semibold text-[var(--color-blue)]">Схема</span>
                <h4 className="text-[var(--color-black)]">{title}</h4>
                <p className="big max-w-[56rem] text-[var(--color-black)] opacity-75">{active.text}</p>
            </div>
            {children}
        </Block>
    );
}

const methodologyImages = {
    environment: {
        src: "/images/mayak-triad-methodology.png",
        alt: "Триада «Среда - Деятельность - Сознание» в МАЯК",
    },
    galperin: {
        src: "/images/mayak-method-galperin.png",
        alt: "Теория Гальперина в МАЯК",
    },
    vygotsky: {
        src: "/images/mayak-method-vygotsky.png",
        alt: "Культурно-историческая психология в основе МАЯК",
    },
    rubtsov: {
        src: "/images/mayak-method-rubtsov.png",
        alt: "Теория совместно-распределённой деятельности Рубцова",
    },
    star: {
        src: "/images/mayak-method-star.png",
        alt: "Модель ЗВЕЗДА и индекс цифровой зрелости",
    },
    kolb: {
        src: "/images/mayak-method-kolb.png",
        alt: "Цикл Колба в МАЯК",
    },
    lencioni: {
        src: "/images/mayak-method-roles.png",
        alt: "6 ролей как противоядие дисфункциям",
    },
};

function MethodologyImagePanel({ image }) {
    return (
        <button type="button" className="mayak-methodology-image-frame" onClick={() => window.dispatchEvent(new CustomEvent("mayak-open-image", { detail: { image: image.src, label: image.alt } }))} aria-label="Открыть изображение методологии">
            <Image
                src={image.src}
                alt={image.alt}
                width={6676}
                height={3754}
                className="mayak-methodology-image"
                priority={false}
            />
        </button>
    );
}

function FoundationScheme({ activeId }) {
    const active = foundations.find((item) => item.id === activeId) || foundations[0];
    const image = methodologyImages[active.id];

    if (image) {
        return <MethodologyImagePanel image={image} />;
    }

    if (active.id === "galperin") {
        return (
            <SchemeFrame active={active} title="Навык формируется по шагам">
                <div className="grid grid-cols-5 gap-[0.75rem] max-[1100px]:grid-cols-3 max-[640px]:grid-cols-1">
                    {["Мотивация", "Ориентировка", "Действие", "Разбор", "Применение"].map((item, index) => (
                        <NumberedCard key={item} number={index + 1} title={item} text={index === 1 ? "МАЯК ОКО как основа запроса" : null} />
                    ))}
                </div>
                <div className="rounded-[1rem] bg-white p-[1rem]">
                    <p className="small uppercase tracking-[0.08em] text-[var(--color-gray-black)]">Ориентировочная основа</p>
                    <h5>Миссия → Аудитория → Я-роль → Контекст → Ожидания</h5>
                </div>
            </SchemeFrame>
        );
    }

    if (active.id === "vygotsky") {
        return (
            <SchemeFrame active={active} title="Зона ближайшего развития">
                <div className="grid grid-cols-3 gap-[0.75rem] max-[640px]:grid-cols-1">
                    <NumberedCard number="1" title="Текущий уровень" text="команда сдаёт задание так, как умеет сейчас" />
                    <NumberedCard number="2" title="Инспектор" text="видит ошибку и даёт точную обратную связь" />
                    <NumberedCard number="3" title="Следующий шаг" text="команда улучшает решение без лекции и давления" />
                </div>
                <div className="rounded-[1rem] bg-[var(--color-blue)] p-[1rem] text-white">
                    <h5 className="text-white">Правило 2 минут</h5>
                    <p className="text-[var(--color-blue-noise)]">Если Инспектор не реагирует вовремя, задание принимается автоматически. Это тренирует скорость и ответственность.</p>
                </div>
            </SchemeFrame>
        );
    }

    if (active.id === "rubtsov") {
        return (
            <SchemeFrame active={active} title="Совместный результат сильнее суммы ролей">
                <div className="grid grid-cols-3 gap-[0.75rem] max-[640px]:grid-cols-1">
                    {["40 минут", "30 минут", "20 минут"].map((item, index) => (
                        <NumberedCard key={item} number={index + 1} title={item} text={["планирование и распределение", "согласование и сборка", "решение под давлением"][index]} />
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-[0.75rem] max-[640px]:grid-cols-1">
                    <div className="rounded-[1rem] bg-white p-[1rem]"><h6>Уникальная функция</h6><p className="text-[var(--color-black)] opacity-75">каждый участник отвечает за свою часть общего результата</p></div>
                    <div className="rounded-[1rem] bg-white p-[1rem]"><h6>Координация</h6><p className="text-[var(--color-black)] opacity-75">победа появляется только при синхронизации действий</p></div>
                </div>
            </SchemeFrame>
        );
    }

    if (active.id === "kolb") {
        return (
            <SchemeFrame active={active} title="Цикл обучения через опыт">
                <div className="grid grid-cols-4 gap-[0.75rem] max-[900px]:grid-cols-2 max-[640px]:grid-cols-1">
                    {["Опыт", "Рефлексия", "Концепт", "Эксперимент"].map((item, index) => (
                        <NumberedCard key={item} number={index + 1} title={item} text={["действуем", "осмысляем", "называем принцип", "пробуем иначе"][index]} />
                    ))}
                </div>
                <div className="rounded-[1rem] bg-white p-[1rem]">
                    <h6>Три точки рефлексии</h6>
                    <p className="text-[var(--color-black)] opacity-75">стартовое намерение, индивидуальный вывод, финальный командный разбор</p>
                </div>
            </SchemeFrame>
        );
    }

    if (active.id === "star") {
        return (
            <SchemeFrame active={active} title="Индекс цифровой зрелости «ЗВЕЗДА»">
                <div className="grid grid-cols-3 gap-[0.75rem] max-[900px]:grid-cols-2 max-[640px]:grid-cols-1">
                    {starModel.map(([letter, title, text]) => (
                        <div key={`${letter}-${title}`} className="rounded-[1rem] border border-[var(--color-gray-plus-50)] bg-white p-[1rem]">
                            <span className="mb-[0.5rem] flex h-[2.25rem] w-[2.25rem] items-center justify-center rounded-[0.75rem] bg-[var(--color-blue)] text-[1rem] font-bold text-white">{letter}</span>
                            <h6 className="text-[var(--color-black)]">{title}</h6>
                            <p className="text-[var(--color-black)] opacity-75">{text}</p>
                        </div>
                    ))}
                </div>
            </SchemeFrame>
        );
    }

    if (active.id === "lencioni") {
        return (
            <SchemeFrame active={active} title="6 ролей как противоядие дисфункциям">
                <div className="grid grid-cols-3 gap-[0.75rem] max-[900px]:grid-cols-2 max-[640px]:grid-cols-1">
                    {roles.map((item) => (
                        <div key={item.role} className="rounded-[1rem] border border-[var(--color-gray-plus-50)] bg-white p-[1rem]">
                            <div className={`mb-[0.75rem] h-[0.5rem] w-[3rem] rounded-full ${item.color}`} />
                            <h6 className="text-[var(--color-black)]">{item.role}</h6>
                            <p className="small mt-[0.5rem] text-[var(--color-black)] opacity-75">Лечит: {item.heals}</p>
                            <p className="small mt-[0.25rem] text-[var(--color-black)] opacity-75">Суперсила: {item.power}</p>
                        </div>
                    ))}
                </div>
            </SchemeFrame>
        );
    }

    return (
        <div className="col-span-full flex h-full min-h-full items-center overflow-hidden rounded-[1.25rem] bg-white">
            <Image
                src="/images/mayak-triad-methodology.png"
                alt="Триада «Среда - Деятельность - Сознание» в МАЯК"
                width={1536}
                height={1024}
                className="h-full max-h-[30rem] w-full rounded-[1.25rem] object-contain"
                priority={false}
            />
        </div>
    );
}

function chunkItems(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

export default function MayakTrainerPage() {
    const casesScrollRef = useRef(null);
    const [openFoundation, setOpenFoundation] = useState(foundations[0].id);
    const [activeSection, setActiveSection] = useState(quickNav[0].href.slice(1));
    const [selectedDirection, setSelectedDirection] = useState(directions[0].id);
    const [activeHeroSlide, setActiveHeroSlide] = useState(0);
    const [casePhotos, setCasePhotos] = useState([]);
    const [openedCase, setOpenedCase] = useState(null);
    const [openedImage, setOpenedImage] = useState(null);
    const [openedImageLabel, setOpenedImageLabel] = useState("");
    const [caseScrollState, setCaseScrollState] = useState({ canLeft: false, canRight: false });
    const visiblePhotoCases = casePhotos
        .filter((photo) => photo.directionId === selectedDirection)
        .map((photo) => ({
            photoOnly: true,
            category: photo.directionId,
            image: photo.url,
            thumbUrl: photo.thumbUrl,
            title: photo.originalName || "Фотография кейса",
            originalName: photo.originalName,
            color: directions.find((direction) => direction.id === photo.directionId)?.color || "#2f6df6",
            id: photo.id,
        }));
    const visibleCases = visiblePhotoCases.length ? visiblePhotoCases : trainerCases.filter((caseItem) => caseItem.category === selectedDirection);
    const casePages = chunkItems(visibleCases, 3);
    const selectedDirectionTitle = directions.find((direction) => direction.id === selectedDirection)?.title || "";

    useEffect(() => {
        if (heroPeopleSlides.length < 2) return undefined;

        const intervalId = window.setInterval(() => {
            setActiveHeroSlide((current) => (current + 1) % heroPeopleSlides.length);
        }, 5000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    const scrollCasesRight = () => {
        const node = casesScrollRef.current;
        if (!node) return;
        node.scrollBy({ left: node.clientWidth, behavior: "smooth" });
    };

    const scrollCasesLeft = () => {
        const node = casesScrollRef.current;
        if (!node) return;
        node.scrollBy({ left: -node.clientWidth, behavior: "smooth" });
    };

    const handleQuickNavClick = (event, href) => {
        const id = href.slice(1);
        const target = document.getElementById(id);

        if (!target) return;

        event.preventDefault();
        window.history.pushState(null, "", href);
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveSection(id);
    };

    useEffect(() => {
        const node = casesScrollRef.current;
        if (!node) return undefined;
        let frame = 0;

        const updateScrollState = () => {
            frame = 0;
            const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
            const canLeft = node.scrollLeft > 2;
            const canRight = node.scrollLeft < maxScrollLeft - 2;

            setCaseScrollState((current) => {
                if (current.canLeft === canLeft && current.canRight === canRight) {
                    return current;
                }
                return { canLeft, canRight };
            });
        };

        const scheduleUpdate = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(updateScrollState);
        };

        node.scrollTo({ left: 0, behavior: "auto" });
        scheduleUpdate();
        node.addEventListener("scroll", scheduleUpdate, { passive: true });
        window.addEventListener("resize", scheduleUpdate);

        return () => {
            if (frame) {
                window.cancelAnimationFrame(frame);
            }
            node.removeEventListener("scroll", scheduleUpdate);
            window.removeEventListener("resize", scheduleUpdate);
        };
    }, [selectedDirection, visibleCases.length]);

    useEffect(() => {
        let cancelled = false;

        fetch("/api/mayak/case-photos")
            .then((response) => response.json())
            .then((payload) => {
                if (!cancelled && payload?.success && Array.isArray(payload.photos)) {
                    setCasePhotos(payload.photos);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setCasePhotos([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const handleOpenImage = (event) => {
            const image = event?.detail?.image;
            if (typeof image === "string" && image) {
                setOpenedImage(image);
                setOpenedImageLabel(typeof event?.detail?.label === "string" ? event.detail.label : "");
            }
        };

        window.addEventListener("mayak-open-image", handleOpenImage);
        return () => window.removeEventListener("mayak-open-image", handleOpenImage);
    }, []);

    useEffect(() => {
        if ("scrollRestoration" in window.history) {
            window.history.scrollRestoration = "manual";
        }

        if (!window.location.hash) {
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        }

        return () => {
            if ("scrollRestoration" in window.history) {
                window.history.scrollRestoration = "auto";
            }
        };
    }, []);

    useEffect(() => {
        const sectionIds = quickNav.map((item) => item.href.slice(1));
        const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
        let frame = 0;

        const updateActiveSection = () => {
            frame = 0;

            const checkpoint = window.innerHeight * 0.28;
            const current = sections.reduce((active, section) => {
                if (section.getBoundingClientRect().top <= checkpoint) {
                    return section.id;
                }
                return active;
            }, sectionIds[0]);

            setActiveSection(current);
        };

        const scheduleUpdate = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(updateActiveSection);
        };

        scheduleUpdate();
        window.addEventListener("scroll", scheduleUpdate, { passive: true });
        window.addEventListener("resize", scheduleUpdate);
        window.addEventListener("hashchange", scheduleUpdate);

        return () => {
            if (frame) {
                window.cancelAnimationFrame(frame);
            }
            window.removeEventListener("scroll", scheduleUpdate);
            window.removeEventListener("resize", scheduleUpdate);
            window.removeEventListener("hashchange", scheduleUpdate);
        };
    }, []);

    return (
        <Layout meta={{ title: "Тренажер МАЯК" }}>
            <Head>
                <title>Тренажер МАЯК</title>
            </Head>

            <Header>
                <h5>Тренажер МАЯК</h5>
            </Header>

            <nav className="sticky top-0 z-20 flex gap-[0.5rem] overflow-x-auto border-b border-[var(--color-gray-plus-50)] bg-white/95 px-[1.5rem] py-[0.75rem] backdrop-blur max-[640px]:px-[0.75rem]">
                {quickNav.map((item) => {
                    const id = item.href.slice(1);
                    const isActive = activeSection === id;

                    return (
                        <a key={item.href} href={item.href} onClick={(event) => handleQuickNavClick(event, item.href)} className={`mayak-top-nav-link ${isActive ? "mayak-top-nav-link-active" : ""}`}>
                            {item.label}
                        </a>
                    );
                })}
            </nav>

            <div className="hero content-start gap-y-[2rem] !py-[3rem] max-[640px]:!px-[0.75rem]">
                <section id="overview" className="mayak-hero-overview col-span-full grid min-h-[24rem] scroll-mt-[5rem] grid-cols-12 items-center gap-0 overflow-hidden rounded-[1.5rem] bg-white max-[1100px]:grid-cols-1">
                    <div className="mayak-hero-copy relative z-[2] col-span-5 flex flex-col gap-[1.25rem] py-[1.25rem] max-[1100px]:col-span-1 max-[640px]:py-[1rem]">
                        <div className="flex flex-wrap items-center gap-[0.75rem]">
                            <span className="w-fit rounded-full bg-[var(--color-blue)] px-[1rem] py-[0.625rem] text-[0.875rem] font-semibold text-white shadow-[0_0_0_4px_var(--color-blue-noise)]">Фиджитал-тренажёр МАЯК</span>
                        </div>
                        <div className="flex flex-col gap-[0.75rem]">
                            <h1>Почему цифровая трансформация буксует — даже если есть технологии</h1>
                            <p className="big max-w-[46rem] text-[var(--color-gray-black)]">
                                Команды не сопротивляются технологиям. Они не понимают, как работать вместе в новой реальности.
                            </p>
                        </div>
                        <div className="mayak-hero-outcomes flex max-w-[42rem] flex-col gap-[0.5rem] text-[var(--color-gray-black)]">
                            <p className="big font-semibold text-[var(--color-black)]">Тренажёр «МАЯК» за 1 день:</p>
                            <ul className="flex flex-col gap-[0.35rem] text-[1rem] font-medium leading-[1.45]">
                                <li>снимает сопротивление</li>
                                <li>выравнивает команду</li>
                                <li>даёт первые реальные решения под задачи организации</li>
                            </ul>
                        </div>
                        <div className="flex flex-wrap gap-[0.75rem]">
                            <a href="#lead" onClick={(event) => handleQuickNavClick(event, "#lead")} className="button blue mayak-final-cta-button">
                                Оставить заявку
                            </a>
                        </div>
                    </div>

                    <div className="mayak-hero-visual relative col-span-7 flex min-h-[24rem] items-center justify-center overflow-visible max-[1100px]:col-span-1">
                        <Image
                            src="/images/mayak-hero-bg-soft.png"
                            alt=""
                            width={1536}
                            height={1024}
                            priority
                            aria-hidden="true"
                            className="mayak-hero-bg"
                        />
                        <Image
                            src="/images/mayak-hero-people-source.png"
                            alt="Команда участников тренажёра МАЯК"
                            width={2400}
                            height={1800}
                            priority
                            className={activeHeroSlide === 0 ? "mayak-hero-people mayak-hero-people-visible" : "mayak-hero-people mayak-hero-people-hidden"}
                        />
                        <Image
                            src="/images/mayak-hero-people-alt-v3.png"
                            alt="Участники играют в тренажёр МАЯК за игровым полем"
                            width={1672}
                            height={941}
                            priority
                            className={activeHeroSlide === 1 ? "mayak-hero-people mayak-hero-people-alt mayak-hero-people-visible" : "mayak-hero-people mayak-hero-people-alt mayak-hero-people-hidden"}
                        />
                    </div>
                </section>

                <section id="tasks" className="mayak-tasks-section col-span-full scroll-mt-[5rem]">
                    <div className="mayak-tasks-heading">
                        <span className="mayak-section-pill">Какие задачи решает МАЯК</span>
                        <h2>
                            Тренажёр МАЯК помогает преодолевать
                            <br />
                            главные барьеры цифровой трансформации
                        </h2>
                        <p>
                            Тренажёр работает не с нехваткой технологий, а с человеческим сопротивлением изменениям: страхом, разрывом между отделами и отсутствием общего языка.
                        </p>
                    </div>

                    <div className="mayak-tasks-grid">
                        {problems.map((problem, index) => (
                            <article key={problem.title} className={`mayak-task-card mayak-task-card-${index + 1}`}>
                                <span className="mayak-task-number">{index + 1}</span>
                                <div className="mayak-task-icon">
                                    <ProblemIcon index={index} />
                                </div>
                                <h3>{problem.title}</h3>
                                <span className="mayak-task-line" />
                                <p>{problem.text}</p>
                            </article>
                        ))}
                    </div>

                    <div className="mayak-tasks-summary">
                        <div className="mayak-tasks-summary-icon" aria-hidden="true" />
                        <div>
                            <h3>МАЯК превращает сложности трансформации в управляемый процесс.</h3>
                            <p>Не теория. Не абстракция. Практика, которая меняет мышление и результаты.</p>
                        </div>
                    </div>
                </section>

                <section id="about" className="mayak-about-flow col-span-full scroll-mt-[5rem]">
                    <Block className="mayak-trainer-essence !col-span-full !rounded-[1.5rem] !p-[1.5rem]">
                        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(18rem,0.7fr)] gap-[2rem] max-[900px]:grid-cols-1">
                            <div className="flex flex-col gap-[1rem]">
                                <span className="w-fit rounded-full bg-white px-[0.875rem] py-[0.375rem] text-[0.75rem] font-semibold text-[var(--color-blue)]">О тренажере</span>
                                <h2 className="max-w-[58rem]">МАЯК — не обучение. Это управляемая симуляция вашей организации</h2>
                                <p className="big max-w-[52rem] text-[var(--color-gray-black)]">
                                    «МАЯК» — это фиджитал-тренажёр, в котором команда за 1 день проживает цифровую трансформацию в сжатом формате, сталкивается с реальными управленческими конфликтами, учится договариваться и принимать решения, сразу применяет ИИ под рабочие задачи.
                                </p>
                            </div>
                            <div className="mayak-trainer-essence-panel flex flex-col justify-between gap-[1.25rem] rounded-[1.125rem] bg-white p-[1.25rem]">
                                <ul className="flex flex-col gap-[0.75rem] text-[1rem] font-semibold leading-[1.45] text-[var(--color-black)]">
                                    <li>проживает цифровую трансформацию в сжатом формате</li>
                                    <li>сталкивается с реальными управленческими конфликтами</li>
                                    <li>учится договариваться и принимать решения</li>
                                    <li>сразу применяет ИИ под рабочие задачи</li>
                                </ul>
                                <p className="big font-bold text-[var(--color-black)]">
                                    Это не теория. Это среда, в которой изменения происходят через действие.
                                </p>
                            </div>
                        </div>
                    </Block>

                    <div className="grid grid-cols-3 gap-[1.5rem] max-[1200px]:grid-cols-1">
                        {flowStages.map((stage) => (
                            <FlowStageCard key={stage.badge} stage={stage} />
                        ))}
                    </div>
                </section>

                <SectionTitle
                    id="metrics"
                    eyebrow="Результаты"
                    title="МАЯК в цифрах"
                />

                <div className="col-span-full flex flex-col gap-[1.5rem]">
                    <div className="grid grid-cols-3 gap-[1.5rem] max-[1100px]:grid-cols-1">
                        <div className="mayak-result-card mayak-result-card-blue">
                            <Image
                                src="/images/mayak-metrics-growth-art-clean.png"
                                alt=""
                                width={380}
                                height={360}
                                className="mayak-result-art"
                            />
                            <div className="mayak-result-card-content">
                                <div className="mayak-result-header">
                                    <span className="mayak-result-icon mayak-result-icon-blue">
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M3 8.2 12 4l9 4.2-9 4.2L3 8.2Z" />
                                            <path d="M6.5 10v5.1c0 1.4 2.5 3.1 5.5 3.1s5.5-1.7 5.5-3.1V10" />
                                            <path d="M21 8.2v5" />
                                        </svg>
                                    </span>
                                    <h4>Рост ИИ-компетенций</h4>
                                </div>
                                <p className="big text-[var(--color-gray-black)]">Средний уровень владения инструментами ИИ</p>
                                <div className="mayak-result-values flex items-end gap-[1rem]">
                                    <span className="mayak-result-number text-[var(--color-gray-black)]">3,4</span>
                                    <span className="pb-[0.75rem] text-[2rem] text-[var(--color-gray-black)]">→</span>
                                    <span className="mayak-result-number text-[var(--color-blue)]">5,4</span>
                                </div>
                            </div>
                        </div>

                        <div className="mayak-result-card mayak-result-card-green">
                            <Image
                                src="/images/mayak-metrics-tools-art-clean.png"
                                alt=""
                                width={380}
                                height={360}
                                className="mayak-result-art"
                            />
                            <div className="mayak-result-card-content">
                                <div className="mayak-result-header">
                                    <span className="mayak-result-icon mayak-result-icon-green">
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M8 7V5.8A1.8 1.8 0 0 1 9.8 4h4.4A1.8 1.8 0 0 1 16 5.8V7" />
                                            <path d="M4 8h16v10.2A1.8 1.8 0 0 1 18.2 20H5.8A1.8 1.8 0 0 1 4 18.2V8Z" />
                                            <path d="M4 12h16" />
                                            <path d="M10 12v2h4v-2" />
                                        </svg>
                                    </span>
                                    <h4>Освоенные инструменты</h4>
                                </div>
                                <p className="big text-[var(--color-gray-black)]">Среднее количество используемых инструментов в работе</p>
                                <div className="mayak-result-values flex items-end gap-[1rem]">
                                    <span className="mayak-result-number text-[var(--color-gray-black)]">3,4</span>
                                    <span className="pb-[0.75rem] text-[2rem] text-[var(--color-gray-black)]">→</span>
                                    <span className="mayak-result-number text-[var(--color-green-peace)]">7,8</span>
                                </div>
                            </div>
                        </div>

                        <div className="mayak-result-card mayak-result-card-purple">
                            <Image
                                src="/images/mayak-metrics-nps-art-clean.png"
                                alt=""
                                width={380}
                                height={360}
                                className="mayak-result-art"
                            />
                            <div className="mayak-result-card-content">
                                <div className="mayak-result-header">
                                    <span className="mayak-result-icon mayak-result-icon-purple">
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                                            <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                                            <path d="M3.5 20c.4-3.4 2-5.2 4.5-5.2s4.1 1.8 4.5 5.2" />
                                            <path d="M11.5 20c.4-3.4 2-5.2 4.5-5.2s4.1 1.8 4.5 5.2" />
                                        </svg>
                                    </span>
                                    <h4>{metrics[0].label}</h4>
                                </div>
                                <p className="big text-[var(--color-gray-black)]">Готовность рекомендовать тренажёр коллегам</p>
                                <div className="mayak-result-values">
                                    <span className="mayak-result-number text-[#8063d7]">{metrics[0].value}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p className="big text-[var(--color-gray-black)]">
                        Тренажёр прошли команды Городской Думы Нижнего Новгорода, Мастерской управления «Сенеж», «Навигаторов детства», «Московского долголетия», ВДЦ «Смена», колледжей из 20+ регионов России и другие.
                    </p>
                </div>

                <Block id="methodology" className="mayak-methodology-block !col-span-full scroll-mt-[5rem] !bg-[var(--color-gray-plus-50)]">
                    <div className="mayak-methodology-grid grid items-start gap-[1.25rem] lg:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.45fr)] max-[900px]:grid-cols-1">
                        <div className="flex flex-col gap-[0.875rem]">
                            <div className="mb-[0.5rem] flex flex-col gap-[0.5rem]">
                                <span className="w-fit rounded-full bg-white px-[0.875rem] py-[0.375rem] text-[0.75rem] font-semibold text-[var(--color-blue)]">Методология</span>
                                <h2>Что под капотом</h2>
                                <p className="big text-[var(--color-gray-black)]">Снаружи МАЯК выглядит как игра, но за каждым игровым решением стоит научная логика. Выберите принцип ниже - справа откроется соответствующая картинка.</p>
                            </div>
                            {foundations.map((item) => (
                                <AccordionItem key={item.id} item={item} isOpen={openFoundation === item.id} onToggle={() => setOpenFoundation(item.id)} />
                            ))}
                        </div>
                        <FoundationScheme activeId={openFoundation} />
                    </div>
                </Block>

                <SectionTitle
                    id="directions"
                    eyebrow="Классификация и кейсы"
                    title="Сценарии, адаптированные под тип вашей организации"
                    text="9 направлений с готовыми кейсами и заданиями, которые отражают реальные управленческие и рабочие ситуации."
                />

                <section id="classification" className="col-span-full grid grid-cols-4 gap-[1.5rem] max-[1400px]:grid-cols-2 max-[640px]:grid-cols-1">
                    {directions.map((direction) => (
                        <DirectionCard
                            key={direction.id}
                            direction={direction}
                            isSelected={selectedDirection === direction.id}
                            onSelect={() => setSelectedDirection(direction.id)}
                        />
                    ))}
                </section>

                <Block className="mayak-cases-panel !col-span-full !overflow-hidden !bg-[var(--color-gray-plus-50)]">
                    <div className="mayak-cases-toolbar">
                        <span className="small uppercase tracking-[0.08em] text-[var(--color-gray-black)]">Кейсы направления: {selectedDirectionTitle}</span>
                    </div>
                    <div ref={casesScrollRef} className="mayak-cases-scroll" aria-label="Кейсы применения тренажёра">
                        <div className="mayak-cases-track">
                            {casePages.map((page, pageIndex) => (
                                <div className="mayak-cases-page" key={`case-page-${pageIndex}`}>
                                    {page.map((caseItem, index) => (
                                        <TrainerCaseCard key={caseItem.id || caseItem.title} caseItem={caseItem} index={pageIndex * 3 + index} onOpen={setOpenedCase} />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                    {(caseScrollState.canLeft || caseScrollState.canRight) ? (
                        <>
                            {caseScrollState.canLeft ? (
                            <button type="button" className="mayak-cases-arrow mayak-cases-arrow-left" onClick={scrollCasesLeft} aria-label="Посмотреть кейсы влево">
                                <span aria-hidden="true">←</span>
                            </button>
                            ) : null}
                            {caseScrollState.canRight ? (
                            <button type="button" className="mayak-cases-arrow mayak-cases-arrow-right" onClick={scrollCasesRight} aria-label="Посмотреть кейсы вправо">
                                <span aria-hidden="true">→</span>
                            </button>
                            ) : null}
                        </>
                    ) : null}
                </Block>

                <CasePreviewModal caseItem={openedCase} onClose={() => setOpenedCase(null)} />
                <ImagePreviewModal
                    image={openedImage}
                    label={openedImageLabel}
                    onClose={() => {
                        setOpenedImage(null);
                        setOpenedImageLabel("");
                    }}
                />

                <Block id="lead" className="mayak-final-cta !col-span-full scroll-mt-[5rem] !rounded-[1.5rem] !p-[1.5rem]">
                    <div className="mayak-final-cta-grid">
                        <div className="mayak-final-cta-copy">
                            <h2>Попробуйте МАЯК для вашей команды</h2>
                            <div className="mayak-final-cta-points">
                                <div>
                                    <span className="mayak-final-cta-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24">
                                            <path d="M12 4.75a7.25 7.25 0 1 0 7.25 7.25" />
                                            <path d="M12 8.2V12l3.1 1.85" />
                                            <path d="M17.15 4.2h3.15v3.15" />
                                            <path d="m20.05 4.45-5.25 5.25" />
                                        </svg>
                                    </span>
                                    <div>
                                        <h3>За один день вы увидите:</h3>
                                        <ul className="mayak-final-cta-list">
                                            <li>как работает ваша команда в условиях изменений</li>
                                            <li>где возникают реальные барьеры</li>
                                            <li>какие решения можно внедрить сразу</li>
                                        </ul>
                                    </div>
                                </div>
                                <div>
                                    <span className="mayak-final-cta-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24">
                                            <path d="M14.3 9.9a4.2 4.2 0 1 0-6.75 3.35" />
                                            <path d="M4.4 19.4c.75-3.9 3.45-5.85 8.1-5.85" />
                                            <path d="M17.2 13.5v6" />
                                            <path d="M14.2 16.5h6" />
                                        </svg>
                                    </span>
                                    <div>
                                        <h3>Оставьте заявку — мы:</h3>
                                        <ul className="mayak-final-cta-list">
                                            <li>разберём задачи вашей команды</li>
                                            <li>ответим на вопросы</li>
                                            <li>предложим формат проведения</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mayak-final-cta-panel">
                            <p>Свяжемся в течение 24 часов и подберём удобный формат</p>
                            <a href="https://forms.yandex.ru/cloud/69f0643b4936392f97e12c8c" target="_blank" rel="noreferrer" className="button blue mayak-final-cta-button">
                                Оставить заявку
                            </a>
                            <div className="mayak-final-cta-secure">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                                    <path d="M6 11h12v9H6z" />
                                </svg>
                                <span>Ваши данные защищены и не передаются третьим лицам</span>
                            </div>
                        </div>
                    </div>
                </Block>
            </div>
            <style jsx global>{`
                .mayak-top-nav-link {
                    flex-shrink: 0;
                    border: 1px solid transparent;
                    border-radius: 999px;
                    background: var(--color-gray-plus-50);
                    color: var(--color-gray-black);
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 0.5rem 0.875rem;
                    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
                }

                .mayak-top-nav-link:hover,
                .mayak-top-nav-link-active {
                    background: var(--color-blue-noise);
                    border-color: var(--color-blue);
                    color: var(--color-blue);
                    box-shadow: 0 0 0 3px var(--color-blue-noise);
                }

                .mayak-hero-overview {
                    position: relative;
                    isolation: isolate;
                    max-width: 100%;
                    min-width: 0;
                    grid-template-columns: minmax(26rem, 0.78fr) minmax(0, 1.22fr);
                    min-height: clamp(28rem, 36vw, 34rem);
                    box-shadow: 0 1.5rem 3.5rem rgba(8, 9, 10, 0.055);
                }

                .mayak-hero-copy {
                    grid-column: 1;
                    min-width: 0;
                    background: linear-gradient(90deg, #ffffff 0%, #ffffff 78%, rgba(255, 255, 255, 0) 100%);
                    padding-left: clamp(2rem, 3vw, 3.25rem);
                    padding-right: clamp(1rem, 1.6vw, 1.75rem);
                }

                .mayak-hero-copy h1 {
                    max-width: 36rem;
                    overflow-wrap: break-word;
                }

                .mayak-hero-copy p {
                    max-width: 30rem;
                }

                .mayak-hero-visual {
                    grid-column: 2;
                    min-width: 0;
                    min-height: clamp(28rem, 36vw, 34rem);
                }

                .mayak-hero-bg {
                    position: absolute;
                    z-index: 0;
                    width: min(64rem, 118%);
                    height: auto;
                    max-width: none;
                    right: -4%;
                    top: 42%;
                    transform: translateY(-50%) scale(1.04);
                    opacity: 0.96;
                    pointer-events: none;
                    user-select: none;
                }

                .mayak-hero-people {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    z-index: 1;
                    height: auto;
                    width: min(62rem, 118%);
                    max-width: none;
                    transform: translate(-58%, -48%);
                    object-fit: contain;
                    opacity: 1;
                    pointer-events: none;
                    user-select: none;
                    transition: opacity 0.7s ease-in-out;
                }

                .mayak-hero-people-visible {
                    opacity: 1;
                }

                .mayak-hero-people-hidden {
                    opacity: 0;
                    pointer-events: none;
                }

                .mayak-hero-people-alt {
                    width: min(59rem, 112%);
                    transform: translate(-53%, -47%);
                }

                .mayak-sidebar-collapsed + main .mayak-hero-overview {
                    grid-template-columns: minmax(31rem, 0.82fr) minmax(0, 1.18fr);
                    min-height: clamp(30rem, 39vw, 38rem);
                }

                .mayak-sidebar-collapsed + main .mayak-hero-copy h1 {
                    max-width: 42rem;
                }

                .mayak-sidebar-collapsed + main .mayak-hero-copy p {
                    max-width: 34rem;
                }

                .mayak-sidebar-collapsed + main .mayak-hero-visual {
                    min-height: clamp(30rem, 39vw, 38rem);
                }

                .mayak-sidebar-collapsed + main .mayak-hero-bg {
                    width: min(84rem, 148%);
                    right: -18%;
                    transform: translateY(-50%) scale(1.08);
                }

                .mayak-sidebar-collapsed + main .mayak-hero-people {
                    width: min(66rem, 124%);
                    transform: translate(-65%, -48%);
                }

                .mayak-sidebar-collapsed + main .mayak-hero-people-alt {
                    width: min(63rem, 116%);
                    transform: translate(-59%, -47%);
                }

                .mayak-result-card {
                    position: relative;
                    min-height: 17.25rem;
                    overflow: hidden;
                    border: 1px solid var(--color-gray-plus-50);
                    border-radius: 1rem;
                    background: white;
                    padding: 1.5rem;
                    box-shadow: 0 1.25rem 2.5rem rgba(8, 9, 10, 0.035);
                }

                .mayak-result-art {
                    position: absolute;
                    right: -2.9rem;
                    bottom: -4.6rem;
                    width: min(17rem, 50%);
                    height: auto;
                    opacity: 0.66;
                    pointer-events: none;
                }

                .mayak-result-card-content {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    min-height: 100%;
                    flex-direction: column;
                    gap: 1rem;
                }

                .mayak-result-header {
                    display: grid;
                    grid-template-columns: 3rem minmax(0, 1fr);
                    align-items: center;
                    gap: 1.5rem;
                    min-height: 3rem;
                }

                .mayak-result-icon {
                    display: flex;
                    width: 3rem;
                    height: 3rem;
                    align-items: center;
                    justify-content: center;
                    border-radius: 0.75rem;
                    color: white;
                }

                .mayak-result-icon svg {
                    width: 1.65rem;
                    height: 1.65rem;
                    fill: none;
                    stroke: currentColor;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                    stroke-width: 1.8;
                }

                .mayak-result-icon-blue {
                    background: var(--color-blue);
                }

                .mayak-result-icon-green {
                    background: var(--color-green-peace);
                }

                .mayak-result-icon-purple {
                    background: #8063d7;
                }

                .mayak-result-number {
                    display: block;
                    font-size: clamp(2.5rem, 4vw, 3.4rem);
                    line-height: 0.95;
                    font-weight: 500;
                }

                .mayak-result-values {
                    margin-top: clamp(1.1rem, 2.6vw, 2.1rem);
                }

                .mayak-methodology-grid {
                    min-width: 0;
                    align-items: start;
                }

                .mayak-methodology-grid > * {
                    min-width: 0;
                }

                .mayak-methodology-grid button.inverted {
                    white-space: normal;
                }

                .mayak-methodology-grid button.inverted span {
                    min-width: 0;
                    white-space: normal;
                    overflow-wrap: anywhere;
                }

                .mayak-methodology-image-frame {
                    appearance: none;
                    display: flex;
                    height: auto;
                    max-width: 100%;
                    align-items: flex-start;
                    justify-content: center;
                    overflow: visible;
                    border: 0;
                    background: transparent;
                    padding: 0;
                    cursor: pointer;
                }

                .mayak-methodology-image {
                    display: block;
                    height: auto;
                    width: 100%;
                    max-width: none;
                    object-fit: contain;
                    object-position: center top;
                    border: 0;
                    border-radius: 0;
                    box-shadow: none;
                }

                .mayak-tasks-section {
                    display: flex;
                    flex-direction: column;
                    gap: clamp(1.5rem, 2.5vw, 2.25rem);
                    padding-left: clamp(2rem, 3vw, 3.25rem);
                }

                .mayak-section-pill {
                    width: fit-content;
                    border-radius: 999px;
                    background: var(--color-blue);
                    color: white;
                    font-size: 0.875rem;
                    font-weight: 800;
                    line-height: 1;
                    padding: 0.72rem 1rem;
                    box-shadow: 0 0 0 4px var(--color-blue-noise);
                }

                .mayak-tasks-heading {
                    display: flex;
                    max-width: 84rem;
                    flex-direction: column;
                    gap: 1rem;
                }

                .mayak-tasks-heading h2 {
                    max-width: 84rem;
                    color: var(--color-black);
                    font-size: 2.625rem;
                    font-weight: 700;
                    line-height: 122%;
                    letter-spacing: 0;
                }

                .mayak-tasks-heading p {
                    max-width: 46rem;
                    color: var(--color-gray-black);
                    font-size: 1.125rem;
                    font-weight: 500;
                    line-height: 1.55;
                }

                .mayak-tasks-grid {
                    --task-gap: clamp(1rem, 2.1vw, 2rem);
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: var(--task-gap);
                }

                .mayak-task-card {
                    position: relative;
                    display: grid;
                    grid-template-rows: 2.45rem 8.75rem 6.6rem 0.16rem 1fr;
                    min-height: 25rem;
                    border: 1px solid rgba(27, 39, 66, 0.08);
                    border-radius: 1.25rem;
                    background: white;
                    padding: clamp(1.5rem, 2vw, 2rem);
                    box-shadow: 0 1rem 2.5rem rgba(27, 39, 66, 0.07);
                }

                .mayak-task-card-1 {
                    z-index: 4;
                }

                .mayak-task-card-2 {
                    z-index: 3;
                }

                .mayak-task-card-3 {
                    z-index: 2;
                }

                .mayak-task-card-4 {
                    z-index: 1;
                }

                .mayak-task-card:not(:last-child)::after {
                    content: "";
                    position: absolute;
                    top: 9.25rem;
                    right: calc((var(--task-gap) * -1) - 0.35rem);
                    z-index: 8;
                    width: calc(var(--task-gap) + 2.35rem);
                    height: 1.25rem;
                    background:
                        radial-gradient(circle at 0.45rem 50%, white 0 0.24rem, #4c7dff 0.26rem 0.42rem, transparent 0.44rem),
                        linear-gradient(#4c7dff, #4c7dff) left 0.45rem top 50% / calc(100% - 0.75rem) 0.12rem no-repeat;
                    pointer-events: none;
                }

                .mayak-task-card:not(:last-child)::before {
                    content: "";
                    position: absolute;
                    top: calc(9.25rem + 0.39rem);
                    right: calc((var(--task-gap) * -1) - 0.35rem);
                    z-index: 9;
                    width: 0.62rem;
                    height: 0.62rem;
                    border-top: 0.14rem solid #4c7dff;
                    border-right: 0.14rem solid #4c7dff;
                    transform: rotate(45deg);
                    pointer-events: none;
                }

                .mayak-task-number {
                    display: flex;
                    width: 2.45rem;
                    height: 2.45rem;
                    align-items: center;
                    justify-content: center;
                    border-radius: 999px;
                    font-size: 1rem;
                    font-weight: 900;
                }

                .mayak-task-icon {
                    display: flex;
                    width: 5rem;
                    height: 5rem;
                    align-items: center;
                    justify-content: center;
                    align-self: center;
                    justify-self: center;
                    margin-top: 0.75rem;
                    border-radius: 1.1rem;
                }

                .mayak-task-icon svg {
                    width: 2.75rem;
                    height: 2.75rem;
                    fill: none;
                    stroke: currentColor;
                    stroke-width: 3;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                }

                .mayak-task-card h3 {
                    max-width: 17rem;
                    align-self: end;
                    color: var(--color-black);
                    font-size: clamp(1.35rem, 1.6vw, 1.7rem);
                    line-height: 1.15;
                }

                .mayak-task-line {
                    display: block;
                    width: 2.8rem;
                    height: 0.16rem;
                    align-self: start;
                    margin: 0.65rem 0 0;
                    border-radius: 999px;
                }

                .mayak-task-card p {
                    margin-top: 1.35rem;
                    color: var(--color-gray-black);
                    font-size: clamp(1rem, 1.1vw, 1.12rem);
                    font-weight: 600;
                    line-height: 1.45;
                }

                .mayak-task-card-1 {
                    --task-color: #ff5f6a;
                }

                .mayak-task-card-2 {
                    --task-color: #ff9f0a;
                }

                .mayak-task-card-3 {
                    --task-color: #4c7dff;
                }

                .mayak-task-card-4 {
                    --task-color: #48a83f;
                }

                .mayak-task-card .mayak-task-number {
                    background: color-mix(in srgb, var(--task-color) 18%, white);
                    color: var(--task-color);
                }

                .mayak-task-card .mayak-task-icon {
                    background: color-mix(in srgb, var(--task-color) 10%, white);
                    color: var(--task-color);
                }

                .mayak-task-card .mayak-task-line {
                    background: var(--task-color);
                }

                .mayak-tasks-summary {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    border: 1px solid rgba(76, 125, 255, 0.18);
                    border-radius: 1.25rem;
                    background: linear-gradient(135deg, #f7faff 0%, #ffffff 100%);
                    padding: clamp(1.25rem, 2vw, 1.75rem) clamp(1.25rem, 2.2vw, 2rem);
                    box-shadow: 0 1rem 2.5rem rgba(76, 125, 255, 0.06);
                }

                .mayak-tasks-summary-icon {
                    flex: 0 0 auto;
                    width: 3.35rem;
                    height: 3.35rem;
                    border: 0.32rem solid var(--color-blue);
                    border-radius: 1rem;
                    transform: rotate(30deg);
                    box-shadow: 0 0 0 0.4rem var(--color-blue-noise);
                }

                .mayak-tasks-summary h3 {
                    color: var(--color-black);
                    font-size: clamp(1.2rem, 1.4vw, 1.45rem);
                    line-height: 1.25;
                }

                .mayak-tasks-summary p {
                    margin-top: 0.25rem;
                    color: var(--color-gray-black);
                    font-size: clamp(1rem, 1.15vw, 1.15rem);
                    font-weight: 600;
                    line-height: 1.35;
                }

                .mayak-about-flow {
                    position: relative;
                    isolation: isolate;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    overflow: hidden;
                    border-radius: 1.5rem;
                }

                .mayak-about-flow::before,
                .mayak-about-flow::after {
                    content: "";
                    position: absolute;
                    z-index: 0;
                    pointer-events: none;
                }

                .mayak-about-flow::before {
                    inset: -3rem -9rem auto auto;
                    width: min(42rem, 50vw);
                    height: min(24rem, 28vw);
                    border-radius: 999px 0 999px 999px;
                    background:
                        radial-gradient(circle at 72% 28%, rgba(76, 125, 255, 0.1), transparent 40%),
                        linear-gradient(135deg, rgba(76, 125, 255, 0.065), rgba(76, 125, 255, 0));
                    filter: blur(0.2px);
                    transform: rotate(-8deg);
                }

                .mayak-about-flow::after {
                    left: -10rem;
                    bottom: 2rem;
                    width: min(34rem, 38vw);
                    height: min(20rem, 24vw);
                    border-radius: 52% 48% 45% 55%;
                    background: linear-gradient(135deg, rgba(76, 125, 255, 0), rgba(76, 125, 255, 0.055));
                    transform: rotate(22deg);
                }

                .mayak-about-flow > * {
                    position: relative;
                    z-index: 1;
                }

                .mayak-flow-card {
                    position: relative;
                    display: flex;
                    min-height: 39rem;
                    flex-direction: column;
                    gap: clamp(1rem, 1.45vw, 1.45rem);
                    overflow: hidden;
                    border: 1px solid var(--color-gray-plus);
                    border-radius: 1.25rem;
                    background: white;
                    padding: clamp(1.5rem, 2vw, 2rem);
                    box-shadow: 0 1.25rem 3rem rgba(8, 9, 10, 0.035);
                }

                .mayak-flow-card::before {
                    content: "";
                    position: absolute;
                    right: -30%;
                    bottom: -22%;
                    width: 58%;
                    aspect-ratio: 1;
                    border-radius: 35% 65% 55% 45%;
                    background: rgba(76, 125, 255, 0.04);
                    pointer-events: none;
                    transform: rotate(18deg);
                }

                .mayak-about-flow .grid > .mayak-flow-card:nth-child(1)::before {
                    left: -18%;
                    right: auto;
                    top: 42%;
                    bottom: auto;
                    width: 48%;
                    border-radius: 38% 62% 48% 52%;
                    background: linear-gradient(135deg, rgba(76, 125, 255, 0.055), rgba(76, 125, 255, 0));
                    transform: rotate(-14deg);
                }

                .mayak-about-flow .grid > .mayak-flow-card:nth-child(2)::before {
                    right: -24%;
                    top: auto;
                    bottom: -18%;
                    width: 54%;
                    border-radius: 999px 999px 0 999px;
                    background: radial-gradient(circle at 40% 42%, rgba(76, 125, 255, 0.052), rgba(76, 125, 255, 0) 68%);
                    transform: rotate(8deg);
                }

                .mayak-about-flow .grid > .mayak-flow-card:nth-child(3)::before {
                    right: -18%;
                    top: 14%;
                    bottom: auto;
                    width: 46%;
                    border-radius: 55% 45% 42% 58%;
                    background: linear-gradient(160deg, rgba(76, 125, 255, 0), rgba(76, 125, 255, 0.06));
                    transform: rotate(30deg);
                }

                .mayak-flow-card::after {
                    content: none;
                }

                .mayak-flow-card > * {
                    position: relative;
                    z-index: 1;
                }

                .mayak-trainer-essence {
                    position: relative;
                    isolation: isolate;
                    overflow: hidden;
                    background: linear-gradient(135deg, #f4f7ff 0%, #ffffff 52%, #f3fbf7 100%) !important;
                    border: 1px solid rgba(47, 109, 246, 0.12);
                }

                .mayak-trainer-essence::before {
                    content: "";
                    position: absolute;
                    right: 12%;
                    bottom: -42%;
                    z-index: 0;
                    width: min(42rem, 46vw);
                    height: min(26rem, 30vw);
                    border-radius: 52% 48% 0 0;
                    background: rgba(76, 125, 255, 0.08);
                    pointer-events: none;
                    transform: rotate(-7deg);
                }

                .mayak-trainer-essence::after {
                    content: "";
                    position: absolute;
                    right: 4%;
                    top: 18%;
                    z-index: 0;
                    width: 4rem;
                    height: 4rem;
                    border: 0.34rem solid rgba(76, 125, 255, 0.16);
                    border-radius: 1rem;
                    pointer-events: none;
                    transform: rotate(32deg);
                }

                .mayak-trainer-essence > * {
                    position: relative;
                    z-index: 1;
                }

                .mayak-trainer-essence-panel {
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 1rem 2.5rem rgba(36, 55, 96, 0.08);
                }

                .mayak-trainer-essence-panel::before {
                    content: "";
                    position: absolute;
                    right: -4rem;
                    bottom: -4rem;
                    width: 14rem;
                    height: 14rem;
                    border-radius: 50%;
                    background: rgba(76, 125, 255, 0.055);
                    pointer-events: none;
                }

                .mayak-trainer-essence-panel > * {
                    position: relative;
                    z-index: 1;
                }

                .mayak-trainer-essence li {
                    position: relative;
                    padding-left: 1.35rem;
                }

                .mayak-trainer-essence li::before {
                    content: "";
                    position: absolute;
                    left: 0;
                    top: 0.55rem;
                    width: 0.5rem;
                    height: 0.5rem;
                    border-radius: 999px;
                    background: var(--color-blue);
                    box-shadow: 0 0 0 4px var(--color-blue-noise);
                }

                .mayak-hero-outcomes ul {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }

                .mayak-hero-outcomes li {
                    position: relative;
                    padding-left: 2.05rem;
                }

                .mayak-hero-outcomes li::before {
                    content: "✓";
                    position: absolute;
                    left: 0;
                    top: -0.05rem;
                    color: var(--color-blue);
                    font-size: 1.1rem;
                    font-weight: 900;
                    line-height: 1.45;
                }

                .mayak-flow-copy {
                    min-height: 8.25rem;
                }

                .mayak-flow-badge {
                    width: fit-content;
                    border: 2px solid rgba(47, 109, 246, 0.2);
                    border-radius: 0.65rem;
                    background: rgba(47, 109, 246, 0.08);
                    color: #4c7dff;
                    font-size: 0.98rem;
                    font-weight: 800;
                    line-height: 1;
                    padding: 0.45rem 0.55rem;
                    box-shadow: inset 0 0 0 1px rgba(47, 109, 246, 0.12);
                }

                .mayak-flow-title {
                    white-space: nowrap;
                }

                .mayak-flow-visual {
                    appearance: none;
                    position: relative;
                    display: flex;
                    aspect-ratio: 16 / 10;
                    margin-top: -0.25rem;
                    min-height: 0;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    padding: 0;
                    border-radius: 1.35rem;
                    background: #f4f7fb;
                    border: 1px solid var(--color-gray-plus);
                    cursor: pointer;
                }

                .mayak-flow-image {
                    display: block;
                    height: 100%;
                    width: 100%;
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain !important;
                    object-position: center center;
                    filter: contrast(1.04) saturate(1.03);
                    transform: translateZ(0);
                    border-radius: 1.35rem;
                }

                @media (max-width: 1100px) {
                    .mayak-result-art {
                        width: min(18rem, 42%);
                    }
                }

                .mayak-cases-panel {
                    position: relative;
                    border: 1px solid var(--color-gray-plus);
                    padding-left: 4.25rem !important;
                    padding-right: 4.25rem !important;
                }

                .mayak-cases-toolbar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .mayak-cases-next {
                    display: none;
                }

                .mayak-cases-arrow {
                    all: unset;
                    box-sizing: border-box;
                    position: absolute;
                    top: 50%;
                    z-index: 4;
                    display: inline-flex !important;
                    height: 3.5rem;
                    width: 2.35rem;
                    align-items: center;
                    justify-content: center;
                    border: 0;
                    border-radius: 0;
                    outline: none;
                    appearance: none;
                    -webkit-appearance: none;
                    background: transparent !important;
                    box-shadow: none !important;
                    color: var(--color-blue);
                    font-size: 2.5rem;
                    font-weight: 800;
                    line-height: 1;
                    padding: 0;
                    cursor: pointer;
                    transition: transform 0.2s ease, color 0.2s ease, opacity 0.2s ease;
                    transform: translateY(-50%);
                }

                .mayak-cases-arrow-left {
                    left: 0.9rem;
                }

                .mayak-cases-arrow-right {
                    right: 0.9rem;
                }

                .mayak-cases-arrow span {
                    display: block;
                    line-height: 1;
                    transform: translateY(-0.05rem);
                }

                .mayak-cases-arrow-left:hover {
                    color: var(--color-black);
                    transform: translate(-0.15rem, -50%);
                }

                .mayak-cases-arrow-right:hover {
                    color: var(--color-black);
                    transform: translate(0.15rem, -50%);
                }

                .mayak-cases-arrow:focus-visible {
                    outline: none;
                }

                .mayak-cases-arrow:focus,
                .mayak-cases-arrow:active {
                    outline: none;
                    background: transparent !important;
                    box-shadow: none !important;
                }

                .mayak-hero-copy p,
                .mayak-flow-card p,
                .mayak-problem-text,
                .mayak-result-card p,
                .mayak-methodology-block p,
                .mayak-direction-text,
                .mayak-case-card p,
                .mayak-case-modal-copy p,
                .mayak-final-cta p {
                    color: #565d6a !important;
                    font-weight: 600;
                }

                .mayak-flow-copy p {
                    color: #737b89 !important;
                    font-weight: 700;
                }

                .mayak-direction-list li,
                .mayak-cases-toolbar span {
                    color: #2c313a;
                }

                .mayak-final-cta {
                    position: relative;
                    overflow: hidden;
                    isolation: isolate;
                    border: 1px solid rgba(76, 125, 255, 0.16);
                    background:
                        radial-gradient(circle at 82% 38%, rgba(76, 125, 255, 0.12), transparent 35%),
                        linear-gradient(135deg, #ffffff 0%, #f6f9ff 100%);
                    box-shadow: 0 1.25rem 3rem rgba(27, 39, 66, 0.06);
                }

                .mayak-final-cta::before {
                    content: "";
                    position: absolute;
                    right: -4rem;
                    bottom: -10rem;
                    z-index: 0;
                    width: min(48rem, 48vw);
                    height: min(30rem, 34vw);
                    border-radius: 52% 48% 0 0;
                    background: rgba(76, 125, 255, 0.09);
                    pointer-events: none;
                    transform: rotate(-7deg);
                }

                .mayak-final-cta::after {
                    content: "";
                    position: absolute;
                    right: 2rem;
                    top: 2rem;
                    z-index: 0;
                    width: 4.5rem;
                    height: 4.5rem;
                    background-image: radial-gradient(circle, rgba(76, 125, 255, 0.2) 0 0.14rem, transparent 0.16rem);
                    background-size: 0.75rem 0.75rem;
                    pointer-events: none;
                }

                .mayak-final-cta > * {
                    position: relative;
                    z-index: 1;
                }

                .mayak-final-cta-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.4fr);
                    gap: clamp(1.75rem, 5vw, 5rem);
                    align-items: stretch;
                }

                .mayak-final-cta-copy {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 1.8rem;
                    min-height: 18rem;
                }

                .mayak-final-cta-copy h2 {
                    max-width: 40rem;
                    color: var(--color-black);
                    font-size: clamp(2.1rem, 3vw, 3.25rem);
                    font-weight: 800;
                    line-height: 1.08;
                }

                .mayak-final-cta-points {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: clamp(1rem, 2vw, 2rem);
                    max-width: 58rem;
                }

                .mayak-final-cta-points > div {
                    display: grid;
                    grid-template-columns: 2.25rem minmax(0, 1fr);
                    gap: 0.9rem;
                    align-items: start;
                }

                .mayak-final-cta-icon {
                    display: flex;
                    width: 2.25rem;
                    height: 2.25rem;
                    align-items: center;
                    justify-content: center;
                    border-radius: 999px;
                    background: var(--color-blue-noise);
                    color: var(--color-blue);
                }

                .mayak-final-cta-icon svg {
                    width: 1.25rem;
                    height: 1.25rem;
                    fill: none;
                    stroke: currentColor;
                    stroke-width: 2.35;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                }

                .mayak-final-cta-points h3 {
                    color: var(--color-blue);
                    font-size: 1rem;
                    font-weight: 800;
                    line-height: 1.3;
                }

                .mayak-final-cta-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.55rem;
                    margin-top: 0.55rem;
                    padding: 0;
                    list-style: none;
                    max-width: 23rem;
                }

                .mayak-final-cta-list li {
                    position: relative;
                    padding-left: 1.4rem;
                    color: var(--color-gray-black) !important;
                    font-size: 1rem;
                    font-weight: 600;
                    line-height: 1.5;
                }

                .mayak-final-cta-list li::before {
                    content: "";
                    position: absolute;
                    left: 0;
                    top: 0.56rem;
                    width: 0.45rem;
                    height: 0.45rem;
                    border-radius: 999px;
                    background: var(--color-blue);
                    box-shadow: 0 0 0 4px var(--color-blue-noise);
                }

                .mayak-final-cta-panel {
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-start;
                    gap: 1.35rem;
                    min-height: 15rem;
                    border: 0;
                    border-radius: 0;
                    background: transparent;
                    padding: clamp(2.5rem, 5vw, 4.4rem) 0 clamp(1.35rem, 2.2vw, 2.1rem);
                    box-shadow: none;
                    backdrop-filter: none;
                }

                .mayak-final-cta-panel h3 {
                    color: var(--color-black);
                    font-size: clamp(1.8rem, 2.35vw, 2.55rem);
                    font-weight: 800;
                    line-height: 1.08;
                }

                .mayak-final-cta-panel p {
                    color: #6f7685 !important;
                    font-size: clamp(1.08rem, 1.34vw, 1.32rem);
                    font-weight: 800;
                    line-height: 1.48;
                    max-width: 25rem;
                }

                .mayak-final-cta-button {
                    align-self: flex-start;
                    width: fit-content !important;
                    margin-top: 0.05rem;
                    border-radius: 999px !important;
                    justify-content: center;
                    min-height: 3.25rem;
                    padding: 0.9rem 1.7rem !important;
                    color: #fff !important;
                    font-size: 1rem !important;
                    font-weight: 800 !important;
                    background: var(--color-blue) !important;
                    box-shadow: 0 0 0 0.42rem var(--color-blue-noise), 0 0.85rem 1.6rem rgba(76, 125, 255, 0.24);
                }

                .mayak-final-cta-secure {
                    display: flex;
                    align-items: center;
                    gap: 0.55rem;
                    margin-top: auto;
                    color: #9aa1ad;
                    font-size: 0.78rem;
                    font-weight: 700;
                    line-height: 1.35;
                }

                .mayak-final-cta-secure svg {
                    flex: 0 0 auto;
                    width: 1rem;
                    height: 1rem;
                    fill: none;
                    stroke: currentColor;
                    stroke-width: 2;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                }

                .mayak-cases-counter {
                    flex-shrink: 0;
                    border-radius: 999px;
                    background: var(--color-black);
                    color: white;
                    font-size: 0.78rem;
                    font-weight: 800;
                    letter-spacing: 0;
                    padding: 0.55rem 0.85rem;
                }

                .mayak-cases-scroll {
                    overflow-x: auto;
                    overflow-y: hidden;
                    padding: 0.15rem 0 0;
                    scroll-snap-type: x mandatory;
                    scrollbar-width: none;
                }

                .mayak-cases-scroll::-webkit-scrollbar {
                    display: none;
                }

                .mayak-cases-track {
                    display: flex;
                    gap: 1.5rem;
                    min-width: 100%;
                }

                .mayak-cases-page {
                    display: grid;
                    flex: 0 0 100%;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 1.5rem;
                    scroll-snap-align: start;
                }

                .mayak-case-card {
                    appearance: none;
                    position: relative;
                    display: flex;
                    min-height: 25.5rem;
                    flex-direction: column;
                    gap: 1rem;
                    overflow: hidden;
                    border: 1px solid color-mix(in srgb, var(--case-color) 22%, var(--color-gray-plus));
                    border-radius: 1.15rem;
                    background: white;
                    padding: 1rem;
                    box-shadow: 0 1rem 2rem rgba(8, 9, 10, 0.035);
                    text-align: left;
                    cursor: pointer;
                    color: inherit;
                }

                .mayak-case-card:focus-visible {
                    outline: 3px solid color-mix(in srgb, var(--case-color) 42%, white);
                    outline-offset: 3px;
                }

                .mayak-case-card::after {
                    content: "";
                    position: absolute;
                    inset: auto -3rem -4rem auto;
                    width: 9rem;
                    height: 9rem;
                    border-radius: 999px;
                    background: color-mix(in srgb, var(--case-color) 16%, transparent);
                    pointer-events: none;
                }

                .mayak-case-media {
                    display: grid;
                    height: 11.75rem;
                    grid-template-columns: 1fr;
                    gap: 0.6rem;
                }

                .mayak-case-media-double {
                    grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.85fr);
                }

                .mayak-case-photo {
                    overflow: hidden;
                    border-radius: 0.85rem;
                    background: var(--color-gray-plus);
                }

                .mayak-case-card-photo-only {
                    min-height: 22rem;
                    padding: 0.75rem;
                }

                .mayak-case-card-photo-only::after {
                    display: none;
                }

                .mayak-case-card-photo-only .mayak-case-media {
                    height: 100%;
                    min-height: 20.5rem;
                }

                .mayak-case-card-photo-only .mayak-case-photo {
                    border-radius: 0.95rem;
                    background: white;
                    border: 1px solid var(--color-gray-plus);
                }

                .mayak-case-card-photo-only .mayak-case-photo img {
                    object-fit: contain;
                }

                .mayak-case-modal {
                    position: fixed;
                    inset: 0;
                    z-index: 80;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(8, 9, 10, 0.62);
                    padding: clamp(1rem, 3vw, 2rem);
                }

                .mayak-case-modal-panel {
                    position: relative;
                    width: min(88rem, 96vw);
                    max-height: 92vh;
                    overflow: hidden;
                    border-radius: 1.25rem;
                    background: white;
                    padding: clamp(0.75rem, 1.5vw, 1.25rem);
                    box-shadow: 0 2rem 5rem rgba(0, 0, 0, 0.28);
                }

                .mayak-case-modal-close {
                    position: absolute;
                    top: 0.85rem;
                    right: 0.85rem;
                    z-index: 2;
                    display: inline-flex;
                    height: 2.5rem;
                    width: 2.5rem;
                    align-items: center;
                    justify-content: center;
                    border: 0;
                    border-radius: 999px;
                    background: var(--color-black);
                    color: white;
                    font-size: 1.4rem;
                    font-weight: 800;
                    line-height: 1;
                    cursor: pointer;
                }

                .mayak-case-modal-media {
                    display: grid;
                    gap: 0.75rem;
                }

                .mayak-case-modal-media-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                .mayak-case-modal-media-grid .mayak-case-modal-frame {
                    height: min(58vh, 36rem);
                }

                .mayak-case-modal-frame {
                    display: flex;
                    height: min(74vh, 52rem);
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    border: 1px solid var(--color-gray-plus);
                    border-radius: 1rem;
                    background: #fff;
                }

                .mayak-image-modal-frame {
                    width: fit-content;
                    height: auto !important;
                    max-width: calc(96vw - 2.5rem);
                    max-height: none;
                    overflow: visible !important;
                    padding: 0;
                    border: 0;
                }

                .mayak-image-modal-panel {
                    width: fit-content !important;
                    max-width: 96vw;
                    max-height: none;
                    overflow: visible !important;
                }

                .mayak-image-modal-image {
                    display: block;
                    width: auto !important;
                    height: auto !important;
                    max-width: calc(96vw - 2.5rem) !important;
                    max-height: calc(92vh - 2.5rem) !important;
                    object-fit: contain !important;
                    object-position: center center;
                    border-radius: 1rem;
                    border: 1px solid var(--color-gray-plus);
                }

                .mayak-case-modal-copy {
                    display: flex;
                    flex-direction: column;
                    gap: 0.65rem;
                    padding: 1rem 0.25rem 0.25rem;
                }

                .mayak-case-modal-copy p {
                    color: var(--color-gray-black);
                    font-size: 1rem;
                    line-height: 1.55;
                }

                @media (max-width: 1100px) {
                    .mayak-tasks-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .mayak-task-card:not(:last-child)::before,
                    .mayak-task-card:not(:last-child)::after {
                        display: none;
                    }

                    .mayak-hero-copy {
                        background: white;
                        padding-left: clamp(1.25rem, 5vw, 2rem);
                        padding-right: clamp(1.25rem, 5vw, 2rem);
                    }

                    .mayak-hero-copy h1 {
                        max-width: 30rem;
                    }

                    .mayak-hero-visual {
                        min-height: clamp(18rem, 58vw, 28rem);
                    }

                    .mayak-hero-bg {
                        width: min(60rem, 140%);
                        right: -18%;
                        top: 38%;
                        transform: translateY(-50%) scale(1.08);
                    }

                    .mayak-hero-people {
                        width: min(62rem, 136%);
                        transform: translate(-62%, -51%);
                    }

                    .mayak-hero-people-alt {
                        width: min(56rem, 122%);
                        transform: translate(-56%, -49%);
                    }

                    .mayak-cases-page {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .mayak-final-cta-grid {
                        grid-template-columns: 1fr;
                    }

                    .mayak-final-cta-copy {
                        min-height: auto;
                    }

                    .mayak-flow-title {
                        white-space: normal;
                    }
                }

                @media (max-width: 700px) {
                    .mayak-tasks-section {
                        padding-left: 0;
                    }

                    .mayak-tasks-heading h2 {
                        font-size: clamp(2rem, 12vw, 3rem);
                    }

                    .mayak-tasks-grid {
                        grid-template-columns: 1fr;
                    }

                    .mayak-task-card {
                        min-height: auto;
                        grid-template-rows: auto auto auto auto auto;
                    }

                    .mayak-tasks-summary {
                        align-items: flex-start;
                    }

                    .mayak-final-cta-points {
                        grid-template-columns: 1fr;
                    }

                    .mayak-hero-visual {
                        min-height: 18rem;
                        margin-top: -4rem;
                    }

                    .mayak-hero-copy {
                        padding-left: 1rem;
                        padding-right: 1rem;
                    }

                    .mayak-hero-copy h1 {
                        max-width: 20rem;
                        font-size: 1.7rem;
                        line-height: 1.18;
                    }

                    .mayak-hero-bg {
                        width: 142%;
                        right: -26%;
                        top: 34%;
                    }

                    .mayak-hero-people {
                        width: 138%;
                        transform: translate(-65%, -54%);
                    }

                    .mayak-hero-people-alt {
                        width: 122%;
                        transform: translate(-53%, -51%);
                    }

                    .mayak-methodology-grid,
                    .mayak-methodology-image-frame {
                        min-height: auto;
                    }

                    .mayak-methodology-image-frame {
                        height: auto;
                    }

                    .mayak-methodology-image {
                        height: auto;
                    }

                    .mayak-flow-card {
                        min-height: auto;
                    }

                    .mayak-flow-copy {
                        min-height: auto;
                    }

                    .mayak-cases-track {
                        gap: 1rem;
                    }

                    .mayak-cases-page {
                        flex-basis: min(84vw, 22rem);
                        grid-template-columns: minmax(0, 1fr);
                        gap: 1rem;
                    }

                    .mayak-case-card {
                        min-height: 24rem;
                    }

                    .mayak-flow-title {
                        white-space: normal;
                    }

                    .mayak-case-modal-media-grid {
                        grid-template-columns: minmax(0, 1fr);
                    }

                    .mayak-case-modal-frame,
                    .mayak-image-modal-frame {
                        height: min(72vh, 30rem);
                    }

                    .mayak-image-modal-frame {
                        height: auto;
                    }

                    .mayak-image-modal-image {
                        max-width: calc(100vw - 2rem);
                        max-height: calc(92vh - 2rem);
                    }
                }

                .mayak-direction-card {
                    position: relative;
                    width: 100%;
                    min-height: 27rem;
                    overflow: hidden;
                    border: 1px solid color-mix(in srgb, var(--direction-color) 24%, var(--color-gray-plus));
                    border-radius: 1.25rem;
                    background: white;
                    padding: 1.75rem;
                    text-align: left;
                    box-shadow: 0 1.25rem 2.5rem rgba(8, 9, 10, 0.035);
                    cursor: pointer;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
                }

                .mayak-direction-content {
                    display: grid;
                    min-height: 21.5rem;
                    grid-template-rows: 6.3rem minmax(5rem, auto) 1fr;
                    gap: 0.7rem;
                }

                .mayak-direction-heading {
                    align-items: flex-start;
                }

                .mayak-direction-title {
                    width: min(18rem, 100%);
                    min-height: 3.6rem;
                    font-size: clamp(1.35rem, 1.65vw, 1.95rem);
                    line-height: 1.18;
                    overflow-wrap: anywhere;
                }

                .mayak-direction-special .mayak-direction-title {
                    width: min(20rem, 100%);
                    font-size: clamp(1.2rem, 1.25vw, 1.45rem);
                    overflow-wrap: normal;
                    word-break: normal;
                }

                .mayak-direction-text {
                    width: min(18rem, calc(100% - 9.5rem));
                    min-width: 12rem;
                    max-width: 100%;
                    max-height: none;
                    overflow: visible;
                    white-space: normal;
                    overflow-wrap: anywhere;
                }

                .mayak-direction-list {
                    align-self: end;
                    max-width: calc(100% - 6.5rem);
                    padding-right: 0;
                }

                .mayak-problem-card h3 {
                    min-height: 5.8rem;
                }

                .mayak-problem-text {
                    margin-top: 0;
                }

                .mayak-direction-card:hover,
                .mayak-direction-card-active {
                    border-color: var(--direction-color);
                    box-shadow: 0 0 0 3px color-mix(in srgb, var(--direction-color) 18%, transparent), 0 1.25rem 2.5rem rgba(8, 9, 10, 0.05);
                }

                .mayak-direction-card:focus-visible {
                    outline: 3px solid color-mix(in srgb, var(--direction-color) 45%, white);
                    outline-offset: 3px;
                }

                .mayak-direction-card-active {
                    transform: translateY(-0.15rem);
                }

                .mayak-direction-mark {
                    position: absolute;
                    right: -1.35rem;
                    bottom: -0.7rem;
                    display: flex;
                    height: 18.75rem;
                    width: 15.5rem;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.72;
                    pointer-events: none;
                }

                @media (max-width: 640px) {
                    .mayak-direction-card {
                        min-height: 25rem;
                    }

                    .mayak-direction-text {
                        width: min(18rem, 100%);
                        min-width: 0;
                    }

                    .mayak-direction-list {
                        max-width: calc(100% - 5.5rem);
                    }

                    .mayak-direction-mark {
                        right: -1.75rem;
                        bottom: -0.5rem;
                        height: 17rem;
                        width: 14rem;
                    }
                }
            `}</style>
        </Layout>
    );
}
