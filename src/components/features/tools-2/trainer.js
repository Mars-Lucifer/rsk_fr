import { useState, useEffect, useRef, memo, useCallback } from "react";
import Header from "@/components/layout/Header";
import Buffer from "./addons/popup";
import RankingTestPopup from "./addons/RankingTestPopup";

import InfoIcon from "@/assets/general/info.svg";
import LinkIcon from "@/assets/general/link.svg";
import CopyIcon from "@/assets/general/copy.svg";
import TimeIcon from "@/assets/general/time.svg";
import Plusicon from "@/assets/general/plus.svg";
import SettsIcon from "@/assets/general/setts.svg";
import RandomIcon from "@/assets/general/random.svg";
import ResetIcon from "@/assets/general/ResetIcon.svg";
import TelegramIcon from "@/assets/general/TelegramIcon.svg";
import TopIcon from "@/assets/general/TopIcon.svg";
import HotIcon from "@/assets/general/HotIcon.svg";

// Добавляем getUserFromCookies
import { getKeyFromCookies, getUserFromCookies, removeKeyCookie } from "./actions";
// Добавляем эти две строки для работы сертификата
import { pdf } from "@react-pdf/renderer";
import Certificate from "./Certificate";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import TextareaAutosize from "react-textarea-autosize";
import Input from "@/components/ui/Input/Input";
import CourseIcon from "@/assets/nav/course.svg";
import Button from "@/components/ui/Button";
import Switcher from "@/components/ui/Switcher";

import Block from "@/components/features/public/Block";

import { STATIC_MAYAK_DATA } from "../../../../data/mayakDataConst";

const TRAINER_PREFIX = "trainer_v2"; // Уникальный префикс для этого тренажера
const getStorageKey = (key) => `${TRAINER_PREFIX}_${key}`;

const getRange = (taskNumber) => {
    const start = Math.floor((taskNumber - 1) / 100) * 100 + 1;
    const end = start + 99;
    return `${start}-${end}`;
};

const CONSTANTS = {
    STORAGE_KEYS: {
        USER_ROLE: "userRole",
        TASK_VERSION: "taskVersion",
        COMPLETED_TASKS: "completedTasks",
        HISTORY: "history",
        BUFFER: "buffer",
        HAS_COMPLETED_SECOND_QUESTIONNAIRE: "hasCompletedSecondQuestionnaire",
    },
    USER_TYPES: {
        STUDENT: "student",
        TEACHER: "teacher",
    },
    WHO_TYPES: {
        IM: "im",
        WE: "we",
    },
    TASK_VERSIONS: {
        V1: "v1",
        V2: "v2",
    },
    POPUP_TYPES: {
        NONE: null,
        ROLE: "role",
        CONFIRMATION: "confirmation",
        FIRST_QUESTIONNAIRE: "firstQuestionnaire",
        SECOND_QUESTIONNAIRE: "secondQuestionnaire",
        THIRD_QUESTIONNAIRE: "thirdQuestionnaire",
        IMAGE: "image",
        COMPLETION: "completion",
        SESSION_COMPLETION: "sessionCompletion",
        BUFFER: "buffer",
    },
    CORRECT_TOKENS: [
        "MA8YQ-OKO2V-P3XZM-LR9QD-K7N4E",
        "JX3FQ-7B2WK-9PL8D-M4R6T-VN5YH",
        "KL9ZD-4WX7M-P2Q8R-T6H3Y-F5V1E",
        "QZ4R7-M8N3K-L2P9D-X6Y1T-VB5WU",
        "D9F2K-5T7XJ-R3M8P-Y4N6Q-W1VHZ",
        "T3Y8H-P6K2M-9D4R7-Q1X5W-LN9VZ",
        "R7W4E-K2N5D-M8P3Q-Y1T6X-V9BZJ",
        "H5L9M-3X2P8-Q6R4T-K1Y7W-N9VZD",
        "F2K8J-4D7N3-P5Q9R-M1W6X-T3YVH",
        "B6N9Q-1M4K7-R3T8P-Y2X5W-Z7VHD",
        "W4P7Z-2K9N5-D3R8M-Q1Y6T-X5VHB",
    ],
};

// =================================================================
// ПОЛЬЗОВАТЕЛЬСКИЕ ХУКИ
// =================================================================

/**
 * Хук для управления состоянием и логикой попапов
 */
const usePopups = () => {
    const [activePopup, setActivePopup] = useState(CONSTANTS.POPUP_TYPES.NONE);
    const [popupProps, setPopupProps] = useState({});

    const showPopup = useCallback((type, props = {}) => {
        setActivePopup(type);
        setPopupProps(props);
    }, []);

    const hidePopup = useCallback(() => {
        setActivePopup(CONSTANTS.POPUP_TYPES.NONE);
        setPopupProps({});
    }, []);

    return { activePopup, popupProps, showPopup, hidePopup };
};

/**
 * Хук для управления задачами тренажера
 */
