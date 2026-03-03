import { useState, useEffect } from "react";
import { useRouter } from "next/router";

import TransitionWrapper from "@/components/layout/TransitionWrapper";

import Layout from "@/components/layout/Layout";
import IndexPage from "@/components/features/tools-2";
import TrainerPage from "@/components/features/tools-2/trainer";
import HistoryPage from "@/components/features/tools-2/history";
import SettingsPage from "@/components/features/tools-2/settings";
import AdminPage from "@/components/features/tools-2/admin";

export default function Home() {
    const [pageKey, setPageKey] = useState("mayakOko");
    const router = useRouter();

    const goTo = (pageName) => {
        setPageKey(pageName);
    };

    useEffect(() => {
        if (router.isReady && router.query.restart !== undefined) {
            // Очистка всей сессии
            const prefix = 'trainer_v2';
            const keys = ['userRole', 'sessionStartTime', 'session_tasks_log',
                          'completedTasks', 'taskVersion', 'hasCompletedSecondQuestionnaire'];
            keys.forEach(k => localStorage.removeItem(`${prefix}_${k}`));
            localStorage.removeItem('trainer_v2_rankingTestResults');
            localStorage.removeItem('trainer_v2_rankingTestResults_previous');
            localStorage.removeItem('trainer_v2_sessionCompletionPending');
            sessionStorage.removeItem('trainer_v2_taskTimer');
            sessionStorage.removeItem(`${prefix}_currentTaskIndex`);

            // Удаляем куку токена
            document.cookie = 'activated_key=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';

            // Убираем ?restart из URL через Next.js роутер
            router.replace('/tools/mayak-oko', undefined, { shallow: true });

            // Устанавливаем начальную страницу
            setPageKey('mayakOko');
        }
    }, [router.isReady]);

    return (
        <Layout>
            <TransitionWrapper currentKey={pageKey}>
                {pageKey === "mayakOko" && <IndexPage goTo={goTo} />}
                {pageKey === "trainer" && <TrainerPage goTo={goTo} />}
                {pageKey === "settings" && <SettingsPage goTo={goTo} />}
                {pageKey === "history" && <HistoryPage goTo={goTo} />}
                {pageKey === "admin" && <AdminPage goTo={goTo} />}
            </TransitionWrapper>
        </Layout>
    );
}
