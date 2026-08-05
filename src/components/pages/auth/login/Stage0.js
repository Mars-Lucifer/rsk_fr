import React, { useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { saveUserData } from "@/utils/auth";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";

import Yandex from "@/assets/general/yandex.svg";
import VK from "@/assets/general/vk.svg";
import VKWidget from "@/components/features/auth/VKWidget";
import Link from "next/link";
import { PUBLIC_PORTAL_API_BASE } from "@/lib/portalApiBase";

export default function LoginStage0({ onForgotPassword, pageVariants, custom = 1, onAuthenticated, onOAuthStart }) {
    const router = useRouter();
    const [formData, setFormData] = useState({ login: "", password: "" });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // Получение данных профиля после логина
    const fetchProfile = async () => {
        try {
            const response = await fetch("/api/profile/info", {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok) {
                switch (data.errorCode) {
                    case "EMAIL_NOT_CONFIRMED":
                        return alert("Вы не подтвердили почту. Зайдите в свой почтовый клиент и перейдите по ссылке из письма");

                    case "FORBIDDEN":
                        return alert("Доступ запрещён");

                    case "NOT_FOUND":
                        return alert("Профиль не найден");

                    default:
                        return alert("Не удалось получить данные профиля: подтвердите почту");
                }
            }

            // Сохраняем email и name в localStorage
            const userInfo = {
                email: data.data.email,
                username: data.data.NameIRL,
            };
            await saveUserData(userInfo);

            console.log("Profile loaded:", userInfo);

            router.push("/profile");
        } catch (err) {
            console.error("Profile fetch error:", err);
            alert("Ошибка соединения с сервером. Проверьте интернет-соединение");
        }
    };

    const onLogin = async (formData) => {
        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok) {
                // Обработка ошибок через errorCode
                switch (data.errorCode) {
                    case "EMAIL_NOT_CONFIRMED":
                        return alert("Вы не подтвердили email. Зайдите в свой почтовый клиент и перейдите по ссылке из письма");

                    case "INVALID_CREDENTIALS":
                        return alert("Неверный логин или пароль");

                    case "USER_NOT_FOUND":
                        return alert("Пользователь с таким логином или почтой не существует");

                    case "VALIDATION_ERROR":
                        return alert("Неверные данные: " + data.error);

                    case "BAD_REQUEST":
                        return alert("Неверный запрос");

                    case "FORBIDDEN":
                        return alert("Доступ запрещён");

                    default:
                        return alert("Произошла ошибка при входе: " + (data.error || "Неизвестная ошибка"));
                }
            }

            // После успешного логина получаем профиль
            if (typeof onAuthenticated === "function") {
                await onAuthenticated();
                return;
            }

            await fetchProfile();
        } catch (err) {
            console.error("Login error:", err);
            alert("Ошибка подключения. Проверьте интернет-соединение");
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.password.length < 8) {
            alert("Пароль должен содержать минимум 8 символов");
            return;
        }
        onLogin(formData);
    };

    return (
        <motion.div key="login-stage0" custom={custom} initial="initial" animate="in" exit="out" variants={pageVariants} className="auth_cntr col-span-4 absolute justify-center w-full h-full">
            <h3>С возвращением!</h3>
            <form id="login" className="w-full grid grid-cols-1 gap-[0.75rem]" autoComplete="on" onSubmit={handleSubmit}>
                <Input type="text" name="login" placeholder="Почта / Логин" autoComplete="username" required value={formData.login} onChange={handleChange} />
                <Input type="password" name="password" autoComplete="current-password" placeholder="Пароль" required value={formData.password} onChange={handleChange} />
            </form>
            <div className="flex flex-col w-full gap-[0.75rem]">
                <Button type="submit" form="login" className="w-full justify-center">
                    Войти
                </Button>
                <div className="flex gap-[0.75rem] w-full items-center">
                    <Button
                        inverted
                        className="flex-1"
                        onClick={() => {
                            if (typeof onOAuthStart === "function") {
                                onOAuthStart("yandex");
                            }
                            window.location.href = `${PUBLIC_PORTAL_API_BASE}/auth/users_interaction/auth/yandex/login`;
                        }}>
                        Яндекс ID <Yandex />
                    </Button>
                    <div className="flex-1 overflow-hidden h-[46px] flex items-center justify-center">
                        <VKWidget onStart={onOAuthStart} />
                    </div>
                </div>
                <p className="w-full text-center text-gray">
                    Забыли пароль?{" "}
                    <span className="link cursor-pointer" onClick={() => onForgotPassword()}>
                        Восстановите
                    </span>
                </p>
            </div>
        </motion.div>
    );
}
