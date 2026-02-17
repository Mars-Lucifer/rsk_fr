import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import Tags from "@/components/ui/Tags";
import Button from "@/components/ui/Button";
import Link from "next/link";

import { getUserData } from "@/utils/auth";

import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";

import Setts from "@/assets/general/setts.svg";
import Notify from "@/assets/general/notify.svg";
import LinkIcon from "@/assets/general/link.svg";

import Folder from "@/components/other/Folder";
import { color } from "framer-motion";

export default function ProfileIndexPage({ goTo }) {
    const [userData, setUserData] = useState(null); // данные профиля
    const [hydrated, setHydrated] = useState(false); // флаг готовности данных
    const router = useRouter();

    useEffect(() => {
        // Утилита для удаления всех cookie (без confirm)
        const clearCookies = () => {
            const cookies = document.cookie.split(";");
            for (let cookie of cookies) {
                const eqPos = cookie.indexOf("=");
                const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            }
        };

        const fetchProfile = async () => {
            try {
                const response = await fetch("/api/profile/info", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                });

                const data = await response.json();

                if (!response.ok) {
                    // если сессия устарела — чистим куки и редиректим
                    if (response.status === 401 || response.status === 403) {
                        clearCookies();
                        router.push("/auth");
                        return;
                    }

                    // Обработка других ошибок через errorCode
                    switch (data.errorCode) {
                        case "EMAIL_NOT_CONFIRMED":
                            alert("Вы не подтвердили почту. Зайдите в свой почтовый клиент и перейдите по ссылке из письма");
                            clearCookies();
                            router.push("/auth");
                            return;

                        case "UNAUTHORIZED":
                            clearCookies();
                            router.push("/auth");
                            return;

                        case "NOT_FOUND":
                            alert("Профиль не найден");
                            return;

                        default:
                            console.error("Profile fetch error:", data.error);
                            return;
                    }
                }
                setUserData(data);
                console.log(data);
                setHydrated(true);
            } catch (err) {
                console.error("Request error:", err);
            }
        };

        fetchProfile();
    }, [router]);

    const handleLogout = async () => {
        const confirmed = window.confirm("Вы уверены, что хотите выйти?");
        if (!confirmed) return;

        try {
            // Вызываем серверный logout для очистки HttpOnly кук
            await fetch("/api/auth/logout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include", // Важно! Отправляем куки на сервер
                cache: "no-store",
            });
        } catch (error) {
            console.error("Logout API error:", error);
        }

        // Удаляем клиентские cookie (на всякий случай)

        const cookies = document.cookie.split(";");
        for (let cookie of cookies) {
            const eqPos = cookie.indexOf("=");
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        }

        // Редирект
        router.push("/auth");
    };

    if (!hydrated || !userData) return null;

    return (
        <>
            <Header>
                <Header.Heading>{userData.data.NameIRL && userData.data.Surname ? `${userData.data.NameIRL} ${userData.data.Surname}` : "Незаполнено"}</Header.Heading>
                <Button red className={"w-fit! shadow-none!"} onClick={handleLogout}>
                    Выйти
                </Button>
                <Button icon onClick={() => goTo("settings")}>
                    <Setts />
                </Button>
                {/* <Button icon>
                    <Notify />
                </Button> */}
            </Header>
            <div className="hero" style={{ gridTemplateRows: "repeat(2, auto)" }}>
                <Card>
                    <Card.Heading>
                        <div className="flex gap-[1rem] w-full">
                            {/* <div className="w-[4.75rem] aspect-square rounded-full bg-(--color-black)"></div> */}
                            <div className="flex flex-col gap-[0.25rem] flex-1 ">
                                <h4>{userData.data.NameIRL || userData.data.Surname || userData.data.Patronymic ? `${userData.data.NameIRL} ${userData.data.Surname} ${userData.data.Patronymic}` : "ФИО Незаполнено"}</h4>
                                <p className="line-clamp-3">{userData.data?.Description ? userData.data.Description : "Описание незаполнено"}</p>
                            </div>
                        </div>
                        <div className="flex gap-[0.5rem] flex-wrap">
                            <Tags
                                tags={[
                                    {
                                        name: `${userData.data.Type === "teacher" ? "Сотрудник" : userData.data.Type === "student" ? "Студент" : userData.data.Type === "moder" ? "Модератор" : "Ошибка данных"}`,
                                        color: "blue",
                                        icon: "coin",
                                    },
                                    { name: `${userData.data?.Region ? `${userData.data.Region}` : "Регион незаполнен"}`, color: "blue" },
                                ]}
                            />
                        </div>
                    </Card.Heading>
                    <Card.Footer>
                        <a className="big relative z-[1]">Теперь вы с нами!</a>
                    </Card.Footer>
                </Card>
                <div className="col-span-4 h-fit">
                    <div className="block-wrapper col-span-4">
                        <h6>Организация и команда</h6>
                        <div className="flex flex-col gap-[0.75rem]">
                            <Link href={`/organizations/${userData.data.Organization ? userData.data.Organization.id : ""}`}>
                                <div className="group cursor-pointer flex items-center justify-between w-full">
                                    <p className="flex-1 link">{userData.data.Organization ? userData.data.Organization.short_name : "Отсутствует"}</p>
                                    <LinkIcon className="stroke-(--color-gray-white) group-hover:stroke-black" style={{ transition: "stroke .3s ease-in-out" }} />
                                </div>
                            </Link>

                            <hr className="w-full border-solid border-[1.5px] border-(--color-gray-plus)" />
                            <Link href={"/teams/" + userData.data.team_id}>
                                <div className="group flex items-center justify-between w-full">
                                    <p className="flex-1 link">{userData.data.team ? userData.data.team : "Отсутсвует"}</p>
                                    <LinkIcon className="stroke-(--color-gray-white) group-hover:stroke-black" style={{ transition: "stroke .3s ease-in-out" }} />
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
                {/* <Folder projects="2" works="12" exp="100" onClick={() => goTo("workfolder")} /> */}
            </div>
        </>
    );
}