const useTaskManager = ({ userType, who, taskVersion, isTokenValid, tokenTaskRange, tokenSectionId }) => {
    const [tasks, setTasks] = useState([]);
    const [tasksTexts, setTasksTexts] = useState([]);
    const [currentTaskIndex, setCurrentTaskIndex] = useState(() => {
        try {
            const saved = sessionStorage.getItem(getStorageKey("currentTaskIndex"));
            if (saved !== null) return parseInt(saved, 10);
        } catch {}
        return 0;
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timerState, setTimerState] = useState(() => {
        try {
            const saved = sessionStorage.getItem("trainer_v2_taskTimer");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.isRunning && parsed.startTime) {
                    const elapsed = Math.floor((Date.now() - parsed.startTime) / 1000);
                    const MAX_TIMER_SECONDS = 3 * 60 * 60; // 3 часа
                    // Если таймер "висит" дольше 3 часов — сбрасываем
                    if (elapsed > MAX_TIMER_SECONDS) {
                        sessionStorage.removeItem("trainer_v2_taskTimer");
                        return {
                            isRunning: false,
                            startTime: null,
                            elapsedTime: 0,
                            readyElapsedTime: null,
                        };
                    }
                    return {
                        isRunning: true,
                        startTime: parsed.startTime,
                        elapsedTime: elapsed,
                        readyElapsedTime: null,
                    };
                }
                return {
                    isRunning: parsed.isRunning || false,
                    startTime: parsed.startTime || null,
                    elapsedTime: parsed.elapsedTime || 0,
                    readyElapsedTime: parsed.readyElapsedTime || null,
                };
            }
        } catch {}
        return {
            isRunning: false,
            startTime: null,
            elapsedTime: 0,
            readyElapsedTime: null,
        };
    });
    const timerRef = useRef(null);

    const currentTask = tasks[currentTaskIndex] || null;

    // Проверка, доступно ли текущее задание по токену
    const isCurrentTaskAllowed = (() => {
        if (!tokenTaskRange) return true;

        // Получаем номер текущего задания
        // Пытаемся взять из currentTask.number, иначе используем индекс + 1
        let taskNum;
        if (currentTask && currentTask.number) {
            taskNum = parseInt(currentTask.number, 10);
        } else {
            taskNum = currentTaskIndex + 1;
        }

        const [startStr, endStr] = tokenTaskRange.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        if (isNaN(start) || isNaN(end)) return true;

        return taskNum >= start && taskNum <= end;
    })();

    const basePath = taskVersion === "v2" ? `/tasks-2/${taskVersion}` : `/tasks-2/${taskVersion}/${userType}/${who}`;

    const taskRange = currentTask?._range || (taskVersion === "v2" ? getRange(currentTaskIndex + 1) : null);
    const rangePath = taskVersion === "v2" && taskRange ? `${basePath}/${taskRange}` : basePath;

    const instructionFileUrl = currentTask?.instruction ? `${rangePath}/Instructions/${currentTask.instruction}` : "";
    const taskFileUrl = currentTask?.file ? `${rangePath}/Files/${currentTask.file}` : "";

    // --- НОВАЯ ЛОГИКА: ССЫЛКА ИЛИ ФАЙЛ В ПАПКЕ SOURCE ---
    let sourceUrl = "";
    if (currentTask?.sourceLink) {
        if (currentTask.sourceLink.startsWith("http") || currentTask.sourceLink.startsWith("www")) {
            // Это внешняя ссылка
            sourceUrl = currentTask.sourceLink;
        } else {
            // Это файл, ищем его в папке 'source' (как на скриншоте)
            sourceUrl = `${basePath}/source/${currentTask.sourceLink}`;
        }
    }
    // ---------------------------------------------------

    // Сохраняем currentTaskIndex в sessionStorage при каждом изменении
    useEffect(() => {
        try {
            sessionStorage.setItem(getStorageKey("currentTaskIndex"), currentTaskIndex.toString());
        } catch {}
    }, [currentTaskIndex]);

    useEffect(() => {
        const loadTasks = async () => {
            if (!isTokenValid) return;
            setIsLoading(true);
            setError(null);
            try {
                let tasksData;
                let tasksTextsData;

                if (taskVersion === "v2") {
                    if (tokenSectionId) {
                        // Загружаем ТОЛЬКО одну папку по sectionId вместо всего manifest
                        const indexRes = await fetch(`${basePath}/${tokenSectionId}/index.json`);
                        if (!indexRes.ok) throw new Error(`Не удалось загрузить index.json для раздела ${tokenSectionId}: ${indexRes.status}`);
                        const data = await indexRes.json();

                        // Берём rangeStart/rangeEnd из meta.json
                        const metaRes = await fetch(`${basePath}/${tokenSectionId}/meta.json`);
                        let rangeStart = 1;
                        let rangeEnd = 100;
                        if (metaRes.ok) {
                            const meta = await metaRes.json();
                            rangeStart = meta.rangeStart || 1;
                            rangeEnd = meta.rangeEnd || (rangeStart + data.length - 1);
                        }

                        const startPos = rangeStart - 1;
                        tasksData = new Array(rangeEnd).fill(null).map(() => ({ file: "", instruction: "", toolLink1: "", toolName1: "" }));
                        for (let i = 0; i < data.length; i++) {
                            tasksData[startPos + i] = { ...data[i], _range: tokenSectionId };
                        }

                        // TaskText.json — тоже из одной папки
                        const textRes = await fetch(`${basePath}/${tokenSectionId}/TaskText.json`);
                        tasksTextsData = textRes.ok ? await textRes.json() : [];
                    } else {
                    // Загружаем manifest со списком диапазонов
                    const manifestRes = await fetch(`${basePath}/manifest.json`);
                    if (!manifestRes.ok) throw new Error(`Не удалось загрузить manifest: ${manifestRes.status}`);
                    const ranges = await manifestRes.json();

                    // Определяем максимальную позицию, чтобы создать массив правильного размера
                    const maxEnd = Math.max(...ranges.map((r) => parseInt(r.split("-")[1], 10)));

                    // Параллельно загружаем index.json из каждого диапазона
                    const indexPromises = ranges.map((range) =>
                        fetch(`${basePath}/${range}/index.json`)
                            .then((r) => (r.ok ? r.json() : []))
                            .then((data) => ({ range, data }))
                    );
                    const allIndexResults = await Promise.all(indexPromises);

                    // Собираем массив с правильными позициями (заполняем пропуски пустышками)
                    tasksData = new Array(maxEnd).fill(null).map(() => ({ file: "", instruction: "", toolLink1: "", toolName1: "" }));
                    for (const { range, data } of allIndexResults) {
                        const startPos = parseInt(range.split("-")[0], 10) - 1; // "201-300" → индекс 200
                        for (let i = 0; i < data.length; i++) {
                            tasksData[startPos + i] = { ...data[i], _range: range };
                        }
                    }

                    // Параллельно загружаем TaskText.json из каждого диапазона
                    const textPromises = ranges.map((range) =>
                        fetch(`${basePath}/${range}/TaskText.json`)
                            .then((r) => (r.ok ? r.json() : []))
                    );
                    const allTextArrays = await Promise.all(textPromises);
                    tasksTextsData = allTextArrays.flat();
                    }
                } else {
                    // Старая логика для не-v2 версий
                    const tasksResponse = await fetch(`${basePath}/index.json`);
                    if (!tasksResponse.ok) throw new Error(`Не удалось загрузить задания: ${tasksResponse.status}`);
                    tasksData = await tasksResponse.json();

                    const textsResponse = await fetch(`${basePath}/TaskText.json`);
                    if (!textsResponse.ok) throw new Error("Не удалось загрузить тексты заданий");
                    tasksTextsData = await textsResponse.json();
                }

                setTasks(tasksData);
                setTasksTexts(tasksTextsData);

                // Восстанавливаем сохранённый индекс из sessionStorage
                try {
                    const saved = sessionStorage.getItem(getStorageKey("currentTaskIndex"));
                    if (saved !== null) {
                        const savedIdx = parseInt(saved, 10);
                        if (!isNaN(savedIdx) && savedIdx >= 0 && savedIdx < tasksData.length) {
                            setCurrentTaskIndex(savedIdx);
                        } else if (tokenTaskRange) {
                            // Сохранённый индекс невалиден — ставим на начало диапазона
                            const [startStr] = tokenTaskRange.split("-");
                            const start = parseInt(startStr, 10);
                            if (!isNaN(start)) {
                                const startIndex = tasksData.findIndex((t) => parseInt(t.number, 10) >= start);
                                setCurrentTaskIndex(startIndex !== -1 ? startIndex : 0);
                            } else {
                                setCurrentTaskIndex(0);
                            }
                        } else {
                            setCurrentTaskIndex(0);
                        }
                    } else if (tokenTaskRange) {
                        // Нет сохранённого индекса — первый вход, ставим на начало диапазона
                        const [startStr] = tokenTaskRange.split("-");
                        const start = parseInt(startStr, 10);
                        if (!isNaN(start)) {
                            const startIndex = tasksData.findIndex((t) => parseInt(t.number, 10) >= start);
                            setCurrentTaskIndex(startIndex !== -1 ? startIndex : 0);
                        }
                    }
                } catch {
                    setCurrentTaskIndex(0);
                }

                if (tasksData.length === 0) {
                    setError("Нет доступных заданий");
                }
            } catch (err) {
                setError(err.message);
                setTasks([]);
                setTasksTexts([]);
            } finally {
                setIsLoading(false);
            }
        };
        loadTasks();
    }, [userType, who, taskVersion, isTokenValid, basePath, tokenSectionId]);

    const startTimer = useCallback(() => {
        const now = Date.now();
        setTimerState({ isRunning: true, startTime: now, elapsedTime: 0, readyElapsedTime: null });
        try {
            sessionStorage.setItem("trainer_v2_taskTimer", JSON.stringify({ isRunning: true, startTime: now, elapsedTime: 0 }));
        } catch {}
        timerRef.current = setInterval(() => {
            setTimerState((prev) => {
                const elapsed = Math.floor((Date.now() - prev.startTime) / 1000);
                return { ...prev, elapsedTime: elapsed };
            });
        }, 1000);
    }, []);

    const stopTimer = useCallback(() => {
        clearInterval(timerRef.current);
        setTimerState((prev) => {
            const final = { ...prev, isRunning: false, readyElapsedTime: prev.elapsedTime };
            try {
                sessionStorage.removeItem("trainer_v2_taskTimer");
            } catch {}
            return final;
        });
    }, []);

    // При монтировании: если таймер был запущен (восстановлен из sessionStorage), запускаем интервал
    useEffect(() => {
        if (timerState.isRunning && timerState.startTime && !timerRef.current) {
            timerRef.current = setInterval(() => {
                setTimerState((prev) => {
                    const elapsed = Math.floor((Date.now() - prev.startTime) / 1000);
                    return { ...prev, elapsedTime: elapsed };
                });
            }, 1000);
        }
        return () => {
            clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, []);

    const goToTask = useCallback(
        (index) => {
            if (index >= 0 && index < tasks.length) {
                setCurrentTaskIndex(index);
            }
        },
        [tasks.length, setCurrentTaskIndex]
    );

    const nextTask = useCallback(() => goToTask(currentTaskIndex + 1), [currentTaskIndex, goToTask]);
    const prevTask = useCallback(() => goToTask(currentTaskIndex - 1), [currentTaskIndex, goToTask]);

    return {
        tasks,
        currentTask,
        currentTaskIndex,
        isLoading,
        error,
        timerState,
        startTimer,
        stopTimer,
        goToTask,
        nextTask,
        prevTask,
        instructionFileUrl,
        taskFileUrl,
        sourceUrl,
        basePath,
        tasksTexts,
        setError,
        isCurrentTaskAllowed,
    };
};

const AdminIconComponent = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <path d="M12 11.13a3 3 0 1 0-3.87 3.87"></path>
    </svg>
);

const AdminIcon = memo(AdminIconComponent);

const copyToClipboard = (text) => {
    if (!text) return Promise.reject("No text to copy");

    // Проверяем, доступен ли Clipboard API и находимся ли мы в безопасном контексте
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        // Fallback для старых браузеров или небезопасного контекста
        console.warn("Clipboard API not available, falling back to execCommand.");
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.top = "-9999px";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand("copy");
            document.body.removeChild(textArea);
            return successful ? Promise.resolve() : Promise.reject("execCommand failed");
        } catch (err) {
            document.body.removeChild(textArea);
            console.error("Fallback copy failed", err);
            return Promise.reject(err);
        }
    }
};

const RoleSelectionPopup = ({ onClose, onConfirm }) => {
    const roles = ["ИНЖЕНЕР", "МЕДИАТОР", "ХРАНИТЕЛЬ МАЯКА", "ИНСПЕКТОР", "КАПИТАН", "ЛЕТОПИСЕЦ"];
    const [currentSelection, setCurrentSelection] = useState(null);

    const handleConfirm = () => {
        if (currentSelection) {
            onConfirm(currentSelection);
        } else {
            alert("Пожалуйста, выберите роль.");
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-2xl border border-gray-200 pointer-events-auto">
                <div className="mb-4">
                    <h3 className="text-xl font-bold">Выберите роль в команде</h3>
                </div>
                <div className="space-y-3 mb-6">
                    {roles.map((role) => (
                        <label key={role} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input type="radio" name="role" value={role} checked={currentSelection === role} onChange={() => setCurrentSelection(role)} className="form-radio h-5 w-5 text-blue-600" />
                            <span className="font-medium">{role}</span>
                        </label>
                    ))}
                </div>
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose} className="!bg-gray-100 !text-gray-800 hover:!bg-gray-200">
                        Отмена
                    </Button>
                    <Button onClick={handleConfirm} className="!bg-blue-500 !text-white hover:!bg-blue-600">
                        Подтвердить
                    </Button>
                </div>
            </div>
        </div>
    );
};
const sortByOrder = (a, b) => {
    const orderA = isNaN(Number(a.order)) ? Infinity : Number(a.order);
    const orderB = isNaN(Number(b.order)) ? Infinity : Number(b.order);
    return orderA - orderB;
};

