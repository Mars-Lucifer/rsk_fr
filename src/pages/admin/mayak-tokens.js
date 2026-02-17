"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";
import Notify from "@/assets/general/notify.svg";

const ADMIN_PASSWORD = "a12345";
const AUTH_STORAGE_KEY = "mayak_admin_auth";

export default function AdminMayakTokens() {
    const [tokens, setTokens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Авторизация
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [authError, setAuthError] = useState("");

    // Форма создания токена
    const [newTokenName, setNewTokenName] = useState("");
    const [newTokenLimit, setNewTokenLimit] = useState("");
    const [newTokenRange, setNewTokenRange] = useState(""); // Новый стейт для диапазона
    const [newCustomToken, setNewCustomToken] = useState(""); // Новый стейт для кастомного токена
    const [creating, setCreating] = useState(false);

    // Добавление попыток
    const [addAttemptsId, setAddAttemptsId] = useState(null);
    const [attemptsToAdd, setAttemptsToAdd] = useState("");

    // Статистика
    const [stats, setStats] = useState({ total: 0, activeCount: 0, exhaustedCount: 0 });

    // Проверка авторизации при загрузке
    useEffect(() => {
        const savedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY);
        if (savedAuth === "true") {
            setIsAuthenticated(true);
        } else {
            setLoading(false);
        }
    }, []);

    // Обработка входа
    const handleLogin = (e) => {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            setIsAuthenticated(true);
            sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
            setAuthError("");
        } else {
            setAuthError("Неверный пароль");
            setPassword("");
        }
    };

    // Загрузка токенов
    const fetchTokens = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/admin/mayak-tokens?password=" + ADMIN_PASSWORD, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Ошибка загрузки данных");
            }

            const data = await res.json();
            setTokens(data.data || []);
            setStats({
                total: data.total || 0,
                activeCount: data.activeCount || 0,
                exhaustedCount: data.exhaustedCount || 0,
            });
            setError(null);
        } catch (err) {
            console.error("Ошибка:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchTokens();
        }
    }, [isAuthenticated]);

    // Создание нового токена
    const handleCreateToken = async (e) => {
        e.preventDefault();

        if (!newTokenName.trim() || !newTokenLimit) {
            alert("Заполните все поля");
            return;
        }

        try {
            setCreating(true);
            const res = await fetch("/api/admin/mayak-tokens/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newTokenName.trim(),
                    usageLimit: parseInt(newTokenLimit, 10),
                    taskRange: newTokenRange.trim() || null, // Отправляем диапазон
                    customToken: newCustomToken.trim() || null, // Отправляем кастомный токен
                    password: ADMIN_PASSWORD,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Ошибка создания токена");
            }

            setNewTokenName("");
            setNewTokenLimit("");
            setNewTokenRange(""); // Очищаем поле
            setNewCustomToken(""); // Очищаем поле
            await fetchTokens();
        } catch (err) {
            console.error("Ошибка создания:", err);
            alert(err.message);
        } finally {
            setCreating(false);
        }
    };

    // Добавление попыток
    const handleAddAttempts = async (tokenId) => {
        if (!attemptsToAdd || parseInt(attemptsToAdd, 10) <= 0) {
            alert("Введите положительное число попыток");
            return;
        }

        try {
            const res = await fetch(`/api/admin/mayak-tokens/${tokenId}/add-attempts`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ attempts: parseInt(attemptsToAdd, 10), password: ADMIN_PASSWORD }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Ошибка добавления попыток");
            }

            setAddAttemptsId(null);
            setAttemptsToAdd("");
            await fetchTokens();
        } catch (err) {
            console.error("Ошибка:", err);
            alert(err.message);
        }
    };

    // Удаление токена
    const handleDelete = async (tokenId, tokenName) => {
        if (!window.confirm(`Вы уверены, что хотите УДАЛИТЬ токен "${tokenName}"? Это действие нельзя отменить.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/mayak-tokens/${tokenId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: ADMIN_PASSWORD }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Ошибка удаления токена");
            }

            await fetchTokens();
        } catch (err) {
            console.error("Ошибка:", err);
            alert(err.message);
        }
    };

    // Копирование токена в буфер обмена
    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            alert("Токен скопирован в буфер обмена");
        } catch (err) {
            console.error("Ошибка копирования:", err);
            // Fallback для старых браузеров
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            alert("Токен скопирован в буфер обмена");
        }
    };

    // Форматирование даты
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Статус токена
    const getTokenStatus = (token) => {
        if (!token.isActive) return { text: "Деактивирован", color: "text-[var(--color-red)]" };
        if (token.isExhausted) return { text: "Исчерпан", color: "text-[var(--color-orange)]" };
        return { text: "Активен", color: "text-[var(--color-green)]" };
    };

    if (loading) {
        return (
            <Layout>
                <Header>
                    <Header.Heading>Токены МАЯК</Header.Heading>
                    <Button icon>
                        <Notify />
                    </Button>
                </Header>
                <div className="flex h-full items-center justify-center">
                    <p>Загрузка...</p>
                </div>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout>
                <Header>
                    <Header.Heading>Токены МАЯК</Header.Heading>
                    <Button icon>
                        <Notify />
                    </Button>
                </Header>
                <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                        <p className="text-[var(--color-red)] mb-4">{error}</p>
                        <Button onClick={fetchTokens}>Попробовать снова</Button>
                    </div>
                </div>
            </Layout>
        );
    }

    // Форма авторизации
    if (!isAuthenticated) {
        return (
            <Layout>
                <Header>
                    <Header.Heading>Токены МАЯК</Header.Heading>
                    <Button icon>
                        <Notify />
                    </Button>
                </Header>
                <div className="flex h-full items-center justify-center">
                    <div className="p-[2rem] rounded-[1rem] border-[1.5px] border-(--color-gray-plus-50) w-full max-w-[400px]">
                        <h5 className="mb-[1.5rem] text-center">Вход в админ-панель</h5>
                        <form onSubmit={handleLogin} className="flex flex-col gap-[1rem]">
                            <div>
                                <label className="link small text-(--color-gray-black) block mb-[.5rem]">
                                    Пароль
                                </label>
                                <Input
                                    type="password"
                                    placeholder="Введите пароль"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            {authError && (
                                <p className="text-[var(--color-red)] text-center">{authError}</p>
                            )}
                            <Button type="submit">
                                Войти
                            </Button>
                        </form>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <Header>
                <Header.Heading>Токены МАЯК</Header.Heading>
                <Button icon>
                    <Notify />
                </Button>
            </Header>
            <div className="hero">
                <div className="col-span-12 flex flex-col gap-[1.5rem]">
                    {/* Статистика */}
                    <div className="flex gap-[1rem] flex-wrap">
                        <div className="flex-1 min-w-[200px] p-[1rem] rounded-[1rem] border-[1.5px] border-(--color-gray-plus-50)">
                            <p className="link small text-(--color-gray-black)">Всего токенов</p>
                            <p className="text-[1.5rem] font-bold">{stats.total}</p>
                        </div>
                        <div className="flex-1 min-w-[200px] p-[1rem] rounded-[1rem] border-[1.5px] border-(--color-gray-plus-50)">
                            <p className="link small text-(--color-gray-black)">Активных</p>
                            <p className="text-[1.5rem] font-bold text-[var(--color-green)]">{stats.activeCount}</p>
                        </div>
                        <div className="flex-1 min-w-[200px] p-[1rem] rounded-[1rem] border-[1.5px] border-(--color-gray-plus-50)">
                            <p className="link small text-(--color-gray-black)">Исчерпанных</p>
                            <p className="text-[1.5rem] font-bold text-[var(--color-orange)]">{stats.exhaustedCount}</p>
                        </div>
                    </div>

                    {/* Форма создания токена */}
                    <div className="p-[1.25rem] rounded-[1rem] border-[1.5px] border-(--color-gray-plus-50)">
                        <h5 className="mb-[1rem]">Создать новый токен</h5>
                        <form onSubmit={handleCreateToken} className="flex gap-[1rem] flex-wrap items-end">
                            <div className="flex-1 min-w-[200px]">
                                <label className="link small text-(--color-gray-black) block mb-[.5rem]">
                                    Название токена
                                </label>
                                <Input
                                    type="text"
                                    placeholder="Например: Группа 101"
                                    value={newTokenName}
                                    onChange={(e) => setNewTokenName(e.target.value)}
                                />
                            </div>
                            <div className="w-[150px]">
                                <label className="link small text-(--color-gray-black) block mb-[.5rem]">
                                    Лимит использований
                                </label>
                                <Input
                                    type="number"
                                    placeholder="30"
                                    min="1"
                                    value={newTokenLimit}
                                    onChange={(e) => setNewTokenLimit(e.target.value)}
                                />
                            </div>
                            <div className="w-[200px]">
                                <label className="link small text-(--color-gray-black) block mb-[.5rem]">
                                    Диапазон (опц.)
                                </label>
                                <Input
                                    type="text"
                                    placeholder="1-100"
                                    value={newTokenRange}
                                    onChange={(e) => setNewTokenRange(e.target.value)}
                                />
                            </div>
                            <div className="w-[200px]">
                                <label className="link small text-(--color-gray-black) block mb-[.5rem]">
                                    Свой токен (опц.)
                                </label>
                                <Input
                                    type="text"
                                    placeholder="my-secret-token"
                                    value={newCustomToken}
                                    onChange={(e) => setNewCustomToken(e.target.value)}
                                />
                            </div>
                            <Button type="submit" disabled={creating} className="!w-fit">
                                {creating ? "Создание..." : "Создать токен"}
                            </Button>
                        </form>
                    </div>

                    {/* Таблица токенов */}
                    <div className="p-[1.25rem] rounded-[1rem] border-[1.5px] border-(--color-gray-plus-50)">
                        <h5 className="mb-[1rem]">Список токенов</h5>

                        {tokens.length === 0 ? (
                            <p className="text-(--color-gray-black) text-center py-[2rem]">
                                Токены не найдены. Создайте первый токен выше.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-(--color-gray-plus-50)">
                                            <th className="text-left p-[.75rem] link small">Название</th>
                                            <th className="text-left p-[.75rem] link small">Токен</th>
                                            <th className="text-center p-[.75rem] link small">Диапазон</th>
                                            <th className="text-center p-[.75rem] link small">Использований</th>
                                            <th className="text-center p-[.75rem] link small">Статус</th>
                                            <th className="text-left p-[.75rem] link small">Создан</th>
                                            <th className="text-right p-[.75rem] link small">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tokens.map((token) => {
                                            const status = getTokenStatus(token);
                                            return (
                                                <tr key={token.id} className="border-b border-(--color-gray-plus-50) hover:bg-(--color-white-gray)">
                                                    <td className="p-[.75rem]">
                                                        <span className="font-medium">{token.name}</span>
                                                    </td>
                                                    <td className="p-[.75rem]">
                                                        <div className="flex items-center gap-[.5rem]">
                                                            <code className="text-[.75rem] bg-(--color-white-gray) px-[.5rem] py-[.25rem] rounded max-w-[200px] overflow-hidden text-ellipsis">
                                                                {token.token.substring(0, 16)}...
                                                            </code>
                                                            <Button
                                                                small
                                                                inverted
                                                                roundeful
                                                                className="!w-fit !p-[.5rem]"
                                                                onClick={() => copyToClipboard(token.token)}
                                                            >
                                                                Копировать
                                                            </Button>
                                                        </div>
                                                    </td>
                                                    <td className="p-[.75rem] text-center">
                                                        {token.taskRange || "—"}
                                                    </td>
                                                    <td className="p-[.75rem] text-center">
                                                        <span className={token.isExhausted ? "text-[var(--color-red)]" : ""}>
                                                            {token.usedCount} / {token.usageLimit}
                                                        </span>
                                                        <br />
                                                        <span className="link small text-(--color-gray-black)">
                                                            (осталось: {token.remainingAttempts})
                                                        </span>
                                                    </td>
                                                    <td className="p-[.75rem] text-center">
                                                        <span className={status.color}>{status.text}</span>
                                                    </td>
                                                    <td className="p-[.75rem] text-[.875rem] text-(--color-gray-black)">
                                                        {formatDate(token.createdAt)}
                                                    </td>
                                                    <td className="p-[.75rem]">
                                                        <div className="flex justify-end gap-[.5rem] flex-wrap">
                                                            {addAttemptsId === token.id ? (
                                                                <div className="flex gap-[.5rem] items-center">
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="10"
                                                                        min="1"
                                                                        value={attemptsToAdd}
                                                                        onChange={(e) => setAttemptsToAdd(e.target.value)}
                                                                        className="!w-[80px]"
                                                                    />
                                                                    <Button
                                                                        small
                                                                        inverted
                                                                        roundeful
                                                                        className="!w-fit approve-button"
                                                                        onClick={() => handleAddAttempts(token.id)}
                                                                    >
                                                                        OK
                                                                    </Button>
                                                                    <Button
                                                                        small
                                                                        inverted
                                                                        roundeful
                                                                        className="!w-fit"
                                                                        onClick={() => {
                                                                            setAddAttemptsId(null);
                                                                            setAttemptsToAdd("");
                                                                        }}
                                                                    >
                                                                        X
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <Button
                                                                        small
                                                                        inverted
                                                                        roundeful
                                                                        className="!w-fit"
                                                                        onClick={() => setAddAttemptsId(token.id)}
                                                                        disabled={!token.isActive}
                                                                    >
                                                                        + Попытки
                                                                    </Button>
                                                                    {token.isActive && (
                                                                        <Button
                                                                            small
                                                                            inverted
                                                                            roundeful
                                                                            red
                                                                            className="!w-fit reject-button"
                                                                            onClick={() => handleDelete(token.id, token.name)}
                                                                        >
                                                                            Удалить
                                                                        </Button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
