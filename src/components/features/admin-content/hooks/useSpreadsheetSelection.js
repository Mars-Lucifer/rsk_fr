import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { COLUMNS } from "../columns";
import { copyMayakText } from "@/components/features/tools-2/utils/copyMayakText";

// Экранирование ячейки для TSV (правила Excel/Google Sheets): если значение
// содержит таб/перевод строки/кавычку — оборачиваем в кавычки, внутренние
// кавычки удваиваем. Без этого многострочные ячейки (Описание/Задание и др.)
// ломали границы строк/колонок при копировании диапазона. Симметрично парсеру
// вставки parseClipboardTable.
function escapeTsvCell(value) {
    const s = String(value ?? "");
    return /[\t\n\r"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Выделение ячеек (как в Google Sheets): активная ячейка, диапазон выделения,
// навигация стрелками/Tab/Enter, и глобальные горячие клавиши (Ctrl+C/V/Z, Delete).
//
// Глобальному keydown-слушателю нужны актуальные колбэки данных (getCellValue/
// setCellValue/saveSnapshot/applyUndo/handlePasteMulti) и актуальное состояние
// выделения. Чтобы не пересоздавать слушатель на каждый рендер и не ловить
// устаревшие замыкания, держим ОДИН ref с актуальным обработчиком и обновляем
// его в эффекте — это локальный мост внутри хука, наружу не торчит.
export const useSpreadsheetSelection = ({
    tasksLength, getCellValue, setCellValue, saveSnapshot, applyUndo, handlePasteMulti, setSaveMsg,
}) => {
    // Активная ячейка (толстая синяя рамка)
    const [activeCell, setActiveCell] = useState(null); // {row, col}
    // Выделение ячеек
    const [selStart, setSelStart] = useState(null); // {row, col}
    const [selEnd, setSelEnd] = useState(null);     // {row, col}
    const isSelecting = useRef(false);

    const selectionRange = useMemo(() => {
        if (!selStart || !selEnd) return null;
        return {
            r1: Math.min(selStart.row, selEnd.row),
            r2: Math.max(selStart.row, selEnd.row),
            c1: Math.min(selStart.col, selEnd.col),
            c2: Math.max(selStart.col, selEnd.col),
        };
    }, [selStart, selEnd]);

    const isCellSelected = useCallback((row, col) => {
        if (!selectionRange) return false;
        return row >= selectionRange.r1 && row <= selectionRange.r2 && col >= selectionRange.c1 && col <= selectionRange.c2;
    }, [selectionRange]);

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

    const moveActiveCell = useCallback((dRow, dCol) => {
        setActiveCell((current) => {
            if (!current) return current;
            let newRow = current.row + dRow;
            let newCol = current.col;

            // Ограничиваем по строкам
            if (newRow < 0) newRow = 0;
            if (newRow >= tasksLength) newRow = tasksLength - 1;

            // Для горизонтальной навигации — ищем ближайшую редактируемую колонку
            if (dCol !== 0) {
                const next = findNextEditableCol(current.col, dCol);
                if (next >= 0) newCol = next; else return current;
            }

            if (newCol < 0 || newCol >= COLUMNS.length) return current;

            const target = { row: newRow, col: newCol };
            setSelStart(target);
            setSelEnd(target);
            // Убираем фокус из текущего input
            const tag = document.activeElement?.tagName?.toLowerCase();
            if (tag === "input" || tag === "textarea") document.activeElement.blur();
            return target;
        });
    }, [tasksLength]);

    // Надёжное копирование в буфер: общий хелпер copyMayakText (Clipboard API в
    // secure context, иначе фоллбэк через скрытую textarea + execCommand).
    const copyText = useCallback((text, cellCount) => {
        copyMayakText(text)
            .then(() => setSaveMsg({ type: "success", text: `Скопировано ячеек: ${cellCount}` }))
            .catch(() => setSaveMsg({ type: "error", text: "Не удалось скопировать в буфер обмена" }));
    }, [setSaveMsg]);

    // Мост: один ref с актуальным обработчиком keydown. Присваивание делаем в
    // эффекте (не во время рендера) — иначе react-hooks/refs ругается, и это
    // совпадает с исходным поведением (обработчик всегда видит свежее состояние).
    const keydownHandlerRef = useRef(null);
    useEffect(() => {
        keydownHandlerRef.current = (e) => {
            const tag = document.activeElement?.tagName?.toLowerCase();
            const inInput = tag === "input" || tag === "textarea";
            const sel = selectionRange;
            const isMulti = sel && (sel.r1 !== sel.r2 || sel.c1 !== sel.c2);

            // Escape — убрать фокус из input, сбросить выделение
            if (e.key === "Escape") {
                if (inInput) document.activeElement.blur();
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
                applyUndo();
                return;
            }

            // Ctrl+C — копировать выделенные ячейки как TSV.
            // Если фокус внутри одиночной ячейки и есть текстовое выделение —
            // отдаём копирование браузеру (копируется выделенный текст). Иначе
            // (есть выделение диапазона ИЛИ ячейка без текстового выделения)
            // копируем ячейки сами.
            if ((e.ctrlKey || e.metaKey) && e.key === "c") {
                if (!sel) return;
                if (!isMulti && inInput) {
                    const el = document.activeElement;
                    const hasTextSel = el && typeof el.selectionStart === "number" && el.selectionStart !== el.selectionEnd;
                    if (hasTextSel) return; // пусть браузер скопирует выделенный текст внутри ячейки
                }
                e.preventDefault();
                const lines = [];
                for (let r = sel.r1; r <= sel.r2; r++) {
                    const cells = [];
                    for (let c = sel.c1; c <= sel.c2; c++) {
                        const col = COLUMNS[c];
                        if (!col) { cells.push(""); continue; }
                        cells.push(escapeTsvCell(getCellValue(r, col)));
                    }
                    lines.push(cells.join("\t"));
                }
                const tsv = lines.join("\n");
                const cellCount = (sel.r2 - sel.r1 + 1) * (sel.c2 - sel.c1 + 1);
                copyText(tsv, cellCount);
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
                        handlePasteMulti(selStart.row, selStart.col, text);
                    } else {
                        const col = COLUMNS[selStart.col];
                        if (col && !col.readOnly && !col.fileCol && !col.checkbox && !col.autoCheckbox) {
                            saveSnapshot();
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
            saveSnapshot();
            for (let r = sel.r1; r <= sel.r2; r++) {
                for (let c = sel.c1; c <= sel.c2; c++) {
                    const col = COLUMNS[c];
                    if (!col || col.readOnly || col.fileCol || col.checkbox || col.autoCheckbox) continue;
                    setCellValue(r, col, "");
                }
            }
        };
    });

    useEffect(() => {
        const handler = (e) => keydownHandlerRef.current?.(e);
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    return {
        activeCell, isCellSelected,
        handleMouseDownCell, handleMouseEnterCell,
    };
};
