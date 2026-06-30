import { useCallback } from "react";
import { createEmptyMayakFields } from "../utils/mayakPromptState";

export function useMayakSessionActions({
    activeUserId,
    autoCompleteIntroTask,
    currentTaskIndex,
    getStorageKey,
    isAdmin,
    isIntroTask,
    sessionId,
    resetSovaSessionState,
    removeKeyCookie,
    setCompletionSurveyDone,
    setCompletionTestingDone,
    setFields,
    setHasCompletedSecondQuestionnaire,
    setPrompt,
    setRankingDelta5,
    setSelectedRole,
    setShowRolePopup,
    stopTimer,
    timerIsRunning,
    onAfterRoleConfirm,
}) {
    const handleRoleConfirm = useCallback(
        async (role) => {
            if (sessionId && activeUserId) {
                const response = await fetch("/api/mayak/session-runtime/role", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        sessionId,
                        userId: activeUserId,
                        role,
                    }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.success) {
                    alert(payload.error || "Не удалось сохранить роль в сессии");
                    return;
                }
            }

            setSelectedRole(role);
            localStorage.setItem(getStorageKey("userRole"), role);
            setShowRolePopup(false);
            // Сразу выдаём тайную миссию под выбранную роль и показываем её попап.
            if (typeof onAfterRoleConfirm === "function") {
                await onAfterRoleConfirm(role);
            }
            if (isIntroTask(currentTaskIndex)) {
                autoCompleteIntroTask();
            }
        },
        [activeUserId, autoCompleteIntroTask, currentTaskIndex, getStorageKey, isIntroTask, onAfterRoleConfirm, sessionId, setSelectedRole, setShowRolePopup]
    );

    const handleAdminResetSession = useCallback(() => {
        if (!isAdmin) return;
        if (!confirm("Вы действительно хотите сбросить текущую сессию и начать заново? Все локальные данные будут очищены.")) return;

        if (timerIsRunning) stopTimer();

        localStorage.removeItem(getStorageKey("userRole"));
        localStorage.removeItem(getStorageKey("sessionStartTime"));
        localStorage.removeItem(getStorageKey("session_tasks_log"));
        localStorage.removeItem(getStorageKey("completedTasks"));
        localStorage.removeItem(getStorageKey("sovaEvaluationQuota"));
        localStorage.removeItem(getStorageKey("hasCompletedSecondQuestionnaire"));
        localStorage.removeItem(getStorageKey("mayak_achieved_start"));
        localStorage.removeItem(getStorageKey("mayak_achieved_content_types"));
        localStorage.removeItem(getStorageKey("mayak_achieved_specialization"));
        localStorage.removeItem(getStorageKey("taskVersion"));
        localStorage.removeItem("trainer_v2_rankingTestResults");
        localStorage.removeItem("trainer_v2_rankingTestResults_previous");
        sessionStorage.removeItem("trainer_v2_taskTimer");
        sessionStorage.removeItem(getStorageKey("currentTaskIndex"));

        setSelectedRole(null);
        setRankingDelta5(null);
        setHasCompletedSecondQuestionnaire(false);
        setFields(createEmptyMayakFields());
        setPrompt("");
        resetSovaSessionState();
        setCompletionTestingDone(false);
        setCompletionSurveyDone(false);
        removeKeyCookie();
        window.location.reload();
    }, [
        getStorageKey,
        isAdmin,
        removeKeyCookie,
        resetSovaSessionState,
        setCompletionSurveyDone,
        setCompletionTestingDone,
        setFields,
        setHasCompletedSecondQuestionnaire,
        setPrompt,
        setRankingDelta5,
        setSelectedRole,
        stopTimer,
        timerIsRunning,
    ]);

    return {
        handleAdminResetSession,
        handleRoleConfirm,
    };
}
