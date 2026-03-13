import { useEffect, useMemo, useState } from "react";

import Header from "@/components/layout/Header";
import { addKeyToCookies, addUserToCookies, clearUserCookie, getKeyFromCookies, removeKeyCookie } from "./actions";
import { v4 as uuidv4 } from "uuid";

import CloseIcon from "@/assets/general/close.svg";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";

async function validateTokenAPI(tokenValue) {
    try {
        const response = await fetch(`/api/mayak/validate-token?token=${encodeURIComponent(tokenValue)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();
        return {
            valid: data.valid || false,
            isActive: data.isActive || false,
            isExhausted: data.isExhausted || false,
            remainingAttempts: data.remainingAttempts || 0,
            usageLimit: data.usageLimit || 0,
            usedCount: data.usedCount || 0,
            error: data.error || null,
            isBypass: data.isBypass || false,
            session: data.session || null,
        };
    } catch (error) {
        console.error("Ошибка проверки токена:", error);
        return {
            valid: false,
            isActive: false,
            isExhausted: false,
            remainingAttempts: 0,
            usageLimit: 0,
            usedCount: 0,
            error: "Ошибка сервера",
            isBypass: false,
            session: null,
        };
    }
}

async function useTokenAPI(tokenValue) {
    try {
        const response = await fetch("/api/mayak/validate-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: tokenValue }),
        });
        const data = await response.json();
        return {
            success: data.success || false,
            remainingAttempts: data.remainingAttempts || 0,
            error: data.error || null,
            isBypass: data.isBypass || false,
        };
    } catch (error) {
        console.error("Ошибка использования токена:", error);
        return { success: false, remainingAttempts: 0, error: "Ошибка сервера", isBypass: false };
    }
}

async function loginMayakAdmin(password) {
    try {
        const response = await fetch("/api/admin/mayak-auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        const data = await response.json().catch(() => ({}));
        return { success: response.ok && Boolean(data.success), error: data.error || null };
    } catch (error) {
        console.error("Ошибка локального bypass-входа:", error);
        return { success: false, error: "Ошибка сервера" };
    }
}

async function registerSessionParticipant({ token, userId, userData }) {
    const response = await fetch("/api/mayak/session/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, userId, userData }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) throw new Error(payload.error || "Не удалось зарегистрировать участника в сессии");
    return payload.data || null;
}

export default function SettingsPage({ goTo }) {
    const [token, setToken] = useState("");
    const [isTokenValid, setIsTokenValid] = useState(false);
    const [tokenExists, setTokenExists] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [isDevBypass, setIsDevBypass] = useState(false);
    const [bypassPassword, setBypassPassword] = useState("");
    const [bypassPasswordError, setBypassPasswordError] = useState("");
    const [sessionInfo, setSessionInfo] = useState(null);
    const [userData, setUserData] = useState({ lastName: "", firstName: "", college: "", tableNumber: "" });
    const [isLoading, setIsLoading] = useState(false);
    const [max, setMax] = useState(180);
    const [value, setValue] = useState(0);
    const [tokenRemainingAttempts, setTokenRemainingAttempts] = useState(0);
    const [tokenError, setTokenError] = useState("");
    const [isValidating, setIsValidating] = useState(false);

    const availableTables = useMemo(() => (Array.isArray(sessionInfo?.tables) ? sessionInfo.tables : []), [sessionInfo]);
    const hasSessionFlow = Boolean(sessionInfo?.id);
    const requiresTableNumber = hasSessionFlow;

    async function getRecordsCount() {
        try {
            const response = await fetch("/api/mayak/count");
            if (!response.ok) throw new Error("Не удалось получить количество записей");
            const data = await response.json();
            return data.count;
        } catch (error) {
            console.error("Ошибка при получении количества записей:", error);
            return 0;
        }
    }

    const getRangeClass = (val) => {
        if (val < 30) return "range-low";
        if (val < 80) return "range-mid";
        return "range-high";
    };

    const validateToken = async (tokenToValidate) => {
        if (!tokenToValidate || tokenToValidate.trim() === "") {
            setIsTokenValid(false);
            setShowNotification(false);
            setTokenError("");
            setIsDevBypass(false);
            setBypassPasswordError("");
            setSessionInfo(null);
            setUserData((prev) => ({ ...prev, tableNumber: "" }));
            return;
        }

        setIsValidating(true);
        const result = await validateTokenAPI(tokenToValidate);
        const isAccessible = result.valid || (result.isExhausted && result.isActive);
        setIsTokenValid(isAccessible);
        setTokenRemainingAttempts(result.remainingAttempts);
        setIsDevBypass(Boolean(result.isBypass));
        setSessionInfo(result.session?.id ? result.session : null);
        if (!result.isBypass) {
            setBypassPassword("");
            setBypassPasswordError("");
        }
        if (result.usageLimit > 0) {
            setMax(result.usageLimit);
            setValue(result.remainingAttempts);
        }
        if (result.session?.id && result.session?.tables?.length === 1) {
            setUserData((prev) => ({ ...prev, tableNumber: String(result.session.tables[0]) }));
        }
        if (isAccessible) {
            setShowNotification(true);
            setTokenError("");
        } else {
            setTokenError(result.error || "Токен недействителен");
            setShowNotification(false);
        }
        setIsValidating(false);
    };

    useEffect(() => {
        async function fetchTokenAndUsage() {
            const keyInCookies = await getKeyFromCookies();
            if (keyInCookies && keyInCookies.text) {
                if (keyInCookies.text === "ADMIN-BYPASS-TOKEN") {
                    await removeKeyCookie();
                    await clearUserCookie();
                    setToken("");
                    setTokenExists(false);
                    setShowNotification(false);
                    setIsTokenValid(false);
                    setIsDevBypass(false);
                    setSessionInfo(null);
                    return;
                }
                setToken(keyInCookies.text);
                setTokenExists(true);
                const result = await validateTokenAPI(keyInCookies.text);
                const isAccessible = result.valid || (result.isExhausted && result.isActive);
                setIsTokenValid(isAccessible);
                setTokenRemainingAttempts(result.remainingAttempts);
                setIsDevBypass(Boolean(result.isBypass));
                setSessionInfo(result.session?.id ? result.session : null);
                if (result.usageLimit > 0) {
                    setMax(result.usageLimit);
                    setValue(result.remainingAttempts);
                }
                if (isAccessible) setShowNotification(true);
            }
        }
        fetchTokenAndUsage();
    }, []);

    useEffect(() => {
        if (!token || token.trim() === "") return undefined;
        const delayDebounceFn = setTimeout(() => {
            validateToken(token);
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [token]);

    const handleUserDataChange = (e) => {
        const { name, value: fieldValue } = e.target;
        setUserData((prev) => ({ ...prev, [name]: fieldValue }));
    };

    const enterWithDevBypass = async () => {
        setBypassPasswordError("");
        if (!bypassPassword) {
            setBypassPasswordError("Введите пароль администратора");
            return;
        }
        const authResult = await loginMayakAdmin(bypassPassword);
        if (!authResult.success) {
            setBypassPasswordError(authResult.error || "Не удалось авторизовать локальный вход");
            return;
        }
        await addKeyToCookies(token);
        await addUserToCookies("dev-bypass", "Локальный вход");
        goTo("trainer");
    };

    const saveData = async () => {
        if (isDevBypass) {
            await enterWithDevBypass();
            return;
        }
        if (!isTokenValid) {
            alert("Пожалуйста, введите корректный токен для активации тренажера");
            return;
        }
        if (!userData.lastName || !userData.firstName || !userData.college) {
            alert("Пожалуйста, заполните обязательные поля: Фамилия, Имя и Организация");
            return;
        }
        if (requiresTableNumber && !String(userData.tableNumber || "").trim()) {
            alert("Пожалуйста, укажите номер стола");
            return;
        }

        setIsLoading(true);
        let shouldNavigateToTrainer = false;
        try {
            const useResult = await useTokenAPI(token);
            if (!useResult.success) {
                alert(useResult.error || "Ошибка при использовании токена");
                setIsLoading(false);
                return;
            }
            const userId = uuidv4();
            const normalizedUserData = { ...userData, tableNumber: String(userData.tableNumber || "").trim() };
            const userRecord = { id: userId, userData: normalizedUserData };
            const response = await fetch("/api/mayak/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: token, userId, data: userRecord }),
            });
            if (!response.ok) throw new Error("Ошибка при сохранении данных");
            if (hasSessionFlow) await registerSessionParticipant({ token, userId, userData: normalizedUserData });
            await addKeyToCookies(token);
            await addUserToCookies(userId, `${normalizedUserData.lastName} ${normalizedUserData.firstName}`, {
                sessionId: hasSessionFlow ? sessionInfo?.id || null : null,
                tableNumber: hasSessionFlow ? normalizedUserData.tableNumber || null : null,
            });
            const updatedRecordsCount = await getRecordsCount();
            setValue(max - updatedRecordsCount);
            setUserData({
                lastName: "",
                firstName: "",
                college: "",
                tableNumber: hasSessionFlow && sessionInfo?.tables?.length === 1 ? String(sessionInfo.tables[0]) : "",
            });
            shouldNavigateToTrainer = true;
        } catch (error) {
            console.error("Ошибка:", error);
            alert(error.message || "Произошла ошибка при сохранении данных");
        } finally {
            setIsLoading(false);
            if (shouldNavigateToTrainer) goTo("trainer");
        }
    };

    return (
        <>
            <Header>
                <Header.Heading>МАЯК ОКО</Header.Heading>
                <Button icon onClick={() => { sessionStorage.setItem("currentPage", "mayakOko"); goTo("mayakOko"); }}>
                    <CloseIcon />
                </Button>
            </Header>
            <div className="hero" style={{ placeItems: "center" }}>
                <div className="flex flex-col gap-[1.6rem] items-center h-full col-span-4 col-start-5 col-end-9">
                    <h3>Настройки</h3>
                    <div className="flex flex-col gap-[0.75rem]">
                        <div className="flex flex-col gap-[0.5rem]">
                            <span className="big">Данные токена</span>
                            <p className="small text-(--color-gray-black)">Это ваш токен доступа. Он имеет ограниченное количество использований. На шкале под полем отображается, сколько запросов уже израсходовано.</p>
                        </div>
                        <Input
                            placeholder="Введите ваш токен"
                            value={token}
                            onChange={(e) => {
                                const nextToken = e.target.value;
                                setToken(nextToken);
                                setTokenError("");
                                setShowNotification(false);
                                setIsTokenValid(false);
                                setIsDevBypass(false);
                                setBypassPasswordError("");
                                setSessionInfo(null);
                            }}
                        />
                        {isValidating && <span className="small text-blue-600 block text-center">Проверка токена...</span>}
                        {showNotification && tokenExists && !isDevBypass && (
                            <div className="flex flex-col gap-[1rem] items-center">
                                <span className="big p-3 bg-green-100 text-green-700 rounded-md">Тренажер активирован</span>
                                <span className="small text-(--color-gray-black)">Осталось попыток: {tokenRemainingAttempts}</span>
                                <Button onClick={() => goTo("trainer")} className="w-full">Войти в тренажер</Button>
                            </div>
                        )}
                        {showNotification && isDevBypass && (
                            <div className="flex flex-col gap-[1rem] items-center">
                                <span className="big p-3 bg-green-100 text-green-700 rounded-md block text-center">Локальный вход доступен. Для входа подтвердите пароль администратора.</span>
                                <Input type="password" placeholder="Пароль администратора" value={bypassPassword} onChange={(e) => { setBypassPassword(e.target.value); setBypassPasswordError(""); }} />
                                {bypassPasswordError && <span className="small text-red-600 block text-center">{bypassPasswordError}</span>}
                                <Button onClick={enterWithDevBypass} className="w-full">Войти в тренажер</Button>
                            </div>
                        )}
                        {showNotification && !tokenExists && !isDevBypass && <span className="big p-3 bg-green-100 text-green-700 rounded-md block text-center">Токен подходит. Заполните форму ниже для активации тренажера.</span>}
                        {tokenError && !showNotification && !isValidating && <span className="big p-3 bg-red-100 text-red-700 rounded-md block text-center">{tokenError}</span>}
                        {isTokenValid && !isDevBypass && (
                            <div className="flex flex-col gap-[0.25rem]">
                                <span className={getRangeClass(value)}>{value}/{max}</span>
                                <meter id="meter-my" min="0" max={max} low="30" high="80" optimum="100" value={value} className={getRangeClass(value)}></meter>
                            </div>
                        )}
                    </div>

                    {!tokenExists && showNotification && !isDevBypass && (
                        <>
                            <div className="flex flex-col gap-[0.75rem] w-full">
                                <span className="big">Личные данные</span>
                                <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                                    <div>
                                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Фамилия *</label>
                                        <input type="text" id="lastName" name="lastName" value={userData.lastName} onChange={handleUserDataChange} className="input-wrapper w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                                    </div>
                                    <div>
                                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">Имя *</label>
                                        <input type="text" id="firstName" name="firstName" value={userData.firstName} onChange={handleUserDataChange} className="input-wrapper w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                                    </div>
                                    <div>
                                        <label htmlFor="college" className="block text-sm font-medium text-gray-700 mb-1">Организация *</label>
                                        <input type="text" id="college" name="college" value={userData.college} onChange={handleUserDataChange} className="input-wrapper w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                                    </div>
                                </div>
                                {hasSessionFlow && (
                                    <div>
                                        <label htmlFor="tableNumber" className="block text-sm font-medium text-gray-700 mb-1">{"\u041d\u043e\u043c\u0435\u0440 \u0441\u0442\u043e\u043b\u0430"}{requiresTableNumber ? " *" : ""}</label>
                                        <select id="tableNumber" name="tableNumber" value={userData.tableNumber} onChange={handleUserDataChange} className="input-wrapper w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required={requiresTableNumber}>
                                            <option value="">{"\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0442\u043e\u043b"}</option>
                                            {availableTables.map((tableNumber) => (
                                                <option key={tableNumber} value={tableNumber}>{"\u0421\u0442\u043e\u043b "}{tableNumber}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-center w-full">
                                <button onClick={saveData} disabled={isLoading} className={`px-8 py-3 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"}`}>
                                    {isLoading ? "Сохранение..." : "Сохранить результаты"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
