import { useCallback } from "react";
import { createEmptyMayakFields } from "../utils/mayakPromptState";

export function useMayakSessionActions({
    autoCompleteIntroTask,
    currentTaskIndex,
    getStorageKey,
    isAdmin,
    isIntroTask,
    resetQwenSessionState,
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
    syncRole,
    timerIsRunning,
}) {
    const handleRoleConfirm = useCallback(
        async (role) => {
            if (typeof syncRole === "function") {
                await syncRole(role);
            }
            setSelectedRole(role);
            localStorage.setItem(getStorageKey("userRole"), role);
            setShowRolePopup(false);
            if (isIntroTask(currentTaskIndex)) {
                autoCompleteIntroTask();
            }
        },
        [autoCompleteIntroTask, currentTaskIndex, getStorageKey, isIntroTask, setSelectedRole, setShowRolePopup, syncRole]
    );

    const handleAdminResetSession = useCallback(() => {
        if (!isAdmin) return;
        if (!confirm("Это действие очистит текущую сессию тренажера для этого браузера.")) return;

        if (timerIsRunning) stopTimer();

        localStorage.removeItem(getStorageKey("userRole"));
        localStorage.removeItem(getStorageKey("sessionStartTime"));
        localStorage.removeItem(getStorageKey("session_tasks_log"));
        localStorage.removeItem(getStorageKey("completedTasks"));
        localStorage.removeItem(getStorageKey("qwenEvaluationQuota"));
        localStorage.removeItem(getStorageKey("hasCompletedSecondQuestionnaire"));
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
        resetQwenSessionState();
        setCompletionTestingDone(false);
        setCompletionSurveyDone(false);
        removeKeyCookie();
        window.location.reload();
    }, [
        getStorageKey,
        isAdmin,
        removeKeyCookie,
        resetQwenSessionState,
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
