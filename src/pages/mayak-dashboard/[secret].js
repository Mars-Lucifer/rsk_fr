"use client";

import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

import SessionDashboard from "@/components/features/mayak-dashboard/SessionDashboard";
import GuideTour from "@/components/features/mayak-guide/GuideTour";
import { DASHBOARD_TOUR, TOUR_HANDOFF_KEY } from "@/components/features/mayak-guide/accessTour.mjs";

// Дашборд сессии для мастера по секрету в URL (без admin-пароля). Переиспользует
// общий компонент дашборда, но с эндпоинтами /api/mayak/master/*.
export default function MayakMasterDashboardPage() {
    const router = useRouter();
    const secret = typeof router.query.secret === "string" ? router.query.secret : "";

    const handleAuthFail = useCallback(() => {
        router.replace("/");
    }, [router]);

    // Продолжение инструкции из консоли доступа. Метку ставит консоль перед тем, как
    // мастер откроет мастер-ссылку, и снимаем её сразу: инструкция догоняет мастера
    // один раз, а не встречает его на каждом открытии дашборда во время занятия.
    //
    // Задержка — не украшение: дашборд ждёт ответа сервера, и до него на экране крутится
    // только спиннер. Стрелка, поставленная в этот момент, целилась бы в пустоту.
    const [tourOpen, setTourOpen] = useState(false);
    useEffect(() => {
        let handoff = "";
        try {
            handoff = window.localStorage.getItem(TOUR_HANDOFF_KEY) || "";
            if (handoff) window.localStorage.removeItem(TOUR_HANDOFF_KEY);
        } catch {
            return undefined;
        }
        if (!handoff) return undefined;
        const timer = window.setTimeout(() => setTourOpen(true), 1200);
        return () => window.clearTimeout(timer);
    }, []);

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
        <>
            <SessionDashboard
                sessionId={secret}
                dashboardUrl={`/api/mayak/master/dashboard?secret=${encoded}`}
                participantsUrl={`/api/mayak/master/participants?secret=${encoded}`}
                onAuthFail={handleAuthFail}
                hideBack={!cameFromTrainer}
                onBack={() => router.back()}
                backLabel="← В тренажёр"
                requireReadyDeck
            />
            <GuideTour steps={DASHBOARD_TOUR} open={tourOpen} onClose={() => setTourOpen(false)} title="Дашборд занятия" />
        </>
    );
}
