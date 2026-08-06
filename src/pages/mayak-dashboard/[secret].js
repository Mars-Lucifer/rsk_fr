"use client";

import { useRouter } from "next/router";
import { useCallback } from "react";

import SessionDashboard from "@/components/features/mayak-dashboard/SessionDashboard";

// Дашборд сессии для мастера по секрету в URL (без admin-пароля). Переиспользует
// общий компонент дашборда, но с эндпоинтами /api/mayak/master/*.
export default function MayakMasterDashboardPage() {
    const router = useRouter();
    const secret = typeof router.query.secret === "string" ? router.query.secret : "";

    const handleAuthFail = useCallback(() => {
        router.replace("/");
    }, [router]);

    if (!router.isReady || !secret) {
        return null;
    }

    const encoded = encodeURIComponent(secret);
    // «Назад» показываем только когда пришли из тренажёра в этой же вкладке
    // (метку ставит MasterDashboardLink). Ссылку, открытую напрямую — на
    // проекторе или со второго устройства — некуда возвращать: router.back()
    // там уводил из приложения на предыдущий сайт.
    const cameFromTrainer = router.query.from === "trainer";

    return (
        <SessionDashboard
            sessionId={secret}
            dashboardUrl={`/api/mayak/master/dashboard?secret=${encoded}`}
            participantsUrl={`/api/mayak/master/participants?secret=${encoded}`}
            onAuthFail={handleAuthFail}
            hideBack={!cameFromTrainer}
            onBack={() => router.back()}
            backLabel="← В тренажёр"
        />
    );
}
