import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import Header from "@/components/layout/Header";
import Buffer from "./addons/popup";
import RankingTestPopup from "./addons/RankingTestPopup";
import MayakServicesPanel from "./MayakServicesPanel";
import InstructionImageModal from "./InstructionImageModal";
import InstructionPreviewPanel from "./InstructionPreviewPanel";
import { InspectorReviewModal, InspectorReviewQueue, SessionReviewStatusBanner, SessionTaskReviewPopup } from "./SessionReviewWidgets";
import { MayakField, TrainerControls, ROLE_DESCRIPTIONS } from "./TrainerUiSections";
import ContestLessonStepper from "./ContestLessonStepper";
import { isContestModeActive } from "@/lib/mayakContestAccess";
import { ContestLessonsProvider } from "./useContestLessons";
import { SecretMissionPopup } from "./SecretMission";
import { RoleSelectionPopup, ConfirmationPopup, FirstQuestionnairePopup, SecondQuestionnairePopup, ThirdQuestionnairePopup, SessionCompletionPopup, TaskCompletionPopup, YaDirectionSelectionPopup } from "./TrainerPopups";

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
import { resolveFormatKey, resolveDirectionKey, classifyMoodCard, YA_FORMAT_TYPES, computeTrainerYaProgress } from "@/lib/mayakProgressModel";
import { AchievementToast, TrainerDebugPanel } from "./TrainerOverlays";
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
import { useMayakSovaEvaluation } from "./hooks/useMayakSovaEvaluation";
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

