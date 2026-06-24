import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { validateDeckStandard } from "@/lib/mayakProgressModel";
import { COLUMNS } from "../columns";
import { parseClipboardTable } from "../utils/parseClipboardTable";
import { useUndoStack } from "./useUndoStack";

// Доменный хук редактора раздела: владеет всем состоянием контента (tasks/texts/
// файлы/валидация/сообщения), загрузкой/сохранением и unified-доступом к ячейкам.
// По образцу useMayakTaskManager из tools-2: принимает аргументы, возвращает
// объект { state, handlers }.
export const useContentData = ({ range }) => {
    const [tasks, setTasks] = useState([]);
    const [texts, setTexts] = useState([]);
    const [existingFiles, setExistingFiles] = useState([]);
    const [existingInstructions, setExistingInstructions] = useState([]);
    const [existingMaps, setExistingMaps] = useState([]);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rangeName, setRangeName] = useState("");
    const [boundTokens, setBoundTokens] = useState([]);
    const [fileSizes, setFileSizes] = useState({});
    const isDirtyRef = useRef(false);
    const tasksRef = useRef(tasks);
    const textsRef = useRef(texts);

    useEffect(() => { tasksRef.current = tasks; }, [tasks]);
    useEffect(() => { textsRef.current = texts; }, [texts]);

    const { saveSnapshot, applyUndo } = useUndoStack({ tasksRef, textsRef, setTasks, setTexts, isDirtyRef });

    // Предупреждение при уходе с несохранёнными данными
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirtyRef.current) { e.preventDefault(); e.returnValue = ""; }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/mayak-content/tasks?range=${range}`);
            const json = await res.json();
            if (json.success) {
                const loadedTasks = json.data.tasks || [];
                const ef = json.data.existingFiles || [];
                const ei = json.data.existingInstructions || [];
                const em = json.data.existingMaps || [];

                // Инициализируем новые текстовые поля
                const tasksWithFlags = loadedTasks.map((t) => ({
                    ...t,
                    sourceLink: t.sourceLink || "",
                    instructionText: t.instructionText || "",
                    materialText: t.materialText || "",
                    mapText: t.mapText || "",
                }));

                setTasks(tasksWithFlags);
                setTexts(json.data.texts || []);
                setExistingFiles(ef);
                setExistingInstructions(ei);
                setExistingMaps(em);
                setRangeName(json.data.rangeName || "");
                setFileSizes(json.data.fileSizes || {});
            }
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [range]);

    // Загрузка привязанных токенов
    const loadBoundTokens = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/mayak-tokens`);
            const json = await res.json();
            if (json.data) {
                const tokens = json.data.filter((t) => t.sectionId === range || (!t.sectionId && t.taskRange === range));
                setBoundTokens(tokens);
            }
        } catch (err) { console.error(err); }
    }, [range]);

    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            loadData();
            loadBoundTokens();
        });
        return () => { cancelAnimationFrame(frameId); };
    }, [loadData, loadBoundTokens]);

    // --- Геттеры/сеттеры для unified доступа ---
    const textsMap = useMemo(() => {
        const map = {};
        texts.forEach((t) => { map[String(t.number)] = t; });
        return map;
    }, [texts]);

    const getCellValue = useCallback((rowIdx, col) => {
        const task = tasks[rowIdx];
        if (!task) return "";
        if (col.source === "text") {
            const t = textsMap[String(task.number)] || null;
            return t?.[col.key] || "";
        }
        return task[col.key] || "";
    }, [tasks, textsMap]);

    // Единый путь записи значения ячейки в tasks/texts.
    const setCellValue = useCallback((rowIdx, col, value) => {
        const task = tasksRef.current[rowIdx];
        if (!task) return;
        isDirtyRef.current = true;
        if (col.source === "text") {
            setTexts((prev) => {
                const idx = prev.findIndex((t) => String(t.number) === String(task.number));
                if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = { ...copy[idx], [col.key]: value };
                    return copy;
                }
                return [...prev, { number: String(task.number), description: col.key === "description" ? value : "", task: col.key === "task" ? value : "" }];
            });
        } else {
            setTasks((prev) => {
                const copy = [...prev];
                copy[rowIdx] = { ...copy[rowIdx], [col.key]: value };
                return copy;
            });
        }
        // Очищаем ошибки для этой строки
        setValidationErrors((prev) => prev.filter((e) => e.index !== rowIdx));
    }, []);

    // Стабильный коллбэк для Cell — принимает (rowIdx, colIdx, value)
    const handleCellChange = useCallback((rowIdx, colIdx, value) => {
        const col = COLUMNS[colIdx];
        if (!col) return;
        setCellValue(rowIdx, col, value);
    }, [setCellValue]);

    // --- Вставка из Google Sheets / Excel (TSV с кавычками) ---
    // Колонки мапятся 1:1 по физическому смещению от startCol — симметрично
    // с Ctrl+C (который выгружает ВСЕ колонки диапазона). Нередактируемые
    // колонки (№/файлы/галочки) пропускаются при записи, но НЕ сдвигают
    // выравнивание — иначе copy↔paste рассинхронизировал столбцы.
    const handlePasteMulti = useCallback((startRow, startCol, text) => {
        const rows = parseClipboardTable(text);
        if (rows.length === 0) return;

        saveSnapshot(); // undo-точка для любой ветки вставки (нативной и клавиатурной)

        // Строим следующие массивы за один проход — без пер-ячейкового setState
        // (раньше это давало O(rows×cols) обновлений state и тормозило).
        const nextTasks = tasksRef.current.map((t) => ({ ...t }));
        const nextTexts = textsRef.current.map((t) => ({ ...t }));
        const textIdxByNumber = new Map();
        nextTexts.forEach((t, i) => textIdxByNumber.set(String(t.number), i));

        const writeCell = (rowIdx, col, value) => {
            const task = nextTasks[rowIdx];
            if (!task) return;
            if (col.source === "text") {
                const key = String(task.number);
                let idx = textIdxByNumber.get(key);
                if (idx === undefined) {
                    idx = nextTexts.length;
                    nextTexts.push({ number: key, description: "", task: "" });
                    textIdxByNumber.set(key, idx);
                }
                nextTexts[idx] = { ...nextTexts[idx], [col.key]: value };
            } else {
                nextTasks[rowIdx] = { ...nextTasks[rowIdx], [col.key]: value };
            }
        };

        for (let r = 0; r < rows.length; r++) {
            const targetRow = startRow + r;
            if (targetRow >= nextTasks.length) break;
            const cells = rows[r];
            for (let c = 0; c < cells.length; c++) {
                const colIdx = startCol + c;
                if (colIdx >= COLUMNS.length) break;
                const col = COLUMNS[colIdx];
                if (!col || col.readOnly || col.fileCol || col.checkbox || col.autoCheckbox) continue;
                writeCell(targetRow, col, cells[c]);
            }
        }

        isDirtyRef.current = true;
        setTasks(nextTasks);
        setTexts(nextTexts);
        setValidationErrors([]);
    }, [saveSnapshot]);

    // Валидация колоды по стандарту (для баннера «что исправить»).
    const deckStandard = useMemo(() => validateDeckStandard(tasks), [tasks]);

    // Мемоизированные счётчики для тулбара
    const toolbarCounts = useMemo(() => ({
        instrNeeded: tasks.filter((t) => (t.instructionText || "").trim()).length,
        instrLoaded: tasks.filter((t) => (t.instructionText || "").trim() && (t.instruction || "").trim() && existingInstructions.includes((t.instruction || "").trim())).length,
        matNeeded: tasks.filter((t) => (t.materialText || "").trim()).length,
        matLoaded: tasks.filter((t) => (t.materialText || "").trim() && (t.file || "").trim() && existingFiles.includes((t.file || "").trim())).length,
        mapNeeded: tasks.filter((t) => (t.mapText || "").trim()).length,
        mapLoaded: tasks.filter((t) => (t.mapText || "").trim() && (t.map || "").trim() && existingMaps.includes((t.map || "").trim())).length,
    }), [tasks, existingInstructions, existingFiles, existingMaps]);

    // --- Валидация ---
    const handleValidate = useCallback((opts = {}) => {
        const errors = [];
        setSaveMsg(null);

        tasks.forEach((task, i) => {
            const instrFileName = (task.instruction || "").trim();
            const fileFileName = (task.file || "").trim();
            const mapFileName = (task.map || "").trim();
            const instrText = (task.instructionText || "").trim();
            const materialText = (task.materialText || "").trim();
            const mapText = (task.mapText || "").trim();

            // Если загружен файл инструкции, но текстовое поле пусто — ошибка
            if (instrFileName && !instrText) {
                errors.push({ index: i, field: "instructionText", message: `Задание ${task.number}: файл инструкции загружен, но описание пустое` });
            }

            // Если есть файл инструкции — проверяем что он на диске
            if (instrFileName) {
                if (!existingInstructions.includes(instrFileName)) {
                    errors.push({ index: i, field: "instruction", message: `Задание ${task.number}: инструкция не загружена` });
                }
                const stem = instrFileName.replace(/\.[^.]+$/, "");
                if (task.number && stem !== String(task.number)) {
                    errors.push({ index: i, field: "instruction", message: `Задание ${task.number}: номер файла (${stem}) ≠ задание` });
                }
            }

            // Если загружен файл доп.материала, но текстовое поле пусто — ошибка
            if (fileFileName && !materialText) {
                errors.push({ index: i, field: "materialText", message: `Задание ${task.number}: файл доп.материала загружен, но описание пустое` });
            }

            // Если есть файл доп.материала — проверяем что он на диске
            if (fileFileName) {
                if (!existingFiles.includes(fileFileName)) {
                    errors.push({ index: i, field: "file", message: `Задание ${task.number}: доп. материал не загружен` });
                }
                const stem = fileFileName.replace(/\.[^.]+$/, "");
                if (task.number && stem !== String(task.number)) {
                    errors.push({ index: i, field: "file", message: `Задание ${task.number}: номер файла (${stem}) ≠ задание` });
                }
            }

            if (mapFileName && !mapText) {
                errors.push({ index: i, field: "mapText", message: `Задание ${task.number}: файл карты загружен, но описание пустое` });
            }

            if (mapFileName) {
                if (!existingMaps.includes(mapFileName)) {
                    errors.push({ index: i, field: "map", message: `Задание ${task.number}: карта не загружена` });
                }
                const stem = mapFileName.replace(/\.[^.]+$/, "");
                if (task.number && stem !== String(task.number)) {
                    errors.push({ index: i, field: "map", message: `Задание ${task.number}: номер файла карты (${stem}) ≠ задание` });
                }
            }
        });

        setValidationErrors(errors);
        if (errors.length === 0) {
            if (!opts.silentOnSuccess) {
                setSaveMsg({ type: "success", text: "Проверка пройдена — ошибок не найдено" });
            }
        } else {
            const summary = errors.map((e) => e.message).join("\n");
            setSaveMsg({ type: "error", text: `Найдено проблем: ${errors.length}\n${summary}` });
        }
        return errors;
    }, [tasks, existingInstructions, existingFiles, existingMaps]);

    // --- Сохранение ---
    const handleSave = useCallback(async () => {
        // Прогоняем валидацию перед записью. Если есть проблемы (битые ссылки
        // на файлы, пустые описания при загруженном файле, несовпадение номера) —
        // не сохраняем молча, а требуем явного подтверждения оператора.
        const validationIssues = handleValidate({ silentOnSuccess: true });
        if (validationIssues.length > 0) {
            const proceed = window.confirm(
                `Найдено проблем: ${validationIssues.length}. Они могут привести к битым ссылкам на файлы или пустым описаниям. Всё равно сохранить?`
            );
            if (!proceed) return;
        }

        setSaving(true);
        setSaveMsg(null);
        setValidationErrors([]);

        // Вычисляем флаги из содержимого текстовых полей
        const tasksToSend = tasks.map((t) => ({
            ...t,
            hasInstruction: !!(t.instructionText || "").trim(),
            hasFile: !!(t.materialText || "").trim(),
            hasMap: !!(t.mapText || "").trim(),
            hasSource: !!(t.sourceLink || "").trim(),
        }));

        try {
            const res = await fetch("/api/admin/mayak-content/tasks", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ range, tasks: tasksToSend, texts, rangeName }),
            });
            const json = await res.json();
            if (json.success) {
                isDirtyRef.current = false;
                await loadData();
                if (json.warnings && json.warnings.length > 0) {
                    setValidationErrors(json.warnings);
                    setSaveMsg({ type: "success", text: `Сохранено (предупреждений: ${json.warnings.length})` });
                } else {
                    setSaveMsg({ type: "success", text: "Сохранено" });
                }
            } else {
                setSaveMsg({ type: "error", text: json.error || "Ошибка" });
            }
        } catch (err) {
            setSaveMsg({ type: "error", text: err.message });
        }
        setSaving(false);
    }, [handleValidate, tasks, texts, rangeName, range, loadData]);

    return {
        // состояние
        tasks, setTasks, tasksRef,
        texts, setTexts,
        existingFiles, setExistingFiles,
        existingInstructions, setExistingInstructions,
        existingMaps, setExistingMaps,
        fileSizes, setFileSizes,
        saving, saveMsg, setSaveMsg,
        validationErrors, setValidationErrors,
        loading, rangeName, setRangeName,
        boundTokens, isDirtyRef,
        // производные
        deckStandard, toolbarCounts,
        // действия
        loadData, getCellValue, setCellValue, handleCellChange,
        handlePasteMulti, handleValidate, handleSave,
        saveSnapshot, applyUndo,
    };
};
