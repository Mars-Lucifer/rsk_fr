import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import Header from "@/components/layout/Header";
import Buffer from "./addons/popup";
import RankingTestPopup from "./addons/RankingTestPopup";
import MayakServicesPanel from "./MayakServicesPanel";
import InstructionImageModal from "./InstructionImageModal";
import InstructionPreviewPanel from "./InstructionPreviewPanel";
import { InspectorReviewModal, InspectorReviewQueue, SessionReviewStatusBanner, SessionTaskReviewPopup } from "./SessionReviewWidgets";
import { MayakField, TrainerControls, ROLE_DESCRIPTIONS } from "./TrainerUiSections";
import { RoleSelectionPopup, ConfirmationPopup, FirstQuestionnairePopup, SecondQuestionnairePopup, ThirdQuestionnairePopup, SessionCompletionPopup, TaskCompletionPopup } from "./TrainerPopups";

import InfoIcon from "@/assets/general/info.svg";
import CopyIcon from "@/assets/general/copy.svg";
import TimeIcon from "@/assets/general/time.svg";
import Plusicon from "@/assets/general/plus.svg";
import SettsIcon from "@/assets/general/setts.svg";
import RandomIcon from "@/assets/general/random.svg";
import ResetIcon from "@/assets/general/ResetIcon.svg";
import CloseIcon from "@/assets/general/close.svg";

// Добавляем getUserFromCookies
import { clearUserCookie, removeKeyCookie, addUserToCookies, getUserFromCookies } from "./actions";
// Добавляем эти две строки для работы сертификата
import { useMediaQuery } from "@/hooks/useMediaQuery";
import CourseIcon from "@/assets/nav/course.svg";
import Button from "@/components/ui/Button";
import Switcher from "@/components/ui/Switcher";

import Block from "@/components/features/public/Block";

import { saveMayakTaskAttempt } from "./utils/saveMayakTaskAttempt";
import { loadMayakBuffer, saveMayakBuffer, appendMayakBufferValue, ensureMayakBufferOptions } from "./utils/mayakBufferStorage";
import { buildMayakPromptDraft, cleanupMayakPrompt } from "./utils/buildMayakPromptDraft";
import { saveMayakPromptHistory } from "./utils/saveMayakPromptHistory";
import { saveMayakRankingTest } from "./utils/saveMayakRankingTest";
import { createEmptyMayakFields } from "./utils/mayakPromptState";
import { clearMayakSessionCompletionState } from "./utils/mayakSessionCompletion";
import { useMayakConfirmationActions } from "./hooks/useMayakConfirmationActions";
import { useMayakCompletionUiState } from "./hooks/useMayakCompletionUiState";
import { useMayakQwenEvaluation } from "./hooks/useMayakQwenEvaluation";
import { useMayakQuestionnaireActions } from "./hooks/useMayakQuestionnaireActions";
import { useMayakPopupActions } from "./hooks/useMayakPopupActions";
import { useMayakSessionActions } from "./hooks/useMayakSessionActions";
import { useMayakBufferActions } from "./hooks/useMayakBufferActions";
import { useMayakTrainerControlActions } from "./hooks/useMayakTrainerControlActions";
import { useMayakTypeSwitcherActions } from "./hooks/useMayakTypeSwitcherActions";
import { useMayakPageActions } from "./hooks/useMayakPageActions";
import { useMayakModalActions } from "./hooks/useMayakModalActions";
import { useMayakTaskManager } from "./hooks/useMayakTaskManager";
import { useMayakAccessGate } from "./hooks/useMayakAccessGate";
import { useMayakRuntimeData } from "./hooks/useMayakRuntimeData";
import { useMayakPromptActions } from "./hooks/useMayakPromptActions";
import { useMayakCompletionActions } from "./hooks/useMayakCompletionActions";
import { useMayakTaskExecutionActions } from "./hooks/useMayakTaskExecutionActions";
import { useMayakPopupState } from "./hooks/useMayakPopupState";
import { useMayakTypeUiState } from "./hooks/useMayakTypeUiState";

const TRAINER_PREFIX = "trainer_v2"; // Уникальный префикс для этого тренажера
const PREVIEW_WIDTH_MIN = 320;
const PREVIEW_WIDTH_MAX = 560;
const PREVIEW_WIDTH_DEFAULT = 520;
const MAX_SESSION_SUBMISSION_TEXT_LENGTH = 10000;

const QWEN_EVALUATION_LIMIT = 20;
const getStorageKey = (key) => `${TRAINER_PREFIX}_${key}`;
const isIntroTask = (index) => index % 100 < 3;
const isRoleSelectionTask = (task) => {
    const taskNumber = parseInt(task?.number, 10);
    const sectionStart = Number.isFinite(task?._sectionStart) ? task._sectionStart : null;
    return Number.isFinite(taskNumber) && Number.isFinite(sectionStart) && taskNumber === sectionStart;
};
const formatTaskTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};
const QWEN_ZONE_META = {
    green: {
        blockClass: "!bg-green-50 border border-green-200",
    },
    yellow: {
        blockClass: "!bg-yellow-50 border border-yellow-200",
    },
    red: {
        blockClass: "!bg-red-50 border border-red-300",
    },
    default: {
        blockClass: "!bg-blue-50 border border-blue-200",
    },
};

const getQwenZoneMeta = (zone) => QWEN_ZONE_META[zone] || QWEN_ZONE_META.default;
const QWEN_MASCOT_POOLS = {
    green: [{ animatedSrc: "/mascot-good-transparent-anim-smooth.webp" }, { animatedSrc: "/mascot-good-2-transparent-anim.webp" }, { animatedSrc: "/mascot-good-3-transparent-anim.webp" }],
    yellow: [{ animatedSrc: "/mascot-neutral-1-transparent-anim.webp" }, { animatedSrc: "/mascot-neutral-2-transparent-anim.webp" }, { animatedSrc: "/mascot-neutral-3-transparent-anim.webp" }],
    red: [{ animatedSrc: "/mascot-bad-transparent-anim.webp" }, { animatedSrc: "/mascot-bad-2-transparent-anim.webp" }, { animatedSrc: "/mascot-bad-3-transparent-anim.webp", hideAfterMs: 5980 }],
};
const getRandomQwenMascotAsset = (zone) => {
    const pool = QWEN_MASCOT_POOLS[zone];
    if (!Array.isArray(pool) || pool.length === 0) {
        return null;
    }

    const selectedAsset = pool[Math.floor(Math.random() * pool.length)];
    return selectedAsset ? { ...selectedAsset } : null;
};
const QWEN_UNAVAILABLE_MASCOT_ASSET = { animatedSrc: "/mascot-bad-3-transparent-anim.webp", hideAfterMs: 5980 };
const QWEN_MASCOT_ASSET_PRELOAD_LIST = Array.from(
    new Set([
        QWEN_UNAVAILABLE_MASCOT_ASSET.animatedSrc,
        ...Object.values(QWEN_MASCOT_POOLS)
            .flat()
            .map((asset) => asset.animatedSrc)
            .filter(Boolean),
    ])
);
const formatFieldList = (labels) => (Array.isArray(labels) ? labels.filter(Boolean).join(", ") : "");
const getQwenScoreMeta = (greenCount, totalFields = 7) => {
    const safeGreenCount = Number.isFinite(greenCount) ? greenCount : 0;
    const safeTotalFields = Number.isFinite(totalFields) && totalFields > 0 ? totalFields : 7;

    if (safeGreenCount >= 6) {
        return {
            text: `${safeGreenCount}/${safeTotalFields}`,
            textClass: "text-[var(--color-green-peace)]",
        };
    }

    if (safeGreenCount >= 3) {
        return {
            text: `${safeGreenCount}/${safeTotalFields}`,
            textClass: "text-yellow-700",
        };
    }

    return {
        text: `${safeGreenCount}/${safeTotalFields}`,
        textClass: "text-[var(--color-red)]",
    };
};
const buildQwenTaskContext = ({ taskTextData }) => ({
    description: taskTextData?.description || "",
    task: taskTextData?.task || "",
});

