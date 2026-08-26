import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";

import TransitionWrapper from "@/components/layout/TransitionWrapper";
import { CONTEST_MODE_KEY, parseContestToken } from "@/lib/mayakContestAccess";

import Layout from "@/components/layout/Layout";
import HowTo from "@/components/features/mayak-guide/HowTo";
import IndexPage from "@/components/features/tools-2";
import TrainerPage from "@/components/features/tools-2/trainer";
import HistoryPage from "@/components/features/tools-2/history";
import SettingsPage from "@/components/features/tools-2/settings";

export default function Home() {
    const [pageKey, setPageKey] = useState("mayakOko");
    const router = useRouter();

    // Единая точка навигации. Обязательно стабильная ссылка (useCallback):
    // её держат в зависимостях useEffect хуки тренажёра (useMayakAccessGate и др.).
    // Без мемоизации goTo пересоздаётся на каждый рендер, из-за чего access-gate
    // перезапускался бесконечно (спам /validate-token и дёрганье перехода в настройки).
    const goTo = useCallback((pageName) => {
        // Сохраняем активный экран, чтобы при перезагрузке (F5) восстановиться
        // именно на нём, а не на главной.
        if (typeof window !== "undefined") {
            try {
                sessionStorage.setItem("currentPage", pageName);
            } catch {
                // sessionStorage может быть недоступен (приватный режим) —
                // навигацию это не должно блокировать.
            }
        }
        setPageKey(pageName);
    }, []);

    // Конкурсный вход ведём сразу на экран задания, обычный — как раньше, на
    // главную инструмента.
    //
    // Признак — метка ?contest=1, которую ставит переход из списка уроков, и
    // флаг режима в sessionStorage. По куке ориентироваться нельзя: она живёт
    // 30 дней, и тогда заход через меню «Маяк Око» тоже открывал бы конкурсный
    // экран — а это разные сущности.
    useEffect(() => {
        if (!router.isReady || typeof window === "undefined") return;

        if (router.query.contest !== undefined) {
            const raw = document.cookie
                .split(";")
                .map((part) => part.trim())
                .find((part) => part.startsWith("activated_key="));
            if (!raw) return;

            try {
                const parsed = JSON.parse(decodeURIComponent(raw.slice("activated_key=".length)));
                if (parseContestToken(parsed?.text)) {
                    sessionStorage.setItem(CONTEST_MODE_KEY, "1");
                    sessionStorage.setItem("currentPage", "trainer");
                    queueMicrotask(() => setPageKey("trainer"));
                }
            } catch {
                // битая кука — оставляем обычный экран
            }
            return;
        }

        // Зашли без метки, но режим ещё висит с прошлого раза — выходим из него.
        if (sessionStorage.getItem(CONTEST_MODE_KEY)) {
            sessionStorage.removeItem(CONTEST_MODE_KEY);
            sessionStorage.setItem("currentPage", "mayakOko");
            queueMicrotask(() => setPageKey("mayakOko"));
        }
    }, [router.isReady, router.query.contest]);

    const hasTokenQuery = router.isReady && (router.query.token || router.query.password);
    const effectivePageKey = hasTokenQuery && pageKey === "mayakOko" ? "settings" : pageKey;

    useEffect(() => {
        if (router.isReady && router.query.restart !== undefined) {
            const prefix = "trainer_v2";

            const localKeysToRemove = [];
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    localKeysToRemove.push(key);
                }
            }
            localKeysToRemove.forEach((key) => localStorage.removeItem(key));

            const sessionKeysToRemove = [];
            for (let i = 0; i < sessionStorage.length; i += 1) {
                const key = sessionStorage.key(i);
                if (key && (key.startsWith(prefix) || key === "trainer_v2_taskTimer" || key === "currentPage" || key === "previousPage")) {
                    sessionKeysToRemove.push(key);
                }
            }
            sessionKeysToRemove.forEach((key) => sessionStorage.removeItem(key));

            localStorage.removeItem("trainer_v2_rankingTestResults");
            localStorage.removeItem("trainer_v2_rankingTestResults_previous");
            localStorage.removeItem("trainer_v2_sessionCompletionPending");

            document.cookie = "activated_key=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; path=/; SameSite=Lax";
            document.cookie = "active_user=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; path=/; SameSite=Lax";

            sessionStorage.setItem("currentPage", "settings");
            window.location.replace("/tools/mayak-oko");
        }
    }, [router.isReady, router.query.restart]);

    return (
        <Layout>
            <TransitionWrapper currentKey={effectivePageKey}>
                {effectivePageKey === "mayakOko" && <IndexPage goTo={goTo} />}
                {effectivePageKey === "trainer" && <TrainerPage goTo={goTo} />}
                {effectivePageKey === "settings" && <SettingsPage goTo={goTo} />}
                {effectivePageKey === "history" && <HistoryPage goTo={goTo} />}
            </TransitionWrapper>

            {/* «Как это работает» — на главной МАЯК-ОКО и на экране задания. На вводе
                токена и в истории её нет: там объяснять нечего, а кнопка поверх формы
                входа выглядит как часть входа. */}
            {(effectivePageKey === "mayakOko" || effectivePageKey === "trainer") && <HowTo />}
        </Layout>
    );
}
