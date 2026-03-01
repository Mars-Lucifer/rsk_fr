import "@/styles/globals.css";
import "@/styles/prep-session.css";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { isAuthorized, saveUserData } from "@/utils/auth";

export default function App({ Component, pageProps }) {
    const router = useRouter();

    useEffect(() => {
        // Проверяем, есть ли сессия с бэкенда после OAuth авторизации
        const syncOAuthSession = async () => {
            console.log("App: Checking auth status...");
            // Если уже авторизованы в localStorage, ничего не делаем
            if (isAuthorized()) {
                console.log("App: Already authorized.");
                return;
            }

            console.log("App: Not authorized, attempting to sync with backend...");
            try {
                // Пытаемся получить профиль с бэкенда (если есть session cookie)
                const response = await fetch("/api/profile/info", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                });

                console.log("App: Profile fetch status:", response.status);

                if (response.ok) {
                    const data = await response.json();
                    console.log("App: Profile data received:", data);

                    // Бэкенд вернул профиль = сессия есть!
                    // Сохраняем данные в localStorage
                    const userInfo = {
                        email: data.data.email,
                        username: data.data.NameIRL,
                    };
                    await saveUserData(userInfo);

                    console.log("App: OAuth session synced & saved:", userInfo);

                    // Force reload to update UI if auth.js is not reactive
                    // router.reload(); 
                    // Или можно попробовать жестко обновить состояние, если бы был контекст.
                    // Но пока просто логируем.

                    // Редиректим на профиль
                    if (router.pathname === "/auth") {
                        router.push("/profile");
                    }
                } else {
                    console.log("App: Failed to sync session, response not OK");
                }
            } catch (err) {
                // Нет сессии, всё нормально
                console.error("App: Error syncing session:", err);
            }
        };

        syncOAuthSession();
    }, [router]);

    return (
        <>
            <Component {...pageProps} />
        </>
    );
}
