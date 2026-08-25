import { useCallback } from "react";

import { buildMayakSessionArtifacts } from "../utils/mayakSessionArtifacts";
import { clearMayakSessionCompletionState, executeMayakSessionCompletion, saveMayakCompletionDelta } from "../utils/mayakSessionCompletion";
import { buildMayakCertificateBlob, buildMayakQrDataUrl, buildMayakSessionLogBlob, downloadMayakBlob } from "../utils/mayakSessionDocuments";
import { getKeyFromCookies, getUserFromCookies } from "../actions";

// Временно отключено: при завершении сессии скачиваются только сертификат и лог,
// итоговая аналитика пропускается. Вернуть в true, чтобы снова генерировать аналитику.
const ENABLE_MAYAK_FINAL_ANALYTICS = false;

function repairUtf8AsCp1251(value) {
    const source = String(value || "");
    if (!/[РС][\u0080-\uFFFF]/.test(source)) return source;

    const cp1251Special = new Map([
        ["Ђ", 0x80], ["Ѓ", 0x81], ["‚", 0x82], ["ѓ", 0x83], ["„", 0x84], ["…", 0x85], ["†", 0x86], ["‡", 0x87],
        ["€", 0x88], ["‰", 0x89], ["Љ", 0x8a], ["‹", 0x8b], ["Њ", 0x8c], ["Ќ", 0x8d], ["Ћ", 0x8e], ["Џ", 0x8f],
        ["ђ", 0x90], ["‘", 0x91], ["’", 0x92], ["“", 0x93], ["”", 0x94], ["•", 0x95], ["–", 0x96], ["—", 0x97],
        ["™", 0x99], ["љ", 0x9a], ["›", 0x9b], ["њ", 0x9c], ["ќ", 0x9d], ["ћ", 0x9e], ["џ", 0x9f],
        ["Ў", 0xa1], ["ў", 0xa2], ["Ј", 0xa3], ["¤", 0xa4], ["Ґ", 0xa5], ["¦", 0xa6], ["§", 0xa7],
        ["Ё", 0xa8], ["©", 0xa9], ["Є", 0xaa], ["«", 0xab], ["¬", 0xac], ["®", 0xae], ["Ї", 0xaf],
        ["°", 0xb0], ["±", 0xb1], ["І", 0xb2], ["і", 0xb3], ["ґ", 0xb4], ["µ", 0xb5], ["¶", 0xb6], ["·", 0xb7],
        ["ё", 0xb8], ["№", 0xb9], ["є", 0xba], ["»", 0xbb], ["ј", 0xbc], ["Ѕ", 0xbd], ["ѕ", 0xbe], ["ї", 0xbf],
    ]);

    const bytes = [];
    for (const char of source) {
        const code = char.charCodeAt(0);
        if (code <= 0x7f) {
            bytes.push(code);
        } else if (code >= 0x0410 && code <= 0x044f) {
            bytes.push(code - 0x0410 + 0xc0);
        } else if (cp1251Special.has(char)) {
            bytes.push(cp1251Special.get(char));
        } else {
            return source;
        }
    }

    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    } catch {
        return source;
    }
}

function buildFullMayakName(userData) {
    const explicitParts = [userData?.lastName, userData?.firstName, userData?.patronymic]
        .map((item) => String(item || "").trim())
        .filter(Boolean);

    if (explicitParts.length > 0) {
        return repairUtf8AsCp1251(explicitParts.join(" "));
    }

    return repairUtf8AsCp1251(String(userData?.name || "").trim()) || "Участник";
}

function buildCertificateMayakName(userData) {
    const explicitParts = [userData?.lastName, userData?.firstName]
        .map((item) => String(item || "").trim())
        .filter(Boolean);

    if (explicitParts.length > 0) {
        return repairUtf8AsCp1251(explicitParts.join(" "));
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
        console.error("Не удалось получить номер сертификата:", error);
        return "";
    }
}

