"use client";

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Header from "@/components/layout/Header";
import MayakAdminBackLink from "@/components/mayak-admin/MayakAdminBackLink";
import { buildMayakAdminLoginUrl, getMayakAdminAuthStatus } from "@/lib/mayakAdminClient";
import { classifyTask, validateDeckStandard } from "@/lib/mayakProgressModel";

// Распознан ли contentType по стандарту (старт / формат «Я» / направление «Мы»
// / карта настроения с префиксом). Используется для подсветки ячеек «Тип».
function isStandardContentType(value) {
    const info = classifyTask(value);
    if (info.kind === "mood") return info.standard === true;
    return info.kind === "start" || info.kind === "ya-format" || info.kind === "we-direction";
}

// Парсер табличного буфера обмена (формат Excel/Google Sheets).
// Ячейки, содержащие таб/перевод строки/кавычку, обёрнуты в "...", внутренние
// кавычки удвоены ("" -> "). Прежний наивный split("\n")/split("\t") ломал
// многострочные ячейки («Описание»/«Задание») — из-за этого «плохо копировалось».
function parseClipboardTable(text) {
    const s = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (inQuotes) {
            if (ch === '"') {
                if (s[i + 1] === '"') { field += '"'; i++; }
                else { inQuotes = false; }
            } else {
                field += ch;
            }
        } else if (ch === '"' && field === "") {
            inQuotes = true;
        } else if (ch === "\t") {
            row.push(field); field = "";
        } else if (ch === "\n") {
            row.push(field); rows.push(row); row = []; field = "";
        } else {
            field += ch;
        }
    }
    row.push(field);
    rows.push(row);
    // Убираем финальную пустую строку от завершающего перевода строки.
    if (rows.length > 1) {
        const last = rows[rows.length - 1];
        if (last.length === 1 && last[0] === "") rows.pop();
    }
    return rows;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
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
    { key: "services", label: "Сервисы", width: 200, source: "task" },
    { key: "instructionText", label: "Инструкция", width: 160, source: "task" },
    { key: "materialText", label: "Доп.материал", width: 160, source: "task" },
    { key: "mapText", label: "Карта", width: 160, source: "task" },
    { key: "sourceLink", label: "Источник", width: 180, source: "task" },
    { key: "hasInstruction", label: "◉Инстр.", width: 50, source: "task", autoCheckbox: true, boundTo: "instructionText", needsFile: true, fileField: "instruction" },
    { key: "hasFile", label: "◉Доп.м.", width: 50, source: "task", autoCheckbox: true, boundTo: "materialText", needsFile: true, fileField: "file" },
    { key: "hasMap", label: "◉Карта", width: 52, source: "task", autoCheckbox: true, boundTo: "mapText", needsFile: true, fileField: "map" },
    { key: "hasSource", label: "◉Ист.", width: 44, source: "task", autoCheckbox: true, boundTo: "sourceLink" },
    { key: "instruction", label: "Загр.инстр.", width: 160, source: "task", fileCol: "instructions" },
    { key: "file", label: "Загр.доп.мат.", width: 160, source: "task", fileCol: "files" },
    { key: "map", label: "Загр.карту", width: 160, source: "task", fileCol: "maps" },
];

// ============ Авторазмер textarea ============
function useAutoResize(ref, value) {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        requestAnimationFrame(() => {
            if (!el.isConnected) return;
            el.style.height = "auto";
            el.style.height = Math.max(28, el.scrollHeight) + "px";
        });
    }, [ref, value]);
}

