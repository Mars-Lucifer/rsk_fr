import { useState, useEffect } from "react";
import { useRouter } from "next/router";

import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";
import Textarea from "@/components/ui/Textarea";
import DropdownInput from "@/components/ui/Input/DropdownInput";

import Notify from "@/assets/general/notify.svg";

export default function Createteam() {
    const [teamType, setTeamType] = useState("student"); // teacher
    const [formData, setFormData] = useState({
        name: "",
        region: "",
        organization_id: "",
        organization_name: "",
    });
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Загружаем данные пользователя для предзаполнения организации и региона
    useEffect(() => {
        const loadUserData = async () => {
            try {
                const response = await fetch("/api/profile/info", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                });

                const data = await response.json();
                if (data.success) {
                    setUserData(data.data);
                    // Предзаполняем форму данными из профиля
                    setFormData((prev) => ({
                        ...prev,
                        region: data.data.Region,
                        organization_name: data.data?.Organization.short_name,
                        organization_id: data.data?.Organization.id,
                    }));
                }
            } catch (err) {
                console.error("Error loading user data:", err);
            }
        };

        loadUserData();
    }, []);

    // Обработчик изменений полей формы
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // Обработчик отправки формы
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch("/api/teams/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name.toString(),
                    region: formData.region.toString(),
                    organization_id: formData.organization_id.toString(),
                }),
                credentials: "include",
            });

            const data = await response.json();
            console.log(data);

            if (response.ok && data.success) {
                alert("Команда успешно создана!");
                router.push(`/teams/my`);
            } else {
                alert("Ошибка при создании команды: " + (data.data.detail || "Неизвестная ошибка"));
            }
        } catch (err) {
            console.error("Create team error:", err);
            alert("Ошибка сети при создании команды");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <Header>
                <Header.Heading>
                    Команды <span className="text-(--color-gray-black)">/</span> Создание команды
                </Header.Heading>
                {/* <Button icon>
                    <Notify />
                </Button> */}
            </Header>
            <form onSubmit={handleSubmit} className="hero">
                <div className="col-span-4 flex flex-col">
                    <div className="flex flex-col gap-[1.25rem]">
                        <h6>Основные данные</h6>
                        {/* <Input type="image" className="w-1/2 aspect-square" /> */}
                        <Input type="text" id="name" name="name" autoComplete="name" placeholder="Название команды" value={formData.name} onChange={handleChange} required />
                        {/* <Textarea inverted id="direction" name="direction" autoComplete="direction" placeholder="Описание команды" value={formData.direction} onChange={handleChange} /> */}
                    </div>
                </div>
                <div className="col-span-4 flex flex-col">
                    <div className=" flex flex-col gap-[1.25rem]">
                        <h6>Организация и регион</h6>
                        <div className="flex flex-col gap-[.75rem]">
                            <Input type="text" disabled readOnly id="organization_name" name="organization_name" autoComplete="organization_name" placeholder="Организация" value={formData.organization_name} />
                            <Input type="text" disabled id="region" readOnly name="region" placeholder="Введите регион" value={formData.region} />
                            <p style={{ color: "var(--color-gray-black)" }}>* Данные берутся из профиля, заполните свой профиль если отсутсвуют данные региона или организации</p>
                        </div>
                    </div>
                </div>
                <div className="flex col-span-4 flex-col justify-between h-full">
                    <div className="flex flex-col gap-[1.25rem]"></div>
                    <Button onClick={handleSubmit}>Создать команду</Button>
                </div>
            </form>
        </Layout>
    );
}
