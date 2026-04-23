import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import TeamNotFound from "./not-found";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";
import Textarea from "@/components/ui/Textarea";

import Notify from "@/assets/general/notify.svg";
import SettsIcon from "@/assets/general/setts.svg";

function buildTeamFormData(team) {
    return {
        name: team?.name || "",
        description: team?.description || "",
    };
}

export default function TeamSettsPage({ goTo, teamData }) {
    const router = useRouter();
    const team = teamData.team_info;

    const [formData, setFormData] = useState(() => buildTeamFormData(team));
    const [originalData, setOriginalData] = useState(() => buildTeamFormData(team));
    const [hydrated, setHydrated] = useState(Boolean(team));

    useEffect(() => {
        if (team) {
            const nextFormData = buildTeamFormData(team);
            const frameId = requestAnimationFrame(() => {
                setFormData(nextFormData);
                setOriginalData(nextFormData);
                setHydrated(true);
            });

            return () => {
                cancelAnimationFrame(frameId);
            };
        }
    }, [team]);

    const isDirty = formData.name !== originalData.name || formData.description !== originalData.description;

    if (!team) return <TeamNotFound activeButton goTo={goTo} />;
    if (!hydrated) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isDirty) return;

        const changes = {};
        Object.keys(formData).forEach((key) => {
            if (formData[key] !== originalData[key]) {
                changes[key] = formData[key];
            }
        });

        try {
            const response = await fetch(`/api/teams/update/${team.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(changes),
                credentials: "include",
            });

            const data = await response.json();
            if (response.ok) {
                setOriginalData(formData);
                alert("Изменения сохранены!");
                router.reload();
                router.push("/teams/my");
            } else {
                alert("Ошибка: " + JSON.stringify(data));
            }
        } catch (err) {
            console.error("Update error:", err);
        }
    };

    return (
        <>
            <Header>
                <Header.Heading>
                    Команды <span className="text-(--color-gray-black)">/</span> {team.name} <span className="text-(--color-gray-black)">/</span> Редактирование
                </Header.Heading>
                <Button icon active onClick={() => goTo("index")}>
                    <SettsIcon />
                </Button>
                <Button icon>
                    <Notify />
                </Button>
            </Header>

            <div className="hero">
                <div className="col-span-4 max-[900px]:col-span-6 max-[640px]:col-span-6 flex flex-col h-full gap-[1.25rem]">
                    <h6>Основные данные</h6>
                    <Input type="image" className="w-1/2 aspect-square" />
                    <Input id="teamName" name="name" autoComplete="off" type="text" placeholder="Введите название команды" value={formData.name} onChange={handleChange} />
                    <Textarea id="teamDesc" name="description" autoComplete="off" inverted placeholder="Введите описание команды" value={formData.description} onChange={handleChange} />
                </div>

                <div className="col-span-4 max-[900px]:col-span-6 max-[640px]:col-span-6 flex flex-col gap-[1.25rem]">
                    <h6>Организация и регион</h6>
                    <Textarea name="organization" id="organization" autoComplete="off" value={team.organization_name} readOnly />
                    <Input name="region" id="region" autoComplete="off" className="h-fit" value={team.region} readOnly />
                </div>

                <div className="col-span-4 max-[900px]:col-span-6 max-[640px]:col-span-6 flex flex-col justify-end">
                    <Button onClick={handleSubmit} disabled={!isDirty}>
                        Сохранить изменения
                    </Button>
                </div>
            </div>
        </>
    );
}

