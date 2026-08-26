import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import VK from "@/assets/general/vk.svg";
import { PUBLIC_PORTAL_API_BASE } from "@/lib/portalApiBase";

// SDK лежит у нас в public/vendor, а не на unpkg.com: у части пользователей
// внешний CDN недоступен — запрос либо висит, либо падает, и кнопка входа
// умирает молча. Обновление версии — ручное, файл менять целиком.
const SDK_SRC = "/vendor/vkid-sdk-2.6.8.js";
const SDK_TIMEOUT_MS = 10000;

// Одна загрузка на страницу: несколько кнопок VK ID не должны гоняться за
// событием load — второй экземпляр вешал обработчик на уже загруженный скрипт
// и оставался в состоянии "loading" навсегда.
let sdkPromise = null;

function loadSdk() {
    if (sdkPromise) return sdkPromise;

    sdkPromise = new Promise((resolve, reject) => {
        if (window.VKIDSDK?.Auth?.login) {
            resolve(window.VKIDSDK);
            return;
        }

        const script = document.createElement("script");
        script.src = SDK_SRC;
        script.async = true;
        script.dataset.vkidSdk = "true";

        // Событие error не приходит, когда соединение висит, — без таймаута
        // кнопка остаётся в "loading" бесконечно.
        const timer = setTimeout(() => reject(new Error("VK ID SDK: таймаут загрузки")), SDK_TIMEOUT_MS);

        script.addEventListener("load", () => {
            clearTimeout(timer);
            if (window.VKIDSDK?.Auth?.login) resolve(window.VKIDSDK);
            else reject(new Error("VK ID SDK: скрипт загружен, но глобальный объект отсутствует"));
        });
        script.addEventListener("error", () => {
            clearTimeout(timer);
            reject(new Error("VK ID SDK: скрипт не загрузился"));
        });

        document.body.appendChild(script);
    });

    return sdkPromise;
}

let configured = false;

export default function VKWidget({ onStart, onBeforeLogin }) {
    const [sdkState, setSdkState] = useState("loading");

    useEffect(() => {
        let alive = true;

        loadSdk()
            .then((sdk) => {
                if (!configured) {
                    sdk.Config.init({
                        app: 54409000,
                        redirectUrl: `${PUBLIC_PORTAL_API_BASE}/auth/users_interaction/auth/vk/callback`,
                        responseMode: sdk.ConfigResponseMode.Redirect,
                        source: sdk.ConfigSource.LOWCODE,
                        scope: "email",
                        mode: sdk.ConfigAuthMode.InNewWindow,
                    });
                    configured = true;
                }
                if (alive) setSdkState("ready");
            })
            .catch((error) => {
                console.error(error);
                if (alive) setSdkState("error");
            });

        return () => {
            alive = false;
        };
    }, []);

    const handleVKLogin = () => {
        if (!window.VKIDSDK?.Auth?.login) return;

        // Родитель по этому сигналу запоминает возврат и включает опрос
        // статуса, пока пользователь авторизуется во внешнем окне.
        if (typeof onBeforeLogin === "function") onBeforeLogin();
        if (typeof onStart === "function") onStart("vk");

        const originalOpen = window.open;

        window.open = (url, target, features) => {
            const width = 620;
            const height = 700;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;
            return originalOpen(url, target, `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
        };

        window.VKIDSDK.Auth.login()
            .catch(() => {}) // ошибки можно игнорировать, редирект на сервер
            .finally(() => {
                window.open = originalOpen;
            });
    };

    return (
        <Button
            inverted
            className="w-full h-full !p-0 gap-[6px] justify-center"
            onClick={handleVKLogin}
            disabled={sdkState !== "ready"}
        >
            {sdkState === "ready" ? "VK ID" : sdkState === "error" ? "VK ID недоступен" : "Загружаем VK ID..."} <VK />
        </Button>
    );
}
