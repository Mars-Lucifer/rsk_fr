import { useState, useEffect, useRef, useCallback } from "react";

const getRange = (taskNumber) => {
    const start = Math.floor((taskNumber - 1) / 100) * 100 + 1;
    const end = start + 99;
    return `${start}-${end}`;
};

const EMPTY_TASK = { file: "", instruction: "", toolLink1: "", toolName1: "", services: "" };

const getSectionRangeStart = (sectionId, meta = {}) => {
    if (Number.isFinite(meta?.rangeStart)) return meta.rangeStart;
    const match = String(sectionId || "").match(/^(\d+)-/);
    return match ? parseInt(match[1], 10) : 1;
};

const getSectionRangeEnd = (sectionId, tasks = [], meta = {}) => {
    if (Number.isFinite(meta?.rangeEnd)) return meta.rangeEnd;
    const start = getSectionRangeStart(sectionId, meta);
    return start + Math.max(0, tasks.length - 1);
};

export const useMayakTaskManager = ({ userType, who, taskVersion, isTokenValid, tokenTaskRange, tokenSectionId, getStorageKey }) => {
    const [tasks, setTasks] = useState([]);
    const [tasksTexts, setTasksTexts] = useState([]);
    const loadedTextRangesRef = useRef(new Set());
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
                    const MAX_TIMER_SECONDS = 3 * 60 * 60;
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

    const isCurrentTaskAllowed = (() => {
        if (!tokenTaskRange) return true;

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

    let allowedMinIndex = 0;
    let allowedMaxIndex = Math.max(0, tasks.length - 1);
    if (tokenTaskRange && tasks.length > 0) {
        const [startStr, endStr] = tokenTaskRange.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start)) {
            const idx = tasks.findIndex((t) => parseInt(t.number, 10) >= start);
            if (idx !== -1) allowedMinIndex = idx;
        }
        if (!isNaN(end)) {
            for (let i = tasks.length - 1; i >= 0; i--) {
                if (parseInt(tasks[i].number, 10) <= end) {
                    allowedMaxIndex = i;
                    break;
                }
            }
        }
    }

    const basePath = taskVersion === "v2" ? `/tasks-2/${taskVersion}` : `/tasks-2/${taskVersion}/${userType}/${who}`;
    const taskRange = currentTask?._range || (taskVersion === "v2" ? getRange(currentTaskIndex + 1) : null);
    const rangePath = taskVersion === "v2" && taskRange ? `${basePath}/${taskRange}` : basePath;

    const instructionFileUrl =
        taskVersion === "v2"
            ? currentTask?.hasInstruction && currentTask?.instruction && currentTask?._range
                ? `/api/mayak/content-file?sectionId=${encodeURIComponent(currentTask._range)}&type=instructions&filename=${encodeURIComponent(currentTask.instruction)}`
                : ""
            : currentTask?.hasInstruction && currentTask?.instruction
              ? `${rangePath}/Instructions/${currentTask.instruction}`
              : "";

    const taskFileUrl =
        taskVersion === "v2"
            ? currentTask?.hasFile && currentTask?.file && currentTask?._range
                ? `/api/mayak/content-file?sectionId=${encodeURIComponent(currentTask._range)}&type=files&filename=${encodeURIComponent(currentTask.file)}&download=1`
                : ""
            : currentTask?.hasFile && currentTask?.file
              ? `${rangePath}/Files/${currentTask.file}`
              : "";

    const mapFileUrl =
        taskVersion === "v2"
            ? currentTask?.hasMap && currentTask?.map && currentTask?._range
                ? `/api/mayak/content-file?sectionId=${encodeURIComponent(currentTask._range)}&type=maps&filename=${encodeURIComponent(currentTask.map)}`
                : ""
            : currentTask?.hasMap && currentTask?.map
              ? `${rangePath}/Maps/${currentTask.map}`
              : "";

    let sourceUrl = "";
    if (currentTask?.hasSource && currentTask?.sourceLink) {
        if (currentTask.sourceLink.startsWith("http") || currentTask.sourceLink.startsWith("www")) {
            sourceUrl = currentTask.sourceLink;
        } else if (taskVersion === "v2") {
            sourceUrl = `/api/mayak/content-file?scope=source&filename=${encodeURIComponent(currentTask.sourceLink)}`;
        } else {
            sourceUrl = `${basePath}/source/${currentTask.sourceLink}`;
        }
    }

    useEffect(() => {
        try {
            sessionStorage.setItem(getStorageKey("currentTaskIndex"), currentTaskIndex.toString());
        } catch {}
    }, [currentTaskIndex, getStorageKey]);

    useEffect(() => {
        const loadTasks = async () => {
            if (!isTokenValid) return;
            setIsLoading(true);
            setError(null);
            try {
                let tasksData;
                let tasksTextsData = [];
                let defaultStartIndex = 0;

                loadedTextRangesRef.current = new Set();

                if (taskVersion === "v2") {
                    const fetchOpts = { cache: "no-store" };
                    if (tokenSectionId) {
                        const bundleRes = await fetch(`/api/mayak/content-bundle?sectionId=${encodeURIComponent(tokenSectionId)}`, fetchOpts);
                        if (!bundleRes.ok) throw new Error("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0440\u0430\u0437\u0434\u0435\u043b " + tokenSectionId + ": " + bundleRes.status);

                        const payload = await bundleRes.json();
                        const bundle = payload?.data || {};
                        const sectionSlug = bundle.sectionId || tokenSectionId;
                        const data = Array.isArray(bundle.tasks) ? bundle.tasks : [];
                        const texts = Array.isArray(bundle.texts) ? bundle.texts : [];
                        const rangeStart = getSectionRangeStart(sectionSlug, bundle.meta);
                        const rangeEnd = getSectionRangeEnd(sectionSlug, data, bundle.meta);

                        const startPos = rangeStart - 1;
                        defaultStartIndex = startPos;
                        tasksData = new Array(rangeEnd).fill(null).map(() => ({ ...EMPTY_TASK }));
                        for (let i = 0; i < data.length; i++) {
                            tasksData[startPos + i] = { ...data[i], _range: sectionSlug, _sectionStart: rangeStart };
                        }

                        tasksTextsData = texts;
                        loadedTextRangesRef.current.add(sectionSlug);
                    } else {
                        const bundlesRes = await fetch("/api/mayak/content-bundle", fetchOpts);
                        if (!bundlesRes.ok) throw new Error("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0441\u043f\u0438\u0441\u043e\u043a \u0440\u0430\u0437\u0434\u0435\u043b\u043e\u0432: " + bundlesRes.status);

                        const payload = await bundlesRes.json();
                        const bundles = Array.isArray(payload?.data?.bundles) ? payload.data.bundles : [];
                        const maxEnd = bundles.reduce((max, bundle) => {
                            return Math.max(max, getSectionRangeEnd(bundle.sectionId, bundle.tasks, bundle.meta));
                        }, 0);

                        tasksData = new Array(maxEnd).fill(null).map(() => ({ ...EMPTY_TASK }));
                        for (const bundle of bundles) {
                            const range = bundle.sectionId;
                            const data = Array.isArray(bundle.tasks) ? bundle.tasks : [];
                            const startPos = getSectionRangeStart(range, bundle.meta) - 1;
                            for (let i = 0; i < data.length; i++) {
                                tasksData[startPos + i] = { ...data[i], _range: range, _sectionStart: startPos + 1 };
                            }
                        }

                        tasksTextsData = [];
                    }
                } else {
                    const tasksResponse = await fetch(`${basePath}/index.json`);
                    if (!tasksResponse.ok) throw new Error("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0437\u0430\u0434\u0430\u043d\u0438\u044f: " + tasksResponse.status);
                    tasksData = await tasksResponse.json();

                    const textsResponse = await fetch(`${basePath}/TaskText.json`);
                    if (!textsResponse.ok) throw new Error("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0442\u0435\u043a\u0441\u0442\u044b \u0437\u0430\u0434\u0430\u043d\u0438\u0439");
                    tasksTextsData = await textsResponse.json();
                }

                setTasks(tasksData);
                setTasksTexts(tasksTextsData);

                try {
                    const saved = sessionStorage.getItem(getStorageKey("currentTaskIndex"));
                    if (saved !== null) {
                        const savedIdx = parseInt(saved, 10);
                        const isSavedIndexInActiveSection = !tokenSectionId || tasksData[savedIdx]?._range === tokenSectionId;
                        if (!isNaN(savedIdx) && savedIdx >= 0 && savedIdx < tasksData.length && isSavedIndexInActiveSection) {
                            setCurrentTaskIndex(savedIdx);
                        } else if (tokenTaskRange) {
                            const [startStr] = tokenTaskRange.split("-");
                            const start = parseInt(startStr, 10);
                            if (!isNaN(start)) {
                                const startIndex = tasksData.findIndex((t) => parseInt(t.number, 10) >= start);
                                setCurrentTaskIndex(startIndex !== -1 ? startIndex : defaultStartIndex);
                            } else {
                                setCurrentTaskIndex(defaultStartIndex);
                            }
                        } else if (tokenSectionId) {
                            setCurrentTaskIndex(defaultStartIndex);
                        } else {
                            setCurrentTaskIndex(defaultStartIndex);
                        }
                    } else if (tokenTaskRange) {
                        const [startStr] = tokenTaskRange.split("-");
                        const start = parseInt(startStr, 10);
                        if (!isNaN(start)) {
                            const startIndex = tasksData.findIndex((t) => parseInt(t.number, 10) >= start);
                            setCurrentTaskIndex(startIndex !== -1 ? startIndex : defaultStartIndex);
                        }
                    } else if (tokenSectionId) {
                        setCurrentTaskIndex(defaultStartIndex);
                    }
                } catch {
                    setCurrentTaskIndex(defaultStartIndex);
                }

                if (tasksData.length === 0) {
                    setError("\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u0437\u0430\u0434\u0430\u043d\u0438\u0439");
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
    }, [userType, who, taskVersion, isTokenValid, basePath, tokenSectionId, tokenTaskRange, getStorageKey]);

    useEffect(() => {
        const loadActiveRangeTexts = async () => {
            if (!isTokenValid) return;
            if (taskVersion !== "v2") return;
            if (!currentTask?._range) return;

            const activeRange = currentTask._range;
            if (loadedTextRangesRef.current.has(activeRange)) {
                return;
            }

            try {
                const bundleRes = await fetch(`/api/mayak/content-bundle?sectionId=${encodeURIComponent(activeRange)}`, { cache: "no-store" });
                if (!bundleRes.ok) {
                    throw new Error("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u0440\u0430\u0437\u0434\u0435\u043b\u0430 " + activeRange + ": " + bundleRes.status);
                }

                const payload = await bundleRes.json();
                const rangeTexts = Array.isArray(payload?.data?.texts) ? payload.data.texts : [];
                loadedTextRangesRef.current.add(activeRange);
                setTasksTexts((prev) => {
                    const next = Array.isArray(prev) ? [...prev] : [];
                    const knownNumbers = new Set(next.map((item) => String(item.number || "")));
                    for (const item of Array.isArray(rangeTexts) ? rangeTexts : []) {
                        const numberKey = String(item?.number || "");
                        if (!numberKey || knownNumbers.has(numberKey)) continue;
                        knownNumbers.add(numberKey);
                        next.push(item);
                    }
                    return next;
                });
            } catch (err) {
                console.error("Failed to load active range content bundle:", err);
            }
        };

        loadActiveRangeTexts();
    }, [currentTask?._range, isTokenValid, taskVersion]);

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

    // Полный сброс таймера к нулю. Нужен при переходе к другому заданию,
    // чтобы накопленное время предыдущей задачи не списалось на новую.
    const resetTimer = useCallback(() => {
        clearInterval(timerRef.current);
        timerRef.current = null;
        try {
            sessionStorage.removeItem("trainer_v2_taskTimer");
        } catch {}
        setTimerState({ isRunning: false, startTime: null, elapsedTime: 0, readyElapsedTime: null });
    }, []);

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
    }, [timerState.isRunning, timerState.startTime]);

    const goToTask = useCallback(
        (index) => {
            if (index >= allowedMinIndex && index <= allowedMaxIndex && index < tasks.length) {
                setCurrentTaskIndex(index);
            }
        },
        [tasks.length, allowedMinIndex, allowedMaxIndex]
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
        resetTimer,
        goToTask,
        nextTask,
        prevTask,
        instructionFileUrl,
        taskFileUrl,
        mapFileUrl,
        sourceUrl,
        basePath,
        tasksTexts,
        setError,
        isCurrentTaskAllowed,
        allowedMinIndex,
        allowedMaxIndex,
    };
};




