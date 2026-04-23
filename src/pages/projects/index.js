import Link from "next/link";
import { useEffect, useMemo } from "react";

import { getCookie } from "@/utils/cookies";
import { useProjects } from "@/hooks/fetchProjects";
import { categories as staticCategories } from "@/pages/projects/_categories";

import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";
import Button from "@/components/ui/Button";

import Index from "@/assets/general/index.svg";
import Notify from "@/assets/general/notify.svg";

export default function Projects({ organization }) {
    const { loading, categories: projects, error, fetchProjects } = useProjects();

    useEffect(() => {
        if (organization) {
            fetchProjects(organization);
        }
    }, [organization, fetchProjects]);

    const processedCategories = useMemo(() => {
        if (loading || error || !projects) {
            return [];
        }

        return staticCategories.map((cat) => {
            const catProjects = projects.filter((p) => p.star_category === cat.url);

            const completedProjects = catProjects.filter((p) => p.tasks.length > 0 && p.tasks.every((t) => t.status === "ACCEPTED"));

            const star_index = completedProjects.reduce((sum, p) => sum + p.star_index, 0);

            const level_number = completedProjects.length > 0 ? Math.max(...completedProjects.map((p) => p.level_number)) : 0;

            return { ...cat, star_index, level_number };
        });
    }, [error, loading, projects]);

    
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

    return (
        <Layout>
            <Header>
                <Header.Heading>Проекты</Header.Heading>
                <Button icon>
                    <Notify />
                </Button>
            </Header>
            <div className="hero" style={{ gridTemplateRows: "max-content" }}>
                <hgroup className="flex flex-col col-span-4 max-[900px]:col-span-12 gap-[.5rem]">
                    <h3>Проекты</h3>
                    <p className="text-(--color-gray-black)">Выберите категорию проектов, которую хотите выполнять. Каждая из них развивает одно из направлений звезды</p>
                </hgroup>
                <div className="col-span-12 grid grid-cols-3 gap-[1.25rem] h-fit max-[900px]:grid-cols-2 max-[640px]:grid-cols-1">
                    {processedCategories.map((category, idx) => (
                        <Link
                            href={"/projects/" + category.url}
                            key={idx}
                            className="flex flex-col min-h-[200px] justify-between p-[1.25rem] rounded-[1rem] border-[1.5px] border-(--color-gray-plus-50) hover:bg-(--color-white-gray) hover:border-(--color-white-gray) transition">
                            <div className="flex flex-col gap-[.5rem]">
                                <div className="flex w-full justify-between">
                                    <h5>{category.name}</h5>
                                    <div className="flex items-center justify-center h-fit rounded-[6.25rem] text-(--color-blue) px-[.75rem] py-[.5rem] bg-(--color-blue-noise)">{category.level_number}&nbsp;уровень</div>
                                </div>
                                <p className="text-(--color-gray-black)">{category.desc}</p>
                            </div>

                            <div className="w-full flex flex-col text-(--color-blue) gap-[.25rem]">
                                <div className="flex gap-[.5rem] items-center">
                                    <Index /> {category.star_index} / 6
                                </div>
                                <div className="w-full h-[.25rem] rounded-[6.25rem] overflow-hidden bg-(--color-blue-noise)">
                                    <div
                                        className="bg-(--color-blue) h-full"
                                        style={{
                                            width: `${(category.star_index / 6) * 100}%`,
                                            transition: "width 0.3s",
                                        }}></div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </Layout>
    );
}

export async function getServerSideProps(context) {
    const organization = context.req.cookies.organization || null;

    return {
        props: { organization },
    };
}