const AdminIconComponent = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <path d="M12 11.13a3 3 0 1 0-3.87 3.87"></path>
    </svg>
);

const AdminIcon = memo(AdminIconComponent);

export default function TrainerPage({ goTo }) {
    const [savedField, setSavedField] = useState(null);

    const isMobile = useMediaQuery("(max-width: 1023px)");
    const previewResizeStateRef = useRef(null);
    const previewResizeCleanupRef = useRef(null);

    const [taskInputValue, setTaskInputValue] = useState("");
    const debounceTimeoutRef = useRef(null);
    const [isPreviewResizing, setIsPreviewResizing] = useState(false);
    const [previewWidth, setPreviewWidth] = useState(() => {
        if (typeof window === "undefined") return PREVIEW_WIDTH_DEFAULT;
        const raw = window.localStorage.getItem(getStorageKey("previewWidth"));
        const parsed = parseInt(raw || "", 10);
        return Number.isFinite(parsed) ? parsed : PREVIEW_WIDTH_DEFAULT;
    });

    const [hasCompletedSecondQuestionnaire, setHasCompletedSecondQuestionnaire] = useState(localStorage.getItem(getStorageKey("hasCompletedSecondQuestionnaire")) === "true");
    const [selectedRole, setSelectedRole] = useState(localStorage.getItem(getStorageKey("userRole")) || null);
    const [taskVersion, setTaskVersion] = useState(localStorage.getItem(getStorageKey("taskVersion")) || "v2");
    const [questionnaireSettings, setQuestionnaireSettings] = useState({ introQuestionnaireUrl: "", completionSurveyUrl: "" });

    const [rankingDelta5, setRankingDelta5] = useState(() => {
        try {
            const raw = localStorage.getItem("trainer_v2_rankingTestResults");
            if (raw) {
                const data = JSON.parse(raw);
                return data?.level5?.delta ?? null;
            }
        } catch {}
        return null;
    });

    useEffect(() => {
        localStorage.setItem(getStorageKey("taskVersion"), taskVersion);
    }, [taskVersion]);
    useEffect(() => {
        let isMounted = true;
        const loadQuestionnaireSettings = async () => {
            try {
                const res = await fetch("/api/mayak/settings", { cache: "no-store" });
                const json = await res.json();
                if (!isMounted || !json.success) return;
                setQuestionnaireSettings({
                    introQuestionnaireUrl: json.data?.questionnaires?.introQuestionnaireUrl || "",
                    completionSurveyUrl: json.data?.questionnaires?.completionSurveyUrl || "",
                });
            } catch (error) {
                console.error("Failed to load MAYAK questionnaire settings:", error);
            }
        };
        loadQuestionnaireSettings();
        return () => {
            isMounted = false;
        };
    }, []);
    const {
        confirmationConfig,
        currentTaskData,
        setConfirmationConfig,
        setCurrentTaskData,
        setShowCompletionPopup,
        setShowConfirmation,
        setShowRolePopup,
        showCompletionPopup,
        showConfirmation,
        showRolePopup,
    } = useMayakPopupState();

    const {
        showFirstQuestionnaire,
        setShowFirstQuestionnaire,
        showSecondQuestionnaire,
        setShowSecondQuestionnaire,
        showThirdQuestionnaire,
        setShowThirdQuestionnaire,
        hasCompletedQuestionnaire,
        setHasCompletedQuestionnaire,
        telegramLink,
        setTelegramLink,
        telegramLoading,
        setTelegramLoading,
        completionTestingDone,
        setCompletionTestingDone,
        completionSurveyDone,
        setCompletionSurveyDone,
        showSessionCompletionPopup,
        setShowSessionCompletionPopup,
        showRankingTestPopup,
        setShowRankingTestPopup,
        rankingForceRetake,
        setRankingForceRetake,
    } = useMayakCompletionUiState();

    const [levels, setLevels] = useState({
        level1: "",
        level2: "",
        level3: "",
        level4: "",
        level5: "",
    });

    const [showLevelsInput, setShowLevelsInput] = useState(false);

    const [completedTasks, setCompletedTasks] = useState({});
    const [sessionRuntimeState, setSessionRuntimeState] = useState(null);
    const [sessionRuntimeError, setSessionRuntimeError] = useState("");
    const [sessionUploadError, setSessionUploadError] = useState("");
    const [sessionUploadLoading, setSessionUploadLoading] = useState(false);
    const [inspectorResolveLoading, setInspectorResolveLoading] = useState(false);
    const [inspectorResolveError, setInspectorResolveError] = useState("");
    const [openedInspectorReviewId, setOpenedInspectorReviewId] = useState("");
    const [materialDownloadNotice, setMaterialDownloadNotice] = useState("");


    const [type, setType] = useState("text");
    const [userType, setUserType] = useState("teacher");
    const [who, setWho] = useState("im");
    const [instructionModal, setInstructionModal] = useState(null);
    const [previewMode, setPreviewMode] = useState(null);
    const [previewDismissedTaskKey, setPreviewDismissedTaskKey] = useState("");

    const {
        isAdmin,
        isTokenValid,
        tokenTaskRange,
        tokenSectionId,
        sessionStartTime,
    } = useMayakAccessGate({
        getStorageKey,
        goTo,
    });

    const {
        tasks,
        currentTask,
        currentTaskIndex,
        isLoading,
        error,
        setError,
        timerState,
        startTimer,
        stopTimer,
        goToTask,
        nextTask,
        prevTask,
        instructionFileUrl,
        taskFileUrl,
        mapFileUrl,
        sourceUrl,
        tasksTexts,
        isCurrentTaskAllowed,
        allowedMinIndex,
        allowedMaxIndex,
    } = useMayakTaskManager({
        userType,
        who,
        taskVersion,
        isTokenValid,
        tokenTaskRange, // Передаем в хук
        tokenSectionId, // Slug папки раздела
        getStorageKey,
    });

    // Автозавершение вводного задания (без таймера, без попапа завершения)
    const autoCompleteIntroTask = useCallback(async () => {
        const taskNumber = currentTask?.number?.toString();
        const taskName = currentTask?.name || `Задание ${currentTaskIndex + 1}`;
        const taskTextData = taskNumber ? tasksTexts.find((t) => t.number === taskNumber) : null;

        // Записываем в лог с нулевым временем
        const logEntry = {
            number: taskNumber || String(currentTaskIndex + 1),
            title: taskName,
            taskTitle: currentTask?.title || "",
            contentType: currentTask?.contentType || "",
            description: taskTextData?.description || "",
            taskText: taskTextData?.task || "",
            time: "00:00",
            mayak: { m: "", a: "", y: "", k: "", o1: "", k2: "", o2: "" },
            finalPrompt: "(вводное задание)",
        };
        const currentLog = JSON.parse(localStorage.getItem(getStorageKey("session_tasks_log")) || "[]");
        const filteredLog = currentLog.filter((item) => item.number && String(item.number) !== String(logEntry.number));
        localStorage.setItem(getStorageKey("session_tasks_log"), JSON.stringify([...filteredLog, logEntry]));

        // Сохраняем на сервер
        try {
            await saveMayakTaskAttempt({
                taskName,
                minutes: 0,
                currentTaskIndex,
                type,
                userType,
                who,
                taskElapsedTime: 0,
                sectionId: tokenSectionId,
            });
        } catch (err) {
            console.error("Error saving intro task:", err);
        }

        // Останавливаем таймер если был запущен
        if (timerState.isRunning) {
            stopTimer();
        }
    }, [currentTask, currentTaskIndex, tasksTexts, type, userType, who, timerState.isRunning, stopTimer]);


    useEffect(() => {
        if (currentTask) {
            setShowLevelsInput(currentTask.toolName1 === "Пройти Тестирование");
        } else {
            setShowLevelsInput(false);
        }
    }, [currentTask]);

    useEffect(() => {
        // Синхронизируем поле ввода: с токеном — номер задания, без — порядковый номер
        if (tasks.length > 0 && tasks[currentTaskIndex]) {
            if (tokenTaskRange) {
                setTaskInputValue(tasks[currentTaskIndex].number?.toString() || (currentTaskIndex + 1).toString());
            } else {
                setTaskInputValue((currentTaskIndex + 1).toString());
            }
        }
    }, [currentTaskIndex, tasks, tokenTaskRange]);

    const [fields, setFields] = useState(createEmptyMayakFields);
    const [prompt, setPrompt] = useState("");
    const [isCopied, setIsCopied] = useState(false);
    const [buffer, setBuffer] = useState({});
    const [showBuffer, setShowBuffer] = useState(false);
    const [currentField, setCurrentField] = useState(null);
    const {
        qwenResponse,
        qwenLoading,
        qwenZone,
        qwenStrongFields,
        qwenWeakFields,
        qwenGreenCount,
        qwenTotalFields,
        qwenChecksRemaining,
        showMascotVideo,
        activeQwenMascotAsset,
        isPromptCopyAwaitingEvaluation,
        mascotPlaybackKey,
        evaluationLimit,
        syncQwenEvaluationQuota,
        clearQwenState,
        resetQwenSessionState,
        createPromptWithEvaluation,
    } = useMayakQwenEvaluation({
        getStorageKey,
        buildPromptDraft: () => buildPromptDraftRef.current?.(),
        currentTaskIndex,
        isIntroTask,
    });

    const buildPromptDraftRef = useRef(null);
    const materialDownloadNoticeTimeoutRef = useRef(null);
    const resolveTaskIndexFromInput = useCallback(
        (rawValue) => {
            const inputNum = parseInt(String(rawValue).trim(), 10);
            if (isNaN(inputNum)) {
                return -1;
            }

            if (tokenTaskRange) {
                const matchedIndex = tasks.findIndex((t) => parseInt(String(t?.number || "").trim(), 10) === inputNum);
                if (matchedIndex !== -1) {
                    return matchedIndex;
                }
            }

            const fallbackIndex = inputNum - 1;
            if (fallbackIndex >= 0 && fallbackIndex < tasks.length) {
                return fallbackIndex;
            }

            return -1;
        },
        [tasks, tokenTaskRange]
    );

    const savePromptToHistory = useCallback(
        (promptValue) => {
            const nextHistory = saveMayakPromptHistory({
                promptValue,
                type,
                storageKey: getStorageKey("history"),
            });
        },
        [type]
    );

    const buildPromptDraft = useCallback(() => {
        const builtDraft = buildMayakPromptDraft(fields);
        if (!builtDraft) {
            clearQwenState();
            setPrompt('Пожалуйста, заполните все поля (или используйте "кубики").');
            return null;
        }

        const { values, finalPrompt } = builtDraft;
        const taskNumber = currentTask?.number?.toString();
        const taskTextData = taskNumber ? tasksTexts.find((t) => t.number === taskNumber) : null;
        const taskContext = buildQwenTaskContext({
            taskTextData,
        });

        setPrompt(finalPrompt);
        savePromptToHistory(finalPrompt);

        return {
            values,
            finalPrompt,
            taskContext,
        };
    }, [clearQwenState, currentTask?.number, fields, savePromptToHistory, tasksTexts]);

    buildPromptDraftRef.current = buildPromptDraft;

    useEffect(() => {
        if (sessionStartTime) {
            syncQwenEvaluationQuota(sessionStartTime);
        }
    }, [sessionStartTime, syncQwenEvaluationQuota]);

    useEffect(() => {
        const loadedBuffer = loadMayakBuffer(getStorageKey("buffer"));
        setBuffer(loadedBuffer);
    }, []);

    useEffect(() => {
        // Проверяем, есть ли наш одноразовый флаг
        const isCompletionPending = localStorage.getItem(getStorageKey("sessionCompletionPending")) === "true";

        if (isCompletionPending) {
            // Если да, значит пользователь вернулся с Яндекс.Формы
            // 1. Сразу удаляем флаг, чтобы это не повторилось при перезагрузке
            localStorage.removeItem(getStorageKey("sessionCompletionPending"));
            // 2. Перенаправляем на главную страницу
            goTo("index");
        }
    }, [goTo]);

    const { activeUserId, activeUserName, activeUser, mayakData, sessionId: runtimeSessionId, tokenType, tableNumber } = useMayakRuntimeData();
    const isSessionMode = tokenType === "session" && !!runtimeSessionId;
    const effectiveTableNumber = sessionRuntimeState?.participant?.tableNumber || tableNumber;

    const yaProgress = useMemo(() => {
        if (!sessionRuntimeState?.participant?.taskStates || !tasks.length) {
            return { count: 0, target: 4, hasStar: false, percentage: 0 };
        }

        const activeSectionId = sessionRuntimeState.participant.sectionId || "";
        const match = String(activeSectionId).match(/^(\d+)-/);
        const rangeStart = match ? parseInt(match[1], 10) : 1;
        const startPos = rangeStart - 1;

        const YA_VALID_CONTENT_TYPES = new Set([
            "текст",
            "аудио",
            "изображение",
            "интерактив",
            "видео",
            "данные",
            "карта настроения"
        ]);

        let yaApprovedCount = 0;
        const YA_STAR_TARGET = 4;

        const completedTasks = sessionRuntimeState.participant.taskStates.filter(
            (ts) => ts.status === "approved" || ts.status === "expired"
        );

        completedTasks.forEach((ts) => {
            const taskIndex = Number(ts.taskIndex);
            const indexInSection = taskIndex - startPos;
            const baseNumber = indexInSection + 1;

            if (baseNumber >= 10 && baseNumber <= 50) {
                const taskObj = tasks[taskIndex];
                const contentType = String(taskObj?.contentType || "").trim().toLowerCase();

                if (YA_VALID_CONTENT_TYPES.has(contentType)) {
                    yaApprovedCount += 1;
                }
            }
        });

        return {
            count: yaApprovedCount,
            target: YA_STAR_TARGET,
            hasStar: yaApprovedCount >= YA_STAR_TARGET,
            percentage: Math.min(100, Math.round((yaApprovedCount / YA_STAR_TARGET) * 100))
        };
    }, [sessionRuntimeState?.participant?.taskStates, tasks, sessionRuntimeState?.participant?.sectionId]);

    const {
        activeTypeKey,
        handleTypeSwitch,
        isMiscAccordionOpen,
        miscCategory,
        openSubAccordionKey,
        setOpenSubAccordionKey,
    } = useMayakTypeUiState({
        mayakData,
        setType,
        type,
    });

    const { finalizeTaskExecution, toggleTaskTimer } = useMayakTaskExecutionActions({
        activeUser: activeUserId,
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
        sessionUploadRequired: isSessionMode,
    });

    const {
        handleDownloadCertificate,
        handleDownloadLogs,
        handleSaveSessionCompletion,
        handleSendToTelegram,
    } = useMayakCompletionActions({
        elapsedTime: timerState.elapsedTime,
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
    });

    const { showSwitchToWeConfirmation, showCompleteSessionConfirmation, handleSwitchToWe } = useMayakConfirmationActions({
        hasCompletedSecondQuestionnaire,
        setConfirmationConfig,
        setHasCompletedQuestionnaire,
        setShowConfirmation,
        setShowSecondQuestionnaire,
        setShowThirdQuestionnaire,
        setWho,
    });

    const { handleLevelChange, saveMeasurements, saveQuestionnaire } = useMayakQuestionnaireActions({
        getStorageKey,
        setHasCompletedSecondQuestionnaire,
        setLevels,
        timerElapsedTime: timerState.elapsedTime,
    });

    const {
        handleCloseSecondQuestionnaire,
        handleCloseThirdQuestionnaire,
        handleGetCompletionCertificate,
        handleOpenCompletionSurvey,
        handleOpenCompletionTesting,
        handleSubmitSecondQuestionnaire,
    } = useMayakPopupActions({
        completionSurveyUrl: questionnaireSettings.completionSurveyUrl,
        handleSaveSessionCompletion,
        saveQuestionnaire,
        setCompletionSurveyDone,
        setShowSecondQuestionnaire,
        setShowThirdQuestionnaire,
        setWho,
    });

    const { handleAdminResetSession, handleRoleConfirm } = useMayakSessionActions({
        activeUserId,
        autoCompleteIntroTask,
        currentTaskIndex,
        getStorageKey,
        isAdmin,
        isIntroTask,
        sessionId: runtimeSessionId,
        removeKeyCookie,
        resetQwenSessionState,
        setCompletionSurveyDone,
        setCompletionTestingDone,
        setFields,
        setHasCompletedSecondQuestionnaire,
        setPrompt,
        setRankingDelta5,
        setSelectedRole,
        setShowRolePopup,
        stopTimer,
        timerIsRunning: timerState.isRunning,
    });

    const { handleCompleteSession, handleShowRolePopup, handleToolLink1Click } = useMayakTrainerControlActions({
        autoCompleteIntroTask,
        introQuestionnaireUrl: questionnaireSettings.introQuestionnaireUrl,
        currentTask,
        currentTaskIndex,
        isIntroTask,
        setShowFirstQuestionnaire,
        setShowRankingTestPopup,
        setShowRolePopup,
        setShowThirdQuestionnaire,
    });

    const { handleCloseRolePopup, handleOpenHistory, handleSubmitSecondQuestionnaireWithFeedback } = useMayakPageActions({
        goTo,
        handleSubmitSecondQuestionnaire,
        setShowRolePopup,
    });

    const {
        handleCloseInstructionModal,
        handleCloseRankingTestPopup,
        handleCloseSessionCompletionPopup,
        handleSaveRankingTest,
        handleShowInstruction,
    } = useMayakModalActions({
        autoCompleteIntroTask,
        currentTaskIndex,
        isIntroTask,
        rankingForceRetake,
        saveRankingTest: (results) => saveMayakRankingTest({ results, setRankingDelta5 }),
        setCompletionTestingDone,
        setInstructionModal,
        setRankingForceRetake,
        setShowRankingTestPopup,
        setShowSessionCompletionPopup,
        setShowThirdQuestionnaire,
    });

    useEffect(() => {
        if (!isSessionMode || !runtimeSessionId || !activeUserId) {
            setSessionRuntimeState(null);
            setSessionRuntimeError("");
            return undefined;
        }

        let cancelled = false;

        const loadSessionRuntimeState = async () => {
            try {
                const response = await fetch(`/api/mayak/session-runtime/state?sessionId=${encodeURIComponent(runtimeSessionId)}&userId=${encodeURIComponent(activeUserId)}`, {
                    cache: "no-store",
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.success) {
                    throw new Error(payload.error || "Не удалось загрузить состояние сессии");
                }
                if (cancelled) return;

                const nextState = payload.data || null;
                setSessionRuntimeState(nextState);
                setSessionRuntimeError("");

                if (nextState?.participant?.role && nextState.participant.role !== selectedRole) {
                    setSelectedRole(nextState.participant.role);
                    localStorage.setItem(getStorageKey("userRole"), nextState.participant.role);
                }

                if (nextState?.participant?.tableNumber !== undefined && String(nextState.participant.tableNumber) !== String(tableNumber)) {
                    const currentUser = getUserFromCookies() || {};
                    await addUserToCookies(activeUserId, activeUserName, {
                        ...currentUser,
                        tableNumber: nextState.participant.tableNumber
                    });
                }

                if (nextState && nextState.sessionActive === false) {
                    await removeKeyCookie();
                    await clearUserCookie();
                    localStorage.removeItem(getStorageKey("userRole"));
                    window.location.replace("/tools/mayak-oko");
                }
            } catch (error) {
                if (!cancelled) {
                    setSessionRuntimeError(error.message || "Не удалось обновить состояние сессии");
                }
            }
        };

        loadSessionRuntimeState();
        const intervalId = window.setInterval(loadSessionRuntimeState, 5000);
        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [activeUserId, activeUserName, tableNumber, getStorageKey, isSessionMode, removeKeyCookie, runtimeSessionId, selectedRole, setSelectedRole]);

    const handleChange = useCallback(
        (code, value) => {
            setFields((prev) => ({ ...prev, [code]: value }));
        },
        [setFields]
    );

    const sessionBlockingTask = sessionRuntimeState?.blockingTask || null;
    const currentTaskState =
        Array.isArray(sessionRuntimeState?.participant?.taskStates)
            ? sessionRuntimeState.participant.taskStates.find((task) => Number(task.taskIndex) === currentTaskIndex) || null
            : null;
    const isCurrentTaskRejected = !!(sessionBlockingTask && Number(sessionBlockingTask.taskIndex) === currentTaskIndex && sessionBlockingTask.status === "rejected");
    const isCurrentTaskPendingReview = !!(sessionBlockingTask && Number(sessionBlockingTask.taskIndex) === currentTaskIndex && sessionBlockingTask.status === "pending_review");
    const isCurrentTaskApproved = ["approved", "expired", "rework_expired"].includes(currentTaskState?.status);
    const canAccessCurrentTaskResources = timerState.isRunning || isCurrentTaskRejected || isCurrentTaskPendingReview;
    const currentTaskReviewComment = isCurrentTaskRejected ? sessionBlockingTask?.comment || "" : "";
    const inspectorQueue = Array.isArray(sessionRuntimeState?.inspectorQueue) ? sessionRuntimeState.inspectorQueue : [];
    const activeInspectorReview = inspectorQueue.find((review) => review.id === openedInspectorReviewId) || null;

    const activeMapTaskKey = canAccessCurrentTaskResources && currentTask?.number && mapFileUrl ? `${currentTask.number}:${mapFileUrl}` : "";
    const previewFileUrl = previewMode === "instruction" ? instructionFileUrl : previewMode === "map" ? mapFileUrl : "";
    const previewTitle =
        previewMode === "instruction"
            ? `Инструкция №${currentTask?.number || currentTaskIndex + 1}`
            : `Карта №${currentTask?.number || currentTaskIndex + 1}`;
    const isPreviewOpen = !!(previewMode && previewFileUrl && !isMobile);

    const clampPreviewWidth = useCallback((nextWidth) => {
        if (typeof window === "undefined") {
            return Math.min(Math.max(nextWidth, PREVIEW_WIDTH_MIN), PREVIEW_WIDTH_MAX);
        }

        const viewportMax = Math.max(PREVIEW_WIDTH_MIN, Math.min(PREVIEW_WIDTH_MAX, Math.floor(window.innerWidth * 0.5)));
        return Math.min(Math.max(nextWidth, PREVIEW_WIDTH_MIN), viewportMax);
    }, []);

    const canMoveToTaskIndex = useCallback(
        (nextIndex) => {
            if (!isSessionMode || !sessionBlockingTask) return true;
            const blockedIndex = Number(sessionBlockingTask.taskIndex);
            if (!Number.isFinite(blockedIndex)) return true;
            if (sessionBlockingTask.status === "pending_review" || sessionBlockingTask.status === "rejected") {
                return nextIndex <= blockedIndex;
            }
            return true;
        },
        [isSessionMode, sessionBlockingTask]
    );

    useEffect(() => {
        if (!openedInspectorReviewId) return;
        const stillOpenable = inspectorQueue.some((review) => review.id === openedInspectorReviewId);
        if (!stillOpenable) {
            setOpenedInspectorReviewId("");
        }
    }, [inspectorQueue, openedInspectorReviewId]);

    useEffect(() => {
        if (!canAccessCurrentTaskResources) {
            setPreviewMode(null);
            setPreviewDismissedTaskKey("");
            return;
        }

        if (isMobile) {
            setPreviewMode(null);
            return;
        }

        if (mapFileUrl) {
            if (previewDismissedTaskKey !== activeMapTaskKey && previewMode !== "instruction") {
                setPreviewMode("map");
            }
            return;
        }

        if (previewMode === "map") {
            setPreviewMode(null);
        }
    }, [activeMapTaskKey, canAccessCurrentTaskResources, isMobile, mapFileUrl, previewDismissedTaskKey, previewMode]);

    const handleToggleMapPreview = useCallback(() => {
        if (!mapFileUrl || !canAccessCurrentTaskResources || isMobile) return;
        setPreviewMode((prev) => {
            if (prev === "map") {
                setPreviewDismissedTaskKey(activeMapTaskKey || "manual-close");
                return null;
            }

            setPreviewDismissedTaskKey("");
            return "map";
        });
    }, [activeMapTaskKey, canAccessCurrentTaskResources, isMobile, mapFileUrl]);

    const handleToggleInstructionPreview = useCallback(() => {
        if (!instructionFileUrl || !canAccessCurrentTaskResources) return;

        if (isMobile) {
            window.open(instructionFileUrl, "_blank", "noopener,noreferrer");
            return;
        }

        setPreviewMode((prev) => {
            if (prev === "instruction") {
                setPreviewDismissedTaskKey(activeMapTaskKey || "manual-close");
                return null;
            }

            setPreviewDismissedTaskKey("");
            return "instruction";
        });
    }, [activeMapTaskKey, canAccessCurrentTaskResources, instructionFileUrl, isMobile]);

    const buildSessionCompletionTaskData = useCallback(() => {
        const taskNumber = currentTask?.number?.toString();
        const taskTextData = taskNumber ? tasksTexts.find((t) => t.number === taskNumber) : null;

        if (taskTextData) {
            return {
                ...taskTextData,
                title: currentTask?.title || "",
                contentType: currentTask?.contentType || "",
            };
        }

        return {
            number: currentTask?.number || currentTaskIndex + 1,
            title: currentTask?.title || "",
            contentType: currentTask?.contentType || "",
            description: currentTask?.description || "",
            task: currentTask?.name || "",
        };
    }, [currentTask, currentTaskIndex, tasksTexts]);

    const handleSessionTaskUpload = useCallback(
        async (file, submissionText = "") => {
            const normalizedSubmissionText = String(submissionText || "").trim();
            if (!file && !normalizedSubmissionText) {
                setSessionUploadError("Нужно загрузить файл или добавить текст ответа.");
                return;
            }
            if (normalizedSubmissionText.length > MAX_SESSION_SUBMISSION_TEXT_LENGTH) {
                setSessionUploadError(`Текст ответа не должен превышать ${MAX_SESSION_SUBMISSION_TEXT_LENGTH} символов.`);
                return;
            }
            if (!runtimeSessionId || !activeUserId || !currentTaskData) {
                setSessionUploadError("Не удалось определить параметры сессионной проверки.");
                return;
            }

            setSessionUploadLoading(true);
            setSessionUploadError("");

            try {
                const formData = new FormData();
                formData.append("sessionId", runtimeSessionId);
                formData.append("userId", activeUserId);
                formData.append("taskNumber", String(currentTaskData.number || currentTask?.number || ""));
                formData.append("taskIndex", String(currentTaskIndex));
                formData.append("taskName", String(currentTask?.name || currentTaskData.title || `Задание ${currentTaskIndex + 1}`));
                formData.append("taskTitle", String(currentTaskData.title || ""));
                formData.append("contentType", String(currentTaskData.contentType || ""));
                formData.append("description", String(currentTaskData.description || ""));
                formData.append("taskText", String(currentTaskData.task || ""));
                formData.append("secondsSpent", String(timerState.readyElapsedTime ?? timerState.elapsedTime ?? 0));
                formData.append("submissionText", normalizedSubmissionText);
                if (file) {
                    formData.append("file", file);
                }

                const controller = new AbortController();
                const timeoutId = window.setTimeout(() => controller.abort(), 55000);
                let response;
                try {
                    response = await fetch("/api/mayak/session-runtime/upload", {
                        method: "POST",
                        body: formData,
                        signal: controller.signal,
                    });
                } finally {
                    window.clearTimeout(timeoutId);
                }
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.success) {
                    throw new Error(payload.error || "Не удалось отправить материал инспектору");
                }

                await finalizeTaskExecution({
                    timeWhenStopped: timerState.elapsedTime,
                });

                const refreshResponse = await fetch(`/api/mayak/session-runtime/state?sessionId=${encodeURIComponent(runtimeSessionId)}&userId=${encodeURIComponent(activeUserId)}`, {
                    cache: "no-store",
                });
                const refreshPayload = await refreshResponse.json().catch(() => ({}));
                if (refreshResponse.ok && refreshPayload.success) {
                    setSessionRuntimeState(refreshPayload.data || null);
                }

                setShowCompletionPopup(false);
            } catch (error) {
                setSessionUploadError(error.message || "Не удалось отправить материал инспектору");
            } finally {
                setSessionUploadLoading(false);
            }
        },
        [activeUserId, currentTask, currentTaskData, currentTaskIndex, finalizeTaskExecution, runtimeSessionId, tasksTexts, timerState.elapsedTime, timerState.readyElapsedTime]
    );

    const handleResolveInspectorReview = useCallback(
        async (action, comment = "") => {
            if (!activeInspectorReview || !runtimeSessionId || !activeUserId) return;

            setInspectorResolveLoading(true);
            setInspectorResolveError("");
            try {
                const response = await fetch("/api/mayak/session-runtime/review", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        sessionId: runtimeSessionId,
                        reviewId: activeInspectorReview.id,
                        inspectorUserId: activeUserId,
                        action,
                        comment,
                    }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.success) {
                    throw new Error(payload.error || "Не удалось сохранить решение инспектора");
                }

                setOpenedInspectorReviewId("");
                const refreshResponse = await fetch(`/api/mayak/session-runtime/state?sessionId=${encodeURIComponent(runtimeSessionId)}&userId=${encodeURIComponent(activeUserId)}`, {
                    cache: "no-store",
                });
                const refreshPayload = await refreshResponse.json().catch(() => ({}));
                if (refreshResponse.ok && refreshPayload.success) {
                    setSessionRuntimeState(refreshPayload.data || null);
                }
            } catch (error) {
                setInspectorResolveError(error.message || "Не удалось сохранить решение инспектора");
            } finally {
                setInspectorResolveLoading(false);
            }
        },
        [activeInspectorReview, activeUserId, runtimeSessionId]
    );

    const handleClosePreview = useCallback(() => {
        setPreviewMode(null);
        setPreviewDismissedTaskKey(activeMapTaskKey || "manual-close");
    }, [activeMapTaskKey]);

    const handleTaskFileDownloaded = useCallback(() => {
        setMaterialDownloadNotice("Доп.материал скачивается.");
        if (materialDownloadNoticeTimeoutRef.current) {
            window.clearTimeout(materialDownloadNoticeTimeoutRef.current);
        }
        materialDownloadNoticeTimeoutRef.current = window.setTimeout(() => {
            setMaterialDownloadNotice("");
            materialDownloadNoticeTimeoutRef.current = null;
        }, 2500);
    }, []);

    useEffect(() => {
        return () => {
            if (materialDownloadNoticeTimeoutRef.current) {
                window.clearTimeout(materialDownloadNoticeTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(getStorageKey("previewWidth"), String(clampPreviewWidth(previewWidth)));
    }, [clampPreviewWidth, previewWidth]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleResize = () => {
            setPreviewWidth((prev) => clampPreviewWidth(prev));
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [clampPreviewWidth]);

    const stopPreviewResize = useCallback(() => {
        previewResizeStateRef.current = null;
        if (previewResizeCleanupRef.current) {
            previewResizeCleanupRef.current();
            previewResizeCleanupRef.current = null;
        }
        setIsPreviewResizing(false);
    }, []);

    useEffect(() => () => stopPreviewResize(), [stopPreviewResize]);

    const handlePreviewResizeStart = useCallback(
        (event) => {
            if (isMobile || !isPreviewOpen) return;

            event.preventDefault();

            const previousUserSelect = document.body.style.userSelect;
            const previousCursor = document.body.style.cursor;

            previewResizeStateRef.current = {
                startX: event.clientX,
                startWidth: previewWidth,
            };
            setIsPreviewResizing(true);
            document.body.style.userSelect = "none";
            document.body.style.cursor = "col-resize";

            const handlePointerMove = (moveEvent) => {
                const state = previewResizeStateRef.current;
                if (!state) return;

                const deltaX = state.startX - moveEvent.clientX;
                setPreviewWidth(clampPreviewWidth(state.startWidth + deltaX));
            };

            const handlePointerUp = () => {
                stopPreviewResize();
            };

            previewResizeCleanupRef.current = () => {
                document.body.style.userSelect = previousUserSelect;
                document.body.style.cursor = previousCursor;
                window.removeEventListener("pointermove", handlePointerMove);
                window.removeEventListener("pointerup", handlePointerUp);
            };

            window.addEventListener("pointermove", handlePointerMove);
            window.addEventListener("pointerup", handlePointerUp, { once: true });
        },
        [clampPreviewWidth, isMobile, isPreviewOpen, previewWidth, stopPreviewResize]
    );
    const { createPrompt, handleCopy, handleRandom, handleResetFields } = useMayakPromptActions({
        buildPromptDraft,
        clearQwenState,
        mayakData,
        setFields,
        setIsCopied,
        setPrompt,
        type,
        handleChange,
    });

    const {
        handleAddToBuffer,
        handleCloseBuffer,
        handleInsertFromBuffer,
        handleShowBufferForField,
        handleUpdateBuffer,
    } = useMayakBufferActions({
        buffer,
        contentTypeOptions: mayakData.contentTypeOptions,
        currentField,
        fields,
        getStorageKey,
        handleChange,
        setBuffer,
        setCurrentField,
        setSavedField,
        setShowBuffer,
        type,
    });

    const cleanupPrompt = cleanupMayakPrompt;

    const isCreateDisabled = Object.values(fields).some((v) => !v);
    const isEvaluationBlockedForIntroTask = isIntroTask(currentTaskIndex);
    const isCopyDisabled = !prompt || isCopied || prompt.includes("Пожалуйста, заполните") || isPromptCopyAwaitingEvaluation;
    const copyDisabledReason = isPromptCopyAwaitingEvaluation ? "Дождитесь ответа нейросети" : !prompt ? "Сначала создайте промт" : prompt.includes("Пожалуйста, заполните") ? "Сначала заполните все поля" : "";
    const createWithEvaluationDisabledReason = isEvaluationBlockedForIntroTask
        ? "Оценка недоступна на первых трех заданиях каждой колоды"
        : isCreateDisabled
          ? "Сначала заполните все поля"
          : qwenChecksRemaining <= 0
            ? "Лимит оценок для этой сессии исчерпан"
            : "";
    const isCreateWithEvaluationDisabled = isCreateDisabled || isEvaluationBlockedForIntroTask || qwenLoading || qwenChecksRemaining <= 0;
    const qwenZoneMeta = getQwenZoneMeta(qwenZone);
    const qwenScoreMeta = qwenGreenCount === null ? null : getQwenScoreMeta(qwenGreenCount, qwenTotalFields);
    const shouldShowQwenMascot = !qwenLoading && activeQwenMascotAsset && showMascotVideo;

    const guardedToggleTaskTimer = async () => {
        if (!timerState.isRunning && isCurrentTaskPendingReview) {
            alert("Это задание уже отправлено инспектору. Дождитесь проверки или истечения таймера.");
            return;
        }

        if (!timerState.isRunning && isCurrentTaskRejected) {
            setCurrentTaskData(buildSessionCompletionTaskData());
            setShowCompletionPopup(true);
            return;
        }

        setSessionUploadError("");
        await toggleTaskTimer();
    };

    const guardedGoToTask = (nextIndex) => {
        if (!canMoveToTaskIndex(nextIndex)) {
            const message =
                false
                    ? "Сначала загрузите материал по завершённому заданию."
                    : sessionBlockingTask?.status === "rejected"
                    ? "Сначала исправьте текущее задание по замечанию инспектора."
                    : "Сначала дождитесь проверки текущего задания инспектором.";
            alert(message);
            return;
        }
        goToTask(nextIndex);
    };

    const trainerControlsProps = {
        who,
        taskVersion,
        currentTaskIndex,
        tasks,
        isTaskRunning: timerState.isRunning,
        taskElapsedTime: timerState.elapsedTime,
        instructionFileUrl,
        taskFileUrl,
        mapFileUrl,
        isMapPreviewOpen: previewMode === "map" && !!previewFileUrl,
        isInstructionPreviewOpen: previewMode === "instruction" && !!previewFileUrl,
        canToggleMapPreview: !!(mapFileUrl && canAccessCurrentTaskResources && !isMobile),
        sourceUrl,
        currentTask,
        isCurrentTaskAllowed,
        allowedMinIndex,
        allowedMaxIndex,
        selectedRole,
        tableNumber: effectiveTableNumber,
        rankingDelta5,
        onWhoChange: (value) => {
            // Сначала обновляем состояние, чтобы UI отреагировал
            setWho(value);
            // Затем, если выбрали "Мы" и анкета не пройдена, показываем попап
            if (value === "we" && !hasCompletedSecondQuestionnaire) {
                showSwitchToWeConfirmation();
            }
        },
        onPrevTask: () => {
            if (currentTaskIndex - 1 >= 0) {
                guardedGoToTask(currentTaskIndex - 1);
            }
        },
        onNextTask: () => {
            if (currentTaskIndex + 1 < tasks.length) {
                guardedGoToTask(currentTaskIndex + 1);
            }
        },
        taskInputValue,
        onTaskInputChange: (e) => {
            const value = e.target.value;

            // Немедленно обновляем поле ввода, чтобы ввод был плавным
            if (!/^\d*$/.test(value)) return; // Разрешаем вводить только цифры
            setTaskInputValue(value);

            // Сбрасываем предыдущий таймер
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }

            // Если поле пустое, ничего не делаем
            if (value.trim() === "") {
                return;
            }

            // Устанавливаем новый таймер
            debounceTimeoutRef.current = setTimeout(() => {
                const newIndex = resolveTaskIndexFromInput(value);

                // Если задание найдено и в пределах допустимого диапазона — переключаем
                if (newIndex >= 0 && newIndex >= allowedMinIndex && newIndex <= allowedMaxIndex && newIndex < tasks.length) {
                    guardedGoToTask(newIndex);
                }
                // Если не найдено — просто не переключаем, даём пользователю исправить
            }, 600);
        },
        onToggleTaskTimer: guardedToggleTaskTimer,
        onToggleMapPreview: handleToggleMapPreview,
        onToggleInstructionPreview: handleToggleInstructionPreview,
        onShowRolePopup: handleShowRolePopup,
        onToolLink1Click: handleToolLink1Click,
        mayakData,
        onShowInstruction: handleShowInstruction,
        isCurrentTaskIntro: isIntroTask(currentTaskIndex),
        isCurrentTaskRoleSelection: isRoleSelectionTask(currentTask),
        isTaskActionDisabled: isCurrentTaskPendingReview,
        isReworkTask: isCurrentTaskRejected,
        isCurrentTaskApproved,
        isTaskNavigationLocked: isCurrentTaskPendingReview || isCurrentTaskRejected,
        canAccessTaskResources: canAccessCurrentTaskResources,
        taskActionLabel: isCurrentTaskPendingReview ? "\u041d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435" : isCurrentTaskRejected ? "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c" : "\u041d\u0430\u0447\u0430\u0442\u044c \u0437\u0430\u0434\u0430\u043d\u0438\u0435",
        materialDownloadNotice,
        onTaskFileDownloaded: handleTaskFileDownloaded,
        yaProgress,
        isSessionMode,
    };

    const trainerFieldsBlock = (
        <Block className="!h-full flex-1 min-w-0 self-stretch">
            <form className="flex flex-col h-full justify-between">
                <div className="flex flex-col gap-[1.25rem]">
                    <div className="flex flex-col gap-[1rem]">
                        <Switcher
                            value={activeTypeKey}
                            onChange={handleTypeSwitch}
                            className="!w-full !flex-wrap">
                            {mayakData.defaultTypes.map((t) => (
                                <Switcher.Option key={t.key} value={t.key}>
                                    {t.label}
                                </Switcher.Option>
                            ))}
                        </Switcher>
                    </div>
                    <div className="flex flex-col gap-[0.5rem]">
                        <div className="flex justify-between items-center">
                            <span className="big">Цели и целевая направленность</span>
                            <Button icon type="button" onClick={handleResetFields} className="!w-auto !h-auto !p-1 !bg-transparent" title="Сбросить все поля">
                                <ResetIcon className="!text-black" />
                            </Button>
                        </div>
                        {(mayakData.fieldsList || []).slice(0, 4).map((f) => (
                            <MayakField
                                key={f.code}
                                field={f}
                                value={fields[f.code]}
                                isMobile={isMobile}
                                onChange={handleChange}
                                onShowBuffer={handleShowBufferForField}
                                onAddToBuffer={handleAddToBuffer}
                                onRandom={handleRandom}
                                savedField={savedField}
                            />
                        ))}
                    </div>
                    <div className="flex flex-col gap-[0.5rem]">
                        <span className="big">Условия реализации и параметры оформления</span>
                        {(mayakData.fieldsList || []).slice(4).map((f) => (
                            <MayakField
                                key={f.code}
                                field={f}
                                value={fields[f.code]}
                                isMobile={isMobile}
                                onChange={handleChange}
                                onShowBuffer={handleShowBufferForField}
                                onAddToBuffer={handleAddToBuffer}
                                onRandom={handleRandom}
                                savedField={savedField}
                            />
                        ))}
                    </div>
                </div>
                <div className="mt-4 flex w-full flex-col gap-2">
                    <div className="flex w-full flex-col gap-2 sm:flex-row">
                        <span className="block w-full" title={isCreateDisabled ? "Сначала заполните все поля" : ""}>
                            <Button className="blue w-full" type="button" onClick={createPrompt} disabled={isCreateDisabled || qwenLoading}>
                                Создать&nbsp;промт
                            </Button>
                        </span>
                        <span className="block w-full" title={createWithEvaluationDisabledReason}>
                            <Button className="w-full" type="button" onClick={createPromptWithEvaluation} disabled={isCreateWithEvaluationDisabled}>
                                Создать&nbsp;промт&nbsp;с&nbsp;оценкой&nbsp;({qwenChecksRemaining}/{evaluationLimit})
                            </Button>
                        </span>
                    </div>
                </div>
            </form>
        </Block>
    );

    const trainerOutputBlock = (
        <div className="flex h-full min-h-0 flex-1 min-w-0 flex-col gap-4 self-stretch">
            {!isMobile && <TrainerControls {...trainerControlsProps} />}

            {sessionRuntimeError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sessionRuntimeError}</div> : null}
            {false && currentTaskReviewComment ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <div className="mb-1 font-semibold">Задание требует исправлений</div>
                    <div>{currentTaskReviewComment}</div>
                </div>
            ) : null}
            {(isCurrentTaskPendingReview || isCurrentTaskRejected) ? (
                <SessionReviewStatusBanner
                    taskNumber={currentTask?.number || currentTaskIndex + 1}
                    status={sessionBlockingTask?.status}
                    comment={currentTaskReviewComment}
                    expiresAt={sessionBlockingTask?.expiresAt}
                    remainingSeconds={sessionBlockingTask?.remainingSeconds}
                    durationSeconds={sessionBlockingTask?.durationSeconds}
                />
            ) : null}

            <Block className="flex min-h-0 flex-grow flex-col !bg-slate-50">
                <h6 className="text-black mb-2">Ваш промт</h6>
                <div className="flex-grow overflow-y-auto">
                    <p className="text-gray-600">{prompt || 'Заполните поля и нажмите "Создать промт"'}</p>
                </div>
            </Block>

            {(qwenLoading || qwenResponse) && (
                <Block className={`${qwenLoading ? QWEN_ZONE_META.default.blockClass : qwenZoneMeta.blockClass} relative flex flex-col`}>
                    {!qwenLoading && qwenScoreMeta && (
                        <div className={`absolute right-4 top-4 text-lg font-bold sm:text-xl ${qwenScoreMeta.textClass}`}>
                            {qwenScoreMeta.text}
                        </div>
                    )}
                    <h6 className="mb-2 text-black">Оценка от нейросети</h6>
                    <div className={`flex ${shouldShowQwenMascot ? "flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" : "flex-col"}`}>
                        <div className="flex-1">
                            {qwenLoading ? (
                                <p className="text-gray-500 animate-pulse">Анализирую промпт...</p>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <p className="text-gray-700">{qwenResponse}</p>
                                    {qwenStrongFields.length > 0 && (
                                        <p className="text-sm text-gray-700">
                                            <span className="font-semibold text-black">Сильные поля:</span> {formatFieldList(qwenStrongFields)}
                                        </p>
                                    )}
                                    {qwenWeakFields.length > 0 && (
                                        <p className="text-sm text-gray-700">
                                            <span className="font-semibold text-black">Слабые поля:</span> {formatFieldList(qwenWeakFields)}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                        {shouldShowQwenMascot && (
                            <div className="flex shrink-0 flex-col items-center self-center">
                                <div className="h-[96px] w-[96px] sm:h-[112px] sm:w-[112px]">
                                    <img key={mascotPlaybackKey} src={activeQwenMascotAsset.animatedSrc} alt="" aria-hidden="true" decoding="sync" fetchPriority="high" className="h-full w-full object-contain" />
                                </div>
                            </div>
                        )}
                    </div>
                </Block>
            )}
            <div className="mt-auto flex flex-col gap-[1rem]">
                <div className="flex flex-col gap-[0.5rem]">
                    <Button onClick={() => handleCopy(prompt)} disabled={isCopyDisabled} title={copyDisabledReason}>
                        {isCopied ? "Скопировано!" : "Скопировать"}
                    </Button>
                    <MayakServicesPanel
                        defaultLinks={mayakData.defaultLinks}
                        isMiscAccordionOpen={isMiscAccordionOpen}
                        miscCategory={miscCategory}
                        onOpenInstruction={handleShowInstruction}
                        openSubAccordionKey={openSubAccordionKey}
                        setOpenSubAccordionKey={setOpenSubAccordionKey}
                        type={type}
                        allowWrap={isPreviewOpen}
                    />
                </div>
            </div>
        </div>
    );

    const previewPanel = isPreviewOpen && previewFileUrl && !isMobile && (
        <div className="relative h-full min-h-[420px] shrink-0 self-stretch pl-3" style={{ width: `${previewWidth}px` }}>
            <div
                className="absolute left-0 top-1/2 z-10 hidden h-24 w-4 -translate-x-1/2 -translate-y-1/2 cursor-col-resize items-center justify-center lg:flex"
                onPointerDown={handlePreviewResizeStart}
                title="Изменить ширину панели"
                aria-label="Изменить ширину панели"
                role="separator"
                aria-orientation="vertical">
                <span className={`h-14 w-[3px] rounded-full transition-colors ${isPreviewResizing ? "bg-slate-500" : "bg-slate-300"}`} />
            </div>
            <InstructionPreviewPanel previewFileUrl={previewFileUrl} previewTitle={previewTitle} onClose={handleClosePreview} />
        </div>
    );

    return (
        <>
            <Header>
                <Header.Heading>МАЯК ОКО</Header.Heading>
                {effectiveTableNumber ? (
                    <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                        Стол №{effectiveTableNumber}
                    </div>
                ) : null}
                {selectedRole && (
                    <div style={{ position: "relative" }} className="role-tooltip-wrap">
                        <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 whitespace-nowrap cursor-default">
                            {selectedRole}
                        </div>
                        <div
                            className="role-tooltip"
                            style={{
                                position: "absolute",
                                left: 0,
                                top: "100%",
                                marginTop: "8px",
                                width: "380px",
                                padding: "12px",
                                borderRadius: "12px",
                                border: "1px solid #e5e7eb",
                                background: "#fff",
                                color: "#111",
                                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                                opacity: 0,
                                visibility: "hidden",
                                transition: "opacity 0.2s, visibility 0.2s",
                                zIndex: 50,
                                pointerEvents: "none",
                            }}>
                            <p style={{ fontSize: "12px", color: "#666", lineHeight: "1.5" }}>{ROLE_DESCRIPTIONS[selectedRole] || ""}</p>
                        </div>
                        <style>{`.role-tooltip-wrap:hover .role-tooltip { opacity: 1 !important; visibility: visible !important; }`}</style>
                    </div>
                )}
                <div className="flex items-center gap-2 ml-auto">
                    <Button
                        icon
                        disabled={timerState.isRunning}
                        className={timerState.isRunning ? "!opacity-40 !cursor-not-allowed !pointer-events-none" : ""}
                        onClick={handleOpenHistory}
                        title={timerState.isRunning ? "Недоступно во время выполнения задания" : "История запросов"}>
                        <TimeIcon />
                    </Button>
                    {isAdmin && (
                        <Button
                            icon
                            disabled={timerState.isRunning}
                            className={timerState.isRunning ? "!opacity-40 !cursor-not-allowed !pointer-events-none" : ""}
                            onClick={handleAdminResetSession}
                            title={timerState.isRunning ? "Недоступно во время выполнения задания" : "Сбросить сессию (админ)"}>
                            <ResetIcon />
                        </Button>
                    )}
                    {isSessionMode && (
                        <Button
                            inverted
                            className="!bg-(--color-red-noise) !text-(--color-red) !py-1.5 !px-3 !text-sm whitespace-nowrap"
                            onClick={handleCompleteSession}>
                            Завершить&nbsp;сессию
                        </Button>
                    )}
                </div>
            </Header>

            {showSecondQuestionnaire && (
                <SecondQuestionnairePopup
                    onClose={handleCloseSecondQuestionnaire}
                    onSubmit={handleSubmitSecondQuestionnaireWithFeedback}
                />
            )}

            {showThirdQuestionnaire && (
                <ThirdQuestionnairePopup
                    onClose={handleCloseThirdQuestionnaire}
                    testingDone={completionTestingDone}
                    surveyDone={completionSurveyDone}
                    certificateLoading={telegramLoading}
                    onOpenTesting={handleOpenCompletionTesting}
                    onOpenSurvey={handleOpenCompletionSurvey}
                    onGetCertificate={handleGetCompletionCertificate}
                />
            )}

            <div className="hero relative">
                {isMobile && (
                    <div className="col-span-12 mb-4">
                        <TrainerControls {...trainerControlsProps} />
                    </div>
                )}
                {!isMobile && isPreviewOpen ? (
                    <div className="col-span-12 hidden h-full min-h-0 lg:flex gap-4 items-stretch">
                        {trainerFieldsBlock}
                        {trainerOutputBlock}
                        {previewPanel}
                    </div>
                ) : (
                    <>
                        <div className={`col-span-12 ${isPreviewOpen ? "lg:col-span-4" : "lg:col-span-6"} !h-full`}>{trainerFieldsBlock}</div>
                        <div className={`col-span-12 ${isPreviewOpen ? "lg:col-span-4" : "lg:col-span-6"} h-full`}>{trainerOutputBlock}</div>
                        {previewPanel && <div className="col-span-12 lg:col-span-4 h-full min-h-[420px]">{previewPanel}</div>}
                    </>
                )}
                {isPreviewResizing && <div className="fixed inset-0 z-40 cursor-col-resize" aria-hidden="true" />}
                {showBuffer && <Buffer onClose={handleCloseBuffer} onInsert={handleInsertFromBuffer} onUpdate={handleUpdateBuffer} buffer={buffer} currentField={currentField} />}
                <InstructionImageModal instructionModal={instructionModal} onClose={handleCloseInstructionModal} />
            </div>
            {showCompletionPopup &&
                (isSessionMode && !isIntroTask(currentTaskIndex) ? (
                    <SessionTaskReviewPopup
                        taskData={currentTaskData}
                        elapsedTime={formatTaskTime(timerState.readyElapsedTime ?? timerState.elapsedTime ?? 0)}
                        rejectedComment={currentTaskReviewComment}
                        uploadLoading={sessionUploadLoading}
                        uploadError={sessionUploadError}
                        onClose={() => {
                            setShowCompletionPopup(false);
                            setSessionUploadError("");
                        }}
                        onSubmit={handleSessionTaskUpload}
                    />
                ) : (
                    <TaskCompletionPopup
                        taskData={currentTaskData}
                        elapsedTime={timerState.readyElapsedTime}
                        onClose={() => {
                            setShowCompletionPopup(false);
                        }}
                    />
                ))}
            {showSessionCompletionPopup && <SessionCompletionPopup onClose={handleCloseSessionCompletionPopup} onSave={handleSaveSessionCompletion} />}
            {showRolePopup && <RoleSelectionPopup onClose={handleCloseRolePopup} onConfirm={handleRoleConfirm} />}
            {showRankingTestPopup && (
                <RankingTestPopup
                    onClose={handleCloseRankingTestPopup}
                    forceRetake={rankingForceRetake}
                    onSave={handleSaveRankingTest}
                />
            )}
            {inspectorQueue.length > 0 ? (
                <InspectorReviewQueue
                    reviews={inspectorQueue}
                    onOpen={(review) => {
                        setOpenedInspectorReviewId(review.id);
                        setInspectorResolveError("");
                    }}
                />
            ) : null}
            {activeInspectorReview ? (
                <InspectorReviewModal
                    review={activeInspectorReview}
                    loading={inspectorResolveLoading}
                    error={inspectorResolveError}
                    onApprove={() => handleResolveInspectorReview("approve")}
                    onReject={(comment) => handleResolveInspectorReview("reject", comment)}
                    onClose={() => {
                        setOpenedInspectorReviewId("");
                        setInspectorResolveError("");
                    }}
                />
            ) : null}
        </>
    );
}