const ServiceIcon = memo(function ServiceIcon({ type }) {
    const iconProps = { className: "w-5 h-5 flex-shrink-0" };
    switch (type) {
        case "top":
            return <TopIcon {...iconProps} />;
        case "telegram":
            return <TelegramIcon {...iconProps} />;
        case "hot":
            return <HotIcon {...iconProps} />;
        default:
            return <LinkIcon {...iconProps} />;
    }
});

const ConfirmationPopup = memo(function ConfirmationPopup({ title, message, confirmText, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold">{title || "Подтверждение"}</h3>
                    <button onClick={onCancel} className="square text-gray-500 hover:text-gray-700">
                        ✕
                    </button>
                </div>

                <div className="big mb-6">{message}</div>

                <div className="flex justify-end gap-2">
                    <Button onClick={onCancel} className="!bg-gray-100 !text-gray-800 hover:!bg-gray-200">
                        Отмена
                    </Button>
                    <Button onClick={onConfirm} className="!bg-blue-500 !text-white hover:!bg-blue-600">
                        {confirmText || "Подтвердить"}
                    </Button>
                </div>
            </div>
        </div>
    );
});

const FirstQuestionnairePopup = memo(function FirstQuestionnairePopup({ onClose, onSubmit }) {
    const [aiLevel, setAiLevel] = useState(5);
    const [aiUsage, setAiUsage] = useState("");
    const [aiTasks, setAiTasks] = useState("");
    const [selectedTools, setSelectedTools] = useState([]);
    const [desiredSkills, setDesiredSkills] = useState("");
    const [personalGoal, setPersonalGoal] = useState("");

    const toolsList = [
        { category: "Текст", tools: ["ChatGPT", "YandexGPT", "AiStudio", "GigaChat", "Claude", "DeepSeek"] },
        { category: "Аудио", tools: ["Suno", "ElevenLabs", "AiStudio (speech generation)"] },
        { category: "Изображение", tools: ["Midjourney", "Kandinsky", "Recraft", "Leonardo.Ai", "AiStudio (Imagen 4)"] },
        { category: "Видео", tools: ["PixelVerse", "Pictory AI", "KlingAi", "AiStudio (Veo)"] },
        { category: "Данные", tools: ["Napkin"] },
        { category: "Интерактив", tools: ["Websim", "Genspark", "Lovable"] },
    ];

    const handleToolToggle = (tool) => {
        setSelectedTools((prev) => (prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]));
    };

    const handleSubmit = () => {
        if (!aiUsage || !desiredSkills) {
            alert("Пожалуйста, заполните обязательные поля");
            return;
        }

        onSubmit({
            aiLevel,
            aiUsage,
            aiTasks: aiUsage.includes("Да") ? aiTasks : "",
            selectedTools,
            desiredSkills,
            personalGoal,
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold">Анкета №1: Входная диагностика («Точка А»)</h3>
                    <button onClick={onClose} className="square text-gray-500 hover:text-gray-700">
                        ✕
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Вопрос 1 */}
                    <div>
                        <label className="block mb-2 font-medium">
                            1. Оцените ваш текущий практический уровень владения инструментами ИИ:
                            <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-4">
                            <span className="text-sm w-16">0 (Новичок)</span>
                            <input type="range" min="0" max="10" value={aiLevel} onChange={(e) => setAiLevel(parseInt(e.target.value))} className="w-full" />
                            <span className="text-sm w-24">10 (Эксперт)</span>
                        </div>
                        <div className="text-center mt-2 font-medium">{aiLevel}</div>
                        <p className="text-sm text-gray-500 mt-1">
                            0 = Никогда не пользовался(ась), не знаю, с чего начать.
                            <br />
                            5 = Иногда использую знакомые инструменты для простых задач.
                            <br />
                            10 = Свободно и регулярно применяю разные ИИ-инструменты.
                        </p>
                    </div>

                    <div>
                        <label className="block mb-2 font-medium">
                            2. Применяете ли вы ИИ в своей текущей работе или учебе?
                            <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-2">
                            {["Да, применяю регулярно", "Да, применяю время от времени", "Пробовал(а) несколько раз, но системно не использую", "Нет, не применяю"].map((option) => (
                                <label key={option} className="flex items-center gap-2">
                                    <input type="radio" name="aiUsage" checked={aiUsage === option} onChange={() => setAiUsage(option)} />
                                    {option}
                                </label>
                            ))}
                        </div>
                    </div>

                    {aiUsage.includes("Да") && (
                        <div>
                            <label className="block mb-2 font-medium">3. Если применяете, то для решения каких задач?</label>
                            <textarea value={aiTasks} onChange={(e) => setAiTasks(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md h-24" placeholder="Опишите своими словами..." />
                            <p className="text-sm text-gray-500 mt-1">Пример: для написания постов в соцсети, для анализа данных, для создания картинок к презентациям.</p>
                        </div>
                    )}

                    <div>
                        <label className="block mb-2 font-medium">4. Какими из перечисленных ИИ-инструментов вы уже пользовались хотя бы раз?</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {toolsList.map((category) => (
                                <div key={category.category} className="border p-3 rounded-lg">
                                    <h4 className="font-medium mb-2">{category.category}:</h4>
                                    <div className="space-y-2">
                                        {category.tools.map((tool) => (
                                            <label key={tool} className="flex items-center gap-2">
                                                <input type="checkbox" checked={selectedTools.includes(tool)} onChange={() => handleToolToggle(tool)} />
                                                {tool}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block mb-2 font-medium">
                            5. Какие конкретные знания или навыки в области ИИ вы больше всего надеетесь получить на тренажере?
                            <span className="text-red-500">*</span>
                        </label>
                        <textarea value={desiredSkills} onChange={(e) => setDesiredSkills(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md h-24" placeholder="Опишите, что хотите изучить..." required />
                    </div>

                    <div>
                        <label className="block mb-2 font-medium">6. Что для вас будет наилучшим личным результатом участия в этом тренажере?</label>
                        <textarea value={personalGoal} onChange={(e) => setPersonalGoal(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md h-24" placeholder="Закончите фразу: 'В конце тренинга я хочу...'" />
                        <p className="text-sm text-gray-500 mt-1">Пример: &quot;...побороть страх перед нейросетями&quot;, &quot;...найти 2-3 инструмента для своей работы&quot;</p>
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <Button onClick={onClose} className="!bg-gray-100 !text-gray-800 hover:!bg-gray-200">
                            Пропустить
                        </Button>
                        <Button onClick={handleSubmit} className="!bg-blue-500 !text-white hover:!bg-blue-600">
                            Сохранить ответы
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
});

const SecondQuestionnairePopup = memo(function SecondQuestionnairePopup({ onClose, onSubmit }) {
    const [confidence, setConfidence] = useState(5);
    const [understanding, setUnderstanding] = useState(5);
    const [insight, setInsight] = useState("");

    const handleSubmit = () => {
        if (!insight.trim()) {
            alert('Пожалуйста, заполните поле "Главный вывод"');
            return;
        }
        onSubmit({
            confidence,
            understanding,
            insight,
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold">Короткий привал: рефлексия после этапа «Я»</h3>
                    <button onClick={onClose} className="square text-gray-500 hover:text-gray-700">
                        ✕
                    </button>
                </div>

                <div className="space-y-6">
                    <label className="block mb-2 font-medium">Вы отлично поработали индивидуально! Давайте зафиксируем ваши ощущения.</label>

                    <div>
                        <label className="block mb-2 font-medium">1. Оцените вашу УВЕРЕННОСТЬ в работе с ИИ прямо сейчас, после этапа «Я – Цифровой Эксперт»:</label>
                        <div className="flex items-center gap-4">
                            <span className="text-sm">1 (не уверен)</span>
                            <input type="range" min="1" max="10" value={confidence} onChange={(e) => setConfidence(parseInt(e.target.value))} className="w-full" />
                            <span className="text-sm">10 (очень уверен)</span>
                        </div>
                        <div className="text-center mt-2 font-medium">{confidence}</div>
                    </div>

                    <div>
                        <label className="block mb-2 font-medium">2. Насколько вы поняли и готовы применять на практике фреймворк «МАЯК ОКО»?</label>
                        <div className="flex items-center gap-4">
                            <span className="text-sm">1 (ничего не понял)</span>
                            <input type="range" min="1" max="10" value={understanding} onChange={(e) => setUnderstanding(parseInt(e.target.value))} className="w-full" />
                            <span className="text-sm">10 (всё ясно)</span>
                        </div>
                        <div className="text-center mt-2 font-medium">{understanding}</div>
                    </div>

                    <div>
                        <label className="block mb-2 font-medium">3. Ваш главный вывод или «инсайт» о себе на данный момент?</label>
                        <textarea value={insight} onChange={(e) => setInsight(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md h-24" placeholder="Опишите ваш главный вывод..." />
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <Button onClick={onClose} className="!bg-gray-100 !text-gray-800 hover:!bg-gray-200">
                            Пропустить
                        </Button>
                        <Button onClick={handleSubmit} className="!bg-blue-500 !text-white hover:!bg-blue-600">
                            Сохранить ответы
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
});

const ThirdQuestionnairePopup = memo(function ThirdQuestionnairePopup({ onClose, onSave }) {
    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="relative bg-white p-6 rounded-lg max-w-md w-full shadow-2xl border border-gray-200 pointer-events-auto">
                <div className="mb-4">
                    <h3 className="text-xl font-bold">Завершение сессии</h3>
                </div>

                <div className="mt-6 flex justify-center gap-2">
                    <Button onClick={onClose} className="!bg-gray-200 !text-gray-800 hover:!bg-gray-300 flex-1">
                        Отмена
                    </Button>
                    <Button
                        onClick={() => {
                            if (onClose) onClose();
                            window.__openRankingTestPopup && window.__openRankingTestPopup();
                        }}
                        className="!bg-gray-100 !text-gray-800 hover:!bg-gray-200 flex-1">
                        Пройти Тестирование
                    </Button>
                    <Button onClick={() => onSave({})} className="!bg-blue-500 !text-white hover:!bg-blue-600 flex-1">
                        Сохранить и завершить
                    </Button>
                </div>
            </div>
        </div>
    );
});

const SessionCompletionPopup = memo(function SessionCompletionPopup({ onClose, onSave }) {
    const [levels, setLevels] = useState({
        level1: "",
        level2: "",
        level3: "",
        level4: "",
        level5: "",
    });

    const handleLevelChange = (level, value) => {
        setLevels((prev) => ({
            ...prev,
            [level]: value,
        }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold">Завершение сессии</h3>
                    <button onClick={onClose} className="square text-gray-500 hover:text-gray-700">
                        ✕
                    </button>
                </div>

                <div className="space-y-4">
                    <p>Пожалуйста, заполните измерения Delta для завершения сессии:</p>

                    <div className="grid grid-cols-2 gap-2">
                        <Input type="number" placeholder="Уровень 1" value={levels.level1} onChange={(e) => handleLevelChange("level1", e.target.value)} />
                        <Input type="number" placeholder="Уровень 2" value={levels.level2} onChange={(e) => handleLevelChange("level2", e.target.value)} />
                        <Input type="number" placeholder="Уровень 3" value={levels.level3} onChange={(e) => handleLevelChange("level3", e.target.value)} />
                        <Input type="number" placeholder="Уровень 4" value={levels.level4} onChange={(e) => handleLevelChange("level4", e.target.value)} />
                        <Input type="number" placeholder="Уровень 5" value={levels.level5} onChange={(e) => handleLevelChange("level5", e.target.value)} />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <Button
                        onClick={() => {
                            if (onClose) onClose();
                            window.__openRankingTestPopup && window.__openRankingTestPopup();
                        }}
                        className="!bg-gray-100 !text-gray-800 hover:!bg-gray-200">
                        Пройти Тестирование
                    </Button>
                    <Button onClick={() => onSave(levels)} className="!bg-blue-500 !text-white hover:!bg-blue-600">
                        Сохранить и завершить
                    </Button>
                </div>
            </div>
        </div>
    );
});

const TaskCompletionPopup = memo(function TaskCompletionPopup({ taskData, onClose, elapsedTime }) {
    // --- НАЧАЛО ДОБАВЛЕННОЙ ЛОГИКИ ---
    const [levels, setLevels] = useState({
        level1: "",
        level2: "",
        level3: "",
        level4: "",
        level5: "",
    });

    const handleLevelChange = (level, value) => {
        setLevels((prev) => ({
            ...prev,
            [level]: value,
        }));
    };

    const isSaveDisabled = !Object.values(levels).some((level) => level !== "");
    // --- КОНЕЦ ДОБАВЛЕННОЙ ЛОГИКИ ---

    const [isCopied, setIsCopied] = useState(false);

    if (!taskData) return null;

    const formatTaskTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const handleCopyClick = () => {
        const textToCopy = `Задание №${taskData.number}\n\nОписание:\n${taskData.description}\n\nЗадача:\n${taskData.task}\n\nРезультат:\n\n`;
        copyToClipboard(textToCopy)
            .then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            })
            .catch((err) => {
                console.error("Ошибка копирования:", err);
                alert("Не удалось скопировать текст.");
            });
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto">
                <div className="mb-4">
                    <h3 className="text-xl font-bold">Задание завершено за {formatTaskTime(elapsedTime)}</h3>
                </div>

                {/* Здесь вы, вероятно, вставили свой код с полями Input. */}
                {/* Теперь он будет работать, так как переменная 'levels' определена. */}
                {/* Например: */}
                {/* <div className="grid grid-cols-2 gap-2">
                      <Input type="number" placeholder="Уровень 1" value={levels.level1} onChange={(e) => handleLevelChange("level1", e.target.value)} />
                      ... и так далее для остальных уровней
                    </div> */}

                <div className="space-y-4">
                    <Button onClick={handleCopyClick} className="!py-2 !px-4" disabled={isCopied}>
                        {isCopied ? "Скопировано!" : "Скопировать задание"}
                    </Button>
                    <div className="flex items-center justify-between bg-yellow-50 p-3 rounded-lg">
                        <h4 className="font-semibold text-yellow-800">Задание №{taskData.number}</h4>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-800 mb-2">Описание ситуации:</h4>
                        <p className="whitespace-pre-line">{taskData.description}</p>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-800 mb-2">Вашей задачей было:</h4>
                        <p className="whitespace-pre-line">{taskData.task}</p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <Button onClick={onClose} className="!bg-gray-100 !text-gray-800 hover:!bg-gray-200">
                        Закрыть
                    </Button>
                </div>
            </div>
        </div>
    );
});

const MayakField = memo(function MayakField({ field, value, isMobile, disabled, onChange, onShowBuffer, onAddToBuffer, onRandom, savedField }) {
    const { code, label } = field;
    const placeholder = label.split(" - ")[1];

    const handleChange = (e) => onChange(code, e.target.value);
    const handleShowBuffer = () => onShowBuffer(code);
    const handleAddToBuffer = () => onAddToBuffer(code);
    const handleRandom = () => onRandom(code);

    return (
        <div className="flex w-full items-center gap-4">
            <span className="w-6 text-center font-bold text-lg text-gray-400">{label.charAt(0)}</span>
            <div className="group flex-1 flex w-full items-start gap-2">
                {isMobile ? (
                    <>
                        <div className="flex-1 min-w-0 flex flex-col">
                            <div className="input-wrapper w-full">
                                <TextareaAutosize
                                    minRows={1}
                                    className="w-full resize-none bg-transparent outline-none text-black"
                                    placeholder={placeholder}
                                    value={value}
                                    onChange={handleChange}
                                    disabled={disabled}
                                />
                                {value && (
                                    <p className="text-xs text-gray-400 pb-2 pl-[0.875rem] opacity-70">
                                        {label}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                            <Button icon type="button" onClick={handleShowBuffer} disabled={disabled} title="Сохраненные варианты">
                                <CopyIcon />
                            </Button>
                            <div className="relative">
                                <Button icon type="button" onClick={handleAddToBuffer} disabled={disabled} title="Сохранить">
                                    <Plusicon />
                                </Button>
                                {savedField === code && (
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg whitespace-nowrap z-10 transition-opacity duration-300">
                                        Сохранено
                                    </span>
                                )}
                            </div>
                            <Button icon type="button" onClick={handleRandom} disabled={disabled} title="Случайный вариант">
                                <RandomIcon />
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex-1 min-w-0 flex flex-col">
                            <div className="input-wrapper w-full">
                                <TextareaAutosize
                                    minRows={1}
                                    className="w-full resize-none bg-transparent outline-none text-black"
                                    placeholder={placeholder}
                                    value={value}
                                    onChange={handleChange}
                                    disabled={disabled}
                                />
                                {value && (
                                    <p className="text-xs text-gray-400 pb-2 pl-[0.875rem] opacity-70">
                                        {label}
                                    </p>
                                )}
                            </div>
                        </div>
                        <Button icon className="!flex lg:!hidden lg:group-hover:!flex" onClick={handleShowBuffer} type="button" disabled={disabled} title="Сохраненные варианты">
                            <CopyIcon />
                        </Button>
                        <div className="relative !flex lg:!hidden lg:group-hover:!flex">
                            <Button icon className="!flex" onClick={handleAddToBuffer} type="button" disabled={disabled} title="Сохранить">
                                <Plusicon />
                            </Button>
                            {savedField === code && (
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg whitespace-nowrap z-50 transition-opacity duration-300 pointer-events-none">
                                    Сохранено
                                </span>
                            )}
                        </div>
                        <Button icon className="!flex lg:!hidden lg:group-hover:!flex" onClick={handleRandom} type="button" disabled={disabled} title="Случайный вариант">
                            <RandomIcon />
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
});

const TrainerControls = memo(function TrainerControls({
    userType,
    who,
    taskVersion,
    currentTaskIndex,
    tasks,
    taskInputValue,
    isTaskRunning,
    taskElapsedTime,
    instructionFileUrl,
    taskFileUrl,
    sourceUrl,
    currentTask,
    isCurrentTaskAllowed,
    levels,
    showLevelsInput,
    selectedRole,
    onUserTypeChange,
    onWhoChange,
    onTaskVersionChange,
    onPrevTask,
    onNextTask,
    onTaskInputChange,
    onTaskInputCommit,
    onToggleTaskTimer,
    onCompleteSession,
    onShowRolePopup,
    onLevelChange,
    onSaveMeasurements,
    onToolLink1Click,
}) {
    const formatTaskTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div className="flex flex-col gap-[1.6rem]">
            <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-4 lg:gap-[1.6rem]">
                    <h3>Тренажёр</h3>
                    {selectedRole && <div className="text-sm font-bold text-blue-600 p-2 bg-blue-100 rounded-lg whitespace-nowrap">{selectedRole}</div>}
                </div>
                <div className="flex gap-[0.5rem]">
                    <Button inverted className="!bg-(--color-red-noise) !text-(--color-red)" onClick={onCompleteSession}>
                        Завершить&nbsp;сессию
                    </Button>
                </div>
            </div>
            {taskVersion !== "v2" && (
                <div className="flex gap-[0.5rem]">
                    <Switcher
                        value={who}
                        onChange={onWhoChange}
                        className="!w-full">
                        <Switcher.Option value="im">Я</Switcher.Option>
                        <Switcher.Option value="we">Мы</Switcher.Option>
                    </Switcher>
                </div>
            )}

            <div className="flex flex-col gap-[0.75rem]">
                <div className="flex flex-col gap-[0.75rem]">
                    <div className="flex items-center gap-[0.5rem]">
                        <span className="text-sm text-gray-500">Задание №{tasks.length > 0 ? currentTaskIndex + 1 : 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button className="!w-10 !h-10 !p-0 flex items-center justify-center" onClick={onPrevTask} disabled={currentTaskIndex === 0 || isTaskRunning}>
                            ←
                        </Button>
                        <Input type="text" inputMode="numeric" min="1" max={tasks.length || 1} value={taskInputValue} onChange={onTaskInputChange} className="text-center !w-15 !h-10" disabled={isTaskRunning} />
                        <Button className="!w-10 !h-10 !p-0 flex items-center justify-center" onClick={onNextTask} disabled={currentTaskIndex >= tasks.length - 1 || isTaskRunning}>
                            →
                        </Button>
                    </div>
                </div>
                <div className="flex flex-wrap lg:flex-nowrap gap-[0.5rem] items-center">
                    {(isCurrentTaskAllowed || isTaskRunning) && (
                        <Button className={isTaskRunning ? "!bg-(--color-red-noise) !text-(--color-red)" : "!bg-(--color-green-noise) !text-(--color-green-peace)"} onClick={onToggleTaskTimer}>
                            {isTaskRunning ? `Завершить (${formatTaskTime(taskElapsedTime)})` : "Начать задание"}
                        </Button>
                    )}
                    {instructionFileUrl && (
                        <span className="w-full" title={!isTaskRunning ? "Сначала начните задание" : ""}>
                            <Button
                                as="a"
                                href={instructionFileUrl}
                                download
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.open(instructionFileUrl, "_blank");
                                }}
                                disabled={!isTaskRunning}
                                className="w-full">
                                Инструкция
                            </Button>
                        </span>
                    )}
                    {taskFileUrl && (
                        <span className="w-full" title={!isTaskRunning ? "Сначала начните задание" : ""}>
                            <Button
                                as="a"
                                href={taskFileUrl}
                                download
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.open(taskFileUrl, "_blank");
                                }}
                                disabled={!isTaskRunning}
                                className="w-full">
                                Доп.материал
                            </Button>
                        </span>
                    )}
                    {currentTask?.toolLink1 && (
                        <span className="w-full" title={!isTaskRunning ? "Сначала начните задание" : ""}>
                            <Button inverted as="a" href={currentTask.toolLink1} target="_blank" disabled={!isTaskRunning} className={`w-full ${!isTaskRunning ? "opacity-50 cursor-not-allowed" : ""}`} onClick={onToolLink1Click}>
                                {currentTask.toolName1 || "Инструмент"}
                            </Button>
                        </span>
                    )}
                    {currentTask?.toolLink2 && (
                        <span className="w-full" title={!isTaskRunning ? "Сначала начните задание" : ""}>
                            <Button
                                inverted
                                as="a"
                                href={currentTask.toolLink2}
                                target="_blank"
                                disabled={!isTaskRunning}
                                className={`w-full ${!isTaskRunning ? "opacity-50 cursor-not-allowed" : ""}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.open(currentTask.toolLink2, "_blank");
                                }}>
                                {currentTask.toolName2 || "Инструмент"}
                            </Button>
                        </span>
                    )}
                    {sourceUrl && (
                    <span title={!isTaskRunning ? "Сначала начните задание" : "Источник / Доп. материал"}>
                        <Button
                            icon // Оставляем стиль иконки
                            as="a" // Для семантики
                            href={sourceUrl} // Чтобы при наведении виден был путь
                            target="_blank"
                            disabled={!isTaskRunning}
                            className={`!w-9 !h-9 !p-0 flex items-center justify-center ${!isTaskRunning ? "opacity-50 cursor-not-allowed" : ""}`}
                            onClick={(e) => {
                                // 1. Всегда предотвращаем стандартное поведение, так как Button может вести себя непредсказуемо
                                e.preventDefault();
                                
                                // 2. Если таймер запущен - открываем ссылку/файл принудительно
                                if (isTaskRunning) {
                                    window.open(sourceUrl, "_blank");
                                }
                            }}
                        >
                            <div className="w-full h-full flex items-center justify-center">
                                <InfoIcon className="w-4 h-4 relative translate-x-[0.25px] -translate-y-[0.25px]" />
                            </div>
                        </Button>
                    </span>
                )}
                    {(currentTaskIndex === 0 || currentTaskIndex === 200|| currentTaskIndex === 6000|| currentTaskIndex === 3000|| currentTaskIndex === 700|| currentTaskIndex === 300|| currentTaskIndex === 500|| currentTaskIndex === 600|| currentTaskIndex === 900|| currentTaskIndex === 800|| currentTaskIndex === 6100|| currentTaskIndex === 8000) && who === "im" && (
                        <span className="w-full" title={!isTaskRunning ? "Сначала начните задание" : ""}>
                            <Button inverted onClick={onShowRolePopup} disabled={!isTaskRunning} className={`w-full ${!isTaskRunning ? "opacity-50 cursor-not-allowed" : ""}`}>
                                Выбрать роль
                            </Button>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
});

export default function TrainerPage({ goTo }) {
    const [savedField, setSavedField] = useState(null);

    const isMobile = useMediaQuery("(max-width: 1023px)");

    const [taskInputValue, setTaskInputValue] = useState("");
    const debounceTimeoutRef = useRef(null);

    const [hasCompletedSecondQuestionnaire, setHasCompletedSecondQuestionnaire] = useState(localStorage.getItem(getStorageKey("hasCompletedSecondQuestionnaire")) === "true");
    const [selectedRole, setSelectedRole] = useState(localStorage.getItem(getStorageKey("userRole")) || null);
    const [showRolePopup, setShowRolePopup] = useState(false);
    const [taskVersion, setTaskVersion] = useState(localStorage.getItem(getStorageKey("taskVersion")) || "v2");

    useEffect(() => {
        localStorage.setItem(getStorageKey("taskVersion"), taskVersion);
    }, [taskVersion]);

    const handleRoleConfirm = (role) => {
        setSelectedRole(role);
        localStorage.setItem(getStorageKey("userRole"), role);
        setShowRolePopup(false);
    };

    useEffect(() => {
        const completed = localStorage.getItem(getStorageKey("hasCompletedSecondQuestionnaire")) === "true";
        setHasCompletedSecondQuestionnaire(completed);
    }, []);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationConfig, setConfirmationConfig] = useState({
        title: "",
        message: "",
        confirmText: "",
        onConfirm: () => {},
        onCancel: () => {},
    });

    const [showFirstQuestionnaire, setShowFirstQuestionnaire] = useState(false);
    const [showSecondQuestionnaire, setShowSecondQuestionnaire] = useState(false);
    const [showThirdQuestionnaire, setShowThirdQuestionnaire] = useState(false);
    const [hasCompletedQuestionnaire, setHasCompletedQuestionnaire] = useState(false);

    const [showImagePopup, setShowImagePopup] = useState(false);

    const [levels, setLevels] = useState({
        level1: "",
        level2: "",
        level3: "",
        level4: "",
        level5: "",
    });

    const [showLevelsInput, setShowLevelsInput] = useState(false);
    const [showSessionCompletionPopup, setShowSessionCompletionPopup] = useState(false);
    const [showRankingTestPopup, setShowRankingTestPopup] = useState(false);
    const [rankingForceRetake, setRankingForceRetake] = useState(false);

    // Глобальный callback для открытия попапа тестирования из дочерних компонентов
    useEffect(() => {
        window.__openRankingTestPopup = () => {
            setRankingForceRetake(true);
            setShowRankingTestPopup(true);
        };
        return () => { delete window.__openRankingTestPopup; };
    }, []);

    const [completedTasks, setCompletedTasks] = useState({});

    const [showCompletionPopup, setShowCompletionPopup] = useState(false);
    const [currentTaskData, setCurrentTaskData] = useState(null);

    const [type, setType] = useState("text");
    const [userType, setUserType] = useState("teacher");
    const [who, setWho] = useState("im");
    const [isTokenValid, setIsTokenValid] = useState(false);
    const [tokenTaskRange, setTokenTaskRange] = useState(null); // Состояние для диапазона
    const [tokenSectionId, setTokenSectionId] = useState(null); // Slug папки раздела
    const [isMiscAccordionOpen, setIsMiscAccordionOpen] = useState(false);
    const [openSubAccordionKey, setOpenSubAccordionKey] = useState(null);

    const { tasks, currentTask, currentTaskIndex, isLoading, error, setError, timerState, startTimer, stopTimer, goToTask, nextTask, prevTask, instructionFileUrl, taskFileUrl, sourceUrl, tasksTexts, isCurrentTaskAllowed } = useTaskManager({
        userType,
        who,
        taskVersion,
        isTokenValid,
        tokenTaskRange, // Передаем в хук
        tokenSectionId, // Slug папки раздела
    });

    useEffect(() => {
        if (currentTask) {
            setShowLevelsInput(currentTask.toolName1 === "Пройти Тестирование");
        } else {
            setShowLevelsInput(false);
        }
    }, [currentTask]);

    useEffect(() => {
        // Этот хук синхронизирует значение в поле ввода с реальным индексом задания.
        // Он сработает, когда задание меняется по клику на стрелки.
        if (tasks.length > 0) {
            setTaskInputValue((currentTaskIndex + 1).toString());
        }
    }, [currentTaskIndex, tasks]);

    const [fields, setFields] = useState({
        m: "",
        a: "",
        y: "",
        k: "",
        o1: "",
        k2: "",
        o2: "",
    });
    const [prompt, setPrompt] = useState("");
    const [isCopied, setIsCopied] = useState(false);
    const [buffer, setBuffer] = useState({});
    const [history, setHistory] = useState([]);
    const [showBuffer, setShowBuffer] = useState(false);
    const [currentField, setCurrentField] = useState(null);

    useEffect(() => {
        const buf = getCookie(getStorageKey("buffer"));
        if (buf) {
            try {
                setBuffer(JSON.parse(buf));
            } catch {
                setBuffer({});
            }
        }
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

    const [mayakData, setMayakData] = useState({ ...STATIC_MAYAK_DATA, defaultLinks: {} });
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [errorData, setErrorData] = useState(null);

    useEffect(() => {
        sessionStorage.setItem("currentPage", "trainer");
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            setErrorData(null);
            try {
                const response = await fetch("/api/mayak/content-data");
                if (!response.ok) {
                    throw new Error("Не удалось загрузить ссылки для тренажера");
                }
                const linksData = await response.json();
                // Объединяем статические данные с загруженными ссылками
                setMayakData({ ...STATIC_MAYAK_DATA, defaultLinks: linksData.defaultLinks || {} });
            } catch (err) {
                setErrorData(err.message);
                // В случае ошибки загружаем только статические данные
                setMayakData({ ...STATIC_MAYAK_DATA, defaultLinks: {} });
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, []);

    const activeUser =
        document.cookie
            .split("; ")
            .find((row) => row.startsWith("active_user="))
            ?.split("=")[1] || "anonymous";

    const toggleTaskTimer = async () => {
        if (timerState.isRunning) {
            const timeWhenStopped = timerState.elapsedTime;
            stopTimer();

            // Используем предзагруженные данные, убираем fetch и try/catch для него
            const taskTextData = tasksTexts.find((t) => t.number === currentTask?.number?.toString() || t.number === (currentTaskIndex + 1).toString());

            if (taskTextData) {
                setCurrentTaskData(taskTextData);
            } else {
                // Fallback, если текст по какой-то причине не найден
                console.warn(`Текст для задания ${currentTaskIndex + 1} не найден.`);
                setCurrentTaskData({
                    number: currentTask?.number || currentTaskIndex + 1,
                    description: currentTask?.description || "Описание задания недоступно",
                    task: currentTask?.name || "Текст задания недоступен",
                });
            }

            setShowCompletionPopup(true);

            const minutes = Math.round(timeWhenStopped / 60);
            const taskName = currentTask?.name || `Задание ${currentTaskIndex + 1}`;

            // Этот try/catch для сохранения результата остается, он важен
            try {
                const result = await saveToJson({
                    taskName,
                    minutes,
                    currentTaskIndex,
                    type,
                    userType,
                    who,
                    taskElapsedTime: timeWhenStopped,
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
        } else {
            startTimer();
        }
    };

    const formatTaskTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };
    const handleResetFields = () => {
        setFields({
            m: "",
            a: "",
            y: "",
            k: "",
            o1: "",
            k2: "",
            o2: "",
        });
        setPrompt("");
    };

    const handleDownloadCertificate = async () => {
        try {
            // Используем getUserFromCookies для получения имени
            const userData = getUserFromCookies();
            const userName = userData?.name || "Участник";
            const dateStr = new Date().toLocaleDateString("ru-RU");

            // Генерация PDF
            const blobCert = await pdf(<Certificate userName={userName} date={dateStr} />).toBlob();
            
            // Скачивание файла
            const urlCert = URL.createObjectURL(blobCert);
            const linkCert = document.createElement('a');
            linkCert.href = urlCert;
            linkCert.download = `Certificate_Mayak_${userName.replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(linkCert);
            linkCert.click();
            document.body.removeChild(linkCert);
            
            URL.revokeObjectURL(urlCert);
        } catch (error) {
            console.error("Ошибка при генерации сертификата:", error);
        }
    };

    const handleSaveSessionCompletion = async (levels) => {
        // 1. Сразу открываем Яндекс.Форму, чтобы пользователь переключил внимание
        const yandexWindow = window.open("https://forms.yandex.ru/u/6891bb8002848f2a56f5e978/", "_blank");

        try {
            // --- Подготовка данных ---
            const activeUser =
                document.cookie
                    .split("; ")
                    .find((row) => row.startsWith("active_user="))
                    ?.split("=")[1] || "anonymous";

            const decodedUser = decodeURIComponent(activeUser);
            const timestamp = new Date().toISOString();

            const measurementData = {
                taskNumber: "session-completion",
                elapsedTime: timerState.elapsedTime,
                levels: {
                    level1: parseInt(levels.level1) || 0,
                    level2: parseInt(levels.level2) || 0,
                    level3: parseInt(levels.level3) || 0,
                    level4: parseInt(levels.level4) || 0,
                    level5: parseInt(levels.level5) || 0,
                },
            };

            const payload = {
                [decodedUser]: {
                    [timestamp]: measurementData,
                },
            };

            // 2. Запускаем сохранение данных (фоном)
            const savePromise = fetch("/api/mayak/saveDeltaTest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            // 3. Генерируем и "кликаем" сертификат
            // Важно использовать await, чтобы убедиться, что процесс генерации прошел
            await handleDownloadCertificate();

            // 4. ПАУЗА 10 СЕКУНД
            // Мы просто держим страницу живой.
            // За это время браузер успеет обработать клик по ссылке и начать загрузку файла.
            await new Promise((resolve) => setTimeout(resolve, 10000));

            // (Опционально) Дожидаемся сохранения, хотя за 10 сек оно точно прошло
            try {
                await savePromise;
            } catch (e) {
                console.error("Ошибка сохранения (не критично):", e);
            }

            // 5. Очистка состояния
            setShowSessionCompletionPopup(false);
            setShowThirdQuestionnaire(false);
            localStorage.removeItem(getStorageKey("userRole"));
            setSelectedRole(null);
            
            removeKeyCookie();

            localStorage.setItem("trainer_v2_sessionCompletionPending", "true");

            // 6. ПЕРЕЗАГРУЗКА
            // Срабатывает только через 10 секунд после начала процесса
            window.location.href = "/";

        } catch (error) {
            console.error("Ошибка в процессе завершения:", error);
            if (yandexWindow) {
                // yandexWindow.close(); 
            }
            alert("Произошла ошибка. Если сертификат не скачался, проверьте папку загрузок.");
            // Даже при ошибке обновляем страницу, чтобы сбросить состояние
            window.location.href = "/";
        }
    };

    const showSwitchToWeConfirmation = () => {
        setConfirmationConfig({
            title: 'Переход к разделу "МЫ"',
            message: "Вы уверены, что хотите перейти к командной части тренажера?",
            confirmText: "Да, перейти",
            onConfirm: () => {
                setShowConfirmation(false);
                setShowSecondQuestionnaire(true);
                setHasCompletedQuestionnaire(true);
            },
            onCancel: () => {
                setShowConfirmation(false);
                setWho("im");
            },
        });
        setShowConfirmation(true);
    };

    const showCompleteSessionConfirmation = () => {
        setConfirmationConfig({
            title: "Завершение сессии",
            message: 'Подтвердите, что вы завершили прохождение тренажера "МАЯК"',
            confirmText: "Да, завершил(а)",
            onConfirm: () => {
                setShowConfirmation(false);
                setShowThirdQuestionnaire(true);
            },
            onCancel: () => setShowConfirmation(false),
        });
        setShowConfirmation(true);
    };

    const handleSwitchToWe = () => {
        if (!hasCompletedSecondQuestionnaire) {
            showSwitchToWeConfirmation();
        } else {
            setWho("we");
        }
    };

    const saveQuestionnaire = async (questionnaireType, data) => {
        try {
            const activeUser =
                document.cookie
                    .split("; ")
                    .find((row) => row.startsWith("active_user="))
                    ?.split("=")[1] || "anonymous";

            const response = await fetch("/api/mayak/saveQuestionnaire", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    userId: decodeURIComponent(activeUser),
                    questionnaireType,
                    data,
                }),
            });

            if (!response.ok) throw new Error("Ошибка сохранения");

            if (questionnaireType === "Second") {
                localStorage.setItem(getStorageKey("hasCompletedSecondQuestionnaire"), "true");
                setHasCompletedSecondQuestionnaire(true);
            }

            return await response.json();
        } catch (error) {
            console.error("Ошибка:", error);
            throw error;
        }
    };

    const saveMeasurements = async () => {
        try {
            const activeUser =
                document.cookie
                    .split("; ")
                    .find((row) => row.startsWith("active_user="))
                    ?.split("=")[1] || "anonymous";

            const decodedUser = decodeURIComponent(activeUser);

            const timestamp = new Date().toISOString();

            const measurementData = {
                taskNumber: 3,
                elapsedTime: timerState.elapsedTime,
                levels: {
                    level1: parseInt(levels.level1) || 0,
                    level2: parseInt(levels.level2) || 0,
                    level3: parseInt(levels.level3) || 0,
                    level4: parseInt(levels.level4) || 0,
                    level5: parseInt(levels.level5) || 0,
                },
            };

            const payload = {
                [decodedUser]: {
                    [timestamp]: measurementData,
                },
            };

            const response = await fetch("/api/mayak/saveDeltaTest", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            alert("Измерения успешно сохранены!");

            return result;
        } catch (error) {
            console.error("Ошибка при сохранении измерений:", error);
            alert("Произошла ошибка при сохранении измерений");
            return { success: false, error: error.message };
        }
    };

    const handleLevelChange = (level, value) => {
        setLevels((prev) => ({
            ...prev,
            [level]: value,
        }));
    };

    const handleChange = useCallback(
        (code, value) => {
            setFields((prev) => ({ ...prev, [code]: value }));
        },
        [setFields]
    );

    const handleCopy = (value) => {
        if (!value) return;
        copyToClipboard(value)
            .then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            })
            .catch((err) => {
                console.error("Ошибка при копировании: ", err);
                alert("Не удалось скопировать текст.");
            });
    };

    const handleCloseBuffer = () => {
        setShowBuffer(false);
        setCurrentField(null);
    };

    const handleUpdateBuffer = (newBuffer) => {
        setBuffer(newBuffer);
        setCookie(getStorageKey("buffer"), JSON.stringify(newBuffer));
    };

    const handleAddToBuffer = (code) => {
        const fieldValue = fields[code];
        if (!fieldValue || fieldValue.trim() === "") return;

        const newBuffer = { ...buffer };
        if (!newBuffer[code]) {
            newBuffer[code] = [];
        }

        const trimmedValue = fieldValue.trim();
        if (!newBuffer[code].includes(trimmedValue)) {
            const currentBuffer = newBuffer[code];
            const updatedBuffer = [trimmedValue, ...currentBuffer].slice(0, 6);
            newBuffer[code] = updatedBuffer;
            setBuffer(newBuffer);
            setCookie(getStorageKey("buffer"), JSON.stringify(newBuffer));
        }
        setSavedField(code);
        setTimeout(() => setSavedField(null), 1000);
    };

    const handleInsertFromBuffer = (text) => {
        if (currentField) {
            handleChange(currentField, text);
        }
        handleCloseBuffer();
    };

    const handleShowBufferForField = (code) => {
        setCurrentField(code);

        // Изменено: заполняем только если буфер для этого поля undefined (никогда не инициализировался).
        // Если там пустой массив (пользователь все удалил) или есть элементы - не вмешиваемся.
        if (buffer[code] === undefined) {
            const fieldMapping = {
                m: "mission",
                a: "audience",
                y: "role",
                k: "criteria",
                o1: "limitations",
                k2: "context",
                o2: "format",
            };

            const mappedKey = fieldMapping[code];
            if (mappedKey) {
                const typeOptions = mayakData.contentTypeOptions[type];
                if (typeOptions && typeOptions[mappedKey]) {
                    const options = typeOptions[mappedKey];
                    if (Array.isArray(options) && options.length > 0) {
                        const randomValues = [];
                        const shuffled = [...options].sort(() => 0.5 - Math.random());

                        for (let i = 0; i < Math.min(6, shuffled.length); i++) {
                            randomValues.push(shuffled[i]);
                        }

                        const newBuffer = { ...buffer };
                        newBuffer[code] = randomValues;
                        setBuffer(newBuffer);
                        setCookie(getStorageKey("buffer"), JSON.stringify(newBuffer));
                    }
                }
            }
        }

        setShowBuffer(true);
    };

    const handleRandom = (code) => {
        const fieldMapping = {
            m: "mission",
            a: "audience",
            y: "role",
            k: "criteria",
            o1: "limitations",
            k2: "context",
            o2: "format",
        };

        const mappedKey = fieldMapping[code];
        if (!mappedKey) return;

        const typeOptions = mayakData.contentTypeOptions[type];
        if (!typeOptions || !typeOptions[mappedKey]) return;

        const options = typeOptions[mappedKey];
        if (Array.isArray(options) && options.length > 0) {
            const randomValue = options[Math.floor(Math.random() * options.length)];
            handleChange(code, randomValue);
        }
    };

    const cleanupPrompt = (str) => {
        return str
            .replace(/\s{2,}/g, " ") // Убирает двойные пробелы
            .replace(/ ,/g, ",") // Убирает пробел перед запятой
            .replace(/ \./g, ".") // Убирает пробел перед точкой
            .trim();
    };

    const createPrompt = () => {
        const values = fields;
        // Проверяем, что ни одно поле не пустое (с учетом пробелов)
        if (Object.values(values).some((v) => !v.trim())) {
            setPrompt('Пожалуйста, заполните все поля (или используйте "кубики").');
            return;
        }

        // Используем предоставленный статичный шаблон
        let draftPrompt = `Представь, что ты ${values.y}. Твоя миссия — ${values.m.toLowerCase()}. Ты создаешь контент для следующей аудитории: ${values.a.toLowerCase()}. При работе ты должен учитывать такие ограничения: ${values.o1.toLowerCase()}. Готовый результат должен соответствовать следующим критериям: ${values.k.toLowerCase()}. Этот материал будет использоваться в следующем контексте: ${values.k2.toLowerCase()}. Финальное оформление должно быть таким: ${values.o2.toLowerCase()}.`;

        let finalPrompt = cleanupPrompt(draftPrompt);
        setPrompt(finalPrompt);

        // Сохраняем результат в историю
        const entry = { date: new Date().toISOString(), type, prompt: finalPrompt };
        const newHist = [entry, ...JSON.parse(localStorage.getItem(getStorageKey("history")) || "[]")].slice(0, 50);
        localStorage.setItem(getStorageKey("history"), JSON.stringify(newHist));
        setHistory(newHist);
    };

    function getCookie(name) {
        const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
        return match ? decodeURIComponent(match[2]) : null;
    }

    function setCookie(name, value, days = 365) {
        try {
            const expires = new Date(Date.now() + days * 864e5).toUTCString();
            const stringValue = value;
            document.cookie = `${name}=${encodeURIComponent(stringValue)}; expires=${expires}; path=/`;
        } catch (error) {
            console.error("Error setting cookie:", error);
        }
    };

    useEffect(() => {
        // Выполняем стандартную проверку токена при загрузке страницы
        async function checkToken() {
            const KeyInCookies = await getKeyFromCookies();
            const token = KeyInCookies?.text;

            if (!token) {
                goTo("settings");
                return;
            }

            // 1. Проверка админского токена
            if (token === "ADMIN-BYPASS-TOKEN") {
                setIsTokenValid(true);
                return;
            }

            // 2. Проверка старых жестко заданных токенов
            if (CONSTANTS.CORRECT_TOKENS.includes(token)) {
                setIsTokenValid(true);
                return;
            }

            // 3. Проверка динамических токенов через API
            try {
                const response = await fetch(`/api/mayak/validate-token?token=${encodeURIComponent(token)}`);
                const data = await response.json();

                // ВАЖНО: Если токен валиден, пускаем.
                // Если токен исчерпан (isExhausted), но активен (isActive), и мы уже здесь (с кукой) — тоже пускаем.
                if (data.valid || (data.isExhausted && data.isActive)) {
                    setIsTokenValid(true);
                    if (data.sectionId) {
                        setTokenSectionId(data.sectionId);
                    }
                    if (data.taskRange) {
                        setTokenTaskRange(data.taskRange); // Сохраняем диапазон
                    }
                } else {
                    console.warn("Токен недействителен:", data.error);
                    goTo("settings");
                }
            } catch (error) {
                console.error("Ошибка проверки токена:", error);
                goTo("settings");
            }
        }
        checkToken();
    }, [goTo, setIsTokenValid]);

    const isCreateDisabled = Object.values(fields).some((v) => !v);
    const miscCategory = (mayakData.defaultTypes || []).find((t) => t.key === "misc");
    const activeTypeKey = isMiscAccordionOpen ? (miscCategory ? miscCategory.key : type) : type;

    const trainerControlsProps = {
        userType,
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
        levels,
        showLevelsInput,
        selectedRole,
        onUserTypeChange: setUserType,
        onWhoChange: (value) => {
            // Сначала обновляем состояние, чтобы UI отреагировал
            setWho(value); 
            // Затем, если выбрали "Мы" и анкета не пройдена, показываем попап
            if (value === "we" && !hasCompletedSecondQuestionnaire) {
                showSwitchToWeConfirmation();
            }
        },
        onTaskVersionChange: (e) => setTaskVersion(e.target.value),
        onPrevTask: prevTask,
        onNextTask: nextTask,
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
                const newIndex = parseInt(value, 10) - 1;

                // Если номер корректен, переключаем задание
                if (newIndex >= 0 && newIndex < tasks.length) {
                    goToTask(newIndex);
                } else {
                    // Если введен невалидный номер (например 999), можно просто сбросить
                    // поле обратно к текущему активному заданию для ясности.
                    // Но лучше дать пользователю исправить ошибку.
                    // Поле само синхронизируется при клике на стрелки.
                }
            }, 250); // Уменьшил задержку до 250ms, будет еще быстрее
        },
        onToggleTaskTimer: toggleTaskTimer,
        onCompleteSession: () => setShowThirdQuestionnaire(true),
        onShowRolePopup: () => setShowRolePopup(true),
        onLevelChange: handleLevelChange,
        onSaveMeasurements: saveMeasurements,
        onToolLink1Click: (e) => {
            if (currentTask?.toolLink1) {
                if (currentTask.toolName1 === "Пройти Тестирование") {
                    e.preventDefault();
                    setShowRankingTestPopup(true);
                } else if (currentTaskIndex + 1 === 1) {
                    e.preventDefault();
                    setShowFirstQuestionnaire(true);
                } else if (currentTaskIndex + 1 === 2) {
                    e.preventDefault();
                    window.open("https://forms.yandex.ru/u/689197c9eb6146293aca92fa/", "_blank");
                } else {
                    e.preventDefault();
                    window.open(currentTask.toolLink1, "_blank");
                }
            }
        },
    };

    return (
        <>
            <Header>
                <Header.Heading>МАЯК ОКО</Header.Heading>
                <Button
                    icon
                    disabled={timerState.isRunning}
                    className={timerState.isRunning ? "!opacity-40 !cursor-not-allowed !pointer-events-none" : ""}
                    onClick={() => {
                        sessionStorage.setItem("previousPage", "trainer");
                        goTo("history");
                    }}
                    title={timerState.isRunning ? "Недоступно во время выполнения задания" : "История запросов"}>
                    <TimeIcon />
                </Button>
            </Header>

            {showSecondQuestionnaire && (
                <SecondQuestionnairePopup
                    onClose={() => {
                        setShowSecondQuestionnaire(false);
                        setWho("we");
                    }}
                    onSubmit={async (data) => {
                        try {
                            await saveQuestionnaire("Second", data);
                            setWho("we");
                        } catch (error) {
                            console.error("Ошибка сохранения:", error);
                            alert("Произошла ошибка при сохранении. Попробуйте еще раз.");
                        }
                    }}
                />
            )}

            {showThirdQuestionnaire && <ThirdQuestionnairePopup onClose={() => setShowThirdQuestionnaire(false)} onSave={handleSaveSessionCompletion} />}

            <div className="hero relative">
                {isMobile && (
                    <div className="col-span-12 mb-4">
                        <TrainerControls {...trainerControlsProps} />
                    </div>
                )}
                <Block className="col-span-12 lg:col-span-6 !h-full">
                    <form className="flex flex-col h-full justify-between">
                        <div className="flex flex-col gap-[1.25rem]">
                            <div className="flex flex-col gap-[1rem]">
                                <Switcher
                                    value={activeTypeKey} // Используем activeTypeKey для правильного выделения
                                    onChange={(newType) => {
                                        const selectedOption = mayakData.defaultTypes.find((t) => t.key === newType);

                                        if (selectedOption && selectedOption.subCategories) {
                                            // Если это кнопка "Разное"
                                            setIsMiscAccordionOpen((prev) => !prev);
                                            if (newType !== type) {
                                                setType(newType);
                                                // Убрали очистку буфера, чтобы сохранения пользователя не пропадали
                                            }
                                        } else {
                                            // Логика для всех остальных кнопок
                                            if (newType !== type) {
                                                setType(newType);
                                                // Убрали очистку буфера, чтобы сохранения пользователя не пропадали
                                            }
                                            setIsMiscAccordionOpen(false); // Закрываем аккордеон, если он был открыт
                                        }
                                    }}
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
                        <span className="block w-full mt-4" title={isCreateDisabled ? "Сначала заполните все поля" : ""}>
                            <Button className="blue w-full" type="button" onClick={createPrompt} disabled={isCreateDisabled}>
                                Создать&nbsp;запрос
                            </Button>
                        </span>
                    </form>
                </Block>

                <div className="col-span-12 lg:col-span-6 h-full flex flex-col gap-4">
                    {!isMobile && <TrainerControls {...trainerControlsProps} />}

                    <Block className="flex-grow !bg-slate-50 flex flex-col">
                        <h6 className="text-black mb-2">Ваш промт</h6>
                        <div className="flex-grow overflow-y-auto">
                            <p className="text-gray-600">{prompt || 'Заполните поля и нажмите "Создать запрос"'}</p>
                        </div>
                    </Block>

                    <div className="flex flex-col gap-[1rem]">
                        <div className="flex flex-col gap-[0.5rem]">
                            <Button onClick={() => handleCopy(prompt)} disabled={!prompt || isCopied || prompt.includes("Пожалуйста, заполните")}>
                                {isCopied ? "Скопировано!" : "Скопировать"}
                            </Button>

                            <div className="flex flex-wrap lg:flex-nowrap gap-[0.5rem]">
                                {/* Блок 1: Показываем обычные ссылки, если аккордеон "Разное" закрыт */}
                                {!isMiscAccordionOpen &&
                                    (mayakData.defaultLinks[type] || [])
                                        .slice()
                                        .sort(sortByOrder)
                                        .map((service, index) => (
                                            <Button key={index} inverted className="relative group stroke-gray-900 !flex !items-center !gap-2" onClick={() => window.open(service.url, "_blank")}>
                                                <ServiceIcon type={service.iconType} />
                                                <span>{service.name}</span>
                                                {service.description && (
                                                    <div
                                                        className="absolute bottom-full right-0 mb-2 w-max max-w-xs
                    invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200
                    pointer-events-none z-10">
                                                        <div className="bg-white text-gray-700 text-sm rounded-lg shadow-lg px-3 py-2 text-center border border-gray-200">{service.description}</div>
                                                        <div
                                                            className="absolute right-4 top-full w-0 h-0
                        border-t-4 border-t-white
                        border-l-4 border-l-transparent
                        border-r-4 border-r-transparent"
                                                            style={{ filter: "drop-shadow(0 -1px 1px rgb(0 0 0 / 0.05))" }}></div>
                                                    </div>
                                                )}
                                            </Button>
                                        ))}
                            </div>

                            {miscCategory && isMiscAccordionOpen && (
                                <div className="flex flex-col gap-2">
                                    <Block className="flex flex-col gap-2">
                                        {miscCategory.subCategories.map((subItem) => (
                                            <div key={subItem.key} className="flex flex-col gap-2">
                                                <Button
                                                    inverted
                                                    onClick={() => setOpenSubAccordionKey((prevKey) => (prevKey === subItem.key ? null : subItem.key))}
                                                    className={`${openSubAccordionKey === subItem.key ? "!bg-gray-100 !text-black" : ""}`}>
                                                    {subItem.label}
                                                </Button>
                                                {openSubAccordionKey === subItem.key && (
                                                    <div className="flex flex-nowrap gap-2 pt-2 overflow-x-auto">
                                                        {(mayakData.defaultLinks[subItem.key] || [])
                                                            .slice()
                                                            .sort(sortByOrder)
                                                            .map((link, linkIndex) => (
                                                                <Button key={linkIndex} inverted className="relative group stroke-gray-900 !flex !items-center !gap-2" onClick={() => window.open(link.url, "_blank")}>
                                                                    <ServiceIcon type={link.iconType} />
                                                                    <span>{link.name}</span>
                                                                    {link.description && (
                                                                        <div
                                                                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs
																	invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200
																	pointer-events-none z-10">
                                                                            <div className="bg-white text-gray-700 text-sm rounded-lg shadow-lg px-3 py-2 text-center border border-gray-200">{link.description}</div>
                                                                            <div
                                                                                className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0
																		border-t-4 border-t-white
																		border-l-4 border-l-transparent
																		border-r-4 border-r-transparent"
                                                                                style={{ filter: "drop-shadow(0 -1px 1px rgb(0 0 0 / 0.05))" }}></div>
                                                                        </div>
                                                                    )}
                                                                </Button>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </Block>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {showBuffer && <Buffer onClose={handleCloseBuffer} onInsert={handleInsertFromBuffer} onUpdate={handleUpdateBuffer} buffer={buffer} currentField={currentField} />}
            </div>
            {showCompletionPopup && (
                <TaskCompletionPopup
                    taskData={currentTaskData}
                    elapsedTime={timerState.readyElapsedTime}
                    onClose={() => {
                        setShowCompletionPopup(false);
                    }}
                />
            )}
            {showSessionCompletionPopup && <SessionCompletionPopup onClose={() => setShowSessionCompletionPopup(false)} onSave={handleSaveSessionCompletion} />}
            {showRolePopup && <RoleSelectionPopup onClose={() => setShowRolePopup(false)} onConfirm={handleRoleConfirm} />}
            {showRankingTestPopup && (
                <RankingTestPopup
                    onClose={() => { setShowRankingTestPopup(false); if (rankingForceRetake) { setShowThirdQuestionnaire(true); } setRankingForceRetake(false); }}
                    forceRetake={rankingForceRetake}
                    onSave={async (results) => {
                        try {
                            const activeUser =
                                document.cookie
                                    .split("; ")
                                    .find((row) => row.startsWith("active_user="))
                                    ?.split("=")[1] || "anonymous";
                            const payload = {
                                date: new Date().toISOString(),
                                user: activeUser,
                                type: "ranking_test",
                                results,
                                totalDelta: Object.values(results).reduce((sum, r) => sum + r.delta, 0),
                            };
                            await fetch("/api/mayak/saveDeltaTest", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(payload),
                            });
                        } catch (err) {
                            console.error("Ошибка сохранения результатов тестирования:", err);
                        }
                    }}
                />
            )}
        </>
    );
}

async function saveToJson({ taskName, minutes, currentTaskIndex, type, userType, who, taskElapsedTime }) {
    try {
        const activeUser =
            document.cookie
                .split("; ")
                .find((row) => row.startsWith("active_user="))
                ?.split("=")[1] || "anonymous";

        const payload = {
            user: decodeURIComponent(activeUser),
            taskName: taskName,
            taskIndex: currentTaskIndex,
            timestamp: new Date().toISOString(),
            timeSpent: minutes,
            secondsSpent: taskElapsedTime,
            completed: true,
            taskDetails: {
                type: type,
                userType: userType,
                who: who,
            },
        };

        const response = await fetch("/api/mayak/saveTaskAttempt", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error saving task attempt:", error);
        return { success: false, error: error.message };
    }
}
