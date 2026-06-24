import { useState, useEffect, useRef, memo } from "react";
import { COLUMNS } from "./columns";
import { parseClipboardTable } from "./utils/parseClipboardTable";
import { getCellBg, getCellBorder, getAutoCheckboxColors } from "./utils/cellStyles";
import { cellStyle } from "./styles";

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
export const Cell = memo(function Cell({ value, onChange, onCellChange, readOnly, multiline, error, warn, warnTitle, colIdx, rowIdx, onPasteMulti, fileCol, fileExists, fileSize, onUploadFile, onDeleteFile, taskNumber, checkbox, autoCheckbox, autoCheckboxState, checkboxEnabled, fileLabel, range, selected, isActive, onMouseDownCell, onMouseEnterCell }) {
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

    // Стиль ячейки — цвета вычисляются из состояния (см. utils/cellStyles.js)
    const cellBg = getCellBg({ error, warn, selected, isActive, fileCol, fileNumberMismatch, value, fileExists });
    const cellBorder = getCellBorder({ error, isActive, warn, fileCol, fileNumberMismatch, value, selected });
    const col = COLUMNS[colIdx];
    const isLastCol = colIdx === COLUMNS.length - 1;
    const borderRight = isLastCol ? cellBorder : undefined;

    const cellMouseProps = {
        onMouseDown: (e) => { if (onMouseDownCell && !fileCol && !checkbox && !autoCheckbox) { onMouseDownCell(rowIdx, colIdx, e); } },
        onMouseEnter: (e) => { if (onMouseEnterCell && !fileCol && !checkbox && !autoCheckbox && e.buttons === 1) { onMouseEnterCell(rowIdx, colIdx); } },
    };

    // Авто-галочка (три состояния: пусто / жёлтый / зелёный)
    if (autoCheckbox) {
        const { bgColor, borderColor, fillColor, show } = getAutoCheckboxColors(autoCheckboxState);
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