export const useMayakCompletionActions = ({
    elapsedTime,
    getStorageKey,
    levels,
    removeKeyCookie,
    resetSovaSessionState,
    selectedRole,
    setSelectedRole,
    setShowSessionCompletionPopup,
    setShowThirdQuestionnaire,
    setCompletionLoading,
    tokenSectionId,
}) => {
    const formatTaskTime = useCallback((seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }, []);

    // Строгая генерация лога: бросает ошибку наверх (для завершения сессии гостя,
    // где провал не должен приводить к молчаливой потере артефакта).
    const downloadLogsStrict = useCallback(async () => {
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
    }, [formatTaskTime, getStorageKey, selectedRole, tokenSectionId]);

    // Толерантная обёртка для отдельной кнопки скачивания (ошибки не критичны).
    const handleDownloadLogs = useCallback(async () => {
        try {
            await downloadLogsStrict();
        } catch (error) {
            console.error("Ошибка при генерации логов:", error);
        }
    }, [downloadLogsStrict]);

    // Строгая генерация сертификата: бросает ошибку наверх.
    const downloadCertificateStrict = useCallback(async () => {
        const userData = getUserFromCookies();
        const userName = buildCertificateMayakName(userData);
        const dateStr = new Date().toLocaleDateString("ru-RU");
        const userId = await resolveMayakCertificateUserId(userData);
        const qrDataUrl = await buildMayakQrDataUrl(userId);
        const certificateNumber = await resolveMayakCertificateNumber({ ...userData, portalUserId: userId });
        const blobCert = await buildMayakCertificateBlob({ userName, dateStr, qrDataUrl, certificateNumber });
        downloadMayakBlob(blobCert, `Certificate_Mayak_${userName.replace(/\s+/g, "_")}.pdf`);
    }, []);

    // Толерантная обёртка для отдельной кнопки скачивания.
    const handleDownloadCertificate = useCallback(async () => {
        try {
            await downloadCertificateStrict();
        } catch (error) {
            console.error("Ошибка при генерации сертификата:", error);
        }
    }, [downloadCertificateStrict]);

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

            // Аналитика — необязательный артефакт. Жёсткий таймаут не даёт ей
            // заблокировать завершение сессии, если генерация на сервере зависнет.
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000);

            let response;
            try {
                response = await fetch("/api/mayak/session-analytics", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ logData }),
                    signal: controller.signal,
                });
            } finally {
                clearTimeout(timeoutId);
            }

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

    const handleSaveArtifactsToProfile = useCallback(async () => {
        const activeKey = await getKeyFromCookies();
        if (!activeKey?.text) {
            throw new Error("Не найден активный токен MAYAK");
        }

        const { rankingData, enrichedTasks, totalSessionSeconds } = await buildMayakSessionArtifacts({
            getStorageKey,
            tokenSectionId,
        });
        const totalTime = formatTaskTime(totalSessionSeconds);
        const activeUser = getUserFromCookies();
        const logData = {
            userName: buildFullMayakName(activeUser),
            userRole: selectedRole,
            date: new Date().toLocaleDateString("ru-RU"),
            totalTime,
            rankingData,
            tasks: enrichedTasks,
        };

        const finalizeResponse = await fetch("/api/mayak/completions/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                logData,
                selectedRole,
            }),
        });

        if (!finalizeResponse.ok) {
            const payload = await finalizeResponse.json().catch(() => ({}));
            throw new Error(payload.error || "Не удалось сохранить материалы в личном кабинете");
        }

        return finalizeResponse.json().catch(() => ({}));
    }, [formatTaskTime, getStorageKey, selectedRole, tokenSectionId]);

    const handleDownloadGuestArtifacts = useCallback(async () => {
        // Сертификат и лог — критичные артефакты: если генерация упала, бросаем
        // ошибку наверх, чтобы завершение прервалось и сессия НЕ сбросилась
        // (иначе гость уходит без файлов и без предупреждения).
        await downloadCertificateStrict();
        await new Promise((resolve) => setTimeout(resolve, 200));
        await downloadLogsStrict();
        await new Promise((resolve) => setTimeout(resolve, 200));
        // Аналитика необязательна — best-effort, ошибки не критичны.
        await handleDownloadAnalytics();
        return { success: true };
    }, [downloadCertificateStrict, downloadLogsStrict, handleDownloadAnalytics]);

    const handleSaveSessionCompletion = useCallback(async () => {
        setCompletionLoading(true);

        try {
            const activeUser = getUserFromCookies();
            const isGuestUser = Boolean(activeUser?.guestMode);
            await executeMayakSessionCompletion({
                elapsedTime,
                levels,
                onPersistArtifacts: isGuestUser ? handleDownloadGuestArtifacts : handleSaveArtifactsToProfile,
                onClearState: () =>
                    clearMayakSessionCompletionState({
                        getStorageKey,
                        removeKeyCookie,
                        resetSovaSessionState,
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
            setCompletionLoading(false);
        }
    }, [elapsedTime, getStorageKey, handleDownloadGuestArtifacts, handleSaveArtifactsToProfile, levels, removeKeyCookie, resetSovaSessionState, setSelectedRole, setShowSessionCompletionPopup, setShowThirdQuestionnaire, setCompletionLoading]);

    return {
        handleDownloadAnalytics,
        handleDownloadCertificate,
        handleDownloadLogs,
        handleSaveSessionCompletion,
    };
};