// ============ Ячейка таблицы ============
const Cell = memo(function Cell({ value, onChange, onCellChange, readOnly, multiline, error, warn, warnTitle, colIdx, rowIdx, onPasteMulti, fileCol, fileExists, fileSize, onUploadFile, onDeleteFile, taskNumber, checkbox, autoCheckbox, autoCheckboxState, checkboxEnabled, fileLabel, range, selected, isActive, onMouseDownCell, onMouseEnterCell }) {
    const ref = useRef(null);
    const fileRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    useAutoResize(ref, multiline ? value : null);

    const handlePaste = (e) => {
        const text = e.clipboardData.getData("text/plain");
        if (!text.includes("\t") && !text.includes("\n")) return; // обычная вставка
        // Многоячеечная вставка — только если буфер реально табличный (>1 строки
        // или >1 колонки). Одиночная многострочная ячейка остаётся в этом поле.
        const table = parseClipboardTable(text);
        const isTabular = table.length > 1 || (table[0] && table[0].length > 1);
        if (!isTabular) return;
        e.preventDefault();
        onPasteMulti(rowIdx, colIdx, text);
    };

    const handleChange = (e) => {
        if (onCellChange) {
            onCellChange(rowIdx, colIdx, e.target.value);
        } else if (onChange) {
            onChange(e.target.value);
        }
    };

    // Проверка: номер файла совпадает с номером задания
    const fileNumberMismatch = fileCol && value && taskNumber ? (() => {
        const stem = value.replace(/\.[^.]+$/, "");
        return stem !== String(taskNumber);
    })() : false;

    // Стиль ячейки (warn — янтарная подсветка «нужно исправить», напр. тип не по стандарту)
    const cellBg = error ? "#fff0f0" : warn && !selected ? "#fff7ed" : selected && !isActive ? "#d3e3fd" : fileCol && fileNumberMismatch && value ? "#fef2f2" : fileCol && fileExists === true && !fileNumberMismatch ? "#f0fdf4" : fileCol && fileExists === false && value ? "#fefce8" : "#fff";
    const cellBorder = error ? "1px solid #f87171" : isActive ? "2px solid #1a73e8" : warn ? "1px solid #f59e0b" : fileCol && fileNumberMismatch && value ? "1px solid #f87171" : selected ? "1px solid #1a73e8" : "1px solid #e2e8f0";
    const col = COLUMNS[colIdx];
    const isLastCol = colIdx === COLUMNS.length - 1;
    const borderRight = isLastCol ? cellBorder : undefined;

    const cellMouseProps = {
        onMouseDown: (e) => { if (onMouseDownCell && !fileCol && !checkbox && !autoCheckbox) { onMouseDownCell(rowIdx, colIdx, e); } },
        onMouseEnter: (e) => { if (onMouseEnterCell && !fileCol && !checkbox && !autoCheckbox && e.buttons === 1) { onMouseEnterCell(rowIdx, colIdx); } },
    };

    // Авто-галочка (три состояния: пусто / жёлтый / зелёный)
    if (autoCheckbox) {
        // autoCheckboxState: "none" | "yellow" | "green"
        const st = autoCheckboxState || "none";
        const bgColor = st === "green" ? "#f0fdf4" : st === "yellow" ? "#fefce8" : "#fff";
        const borderColor = st === "green" ? "#22c55e" : st === "yellow" ? "#eab308" : "#cbd5e1";
        const fillColor = st === "green" ? "#22c55e" : st === "yellow" ? "#eab308" : "#fff";
        const show = st !== "none";
        return (
            <td style={{ ...cellStyle, borderLeft: cellBorder, borderBottom: cellBorder, borderRight, width: col?.width, textAlign: "center", verticalAlign: "middle", background: bgColor }}>
                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, border: `2px solid ${borderColor}`, borderRadius: 4, background: fillColor, marginTop: 3 }}>
                    {show && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7.5L5.5 10L11 4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                </div>
            </td>
        );
    }

    // Старый чекбокс (оставляем для обратной совместимости, но уже не используется)
    if (checkbox) {
        const checked = value === true || value === "true";
        return (
            <td style={{ ...cellStyle, borderLeft: cellBorder, borderBottom: cellBorder, borderRight, width: col?.width, textAlign: "center", verticalAlign: "middle", background: checked ? "#f0fdf4" : "#fff" }}>
                <div
                    onClick={() => onCellChange ? onCellChange(rowIdx, colIdx, !checked) : onChange(!checked)}
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
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

        const handleFile = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            e.target.value = "";
            if (file.size > MAX_FILE_SIZE) {
                alert(`Файл "${file.name}" слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум 10 МБ.`);
                return;
            }
            const originalName = file.name;
            const oldName = value || "";
            setUploading(true);
            await onUploadFile(file, fileCol, originalName, oldName);
            if (onCellChange) onCellChange(rowIdx, colIdx, originalName);
            else if (onChange) onChange(originalName);
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
        const fileType = fileCol === "instructions" ? "instructions" : fileCol === "maps" ? "maps" : "files";
        const fileUrl = value && fileExists ? `/api/mayak/content-file?sectionId=${encodeURIComponent(range)}&type=${fileType}&filename=${encodeURIComponent(value)}` : null;

        const formatSize = (s) => s < 1024 ? `${s} Б` : s < 1024 * 1024 ? `${(s / 1024).toFixed(0)} КБ` : `${(s / 1024 / 1024).toFixed(1)} МБ`;

        return (
            <td style={{ ...cellStyle, background: cellBg, borderLeft: cellBorder, borderBottom: cellBorder, borderRight, width: col?.width, position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 28, padding: "2px 4px" }}>
                    {fileUrl && (
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" title={`Открыть ${value}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 4, background: "#eff6ff", border: "1px solid #bfdbfe", cursor: "pointer", flexShrink: 0, textDecoration: "none" }}>
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M11 3H5C3.89543 3 3 3.89543 3 5V15C3 16.1046 3.89543 17 5 17H15C16.1046 17 17 16.1046 17 15V9" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round"/><path d="M10 10L17 3M17 3H13M17 3V7" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </a>
                    )}
                    <span style={{ flex: 1 }} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ padding: "2px 8px", fontSize: 11, border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", cursor: "pointer", color: "#475569", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {uploading ? "..." : value ? "Заменить" : "Загрузить"}
                    </button>
                    {value && fileExists && onDeleteFile && (
                        <button
                            onClick={() => {
                                if (window.confirm(`Удалить файл ${value}?`)) {
                                    onDeleteFile(fileCol, value);
                                }
                            }}
                            title="Удалить файл"
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, border: "none", background: "transparent", cursor: "pointer", color: "#1e293b", fontSize: 15, lineHeight: 1, flexShrink: 0, fontWeight: 700, padding: 0 }}
                        >
                            ×
                        </button>
                    )}
                    <input ref={fileRef} type="file" onChange={handleFile} style={{ display: "none" }} />
                </div>
                {value && !uploading && (
                    <div style={{ fontSize: 10, color: "#64748b", padding: "0 4px 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={value}>
                        {value}{fileSize != null && <span style={{ color: "#94a3b8", marginLeft: 3 }}>({formatSize(fileSize)})</span>}
                    </div>
                )}
                {!value && !uploading && (
                    <div style={{ fontSize: 10, color: "#94a3b8", padding: "0 4px 2px" }}>Нет файла</div>
                )}
                {fileNumberMismatch && value && !error && <div style={{ fontSize: 10, color: "#dc2626", padding: "0 4px" }}>Файл {value.replace(/\.[^.]+$/, "")} ≠ задание {taskNumber}</div>}
                {error && <div style={{ fontSize: 10, color: "#dc2626", padding: "0 4px" }}>{error}</div>}
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
            title={error || warnTitle || undefined}
            style={{ ...cellStyle, background: cellBg, borderLeft: cellBorder, borderBottom: cellBorder, borderRight, width: col?.width, maxWidth: col?.width, cursor: "text" }}
            {...cellMouseProps}
        >
            {multiline ? (
                <textarea
                    ref={ref}
                    value={value || ""}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    spellCheck
                    lang="ru"
                    style={{ ...inputStyle, overflow: "hidden", display: "block" }}
                />
            ) : (
                <input
                    ref={ref}
                    value={value || ""}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    spellCheck
                    lang="ru"
                    style={{ ...inputStyle, height: 28 }}
                />
            )}
        </td>
    );
});

// ============ Drag-and-drop зона загрузки ============
function BulkUploadDropZone({ onUploadInstructions, onUploadFiles, onUploadMaps, uploading }) {
    const [dragOver, setDragOver] = useState(false);
    const [dropTarget, setDropTarget] = useState(null); // "instructions" | "files" | "maps"
    const instrRef = useRef(null);
    const filesRef = useRef(null);
    const mapsRef = useRef(null);

    const handleDragOver = (e, target) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); setDropTarget(target); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); setDropTarget(null); };
    const handleDrop = async (e, target) => {
        e.preventDefault(); e.stopPropagation(); setDragOver(false); setDropTarget(null);
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;
        if (target === "instructions") await onUploadInstructions(files);
        else if (target === "maps") await onUploadMaps(files);
        else await onUploadFiles(files);
    };

    const zoneStyle = (target) => ({
        flex: 1,
        minHeight: 70,
        border: `2px dashed ${dropTarget === target ? "#8b5cf6" : "#cbd5e1"}`,
        borderRadius: 8,
        background: dropTarget === target ? "#f5f3ff" : "#fafafa",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        cursor: uploading ? "not-allowed" : "pointer",
        transition: "all 0.15s",
        padding: "8px 12px",
    });

    return (
        <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <div
                style={zoneStyle("instructions")}
                onDragOver={(e) => handleDragOver(e, "instructions")}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, "instructions")}
                onClick={() => !uploading && instrRef.current?.click()}
            >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v10M10 3L6 7M10 3l4 4M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6d28d9" }}>{uploading ? "Загрузка..." : "Инструкции"}</span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>Перетащите файлы или нажмите</span>
                <input ref={instrRef} type="file" multiple onChange={async (e) => { const f = Array.from(e.target.files); e.target.value = ""; if (f.length) await onUploadInstructions(f); }} style={{ display: "none" }} />
            </div>
            <div
                style={zoneStyle("files")}
                onDragOver={(e) => handleDragOver(e, "files")}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, "files")}
                onClick={() => !uploading && filesRef.current?.click()}
            >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v10M10 3L6 7M10 3l4 4M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6d28d9" }}>{uploading ? "Загрузка..." : "Доп. материалы"}</span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>Перетащите файлы или нажмите</span>
                <input ref={filesRef} type="file" multiple onChange={async (e) => { const f = Array.from(e.target.files); e.target.value = ""; if (f.length) await onUploadFiles(f); }} style={{ display: "none" }} />
            </div>
            <div
                style={zoneStyle("maps")}
                onDragOver={(e) => handleDragOver(e, "maps")}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, "maps")}
                onClick={() => !uploading && mapsRef.current?.click()}
            >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v10M10 3L6 7M10 3l4 4M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6d28d9" }}>{uploading ? "Загрузка..." : "Карты"}</span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>Перетащите PDF или нажмите</span>
                <input ref={mapsRef} type="file" multiple accept="application/pdf,.pdf" onChange={async (e) => { const f = Array.from(e.target.files); e.target.value = ""; if (f.length) await onUploadMaps(f); }} style={{ display: "none" }} />
            </div>
        </div>
    );
}

