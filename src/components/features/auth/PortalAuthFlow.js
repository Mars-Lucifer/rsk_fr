import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";
import Switcher from "@/components/ui/Switcher";
import VKWidget from "@/components/features/auth/VKWidget";
import Yandex from "@/assets/general/yandex.svg";
import { saveUserData } from "@/utils/auth";
import { buildPortalAuthCookieSnapshot } from "@/lib/portalProfile";
import { clearPortalAuthReturnPath, setPortalAuthReturnPath } from "@/lib/portalAuthReturn";
import { fetchPortalProfileClient, isMissingPortalProfilePayload, primePortalProfileCache } from "@/lib/portalProfileClient";
import { PUBLIC_PORTAL_API_BASE } from "@/lib/portalApiBase";

const YANDEX_LOGIN_URL = `${PUBLIC_PORTAL_API_BASE}/auth/users_interaction/auth/yandex/login`;

function mapLoginError(response, payload) {
    if (payload?.errorCode === "EMAIL_NOT_CONFIRMED" || response.status === 403) {
        return "Вы не подтвердили email. Проверьте письмо и повторите вход.";
    }
    if (payload?.errorCode === "INVALID_CREDENTIALS" || response.status === 401) {
        return "Неверный логин или пароль.";
    }
    if (payload?.errorCode === "USER_NOT_FOUND" || response.status === 404) {
        return "Пользователь не найден.";
    }
    if (payload?.errorCode === "VALIDATION_ERROR" || response.status === 422) {
        return payload?.error || "Проверьте корректность полей.";
    }
    return payload?.error || "Не удалось войти в аккаунт.";
}

function mapRegistrationError(response, payload) {
    if (payload?.errorCode === "EMAIL_NOT_CONFIRMED") {
        return "Вы не подтвердили почту. Проверьте письмо и повторите регистрацию.";
    }
    if (payload?.errorCode === "USER_EXISTS" || payload?.errorCode === "BAD_REQUEST" || response.status === 400) {
        return payload?.error || "Пользователь с такими данными уже существует.";
    }
    if (payload?.errorCode === "VALIDATION_ERROR" || response.status === 422) {
        return payload?.error || "Проверьте корректность полей.";
    }
    return payload?.error || "Не удалось зарегистрироваться.";
}

function validateRegistration(formData) {
    if ((formData.name || "").trim().length < 2) {
        return "Имя должно содержать минимум 2 символа.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email || "")) {
        return "Введите корректный email.";
    }
    if ((formData.password || "").length < 8) {
        return "Пароль должен содержать минимум 8 символов.";
    }
    if (/^\d+$/.test(formData.password || "")) {
        return "Пароль не должен состоять только из цифр.";
    }
    if (/^[^a-zA-Zа-яА-Я0-9]+$/.test(formData.password || "")) {
        return "Пароль не должен состоять только из специальных символов.";
    }
    if (!/[a-zа-я]/.test(formData.password || "")) {
        return "Пароль должен содержать хотя бы одну строчную букву.";
    }
    return "";
}

