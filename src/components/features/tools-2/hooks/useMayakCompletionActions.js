import { useCallback } from "react";

import { blobToBase64, buildMayakSessionArtifacts } from "../utils/mayakSessionArtifacts";
import { clearMayakSessionCompletionState, executeMayakSessionCompletion, saveMayakCompletionDelta } from "../utils/mayakSessionCompletion";
import { buildMayakCertificateBlob, buildMayakQrDataUrl, buildMayakSessionLogBlob, downloadMayakBlob } from "../utils/mayakSessionDocuments";
import { getKeyFromCookies, getUserFromCookies } from "../actions";

const ENABLE_MAYAK_TELEGRAM_COMPLETION_DELIVERY = false;
const ENABLE_MAYAK_FINAL_ANALYTICS = false;

function buildFullMayakName(userData) {
    const explicitParts = [userData?.lastName, userData?.firstName, userData?.patronymic]
        .map((item) => String(item || "").trim())
        .filter(Boolean);

    if (explicitParts.length > 0) {
        return explicitParts.join(" ");
    }

    return String(userData?.name || "").trim() || "Участник";
}

function buildCertificateMayakName(userData) {
    const explicitParts = [userData?.lastName, userData?.firstName]
        .map((item) => String(item || "").trim())
        .filter(Boolean);

    if (explicitParts.length > 0) {
        return explicitParts.join(" ");
    }

    const fallbackName = buildFullMayakName(userData);
    const fallbackParts = fallbackName.split(/\s+/).filter(Boolean);

    if (fallbackParts.length >= 2) {
        return fallbackParts.slice(0, 2).join(" ");
    }

    return fallbackName;
}

function buildSafeMayakFilePart(value) {
    const prepared = String(value || "")
        .trim()
        .replace(/[^\p{L}\p{N}_-]+/gu, "_")
        .replace(/^_+|_+$/g, "");

    return prepared || "Participant";
}

function normalizeMayakCertificateNumber(value) {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "";
}

async function resolveMayakCertificateUserId(userData) {
    const directUserId = String(userData?.portalUserId || userData?.id || "").trim();
    if (directUserId && directUserId !== "dev-bypass") {
        return directUserId;
    }

    try {
        const response = await fetch("/api/profile/info", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            return directUserId;
        }

        return String(payload?.userId || payload?.data?.id || "").trim() || directUserId;
    } catch (error) {
        console.error("Не удалось определить пользователя сертификата:", error);
        return directUserId;
    }
}