const SOVA_EVALUATION_LIMIT = 20;
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
const SOVA_ZONE_META = {
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

const getSovaZoneMeta = (zone) => SOVA_ZONE_META[zone] || SOVA_ZONE_META.default;
const SOVA_MASCOT_POOLS = {
    green: [{ animatedSrc: "/mascot-good-transparent-anim-smooth.webp" }, { animatedSrc: "/mascot-good-2-transparent-anim.webp" }, { animatedSrc: "/mascot-good-3-transparent-anim.webp" }],
    yellow: [{ animatedSrc: "/mascot-neutral-1-transparent-anim.webp" }, { animatedSrc: "/mascot-neutral-2-transparent-anim.webp" }, { animatedSrc: "/mascot-neutral-3-transparent-anim.webp" }],
    red: [{ animatedSrc: "/mascot-bad-transparent-anim.webp" }, { animatedSrc: "/mascot-bad-2-transparent-anim.webp" }, { animatedSrc: "/mascot-bad-3-transparent-anim.webp", hideAfterMs: 5980 }],
};
const getRandomSovaMascotAsset = (zone) => {
    const pool = SOVA_MASCOT_POOLS[zone];
    if (!Array.isArray(pool) || pool.length === 0) {
        return null;
    }

    const selectedAsset = pool[Math.floor(Math.random() * pool.length)];
    return selectedAsset ? { ...selectedAsset } : null;
};
const SOVA_UNAVAILABLE_MASCOT_ASSET = { animatedSrc: "/mascot-bad-3-transparent-anim.webp", hideAfterMs: 5980 };
const SOVA_MASCOT_ASSET_PRELOAD_LIST = Array.from(
    new Set([
        SOVA_UNAVAILABLE_MASCOT_ASSET.animatedSrc,
        ...Object.values(SOVA_MASCOT_POOLS)
            .flat()
            .map((asset) => asset.animatedSrc)
            .filter(Boolean),
    ])
);
const formatFieldList = (labels) => (Array.isArray(labels) ? labels.filter(Boolean).join(", ") : "");
const getSovaScoreMeta = (greenCount, totalFields = 7) => {
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
const buildSovaTaskContext = ({ taskTextData }) => ({
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
    // Защита от повторного клика «Завершить», пока идёт асинхронная финализация.
    const isTogglingTimerRef = useRef(false);
    const [isPreviewResizing, setIsPreviewResizing] = useState(false);
    const [previewWidth, setPreviewWidth] = useState(() => {
        if (typeof window === "undefined") return PREVIEW_WIDTH_DEFAULT;
        const raw = window.localStorage.getItem(getStorageKey("previewWidth"));
        const parsed = parseInt(raw || "", 10);
        return Number.isFinite(parsed) ? parsed : PREVIEW_WIDTH_DEFAULT;
    });

    const [hasCompletedSecondQuestionnaire, setHasCompletedSecondQuestionnaire] = useState(localStorage.getItem(getStorageKey("hasCompletedSecondQuestionnaire")) === "true");
    const [selectedRole, setSelectedRole] = useState(localStorage.getItem(getStorageKey("userRole")) || null);
    // Локально сохранённая тайная миссия для НЕ сессионного режима (в сессии миссия
    // хранится на сервере в participant.secretMission). Объект: { role, id, title, text }.
    const [localSecretMission, setLocalSecretMission] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(getStorageKey("secretMission")) || "null");
        } catch {
            return null;
        }
    });
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
        completionLoading,
        setCompletionLoading,
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

    // States for bypass mode (token fffff)
    const [bypassPhase, setBypassPhase] = useState(() => {
        if (typeof window !== "undefined") {
            return window.localStorage.getItem("mayak_bypass_phase") || "START";
        }
        return "START";
    });
    const [bypassProgress, setBypassProgress] = useState(() => {
        if (typeof window !== "undefined") {
            return parseInt(window.localStorage.getItem("mayak_bypass_progress"), 10) || 0;
        }
        return 0;
    });
    const [bypassDirection, setBypassDirection] = useState(() => {
        if (typeof window !== "undefined") {
            return window.localStorage.getItem("mayak_bypass_direction") || "";
        }
        return "";
    });
    // Прогресс части «Мы» (Индекс цифровой зрелости) для отладки: сколько
    // заданий направлений «выполнено» из 36.
    const [bypassWeProgress, setBypassWeProgress] = useState(() => {
        if (typeof window !== "undefined") {
            return parseInt(window.localStorage.getItem("mayak_bypass_we_progress"), 10) || 0;
        }
        return 0;
    });
    // Сколько звёзд-джокеров «потрачено» в отладке (0 или 1). Заработанная
    // звезда — 1, баланс = earned - spent, чтобы вживую видеть смену 1↔0.
    const [bypassJokerSpent, setBypassJokerSpent] = useState(() => {
        if (typeof window !== "undefined") {
            return parseInt(window.localStorage.getItem("mayak_bypass_joker_spent"), 10) || 0;
        }
        return 0;
    });

    // Отладочный override прогресса части «Я» для админа в СЕССИИ — строго
    // КЛИЕНТСКИЙ (localStorage), на сервер не пишется. Так панель отладки меняет
    // только экран самого администратора и НЕ влияет на других участников,
    // дашборд и реальные задачи/ревью. Отдельное состояние нужно, чтобы override
    // переживал 5-сек. рефреш sessionRuntimeState.
    const [sessionDebugOverride, setSessionDebugOverride] = useState(() => {
        if (typeof window === "undefined") return null;
        try {
            return JSON.parse(window.localStorage.getItem("mayak_session_debug_override")) || null;
        } catch {
            return null;
        }
    });

    const [showBypassMenu, setShowBypassMenu] = useState(false);
    const [bypassPosition, setBypassPosition] = useState(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = window.localStorage.getItem("mayak_bypass_pos");
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
                        return parsed;
                    }
                }
            } catch {}
        }
        return { x: 400, y: 80 };
    });

    const dragStartRef = useRef(null);

    const handleDragStart = useCallback((e) => {
        // Мы перетаскиваем только за заголовок, предотвращаем поведение браузера по умолчанию
        e.preventDefault();
        dragStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPos: { ...bypassPosition }
        };

        const handleDragMove = (moveEvent) => {
            if (!dragStartRef.current) return;
            const deltaX = moveEvent.clientX - dragStartRef.current.startX;
            const deltaY = moveEvent.clientY - dragStartRef.current.startY;
            const nextPos = {
                x: dragStartRef.current.startPos.x + deltaX,
                y: dragStartRef.current.startPos.y + deltaY
            };
            setBypassPosition(nextPos);
        };

        const handleDragEnd = (endEvent) => {
            if (!dragStartRef.current) return;
            const deltaX = endEvent.clientX - dragStartRef.current.startX;
            const deltaY = endEvent.clientY - dragStartRef.current.startY;
            const finalPos = {
                x: dragStartRef.current.startPos.x + deltaX,
                y: dragStartRef.current.startPos.y + deltaY
            };
            setBypassPosition(finalPos);
            try {
                window.localStorage.setItem("mayak_bypass_pos", JSON.stringify(finalPos));
            } catch {}
            dragStartRef.current = null;
            document.removeEventListener("pointermove", handleDragMove);
            document.removeEventListener("pointerup", handleDragEnd);
        };

        document.addEventListener("pointermove", handleDragMove);
        document.addEventListener("pointerup", handleDragEnd, { once: true });
    }, [bypassPosition]);

    // Queue for achievements to display sequentially without conflicts
    const [achievementsQueue, setAchievementsQueue] = useState([]);

    const { activeUserId, activeUserName, activeUser, mayakData, sessionId: runtimeSessionId, tokenType, tableNumber } = useMayakRuntimeData();
    const isSessionMode = tokenType === "session" && !!runtimeSessionId;
    // Конкурсный вид включаем только при заходе из урока. Кука с конкурсным
    // ключом живёт долго, и по ней одной обычное открытие тренажёра через
    // меню тоже превращалось бы в конкурсное прохождение.
    const [isContestMode, setIsContestMode] = useState(false);
    useEffect(() => {
        setIsContestMode(tokenType === "contest" && isContestModeActive());
    }, [tokenType]);

    // Вне сессии: если роль сменилась, прежняя локальная миссия больше не актуальна —
    // сбрасываем, чтобы участник мог получить миссию под новую роль.
    useEffect(() => {
        if (isSessionMode) return;
        if (localSecretMission && localSecretMission.role && localSecretMission.role !== selectedRole) {
            setLocalSecretMission(null);
            try {
                localStorage.removeItem(getStorageKey("secretMission"));
            } catch {}
        }
    }, [selectedRole, isSessionMode, localSecretMission]);

    // Сохранение локально выданной миссии (вне сессии).
    const handleLocalSecretMissionAssigned = useCallback((mission) => {
        setLocalSecretMission(mission);
        try {
            localStorage.setItem(getStorageKey("secretMission"), JSON.stringify(mission));
        } catch {}
    }, []);

    // Актуальная тайная миссия: в сессии — из рантайма участника, вне сессии — локальная.
    const effectiveSecretMission = isSessionMode ? sessionRuntimeState?.participant?.secretMission || null : localSecretMission;
    // Единый refresh состояния сессии. Раньше один и тот же блок «запросить
    // /session-runtime/state и записать в стейт» был скопирован в 4 местах
    // (авто-аппрув intro, upload, joker-spend, решение инспектора) и в polling-
    // эффекте. Теперь — одна стабильная функция; возвращает новый state (или null),
    // чтобы вызывающий при желании читал его сразу.
    const refreshSessionRuntimeState = useCallback(async () => {
        if (!runtimeSessionId || !activeUserId) return null;
        const refreshResponse = await fetch(
            `/api/mayak/session-runtime/state?sessionId=${encodeURIComponent(runtimeSessionId)}&userId=${encodeURIComponent(activeUserId)}`,
            { cache: "no-store" }
        );
        const refreshPayload = await refreshResponse.json().catch(() => ({}));
        if (refreshResponse.ok && refreshPayload.success) {
            const nextState = refreshPayload.data || null;
            setSessionRuntimeState(nextState);
            return nextState;
        }
        return null;
    }, [runtimeSessionId, activeUserId]);

    // Попап с тайной миссией, который открывается сразу после подтверждения роли.
    const [secretMissionPopup, setSecretMissionPopup] = useState(null);

    // Выдаёт тайную миссию под роль и открывает попап с описанием.
    // Режимы: сессия (закрепление на сервере) / standalone (localStorage).
    // Сбой выдачи НЕ должен ломать подтверждение роли — ошибки гасим тихо.
    const assignAndShowSecretMission = useCallback(async (role) => {
        if (!role) return;
        try {
            const sessionAssign = isSessionMode && runtimeSessionId && activeUserId;
            const endpoint = sessionAssign ? "/api/mayak/session-runtime/secret-mission" : "/api/mayak/secret-mission";
            const body = sessionAssign ? { sessionId: runtimeSessionId, userId: activeUserId } : { role };
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success || !payload.data) return;
            if (sessionAssign) {
                await refreshSessionRuntimeState();
            } else {
                handleLocalSecretMissionAssigned(payload.data);
            }
            setSecretMissionPopup(payload.data);
        } catch {
            /* выдача миссии не критична для подтверждения роли */
        }
    }, [isSessionMode, runtimeSessionId, activeUserId, refreshSessionRuntimeState, handleLocalSecretMissionAssigned]);

    // Отладка в сессии: панель меняет ТОЛЬКО клиентский override (localStorage),
    // на сервер ничего не пишется. Это гарантирует, что отладка администратора
    // не влияет ни на других участников, ни на дашборд, ни на реальные задачи.
    const pushSessionDebugProgress = useCallback((patch) => {
        setSessionDebugOverride((prev) => {
            const current = prev || { phase: "START", progress: 0, weProgress: 0, direction: "", jokerSpent: 0 };
            const merged = patch === null ? null : { ...current, ...patch };
            try {
                if (merged === null) {
                    window.localStorage.removeItem("mayak_session_debug_override");
                } else {
                    window.localStorage.setItem("mayak_session_debug_override", JSON.stringify(merged));
                }
            } catch {}
            return merged;
        });
    }, []);

    const handleBypassPhaseChange = useCallback((phase) => {
        if (isSessionMode) {
            pushSessionDebugProgress({ phase, progress: 0 });
            return;
        }
        setBypassPhase(phase);
        window.localStorage.setItem("mayak_bypass_phase", phase);
        setBypassProgress(0);
        window.localStorage.setItem("mayak_bypass_progress", "0");
    }, [isSessionMode, pushSessionDebugProgress]);

    const handleBypassProgressChange = useCallback((progress) => {
        if (isSessionMode) {
            pushSessionDebugProgress({ progress });
            return;
        }
        setBypassProgress(progress);
        window.localStorage.setItem("mayak_bypass_progress", progress.toString());
    }, [isSessionMode, pushSessionDebugProgress]);

    const handleBypassDirectionChange = useCallback((direction) => {
        if (isSessionMode) {
            pushSessionDebugProgress({ direction });
            return;
        }
        setBypassDirection(direction);
        window.localStorage.setItem("mayak_bypass_direction", direction);
    }, [isSessionMode, pushSessionDebugProgress]);

    const handleBypassWeProgressChange = useCallback((progress) => {
        if (isSessionMode) {
            pushSessionDebugProgress({ weProgress: progress });
            return;
        }
        setBypassWeProgress(progress);
        window.localStorage.setItem("mayak_bypass_we_progress", String(progress));
    }, [isSessionMode, pushSessionDebugProgress]);

    const handleBypassJokerSpentChange = useCallback((spent) => {
        const normalized = spent ? 1 : 0;
        if (isSessionMode) {
            pushSessionDebugProgress({ jokerSpent: normalized });
            return;
        }
        setBypassJokerSpent(normalized);
        window.localStorage.setItem("mayak_bypass_joker_spent", String(normalized));
    }, [isSessionMode, pushSessionDebugProgress]);

    const prevProgressRef = useRef(null);

    const handleResetBypassAchievements = useCallback(() => {
        window.localStorage.removeItem(getStorageKey("mayak_achieved_start"));
        window.localStorage.removeItem(getStorageKey("mayak_achieved_content_types"));
        window.localStorage.removeItem(getStorageKey("mayak_achieved_specialization"));
        prevProgressRef.current = null;
        // В сессии дополнительно снимаем серверный override прогресса —
        // возвращаемся к реальному прогрессу участника.
        if (isSessionMode) {
            pushSessionDebugProgress(null);
        }
        alert("Флаги достижений сброшены! Теперь можно протестировать их появление снова.");
    }, [getStorageKey, isSessionMode, pushSessionDebugProgress]);

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
        resetTimer,
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
        // Локальный лог не должен блокировать сохранение на сервер.
        try {
            const currentLog = JSON.parse(localStorage.getItem(getStorageKey("session_tasks_log")) || "[]");
            const filteredLog = currentLog.filter((item) => item.number && String(item.number) !== String(logEntry.number));
            localStorage.setItem(getStorageKey("session_tasks_log"), JSON.stringify([...filteredLog, logEntry]));
        } catch (logErr) {
            console.error("Не удалось записать локальный лог вводного задания (продолжаем сохранение на сервер):", logErr);
        }

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

            if (isSessionMode && runtimeSessionId && activeUserId) {
                const res = await fetch("/api/mayak/session-runtime/auto-approve", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        sessionId: runtimeSessionId,
                        userId: activeUserId,
                        taskNumber: taskNumber || String(currentTaskIndex + 1),
                        taskIndex: currentTaskIndex,
                        taskName,
                    }),
                });
                const payload = await res.json().catch(() => ({}));
                if (res.ok && payload.success) {
                    await refreshSessionRuntimeState();
                }
            }
        } catch (err) {
            console.error("Error saving intro task:", err);
        }

        // Останавливаем таймер если был запущен
        if (timerState.isRunning) {
            stopTimer();
        }
    }, [currentTask, currentTaskIndex, tasksTexts, type, userType, who, timerState.isRunning, stopTimer, isSessionMode, runtimeSessionId, activeUserId, refreshSessionRuntimeState]);


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
    const [showYaDirectionPopup, setShowYaDirectionPopup] = useState(false);
    const [activeAchievement, setActiveAchievement] = useState(null);
    const [prompt, setPrompt] = useState("");
    const [isCopied, setIsCopied] = useState(false);
    const [buffer, setBuffer] = useState({});
    const [showBuffer, setShowBuffer] = useState(false);
    const [currentField, setCurrentField] = useState(null);
    const {
        sovaResponse,
        sovaLoading,
        sovaZone,
        sovaStrongFields,
        sovaWeakFields,
        sovaGreenCount,
        sovaTotalFields,
        sovaChecksRemaining,
        showMascotVideo,
        activeSovaMascotAsset,
        isPromptCopyAwaitingEvaluation,
        mascotPlaybackKey,
        evaluationLimit,
        syncSovaEvaluationQuota,
        clearSovaState,
        resetSovaSessionState,
        createPromptWithEvaluation,
    } = useMayakSovaEvaluation({
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
            clearSovaState();
            setPrompt('Пожалуйста, заполните все поля (или используйте "кубики").');
            return null;
        }

        const { values, finalPrompt } = builtDraft;
        const taskNumber = currentTask?.number?.toString();
        const taskTextData = taskNumber ? tasksTexts.find((t) => t.number === taskNumber) : null;
        const taskContext = buildSovaTaskContext({
            taskTextData,
        });

        setPrompt(finalPrompt);
        savePromptToHistory(finalPrompt);

        return {
            values,
            finalPrompt,
            taskContext,
        };
    }, [clearSovaState, currentTask?.number, fields, savePromptToHistory, tasksTexts]);

    buildPromptDraftRef.current = buildPromptDraft;

    useEffect(() => {
        if (sessionStartTime) {
            syncSovaEvaluationQuota(sessionStartTime);
        }
    }, [sessionStartTime, syncSovaEvaluationQuota]);

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
            goTo("mayakOko");
        }
    }, [goTo]);

    const effectiveTableNumber = sessionRuntimeState?.participant?.tableNumber || tableNumber;

    const yaProgress = useMemo(() => {
        // Источник «ручного» прогресса части «Я»: bypass-режим (локальное
        // состояние) ИЛИ клиентский админ-override в сессии (sessionDebugOverride,
        // не уходит на сервер). Если есть — рисуем из него, иначе считаем из задач.
        // Override читается из localStorage и не привязан ни к сессии, ни к
        // пользователю: без проверки прав он «прилипал» к следующему входу в этом
        // браузере (мастер видел чужую фазу WE_INDEX и лишнюю звезду-джокер).
        // Применяем только тем, у кого панель отладки реально доступна.
        const sessionDebug = isSessionMode && isAdmin ? sessionDebugOverride : null;
        const manualSource =
            tokenType === "bypass"
                ? { phase: bypassPhase, progress: bypassProgress, weProgress: bypassWeProgress, direction: bypassDirection }
                : sessionDebug
                ? {
                      phase: sessionDebug.phase || "START",
                      progress: Number(sessionDebug.progress) || 0,
                      weProgress: Number(sessionDebug.weProgress) || 0,
                      direction: sessionDebug.direction || "",
                  }
                : null;

        // Чистый расчёт вынесен в mayakProgressModel.computeTrainerYaProgress
        // (там же его хелперы/константы и юнит-тесты). Здесь — только сборка
        // UI-специфичного manualSource и проброс participant/колоды.
        return computeTrainerYaProgress({
            manualSource,
            participant: sessionRuntimeState?.participant || null,
            tasks,
            fallbackSectionId: tokenSectionId,
        });
    }, [sessionRuntimeState?.participant?.taskStates, sessionRuntimeState?.participant?.yaDirection, sessionDebugOverride, isSessionMode, isAdmin, tasks, sessionRuntimeState?.participant?.sectionId, tokenSectionId, tokenType, bypassPhase, bypassProgress, bypassDirection, bypassWeProgress]);

    // Баланс звёзд-джокеров: 1 начисляется за зажжённую звезду специализации
    // части «Я» минус уже потраченные (jokerSpent из рантайма). earned берётся
    // из того же yaProgress; на сервере при расходе пересчитывается заново.
    const jokerBalance = useMemo(() => {
        const earned = yaProgress?.hasStar ? 1 : 0;
        // Bypass (fffff) — чистая клиентская песочница: и заработок звезды, и её
        // расход живут только локально (bypassJokerSpent). Эту ветку проверяем
        // ДО isSessionMode, потому что fffff может зайти в сессию (dev-bypass), и
        // там серверного джокера у него нет — баланс обязан считаться по bypass,
        // иначе кнопка покажет «1», а серверный расход откажет («Нет джокеров»).
        if (tokenType === "bypass") {
            return Math.max(0, earned - bypassJokerSpent);
        }
        if (isSessionMode) {
            // При активном клиентском админ-override берём «потрачено» из него
            // (чтобы в панели отладки вживую видеть смену 1↔0), иначе — реальный.
            const spent = sessionDebugOverride ? Number(sessionDebugOverride.jokerSpent) || 0 : Number(sessionRuntimeState?.participant?.jokerSpent) || 0;
            return Math.max(0, earned - spent);
        }
        return 0;
    }, [isSessionMode, tokenType, yaProgress?.hasStar, sessionRuntimeState?.participant?.jokerSpent, sessionDebugOverride, bypassJokerSpent]);

    // Состояние переключателя «Потратить джокер» в панели отладки: в сессии —
    // из клиентского админ-override, иначе — из локального bypass-состояния.
    const panelJokerSpent = isSessionMode
        ? (sessionDebugOverride?.jokerSpent ? 1 : 0)
        : bypassJokerSpent;

    // Текущее задание — направление части «Мы» (как на сервере getJokerSpendContext):
    // base = индекс+1 в диапазоне 51..99 и распознанное направление по типу контента.
    // Кнопку джокера привязываем к самому заданию, а не к переключателю «Я/Мы»,
    // чтобы она была доступна на любом «Мы»-задании при наличии звезды-джокера.
    const currentTaskIsWeDirection = useMemo(() => {
        const base = currentTaskIndex + 1;
        if (base < 51 || base > 99) return false;
        return Boolean(resolveDirectionKey(currentTaskData?.contentType || ""));
    }, [currentTaskIndex, currentTaskData?.contentType]);

    // Панель отладки доступна в чистом bypass-режиме И администратору в сессии.
    const canUseDebugPanel = tokenType === "bypass" || (isSessionMode && isAdmin);

    // Фактические форматы части «Я» в текущей колоде — для попапа выбора
    // специализации. Так попап показывает реальные направления колоды
    // (напр. для СПО — с метками «Изображение»/«Видео», а не пустой список),
    // а не захардкоженный набор.
    const yaDirectionOptions = useMemo(() => {
        const present = new Set();
        (tasks || []).forEach((task) => {
            const rawType = task?.contentType || "";
            const mood = classifyMoodCard(rawType);
            const fmtKey = mood.isMood
                ? (mood.standard && mood.section === "ya" ? mood.key : null)
                : resolveFormatKey(rawType);
            if (fmtKey) present.add(fmtKey);
        });
        const list = YA_FORMAT_TYPES.filter((f) => present.has(f.key)).map((f) => ({ key: f.key, label: f.label }));
        // Если в колоде ничего не распознано — отдаём канонический набор (fallback).
        return list.length > 0 ? list : YA_FORMAT_TYPES.map((f) => ({ key: f.key, label: f.label }));
    }, [tasks]);

    const triggerAchievement = useCallback((achievement) => {
        setAchievementsQueue((prev) => [...prev, achievement]);
    }, []);

    // Effect to process the achievements queue sequentially
    useEffect(() => {
        if (achievementsQueue.length > 0 && !activeAchievement) {
            const next = achievementsQueue[0];
            setActiveAchievement(next);
            setAchievementsQueue((prev) => prev.slice(1));
        }
    }, [achievementsQueue, activeAchievement]);

    // Effect to auto-dismiss active achievement after 5 seconds
    useEffect(() => {
        if (activeAchievement) {
            const timer = setTimeout(() => {
                setActiveAchievement(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [activeAchievement]);

    // Main achievements check on progress change
    useEffect(() => {
        if (!(isSessionMode || tokenType === "bypass") || !yaProgress) {
            prevProgressRef.current = null;
            return;
        }

        // Initialize ref on first run, do not trigger achievements immediately
        if (!prevProgressRef.current) {
            prevProgressRef.current = yaProgress;
            return;
        }

        // 1. Check Start phase done transition
        const wasStart = prevProgressRef.current.phase === "START";
        const isStartDone = yaProgress.phase !== "START";
        const startFlagKey = getStorageKey("mayak_achieved_start");
        if (wasStart && isStartDone && window.localStorage.getItem(startFlagKey) !== "true") {
            window.localStorage.setItem(startFlagKey, "true");
            triggerAchievement({
                title: "Достижение: Первые шаги 🚀",
                message: "Поздравляем! Вы успешно завершили стартовый этап МАЯК!",
                icon: "🎯",
            });
        }

        // 2. Check Content Types phase done transition
        const wasContentTypes = prevProgressRef.current.phase === "START" || prevProgressRef.current.phase === "CONTENT_TYPES";
        const isContentTypesDone = yaProgress.phase !== "START" && yaProgress.phase !== "CONTENT_TYPES";
        const contentFlagKey = getStorageKey("mayak_achieved_content_types");
        if (wasContentTypes && isContentTypesDone && window.localStorage.getItem(contentFlagKey) !== "true") {
            window.localStorage.setItem(contentFlagKey, "true");
            triggerAchievement({
                title: "Достижение: Мультимедиа Эксперт 🎨",
                message: "Потрясающе! Вы успешно освоили все 6 типов контента!",
                icon: "🏆",
            });
        }

        // 3. Check Specialization phase done transition (star lighted)
        // Звезда специализации зажжена, когда фаза «Я» завершена: либо ещё в
        // SPECIALIZATION с hasStar, либо уже перешли в WE_INDEX (Индекс
        // цифровой зрелости открывается сразу после звезды).
        const wasSpecNotDone = !prevProgressRef.current.hasStar;
        const isSpecDone = (yaProgress.phase === "SPECIALIZATION" && yaProgress.hasStar) || yaProgress.phase === "WE_INDEX";
        const specFlagKey = getStorageKey("mayak_achieved_specialization");
        if (wasSpecNotDone && isSpecDone && window.localStorage.getItem(specFlagKey) !== "true") {
            window.localStorage.setItem(specFlagKey, "true");
            triggerAchievement({
                title: "Достижение: Мастер Направления 🌟",
                message: "Великолепно! Вы завершили специализацию и зажгли звезду части «Я»!",
                icon: "👑",
            });
        }

        prevProgressRef.current = yaProgress;
    }, [yaProgress, isSessionMode, tokenType, triggerAchievement, getStorageKey]);

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
        isCurrentTaskApproved: ["approved", "expired", "rework_expired"].includes(
            (Array.isArray(sessionRuntimeState?.participant?.taskStates)
                ? sessionRuntimeState.participant.taskStates.find((task) => Number(task.taskIndex) === currentTaskIndex) || null
                : null)?.status
        ),
    });

    const {
        handleDownloadCertificate,
        handleDownloadLogs,
        handleSaveSessionCompletion,
    } = useMayakCompletionActions({
        elapsedTime: timerState.elapsedTime,
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
        resetSovaSessionState,
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
        onAfterRoleConfirm: assignAndShowSecretMission,
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

    const handleYaDirectionConfirm = useCallback(
        async (direction) => {
            if (runtimeSessionId && activeUserId) {
                // try/catch обязателен: при сетевом сбое fetch бросает исключение,
                // без обработки оно уходит в unhandled rejection и попап выбора
                // направления зависает без обратной связи. Тут показываем ошибку
                // и НЕ закрываем попап — участник может повторить выбор.
                try {
                    const response = await fetch("/api/mayak/session-runtime/ya-direction", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            sessionId: runtimeSessionId,
                            userId: activeUserId,
                            direction,
                        }),
                    });
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok || !payload.success) {
                        alert(payload.error || "Не удалось сохранить направление в сессии");
                        return;
                    }
                } catch (err) {
                    alert("Не удалось сохранить направление: проблема с сетью. Попробуйте ещё раз.");
                    return;
                }
            }

            if (tokenType === "bypass") {
                handleBypassDirectionChange(direction);
            }

            setSessionRuntimeState((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    participant: {
                        ...prev.participant,
                        yaDirection: direction,
                    },
                };
            });
            setShowYaDirectionPopup(false);
        },
        [activeUserId, runtimeSessionId, tokenType, handleBypassDirectionChange]
    );

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

    // Флаг «участник уже был в сессии». Нужен, чтобы отличить удаление участника
    // из дашборда (participant=null после регистрации) от кратковременной гонки
    // на входе и не выкинуть участника ошибочно до завершения регистрации.
    const sessionParticipantSeenRef = useRef(false);

    useEffect(() => {
        if (!isSessionMode || !runtimeSessionId || !activeUserId) {
            setSessionRuntimeState(null);
            setSessionRuntimeError("");
            sessionParticipantSeenRef.current = false;
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

                if (nextState?.participant) {
                    sessionParticipantSeenRef.current = true;
                }

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

                // Завершение сессии у участника: либо сессия закрыта админом
                // (sessionActive=false), либо участника удалили из дашборда —
                // тогда participant=null при активной сессии после того, как он
                // уже был зарегистрирован.
                const wasRemoved = !!nextState?.sessionActive && !nextState?.participant && sessionParticipantSeenRef.current;
                if (nextState && (nextState.sessionActive === false || wasRemoved)) {
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
    // В конкурсе материалы (PDF задания, инструкция, карта) доступны сразу:
    // там нет таймера сессии, к которому привязан доступ в обычном режиме.
    const canAccessCurrentTaskResources = isContestMode || timerState.isRunning || isCurrentTaskRejected || isCurrentTaskPendingReview;
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

                await refreshSessionRuntimeState();

                setShowCompletionPopup(false);
            } catch (error) {
                setSessionUploadError(error.message || "Не удалось отправить материал инспектору");
            } finally {
                setSessionUploadLoading(false);
            }
        },
        [activeUserId, currentTask, currentTaskData, currentTaskIndex, finalizeTaskExecution, runtimeSessionId, tasksTexts, timerState.elapsedTime, timerState.readyElapsedTime, refreshSessionRuntimeState]
    );

    // Использовать звезду-джокер: мгновенно засчитывает текущее задание «Мы»
    // без инспектора. Сервер проверяет баланс/принадлежность к «Мы» и атомарно
    // списывает джокер. По успеху — как при обычной сдаче: завершаем задание и
    // обновляем состояние сессии.
    const handleUseJokerStar = useCallback(async () => {
        if (!runtimeSessionId || !activeUserId || !currentTaskData) return;
        setSessionUploadError("");
        setSessionUploadLoading(true);
        try {
            const response = await fetch("/api/mayak/session-runtime/joker-spend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: runtimeSessionId,
                    userId: activeUserId,
                    taskNumber: String(currentTaskData.number || currentTask?.number || ""),
                    taskIndex: currentTaskIndex,
                    taskName: String(currentTask?.name || currentTaskData.title || `Задание ${currentTaskIndex + 1}`),
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || "Не удалось использовать звезду-джокер");
            }

            await finalizeTaskExecution({ timeWhenStopped: timerState.elapsedTime });

            await refreshSessionRuntimeState();

            setShowCompletionPopup(false);
        } catch (error) {
            setSessionUploadError(error.message || "Не удалось использовать звезду-джокер");
        } finally {
            setSessionUploadLoading(false);
        }
    }, [activeUserId, currentTask, currentTaskData, currentTaskIndex, finalizeTaskExecution, runtimeSessionId, timerState.elapsedTime, refreshSessionRuntimeState]);

    // Bypass-симуляция расхода джокера в попапе завершения. В режиме fffff нет
    // сервера и инспектора, поэтому повторяем боевую семантику клиентски:
    // списываем звезду (баланс 1→0) и мгновенно засчитываем задание части «Мы»
    // (+1 к прогрессу ИЦЗ, максимум 36). Так в fffff можно вживую спроектировать
    // и увидеть, как тратится джокер при завершении задания.
    const handleUseBypassJokerStar = useCallback(() => {
        handleBypassJokerSpentChange(1);
        setBypassWeProgress((prev) => {
            const next = Math.min(36, (Number(prev) || 0) + 1);
            if (typeof window !== "undefined") {
                window.localStorage.setItem("mayak_bypass_we_progress", String(next));
            }
            return next;
        });
        setShowCompletionPopup(false);
    }, [handleBypassJokerSpentChange]);

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
                await refreshSessionRuntimeState();
            } catch (error) {
                setInspectorResolveError(error.message || "Не удалось сохранить решение инспектора");
            } finally {
                setInspectorResolveLoading(false);
            }
        },
        [activeInspectorReview, activeUserId, runtimeSessionId, refreshSessionRuntimeState]
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
        clearSovaState,
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
          : sovaChecksRemaining <= 0
            ? "Лимит оценок для этой сессии исчерпан"
            : "";
    const isCreateWithEvaluationDisabled = isCreateDisabled || isEvaluationBlockedForIntroTask || sovaLoading || sovaChecksRemaining <= 0;
    const sovaZoneMeta = getSovaZoneMeta(sovaZone);
    const sovaScoreMeta = sovaGreenCount === null ? null : getSovaScoreMeta(sovaGreenCount, sovaTotalFields);
    const shouldShowSovaMascot = !sovaLoading && activeSovaMascotAsset && showMascotVideo;

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

        // Не даём запустить вторую финализацию, пока не завершилась первая.
        if (isTogglingTimerRef.current) {
            return;
        }
        isTogglingTimerRef.current = true;
        setSessionUploadError("");
        try {
            await toggleTaskTimer();
        } finally {
            isTogglingTimerRef.current = false;
        }
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
        // Реальный переход к другому заданию: сбрасываем таймер и черновик
        // полей/промта/оценки, чтобы накопленное время и текст предыдущей
        // задачи не перенеслись на новую (иначе время спишется не на ту задачу).
        if (nextIndex !== currentTaskIndex) {
            resetTimer();
            handleResetFields();
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
        // Список типов, у которых есть задание-якорь (для подсветки кликабельных
        // плашек в тренажёре). На каждый тип — максимум одно задание.
        contentTypeAnchors: tasks.filter((t) => t && t.typeAnchor).map((t) => String(t.typeAnchor)),
        // Клик по плашке типа контента: подставляем номер задания-якоря в поле
        // и переключаемся штатной навигацией. Если якоря для типа нет или идёт
        // выполнение/блокировка — ничего не делаем.
        onContentTypeClick: (typeKey) => {
            if (timerState.isRunning || isCurrentTaskPendingReview || isCurrentTaskRejected) return;
            const idx = tasks.findIndex((t) => t && String(t.typeAnchor || "") === typeKey);
            if (idx < 0) return;
            if (idx < allowedMinIndex || idx > allowedMaxIndex) return;
            const displayValue = tokenTaskRange
                ? (tasks[idx].number?.toString() || String(idx + 1))
                : String(idx + 1);
            setTaskInputValue(displayValue);
            guardedGoToTask(idx);
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
        onShowYaDirectionSelection: () => setShowYaDirectionPopup(true),
        tokenType,
        isContestMode,
        yaDirectionOptions,
        onBypassPhaseChange: handleBypassPhaseChange,
        onBypassProgressChange: handleBypassProgressChange,
        onBypassDirectionChange: handleBypassDirectionChange,
        onResetBypassAchievements: handleResetBypassAchievements,
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
                            <Button className="blue w-full" type="button" onClick={createPrompt} disabled={isCreateDisabled || sovaLoading}>
                                Создать&nbsp;промт
                            </Button>
                        </span>
                        <span className="block w-full" title={createWithEvaluationDisabledReason}>
                            <Button className="w-full" type="button" onClick={createPromptWithEvaluation} disabled={isCreateWithEvaluationDisabled}>
                                Создать&nbsp;промт&nbsp;с&nbsp;оценкой&nbsp;({sovaChecksRemaining}/{evaluationLimit})
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
                <div className="flex-grow">
                    <p className="text-gray-600">{prompt || 'Заполните поля и нажмите "Создать промт"'}</p>
                </div>
            </Block>

            {(sovaLoading || sovaResponse) && (
                <Block className={`${sovaLoading ? SOVA_ZONE_META.default.blockClass : sovaZoneMeta.blockClass} relative flex flex-col`}>
                    {!sovaLoading && sovaScoreMeta && (
                        <div className={`absolute right-4 top-4 text-lg font-bold sm:text-xl ${sovaScoreMeta.textClass}`}>
                            {sovaScoreMeta.text}
                        </div>
                    )}
                    <h6 className="mb-2 text-black">Оценка от нейросети</h6>
                    <div className={`flex ${shouldShowSovaMascot ? "flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" : "flex-col"}`}>
                        <div className="flex-1">
                            {sovaLoading ? (
                                <p className="text-gray-500 animate-pulse">Анализирую промпт...</p>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <p className="text-gray-700">{sovaResponse}</p>
                                    {sovaStrongFields.length > 0 && (
                                        <p className="text-sm text-gray-700">
                                            <span className="font-semibold text-black">Сильные поля:</span> {formatFieldList(sovaStrongFields)}
                                        </p>
                                    )}
                                    {sovaWeakFields.length > 0 && (
                                        <p className="text-sm text-gray-700">
                                            <span className="font-semibold text-black">Слабые поля:</span> {formatFieldList(sovaWeakFields)}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                        {shouldShowSovaMascot && (
                            <div className="flex shrink-0 flex-col items-center self-center">
                                <div className="h-[96px] w-[96px] sm:h-[112px] sm:w-[112px]">
                                    <img key={mascotPlaybackKey} src={activeSovaMascotAsset.animatedSrc} alt="" aria-hidden="true" decoding="sync" fetchPriority="high" className="h-full w-full object-contain" />
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
        // Провайдер общий для шапки и панели: переключение урока в лесенке
        // сразу меняет карточку задания, без перезагрузки страницы.
        <ContestLessonsProvider>
            <Header>
                <Header.Heading>МАЯК ОКО</Header.Heading>
                {isContestMode && <ContestLessonStepper />}
                {effectiveTableNumber ? (
                    <div className="inline-flex items-center justify-center !rounded-full border border-slate-200 bg-white !px-3 !py-1.5 !h-8 leading-none text-sm font-semibold text-slate-700 whitespace-nowrap">
                        Стол №{effectiveTableNumber}
                    </div>
                ) : null}
                {selectedRole && (
                    <div style={{ position: "relative" }} className="role-tooltip-wrap">
                        <div className="inline-flex items-center justify-center !rounded-full border border-blue-200 bg-blue-50 !px-3 !py-1.5 !h-8 leading-none text-sm font-semibold text-blue-700 whitespace-nowrap cursor-default">
                            {selectedRole}
                        </div>
                        <div
                            className="role-tooltip"
                            style={{
                                position: "absolute",
                                right: 0,
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
                            {effectiveSecretMission?.text ? (
                                <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #eee" }}>
                                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>
                                        🎯 Тайная миссия
                                    </div>
                                    {effectiveSecretMission.title ? (
                                        <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#111" }}>«{effectiveSecretMission.title}»</div>
                                    ) : null}
                                    <p style={{ fontSize: "12px", color: "#666", lineHeight: "1.5" }}>{effectiveSecretMission.text}</p>
                                </div>
                            ) : null}
                        </div>
                        <style>{`.role-tooltip-wrap:hover .role-tooltip { opacity: 1 !important; visibility: visible !important; }`}</style>
                    </div>
                )}
                {canUseDebugPanel && (
                    <button
                        type="button"
                        onClick={() => setShowBypassMenu((prev) => !prev)}
                        className="inline-flex items-center justify-center gap-1 !rounded-full border border-amber-200 !bg-amber-100 hover:!bg-amber-200 !px-3 !py-1.5 !h-8 leading-none text-sm font-semibold !text-amber-700 cursor-pointer transition-colors !shadow-none !w-auto !flex-initial flex-shrink-0 whitespace-nowrap"
                    >
                        <span className="leading-none">⚙️</span>
                        <span className="leading-none">Отладка</span>
                    </button>
                )}
                {sessionRuntimeState?.participant?.yaDirection && (
                    <div className="inline-flex items-center justify-center !rounded-full border border-teal-200 bg-teal-50 !px-3 !py-1.5 !h-8 leading-none text-sm font-semibold text-teal-700 whitespace-nowrap capitalize cursor-default">
                        Направление: {sessionRuntimeState.participant.yaDirection}
                    </div>
                )}
                {jokerBalance > 0 && (
                    <div
                        className="inline-flex items-center justify-center gap-1 !rounded-full border border-rose-200 bg-rose-50 !px-3 !py-1.5 !h-8 leading-none text-sm font-semibold text-rose-700 whitespace-nowrap cursor-default"
                        title="Звёзды-джокеры: мгновенно засчитывают задание части «Мы» без инспектора">
                        <svg className="w-4 h-4 flex-shrink-0 text-red-500 fill-red-500 drop-shadow-[0_0_3px_rgba(239,68,68,0.6)]" viewBox="0 0 24 24">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                        <span className="leading-none">Джокеры: {jokerBalance}</span>
                    </div>
                )}
                <div className="flex items-center gap-2 ml-auto">
                    {!isContestMode && (
                        <Button
                            icon
                            roundeful
                            disabled={timerState.isRunning}
                            className={`!rounded-full !w-8 !h-8 !p-0 flex items-center justify-center !bg-slate-100 border border-slate-200 hover:!bg-slate-200 ${timerState.isRunning ? "!opacity-40 !cursor-not-allowed !pointer-events-none" : ""}`}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                            onClick={handleOpenHistory}
                            title={timerState.isRunning ? "Недоступно во время выполнения задания" : "История запросов"}>
                            <TimeIcon className="w-[18px] h-[18px] text-slate-700 block" />
                        </Button>
                    )}
                    {isAdmin && (
                        <Button
                            icon
                            roundeful
                            disabled={timerState.isRunning}
                            className={`!rounded-full !w-8 !h-8 !p-0 flex items-center justify-center !bg-slate-100 border border-slate-200 hover:!bg-slate-200 ${timerState.isRunning ? "!opacity-40 !cursor-not-allowed !pointer-events-none" : ""}`}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                            onClick={handleAdminResetSession}
                            title={timerState.isRunning ? "Недоступно во время выполнения задания" : "Сбросить сессию (админ)"}>
                            <svg className="w-[18px] h-[18px] text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                                <path d="M21 3v6h-6" />
                            </svg>
                        </Button>
                    )}
                    {isContestMode ? (
                        // Конкурсный вход — не сессия: завершать нечего, участник
                        // просто возвращается к списку уроков.
                        <Button
                            inverted
                            roundeful
                            className="inline-flex items-center justify-center !rounded-full !py-1.5 !px-3 !h-8 leading-none !text-sm whitespace-nowrap"
                            onClick={() => { window.location.href = "/cours"; }}>
                            Вернуться&nbsp;к&nbsp;урокам
                        </Button>
                    ) : (
                        <Button
                            inverted
                            roundeful
                            className="inline-flex items-center justify-center !rounded-full !bg-(--color-red-noise) !text-(--color-red) !py-1.5 !px-3 !h-8 leading-none !text-sm whitespace-nowrap"
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
                    certificateLoading={completionLoading}
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
                        canUseJoker={currentTaskIsWeDirection && jokerBalance > 0}
                        jokerBalance={jokerBalance}
                        onUseJoker={tokenType === "bypass" ? handleUseBypassJokerStar : handleUseJokerStar}
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
                        canUseJoker={tokenType === "bypass" && who === "we" && jokerBalance > 0}
                        jokerBalance={jokerBalance}
                        onUseJoker={handleUseBypassJokerStar}
                        onClose={() => {
                            setShowCompletionPopup(false);
                        }}
                    />
                ))}
            {showSessionCompletionPopup && <SessionCompletionPopup onClose={handleCloseSessionCompletionPopup} onSave={handleSaveSessionCompletion} />}
            {showRolePopup && <RoleSelectionPopup onClose={handleCloseRolePopup} onConfirm={handleRoleConfirm} />}
            {secretMissionPopup && <SecretMissionPopup mission={secretMissionPopup} onClose={() => setSecretMissionPopup(null)} />}
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
            {showYaDirectionPopup && (
                <YaDirectionSelectionPopup
                    onClose={() => setShowYaDirectionPopup(false)}
                    onConfirm={handleYaDirectionConfirm}
                    takenDirections={sessionRuntimeState?.tableDirections || []}
                    options={yaDirectionOptions}
                />
            )}
            <AchievementToast achievement={activeAchievement} onDismiss={() => setActiveAchievement(null)} />
            {canUseDebugPanel && showBypassMenu && (
                <TrainerDebugPanel
                    position={bypassPosition}
                    onDragStart={handleDragStart}
                    onClose={() => setShowBypassMenu(false)}
                    jokerBalance={jokerBalance}
                    yaProgress={yaProgress}
                    yaDirectionOptions={yaDirectionOptions}
                    panelJokerSpent={panelJokerSpent}
                    onPhaseChange={handleBypassPhaseChange}
                    onProgressChange={handleBypassProgressChange}
                    onWeProgressChange={handleBypassWeProgressChange}
                    onDirectionChange={handleBypassDirectionChange}
                    onJokerSpentChange={handleBypassJokerSpentChange}
                    onResetAchievements={handleResetBypassAchievements}
                />
            )}
        </ContestLessonsProvider>
    );
}


