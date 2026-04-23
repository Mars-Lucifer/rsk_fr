import { getUserFromCookies } from "../actions";

export function buildMayakSessionCompletionPayload({ activeUserId, elapsedTime, levels }) {
    const timestamp = new Date().toISOString();

    return {
        [String(activeUserId || "anonymous")]: {
            [timestamp]: {
                taskNumber: "session-completion",
                elapsedTime,
                levels: {
                    level1: parseInt(levels.level1, 10) || 0,
                    level2: parseInt(levels.level2, 10) || 0,
                    level3: parseInt(levels.level3, 10) || 0,
                    level4: parseInt(levels.level4, 10) || 0,
                    level5: parseInt(levels.level5, 10) || 0,
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

export async function executeMayakSessionCompletion({
    elapsedTime,
    levels,
    onPersistArtifacts,
    onSendToTelegram,
    onClearState,
    redirectTo = "/profile",
}) {
    const activeUser = getUserFromCookies();
    const activeUserId = String(activeUser?.id || activeUser?.portalUserId || "anonymous").trim() || "anonymous";

    const payload = buildMayakSessionCompletionPayload({
        activeUserId,
        elapsedTime,
        levels,
    });

    await fetch("/api/mayak/saveDeltaTest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }).catch((error) => console.error("Ошибка сохранения измерений MAYAK (не критично):", error));

    await onPersistArtifacts();

    try {
        await onSendToTelegram();
    } catch (error) {
        console.error("Telegram-отправка не удалась (не критично):", error);
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
    onClearState();
    window.location.href = redirectTo;
}