// ============ Редактор раздела (Google Sheets стиль) ============
function RangeEditor({ range, onBack }) {
    const [tasks, setTasks] = useState([]);
    const [texts, setTexts] = useState([]);
    const [existingFiles, setExistingFiles] = useState([]);
    const [existingInstructions, setExistingInstructions] = useState([]);
    const [existingMaps, setExistingMaps] = useState([]);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bulkUploading, setBulkUploading] = useState(false);
    const [rangeName, setRangeName] = useState("");
    const [editingName, setEditingName] = useState(false);
    const isDirty = useRef(false);
    const tasksRef = useRef(tasks);
    const textsRef = useRef(texts);
    const [boundTokens, setBoundTokens] = useState([]);
    const [fileSizes, setFileSizes] = useState({});

    // Undo-стек для Ctrl+Z (снимки {tasks, texts})
    const undoStack = useRef([]);

    // Активная ячейка (как в Google Sheets — толстая синяя рамка)
    const [activeCell, setActiveCell] = useState(null); // {row, col}

    // Выделение ячеек
    const [selStart, setSelStart] = useState(null); // {row, col}
    const [selEnd, setSelEnd] = useState(null);     // {row, col}
    const isSelecting = useRef(false);
    const noop = useCallback(() => {}, []);

    const selectionRange = useMemo(() => {
        if (!selStart || !selEnd) return null;
        return {
            r1: Math.min(selStart.row, selEnd.row),
            r2: Math.max(selStart.row, selEnd.row),
            c1: Math.min(selStart.col, selEnd.col),
            c2: Math.max(selStart.col, selEnd.col),
        };
    }, [selStart, selEnd]);

    const getSelectionRange = () => selectionRange;

    const isCellSelected = (row, col) => {
        if (!selectionRange) return false;
        return row >= selectionRange.r1 && row <= selectionRange.r2 && col >= selectionRange.c1 && col <= selectionRange.c2;
    };

    const handleMouseDownCell = useCallback((row, col, e) => {
        setActiveCell({ row, col });
        if (e.shiftKey) {
            setSelEnd({ row, col });
        } else {
            setSelStart({ row, col });
            setSelEnd({ row, col });
        }
        isSelecting.current = true;
    }, []);

    const handleMouseEnterCell = useCallback((row, col) => {
        if (isSelecting.current) {
            setSelEnd({ row, col });
        }
    }, []);

    useEffect(() => {
        const handleMouseUp = () => { isSelecting.current = false; };
        window.addEventListener("mouseup", handleMouseUp);
        return () => window.removeEventListener("mouseup", handleMouseUp);
    }, []);

    useEffect(() => {
        tasksRef.current = tasks;
    }, [tasks]);

    useEffect(() => {
        textsRef.current = texts;
    }, [texts]);

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
    const applyUndoRef = useRef(null);
    const getCellValueRef = useRef(null);
    const saveSnapshotRef = useRef(null);
    const handlePasteMultiRef = useRef(null);
    const setCellValueRef = useRef(null);
    useEffect(() => {
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

            // Ctrl+Z — отмена последней групповой операции
            if ((e.ctrlKey || e.metaKey) && e.key === "z") {
                if (inInput && !isMulti) return; // одиночная ячейка — стандартный undo браузера
                e.preventDefault();
                applyUndoRef.current?.();
                return;
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
                        cells.push(String(getCellValueRef.current?.(r, col) || ""));
                    }
                    lines.push(cells.join("\t"));
                }
                navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
                return;
            }

            // Ctrl+V — вставить из буфера в ячейки начиная с selStart.
            // Если фокус в ячейке (inInput) — вставку обрабатывает нативный
            // onPaste самой ячейки; здесь НЕ дублируем (раньше был двойной paste).
            if ((e.ctrlKey || e.metaKey) && e.key === "v") {
                if (inInput) return;
                if (!selStart) return;
                e.preventDefault();
                navigator.clipboard.readText().then((text) => {
                    if (!text) return;
                    if (text.includes("\t") || text.includes("\n")) {
                        // saveSnapshot выполняется внутри handlePasteMulti
                        handlePasteMultiRef.current?.(selStart.row, selStart.col, text);
                    } else {
                        const col = COLUMNS[selStart.col];
                        if (col && !col.readOnly && !col.fileCol && !col.checkbox && !col.autoCheckbox) {
                            saveSnapshotRef.current?.();
                            setCellValueRef.current?.(selStart.row, col, text);
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
            saveSnapshotRef.current?.();
            for (let r = sel.r1; r <= sel.r2; r++) {
                for (let c = sel.c1; c <= sel.c2; c++) {
                    const col = COLUMNS[c];
                    if (!col || col.readOnly || col.fileCol || col.checkbox || col.autoCheckbox) continue;
                    setCellValueRef.current?.(r, col, "");
                }
            }
        };
    }, [activeCell, moveActiveCell, selStart, selectionRange]);

    useEffect(() => {
        const handler = (e) => keydownHandlerRef.current?.(e);
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
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

        return () => {
            cancelAnimationFrame(frameId);
        };
    }, [loadData, loadBoundTokens]);

    // --- Геттеры/сеттеры для unified доступа ---
    const textsMap = useMemo(() => {
        const map = {};
        texts.forEach(t => { map[String(t.number)] = t; });
        return map;
    }, [texts]);

    const getTextForTask = (taskNum) => textsMap[String(taskNum)] || null;

    function getCellValue(rowIdx, col) {
        const task = tasks[rowIdx];
        if (!task) return "";
        if (col.source === "text") {
            const t = getTextForTask(task.number);
            return t?.[col.key] || "";
        }
        return task[col.key] || "";
    }

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

    // Сохранить снимок состояния перед групповой операцией (для Ctrl+Z)
    function saveSnapshot() {
        undoStack.current.push({
            tasks: JSON.parse(JSON.stringify(tasks)),
            texts: JSON.parse(JSON.stringify(texts)),
        });
        if (undoStack.current.length > 30) undoStack.current.shift();
    }

    function applyUndo() {
        const snapshot = undoStack.current.pop();
        if (!snapshot) return;
        setTasks(snapshot.tasks);
        setTexts(snapshot.texts);
        isDirty.current = true;
    }

    function setCellValue(rowIdx, col, value) {
        const task = tasksRef.current[rowIdx];
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
    }

    // Стабильный коллбэк для Cell — принимает (rowIdx, colIdx, value)
    const handleCellChange = useCallback((rowIdx, colIdx, value) => {
        const col = COLUMNS[colIdx];
        if (!col) return;
        const task = tasksRef.current[rowIdx];
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
        setValidationErrors((prev) => prev.filter((e) => e.index !== rowIdx));
    }, []);

    // --- Вставка из Google Sheets / Excel (TSV с кавычками) ---
    // Колонки мапятся 1:1 по физическому смещению от startCol — симметрично
    // с Ctrl+C (который выгружает ВСЕ колонки диапазона). Нередактируемые
    // колонки (№/файлы/галочки) пропускаются при записи, но НЕ сдвигают
    // выравнивание — иначе copy↔paste рассинхронизировал столбцы.
    function handlePasteMulti(startRow, startCol, text) {
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

        isDirty.current = true;
        setTasks(nextTasks);
        setTexts(nextTexts);
        setValidationErrors([]);
    }

    useEffect(() => {
        applyUndoRef.current = applyUndo;
        getCellValueRef.current = getCellValue;
        saveSnapshotRef.current = saveSnapshot;
        handlePasteMultiRef.current = handlePasteMulti;
        setCellValueRef.current = setCellValue;
    }, [applyUndo, getCellValue, handlePasteMulti, saveSnapshot, setCellValue]);

    // --- Загрузка файла ---
    const handleUploadFile = useCallback(async (file, type, renamedFilename, oldFilename) => {
        const finalName = renamedFilename || file.name;
        try {
            const base64 = await fileToBase64(file);
            const res = await fetch("/api/admin/mayak-content/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ range, type, filename: finalName, data: base64 }),
            });
            // HTTP-ошибка не бросает исключение — проверяем явно, иначе UI
            // покажет ложный успех (файл «добавлен», а на диске его нет).
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || `сервер вернул ${res.status}`);
            }
            // Загрузка успешна — теперь безопасно удалить старый файл
            if (oldFilename && oldFilename !== finalName) {
                try {
                    await fetch("/api/admin/mayak-content/upload", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ range, type, filename: oldFilename }),
                    });
                } catch {}
                if (type === "files") {
                    setExistingFiles((prev) => prev.filter((f) => f !== oldFilename));
                } else if (type === "maps") {
                    setExistingMaps((prev) => prev.filter((f) => f !== oldFilename));
                } else {
                    setExistingInstructions((prev) => prev.filter((f) => f !== oldFilename));
                }
                setFileSizes((prev) => { const copy = { ...prev }; delete copy[oldFilename]; return copy; });
            }
            if (type === "files") {
                setExistingFiles((prev) => prev.includes(finalName) ? prev : [...prev, finalName]);
            } else if (type === "maps") {
                setExistingMaps((prev) => prev.includes(finalName) ? prev : [...prev, finalName]);
            } else {
                setExistingInstructions((prev) => prev.includes(finalName) ? prev : [...prev, finalName]);
            }
            // Обновляем размер файла в state
            setFileSizes((prev) => ({ ...prev, [finalName]: file.size }));
        } catch (err) {
            console.error(err);
            setSaveMsg({ type: "error", text: `Не удалось загрузить файл «${finalName}»: ${err.message}` });
        }
    }, [range]);

    // --- Удаление файла ---
    const handleDeleteFile = useCallback(async (type, filename) => {
        try {
            const res = await fetch("/api/admin/mayak-content/upload", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ range, type, filename }),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || `сервер вернул ${res.status}`);
            }
        } catch (err) {
            console.error(err);
            // НЕ чистим state, если файл не удалён с диска — иначе UI и диск
            // разъезжаются (оператор думает, что файл удалён, а он остался).
            setSaveMsg({ type: "error", text: `Не удалось удалить файл «${filename}»: ${err.message}. Состояние не изменено.` });
            return;
        }

        // Файл реально удалён с диска — теперь безопасно убрать из state
        if (type === "files") {
            setExistingFiles((prev) => prev.filter((f) => f !== filename));
        } else if (type === "maps") {
            setExistingMaps((prev) => prev.filter((f) => f !== filename));
        } else {
            setExistingInstructions((prev) => prev.filter((f) => f !== filename));
        }

        // Очистить имя файла в задании (флаги вычисляются из текстовых полей автоматически)
        const field = type === "files" ? "file" : type === "maps" ? "map" : "instruction";
        setTasks((prev) => prev.map((t) => {
            if (t[field] === filename) {
                return { ...t, [field]: "" };
            }
            return t;
        }));
        isDirty.current = true;
    }, [range]);

    // --- Массовая загрузка ---
    const handleBulkUpload = async (files, type) => {
        setBulkUploading(true);
        let uploaded = 0;
        let matched = 0;
        const skipped = [];
        const failed = [];
        for (const file of files) {
            const stem = file.name.replace(/\.[^.]+$/, "");
            const taskIdx = tasks.findIndex((t) => String(t.number) === stem);
            if (taskIdx < 0) { skipped.push(file.name); continue; }
            try {
                const base64 = await fileToBase64(file);
                const res = await fetch("/api/admin/mayak-content/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ range, type, filename: file.name, data: base64 }),
                });
                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    throw new Error(payload.error || `сервер вернул ${res.status}`);
                }
                uploaded++;
                if (type === "files") {
                    setExistingFiles((prev) => prev.includes(file.name) ? prev : [...prev, file.name]);
                } else if (type === "maps") {
                    setExistingMaps((prev) => prev.includes(file.name) ? prev : [...prev, file.name]);
                } else {
                    setExistingInstructions((prev) => prev.includes(file.name) ? prev : [...prev, file.name]);
                }
                setFileSizes((prev) => ({ ...prev, [file.name]: file.size }));
                const field = type === "files" ? "file" : type === "maps" ? "map" : "instruction";
                setTasks((prev) => {
                    const copy = [...prev];
                    copy[taskIdx] = { ...copy[taskIdx], [field]: file.name };
                    return copy;
                });
                matched++;
            } catch (err) {
                console.error(err);
                failed.push(file.name);
            }
        }
        setBulkUploading(false);
        if (matched > 0) isDirty.current = true;
        let msg = `Загружено: ${uploaded}, привязано: ${matched}`;
        if (failed.length > 0) {
            msg += `. Ошибка загрузки: ${failed.join(", ")}`;
        }
        if (skipped.length > 0) {
            msg += `. Пропущено (нет задания с таким номером): ${skipped.join(", ")}`;
        }
        setSaveMsg({ type: (failed.length > 0 || skipped.length > 0) ? "error" : "success", text: msg });
    };

    // --- Валидация ---
    const handleValidate = (opts = {}) => {
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
    };

    // --- Сохранение ---
    const handleSave = async () => {
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
                isDirty.current = false;
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
    };

    if (loading) {
        return <div style={{ padding: 32, textAlign: "center" }}>Загрузка раздела {range}...</div>;
    }

    return (
        <div>
            {/* Тулбар */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8, padding: "8px 0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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
                    {(() => {
                        return (
                            <span style={{ fontSize: 12, color: "#64748b", display: "flex", gap: 12 }}>
                                <span>Инструкций: <b style={{ color: toolbarCounts.instrLoaded === toolbarCounts.instrNeeded && toolbarCounts.instrNeeded > 0 ? "#16a34a" : toolbarCounts.instrNeeded > 0 ? "#dc2626" : "#64748b" }}>{toolbarCounts.instrLoaded}/{toolbarCounts.instrNeeded}</b></span>
                                <span>Доп.материалов: <b style={{ color: toolbarCounts.matLoaded === toolbarCounts.matNeeded && toolbarCounts.matNeeded > 0 ? "#16a34a" : toolbarCounts.matNeeded > 0 ? "#dc2626" : "#64748b" }}>{toolbarCounts.matLoaded}/{toolbarCounts.matNeeded}</b></span>
                                <span>Карт: <b style={{ color: toolbarCounts.mapLoaded === toolbarCounts.mapNeeded && toolbarCounts.mapNeeded > 0 ? "#16a34a" : toolbarCounts.mapNeeded > 0 ? "#dc2626" : "#64748b" }}>{toolbarCounts.mapLoaded}/{toolbarCounts.mapNeeded}</b></span>
                            </span>
                        );
                    })()}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <button onClick={handleValidate} style={{ ...btnStyle, background: "#6366f1" }}>Проверка</button>
                    <button onClick={handleSave} disabled={saving} style={{ ...btnStyle, background: validationErrors.length > 0 ? "#f59e0b" : "#22c55e", opacity: saving ? 0.7 : 1 }}>
                        {saving ? "Сохранение..." : "Сохранить"}
                    </button>
                </div>
            </div>

            {/* Drag-and-drop зона загрузки */}
            <BulkUploadDropZone
                onUploadInstructions={(f) => handleBulkUpload(f, "instructions")}
                onUploadFiles={(f) => handleBulkUpload(f, "files")}
                onUploadMaps={(f) => handleBulkUpload(f, "maps")}
                uploading={bulkUploading}
            />

            {/* Привязанные токены */}
            {boundTokens.length > 0 && (
                <div style={{ padding: "8px 14px", borderRadius: 6, marginBottom: 8, background: "#f0f4ff", border: "1px solid #c7d2fe", fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: "#4338ca", marginBottom: 6 }}>Привязанные токены ({boundTokens.length}):</div>
                    {boundTokens.map((t) => (
                        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", borderBottom: "1px solid #e0e7ff" }}>
                            <span style={{ fontWeight: 600, color: "#1e293b", minWidth: 100 }}>{t.name}</span>
                            <code style={{ fontSize: 10, background: "#e0e7ff", padding: "1px 6px", borderRadius: 4, color: "#4338ca", userSelect: "all" }}>{t.token}</code>
                            <span style={{ fontSize: 11, color: "#64748b" }}>{t.usedCount}/{t.usageLimit}</span>
                            {!t.isActive && <span style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>[неактивен]</span>}
                            {t.isActive && t.isExhausted && <span style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>[исчерпан]</span>}
                        </div>
                    ))}
                </div>
            )}
            {boundTokens.length === 0 && !loading && (
                <div style={{ padding: "6px 14px", borderRadius: 6, marginBottom: 8, background: "#fefce8", border: "1px solid #fde68a", fontSize: 12, color: "#92400e" }}>
                    Нет привязанных токенов к этому разделу
                </div>
            )}

            {saveMsg && (
                <div style={{
                    padding: "8px 14px", borderRadius: 6, marginBottom: 8, fontSize: 13,
                    background: saveMsg.type === "success" ? "#dcfce7" : "#fef2f2",
                    color: saveMsg.type === "success" ? "#166534" : "#991b1b",
                }}>
                    {saveMsg.text}
                </div>
            )}

            {/* Стандарт колоды: что нужно исправить (подсветка типов — ниже, в ячейках «Тип») */}
            {!loading && tasks.length > 0 && (deckStandard.issues.length > 0 || deckStandard.warnings.length > 0) && (
                <div style={{
                    padding: "8px 14px", borderRadius: 6, marginBottom: 8, fontSize: 12,
                    background: deckStandard.dashboardReady ? "#fffbeb" : "#fef2f2",
                    border: `1px solid ${deckStandard.dashboardReady ? "#fde68a" : "#fca5a5"}`,
                    color: deckStandard.dashboardReady ? "#92400e" : "#991b1b",
                }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        {deckStandard.dashboardReady
                            ? "Колода распознаётся, но есть замечания по стандарту:"
                            : "Колода НЕ по стандарту — дашборд прогресса для неё не строится:"}
                    </div>
                    {deckStandard.issues.map((msg, i) => (
                        <div key={`iss-${i}`}>• {msg}</div>
                    ))}
                    {deckStandard.warnings.map((msg, i) => (
                        <div key={`warn-${i}`} style={{ color: "#92400e" }}>⚠ {msg}</div>
                    ))}
                    <div style={{ marginTop: 4, opacity: 0.8 }}>
                        Распознано форматов «Я»: {deckStandard.formats.length}/6 · направлений «Мы»: {deckStandard.directions.length}/6.
                        Проблемные значения в колонке «Тип» подсвечены янтарным.
                    </div>
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
                                <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#f9fafb", contentVisibility: "auto", containIntrinsicSize: "auto 35px" }}>
                                    {COLUMNS.map((col, ci) => {
                                        const cellError = rowErrors.find((e) => e.field === col.key);
                                        const val = getCellValue(ri, col);
                                        const sel = isCellSelected(ri, ci);
                                        const active = activeCell?.row === ri && activeCell?.col === ci;

                                        if (col.autoCheckbox) {
                                            // Вычисляем состояние авто-галочки по текстовому полю
                                            const boundVal = (task[col.boundTo] || "").trim();
                                            let acState = "none";
                                            if (boundVal) {
                                                if (col.needsFile) {
                                                    // Проверяем есть ли загруженный файл в соответствующей файловой колонке
                                                    const fileFieldKey = col.fileField; // "instruction" | "file" | "map"
                                                    const fileVal = (task[fileFieldKey] || "").trim();
                                                    const list = fileFieldKey === "instruction" ? existingInstructions : fileFieldKey === "map" ? existingMaps : existingFiles;
                                                    acState = fileVal && list.includes(fileVal) ? "green" : "yellow";
                                                } else {
                                                    acState = "green";
                                                }
                                            }
                                            return (
                                                <Cell
                                                    key={ci}
                                                    value={val}
                                                    onChange={noop}
                                                    colIdx={ci}
                                                    rowIdx={ri}
                                                    onPasteMulti={handlePasteMulti}
                                                    autoCheckbox
                                                    autoCheckboxState={acState}
                                                    selected={sel}
                                                    isActive={active}
                                                />
                                            );
                                        }

                                        if (col.checkbox) {
                                            const fileLabel = col.key === "hasInstruction" ? (task.instruction || "") : col.key === "hasFile" ? (task.file || "") : col.key === "hasMap" ? (task.map || "") : "";
                                            return (
                                                <Cell
                                                    key={ci}
                                                    value={val}
                                                    onCellChange={handleCellChange}
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
                                            const list = col.fileCol === "instructions" ? existingInstructions : col.fileCol === "maps" ? existingMaps : existingFiles;
                                            const exists = val ? list.includes(val) : undefined;
                                            // checkboxEnabled: текстовое поле заполнено ИЛИ файл уже привязан (старые данные)
                                            const textField = col.fileCol === "instructions" ? "instructionText" : col.fileCol === "maps" ? "mapText" : "materialText";
                                            const hasBoundValue = !!(task[textField] || "").trim() || !!val;
                                            const fSize = val && exists ? (fileSizes[val] ?? null) : null;
                                            return (
                                                <Cell
                                                    key={ci}
                                                    value={val}
                                                    onCellChange={handleCellChange}
                                                    colIdx={ci}
                                                    rowIdx={ri}
                                                    onPasteMulti={handlePasteMulti}
                                                    fileCol={col.fileCol}
                                                    fileExists={exists}
                                                    fileSize={fSize}
                                                    onUploadFile={handleUploadFile}
                                                    onDeleteFile={handleDeleteFile}
                                                    taskNumber={task.number}
                                                    error={cellError?.message}
                                                    checkboxEnabled={hasBoundValue}
                                                    range={range}
                                                    selected={sel}
                                                    isActive={active}
                                                />
                                            );
                                        }

                                        // Подсветка типа не по стандарту (нераспознан / карта без префикса).
                                        const typeWarn = col.key === "contentType" && String(val).trim() !== "" && !isStandardContentType(val);
                                        return (
                                            <Cell
                                                key={ci}
                                                value={val}
                                                onCellChange={handleCellChange}
                                                readOnly={col.readOnly}
                                                multiline={col.multiline}
                                                colIdx={ci}
                                                rowIdx={ri}
                                                onPasteMulti={handlePasteMulti}
                                                error={cellError?.message}
                                                warn={typeWarn}
                                                warnTitle={typeWarn ? "Тип не по стандарту: не распознан как Старт/формат «Я»/направление «Мы» или карта настроения без префикса «<Тип> - Карта настроения»" : undefined}
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
    const router = useRouter();
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
    const [tokensBySection, setTokensBySection] = useState({});
    const [introQuestionnaireUrl, setIntroQuestionnaireUrl] = useState("");
    const [completionSurveyUrl, setCompletionSurveyUrl] = useState("");
    const [questionnaireSaving, setQuestionnaireSaving] = useState(false);
    const [questionnaireError, setQuestionnaireError] = useState("");
    const [questionnaireMessage, setQuestionnaireMessage] = useState("");

    useEffect(() => {
        if (!router.isReady) return;
        let cancelled = false;

        async function checkAuth() {
            try {
                const { authenticated } = await getMayakAdminAuthStatus();
                if (cancelled) return;

                if (authenticated) {
                    setIsAuth(true);
                } else {
                    router.replace(buildMayakAdminLoginUrl(router.asPath || "/admin/mayak-content"));
                }
            } catch {
                if (!cancelled) {
                    router.replace(buildMayakAdminLoginUrl(router.asPath || "/admin/mayak-content"));
                }
            }

            if (!cancelled) {
                setLoading(false);
            }
        }

        checkAuth();
        return () => {
            cancelled = true;
        };
    }, [router]);

    const fetchRanges = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/mayak-content/ranges`);
            const json = await res.json();
            if (json.success) setRanges(json.data || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, []);

    const fetchQuestionnaireSettings = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/mayak-settings");
            const json = await res.json();
            if (json.success && json.data) {
                setIntroQuestionnaireUrl(json.data.introQuestionnaireUrl || "");
                setCompletionSurveyUrl(json.data.completionSurveyUrl || "");
            }
        } catch (err) { console.error(err); }
    }, []);

    const fetchTokensBySection = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/mayak-tokens`);
            const json = await res.json();
            if (json.data) {
                const grouped = {};
                json.data.forEach((t) => {
                    const r = t.sectionId || t.taskRange || "_all";
                    if (!grouped[r]) grouped[r] = [];
                    grouped[r].push(t);
                });
                setTokensBySection(grouped);
            }
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => {
        if (isAuth) {
            fetchRanges();
            fetchTokensBySection();
            fetchQuestionnaireSettings();
        }
    }, [isAuth, fetchQuestionnaireSettings, fetchRanges, fetchTokensBySection]);

    const selectRange = (r) => { setSelectedRange(r); sessionStorage.setItem("mayak_admin_selected_range", r); };
    const goBack = () => { setSelectedRange(null); sessionStorage.removeItem("mayak_admin_selected_range"); fetchRanges(); };

    const handleSaveQuestionnaireSettings = async () => {
        setQuestionnaireSaving(true);
        setQuestionnaireError("");
        setQuestionnaireMessage("");
        try {
            const res = await fetch("/api/admin/mayak-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ introQuestionnaireUrl, completionSurveyUrl }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Не удалось сохранить ссылки анкет");
            setQuestionnaireMessage("Ссылки анкет сохранены");
            await fetchQuestionnaireSettings();
        } catch (err) {
            setQuestionnaireError(err.message || "Не удалось сохранить ссылки анкет");
        }
        setQuestionnaireSaving(false);
    };

    const handleCreateRange = async () => {
        if (!newRange.trim()) return;
        setCreating(true);
        setError("");
        try {
            const res = await fetch("/api/admin/mayak-content/ranges", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ range: newRange.trim(), rangeName: newRangeName.trim() }),
            });
            const json = await res.json();
            if (json.success) { setNewRange(""); setNewRangeName(""); await fetchRanges(); }
            else setError(json.error);
        } catch (err) { setError(err.message); }
        setCreating(false);
    };

    if (!isAuth) return (<><Header /><div style={{ padding: 32, textAlign: "center" }}>Проверка доступа...</div></>);
    if (loading) return (<><Header /><div style={{ padding: 32, textAlign: "center" }}>Загрузка...</div></>);

    return (
        <>
            <Header />
            <div style={{ margin: "0 auto", padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
                    <h1 style={{ fontSize: 20, margin: 0, color: "#1e293b" }}>Управление контентом МАЯК</h1>
                    <MayakAdminBackLink />
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
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                            {ranges.map((r) => {
                                const key = r.sectionId || r.range;
                                const sectionTokens = tokensBySection[key] || [];
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
                                        {sectionTokens.length > 0 ? (
                                            <div style={{ marginTop: 6 }}>
                                                {sectionTokens.map((t) => (
                                                    <div key={t.id} style={{ fontSize: 11, color: "#4338ca", lineHeight: 1.6 }}>
                                                        <span style={{ fontWeight: 600 }}>{t.name}</span>
                                                        <code style={{ fontSize: 9, background: "#e0e7ff", padding: "0px 4px", borderRadius: 3, marginLeft: 4, color: "#6366f1" }}>{t.token.substring(0, 12)}...</code>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>Нет токенов</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: 24, padding: 16, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>Глобальные анкеты MAYAK</div>
                            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
                                Эти ссылки используются во всех колодах для вводной Яндекс-анкеты и анкеты обратной связи при завершении сессии. Trainer берёт их отсюда, а не из отдельных колод.
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Входная анкета</label>
                                    <input
                                        value={introQuestionnaireUrl}
                                        onChange={(e) => setIntroQuestionnaireUrl(e.target.value)}
                                        placeholder="https://forms.yandex.ru/u/..."
                                        style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc", fontSize: 14 }}
                                    />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Выходная анкета</label>
                                    <input
                                        value={completionSurveyUrl}
                                        onChange={(e) => setCompletionSurveyUrl(e.target.value)}
                                        placeholder="https://forms.yandex.ru/u/..."
                                        style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc", fontSize: 14 }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
                                <button onClick={handleSaveQuestionnaireSettings} disabled={questionnaireSaving} style={btnStyle}>
                                    {questionnaireSaving ? "..." : "Сохранить ссылки"}
                                </button>
                                {questionnaireMessage && <span style={{ fontSize: 12, color: "#16a34a" }}>{questionnaireMessage}</span>}
                                {questionnaireError && <span style={{ fontSize: 12, color: "#dc2626" }}>{questionnaireError}</span>}
                            </div>
                        </div>
                    </div>
                ) : (
                    <RangeEditor range={selectedRange} onBack={goBack} />
                )}
            </div>
        </>
    );
}

