import { useState, useEffect } from "react";

export async function getServerSideProps() {
    return { props: {} };
}
import Link from "next/link";
import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";
import Notify from "@/assets/general/notify.svg";

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

    // Перепривязка раздела
    const [rebindId, setRebindId] = useState(null);
    const [rebindValue, setRebindValue] = useState("");

    // Статистика
    const [stats, setStats] = useState({ total: 0, activeCount: 0, exhaustedCount: 0 });

    // Запросы на токены
    const [tokenRequests, setTokenRequests] = useState([]);
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [approveTokenId, setApproveTokenId] = useState({}); // { requestId: tokenId }

    // Ручное назначение токена
    const [manualTelegramId, setManualTelegramId] = useState("");
    const [manualName, setManualName] = useState("");
    const [manualTokenId, setManualTokenId] = useState("");

    // Названия разделов
    const [rangeNames, setRangeNames] = useState({});
    const [rangesList, setRangesList] = useState([]);

    // Бот и админы
    const [botInfo, setBotInfo] = useState({ username: null, link: null });
    const [botAdmins, setBotAdmins] = useState([]);
    const [newAdminId, setNewAdminId] = useState("");
    const [newAdminName, setNewAdminName] = useState("");

    // Настройки API-ключей
    const [settingsTgToken, setSettingsTgToken] = useState("");
    const [settingsOrKey, setSettingsOrKey] = useState("");
    const [settingsQwenTokenName, setSettingsQwenTokenName] = useState("");
    const [settingsQwenTokens, setSettingsQwenTokens] = useState("");
    const [settingsQwenBackupTokenName, setSettingsQwenBackupTokenName] = useState("");
    const [settingsQwenBackupToken, setSettingsQwenBackupToken] = useState("");
    const [settingsBotUsername, setSettingsBotUsername] = useState("");
    const [settingsWebhookUrl, setSettingsWebhookUrl] = useState("");
    const [settingsBaseUrl, setSettingsBaseUrl] = useState("");
    const [settingsInfo, setSettingsInfo] = useState({
        telegramBotToken: null,
        telegramBotTokenIsSet: false,
        openrouterApiKey: null,
        openrouterApiKeyIsSet: false,
        telegramBotUsername: "",
        telegramBotUsernameIsSet: false,
        telegramWebhookUrl: "",
        telegramWebhookUrlIsSet: false,
        baseUrl: "",
        baseUrlIsSet: false,
        qwenTokens: [],
        qwenTokensCount: 0,
        qwenTokensIsSet: false,
        qwenBackupToken: "",
        qwenBackupTokenName: "",
        qwenBackupTokenMask: null,
        qwenBackupTokenIsSet: false,
    });
    const [settingsSaving, setSettingsSaving] = useState(false);

    // Проверка авторизации при загрузке
    useEffect(() => {
        const savedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY);
        async function checkAuth() {
            try {
                const res = await fetch("/api/admin/mayak-auth");
                const json = await res.json();
                if (savedAuth === "true" && json.authenticated) {
                    setIsAuthenticated(true);
                } else {
                    sessionStorage.removeItem(AUTH_STORAGE_KEY);
                }
            } catch {}
            setLoading(false);
        }
        checkAuth();
    }, []);

    // Обработка входа
    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthError("");
        try {
            const res = await fetch("/api/admin/mayak-auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            const json = await res.json();
            if (!json.success) {
                setAuthError(json.error || "Неверный пароль");
                setPassword("");
                return;
            }
            setIsAuthenticated(true);
            sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
        } catch {
            setAuthError("Ошибка входа");
        }
    };

    // Загрузка токенов
    const fetchTokens = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/admin/mayak-tokens", {
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
            fetchRanges();
            fetchRequests();
            fetchBotAdmins();
            fetchSettings();
        }
    }, [isAuthenticated]);

    // Загрузка запросов на токены
    const fetchRequests = async () => {
        try {
            setRequestsLoading(true);
            const res = await fetch("/api/admin/mayak-tokens/requests");
            const data = await res.json();
            if (data.success) {
                setTokenRequests(data.data || []);
            }
        } catch (err) {
            console.error("Ошибка загрузки запросов:", err);
        } finally {
            setRequestsLoading(false);
        }
    };

    // Загрузка админов бота
    const fetchBotAdmins = async () => {
        try {
            const res = await fetch("/api/admin/bot-admins");
            const data = await res.json();
            if (data.success) {
                setBotAdmins(data.data || []);
                setBotInfo(data.bot || { username: null, link: null });
            }
        } catch (err) {
            console.error("Ошибка загрузки админов бота:", err);
        }
    };

    // Загрузка настроек API-ключей
    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/admin/mayak-settings");
            if (!res.ok) return;
            const text = await res.text();
            if (!text.startsWith("{")) return;
            const data = JSON.parse(text);
            if (data.success) {
                setSettingsInfo(data.data);
            }
        } catch (err) {
            console.error("Ошибка загрузки настроек:", err);
        }
    };

    const saveSettingsRequest = async (body, successMessage, clearCallback) => {
        try {
            setSettingsSaving(true);
            const res = await fetch("/api/admin/mayak-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const text = await res.text();
            if (!text.trim().startsWith("{")) {
                throw new Error("Сервер вернул HTML вместо JSON. Обнови страницу и повтори ещё раз.");
            }
            const data = JSON.parse(text);
            if (!data.success) throw new Error(data.error || "Ошибка сохранения");
            if (clearCallback) clearCallback();
            if (successMessage) {
                alert(typeof successMessage === "function" ? successMessage(data) : successMessage);
            }
            await fetchSettings();
        } catch (err) {
            alert(err.message);
        } finally {
            setSettingsSaving(false);
        }
    };

    // Сохранение настройки
    const handleSaveSettings = async (field) => {
        const body = {};
        const fieldMap = {
            telegramBotToken: { value: settingsTgToken, clear: () => setSettingsTgToken(""), emptyMsg: "Введите токен бота", successMsg: (d) => (d.botRestarted ? "Токен сохранён, бот перезапущен" : "Токен сохранён") },
            openrouterApiKey: { value: settingsOrKey, clear: () => setSettingsOrKey(""), emptyMsg: "Введите API-ключ", successMsg: () => "API-ключ сохранён" },
            telegramBotUsername: { value: settingsBotUsername, clear: () => setSettingsBotUsername(""), emptyMsg: "Введите username бота", successMsg: () => "Username бота сохранён" },
            telegramWebhookUrl: { value: settingsWebhookUrl, clear: () => setSettingsWebhookUrl(""), emptyMsg: null, successMsg: () => "Webhook URL сохранён" },
            baseUrl: { value: settingsBaseUrl, clear: () => setSettingsBaseUrl(""), emptyMsg: null, successMsg: () => "Base URL сохранён" },
            qwenBackupToken: { value: settingsQwenBackupToken, clear: () => setSettingsQwenBackupToken(""), emptyMsg: null, successMsg: () => "Резервный токен сохранён" },
        };
        const f = fieldMap[field];
        if (!f) return;
        if (f.emptyMsg && !f.value.trim()) {
            alert(f.emptyMsg);
            return;
        }
        if (field === "qwenBackupToken") {
            body[field] = f.value.trim() ? { name: settingsQwenBackupTokenName.trim(), token: f.value.trim() } : "";
        } else {
            body[field] = f.value.trim();
        }
        await saveSettingsRequest(body, f.successMsg, f.clear);
    };

    const handleAddQwenTokens = async () => {
        const tokenName = settingsQwenTokenName.trim();
        const tokenToAdd = settingsQwenTokens.trim();

        if (!tokenName) {
            alert("Введите название Qwen-токена");
            return;
        }

        if (!tokenToAdd) {
            alert("Введите Qwen-токен");
            return;
        }

        await saveSettingsRequest({ qwenTokenAdd: { name: tokenName, token: tokenToAdd } }, "Qwen-токен добавлен", () => {
            setSettingsQwenTokenName("");
            setSettingsQwenTokens("");
        });
    };

    const handleRemoveQwenToken = async (index) => {
        if (!window.confirm("Удалить этот Qwen-токен из пула?")) return;
        await saveSettingsRequest({ qwenTokenRemoveIndex: index }, "Qwen-токен удалён");
    };

    const handleSaveBackupToken = async () => {
        const tokenName = settingsQwenBackupTokenName.trim();
        const tokenValue = settingsQwenBackupToken.trim();

        if (!tokenName) {
            alert("Введите название резервного токена");
            return;
        }

        if (!tokenValue) {
            alert("Введите резервный токен");
            return;
        }

        await saveSettingsRequest({ qwenBackupToken: { name: tokenName, token: tokenValue } }, "Резервный токен сохранён", () => {
            setSettingsQwenBackupTokenName("");
            setSettingsQwenBackupToken("");
        });
    };

    const handleRemoveBackupToken = async () => {
        if (!window.confirm("Удалить резервный токен?")) return;
        await saveSettingsRequest({ qwenBackupToken: "" }, "Резервный токен удалён");
    };

    // Добавление админа бота
    const handleAddBotAdmin = async () => {
        if (!newAdminId.trim()) {
            alert("Укажите Telegram ID");
            return;
        }
        try {
            const res = await fetch("/api/admin/bot-admins", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ telegramId: newAdminId.trim(), name: newAdminName.trim() }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setBotAdmins(data.data);
            setNewAdminId("");
            setNewAdminName("");
        } catch (err) {
            alert(err.message);
        }
    };

    // Удаление админа бота
    const handleRemoveBotAdmin = async (telegramId) => {
        if (!window.confirm("Удалить этого админа бота?")) return;
        try {
            const res = await fetch("/api/admin/bot-admins", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ telegramId }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setBotAdmins(data.data);
        } catch (err) {
            alert(err.message);
        }
    };

    // Одобрение запроса (привязка токена)
    const handleApproveRequest = async (requestId) => {
        const tokenId = approveTokenId[requestId];
        if (!tokenId) {
            alert("Выберите токен для привязки");
            return;
        }
        try {
            const res = await fetch("/api/admin/mayak-tokens/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId, action: "approve", tokenId }),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Ошибка одобрения");
            }
            setApproveTokenId((prev) => {
                const n = { ...prev };
                delete n[requestId];
                return n;
            });
            await fetchRequests();
        } catch (err) {
            alert(err.message);
        }
    };

    // Ручное назначение токена по Telegram ID
    const handleManualAssign = async () => {
        if (!manualTelegramId.trim()) {
            alert("Укажите Telegram ID");
            return;
        }
        if (!manualTokenId) {
            alert("Выберите токен");
            return;
        }
        try {
            const res = await fetch("/api/admin/mayak-tokens/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "manual_assign", telegramId: manualTelegramId.trim(), tokenId: manualTokenId, name: manualName.trim() || null }),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Ошибка назначения");
            }
            setManualTelegramId("");
            setManualName("");
            setManualTokenId("");
            alert("Токен назначен, пользователь получит уведомление в Telegram");
            await fetchRequests();
        } catch (err) {
            alert(err.message);
        }
    };

    // Отклонение запроса
    const handleRejectRequest = async (requestId) => {
        if (!window.confirm("Отклонить запрос? Пользователь получит уведомление.")) return;
        try {
            const res = await fetch("/api/admin/mayak-tokens/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId, action: "reject" }),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Ошибка отклонения");
            }
            await fetchRequests();
        } catch (err) {
            alert(err.message);
        }
    };

    // Удаление запроса
    const handleDeleteRequest = async (requestId) => {
        if (!window.confirm("Удалить запрос навсегда?")) return;
        try {
            const res = await fetch("/api/admin/mayak-tokens/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId, action: "delete" }),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Ошибка удаления");
            }
            await fetchRequests();
        } catch (err) {
            alert(err.message);
        }
    };

    // Загрузка разделов для выпадающего списка
    const fetchRanges = async () => {
        try {
            const res = await fetch("/api/admin/mayak-content/ranges");
            const data = await res.json();
            if (data.success && data.data) {
                setRangesList(data.data);
                const names = {};
                data.data.forEach((r) => {
                    const key = r.sectionId || r.range;
                    if (r.rangeName) names[key] = r.rangeName;
                });
                setRangeNames(names);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Создание нового токена
    const selectedSection = rangesList.find((r) => (r.sectionId || r.range) === newTokenRange) || null;

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
                    taskRange: selectedSection ? selectedSection.range : newTokenRange.trim() || null,
                    sectionId: selectedSection ? selectedSection.sectionId : null,
                    customToken: newCustomToken.trim() || null, // Отправляем кастомный токен
                    
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
                body: JSON.stringify({ attempts: parseInt(attemptsToAdd, 10) }),
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
                body: JSON.stringify({}),
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

    // Перепривязка токена к другому разделу
    const handleRebind = async (tokenId) => {
        const section = rangesList.find((r) => (r.sectionId || r.range) === rebindValue) || null;
        try {
            const res = await fetch(`/api/admin/mayak-tokens/${tokenId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    
                    sectionId: section ? section.sectionId : rebindValue || null,
                    taskRange: section ? section.range : rebindValue || null,
                }),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Ошибка перепривязки");
            }
            setRebindId(null);
            setRebindValue("");
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
                                <label className="link small text-(--color-gray-black) block mb-[.5rem]">Пароль</label>
                                <Input type="password" placeholder="Введите пароль" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
                            </div>
                            {authError && <p className="text-[var(--color-red)] text-center">{authError}</p>}
                            <Button type="submit">Войти</Button>
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
                <div className="flex items-center gap-[.5rem]">
                    <Link href="/admin/content" style={{ padding: "6px 14px", borderRadius: 6, background: "#3b82f6", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                        Контент
                    </Link>
                    <Link href="/admin/mayak-sessions" style={{ padding: "6px 14px", borderRadius: 6, background: "#0f766e", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                        Сессии
                    </Link>
                    <Button icon>
                        <Notify />
                    </Button>
                </div>
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

                    {/* Telegram-бот */}
                    <div className="p-[1.25rem] rounded-[1rem] border-[1.5px] border-(--color-gray-plus-50)">
                        <h5 className="mb-[1rem]">Telegram-бот</h5>
                        <div className="flex flex-col gap-[1rem]">
                            {/* Ссылка на бота */}
                            <div className="flex items-center gap-[.75rem] flex-wrap">
                                <span className="link small text-(--color-gray-black)">Бот:</span>
                                {botInfo.username ? (
                                    <a href={botInfo.link} target="_blank" rel="noopener noreferrer" style={{ color: "#0088cc", fontWeight: 600, fontSize: 14 }}>
                                        @{botInfo.username}
                                    </a>
                                ) : (
                                    <span className="text-(--color-gray-black)" style={{ fontSize: 13 }}>
                                        Не настроен (задайте TELEGRAM_BOT_USERNAME в .env)
                                    </span>
                                )}
                            </div>

                            {/* Настройки API-ключей */}
                            <div className="p-[.75rem] rounded-[.75rem] bg-(--color-white-gray)">
                                <span className="link small text-(--color-gray-black)" style={{ display: "block", marginBottom: 8 }}>
                                    Настройки:
                                </span>
                                <div className="flex flex-col gap-[.75rem]">
                                    {/* Токен Telegram-бота */}
                                    <div className="flex gap-[.5rem] items-end flex-wrap">
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="link small text-(--color-gray-black) block mb-[.25rem]">
                                                Токен Telegram-бота
                                                {settingsInfo.telegramBotTokenIsSet ? (
                                                    <span style={{ color: "#22c55e", marginLeft: 6, fontSize: 11 }}>({settingsInfo.telegramBotToken})</span>
                                                ) : (
                                                    <span style={{ color: "#ef4444", marginLeft: 6, fontSize: 11 }}>(не задан)</span>
                                                )}
                                            </label>
                                            <Input type="password" placeholder="Введите новый токен бота" value={settingsTgToken} onChange={(e) => setSettingsTgToken(e.target.value)} />
                                        </div>
                                        <Button small inverted roundeful className="!w-fit approve-button" onClick={() => handleSaveSettings("telegramBotToken")} disabled={settingsSaving}>
                                            {settingsSaving ? "..." : "Сохранить"}
                                        </Button>
                                    </div>
                                    {/* Username бота */}
                                    <div className="flex gap-[.5rem] items-end flex-wrap">
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="link small text-(--color-gray-black) block mb-[.25rem]">
                                                Username бота (без @)
                                                {settingsInfo.telegramBotUsernameIsSet ? (
                                                    <span style={{ color: "#22c55e", marginLeft: 6, fontSize: 11 }}>(@{settingsInfo.telegramBotUsername})</span>
                                                ) : (
                                                    <span style={{ color: "#ef4444", marginLeft: 6, fontSize: 11 }}>(не задан)</span>
                                                )}
                                            </label>
                                            <Input type="text" placeholder="my_bot_username" value={settingsBotUsername} onChange={(e) => setSettingsBotUsername(e.target.value)} />
                                        </div>
                                        <Button small inverted roundeful className="!w-fit approve-button" onClick={() => handleSaveSettings("telegramBotUsername")} disabled={settingsSaving}>
                                            {settingsSaving ? "..." : "Сохранить"}
                                        </Button>
                                    </div>
                                    {/* OpenRouter API Key */}
                                    <div className="flex gap-[.5rem] items-end flex-wrap">
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="link small text-(--color-gray-black) block mb-[.25rem]">
                                                OpenRouter API Key
                                                {settingsInfo.openrouterApiKeyIsSet ? (
                                                    <span style={{ color: "#22c55e", marginLeft: 6, fontSize: 11 }}>({settingsInfo.openrouterApiKey})</span>
                                                ) : (
                                                    <span style={{ color: "#ef4444", marginLeft: 6, fontSize: 11 }}>(не задан)</span>
                                                )}
                                            </label>
                                            <Input type="password" placeholder="Введите OpenRouter API Key" value={settingsOrKey} onChange={(e) => setSettingsOrKey(e.target.value)} />
                                        </div>
                                        <Button small inverted roundeful className="!w-fit approve-button" onClick={() => handleSaveSettings("openrouterApiKey")} disabled={settingsSaving}>
                                            {settingsSaving ? "..." : "Сохранить"}
                                        </Button>
                                    </div>
                                    <div className="flex flex-col gap-[.75rem]">
                                        <div className="flex flex-col gap-[.5rem]">
                                            <label className="link small text-(--color-gray-black) block">
                                                Qwen токены
                                                {settingsInfo.qwenTokensIsSet ? (
                                                    <span style={{ color: "#22c55e", marginLeft: 6, fontSize: 11 }}>(сохранено: {settingsInfo.qwenTokensCount})</span>
                                                ) : (
                                                    <span style={{ color: "#ef4444", marginLeft: 6, fontSize: 11 }}>(не заданы)</span>
                                                )}
                                            </label>
                                            <div className="flex gap-[.5rem] items-end flex-wrap">
                                                <div className="min-w-[220px] flex-1">
                                                    <Input type="text" placeholder="Название токена" value={settingsQwenTokenName} onChange={(e) => setSettingsQwenTokenName(e.target.value)} />
                                                </div>
                                                <div className="flex-1 min-w-[260px]">
                                                    <Input type="password" placeholder="Введите один Qwen-токен" value={settingsQwenTokens} onChange={(e) => setSettingsQwenTokens(e.target.value)} />
                                                </div>
                                                <Button small inverted roundeful className="!w-fit approve-button" onClick={handleAddQwenTokens} disabled={settingsSaving}>
                                                    {settingsSaving ? "..." : "Добавить"}
                                                </Button>
                                            </div>
                                            {settingsInfo.qwenTokens.length > 0 ? (
                                                <details className="rounded-[.75rem] border border-(--color-gray-plus-50) bg-white p-[.5rem_.75rem]">
                                                    <summary className="link small text-(--color-gray-black)" style={{ cursor: "pointer", userSelect: "none" }}>
                                                        Список токенов ({settingsInfo.qwenTokensCount})
                                                    </summary>
                                                    <div className="mt-[.5rem] flex flex-col gap-[.5rem]">
                                                        {settingsInfo.qwenTokens.map((tokenInfo, index) => (
                                                            <div
                                                                key={`${tokenInfo.name}-${tokenInfo.mask}-${index}`}
                                                                className="flex items-center justify-between gap-[.75rem] rounded-[.5rem] border border-(--color-gray-plus-50) bg-[#f8fafc] p-[.5rem_.75rem] flex-wrap">
                                                                <div className="min-w-[240px] flex-1">
                                                                    <div className="link small text-(--color-gray-black)">
                                                                        №{index + 1}. {tokenInfo.name || `Токен ${index + 1}`}
                                                                    </div>
                                                                    <code className="text-[.75rem]">{tokenInfo.mask}</code>
                                                                </div>
                                                                <div className="flex gap-[.5rem] items-center flex-wrap">
                                                                    <Button small inverted roundeful className="!w-fit !p-[.25rem_.5rem]" onClick={() => copyToClipboard(tokenInfo.token)} disabled={settingsSaving}>
                                                                        Копировать
                                                                    </Button>
                                                                    <Button small inverted roundeful red className="!w-fit reject-button !p-[.25rem_.5rem]" onClick={() => handleRemoveQwenToken(index)} disabled={settingsSaving}>
                                                                        Удалить
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            ) : (
                                                <div style={{ fontSize: 12, color: "#6b7280" }}>Сохранённых Qwen-токенов пока нет.</div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-[.5rem]">
                                            <label className="link small text-(--color-gray-black) block">
                                                Резервный платный токен
                                                {settingsInfo.qwenBackupTokenIsSet ? (
                                                    <span style={{ color: "#22c55e", marginLeft: 6, fontSize: 11 }}>(задан)</span>
                                                ) : (
                                                    <span style={{ color: "#6b7280", marginLeft: 6, fontSize: 11 }}>(не задан)</span>
                                                )}
                                            </label>
                                            <div className="flex gap-[.5rem] items-end flex-wrap">
                                                <div className="min-w-[220px] flex-1">
                                                    <Input type="text" placeholder="Название резервного токена" value={settingsQwenBackupTokenName} onChange={(e) => setSettingsQwenBackupTokenName(e.target.value)} />
                                                </div>
                                                <div className="flex-1 min-w-[260px]">
                                                    <Input type="password" placeholder="Введите резервный токен" value={settingsQwenBackupToken} onChange={(e) => setSettingsQwenBackupToken(e.target.value)} />
                                                </div>
                                                <Button small inverted roundeful className="!w-fit approve-button" onClick={handleSaveBackupToken} disabled={settingsSaving}>
                                                    {settingsSaving ? "..." : "Добавить"}
                                                </Button>
                                            </div>
                                            {settingsInfo.qwenBackupTokenIsSet ? (
                                                <details className="rounded-[.75rem] border border-(--color-gray-plus-50) bg-white p-[.5rem_.75rem]">
                                                    <summary className="link small text-(--color-gray-black)" style={{ cursor: "pointer", userSelect: "none" }}>
                                                        Резервный токен
                                                    </summary>
                                                    <div className="mt-[.5rem] flex flex-col gap-[.5rem]">
                                                        <div className="flex items-center justify-between gap-[.75rem] rounded-[.5rem] border border-(--color-gray-plus-50) bg-[#f8fafc] p-[.5rem_.75rem] flex-wrap">
                                                            <div className="min-w-[240px] flex-1">
                                                                <div className="link small text-(--color-gray-black)">{settingsInfo.qwenBackupTokenName || "Резервный токен"}</div>
                                                                <code className="text-[.75rem]">{settingsInfo.qwenBackupTokenMask}</code>
                                                            </div>
                                                            <div className="flex gap-[.5rem] items-center flex-wrap">
                                                                <Button small inverted roundeful className="!w-fit !p-[.25rem_.5rem]" onClick={() => copyToClipboard(settingsInfo.qwenBackupToken)} disabled={settingsSaving}>
                                                                    Копировать
                                                                </Button>
                                                                <Button small inverted roundeful red className="!w-fit reject-button !p-[.25rem_.5rem]" onClick={handleRemoveBackupToken} disabled={settingsSaving}>
                                                                    Удалить
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </details>
                                            ) : null}
                                        </div>
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="link small text-(--color-gray-black) block mb-[.25rem]">
                                                Webhook URL (требует перезапуска сервера)
                                                {settingsInfo.telegramWebhookUrlIsSet ? (
                                                    <span style={{ color: "#22c55e", marginLeft: 6, fontSize: 11 }}>(задан)</span>
                                                ) : (
                                                    <span style={{ color: "#6b7280", marginLeft: 6, fontSize: 11 }}>(polling режим)</span>
                                                )}
                                            </label>
                                            <Input
                                                type="text"
                                                placeholder={settingsInfo.telegramWebhookUrl || "https://self.rosdk.ru/api/mayak/telegram-webhook"}
                                                value={settingsWebhookUrl}
                                                onChange={(e) => setSettingsWebhookUrl(e.target.value)}
                                            />
                                        </div>
                                        <Button small inverted roundeful className="!w-fit approve-button" onClick={() => handleSaveSettings("telegramWebhookUrl")} disabled={settingsSaving}>
                                            {settingsSaving ? "..." : "Сохранить"}
                                        </Button>
                                    </div>
                                    {/* Base URL */}
                                    <div className="flex gap-[.5rem] items-end flex-wrap">
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="link small text-(--color-gray-black) block mb-[.25rem]">
                                                Base URL приложения
                                                {settingsInfo.baseUrlIsSet ? (
                                                    <span style={{ color: "#22c55e", marginLeft: 6, fontSize: 11 }}>({settingsInfo.baseUrl})</span>
                                                ) : (
                                                    <span style={{ color: "#ef4444", marginLeft: 6, fontSize: 11 }}>(не задан)</span>
                                                )}
                                            </label>
                                            <Input type="text" placeholder={settingsInfo.baseUrl || "https://self.rosdk.ru"} value={settingsBaseUrl} onChange={(e) => setSettingsBaseUrl(e.target.value)} />
                                        </div>
                                        <Button small inverted roundeful className="!w-fit approve-button" onClick={() => handleSaveSettings("baseUrl")} disabled={settingsSaving}>
                                            {settingsSaving ? "..." : "Сохранить"}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Список админов */}
                            <div>
                                <span className="link small text-(--color-gray-black)" style={{ display: "block", marginBottom: 8 }}>
                                    Админы бота (могут создавать prep-сессии):
                                </span>
                                {botAdmins.length === 0 ? (
                                    <p className="text-(--color-gray-black)" style={{ fontSize: 13 }}>
                                        Нет админов
                                    </p>
                                ) : (
                                    <div className="flex flex-col gap-[.5rem]">
                                        {botAdmins.map((admin) => (
                                            <div key={admin.telegramId} className="flex items-center justify-between gap-[.75rem] p-[.5rem_.75rem] rounded-[.5rem] bg-(--color-white-gray)">
                                                <div>
                                                    <span className="font-medium" style={{ fontSize: 14 }}>
                                                        {admin.name || "Без имени"}
                                                    </span>
                                                    <span className="text-(--color-gray-black)" style={{ fontSize: 12, marginLeft: 8 }}>
                                                        ID: {admin.telegramId}
                                                    </span>
                                                </div>
                                                <Button small inverted roundeful className="!w-fit reject-button !p-[.25rem_.5rem]" onClick={() => handleRemoveBotAdmin(admin.telegramId)}>
                                                    Удалить
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Форма добавления */}
                            <div className="flex gap-[.5rem] items-end flex-wrap">
                                <div>
                                    <label className="link small text-(--color-gray-black) block mb-[.25rem]">Telegram ID</label>
                                    <Input type="text" placeholder="123456789" value={newAdminId} onChange={(e) => setNewAdminId(e.target.value)} className="!w-[160px]" />
                                </div>
                                <div>
                                    <label className="link small text-(--color-gray-black) block mb-[.25rem]">Имя (опц.)</label>
                                    <Input type="text" placeholder="Имя" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} className="!w-[160px]" />
                                </div>
                                <Button small inverted roundeful className="!w-fit approve-button" onClick={handleAddBotAdmin}>
                                    Добавить
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Запросы на токены */}
                    {(() => {
                        const pendingRequests = tokenRequests.filter((r) => r.status === "pending" || r.status === "awaiting_code");
                        const historyRequests = tokenRequests.filter((r) => r.status === "approved" || r.status === "rejected");
                        return (
                            <div className="p-[1.25rem] rounded-[1rem] border-[1.5px] border-(--color-gray-plus-50)">
                                <div className="flex items-center justify-between mb-[1rem]">
                                    <h5>
                                        Запросы на токены
                                        {pendingRequests.length > 0 && (
                                            <span style={{ marginLeft: 8, background: "#ef4444", color: "#fff", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{pendingRequests.length}</span>
                                        )}
                                    </h5>
                                    <Button small inverted roundeful className="!w-fit" onClick={fetchRequests} disabled={requestsLoading}>
                                        {requestsLoading ? "..." : "Обновить"}
                                    </Button>
                                </div>

                                {/* Ручное назначение токена */}
                                <div className="p-[.75rem] rounded-[.75rem] bg-(--color-white-gray) mb-[1rem]">
                                    <span className="link small text-(--color-gray-black)" style={{ display: "block", marginBottom: 8 }}>
                                        Назначить токен вручную:
                                    </span>
                                    <div className="flex gap-[.5rem] items-end flex-wrap">
                                        <div>
                                            <label className="link small text-(--color-gray-black) block mb-[.25rem]">Telegram ID</label>
                                            <Input type="text" placeholder="123456789" value={manualTelegramId} onChange={(e) => setManualTelegramId(e.target.value)} className="!w-[140px]" />
                                        </div>
                                        <div>
                                            <label className="link small text-(--color-gray-black) block mb-[.25rem]">Имя (опц.)</label>
                                            <Input type="text" placeholder="Имя" value={manualName} onChange={(e) => setManualName(e.target.value)} className="!w-[120px]" />
                                        </div>
                                        <div>
                                            <label className="link small text-(--color-gray-black) block mb-[.25rem]">Токен</label>
                                            <select
                                                value={manualTokenId}
                                                onChange={(e) => setManualTokenId(e.target.value)}
                                                style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid var(--color-gray-plus-50)", fontSize: 13, background: "#fff", minWidth: 160 }}>
                                                <option value="">Выберите токен</option>
                                                {tokens
                                                    .filter((t) => t.isActive && !t.isExhausted)
                                                    .map((t) => (
                                                        <option key={t.id} value={t.id}>
                                                            {t.name} ({t.sectionId || t.taskRange || "Все"})
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                        <Button small inverted roundeful className="!w-fit approve-button" onClick={handleManualAssign}>
                                            Назначить
                                        </Button>
                                    </div>
                                </div>

                                {pendingRequests.length === 0 && historyRequests.length === 0 && <p className="text-(--color-gray-black) text-center py-[1rem]">Нет запросов</p>}

                                {pendingRequests.length > 0 && (
                                    <div className="overflow-x-auto mb-[1rem]">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-(--color-gray-plus-50)">
                                                    <th className="text-left p-[.75rem] link small">Пользователь</th>
                                                    <th className="text-left p-[.75rem] link small">Статус</th>
                                                    <th className="text-left p-[.75rem] link small">Секретный код</th>
                                                    <th className="text-left p-[.75rem] link small">Дата</th>
                                                    <th className="text-right p-[.75rem] link small">Действия</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pendingRequests.map((req) => (
                                                    <tr key={req.id} className="border-b border-(--color-gray-plus-50) hover:bg-(--color-white-gray)">
                                                        <td className="p-[.75rem]">
                                                            <span className="font-medium">{req.firstName || "—"}</span>
                                                            {req.username && <div className="text-[.75rem] text-(--color-gray-black)">@{req.username}</div>}
                                                            <div className="text-[.7rem] text-(--color-gray-black)">ID: {req.telegramId}</div>
                                                        </td>
                                                        <td className="p-[.75rem]">
                                                            {req.status === "awaiting_code" ? (
                                                                <span style={{ color: "#f59e0b", fontWeight: 600, fontSize: 13 }}>Ждёт код</span>
                                                            ) : (
                                                                <span style={{ color: "#3b82f6", fontWeight: 600, fontSize: 13 }}>Ожидает</span>
                                                            )}
                                                        </td>
                                                        <td className="p-[.75rem]">
                                                            {req.secretCode ? (
                                                                <code className="text-[.85rem] bg-(--color-white-gray) px-[.5rem] py-[.25rem] rounded">{req.secretCode}</code>
                                                            ) : (
                                                                <span className="text-(--color-gray-black)">—</span>
                                                            )}
                                                        </td>
                                                        <td className="p-[.75rem] text-[.875rem] text-(--color-gray-black)">{formatDate(req.createdAt)}</td>
                                                        <td className="p-[.75rem]">
                                                            <div className="flex flex-col gap-[.5rem] items-end">
                                                                <div className="flex gap-[.5rem] items-center">
                                                                    <select
                                                                        value={approveTokenId[req.id] || ""}
                                                                        onChange={(e) => setApproveTokenId((prev) => ({ ...prev, [req.id]: e.target.value }))}
                                                                        style={{ padding: "4px 6px", borderRadius: 6, border: "1.5px solid var(--color-gray-plus-50)", fontSize: 12, background: "#fff", maxWidth: 180 }}>
                                                                        <option value="">Выберите токен</option>
                                                                        {tokens
                                                                            .filter((t) => t.isActive && !t.isExhausted)
                                                                            .map((t) => (
                                                                                <option key={t.id} value={t.id}>
                                                                                    {t.name} ({t.sectionId || t.taskRange || "Все"})
                                                                                </option>
                                                                            ))}
                                                                    </select>
                                                                    <Button small inverted roundeful className="!w-fit approve-button !p-[.25rem_.5rem]" onClick={() => handleApproveRequest(req.id)}>
                                                                        Одобрить
                                                                    </Button>
                                                                </div>
                                                                <div className="flex gap-[.5rem]">
                                                                    <Button small inverted roundeful className="!w-fit reject-button !p-[.25rem_.5rem]" onClick={() => handleRejectRequest(req.id)}>
                                                                        Отклонить
                                                                    </Button>
                                                                    <Button small inverted roundeful className="!w-fit !p-[.25rem_.5rem]" onClick={() => handleDeleteRequest(req.id)}>
                                                                        Удалить
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {historyRequests.length > 0 && (
                                    <details style={{ marginTop: pendingRequests.length > 0 ? 8 : 0 }}>
                                        <summary className="link small text-(--color-gray-black)" style={{ cursor: "pointer", userSelect: "none" }}>
                                            История ({historyRequests.length})
                                        </summary>
                                        <div className="overflow-x-auto" style={{ marginTop: 8 }}>
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-(--color-gray-plus-50)">
                                                        <th className="text-left p-[.5rem] link small">Пользователь</th>
                                                        <th className="text-left p-[.5rem] link small">Код</th>
                                                        <th className="text-left p-[.5rem] link small">Токен</th>
                                                        <th className="text-center p-[.5rem] link small">Статус</th>
                                                        <th className="text-left p-[.5rem] link small">Дата</th>
                                                        <th className="text-right p-[.5rem] link small"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {historyRequests.map((req) => {
                                                        const assignedToken = req.assignedTokenId ? tokens.find((t) => t.id === req.assignedTokenId) : null;
                                                        return (
                                                            <tr key={req.id} className="border-b border-(--color-gray-plus-50)">
                                                                <td className="p-[.5rem]">
                                                                    <span className="text-[.85rem]">{req.firstName || "—"}</span>
                                                                    {req.username && <span className="text-[.75rem] text-(--color-gray-black)"> @{req.username}</span>}
                                                                    <div className="text-[.65rem] text-(--color-gray-black)">ID: {req.telegramId}</div>
                                                                </td>
                                                                <td className="p-[.5rem]">
                                                                    <code className="text-[.75rem]">{req.secretCode || "—"}</code>
                                                                </td>
                                                                <td className="p-[.5rem]">
                                                                    {assignedToken ? (
                                                                        <div>
                                                                            <code
                                                                                className="text-[.7rem] bg-(--color-white-gray) px-[.25rem] py-[.1rem] rounded cursor-pointer"
                                                                                title="Нажмите чтобы скопировать"
                                                                                onClick={() => copyToClipboard(assignedToken.token)}>
                                                                                {assignedToken.token.substring(0, 8)}...
                                                                            </code>
                                                                            <div className="text-[.65rem] text-(--color-gray-black)">{assignedToken.name}</div>
                                                                            <div className="text-[.65rem] text-(--color-gray-black)">{assignedToken.sectionId || assignedToken.taskRange || "Все"}</div>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[.75rem] text-(--color-gray-black)">—</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-[.5rem] text-center">
                                                                    {req.status === "approved" ? (
                                                                        <span style={{ color: "#22c55e", fontWeight: 600, fontSize: 12 }}>Одобрен</span>
                                                                    ) : (
                                                                        <span style={{ color: "#ef4444", fontWeight: 600, fontSize: 12 }}>Отклонён</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-[.5rem] text-[.8rem] text-(--color-gray-black)">{formatDate(req.updatedAt)}</td>
                                                                <td className="p-[.5rem] text-right">
                                                                    <Button small inverted roundeful className="!w-fit !p-[.15rem_.4rem]" style={{ fontSize: 11 }} onClick={() => handleDeleteRequest(req.id)}>
                                                                        ×
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </details>
                                )}
                            </div>
                        );
                    })()}

                    {/* Форма создания токена */}
                    <div className="p-[1.25rem] rounded-[1rem] border-[1.5px] border-(--color-gray-plus-50)">
                        <h5 className="mb-[1rem]">Создать новый токен</h5>
                        <form onSubmit={handleCreateToken} className="flex gap-[1rem] flex-wrap items-end">
                            <div className="flex-1 min-w-[200px]">
                                <label className="link small text-(--color-gray-black) block mb-[.5rem]">Название токена</label>
                                <Input type="text" placeholder="Например: Группа 101" value={newTokenName} onChange={(e) => setNewTokenName(e.target.value)} />
                            </div>
                            <div className="w-[150px]">
                                <label className="link small text-(--color-gray-black) block mb-[.5rem]">Лимит использований</label>
                                <Input type="number" placeholder="30" min="1" value={newTokenLimit} onChange={(e) => setNewTokenLimit(e.target.value)} />
                            </div>
                            <div className="w-[200px]">
                                <label className="link small text-(--color-gray-black) block mb-[.5rem]">Раздел (опц.)</label>
                                <select
                                    value={newTokenRange}
                                    onChange={(e) => setNewTokenRange(e.target.value)}
                                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid var(--color-gray-plus-50)", fontSize: 14, background: "#fff" }}>
                                    <option value="">Все разделы</option>
                                    {rangesList.map((r) => {
                                        const key = r.sectionId || r.range;
                                        return (
                                            <option key={key} value={key}>
                                                {key}
                                                {r.rangeName ? ` — ${r.rangeName}` : ""}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="w-[200px]">
                                <label className="link small text-(--color-gray-black) block mb-[.5rem]">Свой токен (опц.)</label>
                                <Input type="text" placeholder="my-secret-token" value={newCustomToken} onChange={(e) => setNewCustomToken(e.target.value)} />
                            </div>
                            <Button type="submit" disabled={creating} className="!w-fit">
                                {creating ? "Создание..." : "Создать токен"}
                            </Button>
                        </form>
                    </div>

                    {/* Таблица токенов */}
                    <div className="p-[1.25rem] rounded-[1rem] border-[1.5px] border-(--color-gray-plus-50)">
                        <details open>
                            <summary style={{ cursor: "pointer", userSelect: "none", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <h5 style={{ margin: 0 }}>Список токенов ({tokens.length})</h5>
                                <span className="text-(--color-gray-black)" style={{ fontSize: 12 }}>
                                    {tokens.length > 0 ? "свернуть/развернуть" : ""}
                                </span>
                            </summary>

                            {tokens.length === 0 ? (
                                <p className="text-(--color-gray-black) text-center py-[2rem]">Токены не найдены. Создайте первый токен выше.</p>
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
                                                // Проверка валидности привязки к разделу
                                                const tokenSection = token.sectionId || token.taskRange;
                                                const matchedRange = tokenSection ? rangesList.find((r) => (r.sectionId || r.range) === tokenSection) : null;
                                                const hasBinding = !!tokenSection;
                                                const sectionMissing = hasBinding && !matchedRange;
                                                const rangeMismatch = hasBinding && matchedRange && token.taskRange && matchedRange.range !== token.taskRange;
                                                const bindingInvalid = sectionMissing || rangeMismatch;
                                                return (
                                                    <tr key={token.id} className="border-b border-(--color-gray-plus-50) hover:bg-(--color-white-gray)">
                                                        <td className="p-[.75rem]">
                                                            <span className="font-medium">{token.name}</span>
                                                        </td>
                                                        <td className="p-[.75rem]">
                                                            <div className="flex items-center gap-[.5rem]">
                                                                <code className="text-[.75rem] bg-(--color-white-gray) px-[.5rem] py-[.25rem] rounded max-w-[200px] overflow-hidden text-ellipsis">{token.token.substring(0, 16)}...</code>
                                                                <Button small inverted roundeful className="!w-fit !p-[.5rem]" onClick={() => copyToClipboard(token.token)}>
                                                                    Копировать
                                                                </Button>
                                                            </div>
                                                        </td>
                                                        <td className="p-[.75rem] text-center">
                                                            {rebindId === token.id ? (
                                                                <div className="flex flex-col gap-[.25rem] items-center">
                                                                    <select
                                                                        value={rebindValue}
                                                                        onChange={(e) => setRebindValue(e.target.value)}
                                                                        style={{ width: "100%", padding: "4px 6px", borderRadius: 6, border: "1.5px solid var(--color-gray-plus-50)", fontSize: 12, background: "#fff" }}>
                                                                        <option value="">Все разделы</option>
                                                                        {rangesList.map((r) => {
                                                                            const key = r.sectionId || r.range;
                                                                            return (
                                                                                <option key={key} value={key}>
                                                                                    {key}
                                                                                    {r.rangeName ? ` — ${r.rangeName}` : ""}
                                                                                </option>
                                                                            );
                                                                        })}
                                                                    </select>
                                                                    <div className="flex gap-[.25rem]">
                                                                        <Button small inverted roundeful className="!w-fit approve-button !p-[.25rem_.5rem]" onClick={() => handleRebind(token.id)}>
                                                                            OK
                                                                        </Button>
                                                                        <Button
                                                                            small
                                                                            inverted
                                                                            roundeful
                                                                            className="!w-fit !p-[.25rem_.5rem]"
                                                                            onClick={() => {
                                                                                setRebindId(null);
                                                                                setRebindValue("");
                                                                            }}>
                                                                            X
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : token.sectionId || token.taskRange ? (
                                                                <div>
                                                                    <span className="font-medium" style={bindingInvalid ? { color: "#dc2626" } : undefined}>
                                                                        {token.sectionId || token.taskRange}
                                                                    </span>
                                                                    {rangeNames[token.sectionId || token.taskRange] && <div className="text-[.7rem] text-(--color-gray-black)">{rangeNames[token.sectionId || token.taskRange]}</div>}
                                                                    {token.sectionId && token.taskRange && token.sectionId !== token.taskRange && <div className="text-[.65rem] text-(--color-gray-black)">({token.taskRange})</div>}
                                                                    {sectionMissing && (
                                                                        <div
                                                                            style={{
                                                                                fontSize: 10,
                                                                                color: "#dc2626",
                                                                                fontWeight: 600,
                                                                                marginTop: 2,
                                                                                padding: "1px 6px",
                                                                                background: "#fef2f2",
                                                                                borderRadius: 4,
                                                                                display: "inline-block",
                                                                                cursor: "pointer",
                                                                            }}
                                                                            onClick={() => {
                                                                                setRebindId(token.id);
                                                                                setRebindValue("");
                                                                            }}>
                                                                            Раздел не найден — перепривязать
                                                                        </div>
                                                                    )}
                                                                    {rangeMismatch && (
                                                                        <div
                                                                            style={{
                                                                                fontSize: 10,
                                                                                color: "#dc2626",
                                                                                fontWeight: 600,
                                                                                marginTop: 2,
                                                                                padding: "1px 6px",
                                                                                background: "#fef2f2",
                                                                                borderRadius: 4,
                                                                                display: "inline-block",
                                                                                cursor: "pointer",
                                                                            }}
                                                                            onClick={() => {
                                                                                setRebindId(token.id);
                                                                                setRebindValue("");
                                                                            }}>
                                                                            Диапазон не совпадает ({matchedRange.range}) — перепривязать
                                                                        </div>
                                                                    )}
                                                                    {!bindingInvalid && (
                                                                        <div
                                                                            style={{ fontSize: 10, color: "#6366f1", cursor: "pointer", marginTop: 2 }}
                                                                            onClick={() => {
                                                                                setRebindId(token.id);
                                                                                setRebindValue(token.sectionId || token.taskRange || "");
                                                                            }}>
                                                                            изменить
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    <span>—</span>
                                                                    <div
                                                                        style={{ fontSize: 10, color: "#6366f1", cursor: "pointer", marginTop: 2 }}
                                                                        onClick={() => {
                                                                            setRebindId(token.id);
                                                                            setRebindValue("");
                                                                        }}>
                                                                        привязать
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-[.75rem] text-center">
                                                            <span className={token.isExhausted ? "text-[var(--color-red)]" : ""}>
                                                                {token.usedCount} / {token.usageLimit}
                                                            </span>
                                                            <br />
                                                            <span className="link small text-(--color-gray-black)">(осталось: {token.remainingAttempts})</span>
                                                        </td>
                                                        <td className="p-[.75rem] text-center">
                                                            <span className={status.color}>{status.text}</span>
                                                        </td>
                                                        <td className="p-[.75rem] text-[.875rem] text-(--color-gray-black)">{formatDate(token.createdAt)}</td>
                                                        <td className="p-[.75rem]">
                                                            <div className="flex justify-end gap-[.5rem] flex-wrap">
                                                                {addAttemptsId === token.id ? (
                                                                    <div className="flex gap-[.5rem] items-center">
                                                                        <Input type="number" placeholder="10" min="1" value={attemptsToAdd} onChange={(e) => setAttemptsToAdd(e.target.value)} className="!w-[80px]" />
                                                                        <Button small inverted roundeful className="!w-fit approve-button" onClick={() => handleAddAttempts(token.id)}>
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
                                                                            }}>
                                                                            X
                                                                        </Button>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <Button small inverted roundeful className="!w-fit" onClick={() => setAddAttemptsId(token.id)} disabled={!token.isActive}>
                                                                            + Попытки
                                                                        </Button>
                                                                        {token.isActive && (
                                                                            <Button small inverted roundeful red className="!w-fit reject-button" onClick={() => handleDelete(token.id, token.name)}>
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
                        </details>
                    </div>
                </div>
            </div>
        </Layout>
    );
}


