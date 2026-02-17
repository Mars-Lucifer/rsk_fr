import { useEffect, useState } from "react";
import Link from "next/link";

import { setCookie } from "@/utils/cookies";

import Button from "@/components/ui/Button";
import Header from "@/components/layout/Header";
import Input from "@/components/ui/Input/Input";
import Textarea from "@/components/ui/Textarea";
import DropdownInput from "@/components/ui/Input/DropdownInput";

import Setts from "@/assets/general/setts.svg";
import Notify from "@/assets/general/notify.svg";

export default function SettingsPage({ goTo }) {
    const [userData, setUserData] = useState(null); // оригинальные данные
    const [orgList, setOrgList] = useState([]); // Изменено на массив по умолчанию
    const [formData, setFormData] = useState({ Organization: "", Region: "", Surname: "", NameIRL: "", Patronymic: "", Description: "" }); // данные для формы
    const [hydrated, setHydrated] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [region, setRegion] = useState("");

    useEffect(() => {
        const ProfileInfo = async () => {
            try {
                const response = await fetch("/api/profile/info", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                });
                const data = await response.json();
                setUserData(data);

                // Загружаем регион (строка) и ID организации
                setRegion(data.data.Region || "");

                setFormData({
                    Organization_id: data.data.organization_id || "", // ID организации (число/строка)
                    Region: data.data.Region || "",
                    Surname: data.data.Surname || "",
                    NameIRL: data.data.NameIRL || "",
                    Patronymic: data.data.Patronymic || "",
                    Description: data.data.Description || "",
                });

                setHydrated(true);
            } catch (err) {
                console.error(err);
            }
        };
        ProfileInfo();
    }, []);

    useEffect(() => {
        console.log("Region changed:", region);
        if (!region) {
            setOrgList([]);
            return;
        }

        const loadOrgs = async () => {
            try {
                const res = await fetch(`/api/org/all?region=${encodeURIComponent(region)}`, { credentials: "include" });
                const data = await res.json();
                console.log("API response:", data);
                setOrgList(data.success ? data.data : []); // ← сохраняем объекты целиком
            } catch (e) {
                console.error("Error loading orgs:", e);
                setOrgList([]);
            }
        };

        loadOrgs();
    }, [region]);

    // обработчик изменений полей
    const handleChange = (e) => {
        const { name, value } = e.target;
        // если меняется регион
        setFormData((prev) => {
            const newForm = { ...prev, [name]: value };
            if (userData?.data) {
                const dirty = Object.keys(newForm).some((key) => newForm[key] !== userData.data[key]);
                setIsDirty(dirty);
            }
            return newForm;
        });
    };

    const handleOrgChange = (value) => {
        setFormData((prev) => {
            const newForm = { ...prev, Organization_id: value };
            if (userData?.data) {
                const dirty = Object.keys(newForm).some((key) => newForm[key] !== (key === "Organization" ? userData.data.organization_id : userData.data[key]));
                setIsDirty(dirty);
            }
            return newForm;
        });
    };

    const handleRegionChange = (value) => {
        setRegion(value);
        setFormData((prev) => {
            const newForm = {
                ...prev,
                Region: value,
                Organization_id: "", // сброс ID организации
            };
            if (userData?.data) {
                const dirty = Object.keys(newForm).some((key) => newForm[key] !== (key === "Organization" ? userData.data.organization_id : userData.data[key]));
                setIsDirty(dirty);
            }
            return newForm;
        });
    };

    if (!hydrated || !userData) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isDirty) return;

        const changes = { id: userData.data.id };
        Object.keys(formData).forEach((key) => {
            const oldValue = key === "Organization" ? userData.data.organization_id : userData.data[key];
            if (formData[key] !== oldValue) {
                changes[key] = formData[key];
            }
        });

        try {
            const response = await fetch("/api/profile/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(changes),
                credentials: "include",
            });
            const data = await response.json();

            if (response.ok) {
                // Обновляем userData, включая organization_id
                setUserData((prev) => ({
                    ...prev,
                    data: {
                        ...prev.data,
                        ...formData,
                        organization_id: formData.Organization, // если бэкенд возвращает поле organization_id
                    },
                }));
                setIsDirty(false);

                if (changes.Organization) {
                    setCookie("organization", changes.Organization); // теперь ID
                }

                window.location.reload();
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
                    {userData.data.NameIRL && userData.data.Surname ? `${userData.data.NameIRL} ${userData.data.Surname}` : "Незаполнено"}
                    <span className="text-(--color-gray-black)">/</span> Настройки
                </Header.Heading>
                <Button icon active onClick={() => goTo("profile")}>
                    <Setts />
                </Button>
            </Header>
            <div className="hero" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <div className="flex flex-col gap-[.75rem]">
                    <h6>Основные данные</h6>
                    <div className="flex gap-[.75rem]">
                        <div className="flex flex-col gap-[.5rem] flex-1">
                            <Input type="text" id="FamilyName" name="Surname" placeholder="Введите фамилию" value={formData.Surname || ""} onChange={handleChange} required />
                            <Input type="text" id="name" name="NameIRL" placeholder="Введите имя" value={formData.NameIRL || ""} onChange={handleChange} required />
                            <Input type="text" id="surname" name="Patronymic" placeholder="Введите отчество" value={formData.Patronymic || ""} onChange={handleChange} />
                        </div>
                    </div>
                    <Textarea inverted id="about" name="Description" placeholder="Расскажите о себе кратко" value={formData.Description || ""} onChange={handleChange} />
                </div>

                <div className="flex flex-col gap-[1.25rem]">
                    <h6>Организация и регион</h6>
                    <div className="flex flex-col gap-[.75rem]">
                        <DropdownInput
                            id="Organization"
                            name="Organization"
                            placeholder="Организация"
                            value={formData.Organization} // ← ID
                            options={orgList} // ← массив объектов { id, short_name, ... }
                            onChange={(e) => handleOrgChange(e.target.value)}
                            disabled={!region}
                            className={`transition ${!region ? "opacity-60 pointer-events-none" : ""}`}
                        />
                        <DropdownInput id="region" name="Region" placeholder="Введите регион" value={region || ""} onChange={(e) => handleRegionChange(e.target.value || "")} src="/data/regions.txt" />
                        <p style={{ color: "var(--color-gray-black)" }}>
                            * Если вашей организации нет в списке, заполните{" "}
                            <Link target="_blank" className="text-(--color-blue)" href="https://forms.yandex.ru/u/690391e1068ff0a3ba625eef">
                                форму
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="flex flex-col justify-between h-full">
                    <div className="flex flex-col gap-[1.25rem]"></div>
                    <Button onClick={handleSubmit} disabled={!isDirty}>
                        Сохранить изменения
                    </Button>
                </div>
            </div>
        </>
    );
}
