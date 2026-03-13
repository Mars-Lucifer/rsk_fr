import { useState, useEffect, useRef, memo, useCallback } from "react";
import Header from "@/components/layout/Header";
import Buffer from "./addons/popup";
import RankingTestPopup from "./addons/RankingTestPopup";
import MayakServicesPanel from "./MayakServicesPanel";
import InstructionImageModal from "./InstructionImageModal";
import MayakInspectorPanel from "./MayakInspectorPanel";
import MayakInspectorWidget from "./MayakInspectorWidget";
import MayakInspectorNotificationStack from "./MayakInspectorNotificationStack";
import MayakTaskTimelinePanel from "./MayakTaskTimelinePanel";
import { MayakInspectorReviewPopup } from "./MayakTaskArtifactPopups";
import { MayakField, TrainerControls } from "./TrainerUiSections";
import { RoleSelectionPopup, ConfirmationPopup, FirstQuestionnairePopup, SecondQuestionnairePopup, ThirdQuestionnairePopup, SessionCompletionPopup, TaskCompletionPopup } from "./TrainerPopups";

import InfoIcon from "@/assets/general/info.svg";
import CopyIcon from "@/assets/general/copy.svg";
import TimeIcon from "@/assets/general/time.svg";
import Plusicon from "@/assets/general/plus.svg";
import SettsIcon from "@/assets/general/setts.svg";
import RandomIcon from "@/assets/general/random.svg";
import ResetIcon from "@/assets/general/ResetIcon.svg";
import CloseIcon from "@/assets/general/close.svg";

// Р”РѕР±Р°РІР»СЏРµРј getUserFromCookies
import { removeKeyCookie } from "./actions";
// Р”РѕР±Р°РІР»СЏРµРј СЌС‚Рё РґРІРµ СЃС‚СЂРѕРєРё РґР»СЏ СЂР°Р±РѕС‚С‹ СЃРµСЂС‚РёС„РёРєР°С‚Р°
import { useMediaQuery } from "@/hooks/useMediaQuery";
import CourseIcon from "@/assets/nav/course.svg";
import Button from "@/components/ui/Button";
import Switcher from "@/components/ui/Switcher";

import Block from "@/components/features/public/Block";

import { saveMayakTaskAttempt } from "./utils/saveMayakTaskAttempt";
import { loadMayakBuffer, saveMayakBuffer, appendMayakBufferValue, ensureMayakBufferOptions } from "./utils/mayakBufferStorage";
import { buildMayakPromptDraft, cleanupMayakPrompt } from "./utils/buildMayakPromptDraft";
import { saveMayakPromptHistory } from "./utils/saveMayakPromptHistory";
import { readMayakTaskLog, syncMayakTaskLogFromStates } from "./utils/mayakTaskLogStorage";
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
import { useMayakInspectorSession } from "./hooks/useMayakInspectorSession";

const TRAINER_PREFIX = "trainer_v2"; // РЈРЅРёРєР°Р»СЊРЅС‹Р№ РїСЂРµС„РёРєСЃ РґР»СЏ СЌС‚РѕРіРѕ С‚СЂРµРЅР°Р¶РµСЂР°

