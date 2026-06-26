import { useState, useEffect } from "react";
import { useRouter } from "next/router";

import TransitionWrapper from "@/components/layout/TransitionWrapper";

import Layout from "@/components/layout/Layout";
import IndexPage from "@/components/features/tools-2";
import TrainerPage from "@/components/features/tools-2/trainer";
import HistoryPage from "@/components/features/tools-2/history";
import SettingsPage from "@/components/features/tools-2/settings";

export default function Home() {
    const [pageKey, setPageKey] = useState("mayakOko");
    const router = useRouter();

    const goTo = (pageName) => {
        // Единая точка навигации: сохраняем активный экран, чтобы при
        // перезагрузке (F5) восстановиться именно на нём, а не на главной.
        if (typeof window !== "undefined") {
            try {
                sessionStorage.setItem("currentPage", pageName);
            } catch {
                // sessionStorage может быть недоступен (приватный режим) —
                // навигацию это не должно блокировать.
            }
        }
        setPageKey(pageName);
    };

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
        </Layout>
    );
}
