"use client";

import { useState, useEffect, useCallback, useRef, memo } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";

const ADMIN_PASSWORD = "a12345";
const AUTH_KEY = "mayak_content_admin_auth";

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============ Авторизация ============
function LoginForm({ onLogin }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            sessionStorage.setItem(AUTH_KEY, "true");
            onLogin();
        } else {
            setError("Неверный пароль");
            setPassword("");
        }
    };

    return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, width: 320, padding: 32, border: "1px solid #ddd", borderRadius: 12 }}>
                <h2 style={{ margin: 0, textAlign: "center" }}>Админ-панель МАЯК</h2>
                <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15 }} />
                {error && <div style={{ color: "#e53e3e", fontSize: 13 }}>{error}</div>}
                <button type="submit" style={btnStyle}>Войти</button>
            </form>
        </div>
    );
}

// Колонки таблицы (порядок как в Google Sheets)
const COLUMNS = [
    { key: "number", label: "№", width: 50, readOnly: true, source: "task" },
    { key: "title", label: "Название", width: 140, source: "task" },
    { key: "contentType", label: "Тип", width: 100, source: "task" },
    { key: "description", label: "Описание", width: 320, source: "text", multiline: true },
    { key: "task", label: "Задание", width: 320, source: "text", multiline: true },
    { key: "toolName1", label: "Инструмент 1", width: 130, source: "task" },
    { key: "toolLink1", label: "Ссылка 1", width: 180, source: "task" },
    { key: "toolName2", label: "Инструмент 2", width: 130, source: "task" },
    { key: "toolLink2", label: "Ссылка 2", width: 180, source: "task" },
    { key: "hasInstruction", label: "Инстр.", width: 50, source: "task", checkbox: true },
    { key: "hasFile", label: "Доп.м.", width: 50, source: "task", checkbox: true },
    { key: "instruction", label: "Инструкция", width: 160, source: "task", fileCol: "instructions" },
    { key: "file", label: "Доп. материал", width: 160, source: "task", fileCol: "files" },
];

// ============ Авторазмер textarea ============
function useAutoResize(ref, value) {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.max(28, el.scrollHeight) + "px";
    }, [ref, value]);
}

