import React, { useState } from "react";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";
import Switcher from "@/components/ui/Switcher";

import Yandex from "@/assets/general/yandex.svg";
import VKWidget from "@/components/features/auth/VKWidget";

export default function RegStage0({ onContinue, pageVariants, custom = 1, onOAuthStart }) {
    const [userType, setUserType] = useState("student");
    const [formData, setFormData] = useState({
        last_name: "",
        first_name: "",
        email: "",
        password: "",
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.password.length < 8) {
            alert("Пароль должен содержать минимум 8 символов");
            return;
        }

        if (/^\d+$/.test(formData.password)) {
            alert("Пароль не может состоять только из цифр. Добавьте минимум одну строчную букву");
            return;
        }

        if (/^[^a-zA-Zа-яА-Я0-9]+$/.test(formData.password)) {
            alert("Пароль не может состоять только из специальных символов. Добавьте минимум одну строчную букву");
            return;
        }

        if (!/[a-zа-я]/.test(formData.password)) {
            alert("Пароль должен содержать хотя бы одну строчную букву");
            return;
        }

        const email = String(formData.email || "").trim();
        const firstName = String(formData.first_name || "").trim();
        const lastName = String(formData.last_name || "").trim();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert("Введите корректный email адрес");
            return;
        }

        if (lastName.length < 2) {
            alert("Фамилия должна содержать минимум 2 символа");
            return;
        }

        if (firstName.length < 2) {
            alert("Имя должно содержать минимум 2 символа");
            return;
        }

        const payload = {
            first_name: firstName,
            last_name: lastName,
            name: [firstName, lastName].filter(Boolean).join(" "),
            email,
            password: formData.password,
            role: userType,
        };

        try {
            const response = await fetch("/api/auth/reg", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                switch (data.errorCode) {
                    case "EMAIL_NOT_CONFIRMED":
                        return alert(data.error || "Вы не подтвердили почту. Проверьте письмо и перейдите по ссылке из него");

                    case "VALIDATION_ERROR":
                        return alert(data.error || "Неверные данные");

                    case "USER_EXISTS":
                    case "BAD_REQUEST":
                        return alert(data.error || "Пользователь с таким email уже существует");

                    case "UNAUTHORIZED":
                        return alert(data.error || "Неавторизованный запрос");

                    case "FORBIDDEN":
                        return alert(data.error || "Доступ запрещён");

                    case "NOT_FOUND":
                        return alert(data.error || "Ресурс не найден");

                    case "SERVER_ERROR":
                        return alert(data.error || "Ошибка сервера. Попробуйте позже");

                    case "UNKNOWN_ERROR":
                    default:
                        return alert(data.error || "Произошла неизвестная ошибка");
                }
            }

            onContinue({
                first_name: firstName,
                last_name: lastName,
                email,
            });
        } catch (err) {
            console.error("Registration error:", err);
            alert("Ошибка соединения с сервером. Проверьте интернет-соединение");
        }
    };

    return (
        <motion.div key="register-stage0" custom={custom} initial="initial" animate="in" exit="out" variants={pageVariants} className="auth_cntr col-span-4 absolute justify-center w-full h-full">
            <h3>Добро пожаловать</h3>
            <Switcher className="!w-full" value={userType} onChange={setUserType}>
                <Switcher.Option value="student">Студент</Switcher.Option>
                <Switcher.Option value="teacher">Сотрудник</Switcher.Option>
            </Switcher>
            <form id="registration" className="w-full grid grid-cols-1 gap-[0.75rem]" onSubmit={handleSubmit}>
                {[
                    { name: "last_name", placeholder: "Фамилия", type: "text", autocomplete: "family-name", tabIndex: 0, minLength: 2 },
                    { name: "first_name", placeholder: "Имя", type: "text", autocomplete: "given-name", tabIndex: 1, minLength: 2 },
                    { name: "email", placeholder: "Почта", type: "email", autocomplete: "email", tabIndex: 2 },
                    { name: "password", placeholder: "Пароль", type: "password", autocomplete: "new-password", tabIndex: 3 },
                ].map(({ name, placeholder, type, tabIndex, autocomplete, minLength }) => (
                    <Input key={name} name={name} type={type} placeholder={placeholder} value={formData[name] || ""} autoComplete={autocomplete} onChange={handleInputChange} tabIndex={tabIndex} minLength={minLength} required />
                ))}
            </form>
            <div className="flex flex-col w-full gap-[0.75rem]">
                <Button type="submit" className="w-full justify-center" form="registration">
                    Зарегистрироваться
                </Button>
                <div className="flex gap-[0.75rem] w-full items-center">
                    <Button
                        inverted
                        className="flex-1"
                        onClick={() => {
                            if (typeof onOAuthStart === "function") {
                                onOAuthStart("yandex");
                            }
                            window.location.href = "https://api.rosdk.ru/auth/users_interaction/auth/yandex/login";
                        }}>
                        Яндекс ID <Yandex />
                    </Button>
                    <div className="flex-1 overflow-hidden h-[46px] flex items-center justify-center">
                        <VKWidget onStart={onOAuthStart} />
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-[.5rem]">
                <Input type="checkbox" form="registration" small required autoComplete="off" name="POPD" id="POPD">
                    <span className="text">
                        Я даю согласие на{" "}
                        <a
                            target="_blank"
                            href="https://docs.yandex.ru/docs/view?url=ya-disk-public%3A%2F%2F4Y9bFhoQd%2BEh8Vk6aVciLCjpoC35hPNd1UYmIkGxmnsrxw5CImAYaS%2BTxOkTJkVEq%2FJ6bpmRyOJonT3VoXnDag%3D%3D%3A%2F152fz.pdf&name=152fz.pdf"
                            className="link">
                            обработку персональных данных
                        </a>
                    </span>
                </Input>
            </div>
        </motion.div>
    );
}