async function resolveMayakCertificateNumber(userData) {
    const fromCookie = normalizeMayakCertificateNumber(userData?.certificateNumber);
    if (fromCookie) {
        return fromCookie;
    }

    const userId = await resolveMayakCertificateUserId(userData);
    if (!userId) {
        return "";
    }

    try {
        const response = await fetch(`/api/mayak/get-results?userId=${encodeURIComponent(userId)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            return "";
        }

        return normalizeMayakCertificateNumber(payload?.certificateNumber);
    } catch (error) {
        console.error("РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РЅРѕРјРµСЂ СЃРµСЂС‚РёС„РёРєР°С‚Р°:", error);
        return "";
    }
}

export const useMayakCompletionActions = ({
    elapsedTime,
    getStorageKey,
    levels,
    removeKeyCookie,
    resetQwenSessionState,
    selectedRole,
    setSelectedRole,
    setShowSessionCompletionPopup,
    setShowThirdQuestionnaire,
    setTelegramLink,
    setTelegramLoading,
    tokenSectionId,
}) => {
    const formatTaskTime = useCallback((seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }, []);

    const handleDownloadLogs = useCallback(async () => {
        try {
            const userData = getUserFromCookies();
            const userName = buildFullMayakName(userData);
            const dateStr = new Date().toLocaleDateString("ru-RU");
            const { rankingData, enrichedTasks, totalSessionSeconds } = await buildMayakSessionArtifacts({
                getStorageKey,
                tokenSectionId,
            });
            const blobLogs = await buildMayakSessionLogBlob({
                userName,
                userRole: selectedRole,
                dateStr,
                totalTime: formatTaskTime(totalSessionSeconds),
                rankingData,
                tasks: enrichedTasks,
            });
            downloadMayakBlob(blobLogs, `Log_Mayak_${userName.replace(/\s+/g, "_")}_${dateStr}.pdf`);
        } catch (error) {
            console.error("Ошибка при генерации логов:", error);
        }
    }, [formatTaskTime, getStorageKey, selectedRole, tokenSectionId]);

    const handleDownloadCertificate = useCallback(async () => {
        try {
            const userData = getUserFromCookies();
            const userName = buildCertificateMayakName(userData);
            const dateStr = new Date().toLocaleDateString("ru-RU");
            const userId = await resolveMayakCertificateUserId(userData);
            const qrDataUrl = await buildMayakQrDataUrl(userId);
            const certificateNumber = await resolveMayakCertificateNumber({ ...userData, portalUserId: userId });
            const blobCert = await buildMayakCertificateBlob({ userName, dateStr, qrDataUrl, certificateNumber });
            downloadMayakBlob(blobCert, `Certificate_Mayak_${userName.replace(/\s+/g, "_")}.pdf`);
        } catch (error) {
            console.error("Ошибка при генерации сертификата:", error);
        }
    }, []);

    const handleDownloadAnalytics = useCallback(async () => {
        if (!ENABLE_MAYAK_FINAL_ANALYTICS) {
            return;
        }

        try {
            const userData = getUserFromCookies();
            const userName = buildFullMayakName(userData);
            const dateStr = new Date().toLocaleDateString("ru-RU");
            const { rankingData, enrichedTasks, totalSessionSeconds } = await buildMayakSessionArtifacts({
                getStorageKey,
                tokenSectionId,
            });
            const totalTime = formatTaskTime(totalSessionSeconds);
            const logData = {
                userName,
                userRole: selectedRole,
                date: dateStr,
                totalTime,
                rankingData,
                tasks: enrichedTasks,
            };

            const response = await fetch("/api/mayak/session-analytics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ logData }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error || "Не удалось сформировать аналитику");
            }

            const analyticsBlob = await response.blob();
            downloadMayakBlob(analyticsBlob, `Analytics_Mayak_${logData.userName.replace(/\s+/g, "_")}_${logData.date}.pdf`);
        } catch (error) {
            console.error("Ошибка при генерации аналитики:", error);
        }
    }, [formatTaskTime, getStorageKey, selectedRole, tokenSectionId]);

    const handleSendToTelegram = useCallback(async () => {
        if (!ENABLE_MAYAK_TELEGRAM_COMPLETION_DELIVERY) {
            return;
        }

        setTelegramLoading(true);

        try {
            const userData = getUserFromCookies();
            const userName = buildFullMayakName(userData);
            const dateStr = new Date().toLocaleDateString("ru-RU");
            const userId = await resolveMayakCertificateUserId(userData);
            const qrDataUrl = await buildMayakQrDataUrl(userId);
            const certificateNumber = await resolveMayakCertificateNumber({ ...userData, portalUserId: userId });
            const certBlob = await buildMayakCertificateBlob({
                userName: buildCertificateMayakName(userData),
                dateStr,
                qrDataUrl,
                certificateNumber,
            });
            const { rankingData, enrichedTasks, totalSessionSeconds } = await buildMayakSessionArtifacts({
                getStorageKey,
                tokenSectionId,
            });
            const totalTime = formatTaskTime(totalSessionSeconds);
            const logBlob = await buildMayakSessionLogBlob({
                userName,
                userRole: selectedRole,
                dateStr,
                totalTime,
                rankingData,
                tasks: enrichedTasks,
            });

            const certBase64 = await blobToBase64(certBlob);
            const logBase64 = await blobToBase64(logBlob);

            const res = await fetch("/api/mayak/telegram-prepare", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userName,
                    certificate: certBase64,
                    log: logBase64,
                    logData: {
                        userName,
                        userRole: selectedRole,
                        date: dateStr,
                        totalTime,
                        rankingData,
                        tasks: enrichedTasks,
                    },
                }),
            });

            if (!res.ok) {
                throw new Error("Ошибка подготовки сессии");
            }

            const { deepLink } = await res.json();
            setTelegramLink(deepLink);
            window.open(deepLink, "_blank");
        } catch (error) {
            console.error("Ошибка отправки в Telegram:", error);
            alert("Не удалось подготовить файлы для Telegram. Попробуйте ещё раз.");
        } finally {
            setTelegramLoading(false);
        }
    }, [formatTaskTime, getStorageKey, selectedRole, setTelegramLink, setTelegramLoading, tokenSectionId]);

    const handleSaveArtifactsToProfile = useCallback(async () => {
        const activeUser = getUserFromCookies();
        const activeKey = await getKeyFromCookies();
        const fullUserName = buildFullMayakName(activeUser);
        const certificateUserName = buildCertificateMayakName(activeUser);
        const safeNamePart = buildSafeMayakFilePart(fullUserName);
        const dateStr = new Date().toLocaleDateString("ru-RU");
        const fileStamp = new Date().toISOString().replace(/[:]/g, "-").replace(/\.\d+Z$/, "Z");
        const userId = activeUser?.id || "";

        if (!activeKey?.text) {
            throw new Error("Не найден активный токен MAYAK");
        }

        if (!userId) {
            throw new Error("Не найден активный пользователь MAYAK");
        }

        const resolvedUserId = await resolveMayakCertificateUserId(activeUser);
        const qrDataUrl = await buildMayakQrDataUrl(resolvedUserId || userId);
        const certificateNumber = await resolveMayakCertificateNumber({ ...activeUser, portalUserId: resolvedUserId || userId });
        const certificateBlob = await buildMayakCertificateBlob({
            userName: certificateUserName,
            dateStr,
            qrDataUrl,
            certificateNumber,
        });

        const { rankingData, enrichedTasks, totalSessionSeconds } = await buildMayakSessionArtifacts({
            getStorageKey,
            tokenSectionId,
        });
        const totalTime = formatTaskTime(totalSessionSeconds);
        const logData = {
            userName: fullUserName,
            userRole: selectedRole,
            date: dateStr,
            totalTime,
            rankingData,
            tasks: enrichedTasks,
        };

        const logBlob = await buildMayakSessionLogBlob({
            userName: fullUserName,
            userRole: selectedRole,
            dateStr,
            totalTime,
            rankingData,
            tasks: enrichedTasks,
        });

        const filesToSave = [
            {
                kind: "certificate",
                fileName: `Certificate_Mayak_${safeNamePart}_${fileStamp}.pdf`,
                contentType: "application/pdf",
                base64: await blobToBase64(certificateBlob),
            },
            {
                kind: "log",
                fileName: `Log_Mayak_${safeNamePart}_${fileStamp}.pdf`,
                contentType: "application/pdf",
                base64: await blobToBase64(logBlob),
            },
        ];

        const saveResponse = await fetch("/api/profile/mayak-artifacts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                key: activeKey.text,
                completedAt: new Date().toISOString(),
                sectionId: tokenSectionId,
                role: selectedRole,
                sessionId: activeUser?.sessionId || "",
                tableNumber: activeUser?.tableNumber || "",
                tokenType: activeUser?.tokenType || "legacy",
                files: filesToSave,
            }),
        });

        if (!saveResponse.ok) {
            const payload = await saveResponse.json().catch(() => ({}));
            throw new Error(payload.error || "Не удалось сохранить материалы в личном кабинете");
        }

        return saveResponse.json().catch(() => ({}));
    }, [formatTaskTime, getStorageKey, selectedRole, tokenSectionId]);

    const handleDownloadGuestArtifacts = useCallback(async () => {
        await handleDownloadCertificate();
        await new Promise((resolve) => setTimeout(resolve, 200));
        await handleDownloadLogs();
        await new Promise((resolve) => setTimeout(resolve, 200));
        await handleDownloadAnalytics();
        return { success: true };
    }, [handleDownloadAnalytics, handleDownloadCertificate, handleDownloadLogs]);

    const handleSaveSessionCompletion = useCallback(async () => {
        setTelegramLoading(true);

        try {
            const activeUser = getUserFromCookies();
            const isGuestUser = Boolean(activeUser?.guestMode);
            await executeMayakSessionCompletion({
                elapsedTime,
                levels,
                onPersistArtifacts: isGuestUser ? handleDownloadGuestArtifacts : handleSaveArtifactsToProfile,
                onSendToTelegram: handleSendToTelegram,
                onClearState: () =>
                    clearMayakSessionCompletionState({
                        getStorageKey,
                        removeKeyCookie,
                        resetQwenSessionState,
                        setSelectedRole,
                        setShowSessionCompletionPopup,
                        setShowThirdQuestionnaire,
                    }),
                redirectTo: isGuestUser ? "/tools/mayak-oko" : "/profile",
            });
        } catch (error) {
            console.error("Ошибка в процессе завершения:", error);
            alert(error.message || "Не удалось сохранить материалы MAYAK в личном кабинете.");
        } finally {
            setTelegramLoading(false);
        }
    }, [elapsedTime, getStorageKey, handleDownloadGuestArtifacts, handleSaveArtifactsToProfile, handleSendToTelegram, levels, removeKeyCookie, resetQwenSessionState, setSelectedRole, setShowSessionCompletionPopup, setShowThirdQuestionnaire, setTelegramLoading]);

    return {
        handleDownloadAnalytics,
        handleDownloadCertificate,
        handleDownloadLogs,
        handleSaveSessionCompletion,
        handleSendToTelegram,
    };
};