const QWEN_EVALUATION_LIMIT = 20;
const getStorageKey = (key) => `${TRAINER_PREFIX}_${key}`;
const isIntroTask = (index) => index % 100 < 3;
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

    const [taskInputValue, setTaskInputValue] = useState("");
    const debounceTimeoutRef = useRef(null);

    const [hasCompletedSecondQuestionnaire, setHasCompletedSecondQuestionnaire] = useState(localStorage.getItem(getStorageKey("hasCompletedSecondQuestionnaire")) === "true");
    const [selectedRole, setSelectedRole] = useState(localStorage.getItem(getStorageKey("userRole")) || null);
    const [taskVersion, setTaskVersion] = useState(localStorage.getItem(getStorageKey("taskVersion")) || "v2");

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


    const [type, setType] = useState("text");
    const [userType, setUserType] = useState("teacher");
    const [who, setWho] = useState("im");
    const [instructionModal, setInstructionModal] = useState(null);

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
        tokenTaskRange, // РџРµСЂРµРґР°РµРј РІ С…СѓРє
        tokenSectionId, // Slug РїР°РїРєРё СЂР°Р·РґРµР»Р°
        getStorageKey,
    });

    // РђРІС‚РѕР·Р°РІРµСЂС€РµРЅРёРµ РІРІРѕРґРЅРѕРіРѕ Р·Р°РґР°РЅРёСЏ (Р±РµР· С‚Р°Р№РјРµСЂР°, Р±РµР· РїРѕРїР°РїР° Р·Р°РІРµСЂС€РµРЅРёСЏ)
    const autoCompleteIntroTask = useCallback(async () => {
        const taskNumber = currentTask?.number?.toString();
        const taskName = currentTask?.name || `Задание ${currentTaskIndex + 1}`;
        const taskTextData = taskNumber ? tasksTexts.find((t) => t.number === taskNumber) : null;

        // Р—Р°РїРёСЃС‹РІР°РµРј РІ Р»РѕРі СЃ РЅСѓР»РµРІС‹Рј РІСЂРµРјРµРЅРµРј
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

        // РЎРѕС…СЂР°РЅСЏРµРј РЅР° СЃРµСЂРІРµСЂ
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

        // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј С‚Р°Р№РјРµСЂ РµСЃР»Рё Р±С‹Р» Р·Р°РїСѓС‰РµРЅ
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
        // РЎРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµРј РїРѕР»Рµ РІРІРѕРґР°: СЃ С‚РѕРєРµРЅРѕРј вЂ” РЅРѕРјРµСЂ Р·Р°РґР°РЅРёСЏ, Р±РµР· вЂ” РїРѕСЂСЏРґРєРѕРІС‹Р№ РЅРѕРјРµСЂ
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
    const savePromptToHistory = useCallback(
        (promptValue, mayakValues) => {
            saveMayakPromptHistory({
                promptValue,
                type,
                storageKey: getStorageKey("history"),
                mayakValues,
            });
        },
        [type]
    );

    const buildPromptDraft = useCallback(() => {
        const builtDraft = buildMayakPromptDraft(fields);
        if (!builtDraft) {
            clearQwenState();
            setPrompt('\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0437\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u0432\u0441\u0435 \u043f\u043e\u043b\u044f (\u0438\u043b\u0438 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 "\u043a\u0443\u0431\u0438\u043a\u0438").');
            return null;
        }

        const { values, finalPrompt } = builtDraft;
        const taskNumber = currentTask?.number?.toString();
        const taskTextData = taskNumber ? tasksTexts.find((t) => t.number === taskNumber) : null;
        const taskContext = buildQwenTaskContext({
            taskTextData,
        });

        setPrompt(finalPrompt);
        savePromptToHistory(finalPrompt, values);

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
        // РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё РЅР°С€ РѕРґРЅРѕСЂР°Р·РѕРІС‹Р№ С„Р»Р°Рі
        const isCompletionPending = localStorage.getItem(getStorageKey("sessionCompletionPending")) === "true";

        if (isCompletionPending) {
            // Р•СЃР»Рё РґР°, Р·РЅР°С‡РёС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РІРµСЂРЅСѓР»СЃСЏ СЃ РЇРЅРґРµРєСЃ.Р¤РѕСЂРјС‹
            // 1. РЎСЂР°Р·Сѓ СѓРґР°Р»СЏРµРј С„Р»Р°Рі, С‡С‚РѕР±С‹ СЌС‚Рѕ РЅРµ РїРѕРІС‚РѕСЂРёР»РѕСЃСЊ РїСЂРё РїРµСЂРµР·Р°РіСЂСѓР·РєРµ
            localStorage.removeItem(getStorageKey("sessionCompletionPending"));
            // 2. РџРµСЂРµРЅР°РїСЂР°РІР»СЏРµРј РЅР° РіР»Р°РІРЅСѓСЋ СЃС‚СЂР°РЅРёС†Сѓ
            goTo("index");
        }
    }, [goTo]);

    const { activeUser, mayakData } = useMayakRuntimeData();

    const { currentTaskState, error: sessionError, fetchTaskDetails, reviewTask, sessionSnapshot, submitTaskForReview, syncRole, notifyTaskStarted, token } = useMayakInspectorSession({
        activeUser,
        currentTask,
        tokenSectionId,
        setSelectedRole,
    });
    const isInspectorUser = Boolean(sessionSnapshot?.inspectorView);
    const pendingInspectionCount = sessionSnapshot?.inspectorView?.pendingTasks?.length || 0;
    const [isInspectorWidgetOpen, setIsInspectorWidgetOpen] = useState(() => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem(getStorageKey("inspectorWidgetOpen")) === "true";
    });
    const [isTaskTimelineOpen, setIsTaskTimelineOpen] = useState(false);
    const [taskTimelineEntries, setTaskTimelineEntries] = useState([]);
    const [taskCompletionMode, setTaskCompletionMode] = useState("summary");
    const [isUploadingArtifact, setIsUploadingArtifact] = useState(false);
    const uploadPopupResolverRef = useRef(null);
    const [reviewPopupTaskKey, setReviewPopupTaskKey] = useState("");
    const [reviewPopupData, setReviewPopupData] = useState(null);
    const [reviewPopupLoading, setReviewPopupLoading] = useState(false);



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

    const { toggleTaskTimer } = useMayakTaskExecutionActions({
        activeUser,
        autoCompleteIntroTask,
        completedTasks,
        currentTask,
        currentTaskIndex,
        fields,
        formatTaskTime,
        getStorageKey,
        isIntroTask,
        onTaskStart: notifyTaskStarted,
        onTaskSubmit: submitTaskForReview,
        prompt,
        requestTaskAttachment: ({ taskData }) => {
            return new Promise((resolve) => {
                uploadPopupResolverRef.current = resolve;
                setCurrentTaskData(taskData || null);
                setTaskCompletionMode("attachment");
                setShowCompletionPopup(true);
            });
        },
        qwenGreenCount,
        qwenResponse,
        qwenTotalFields,
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
        handleSaveSessionCompletion,
        saveQuestionnaire,
        setCompletionSurveyDone,
        setShowSecondQuestionnaire,
        setShowThirdQuestionnaire,
        setWho,
    });

    const { handleAdminResetSession, handleRoleConfirm } = useMayakSessionActions({
        autoCompleteIntroTask,
        currentTaskIndex,
        getStorageKey,
        isAdmin,
        isIntroTask,
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
        syncRole,
        timerIsRunning: timerState.isRunning,
    });

    const { handleCompleteSession, handleShowRolePopup, handleToolLink1Click } = useMayakTrainerControlActions({
        autoCompleteIntroTask,
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

    const handleChange = useCallback(
        (code, value) => {
            setFields((prev) => ({ ...prev, [code]: value }));
        },
        [setFields]
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
    const inspectionStatus = currentTaskState?.status || null;
    const isInspectionPending = inspectionStatus === "pending_inspection";
    const isInspectionRejected = inspectionStatus === "rejected";
    const rejectedCorrectionDeadlineMs = currentTaskState?.correctionDeadlineAt ? new Date(currentTaskState.correctionDeadlineAt).getTime() : null;
    const isRejectedCorrectionActive = Boolean(isInspectionRejected && rejectedCorrectionDeadlineMs && rejectedCorrectionDeadlineMs > Date.now());
    const taskActionLabel = timerState.isRunning ? undefined : isInspectionPending ? "На проверке" : isInspectionRejected ? "Исправить задание" : undefined;
    const hasInspectorNotifications = isInspectorUser && !isInspectorWidgetOpen && pendingInspectionCount > 0;
    const disableTaskNavigation = isInspectionPending || isRejectedCorrectionActive;
    const disableCompleteSession = isInspectionPending || isRejectedCorrectionActive || hasInspectorNotifications;

    const handleReviewTask = async ({ taskKey, action, reason }) => {
        try {
            await reviewTask({ taskKey, action, reason });
            if (reviewPopupTaskKey === taskKey) {
                setReviewPopupTaskKey("");
                setReviewPopupData(null);
            }
        } catch (error) {
            alert(error.message || "Не удалось обработать задание");
        }
    };
    const handleConfirmArtifactUpload = (file) => {
        const resolver = uploadPopupResolverRef.current;
        uploadPopupResolverRef.current = null;
        setIsUploadingArtifact(false);
        setTaskCompletionMode("summary");
        setShowCompletionPopup(false);
        if (resolver) resolver(file instanceof File ? file : null);
    };

    const handleCancelArtifactUpload = () => {
        const resolver = uploadPopupResolverRef.current;
        uploadPopupResolverRef.current = null;
        setIsUploadingArtifact(false);
        setTaskCompletionMode("summary");
        setShowCompletionPopup(false);
        if (resolver) resolver(null);
    };

    const handleOpenInspectorTask = async (taskKey) => {
        if (!taskKey) return;
        setReviewPopupTaskKey(taskKey);
        setReviewPopupLoading(true);
        try {
            const details = await fetchTaskDetails({ mode: "inspector", taskKey });
            setReviewPopupData(details);
        } catch (error) {
            alert(error.message || "Не удалось открыть задание");
            setReviewPopupTaskKey("");
            setReviewPopupData(null);
        } finally {
            setReviewPopupLoading(false);
        }
    };

    useEffect(() => {
        if (typeof window === "undefined") return;
        const storedValue = localStorage.getItem(getStorageKey("inspectorWidgetOpen"));
        if (storedValue !== null) {
            setIsInspectorWidgetOpen(storedValue === "true");
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        localStorage.setItem(getStorageKey("inspectorWidgetOpen"), String(isInspectorWidgetOpen));
    }, [isInspectorWidgetOpen]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const rawFields = sessionStorage.getItem(getStorageKey("historyApplyFields"));
        if (!rawFields) return;
        try {
            const parsedFields = JSON.parse(rawFields);
            setFields((prev) => ({ ...prev, ...parsedFields }));
            setPrompt("");
        } finally {
            sessionStorage.removeItem(getStorageKey("historyApplyFields"));
        }
    }, [getStorageKey]);

    useEffect(() => {
        setTaskTimelineEntries(readMayakTaskLog(getStorageKey("session_tasks_log")));
    }, []);

    useEffect(() => {
        const nextEntries = syncMayakTaskLogFromStates(getStorageKey("session_tasks_log"), sessionSnapshot?.taskStates || []);
        setTaskTimelineEntries(nextEntries);
    }, [sessionSnapshot]);

    useEffect(() => {
        if (sessionSnapshot?.session?.status !== "completed") return;
        removeKeyCookie();
        localStorage.removeItem("trainer_v2_userRole");
        goTo("settings");
    }, [goTo, sessionSnapshot?.session?.status]);

    const trainerControlsProps = {
        who,
        taskVersion,
        currentTaskIndex,
        tasks,
        isTaskRunning: timerState.isRunning,
        taskElapsedTime: timerState.elapsedTime,
        instructionFileUrl,
        taskFileUrl,
        sourceUrl,
        currentTask,
        isCurrentTaskAllowed,
        allowedMinIndex,
        allowedMaxIndex,
        selectedRole,
        rankingDelta5,
        onWhoChange: (value) => {
            // РЎРЅР°С‡Р°Р»Р° РѕР±РЅРѕРІР»СЏРµРј СЃРѕСЃС‚РѕСЏРЅРёРµ, С‡С‚РѕР±С‹ UI РѕС‚СЂРµР°РіРёСЂРѕРІР°Р»
            setWho(value);
            // Р—Р°С‚РµРј, РµСЃР»Рё РІС‹Р±СЂР°Р»Рё "РњС‹" Рё Р°РЅРєРµС‚Р° РЅРµ РїСЂРѕР№РґРµРЅР°, РїРѕРєР°Р·С‹РІР°РµРј РїРѕРїР°Рї
            if (value === "we" && !hasCompletedSecondQuestionnaire) {
                showSwitchToWeConfirmation();
            }
        },
        onPrevTask: prevTask,
        onNextTask: nextTask,
        taskInputValue,
        onTaskInputChange: (e) => {
            const value = e.target.value;

            // РќРµРјРµРґР»РµРЅРЅРѕ РѕР±РЅРѕРІР»СЏРµРј РїРѕР»Рµ РІРІРѕРґР°, С‡С‚РѕР±С‹ РІРІРѕРґ Р±С‹Р» РїР»Р°РІРЅС‹Рј
            if (!/^\d*$/.test(value)) return; // Р Р°Р·СЂРµС€Р°РµРј РІРІРѕРґРёС‚СЊ С‚РѕР»СЊРєРѕ С†РёС„СЂС‹
            setTaskInputValue(value);

            // РЎР±СЂР°СЃС‹РІР°РµРј РїСЂРµРґС‹РґСѓС‰РёР№ С‚Р°Р№РјРµСЂ
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }

            // Р•СЃР»Рё РїРѕР»Рµ РїСѓСЃС‚РѕРµ, РЅРёС‡РµРіРѕ РЅРµ РґРµР»Р°РµРј
            if (value.trim() === "") {
                return;
            }

            // РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј РЅРѕРІС‹Р№ С‚Р°Р№РјРµСЂ
            debounceTimeoutRef.current = setTimeout(() => {
                const inputNum = parseInt(value, 10);
                let newIndex;

                if (tokenTaskRange) {
                    // РЎ С‚РѕРєРµРЅРѕРј: РёС‰РµРј РїРѕ РЅРѕРјРµСЂСѓ Р·Р°РґР°РЅРёСЏ (task.number)
                    newIndex = tasks.findIndex((t) => parseInt(t.number, 10) === inputNum);
                } else {
                    // Р‘РµР· С‚РѕРєРµРЅР°: РІРІРѕРґ = РїРѕСЂСЏРґРєРѕРІС‹Р№ РЅРѕРјРµСЂ (1, 2, 3...)
                    newIndex = inputNum - 1;
                }

                // Р•СЃР»Рё Р·Р°РґР°РЅРёРµ РЅР°Р№РґРµРЅРѕ Рё РІ РїСЂРµРґРµР»Р°С… РґРѕРїСѓСЃС‚РёРјРѕРіРѕ РґРёР°РїР°Р·РѕРЅР° вЂ” РїРµСЂРµРєР»СЋС‡Р°РµРј
                if (newIndex >= 0 && newIndex >= allowedMinIndex && newIndex <= allowedMaxIndex && newIndex < tasks.length) {
                    goToTask(newIndex);
                }
                // Р•СЃР»Рё РЅРµ РЅР°Р№РґРµРЅРѕ вЂ” РїСЂРѕСЃС‚Рѕ РЅРµ РїРµСЂРµРєР»СЋС‡Р°РµРј, РґР°С‘Рј РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ РёСЃРїСЂР°РІРёС‚СЊ
            }, 600);
        },
        onToggleTaskTimer: toggleTaskTimer,
        onCompleteSession: handleCompleteSession,
        onShowRolePopup: handleShowRolePopup,
        onToolLink1Click: handleToolLink1Click,
        mayakData,
        onShowInstruction: handleShowInstruction,
        isCurrentTaskIntro: isIntroTask(currentTaskIndex),
        taskActionLabel,
        isTaskActionDisabled: isInspectionPending,
        disableTaskNavigation,
        disableCompleteSession,
    };

    return (
        <>
            <Header>
                <Header.Heading>МАЯК ОКО</Header.Heading>
                <Button
                    icon
                    disabled={timerState.isRunning}
                    className={timerState.isRunning ? "!opacity-40 !cursor-not-allowed !pointer-events-none" : ""}
                    onClick={handleOpenHistory}
                    title={timerState.isRunning ? "Недоступно во время выполнения задания" : "История запросов"}>
                    <TimeIcon />
                </Button>
                <Button icon onClick={() => setIsTaskTimelineOpen((prev) => !prev)} title="История заданий">
                    <CourseIcon />
                </Button>
                {isInspectorUser && (
                    <div className="relative">
                        <Button
                            icon
                            className={pendingInspectionCount > 0 && !isInspectorWidgetOpen ? "!border-amber-300 !bg-amber-50 !text-amber-700" : ""}
                            onClick={() => setIsInspectorWidgetOpen((prev) => !prev)}
                            title="Инспектор">
                            <AdminIcon />
                        </Button>
                        {pendingInspectionCount > 0 && !isInspectorWidgetOpen && (
                            <span className="pointer-events-none absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                                {pendingInspectionCount}
                            </span>
                        )}
                    </div>
                )}
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
                                <Block className="col-span-12 lg:col-span-6 !h-full min-w-0">
                    <form className="flex flex-col h-full justify-between">
                        <div className="flex flex-col gap-[1.25rem]">
                            <div className="flex flex-col gap-[1rem]">
                                <Switcher
                                    value={activeTypeKey} // РСЃРїРѕР»СЊР·СѓРµРј activeTypeKey РґР»СЏ РїСЂР°РІРёР»СЊРЅРѕРіРѕ РІС‹РґРµР»РµРЅРёСЏ
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

                <div className="col-span-12 lg:col-span-6 h-full min-w-0 flex flex-col gap-4">
                    {!isMobile && <TrainerControls {...trainerControlsProps} />}
                    {sessionError && <div className="text-sm text-red-600">{sessionError}</div>}

                    {sessionSnapshot?.session?.id && !isInspectorUser && <MayakInspectorPanel currentTaskState={currentTaskState} onReviewTask={handleReviewTask} sessionSnapshot={sessionSnapshot} />}

                    <Block className="flex-grow !bg-slate-50 flex flex-col">
                        <h6 className="text-black mb-2">Ваш промт</h6>
                        <div className="flex-grow overflow-y-auto">
                            <p className="text-gray-600">{prompt || '\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043f\u043e\u043b\u044f \u0438 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u0440\u043e\u043c\u0442"'}</p>
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
                    <div className="flex flex-col gap-[1rem]">
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
                            />
                        </div>
                    </div>
                </div>

                {showBuffer && <Buffer onClose={handleCloseBuffer} onInsert={handleInsertFromBuffer} onUpdate={handleUpdateBuffer} buffer={buffer} currentField={currentField} />}
                <InstructionImageModal instructionModal={instructionModal} onClose={handleCloseInstructionModal} />
            </div>

            {isTaskTimelineOpen && <MayakTaskTimelinePanel entries={taskTimelineEntries} onClose={() => setIsTaskTimelineOpen(false)} />}

            {hasInspectorNotifications && <MayakInspectorNotificationStack onOpenTask={handleOpenInspectorTask} onReviewTask={handleReviewTask} pendingTasks={sessionSnapshot?.inspectorView?.pendingTasks || []} />}

            {isInspectorUser && isInspectorWidgetOpen && (
                <MayakInspectorWidget
                    currentTaskState={currentTaskState}
                    onClose={() => setIsInspectorWidgetOpen(false)}
                    onOpenTask={handleOpenInspectorTask}
                    onReviewTask={handleReviewTask}
                    sessionSnapshot={sessionSnapshot}
                    storageKey={getStorageKey("inspectorWidgetPosition")}
                />
            )}
            {reviewPopupTaskKey && <MayakInspectorReviewPopup details={reviewPopupData} loading={reviewPopupLoading} mode="inspector" onClose={() => { setReviewPopupTaskKey(""); setReviewPopupData(null); }} onApprove={() => handleReviewTask({ taskKey: reviewPopupTaskKey, action: "approve", reason: "" })} onReject={(reason) => handleReviewTask({ taskKey: reviewPopupTaskKey, action: "reject", reason })} token={token} userId={activeUser?.id || ""} />}
            {showCompletionPopup && (
                <TaskCompletionPopup
                    taskData={currentTaskData}
                    elapsedTime={timerState.readyElapsedTime}
                    isSubmitting={isUploadingArtifact}
                    mode={taskCompletionMode}
                    onAttachmentConfirm={(file) => {
                        setIsUploadingArtifact(true);
                        handleConfirmArtifactUpload(file);
                    }}
                    onClose={() => {
                        if (taskCompletionMode === "attachment") {
                            handleCancelArtifactUpload();
                            return;
                        }
                        setShowCompletionPopup(false);
                    }}
                />
            )}
            {showSessionCompletionPopup && <SessionCompletionPopup onClose={handleCloseSessionCompletionPopup} onSave={handleSaveSessionCompletion} />}
            {showRolePopup && <RoleSelectionPopup onClose={handleCloseRolePopup} onConfirm={handleRoleConfirm} />}
            {showRankingTestPopup && (
                <RankingTestPopup
                    onClose={handleCloseRankingTestPopup}
                    forceRetake={rankingForceRetake}
                    onSave={handleSaveRankingTest}
                />
            )}
        </>
    );
}

