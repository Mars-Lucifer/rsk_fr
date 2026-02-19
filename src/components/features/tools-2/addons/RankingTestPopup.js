import { useState, useRef, useCallback, useEffect } from "react";
import Button from "@/components/ui/Button";
import CloseIcon from "@/assets/general/close.svg";
import { RANKING_TEST_DATA } from "../../../../../data/rankingTestData";

const STORAGE_KEY = "trainer_v2_rankingTestResults";
const PREVIOUS_STORAGE_KEY = "trainer_v2_rankingTestResults_previous";

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function calcDelta(userOrder, correctOrder) {
    let delta = 0;
    for (let i = 0; i < userOrder.length; i++) {
        const correctIndex = correctOrder.indexOf(userOrder[i]);
        delta += Math.abs(i - correctIndex);
    }
    return delta;
}

function calcPositionDiffs(userOrder, correctOrder) {
    return userOrder.map((id, userIdx) => {
        const correctIdx = correctOrder.indexOf(id);
        return userIdx - correctIdx;
    });
}

function loadSavedResults() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function loadPreviousResults() {
    try {
        const raw = localStorage.getItem(PREVIOUS_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function saveResults(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error("Ошибка сохранения результатов тестирования:", e);
    }
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RankingTestPopup({ onClose, onSave, forceRetake = false }) {
    const { levels, criteria } = RANKING_TEST_DATA;

    const [savedData, setSavedData] = useState(() => {
        if (forceRetake) {
            // При forceRetake сразу сохраняем старые результаты как предыдущие и очищаем текущие
            const current = loadSavedResults();
            if (current) {
                try {
                    localStorage.setItem(PREVIOUS_STORAGE_KEY, JSON.stringify(current));
                } catch (e) {
                    console.error("Ошибка сохранения предыдущих результатов:", e);
                }
                localStorage.removeItem(STORAGE_KEY);
            }
            return null;
        }
        return loadSavedResults();
    });
    const [previousData, setPreviousData] = useState(() => loadPreviousResults());
    const [isRetakeMode, setIsRetakeMode] = useState(forceRetake);

    const isFullyCompleted = !isRetakeMode && !!savedData && levels.every((_, i) => !!savedData[`level${i + 1}`]);

    const [currentLevel, setCurrentLevel] = useState(() => {
        if (!savedData) return 0;
        for (let i = 0; i < levels.length; i++) {
            if (!savedData[`level${i + 1}`]) return i;
        }
        return 0;
    });

    const [completedLevels, setCompletedLevels] = useState(() => {
        if (savedData) {
            const restored = {};
            for (let i = 0; i < levels.length; i++) {
                const key = `level${i + 1}`;
                if (savedData[key]) {
                    restored[i] = { delta: savedData[key].delta, time: savedData[key].time || 0 };
                }
            }
            return restored;
        }
        return {};
    });

    const [userOrders, setUserOrders] = useState(() => {
        if (savedData) {
            return levels.map((level, i) => {
                const key = `level${i + 1}`;
                if (savedData[key]?.userOrder) return savedData[key].userOrder;
                return shuffleArray(level.prompts.map((p) => p.id));
            });
        }
        return levels.map((level) => shuffleArray(level.prompts.map((p) => p.id)));
    });

    const [showResults, setShowResults] = useState(() => {
        if (savedData) {
            const restored = {};
            for (let i = 0; i < levels.length; i++) {
                if (savedData[`level${i + 1}`]) restored[i] = true;
            }
            return restored;
        }
        return {};
    });

    // Повторное прохождение: сохраняем текущие результаты как "предыдущие" и сбрасываем
    const handleRetake = () => {
        // Сохраняем текущие результаты как предыдущие
        if (savedData) {
            try {
                localStorage.setItem(PREVIOUS_STORAGE_KEY, JSON.stringify(savedData));
            } catch (e) {
                console.error("Ошибка сохранения предыдущих результатов:", e);
            }
            setPreviousData(savedData);
        }
        // Очищаем текущие результаты
        localStorage.removeItem(STORAGE_KEY);
        setSavedData(null);
        setIsRetakeMode(true);
        setCompletedLevels({});
        setShowResults({});
        setCurrentLevel(0);
        setUserOrders(levels.map((level) => shuffleArray(level.prompts.map((p) => p.id))));
        const timers = {};
        for (let i = 0; i < levels.length; i++) { timers[i] = 0; }
        setLevelTimers(timers);
    };

    // ID перетаскиваемого элемента (не индекс — индекс меняется при reorder)
    const [dragId, setDragId] = useState(null);
    const dragIdRef = useRef(null);
    const [showHint, setShowHint] = useState(true);

    const [levelTimers, setLevelTimers] = useState(() => {
        const timers = {};
        for (let i = 0; i < levels.length; i++) {
            timers[i] = savedData?.[`level${i + 1}`]?.time || 0;
        }
        return timers;
    });
    const timerRef = useRef(null);

    const touchState = useRef({ dragging: false, dragId: null });
    const listRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const autoScrollRef = useRef(null);
    const currentLevelRef = useRef(currentLevel);
    currentLevelRef.current = currentLevel;

    const level = levels[currentLevel];
    const userOrder = userOrders[currentLevel];
    const isLevelDone = !!completedLevels[currentLevel];
    const isShowingResults = !!showResults[currentLevel];

    useEffect(() => {
        if (isLevelDone || isFullyCompleted) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }
        timerRef.current = setInterval(() => {
            setLevelTimers((prev) => ({ ...prev, [currentLevel]: (prev[currentLevel] || 0) + 1 }));
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [currentLevel, isLevelDone, isFullyCompleted]);

    const getPrompt = useCallback(
        (id) => level.prompts.find((p) => p.id === id),
        [level]
    );

    // Живой reorder: перемещает элемент из fromIdx в toIdx
    const reorderItems = useCallback((fromIdx, toIdx) => {
        const lvl = currentLevelRef.current;
        setUserOrders((prev) => {
            const newOrders = [...prev];
            const order = [...newOrders[lvl]];
            const [moved] = order.splice(fromIdx, 1);
            order.splice(toIdx, 0, moved);
            newOrders[lvl] = order;
            return newOrders;
        });
    }, []);

    // swap для кнопок вверх/вниз
    const swapItems = useCallback((idxA, idxB) => {
        const lvl = currentLevelRef.current;
        setUserOrders((prev) => {
            const newOrders = [...prev];
            const order = [...newOrders[lvl]];
            [order[idxA], order[idxB]] = [order[idxB], order[idxA]];
            newOrders[lvl] = order;
            return newOrders;
        });
    }, []);

    // --- Автоскролл при перетаскивании к краям ---
    const SCROLL_ZONE = 80; // px от края где начинается скролл
    const SCROLL_SPEED = 12; // px за кадр

    const startAutoScroll = (clientY) => {
        stopAutoScroll();
        const container = scrollContainerRef.current;
        if (!container) return;

        const tick = () => {
            const rect = container.getBoundingClientRect();
            const y = autoScrollRef.current?.lastY ?? clientY;

            if (y < rect.top + SCROLL_ZONE) {
                // Скролл вверх
                const intensity = 1 - Math.max(0, y - rect.top) / SCROLL_ZONE;
                container.scrollTop -= SCROLL_SPEED * intensity;
            } else if (y > rect.bottom - SCROLL_ZONE) {
                // Скролл вниз
                const intensity = 1 - Math.max(0, rect.bottom - y) / SCROLL_ZONE;
                container.scrollTop += SCROLL_SPEED * intensity;
            }

            autoScrollRef.current.raf = requestAnimationFrame(tick);
        };

        autoScrollRef.current = { lastY: clientY, raf: requestAnimationFrame(tick) };
    };

    const updateAutoScroll = (clientY) => {
        if (autoScrollRef.current) {
            autoScrollRef.current.lastY = clientY;
        }
    };

    const stopAutoScroll = () => {
        if (autoScrollRef.current?.raf) {
            cancelAnimationFrame(autoScrollRef.current.raf);
        }
        autoScrollRef.current = null;
    };

    // --- Mouse Drag: кастомное перетаскивание без HTML5 DnD (убирает 🚫 и призрак) ---

    const mouseState = useRef({ dragging: false, dragId: null });

    const handleMouseDown = (e, idx) => {
        if (isLevelDone) return;
        // Игнорируем клики по кнопкам стрелок
        if (e.target.closest("button")) return;
        e.preventDefault();
        const id = userOrder[idx];
        mouseState.current.dragging = true;
        mouseState.current.dragId = id;
        setDragId(id);
        dragIdRef.current = id;
        startAutoScroll(e.clientY);
    };

    const handleMouseMove = useCallback((e) => {
        if (!mouseState.current.dragging || !listRef.current) return;
        e.preventDefault();
        updateAutoScroll(e.clientY);
        const currentDragId = mouseState.current.dragId;
        if (currentDragId === null) return;

        const lvl = currentLevelRef.current;
        const items = Array.from(listRef.current.querySelectorAll("[data-drag-idx]"));

        // Ищем элемент под курсором
        let targetItem = null;
        for (const item of items) {
            const rect = item.getBoundingClientRect();
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                targetItem = item;
                break;
            }
        }

        if (!targetItem) return;

        const overIdx = parseInt(targetItem.getAttribute("data-drag-idx"), 10);
        setUserOrders((prev) => {
            const order = prev[lvl];
            const currentIdx = order.indexOf(currentDragId);
            if (currentIdx === -1 || currentIdx === overIdx) return prev;

            const rect = targetItem.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            if (currentIdx < overIdx && e.clientY < centerY) return prev;
            if (currentIdx > overIdx && e.clientY > centerY) return prev;

            const newOrders = [...prev];
            const newOrder = [...order];
            const [moved] = newOrder.splice(currentIdx, 1);
            newOrder.splice(overIdx, 0, moved);
            newOrders[lvl] = newOrder;
            return newOrders;
        });
    }, []);

    const handleMouseUp = useCallback(() => {
        if (!mouseState.current.dragging) return;
        stopAutoScroll();
        mouseState.current.dragging = false;
        mouseState.current.dragId = null;
        setDragId(null);
        dragIdRef.current = null;
    }, []);

    // Слушаем mousemove/mouseup на document чтобы drag работал даже за пределами списка
    useEffect(() => {
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    // --- Touch: живое перемещение ---

    const handleTouchStart = (e, idx) => {
        if (isLevelDone) return;
        const id = userOrder[idx];
        touchState.current.dragging = true;
        touchState.current.dragId = id;
        setDragId(id);
        dragIdRef.current = id;
        const touch = e.touches[0];
        startAutoScroll(touch.clientY);
    };

    const handleTouchMove = useCallback(
        (e) => {
            if (!touchState.current.dragging || !listRef.current) return;
            e.preventDefault();
            const touch = e.touches[0];
            updateAutoScroll(touch.clientY);
            const currentDragId = touchState.current.dragId;
            if (currentDragId === null) return;

            const lvl = currentLevelRef.current;
            const items = Array.from(listRef.current.querySelectorAll("[data-drag-idx]"));

            // Ищем элемент под пальцем
            let targetItem = null;
            for (const item of items) {
                const rect = item.getBoundingClientRect();
                if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                    targetItem = item;
                    break;
                }
            }

            if (!targetItem) return;

            const overIdx = parseInt(targetItem.getAttribute("data-drag-idx"), 10);
            // Получаем актуальный порядок через ref-accessible state
            setUserOrders((prev) => {
                const order = prev[lvl];
                const currentIdx = order.indexOf(currentDragId);
                if (currentIdx === -1 || currentIdx === overIdx) return prev;

                const rect = targetItem.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                if (currentIdx < overIdx && touch.clientY < centerY) return prev;
                if (currentIdx > overIdx && touch.clientY > centerY) return prev;

                const newOrders = [...prev];
                const newOrder = [...order];
                const [moved] = newOrder.splice(currentIdx, 1);
                newOrder.splice(overIdx, 0, moved);
                newOrders[lvl] = newOrder;
                return newOrders;
            });
        },
        []
    );

    const handleTouchEnd = useCallback(() => {
        if (!touchState.current.dragging) return;
        stopAutoScroll();
        touchState.current.dragging = false;
        touchState.current.dragId = null;
        setDragId(null);
        dragIdRef.current = null;
    }, []);

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        el.addEventListener("touchmove", handleTouchMove, { passive: false });
        el.addEventListener("touchend", handleTouchEnd);
        return () => {
            el.removeEventListener("touchmove", handleTouchMove);
            el.removeEventListener("touchend", handleTouchEnd);
        };
    }, [handleTouchMove, handleTouchEnd]);

    const moveItem = (idx, direction) => {
        if (isLevelDone) return;
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= userOrder.length) return;
        swapItems(idx, newIdx);
    };

    const persistResults = (newCompleted, orders, timers) => {
        const toSave = {};
        for (let i = 0; i < levels.length; i++) {
            if (newCompleted[i]) {
                toSave[`level${i + 1}`] = {
                    delta: newCompleted[i].delta,
                    time: timers[i] || 0,
                    userOrder: orders[i],
                    correctOrder: levels[i].correctOrder,
                };
            }
        }
        saveResults(toSave);
    };

    const handleCheck = () => {
        const delta = calcDelta(userOrder, level.correctOrder);
        const time = levelTimers[currentLevel] || 0;
        const newCompleted = { ...completedLevels, [currentLevel]: { delta, time } };
        setCompletedLevels(newCompleted);
        setShowResults((prev) => ({ ...prev, [currentLevel]: true }));
        persistResults(newCompleted, userOrders, levelTimers);
    };

    const handleNextLevel = () => {
        if (currentLevel < levels.length - 1) {
            setCurrentLevel(currentLevel + 1);
        }
    };

    const handleSaveAll = () => {
        const results = {};
        for (let i = 0; i < levels.length; i++) {
            if (completedLevels[i]) {
                results[`level${i + 1}`] = {
                    delta: completedLevels[i].delta,
                    time: levelTimers[i] || 0,
                    userOrder: userOrders[i],
                    correctOrder: levels[i].correctOrder,
                };
            }
        }
        saveResults(results);
        setSavedData(results);
        setIsRetakeMode(false);
        if (onSave) onSave(results);
        if (onClose) onClose();
    };

    const allCompleted = Object.keys(completedLevels).length === levels.length;
    const positionDiffs = isShowingResults ? calcPositionDiffs(userOrder, level.correctOrder) : [];

    const canInteract = isRetakeMode ? !completedLevels[currentLevel] : (!isLevelDone && !isFullyCompleted);

    // Нельзя закрыть попап пока не пройдены все 5 уровней (и при первом, и при повторном прохождении)
    const canClose = isFullyCompleted || allCompleted;

    // Получаем предыдущую дельту для текущего уровня (для сравнения)
    const getPreviousDelta = (lvlIdx) => {
        if (previousData && previousData[`level${lvlIdx + 1}`]) {
            return previousData[`level${lvlIdx + 1}`].delta;
        }
        return null;
    };

    const DiffBadge = ({ diff }) => {
        if (diff === 0) {
            return (
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-green-noise)] text-[var(--color-green-peace)] text-xs font-bold flex-shrink-0">
                    ✓
                </span>
            );
        }
        const arrow = diff > 0 ? "↑" : "↓";
        return (
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-red-noise)] text-[var(--color-red)] text-xs font-bold flex-shrink-0">
                {arrow}{Math.abs(diff)}
            </span>
        );
    };

    const CorrectPosBadge = ({ id }) => {
        const correctIdx = level.correctOrder.indexOf(id);
        return (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-blue-noise)] text-[var(--color-blue)] text-xs font-bold flex-shrink-0">
                {correctIdx + 1}
            </span>
        );
    };

    return (
        <div ref={scrollContainerRef} className="fixed inset-0 z-50 flex flex-col bg-white overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-gray-plus-50)]">
                <div>
                    <h3 className="text-xl font-bold text-[var(--color-black)]">Тестирование МАЯК-ОКО</h3>
                </div>
                <div className="flex items-center gap-3">
                    {!canClose && (
                        <span className="text-xs text-amber-600 font-medium">Сначала завершите все уровни</span>
                    )}
                    <Button
                        icon
                        onClick={onClose}
                        disabled={!canClose}
                        className={`!bg-transparent hover:!bg-black/5 ${!canClose ? "!text-gray-300 !cursor-not-allowed" : "!text-black"}`}
                        title={!canClose ? "Завершите все 5 уровней тестирования" : "Закрыть"}>
                        <CloseIcon />
                    </Button>
                </div>
            </div>

            {isFullyCompleted && (
                <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
                        <path d="M10 2L12.09 7.26L18 8.27L14 12.14L14.81 18.02L10 15.27L5.19 18.02L6 12.14L2 8.27L7.91 7.26L10 2Z" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="text-sm font-semibold text-amber-800">Тестирование завершено</p>
                </div>
            )}

            {/* Баннер сравнения с предыдущими результатами */}
            {previousData && (isRetakeMode || isFullyCompleted) && (
                <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
                    <p className="text-sm font-semibold text-blue-800 mb-2">Сравнение результатов</p>
                    <div className="flex flex-wrap gap-3">
                        {levels.map((_, idx) => {
                            const prevDelta = previousData[`level${idx + 1}`]?.delta;
                            const currDelta = completedLevels[idx]?.delta;
                            const hasPrev = prevDelta !== undefined && prevDelta !== null;
                            const hasCurr = currDelta !== undefined && currDelta !== null;
                            const diff = hasPrev && hasCurr ? prevDelta - currDelta : null;
                            return (
                                <div key={idx} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-blue-100">
                                    <span className="text-xs font-medium text-blue-600">Ур. {idx + 1}</span>
                                    <span className="text-xs text-gray-500">
                                        {hasPrev ? `Δ${prevDelta}` : "—"}
                                    </span>
                                    <span className="text-gray-300">→</span>
                                    <span className={`text-xs font-bold ${hasCurr ? "text-black" : "text-gray-300"}`}>
                                        {hasCurr ? `Δ${currDelta}` : "..."}
                                    </span>
                                    {diff !== null && (
                                        <span className={`text-xs font-bold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-400"}`}>
                                            {diff > 0 ? `↓${diff}` : diff < 0 ? `↑${Math.abs(diff)}` : "="}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Level tabs */}
            <div className="flex gap-2 px-6 py-3 border-b border-[var(--color-gray-plus-50)] overflow-x-auto">
                {levels.map((lvl, idx) => {
                    const isActive = idx === currentLevel;
                    const isDone = !!completedLevels[idx];
                    const isLocked = !isFullyCompleted && idx > 0 && !completedLevels[idx - 1];
                    return (
                        <button
                            key={idx}
                            disabled={isLocked}
                            onClick={() => !isLocked && setCurrentLevel(idx)}
                            className={`
                                !w-auto !px-4 !py-2 !rounded-xl text-sm font-medium transition-all whitespace-nowrap
                                ${isActive
                                    ? "!bg-[var(--color-black)] !text-white"
                                    : isDone
                                        ? "!bg-[var(--color-green-noise)] !text-[var(--color-green-peace)]"
                                        : isLocked
                                            ? "!bg-[var(--color-gray-plus-50)] !text-[var(--color-gray-white)] !cursor-not-allowed"
                                            : "!bg-[var(--color-gray-plus-50)] !text-[var(--color-black)] hover:!bg-[var(--color-gray-plus)]"
                                }
                            `}>
                            {isDone && "✓ "}Уровень {idx + 1}
                            {isDone && ` (Δ${completedLevels[idx].delta})`}
                        </button>
                    );
                })}
            </div>

            {/* Body */}
            <div className="flex flex-1 min-h-0">
                {/* Sidebar - hints */}
                {showHint && (
                    <div className="w-80 flex-shrink-0 border-r border-[var(--color-gray-plus-50)] p-5 overflow-y-auto">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-[var(--color-black)]">Критерии МАЯК-ОКО</h4>
                            <button
                                onClick={() => setShowHint(false)}
                                className="!w-6 !h-6 !p-0 !bg-transparent hover:!bg-[var(--color-gray-plus)] !rounded-full flex items-center justify-center">
                                <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                                    <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-xs text-[var(--color-gray-black)] mb-4">
                            Хороший промт должен содержать все элементы структуры МАЯК-ОКО. Чем полнее и конкретнее описан каждый элемент, тем лучше промт.
                        </p>
                        <div className="flex flex-col gap-3">
                            {criteria.map((c, i) => (
                                <div key={i} className="flex gap-3 items-start">
                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-blue-noise)] text-[var(--color-blue)] text-sm font-bold flex-shrink-0">
                                        {c.letter}
                                    </span>
                                    <div>
                                        <p className="text-sm font-semibold text-[var(--color-black)]">{c.name}</p>
                                        <p className="text-xs text-[var(--color-gray-black)] mt-0.5">{c.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Main content */}
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Level info + timer */}
                    <div className="px-6 py-3 flex items-center justify-between border-b border-[var(--color-gray-plus-50)]">
                        <div>
                            <p className="text-sm font-semibold text-[var(--color-black)]">{level.description}</p>
                            {canInteract && (
                                <p className="text-xs text-[var(--color-gray-black)] mt-1">
                                    Перетаскивайте промты или используйте стрелки для изменения порядка
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {!showHint && (
                                <button
                                    onClick={() => setShowHint(true)}
                                    className="!w-auto !px-3 !py-1.5 !bg-[var(--color-blue-noise)] !text-[var(--color-blue)] !rounded-lg text-xs font-medium hover:!bg-[var(--color-blue-plus-50)]">
                                    Подсказка
                                </button>
                            )}
                            <div className={`
                                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-medium
                                ${isLevelDone
                                    ? "bg-[var(--color-green-noise)] text-[var(--color-green-peace)]"
                                    : "bg-slate-100 text-[var(--color-black)]"
                                }
                            `}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                                    <path d="M7 4V7L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {formatTime(levelTimers[currentLevel] || 0)}
                            </div>
                        </div>
                    </div>

                    {/* Prompts list */}
                    <div
                        ref={listRef}
                        className="flex-1 px-6 py-2"
                    >
                        <div className="flex flex-col gap-1">
                            {userOrder.map((id, idx) => {
                                const prompt = getPrompt(id);
                                const isDragging = dragId === id;
                                const isCorrect = isShowingResults && positionDiffs[idx] === 0;
                                const isWrong = isShowingResults && positionDiffs[idx] !== 0;

                                return (
                                    <div
                                        key={id}
                                        data-drag-idx={idx}
                                        onMouseDown={canInteract ? (e) => handleMouseDown(e, idx) : undefined}
                                        onTouchStart={canInteract ? (e) => handleTouchStart(e, idx) : undefined}
                                        style={{
                                            transition: "transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.2s ease, border-color 0.2s ease",
                                        }}
                                        className={`
                                            flex items-center gap-3 p-3 rounded-xl border select-none
                                            ${canInteract ? "cursor-grab active:cursor-grabbing" : ""}
                                            ${isDragging
                                                ? "border-[var(--color-blue)] border-2 bg-blue-50 z-10 relative"
                                                : isCorrect
                                                    ? "border-[var(--color-green)] bg-green-50"
                                                    : isWrong
                                                        ? "border-[var(--color-red-plus)] bg-red-50"
                                                        : "border-[var(--color-gray-plus)] bg-slate-50 hover:bg-slate-100 hover:shadow-sm hover:border-slate-300"
                                            }
                                        `}>
                                        {/* Position number */}
                                        <span className={`
                                            inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold flex-shrink-0
                                            ${isDragging
                                                ? "bg-[var(--color-blue)] text-white"
                                                : "bg-[var(--color-gray-plus)] text-[var(--color-black)]"
                                            }
                                        `}>
                                            {idx + 1}
                                        </span>

                                        {/* Drag handle */}
                                        {canInteract && (
                                            <span className={`flex-shrink-0 select-none transition-colors ${isDragging ? "text-[var(--color-blue)]" : "text-[var(--color-gray-black)]"}`}>
                                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                                    <circle cx="5" cy="3" r="1.5" />
                                                    <circle cx="11" cy="3" r="1.5" />
                                                    <circle cx="5" cy="8" r="1.5" />
                                                    <circle cx="11" cy="8" r="1.5" />
                                                    <circle cx="5" cy="13" r="1.5" />
                                                    <circle cx="11" cy="13" r="1.5" />
                                                </svg>
                                            </span>
                                        )}

                                        {/* Prompt text */}
                                        <p className="flex-1 text-sm text-[var(--color-black)] leading-relaxed">
                                            {prompt?.text}
                                        </p>

                                        {/* Result badges */}
                                        {isShowingResults && (
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <CorrectPosBadge id={id} />
                                                <DiffBadge diff={positionDiffs[idx]} />
                                            </div>
                                        )}

                                        {/* Move arrows */}
                                        {canInteract && (
                                            <div className="flex flex-col gap-1 flex-shrink-0">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); moveItem(idx, -1); }}
                                                    disabled={idx === 0}
                                                    className={`!w-6 !h-6 !p-0 !rounded-md flex items-center justify-center transition-colors
                                                        ${idx === 0 ? "!bg-transparent !text-[var(--color-gray-plus)] !cursor-not-allowed" : "!bg-white !text-[var(--color-black)] hover:!bg-[var(--color-gray-plus)]"}
                                                    `}>
                                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                                                        <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); moveItem(idx, 1); }}
                                                    disabled={idx === userOrder.length - 1}
                                                    className={`!w-6 !h-6 !p-0 !rounded-md flex items-center justify-center transition-colors
                                                        ${idx === userOrder.length - 1 ? "!bg-transparent !text-[var(--color-gray-plus)] !cursor-not-allowed" : "!bg-white !text-[var(--color-black)] hover:!bg-[var(--color-gray-plus)]"}
                                                    `}>
                                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                                                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Results summary */}
                        {isShowingResults && (
                            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-[var(--color-gray-plus)]">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-[var(--color-black)]">Результат уровня {currentLevel + 1}</p>
                                        <p className="text-xs text-[var(--color-gray-black)] mt-1">
                                            Время: {formatTime(levelTimers[currentLevel] || 0)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-bold text-[var(--color-black)]">Δ {completedLevels[currentLevel]?.delta}</p>
                                        {(() => {
                                            const prevDelta = getPreviousDelta(currentLevel);
                                            const currDelta = completedLevels[currentLevel]?.delta;
                                            if (prevDelta !== null && currDelta !== undefined) {
                                                const diff = prevDelta - currDelta;
                                                return (
                                                    <p className={`text-sm font-bold mt-1 ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-400"}`}>
                                                        {diff > 0 ? `↓${diff} улучшение` : diff < 0 ? `↑${Math.abs(diff)} ухудшение` : "= без изменений"}
                                                        <span className="text-xs font-normal text-gray-400 ml-1">(было Δ{prevDelta})</span>
                                                    </p>
                                                );
                                            }
                                            return (
                                                <p className="text-xs text-[var(--color-gray-black)]">
                                                    {currDelta === 0
                                                        ? "Идеально!"
                                                        : currDelta <= 10
                                                            ? "Хороший результат"
                                                            : currDelta <= 20
                                                                ? "Можно лучше"
                                                                : "Есть куда расти"
                                                    }
                                                </p>
                                            );
                                        })()}
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-gray-black)]">
                                    <span className="flex items-center gap-1">
                                        <span className="w-3 h-3 rounded-full bg-[var(--color-green-noise)] border border-[var(--color-green)]"></span>
                                        Верная позиция
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-3 h-3 rounded-full bg-[var(--color-red-noise)] border border-[var(--color-red)]"></span>
                                        Неверная позиция
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-3 h-3 rounded-full bg-[var(--color-blue-noise)] border border-[var(--color-blue)]"></span>
                                        Правильный номер
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-[var(--color-gray-plus-50)] flex items-center justify-between">
                        <div className="text-sm text-[var(--color-gray-black)]">
                            Уровень {currentLevel + 1} из {levels.length}
                            {allCompleted && " — Все уровни пройдены!"}
                        </div>
                        <div className="flex gap-2">
                            {canInteract && (
                                <Button
                                    onClick={handleCheck}
                                    className="blue !w-auto">
                                    Проверить
                                </Button>
                            )}
                            {isLevelDone && !isFullyCompleted && currentLevel < levels.length - 1 && (
                                <Button
                                    onClick={handleNextLevel}
                                    className="!w-auto !bg-[var(--color-black)] !text-white">
                                    Следующий уровень →
                                </Button>
                            )}
                            {allCompleted && !isFullyCompleted && (
                                <Button
                                    onClick={handleSaveAll}
                                    className="blue !w-auto">
                                    Сохранить результаты
                                </Button>
                            )}
                            {isFullyCompleted && (
                                <Button
                                    onClick={onClose}
                                    className="!w-auto !bg-[var(--color-gray-plus-50)] !text-[var(--color-black)]">
                                    Закрыть
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
