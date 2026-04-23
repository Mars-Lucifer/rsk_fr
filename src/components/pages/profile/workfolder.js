import { useEffect, useState } from "react";
import { getUserData } from "@/utils/auth";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Folder from "@/components/other/Folder";
import Case from "@/components/ui/Case";
import Tags from "@/components/ui/Tags";

import NotifyIcon from "@/assets/general/notify.svg";
import SettsIcon from "@/assets/general/setts.svg";

const cases = [
    {
        name: "Сделать презентацию",
        desc: "Слайды к выступлению на конференции",
        tags: [
            { name: "10 баллов", color: "blue", icon: "coin" },
            { name: "Проект", color: "blue" },
        ],
    },
    {
        name: "Пропылесосить комнату",
        desc: "Уборка перед приходом гостей",
        tags: [
            { name: "2 балла", color: "blue", icon: "coin" },
            { name: "Дело", color: "blue" },
        ],
    },
    {
        name: "Написать статью",
        desc: "Публикация в блог по фронтенду",
        tags: [
            { name: "7 баллов", color: "blue", icon: "coin" },
            { name: "Проект", color: "blue" },
        ],
    },
    {
        name: "Купить продукты",
        desc: "Список: хлеб, молоко, сыр",
        tags: [
            { name: "1 балл", color: "blue", icon: "coin" },
            { name: "Дело", color: "blue" },
        ],
    },
    {
        name: "Создать лендинг",
        desc: "Тестовый лендинг для портфолио",
        tags: [
            { name: "8 баллов", color: "blue", icon: "coin" },
            { name: "Проект", color: "blue" },
        ],
    },
    {
        name: "Разобрать папку с бумагами",
        desc: "Систематизировать документы",
        tags: [
            { name: "3 балла", color: "blue", icon: "coin" },
            { name: "Дело", color: "blue" },
        ],
    },
    {
        name: "Сделать домашку по математике",
        desc: "Решить задачи из учебника",
        tags: [
            { name: "5 баллов", color: "blue", icon: "coin" },
            { name: "Дело", color: "blue" },
        ],
    },
    {
        name: "Погулять с собакой",
        desc: "Вечерняя прогулка в парке",
        tags: [
            { name: "1 балл", color: "blue", icon: "coin" },
            { name: "Дело", color: "blue" },
        ],
    },
    {
        name: "Сделать проект по информатике",
        desc: "Разработка сайта для школы",
        tags: [
            { name: "12 баллов", color: "blue", icon: "coin" },
            { name: "Проект", color: "blue" },
        ],
    },
    {
        name: "Посмотреть обучающее видео",
        desc: "Видео по React.js",
        tags: [
            { name: "2 балла", color: "blue", icon: "coin" },
            { name: "Дело", color: "blue" },
        ],
    },
    {
        name: "Сделать зарядку",
        desc: "Утренняя разминка",
        tags: [
            { name: "1 балл", color: "blue", icon: "coin" },
            { name: "Дело", color: "blue" },
        ],
    },
    {
        name: "Прочитать книгу",
        desc: "Глава из художественной литературы",
        tags: [
            { name: "4 балла", color: "blue", icon: "coin" },
            { name: "Дело", color: "blue" },
        ],
    },
    {
        name: "Сделать лабораторную по физике",
        desc: "Эксперимент с электричеством",
        tags: [
            { name: "9 баллов", color: "blue", icon: "coin" },
            { name: "Проект", color: "blue" },
        ],
    },
    {
        name: "Сходить в магазин",
        desc: "Купить продукты на неделю",
        tags: [
            { name: "2 балла", color: "blue", icon: "coin" },
            { name: "Дело", color: "blue" },
        ],
    },
    {
        name: "Сделать презентацию по истории",
        desc: "Подготовить слайды для доклада",
        tags: [
            { name: "6 баллов", color: "blue", icon: "coin" },
            { name: "Проект", color: "blue" },
        ],
    },
    {
        name: "Убраться на рабочем столе",
        desc: "Разложить бумаги и канцелярию",
        tags: [
            { name: "2 балла", color: "blue", icon: "coin" },
            { name: "Дело", color: "blue" },
        ],
    },
    {
        name: "Сделать пост в блог",
        desc: "Написать статью о программировании",
        tags: [
            { name: "7 баллов", color: "blue", icon: "coin" },
            { name: "Проект", color: "blue" },
        ],
    },
];

export default function WorkFolderPage({ goTo }) {
    const [userData, setUserData] = useState(null);
    const [caseType, setCaseType] = useState("all");
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            setUserData(getUserData());
            setHydrated(true);
        });

        return () => window.cancelAnimationFrame(frameId);
    }, []);

    if (!hydrated || !userData) return null;

    return (
        <>
            <Header>
                <Header.Heading>
                    {userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : "Незаполнено"}
                    <span className="text-(--color-gray-white)" style={{ font: "inherit" }}>
                        /
                    </span>
                    Рабочая папка
                </Header.Heading>
                <Button icon>
                    <SettsIcon />
                </Button>
                <Button icon>
                    <NotifyIcon />
                </Button>
            </Header>
            <div className="hero">
                <div className="flex flex-col gap-[0.75rem] col-span-4 max-[900px]:col-span-6 max-[640px]:col-span-6">
                    <Button inverted onClick={() => goTo("profile")}>
                        Назад
                    </Button>
                    <Folder min projects="2" works="12" exp="100" />
                </div>
                <div className="flex flex-col gap-[1rem] col-start-7 col-end-13 max-[900px]:col-start-1 max-[900px]:col-end-7">
                    <h4>Дела участника</h4>
                    <Case
                        tabs={[
                            { name: "all", label: "Всё" },
                            { name: "projects", label: "Проекты" },
                            { name: "cases", label: "Дела" },
                        ]}
                        value={caseType}
                        onChange={setCaseType}
                        perPage={3}
                        className="h-full gap-[1rem]">
                        <Case.Tab tab="all">
                            {cases.map((card, idx) => (
                                <div className="block-wrapper col-span-4 max-[900px]:col-span-6 max-[640px]:col-span-12" key={idx}>
                                    <h6>{card.name}</h6>
                                    <p className="text-(--color-gray-black)">{card.desc}</p>
                                    <div className="flex flex-wrap gap-[.5rem]">
                                        <Tags tags={card.tags} />
                                    </div>
                                </div>
                            ))}
                        </Case.Tab>
                        <Case.Tab tab="projects">
                            {cases
                                .filter((card) => card.tags.some((tag) => tag.name === "Проект"))
                                .map((card, idx) => (
                                    <div className="block-wrapper col-span-4 max-[900px]:col-span-6 max-[640px]:col-span-12" key={idx}>
                                        <h6>{card.name}</h6>
                                        <p className="text-(--color-gray-black)">{card.desc}</p>
                                        <div className="flex flex-wrap gap-[.5rem]">
                                            <Tags tags={card.tags} />
                                        </div>
                                    </div>
                                ))}
                        </Case.Tab>
                        <Case.Tab tab="cases">
                            {cases
                                .filter((card) => card.tags.some((tag) => tag.name === "Дело"))
                                .map((card, idx) => (
                                    <div className="block-wrapper col-span-4 max-[900px]:col-span-6 max-[640px]:col-span-12" key={idx}>
                                        <h6>{card.name}</h6>
                                        <p className="text-(--color-gray-black)">{card.desc}</p>
                                        <div className="flex flex-wrap gap-[.5rem]">
                                            <Tags tags={card.tags} />
                                        </div>
                                    </div>
                                ))}
                        </Case.Tab>
                    </Case>
                </div>
            </div>
        </>
    );
}


