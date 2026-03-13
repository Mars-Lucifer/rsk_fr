import { readMayakActiveUser } from "./readMayakActiveUser";

export function buildMayakSessionCompletionPayload({ activeUser, elapsedTime, levels }) {
    const userId = activeUser?.id || "anonymous";
    const timestamp = new Date().toISOString();

    return {
        [userId]: {
            [timestamp]: {
                taskNumber: "session-completion",
                elapsedTime,
                levels: {
                    level1: parseInt(levels.level1) || 0,
                    level2: parseInt(levels.level2) || 0,
                    level3: parseInt(levels.level3) || 0,
                    level4: parseInt(levels.level4) || 0,
                    level5: parseInt(levels.level5) || 0,
                },
            },
        },
    };
}

export function clearMayakSessionCompletionState({ getStorageKey, removeKeyCookie, resetQwenSessionState, setSelectedRole, setShowSessionCompletionPopup, setShowThirdQuestionnaire }) {
    setShowSessionCompletionPopup(false);
    setShowThirdQuestionnaire(false);
    localStorage.removeItem(getStorageKey("userRole"));
    localStorage.removeItem(getStorageKey("sessionStartTime"));
    localStorage.removeItem(getStorageKey("session_tasks_log"));
    localStorage.removeItem(getStorageKey("completedTasks"));
    resetQwenSessionState();
    localStorage.removeItem("trainer_v2_rankingTestResults");
    localStorage.removeItem("trainer_v2_rankingTestResults_previous");
    sessionStorage.removeItem("trainer_v2_taskTimer");
    sessionStorage.removeItem(getStorageKey("currentTaskIndex"));
    setSelectedRole(null);
    removeKeyCookie();
    localStorage.setItem("trainer_v2_sessionCompletionPending", "true");
}

export async function executeMayakSessionCompletion({ elapsedTime, levels, onDownloadCertificate, onDownloadLogs, onSendToTelegram, onClearState }) {
    const activeUser = readMayakActiveUser();
    const payload = buildMayakSessionCompletionPayload({ activeUser, elapsedTime, levels });

    fetch("/api/mayak/saveDeltaTest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }).catch((e) => console.error("Ошибка сохранения (не критично):", e));

    await onDownloadCertificate();
    await onDownloadLogs();

    try {
        await onSendToTelegram();
    } catch (e) {
        console.error("Telegram отправка не удалась (не критично):", e);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
    onClearState();
    window.location.href = "/";
}
