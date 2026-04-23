import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Link from "next/link";

import { getCookie } from "@/utils/cookies";
import { useProjects } from "@/hooks/fetchProjects";
import { categories as staticCategories } from "../_categories";

import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Switcher from "@/components/ui/Switcher";

import Index from "@/assets/general/index.svg";
import Notify from "@/assets/general/notify.svg";

export default function CategoryPage() {
    const router = useRouter();
    const organization = getCookie("organization");
    const { loading, categories: projects, error, fetchProjects } = useProjects();
    const { category: url } = router.query;
    const [selectedLevel, setSelectedLevel] = useState(1);

    useEffect(() => {
        if (organization) {
            fetchProjects(organization);
        }
    }, [organization, fetchProjects]);

    useEffect(() => {
        if (projects.length > 0) {
            const projectsInCat = projects.filter((p) => p.star_category === url);
            const incompleteProject = projectsInCat.find((p) => !p.tasks.every((t) => t.status === "ACCEPTED"));
            const nextSelectedLevel = incompleteProject?.level_number || 1;
            const frameId = requestAnimationFrame(() => {
                setSelectedLevel(nextSelectedLevel);
            });

            return () => {
                cancelAnimationFrame(frameId);
            };
        }
    }, [projects, url]);

    if (!router.isReady || !url)
        return (
            <Layout>
                <div>Загрузка...</div>
            </Layout>
        );

    // Если организации нет в cookies
    if (!organization) {
        return (
            <Layout>
                <Header>
                    <Header.Heading>Проекты</Header.Heading>
                    <Button icon>
                        <Notify />
                    </Button>
                </Header>
                <div className="hero" style={{ placeItems: "center" }}>
                    <div className="flex flex-col gap-[1rem] col-start-4 col-end-10">
                        <h1 className="text-center">У вас нет организации</h1>
                        <p className="text-center text-(--color-gray-black)">Для доступа к проектам необходимо указать организацию в настройках профиля</p>
                        <div className="flex gap-[1rem] justify-center">
                            <Link href="/profile">
                                <Button>Перейти в профиль</Button>
                            </Link>
                            <Link href="/organizations">
                                <Button>Перейти в организации</Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    if (loading) {
        return (
            <Layout>
                <Header>
                    <Header.Heading>Проекты</Header.Heading>
                    <Button icon>
                        <Notify />
                    </Button>
                </Header>
                <div className="flex h-full items-center justify-center">
                    <p>Загрузка проектов...</p>
                </div>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout>
                <Header>
                    <Header.Heading>Проекты</Header.Heading>
                    <Button icon>
                        <Notify />
                    </Button>
                </Header>
                <div className="flex h-full items-center justify-center">
                    <p className="text-red-500">Ошибка: {error}</p>
                </div>
            </Layout>
        );
    }

    const staticCategory = staticCategories.find((c) => c.url === url);

    if (!staticCategory) {
        return (
            <Layout>
                <Header>
                    <Header.Heading>Проекты</Header.Heading>
                </Header>
                <div className="hero" style={{ placeItems: "center" }}>
                    <div className="flex flex-col gap-[1rem] col-start-4 col-end-10">
                        <h1>Категория &quot;{url}&quot; не найдена</h1>
                        <Button big onClick={() => router.push("/projects")}>
                            Вернуться назад
                        </Button>
                    </div>
                </div>
            </Layout>
        );
    }

    const projectsInCategory = projects.filter((p) => p.star_category === url && p.level_number === selectedLevel);

    const isLevelCompleted = (level) => {
        const levelProjects = projects.filter((p) => p.star_category === url && p.level_number === level);
        return levelProjects.length > 0 && levelProjects.every((p) => p.tasks.every((t) => t.status === "ACCEPTED"));
    };

    if (projectsInCategory.length === 0) {
        return (
            <Layout>
                <Header>
                    <Header.Heading>Проекты</Header.Heading>
                </Header>
                <div className="hero" style={{ placeItems: "center" }}>
                    <div className="flex flex-col gap-[1rem] col-start-4 col-end-10">
                        <h1>Проекты в категории &quot;{url}&quot; не найдены</h1>
                        <Button big onClick={() => router.push("/projects")}>
                            Вернуться назад
                        </Button>
                    </div>
                </div>
            </Layout>
        );
    }

    const projectsInLevel = projects.filter((p) => p.star_category === url && p.level_number === selectedLevel);

    const completedCount = projectsInLevel.filter((p) => (p.tasks ?? []).every((t) => t.status === "ACCEPTED")).length;

    const total = projectsInLevel.length;

    const sortedBase = projectsInCategory
        .sort((a, b) => a.id - b.id)
        .map((project, idx) => ({
            ...project,
            originalIdx: idx,
        }));

    const sorted = [...sortedBase.filter((p) => !p.tasks.every((t) => t.status === "ACCEPTED")), ...sortedBase.filter((p) => p.tasks.every((t) => t.status === "ACCEPTED"))];

    return (
        <Layout>
            <Header>
                <Header.Heading>
                    Проекты <span className="text-[var(--color-gray-black)]">/</span> {staticCategory.name}
                </Header.Heading>
                <Button icon>
                    <Notify />
                </Button>
            </Header>
            <div className="hero" style={{ gridTemplateRows: "max-content" }}>
                <div className="col-span-12 flex items-start justify-between pl-[1.5rem] mb-[2.5rem] max-[900px]:flex-col max-[900px]:gap-[1.25rem] max-[900px]:pl-0">
                    <div className="flex flex-col gap-[0.5rem] pb-[1.5rem]">
                        <Switcher
                            value={selectedLevel}
                            onChange={(level) => {
                                const canAccess = level === 1 || isLevelCompleted(level - 1);
                                if (canAccess) setSelectedLevel(level);
                            }}
                            className="flex flex-row justify-center items-center p-[0.25rem] gap-[0.25rem] bg-(--color-gray-plus-50) rounded-[0.625rem] w-fit">
                            {Array.from({ length: 5 }, (_, i) => i + 1).map((level) => {
                                const canAccess = level === 1 || isLevelCompleted(level - 1);

                                return (
                                    <Switcher.Option key={level} value={level} disabled={!canAccess} className={`whitespace-nowrap ${!canAccess ? "text-[var(--color-gray-white)] cursor-not-allowed pointer-events-none opacity-50" : ""}`}>
                                        Уровень&nbsp;{level}
                                    </Switcher.Option>
                                );
                            })}
                        </Switcher>
                        <hgroup>
                            <h3>{staticCategory.name}</h3>
                            <p className="text-[var(--color-gray-black)]">{staticCategory.desc}</p>
                        </hgroup>
                    </div>
                    <Card>
                        <Card.Heading>
                            <h5>
                                Вы выполнили <span className="text-[var(--color-blue)]">{completedCount}</span> проекта из <span className="text-[var(--color-blue)]">{total}</span>
                            </h5>
                            <div className="w-full rounded-[6.25rem] overflow-hidden bg-[var(--color-blue-noise)] h-[.75rem]">
                                <div
                                    className="bg-[var(--color-blue)] h-full"
                                    style={{
                                        width: `${(completedCount / total) * 100}%`,
                                    }}></div>
                            </div>
                        </Card.Heading>
                        <Card.Footer className="text-[var(--color-white)]">
                            <div className="z-10">Мотивационный текст :)</div>
                        </Card.Footer>
                    </Card>
                </div>

                <div className="col-span-12 grid grid-cols-3 gap-[1.25rem] h-fit max-[900px]:grid-cols-2 max-[640px]:grid-cols-1">
                    {sorted.map((project, idx) => (
                        <div
                            key={project.originalIdx}
                            className="flex flex-col min-h-[200px] justify-between gap-[1rem] p-[1.25rem] rounded-[1rem] border-[1.5px] border-[var(--color-gray-plus-50)] hover:bg-[var(--color-white-gray)] hover:border-[var(--color-white-gray)] transition">
                            <div className="flex flex-col gap-[.5rem]">
                                <div className="flex justify-between items-center gap-[.5rem]">
                                    <h5>{project.title}</h5>
                                    <span className="link big text-[var(--color-gray-white)]">#{project.originalIdx + 1}</span>
                                </div>
                                <p className="text-[var(--color-gray-black)]">{project.description}</p>
                            </div>

                            <Link href={`/projects/${url}/${project.id}`}>
                                <div
                                    className={`flex items-center justify-center px-[.75rem] py-[1rem] rounded-[6.25rem] ${
                                        project.tasks.every((t) => t.status === "ACCEPTED") ? "bg-[var(--color-green-noise)] text-[var(--color-green-peace)]" : "bg-[var(--color-gray-plus-50)] text-[var(--color-black)]"
                                    }`}>
                                    {project.tasks.every((t) => t.status === "ACCEPTED") ? "Выполнено" : "Выполнить"}
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </Layout>
    );
}

