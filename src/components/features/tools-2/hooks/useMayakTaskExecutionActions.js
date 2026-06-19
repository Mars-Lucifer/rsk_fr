import { useCallback } from "react";

import { saveMayakTaskAttempt } from "../utils/saveMayakTaskAttempt";

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
    prompt,
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
    sessionUploadRequired,
    isCurrentTaskApproved,
}) => {
    const buildCompletionTaskData = useCallback(() => {
        const taskNumber = currentTask?.number?.toString();
        const taskTextData = taskNumber ? tasksTexts.find((t) => t.number === taskNumber) : null;

        if (taskTextData) {
            return {
                ...taskTextData,
                title: currentTask?.title || "",
                contentType: currentTask?.contentType || "",
            };
        }

        console.warn(`Текст для задания ${currentTaskIndex + 1} не найден.`);
        return {
            number: currentTask?.number || currentTaskIndex + 1,
            title: currentTask?.title || "",
            contentType: currentTask?.contentType || "",
            description: currentTask?.description || "Описание задания недоступно",
            task: currentTask?.name || "Текст задания недоступен",
        };
    }, [currentTask, currentTaskIndex, tasksTexts]);

    const finalizeTaskExecution = useCallback(
        async ({ timeWhenStopped, shouldStopTimer = true }) => {
            const safeElapsedTime = Number.isFinite(timeWhenStopped) ? timeWhenStopped : timerState.elapsedTime;

            if (shouldStopTimer) {
                stopTimer();
            }

            const taskData = buildCompletionTaskData();
            const minutes = Math.round(safeElapsedTime / 60);
            const taskName = currentTask?.name || `Задание ${currentTaskIndex + 1}`;

            const logEntry = {
                number: String(taskData.number || currentTaskIndex + 1),
                title: taskName,
                taskTitle: currentTask?.title || "",
                contentType: currentTask?.contentType || "",
                description: taskData?.description || "",
                taskText: taskData?.task || "",
                time: formatTaskTime(safeElapsedTime),
                mayak: {
                    m: fields.m,
                    a: fields.a,
                    y: fields.y,
                    k: fields.k,
                    o1: fields.o1,
                    k2: fields.k2,
                    o2: fields.o2,
                },
                finalPrompt: prompt,
            };

            const currentLog = JSON.parse(localStorage.getItem(getStorageKey("session_tasks_log")) || "[]");
            const filteredLog = currentLog.filter((item) => item.number && String(item.number) !== String(logEntry.number));
            localStorage.setItem(getStorageKey("session_tasks_log"), JSON.stringify([...filteredLog, logEntry]));

            try {
                const result = await saveMayakTaskAttempt({
                    taskName,
                    minutes,
                    currentTaskIndex,
                    type,
                    userType,
                    who,
                    taskElapsedTime: safeElapsedTime,
                    sectionId: tokenSectionId,
                });

                if (!result.success) {
                    console.warn("Failed to save to server, using localStorage fallback");
                    const newTasks = {
                        ...completedTasks,
                        [activeUser]: {
                            ...(completedTasks[activeUser] || {}),
                            [taskName]: {
                                attempts: [
                                    ...(completedTasks[activeUser]?.[taskName]?.attempts || []),
                                    {
                                        timestamp: new Date().toISOString(),
                                        timeSpent: minutes,
                                        taskDetails: { type, userType, who },
                                    },
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
        },
        [activeUser, buildCompletionTaskData, completedTasks, currentTask, currentTaskIndex, fields, formatTaskTime, getStorageKey, prompt, setCompletedTasks, stopTimer, timerState.elapsedTime, tokenSectionId, type, userType, who]
    );

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
            if (isCurrentTaskApproved) {
                stopTimer();
                await finalizeTaskExecution({ timeWhenStopped });
                return;
            }
            setCurrentTaskData(buildCompletionTaskData());
            setShowCompletionPopup(true);
            if (sessionUploadRequired) {
                return;
            }
            await finalizeTaskExecution({ timeWhenStopped });
        } else {
            startTimer();
        }
    }, [
        activeUser,
        autoCompleteIntroTask,
        currentTaskIndex,
        buildCompletionTaskData,
        finalizeTaskExecution,
        isIntroTask,
        isCurrentTaskApproved,
        setCurrentTaskData,
        setShowCompletionPopup,
        sessionUploadRequired,
        startTimer,
        stopTimer,
        timerState.elapsedTime,
        timerState.isRunning,
    ]);

    return {
        finalizeTaskExecution,
        toggleTaskTimer,
    };
};