// ============ Ячейка таблицы ============
const Cell = memo(function Cell({ value, onChange, readOnly, multiline, error, colIdx, rowIdx, onPasteMulti, fileCol, fileExists, onUploadFile, onDeleteFile, taskNumber, checkbox, checkboxEnabled, fileLabel, range, selected, isActive, onMouseDownCell, onMouseEnterCell }) {
    const ref = useRef(null);
    const fileRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    useAutoResize(ref, multiline ? value : null);

    const handlePaste = (e) => {
        const text = e.clipboardData.getData("text/plain");
        if (text.includes("\t") || text.includes("\n")) {
            e.preventDefault();
            onPasteMulti(rowIdx, colIdx, text);
        }
    };

    const handleChange = (e) => {
        onChange(e.target.value);
    };

    // Стиль ячейки
    const cellBg = error ? "#fff0f0" : selected && !isActive ? "#d3e3fd" : fileCol && fileExists === true ? "#f0fdf4" : fileCol && fileExists === false && value ? "#fefce8" : "#fff";
    const cellBorder = error ? "1px solid #f87171" : isActive ? "2px solid #1a73e8" : selected ? "1px solid #1a73e8" : "1px solid #e2e8f0";
    const col = COLUMNS[colIdx];
    const isLastCol = colIdx === COLUMNS.length - 1;
    const borderRight = isLastCol ? cellBorder : undefined;

    const cellMouseProps = {
        onMouseDown: (e) => { if (onMouseDownCell && !fileCol && !checkbox) { onMouseDownCell(rowIdx, colIdx, e); } },
        onMouseEnter: (e) => { if (onMouseEnterCell && !fileCol && !checkbox && e.buttons === 1) { onMouseEnterCell(rowIdx, colIdx); } },
    };

    // Чекбокс-колонка (галочка как в Google Sheets)
    if (checkbox) {
        const checked = value === true || value === "true";
        return (
            <td style={{ ...cellStyle, borderLeft: cellBorder, borderBottom: cellBorder, borderRight, width: col?.width, textAlign: "center", verticalAlign: "middle", background: checked ? "#f0fdf4" : "#fff" }}>
                <div
                    onClick={() => onChange(!checked)}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, border: checked ? "2px solid #22c55e" : "2px solid #cbd5e1", borderRadius: 4, cursor: "pointer", background: checked ? "#22c55e" : "#fff", transition: "all 0.15s", marginTop: 3 }}
                >
                    {checked && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7.5L5.5 10L11 4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                </div>
                {checked && fileLabel && (
                    <div style={{ fontSize: 9, color: "#64748b", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 2px" }} title={fileLabel}>
                        {fileLabel}
                    </div>
                )}
            </td>
        );
    }

    // Файловая колонка
    if (fileCol) {

        const handleFile = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            e.target.value = "";
            const fileExt = file.name.includes(".") ? file.name.split(".").pop() : "";
            const correctName = taskNumber && fileExt ? `${taskNumber}.${fileExt}` : file.name;
            setUploading(true);
            await onUploadFile(file, fileCol, correctName);
            onChange(correctName);
            setUploading(false);
        };

        // Если галочка не стоит — показываем прочерк
        if (!checkboxEnabled) {
            return (
                <td style={{ ...cellStyle, background: "#f9fafb", borderLeft: cellBorder, borderBottom: cellBorder, borderRight, width: col?.width }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 28 }}>
                        <span style={{ fontSize: 11, color: "#cbd5e1" }}>—</span>
                    </div>
                </td>
            );
        }

        // Путь к файлу для открытия
        const fileSubdir = fileCol === "instructions" ? "Instructions" : "Files";
        const fileUrl = value && fileExists ? `/tasks-2/v2/${range}/${fileSubdir}/${value}` : null;

        return (
            <td style={{ ...cellStyle, background: cellBg, borderLeft: cellBorder, borderBottom: cellBorder, borderRight, width: col?.width, position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 28, padding: "2px 4px" }}>
                    {fileUrl && (
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" title={`Открыть ${value}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 4, background: "#eff6ff", border: "1px solid #bfdbfe", cursor: "pointer", flexShrink: 0, textDecoration: "none" }}>
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M11 3H5C3.89543 3 3 3.89543 3 5V15C3 16.1046 3.89543 17 5 17H15C16.1046 17 17 16.1046 17 15V9" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round"/><path d="M10 10L17 3M17 3H13M17 3V7" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </a>
                    )}
                    <span style={{ flex: 1, fontSize: 11, color: value ? "#334155" : "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={value}>
                        {uploading ? "..." : value ? value : "Нет файла"}
                    </span>
                    <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ padding: "2px 8px", fontSize: 11, border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", cursor: "pointer", color: "#475569", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {value ? "Заменить" : "Загрузить"}
                    </button>
                    {value && fileExists && onDeleteFile && (
                        <button
                            onClick={() => {
                                if (window.confirm(`Удалить файл ${value}?`)) {
                                    onDeleteFile(fileCol, value);
                                }
                            }}
                            title="Удалить файл"
                            style={{ padding: "2px 6px", fontSize: 13, border: "1px solid #fca5a5", borderRadius: 4, background: "#fef2f2", cursor: "pointer", color: "#dc2626", fontWeight: 700, lineHeight: 1, flexShrink: 0 }}
                        >
                            ×
                        </button>
                    )}
                    <input ref={fileRef} type="file" onChange={handleFile} style={{ display: "none" }} />
                </div>
                {error && <div style={{ fontSize: 10, color: "#dc2626", marginTop: 2, padding: "0 4px" }}>{error}</div>}
            </td>
        );
    }

    if (readOnly) {
        const frozenStyle = colIdx === 0 ? { position: "sticky", left: 0, zIndex: 1, borderRight: "1px solid #c0c0c0" } : {};
        return (
            <td style={{ ...cellStyle, background: "#f8fafc", borderLeft: cellBorder, borderBottom: cellBorder, borderRight, fontWeight: 700, textAlign: "center", color: "#374151", fontSize: 13, width: col?.width, ...frozenStyle }}>
                {value}
            </td>
        );
    }

    // Обычная ячейка — всегда input/textarea, сразу редактируемая
    const inputStyle = {
        width: "100%",
        border: "none",
        outline: "none",
        padding: "4px 6px",
        fontSize: 12,
        fontFamily: "'Arial', sans-serif",
        boxSizing: "border-box",
        borderRadius: 0,
        background: "transparent",
        resize: "none",
        lineHeight: 1.4,
        color: "#1e293b",
    };

    return (
        <td
            style={{ ...cellStyle, background: cellBg, borderLeft: cellBorder, borderBottom: cellBorder, borderRight, width: col?.width, maxWidth: col?.width, cursor: "text" }}
            {...cellMouseProps}
        >
            {multiline ? (
                <textarea
                    ref={ref}
                    value={value || ""}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    style={{ ...inputStyle, overflow: "hidden", display: "block" }}
                />
            ) : (
                <input
                    ref={ref}
                    value={value || ""}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    style={{ ...inputStyle, height: 28 }}
                />
            )}
        </td>
    );
});

// ============ Массовая загрузка ============
function BulkUploadBtn({ onUpload, uploading, label }) {
    const ref = useRef(null);
    return (
        <>
            <button onClick={() => ref.current?.click()} disabled={uploading} style={{ ...btnStyle, background: "#8b5cf6", fontSize: 12, padding: "6px 14px" }}>
                {uploading ? "Загрузка..." : label}
            </button>
            <input ref={ref} type="file" multiple onChange={async (e) => { const files = Array.from(e.target.files); e.target.value = ""; if (files.length) await onUpload(files); }} style={{ display: "none" }} />
        </>
    );
}

// ============ Редактор раздела (Google Sheets стиль) ============
function RangeEditor({ range, password, onBack }) {
    const [tasks, setTasks] = useState([]);
    const [texts, setTexts] = useState([]);
    const [existingFiles, setExistingFiles] = useState([]);
    const [existingInstructions, setExistingInstructions] = useState([]);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bulkUploading, setBulkUploading] = useState(false);
    const [rangeName, setRangeName] = useState("");
    const [editingName, setEditingName] = useState(false);
    const isDirty = useRef(false);

    // Активная ячейка (как в Google Sheets — толстая синяя рамка)
    const [activeCell, setActiveCell] = useState(null); // {row, col}

    // Выделение ячеек
    const [selStart, setSelStart] = useState(null); // {row, col}
    const [selEnd, setSelEnd] = useState(null);     // {row, col}
    const isSelecting = useRef(false);

    const getSelectionRange = () => {
        if (!selStart || !selEnd) return null;
        return {
            r1: Math.min(selStart.row, selEnd.row),
            r2: Math.max(selStart.row, selEnd.row),
            c1: Math.min(selStart.col, selEnd.col),
            c2: Math.max(selStart.col, selEnd.col),
        };
    };

    const isCellSelected = (row, col) => {
        const sel = getSelectionRange();
        if (!sel) return false;
        return row >= sel.r1 && row <= sel.r2 && col >= sel.c1 && col <= sel.c2;
    };

    const handleMouseDownCell = (row, col, e) => {
        setActiveCell({ row, col });
        if (e.shiftKey && selStart) {
            setSelEnd({ row, col });
        } else {
            setSelStart({ row, col });
            setSelEnd({ row, col });
        }
        isSelecting.current = true;
    };

    const handleMouseEnterCell = (row, col) => {
        if (isSelecting.current) {
            setSelEnd({ row, col });
        }
    };

    useEffect(() => {
        const handleMouseUp = () => { isSelecting.current = false; };
        window.addEventListener("mouseup", handleMouseUp);
        return () => window.removeEventListener("mouseup", handleMouseUp);
    }, []);

    // Предупреждение при уходе с несохранёнными данными
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty.current) { e.preventDefault(); e.returnValue = ""; }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);

    // Навигация: найти следующую редактируемую колонку
    const findNextEditableCol = (fromCol, direction) => {
        let c = fromCol + direction;
        while (c >= 0 && c < COLUMNS.length) {
            const col = COLUMNS[c];
            if (!col.readOnly && !col.fileCol && !col.checkbox) return c;
            c += direction;
        }
        return -1;
    };

    const moveActiveCell = (dRow, dCol) => {
        if (!activeCell) return;
        let newRow = activeCell.row + dRow;
        let newCol = activeCell.col + dCol;

        // Ограничиваем по строкам
        if (newRow < 0) newRow = 0;
        if (newRow >= tasks.length) newRow = tasks.length - 1;

        // Для горизонтальной навигации — ищем ближайшую редактируемую колонку
        if (dCol !== 0) {
            const next = findNextEditableCol(activeCell.col, dCol);
            if (next >= 0) newCol = next; else return;
        } else {
            // Вертикальная навигация — оставляем колонку
            newCol = activeCell.col;
        }

        if (newCol < 0 || newCol >= COLUMNS.length) return;

        setActiveCell({ row: newRow, col: newCol });
        setSelStart({ row: newRow, col: newCol });
        setSelEnd({ row: newRow, col: newCol });
        // Убираем фокус из текущего input
        if (document.activeElement?.tagName?.toLowerCase() === "input" || document.activeElement?.tagName?.toLowerCase() === "textarea") {
            document.activeElement.blur();
        }
    };

    // Keyboard handler: навигация + clipboard + delete
    const keydownHandlerRef = useRef(null);
    keydownHandlerRef.current = (e) => {
        const tag = document.activeElement?.tagName?.toLowerCase();
        const inInput = tag === "input" || tag === "textarea";
        const sel = getSelectionRange();
        const isMulti = sel && (sel.r1 !== sel.r2 || sel.c1 !== sel.c2);

        // Escape — убрать фокус из input, сбросить выделение
        if (e.key === "Escape") {
            if (inInput) {
                document.activeElement.blur();
            }
            setSelStart(activeCell);
            setSelEnd(activeCell);
            return;
        }

        // Tab — переход к следующей/предыдущей ячейке
        if (e.key === "Tab" && activeCell) {
            e.preventDefault();
            moveActiveCell(0, e.shiftKey ? -1 : 1);
            return;
        }

        // Enter — переход вниз (если не в multiline textarea)
        if (e.key === "Enter" && activeCell && !e.ctrlKey && !e.metaKey) {
            const col = COLUMNS[activeCell.col];
            if (col && col.multiline && inInput && !e.shiftKey) return; // в textarea Enter = новая строка
            e.preventDefault();
            moveActiveCell(e.shiftKey ? -1 : 1, 0);
            return;
        }

        // Стрелки — навигация (только если НЕ внутри input)
        if (!inInput && activeCell) {
            if (e.key === "ArrowDown") { e.preventDefault(); moveActiveCell(1, 0); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); moveActiveCell(-1, 0); return; }
            if (e.key === "ArrowRight") { e.preventDefault(); moveActiveCell(0, 1); return; }
            if (e.key === "ArrowLeft") { e.preventDefault(); moveActiveCell(0, -1); return; }
        }

        // Ctrl+C — копировать выделенные ячейки как TSV
        if ((e.ctrlKey || e.metaKey) && e.key === "c") {
            if (!sel) return;
            if (!isMulti && inInput) return;
            e.preventDefault();
            const lines = [];
            for (let r = sel.r1; r <= sel.r2; r++) {
                const cells = [];
                for (let c = sel.c1; c <= sel.c2; c++) {
                    const col = COLUMNS[c];
                    if (!col) { cells.push(""); continue; }
                    cells.push(String(getCellValue(r, col) || ""));
                }
                lines.push(cells.join("\t"));
            }
            navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
            return;
        }

        // Ctrl+V — вставить из буфера в ячейки начиная с selStart
        if ((e.ctrlKey || e.metaKey) && e.key === "v") {
            if (!selStart) return;
            if (!isMulti && inInput) {
                navigator.clipboard.readText().then((text) => {
                    if (text && (text.includes("\t") || text.includes("\n"))) {
                        handlePasteMulti(selStart.row, selStart.col, text);
                    }
                }).catch(() => {});
                return;
            }
            e.preventDefault();
            navigator.clipboard.readText().then((text) => {
                if (!text) return;
                if (text.includes("\t") || text.includes("\n")) {
                    handlePasteMulti(selStart.row, selStart.col, text);
                } else {
                    const col = COLUMNS[selStart.col];
                    if (col && !col.readOnly && !col.fileCol && !col.checkbox) {
                        setCellValue(selStart.row, col, text);
                    }
                }
            }).catch(() => {});
            return;
        }

        // Delete/Backspace — очистить выделенные ячейки
        if (e.key !== "Delete" && e.key !== "Backspace") return;
        if (!sel) return;
        if (!isMulti && inInput) return;
        e.preventDefault();
        if (inInput) document.activeElement.blur();
        for (let r = sel.r1; r <= sel.r2; r++) {
            for (let c = sel.c1; c <= sel.c2; c++) {
                const col = COLUMNS[c];
                if (!col || col.readOnly || col.fileCol || col.checkbox) continue;
                setCellValue(r, col, "");
            }
        }
    };

    useEffect(() => {
        const handler = (e) => keydownHandlerRef.current?.(e);
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/mayak-content/tasks?range=${range}&password=${password}`);
            const json = await res.json();
            if (json.success) {
                const loadedTasks = json.data.tasks || [];
                const ef = json.data.existingFiles || [];
                const ei = json.data.existingInstructions || [];

                // Автоматически проставляем галочки где файлы уже загружены
                const tasksWithFlags = loadedTasks.map((t) => {
                    const instrFile = (t.instruction || "").trim();
                    const addFile = (t.file || "").trim();
                    return {
                        ...t,
                        hasInstruction: t.hasInstruction || (instrFile && ei.includes(instrFile)) ? true : false,
                        hasFile: t.hasFile || (addFile && ef.includes(addFile)) ? true : false,
                    };
                });

                setTasks(tasksWithFlags);
                setTexts(json.data.texts || []);
                setExistingFiles(ef);
                setExistingInstructions(ei);
                setRangeName(json.data.rangeName || "");
            }
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [range, password]);

    useEffect(() => { loadData(); }, [loadData]);

    // --- Геттеры/сеттеры для unified доступа ---
    const getTextForTask = (taskNum) => texts.find((t) => String(t.number) === String(taskNum)) || null;

    const getCellValue = (rowIdx, col) => {
        const task = tasks[rowIdx];
        if (!task) return "";
        if (col.source === "text") {
            const t = getTextForTask(task.number);
            return t?.[col.key] || "";
        }
        return task[col.key] || "";
    };

    const setCellValue = (rowIdx, col, value) => {
        const task = tasks[rowIdx];
        if (!task) return;
        isDirty.current = true;
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
    };

    // --- Вставка из Google Sheets (Tab + Enter) ---
    const handlePasteMulti = (startRow, startCol, text) => {
        const rows = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
        if (rows.length > 1 && rows[rows.length - 1].trim() === "") rows.pop();

        // Собираем индексы редактируемых колонок начиная со startCol
        const editableColIndices = [];
        for (let i = startCol; i < COLUMNS.length; i++) {
            const col = COLUMNS[i];
            if (!col.readOnly && !col.fileCol && !col.checkbox) {
                editableColIndices.push(i);
            }
        }

        for (let r = 0; r < rows.length; r++) {
            const cells = rows[r].split("\t");
            for (let c = 0; c < cells.length; c++) {
                const targetRow = startRow + r;
                if (targetRow >= tasks.length) continue;
                if (c >= editableColIndices.length) break;
                const colIdx = editableColIndices[c];
                setCellValue(targetRow, COLUMNS[colIdx], cells[c]);
            }
        }
    };

    // --- Загрузка файла ---
    const handleUploadFile = async (file, type, renamedFilename) => {
        const finalName = renamedFilename || file.name;
        try {
            const base64 = await fileToBase64(file);
            await fetch("/api/admin/mayak-content/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password, range, type, filename: finalName, data: base64 }),
            });
            if (type === "files") {
                setExistingFiles((prev) => prev.includes(finalName) ? prev : [...prev, finalName]);
            } else {
                setExistingInstructions((prev) => prev.includes(finalName) ? prev : [...prev, finalName]);
            }
        } catch (err) { console.error(err); }
    };

    // --- Удаление файла ---
    const handleDeleteFile = async (type, filename) => {
        try {
            const res = await fetch("/api/admin/mayak-content/upload", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password, range, type, filename }),
            });
            const json = await res.json();
            if (!json.success) { console.error(json.error); return; }

            // Убрать из списка существующих
            if (type === "files") {
                setExistingFiles((prev) => prev.filter((f) => f !== filename));
            } else {
                setExistingInstructions((prev) => prev.filter((f) => f !== filename));
            }

            // Очистить имя файла и снять галочку в задании
            const field = type === "files" ? "file" : "instruction";
            const checkField = type === "files" ? "hasFile" : "hasInstruction";
            setTasks((prev) => prev.map((t) => {
                if (t[field] === filename) {
                    return { ...t, [field]: "", [checkField]: false };
                }
                return t;
            }));
            isDirty.current = true;
        } catch (err) { console.error(err); }
    };

    // --- Массовая загрузка ---
    const handleBulkUpload = async (files, type) => {
        setBulkUploading(true);
        let uploaded = 0;
        let matched = 0;
        const skipped = [];
        for (const file of files) {
            const stem = file.name.replace(/\.[^.]+$/, "");
            const taskIdx = tasks.findIndex((t) => String(t.number) === stem);
            if (taskIdx < 0) { skipped.push(file.name); continue; }
            try {
                const base64 = await fileToBase64(file);
                await fetch("/api/admin/mayak-content/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password, range, type, filename: file.name, data: base64 }),
                });
                uploaded++;
                if (type === "files") {
                    setExistingFiles((prev) => prev.includes(file.name) ? prev : [...prev, file.name]);
                } else {
                    setExistingInstructions((prev) => prev.includes(file.name) ? prev : [...prev, file.name]);
                }
                const field = type === "files" ? "file" : "instruction";
                const checkField = type === "files" ? "hasFile" : "hasInstruction";
                setTasks((prev) => {
                    const copy = [...prev];
                    copy[taskIdx] = { ...copy[taskIdx], [field]: file.name, [checkField]: true };
                    return copy;
                });
                matched++;
            } catch (err) { console.error(err); }
        }
        setBulkUploading(false);
        let msg = `Загружено: ${uploaded}, привязано: ${matched}`;
        if (skipped.length > 0) {
            msg += `. Пропущено (нет задания с таким номером): ${skipped.join(", ")}`;
            setSaveMsg({ type: "error", text: msg });
        } else {
            setSaveMsg({ type: "success", text: msg });
        }
    };

    // --- Валидация ---
    const handleValidate = () => {
        const errors = [];
        setSaveMsg(null);

        // Проверка: инструкций должно быть ровно 36
        const instrCount = tasks.filter((t) => t.hasInstruction).length;
        if (instrCount !== 36) {
            errors.push({ index: -1, field: "hasInstruction", message: `Инструкций должно быть 36, сейчас: ${instrCount}` });
        }

        tasks.forEach((task, i) => {
            // Если галочка «Инструкция» стоит — файл должен быть загружен
            if (task.hasInstruction) {
                const instrName = (task.instruction || "").trim();
                if (!instrName) {
                    errors.push({ index: i, field: "instruction", message: `Галочка стоит, но файл не загружен` });
                } else {
                    if (!existingInstructions.includes(instrName)) {
                        errors.push({ index: i, field: "instruction", message: `Файл не найден на диске` });
                    }
                    const stem = instrName.replace(/\.[^.]+$/, "");
                    if (task.number && stem !== String(task.number)) {
                        errors.push({ index: i, field: "instruction", message: `Номер файла (${stem}) не совпадает с заданием (${task.number})` });
                    }
                }
            }

            // Если галочка «Доп. материал» стоит — файл должен быть загружен
            if (task.hasFile) {
                const fileName = (task.file || "").trim();
                if (!fileName) {
                    errors.push({ index: i, field: "file", message: `Галочка стоит, но файл не загружен` });
                } else {
                    if (!existingFiles.includes(fileName)) {
                        errors.push({ index: i, field: "file", message: `Файл не найден на диске` });
                    }
                    const stem = fileName.replace(/\.[^.]+$/, "");
                    if (task.number && stem !== String(task.number)) {
                        errors.push({ index: i, field: "file", message: `Номер файла (${stem}) не совпадает с заданием (${task.number})` });
                    }
                }
            }
        });

        setValidationErrors(errors);
        if (errors.length === 0) {
            setSaveMsg({ type: "success", text: "Проверка пройдена — ошибок не найдено" });
        } else {
            setSaveMsg({ type: "error", text: `Найдено проблем: ${errors.length}` });
        }
    };

    // --- Сохранение ---
    const handleSave = async () => {
        setSaving(true);
        setSaveMsg(null);
        setValidationErrors([]);

        const tasksToSend = tasks.map((t) => ({
            ...t,
            hasInstruction: !!t.hasInstruction,
            hasFile: !!t.hasFile,
        }));

        try {
            const res = await fetch("/api/admin/mayak-content/tasks", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password, range, tasks: tasksToSend, texts, rangeName }),
            });
            const json = await res.json();
            if (json.success) {
                setSaveMsg({ type: "success", text: "Сохранено" });
                isDirty.current = false;
                await loadData();
            } else if (json.errors) {
                setValidationErrors(json.errors);
                setSaveMsg({ type: "error", text: `Конфликты: ${json.errors.length}` });
            } else {
                setSaveMsg({ type: "error", text: json.error || "Ошибка" });
            }
        } catch (err) {
            setSaveMsg({ type: "error", text: err.message });
        }
        setSaving(false);
    };

    if (loading) {
        return <div style={{ padding: 32, textAlign: "center" }}>Загрузка раздела {range}...</div>;
    }

    return (
        <div>
            {/* Тулбар */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8, padding: "8px 0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button onClick={() => {
                        if (isDirty.current && !window.confirm("Есть несохранённые изменения. Уйти без сохранения?")) return;
                        onBack();
                    }} style={{ padding: "7px 16px", borderRadius: 6, background: "#1e293b", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← Назад</button>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Раздел {range}</span>
                    {editingName ? (
                        <input
                            autoFocus
                            value={rangeName}
                            onChange={(e) => setRangeName(e.target.value)}
                            onBlur={() => setEditingName(false)}
                            onKeyDown={(e) => { if (e.key === "Enter") setEditingName(false); }}
                            placeholder="Название раздела"
                            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, width: 220 }}
                        />
                    ) : (
                        <span
                            onClick={() => setEditingName(true)}
                            style={{ fontSize: 14, color: rangeName ? "#475569" : "#94a3b8", cursor: "pointer", borderBottom: "1px dashed #94a3b8", paddingBottom: 1 }}
                        >
                            {rangeName || "Добавить название..."}
                        </span>
                    )}
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                        Доп. материалов: <b>{existingFiles.length}</b> &nbsp; Инструкций: <b>{existingInstructions.length}</b>
                    </span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <BulkUploadBtn label="Загрузить инструкции" uploading={bulkUploading} onUpload={(f) => handleBulkUpload(f, "instructions")} />
                    <BulkUploadBtn label="Загрузить доп.материалы" uploading={bulkUploading} onUpload={(f) => handleBulkUpload(f, "files")} />
                    <button onClick={handleValidate} style={{ ...btnStyle, background: "#6366f1" }}>Проверка</button>
                    <button onClick={handleSave} disabled={saving} style={{ ...btnStyle, background: validationErrors.length > 0 ? "#f59e0b" : "#22c55e", opacity: saving ? 0.7 : 1 }}>
                        {saving ? "Сохранение..." : "Сохранить"}
                    </button>
                </div>
            </div>

            {saveMsg && (
                <div style={{
                    padding: "8px 14px", borderRadius: 6, marginBottom: 8, fontSize: 13,
                    background: saveMsg.type === "success" ? "#dcfce7" : "#fef2f2",
                    color: saveMsg.type === "success" ? "#166534" : "#991b1b",
                }}>
                    {saveMsg.text}
                </div>
            )}

            {/* Таблица-гугл */}
            <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 160px)", border: "1px solid #c0c0c0", borderRadius: 0 }}>
                <table style={{ borderCollapse: "collapse", fontSize: 12, fontFamily: "'Arial', sans-serif", tableLayout: "fixed", width: COLUMNS.reduce((s, c) => s + c.width, 0) }}>
                    <thead>
                        <tr>
                            {COLUMNS.map((col, ci) => (
                                <th key={ci} style={{
                                    ...headerStyle,
                                    width: col.width,
                                    minWidth: col.width,
                                    maxWidth: col.width,
                                    borderLeft: "1px solid #c0c0c0",
                                    borderBottom: "2px solid #c0c0c0",
                                    borderRight: ci === COLUMNS.length - 1 ? "1px solid #c0c0c0" : ci === 0 ? "1px solid #c0c0c0" : undefined,
                                    ...(ci === 0 ? { position: "sticky", left: 0, zIndex: 3 } : {}),
                                }}>
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.map((task, ri) => {
                            const rowErrors = validationErrors.filter((e) => e.index === ri);
                            return (
                                <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#f9fafb" }}>
                                    {COLUMNS.map((col, ci) => {
                                        const cellError = rowErrors.find((e) => e.field === col.key);
                                        const val = getCellValue(ri, col);
                                        const sel = isCellSelected(ri, ci);
                                        const active = activeCell?.row === ri && activeCell?.col === ci;

                                        if (col.checkbox) {
                                            const fileLabel = col.key === "hasInstruction" ? (task.instruction || "") : col.key === "hasFile" ? (task.file || "") : "";
                                            return (
                                                <Cell
                                                    key={ci}
                                                    value={val}
                                                    onChange={(v) => setCellValue(ri, col, v)}
                                                    colIdx={ci}
                                                    rowIdx={ri}
                                                    onPasteMulti={handlePasteMulti}
                                                    checkbox
                                                    fileLabel={fileLabel}
                                                    selected={sel}
                                                    isActive={active}
                                                />
                                            );
                                        }

                                        if (col.fileCol) {
                                            const list = col.fileCol === "instructions" ? existingInstructions : existingFiles;
                                            const exists = val ? list.includes(val) : undefined;
                                            const isEnabled = col.fileCol === "instructions" ? !!task.hasInstruction : !!task.hasFile;
                                            return (
                                                <Cell
                                                    key={ci}
                                                    value={val}
                                                    onChange={(v) => setCellValue(ri, col, v)}
                                                    colIdx={ci}
                                                    rowIdx={ri}
                                                    onPasteMulti={handlePasteMulti}
                                                    fileCol={col.fileCol}
                                                    fileExists={exists}
                                                    onUploadFile={handleUploadFile}
                                                    onDeleteFile={handleDeleteFile}
                                                    taskNumber={task.number}
                                                    error={cellError?.message}
                                                    checkboxEnabled={isEnabled}
                                                    range={range}
                                                    selected={sel}
                                                    isActive={active}
                                                />
                                            );
                                        }

                                        return (
                                            <Cell
                                                key={ci}
                                                value={val}
                                                onChange={(v) => setCellValue(ri, col, v)}
                                                readOnly={col.readOnly}
                                                multiline={col.multiline}
                                                colIdx={ci}
                                                rowIdx={ri}
                                                onPasteMulti={handlePasteMulti}
                                                error={cellError?.message}
                                                selected={sel}
                                                isActive={active}
                                                onMouseDownCell={handleMouseDownCell}
                                                onMouseEnterCell={handleMouseEnterCell}
                                            />
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ============ Стили ============
const btnStyle = { padding: "8px 20px", borderRadius: 6, background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 };
const headerStyle = { padding: "6px 8px", fontSize: 11, fontWeight: 600, textAlign: "left", color: "#374151", background: "#e8eaed", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 2, userSelect: "none" };
const cellStyle = { padding: 0, verticalAlign: "middle", fontSize: 12, overflow: "hidden", wordBreak: "break-word" };

// ============ Главная страница ============
export default function AdminMayakContent() {
    const [isAuth, setIsAuth] = useState(false);
    const [ranges, setRanges] = useState([]);
    const [selectedRange, setSelectedRange] = useState(() => {
        try { return sessionStorage.getItem("mayak_admin_selected_range") || null; } catch { return null; }
    });
    const [loading, setLoading] = useState(true);
    const [newRange, setNewRange] = useState("");
    const [newRangeName, setNewRangeName] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [tokenCounts, setTokenCounts] = useState({});

    useEffect(() => {
        const saved = sessionStorage.getItem(AUTH_KEY);
        if (saved === "true") setIsAuth(true);
        setLoading(false);
    }, []);

    const fetchRanges = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/mayak-content/ranges?password=${ADMIN_PASSWORD}`);
            const json = await res.json();
            if (json.success) setRanges(json.data || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, []);

    // Подгрузка количества токенов по разделам
    const fetchTokenCounts = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/mayak-tokens?password=${ADMIN_PASSWORD}`);
            const json = await res.json();
            if (json.data) {
                const counts = {};
                json.data.forEach((t) => {
                    // Считаем по sectionId если есть, иначе по taskRange
                    const r = t.sectionId || t.taskRange || "_all";
                    counts[r] = (counts[r] || 0) + 1;
                });
                setTokenCounts(counts);
            }
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => { if (isAuth) { fetchRanges(); fetchTokenCounts(); } }, [isAuth, fetchRanges, fetchTokenCounts]);

    const selectRange = (r) => { setSelectedRange(r); sessionStorage.setItem("mayak_admin_selected_range", r); };
    const goBack = () => { setSelectedRange(null); sessionStorage.removeItem("mayak_admin_selected_range"); fetchRanges(); };

    const handleCreateRange = async () => {
        if (!newRange.trim()) return;
        setCreating(true);
        setError("");
        try {
            const res = await fetch("/api/admin/mayak-content/ranges", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: ADMIN_PASSWORD, range: newRange.trim(), rangeName: newRangeName.trim() }),
            });
            const json = await res.json();
            if (json.success) { setNewRange(""); setNewRangeName(""); await fetchRanges(); }
            else setError(json.error);
        } catch (err) { setError(err.message); }
        setCreating(false);
    };

    if (!isAuth) return (<><Header /><LoginForm onLogin={() => setIsAuth(true)} /></>);
    if (loading) return (<><Header /><div style={{ padding: 32, textAlign: "center" }}>Загрузка...</div></>);

    return (
        <>
            <Header />
            <div style={{ margin: "0 auto", padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h1 style={{ fontSize: 20, margin: 0, color: "#1e293b" }}>Управление контентом МАЯК</h1>
                    <Link href="/admin/tokens" style={{ padding: "8px 16px", borderRadius: 6, background: "#8b5cf6", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                        Токены доступа
                    </Link>
                </div>

                {!selectedRange ? (
                    <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
                            <input
                                value={newRange}
                                onChange={(e) => setNewRange(e.target.value)}
                                placeholder="Диапазон, напр. 101-200"
                                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15, width: 200 }}
                                onKeyDown={(e) => e.key === "Enter" && handleCreateRange()}
                            />
                            <input
                                value={newRangeName}
                                onChange={(e) => setNewRangeName(e.target.value)}
                                placeholder="Название раздела"
                                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15, width: 260 }}
                                onKeyDown={(e) => e.key === "Enter" && handleCreateRange()}
                            />
                            <button onClick={handleCreateRange} disabled={creating} style={btnStyle}>
                                {creating ? "..." : "Создать раздел"}
                            </button>
                        </div>
                        {error && <div style={{ color: "#e53e3e", fontSize: 13, marginBottom: 12 }}>{error}</div>}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                            {ranges.map((r) => {
                                const key = r.sectionId || r.range;
                                const tc = tokenCounts[key] || 0;
                                return (
                                    <div
                                        key={key}
                                        onClick={() => selectRange(key)}
                                        style={{ padding: 16, border: "1px solid #e2e8f0", borderRadius: 10, cursor: "pointer", transition: "border-color 0.15s", background: "#fff" }}
                                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
                                    >
                                        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{r.range}</div>
                                        {key !== r.range && <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>{key}</div>}
                                        {r.rangeName && <div style={{ fontSize: 13, color: "#475569", marginBottom: 2 }}>{r.rangeName}</div>}
                                        {tc > 0 && <div style={{ fontSize: 11, color: "#8b5cf6", marginTop: 4 }}>Токенов: {tc}</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <RangeEditor range={selectedRange} password={ADMIN_PASSWORD} onBack={goBack} />
                )}
            </div>
        </>
    );
}
