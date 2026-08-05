import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";

import TransitionWrapper from "@/components/layout/TransitionWrapper";
import { parseContestToken } from "@/lib/mayakContestAccess";

import Layout from "@/components/layout/Layout";
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

    // Конкурсный вход ведём сразу на экран задания. Участник приходит из урока
    // и ждёт задание, а не главную инструмента: промежуточный экран выглядит
    // как «меня не туда отправили».
    useEffect(() => {
        if (typeof document === "undefined") return;

        const raw = document.cookie
            .split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith("activated_key="));
        if (!raw) return;

        try {
            const parsed = JSON.parse(decodeURIComponent(raw.slice("activated_key=".length)));
            if (parseContestToken(parsed?.text)) {
                sessionStorage.setItem("currentPage", "trainer");
                // queueMicrotask — чтобы не дёргать setState синхронно внутри
                // эффекта (тот же приём, что в Aside/Nav.js).
                queueMicrotask(() => setPageKey("trainer"));
            }
        } catch {
            // битая кука — оставляем обычный экран
        }
    }, []);

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
            <MasterDashboardButton />
        </Layout>
    );
}

// Мастер заходит в тренажёр по своей ссылке (?dash=<секрет дашборда>) и должен
// иметь возможность открыть дашборд, не выходя из игры. Секрет кладём в
// sessionStorage: экраны тренажёра переключаются по state, но после перезагрузки
// или чистки query кнопка не должна исчезать.
const MASTER_DASH_KEY = "mayak_master_dash";

function MasterDashboardButton() {
    const router = useRouter();
    const [dashSecret, setDashSecret] = useState("");

    useEffect(() => {
        if (!router.isReady) return;
        const fromQuery = String(router.query.dash || "").trim();
        if (fromQuery) {
            try {
                sessionStorage.setItem(MASTER_DASH_KEY, fromQuery);
            } catch {}
            setDashSecret(fromQuery);
            return;
        }
        try {
            setDashSecret(sessionStorage.getItem(MASTER_DASH_KEY) || "");
        } catch {}
    }, [router.isReady, router.query.dash]);

    if (!dashSecret) return null;

    return (
        <a
            href={`/mayak-dashboard/${encodeURIComponent(dashSecret)}`}
            target="_blank"
            rel="noreferrer"
            title="Открыть дашборд сессии"
            aria-label="Открыть дашборд сессии"
            style={{
                position: "fixed",
                right: 18,
                bottom: 18,
                zIndex: 900,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 44,
                borderRadius: 999,
                background: "#152022",
                color: "#fff",
                padding: "0 16px",
                fontSize: 14,
                fontWeight: 800,
                textDecoration: "none",
                boxShadow: "0 10px 26px rgba(16, 24, 32, 0.28)",
            }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <rect x="7" y="11" width="3" height="6" />
                <rect x="12" y="7" width="3" height="10" />
                <rect x="17" y="13" width="3" height="4" />
            </svg>
            Дашборд
        </a>
    );
}
