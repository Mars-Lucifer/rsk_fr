"use client";

import { useRouter } from "next/router";
import { useCallback } from "react";

import SessionDashboard from "@/components/features/mayak-dashboard/SessionDashboard";

export default function AdminMayakSessionDashboardPage() {
    const router = useRouter();
    const sessionId = typeof router.query.id === "string" ? router.query.id : "";

    const handleAuthFail = useCallback(() => {
        router.replace("/admin");
    }, [router]);

    if (!router.isReady || !sessionId) {
        return null;
    }

    return <SessionDashboard sessionId={sessionId} onAuthFail={handleAuthFail} />;
}
