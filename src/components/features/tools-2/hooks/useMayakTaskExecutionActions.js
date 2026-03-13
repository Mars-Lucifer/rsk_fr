import { useCallback } from "react";

import { saveMayakTaskAttempt } from "../utils/saveMayakTaskAttempt";
import { upsertMayakTaskLogEntry } from "../utils/mayakTaskLogStorage";

export const useMayakTaskExecutionActions = ({
    activeUser,
    autoCompleteIntroTask,
    completedTasks,
    currentTask,
    currentTaskIndex,
    fields,
    formatTaskTime,
    getStorageKey,
    isIntroTask,
    onTaskStart,
    onTaskSubmit,
    prompt,
    qwenGreenCount,
    qwenResponse,
    qwenTotalFields,
    requestTaskAttachment,
    setCompletedTasks,
    setCurrentTaskData,
    setShowCompletionPopup,
    startTimer,
    stopTimer,
    tasksTexts,
    timerState,
    tokenSectionId,
    type,
    userType,
    who,
}) => {
    const activeUserId = activeUser?.id || "anonymous";

    const toggleTaskTimer = useCallback(async () => {
        if (isIntroTask(currentTaskIndex)) {
            if (timerState.isRunning) {
                stopTimer();
                autoCompleteIntroTask();
            } else {
                startTimer();
            }
            return;
        }

        if (timerState.isRunning) {
            const timeWhenStopped = timerState.elapsedTime;
            const taskNumber = currentTask?.number?.toString();
            const safeTaskNumber = taskNumber || String(currentTaskIndex + 1);
            const taskKey = `${tokenSectionId || "global"}:${safeTaskNumber}`;
            const taskName = currentTask?.name || `\u0417\u0430\u0434\u0430\u043d\u0438\u0435 ${currentTaskIndex + 1}`;
            const taskTextData = taskNumber ? tasksTexts.find((t) => t.number === taskNumber) : null;
            const preparedTaskData = taskTextData
                ? { ...taskTextData, title: currentTask?.title || "", contentType: currentTask?.contentType || "" }
                : {
                      number: currentTask?.number || currentTaskIndex + 1,
                      title: currentTask?.title || "",
                      contentType: currentTask?.contentType || "",
                      description: currentTask?.description || "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0437\u0430\u0434\u0430\u043d\u0438\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e",
                      task: currentTask?.name || "\u0422\u0435\u043a\u0441\u0442 \u0437\u0430\u0434\u0430\u043d\u0438\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d",
                  };

            const attachmentFile = typeof requestTaskAttachment === "function"
                ? await requestTaskAttachment({
                      taskNumber: safeTaskNumber,
                      taskTitle: currentTask?.title || currentTask?.name || `\u0417\u0430\u0434\u0430\u043d\u0438\u0435 ${currentTaskIndex + 1}` ,
                      taskData: preparedTaskData,
                      elapsedTime: timeWhenStopped,
                  })
                : null;

            if (!(attachmentFile instanceof File)) {
                return;
            }

            stopTimer();
            const minutes = Math.round(timeWhenStopped / 60);

            try {
                const result = await saveMayakTaskAttempt({ taskName, minutes, currentTaskIndex, type, userType, who, taskElapsedTime: timeWhenStopped, sectionId: tokenSectionId });
                if (!result.success) {
                    console.warn("Failed to save to server, using localStorage fallback");
                    const newTasks = {
                        ...completedTasks,
                        [activeUserId]: {
                            ...(completedTasks[activeUserId] || {}),
                            [taskName]: {
                                attempts: [
                                    ...(completedTasks[activeUserId]?.[taskName]?.attempts || []),
                                    { timestamp: new Date().toISOString(), timeSpent: minutes, taskDetails: { type, userType, who } },
                                ],
                            },
                        },
                    };
                    setCompletedTasks(newTasks);
                    localStorage.setItem(getStorageKey("completedTasks"), JSON.stringify(newTasks));
                }
            } catch (err) {
                console.error("Error saving task data:", err);
            }

            let sessionTaskState = null;
            if (typeof onTaskSubmit === "function") {
                sessionTaskState = await onTaskSubmit({ file: attachmentFile, taskNumber: safeTaskNumber, taskName, elapsedSeconds: timeWhenStopped, sectionId: tokenSectionId });
            }

            const finalStatus = sessionTaskState?.status || null;
            upsertMayakTaskLogEntry(getStorageKey("session_tasks_log"), {
                taskKey,
                number: safeTaskNumber,
                title: taskName,
                taskTitle: currentTask?.title || "",
                contentType: currentTask?.contentType || "",
                description: taskTextData?.description || "",
                taskText: taskTextData?.task || "",
                time: formatTaskTime(timeWhenStopped),
                secondsSpent: timeWhenStopped,
                mayak: { m: fields.m, a: fields.a, y: fields.y, k: fields.k, o1: fields.o1, k2: fields.k2, o2: fields.o2 },
                finalPrompt: prompt,
                status: finalStatus || "completed",
                rejectionCount: 0,
                rejectionReason: "",
                attachmentName: attachmentFile.name,
                qwen: qwenResponse || qwenGreenCount !== null ? { requested: true, score: `${Number.isFinite(qwenGreenCount) ? qwenGreenCount : 0}/${Number.isFinite(qwenTotalFields) ? qwenTotalFields : 7}` } : null,
                updatedAt: new Date().toISOString(),
            });

            const shouldOpenCompletionPopup = !finalStatus || finalStatus === "approved" || finalStatus === "auto_approved";
            if (shouldOpenCompletionPopup) {
                setCurrentTaskData(preparedTaskData);
                setShowCompletionPopup(true);
            }
            return;
        }

        if (typeof onTaskStart === "function") {
            const shouldStart = await onTaskStart({ taskNumber: currentTask?.number?.toString() || String(currentTaskIndex + 1), taskName: currentTask?.name || `\u0417\u0430\u0434\u0430\u043d\u0438\u0435 ${currentTaskIndex + 1}`, sectionId: tokenSectionId });
            if (shouldStart === false) return;
        }

        startTimer();
    }, [
        activeUserId,
        autoCompleteIntroTask,
        completedTasks,
        currentTask,
        currentTaskIndex,
        fields,
        formatTaskTime,
        getStorageKey,
        isIntroTask,
        onTaskStart,
        onTaskSubmit,
        prompt,
        qwenGreenCount,
        qwenResponse,
        qwenTotalFields,
        requestTaskAttachment,
        setCompletedTasks,
        setCurrentTaskData,
        setShowCompletionPopup,
        startTimer,
        stopTimer,
        tasksTexts,
        timerState.elapsedTime,
        timerState.isRunning,
        tokenSectionId,
        type,
        userType,
        who,
    ]);

    return { toggleTaskTimer };
};