export default function PortalAuthFlow({
    className = "",
    initialMode = "register",
    onAuthenticated,
    returnPath = "",
}) {
    const router = useRouter();
    const [authType, setAuthType] = useState(initialMode === "login" ? "login" : "register");
    const [step, setStep] = useState(0);
    const [isBusy, setIsBusy] = useState(false);
    const [isOAuthPolling, setIsOAuthPolling] = useState(false);
    const [registerRole, setRegisterRole] = useState("student");
    const [loginForm, setLoginForm] = useState({ login: "", password: "" });
    const [registerForm, setRegisterForm] = useState({
        name: "",
        email: "",
        password: "",
        role: "student",
    });
    const [recoveryEmail, setRecoveryEmail] = useState("");

    useEffect(() => {
        setRegisterForm((prev) => ({
            ...prev,
            role: registerRole,
        }));
    }, [registerRole]);

    const finalizeAuthentication = useCallback(
        async (profilePayload) => {
            primePortalProfileCache(profilePayload);
            const authSnapshot = buildPortalAuthCookieSnapshot(profilePayload);
            if (authSnapshot.email || authSnapshot.username) {
                await saveUserData(authSnapshot);
            }

            clearPortalAuthReturnPath();
            if (typeof onAuthenticated === "function") {
                await onAuthenticated(profilePayload);
                return;
            }

            router.replace(isMissingPortalProfilePayload(profilePayload) ? "/profile?tab=settings" : "/profile");
        },
        [onAuthenticated, router]
    );

    const fetchProfile = useCallback(async ({ silentUnauthorized = false, force = false } = {}) => {
        try {
            const payload = await fetchPortalProfileClient({ force });
            if (!payload) {
                if (silentUnauthorized) {
                    return null;
                }
                alert("Не удалось загрузить профиль портала.");
                return null;
            }

            return payload;
        } catch (error) {
            if (silentUnauthorized) {
                return null;
            }
            alert(error?.message || "Не удалось загрузить профиль портала.");
            return null;
        }
    }, []);

    useEffect(() => {
        if (!isOAuthPolling) {
            return undefined;
        }

        let isClosed = false;
        const timeoutId = window.setTimeout(() => {
            if (!isClosed) {
                setIsOAuthPolling(false);
            }
        }, 120000);

        const intervalId = window.setInterval(async () => {
            const profilePayload = await fetchProfile({ silentUnauthorized: true, force: true });
            if (!profilePayload || isClosed) {
                return;
            }

            isClosed = true;
            window.clearTimeout(timeoutId);
            window.clearInterval(intervalId);
            setIsOAuthPolling(false);
            await finalizeAuthentication(profilePayload);
        }, 2000);

        return () => {
            isClosed = true;
            window.clearTimeout(timeoutId);
            window.clearInterval(intervalId);
        };
    }, [fetchProfile, finalizeAuthentication, isOAuthPolling]);

    const handleOAuthStart = useCallback(
        ({ popup = false } = {}) => {
            if (returnPath) {
                setPortalAuthReturnPath(returnPath);
            }
            if (popup) {
                setIsOAuthPolling(true);
            }
        },
        [returnPath]
    );

    const handleLoginSubmit = useCallback(
        async (event) => {
            event.preventDefault();
            if ((loginForm.password || "").length < 8) {
                alert("Пароль должен содержать минимум 8 символов.");
                return;
            }

            setIsBusy(true);
            try {
                const response = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(loginForm),
                    credentials: "include",
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    alert(mapLoginError(response, payload));
                    return;
                }

                const profilePayload = await fetchProfile({ force: true });
                if (!profilePayload) {
                    return;
                }

                await finalizeAuthentication(profilePayload);
            } catch (error) {
                console.error("Portal login failed:", error);
                alert("Ошибка соединения. Попробуйте еще раз.");
            } finally {
                setIsBusy(false);
            }
        },
        [fetchProfile, finalizeAuthentication, loginForm]
    );

    const handleRegisterSubmit = useCallback(
        async (event) => {
            event.preventDefault();
            const validationError = validateRegistration(registerForm);
            if (validationError) {
                alert(validationError);
                return;
            }

            setIsBusy(true);
            try {
                const response = await fetch("/api/auth/reg", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(registerForm),
                    credentials: "include",
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    alert(mapRegistrationError(response, payload));
                    return;
                }

                setStep(1);
            } catch (error) {
                console.error("Portal registration failed:", error);
                alert("Ошибка соединения. Попробуйте еще раз.");
            } finally {
                setIsBusy(false);
            }
        },
        [registerForm]
    );

    const handleRecoverySubmit = useCallback(
        async (event) => {
            event.preventDefault();
            setIsBusy(true);
            try {
                const response = await fetch("/api/auth/reset-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email_or_login: recoveryEmail }),
                    credentials: "include",
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    alert(payload?.error || "Не удалось отправить письмо для восстановления.");
                    return;
                }

                alert("Письмо для восстановления отправлено. Проверьте почту.");
                setStep(0);
            } catch (error) {
                console.error("Password recovery failed:", error);
                alert("Ошибка соединения. Попробуйте еще раз.");
            } finally {
                setIsBusy(false);
            }
        },
        [recoveryEmail]
    );

    const wrapperClassName = `flex flex-col gap-[1rem] w-full ${className}`.trim();

    return (
        <div className={wrapperClassName}>
            <Switcher
                className="!w-full"
                value={authType}
                onChange={(value) => {
                    setAuthType(value);
                    setStep(0);
                }}
            >
                <Switcher.Option value="login">Вход</Switcher.Option>
                <Switcher.Option value="register">Регистрация</Switcher.Option>
            </Switcher>

            {authType === "register" ? (
                step === 0 ? (
                    <>
                        <h3>Добро пожаловать</h3>
                        <Switcher className="!w-full" value={registerRole} onChange={setRegisterRole}>
                            <Switcher.Option value="student">Студент</Switcher.Option>
                            <Switcher.Option value="teacher">Сотрудник</Switcher.Option>
                        </Switcher>
                        <form className="grid grid-cols-1 gap-[0.75rem]" onSubmit={handleRegisterSubmit}>
                            <Input type="text" name="name" placeholder="Имя" value={registerForm.name} onChange={(event) => setRegisterForm((prev) => ({ ...prev, name: event.target.value }))} required />
                            <Input type="email" name="email" placeholder="Почта" value={registerForm.email} onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))} required />
                            <Input type="password" name="password" placeholder="Пароль" value={registerForm.password} onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))} required />
                            <Input type="checkbox" small required autoComplete="off" name="POPD" id="portal-auth-popd">
                                <span className="text">
                                    Я даю согласие на{" "}
                                    <a
                                        target="_blank"
                                        rel="noreferrer"
                                        href="https://docs.yandex.ru/docs/view?url=ya-disk-public%3A%2F%2F4Y9bFhoQd%2BEh8Vk6aVciLCjpoC35hPNd1UYmIkGxmnsrxw5CImAYaS%2BTxOkTJkVEq%2FJ6bpmRyOJonT3VoXnDag%3D%3D%3A%2F152fz.pdf&name=152fz.pdf"
                                        className="link"
                                    >
                                        обработку персональных данных
                                    </a>
                                </span>
                            </Input>
                            <Button type="submit" className="w-full justify-center" disabled={isBusy}>
                                {isBusy ? "Регистрация..." : "Зарегистрироваться"}
                            </Button>
                        </form>
                        <div className="flex gap-[0.75rem] w-full items-center">
                            <Button
                                inverted
                                className="flex-1"
                                onClick={() => {
                                    handleOAuthStart();
                                    window.location.href = YANDEX_LOGIN_URL;
                                }}
                            >
                                Яндекс ID <Yandex />
                            </Button>
                            <div className="flex-1 overflow-hidden h-[46px] flex items-center justify-center">
                                <VKWidget onBeforeLogin={() => handleOAuthStart({ popup: true })} />
                            </div>
                        </div>
                        {isOAuthPolling ? <p className="small text-(--color-gray-black) text-center">Ожидаем подтверждения во внешнем окне...</p> : null}
                    </>
                ) : (
                    <div className="flex flex-col gap-[0.75rem] items-center text-center">
                        <h3>Регистрация завершена</h3>
                        <p className="text-(--color-gray-black)">
                            Подтвердите почту по письму из портала. После подтверждения войдите в аккаунт и вернитесь в MAYAK автоматически.
                        </p>
                        <Button
                            onClick={() => {
                                setAuthType("login");
                                setStep(0);
                            }}
                        >
                            Войти в аккаунт
                        </Button>
                    </div>
                )
            ) : step === 0 ? (
                <>
                    <h3>С возвращением</h3>
                    <form className="grid grid-cols-1 gap-[0.75rem]" onSubmit={handleLoginSubmit}>
                        <Input type="text" name="login" placeholder="Почта / логин" value={loginForm.login} onChange={(event) => setLoginForm((prev) => ({ ...prev, login: event.target.value }))} required />
                        <Input type="password" name="password" placeholder="Пароль" value={loginForm.password} onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))} required />
                        <Button type="submit" className="w-full justify-center" disabled={isBusy}>
                            {isBusy ? "Вход..." : "Войти"}
                        </Button>
                    </form>
                    <div className="flex gap-[0.75rem] w-full items-center">
                        <Button
                            inverted
                            className="flex-1"
                            onClick={() => {
                                handleOAuthStart();
                                window.location.href = YANDEX_LOGIN_URL;
                            }}
                        >
                            Яндекс ID <Yandex />
                        </Button>
                        <div className="flex-1 overflow-hidden h-[46px] flex items-center justify-center">
                            <VKWidget onBeforeLogin={() => handleOAuthStart({ popup: true })} />
                        </div>
                    </div>
                    {isOAuthPolling ? <p className="small text-(--color-gray-black) text-center">Ожидаем подтверждения во внешнем окне...</p> : null}
                    <p className="w-full text-center text-gray">
                        Забыли пароль?{" "}
                        <span className="link cursor-pointer" onClick={() => setStep(1)}>
                            Восстановите
                        </span>
                    </p>
                </>
            ) : (
                <>
                    <h3>Восстановление пароля</h3>
                    <p className="text-(--color-gray-black) text-center">Мы отправим письмо со ссылкой для восстановления доступа к аккаунту.</p>
                    <form className="grid grid-cols-1 gap-[0.75rem]" onSubmit={handleRecoverySubmit}>
                        <Input type="email" placeholder="Почта или логин" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} required />
                        <Button type="submit" className="w-full justify-center" disabled={isBusy}>
                            {isBusy ? "Отправка..." : "Восстановить пароль"}
                        </Button>
                        <Button type="button" inverted className="w-full justify-center" onClick={() => setStep(0)}>
                            Назад
                        </Button>
                    </form>
                </>
            )}
        </div>
    );
}
