import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { saveUserData } from "@/utils/auth";
import { clearMayakPortalAuthPending, readMayakPortalAuthPending } from "@/utils/mayakPortalAuth";
import { consumePortalAuthReturnPath } from "@/lib/portalAuthReturn";

export default function CallbackAuth() {
    const router = useRouter();
    const [provider, setProvider] = useState("");
    const [error, setError] = useState(null);

    useEffect(() => {
        const handleCallback = async () => {
            // Получаем параметры из URL
            const { code, state, provider: providerParam } = router.query;

            if (!code) {
                // Ждем пока Next.js загрузит query параметры
                return;
            }

            // Определяем провайдера (Yandex/VK)
            const oauthProvider = providerParam || state || "yandex";
            setProvider(oauthProvider);
            const pendingMayakAuth = readMayakPortalAuthPending();
            const mayakReturnPath = pendingMayakAuth?.returnPath || consumePortalAuthReturnPath() || "";

            try {
                // Отправляем код на наш API
                const response = await fetch("/api/auth/oauth/callback", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        code,
                        provider: oauthProvider,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Ошибка авторизации");
                }

                // Обрабатываем ответ в зависимости от типа
                if (data.type === "login") {
                    // Пользователь существует - делаем логин
                    // Получаем данные профиля
                    const profileResponse = await fetch("/api/profile/info", {
                        method: "GET",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                    });

                    if (profileResponse.ok) {
                        const profileData = await profileResponse.json();
                        const userInfo = {
                            email: profileData.data.email,
                            username: profileData.data.NameIRL,
                        };
                        await saveUserData(userInfo);
                    }

                    // Редирект на профиль
                    if (mayakReturnPath) {
                        clearMayakPortalAuthPending();
                        router.replace(mayakReturnPath);
                        return;
                    }

                    router.push("/profile");
                } else if (data.type === "register") {
                    // Новый пользователь - редирект на завершение регистрации
                    if (mayakReturnPath) {
                        clearMayakPortalAuthPending();
                    }

                    router.push("/auth?stage=reg-complete");
                }
            } catch (err) {
                console.error("OAuth callback error:", err);
                if (mayakReturnPath) {
                    clearMayakPortalAuthPending();
                }

                setError(err.message);
                // Редирект на страницу авторизации с ошибкой через 3 секунды
                setTimeout(() => {
                    router.push("/auth?error=oauth_failed");
                }, 3000);
            }
        };

        if (router.isReady) {
            handleCallback();
        }
    }, [router.isReady, router.query]);

    // Анимация для кружка загрузки
    const spinTransition = {
        repeat: Infinity,
        duration: 1,
        ease: "linear",
    };

    const providerName = provider === "vk" ? "ВКонтакте" : "Яндекса";

    return (
        <Layout>
            <div className="hero relative overflow-hidden" style={{ placeItems: "center" }}>
                <div className="auth_cntr col-span-4 flex flex-col items-center justify-center text-center gap-[8px]">
                    {error ? (
                        <>
                            <h2 className="text-[2rem] font-bold">Ошибка</h2>
                            <p className="text-(--color-gray-black)">{error}</p>
                            <p className="text-(--color-gray-black) text-sm">Перенаправляем на страницу авторизации...</p>
                        </>
                    ) : (
                        <>
                            <h2 className="text-[2rem] font-bold">Авторизация...</h2>
                            <p className="text-(--color-gray-black)">
                                Пожалуйста подождите, получаем ваши данные {provider && `из ${providerName}`}
                            </p>

                            {/* Анимация загрузки - вращающийся кружок */}
                            <div className="mt-[24px]">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={spinTransition}
                                    className="w-[48px] h-[48px] border-[4px] border-t-[var(--color-primary)] border-r-transparent border-b-transparent border-l-transparent rounded-full"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
}
