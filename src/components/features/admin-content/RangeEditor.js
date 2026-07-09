import { useCallback } from "react";
import { Cell } from "./Cell";
import { BulkUploadDropZone } from "./BulkUploadDropZone";
import { RangeEditorToolbar } from "./RangeEditorToolbar";
import { COLUMNS, isStandardContentType, ANCHOR_OPTIONS } from "./columns";
import { headerStyle, cellStyle } from "./styles";
import { useContentData } from "./hooks/useContentData";
import { useContentFiles } from "./hooks/useContentFiles";
import { useInstructionGenerator } from "./hooks/useInstructionGenerator";
import { useSpreadsheetSelection } from "./hooks/useSpreadsheetSelection";
import { resolveFormatKey } from "@/lib/mayakProgressModel";

// ============ Редактор раздела (Google Sheets стиль) ============
export function RangeEditor({ range, onBack }) {
    const data = useContentData({ range });
    const {
        tasks, setTasks, tasksRef,
        existingFiles, setExistingFiles,
        existingInstructions, setExistingInstructions,
        existingMaps, setExistingMaps,
        fileSizes, setFileSizes,
        saving, saveMsg, setSaveMsg,
        validationErrors, loading, rangeName, setRangeName,
        boundTokens, isDirtyRef,
        deckStandard, toolbarCounts,
        getCellValue, handleCellChange, handlePasteMulti, handleValidate, handleSave,
        saveSnapshot, applyUndo, setCellValue,
    } = data;

    const files = useContentFiles({
        range, tasksRef,
        setTasks, setExistingFiles, setExistingInstructions, setExistingMaps,
        setFileSizes, setSaveMsg, isDirtyRef,
    });
    const { bulkUploading, handleUploadFile, handleDeleteFile, handleBulkUpload } = files;

    const gen = useInstructionGenerator({
        range, tasksRef, tasks, existingMaps,
        setTasks, setExistingInstructions, setSaveMsg, isDirtyRef,
    });
    const {
        genBusyRow, genAllBusy, genProgress,
        getTaskTemplate, handleServiceChange, handleFormatChange,
        isGeneratableContent, handleGenerateInstruction, handleGenerateAll,
        serviceIssues,
    } = gen;

    const { activeCell, isCellSelected, handleMouseDownCell, handleMouseEnterCell } = useSpreadsheetSelection({
        tasksLength: tasks.length,
        getCellValue, setCellValue, saveSnapshot, applyUndo, handlePasteMulti, setSaveMsg,
    });

    const noop = useCallback(() => {}, []);

    // Колонка «Тип-якорь»: один якорь на тип. При выборе типа на строке тот же
    // тип снимается со всех остальных строк, чтобы клик по плашке в тренажёре
    // вёл строго к одному заданию.
    const handleTypeAnchorChange = useCallback((rowIdx, value) => {
        saveSnapshot();
        isDirtyRef.current = true;
        setTasks((prev) => prev.map((t, i) => {
            if (i === rowIdx) return { ...t, typeAnchor: value };
            if (value && (t.typeAnchor || "") === value) return { ...t, typeAnchor: "" };
            return t;
        }));
    }, [saveSnapshot, setTasks, isDirtyRef]);

    if (loading) {
        return <div style={{ padding: 32, textAlign: "center" }}>Загрузка раздела {range}...</div>;
    }

    return (
        <div>
            <RangeEditorToolbar
                range={range}
                onBack={onBack}
                isDirtyRef={isDirtyRef}
                rangeName={rangeName}
                setRangeName={setRangeName}
                toolbarCounts={toolbarCounts}
                genAllBusy={genAllBusy}
                genProgress={genProgress}
                handleGenerateAll={handleGenerateAll}
                handleValidate={handleValidate}
                handleSave={handleSave}
                saving={saving}
                validationErrors={validationErrors}
                boundTokens={boundTokens}
                loading={loading}
                saveMsg={saveMsg}
                deckStandard={deckStandard}
                tasksLength={tasks.length}
                serviceIssues={serviceIssues}
                afterToolbar={(
                    <BulkUploadDropZone
                        onUploadInstructions={(f) => handleBulkUpload(f, "instructions")}
                        onUploadFiles={(f) => handleBulkUpload(f, "files")}
                        onUploadMaps={(f) => handleBulkUpload(f, "maps")}
                        uploading={bulkUploading}
                    />
                )}
            />

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

                                        if (col.source === "action") {
                                            const { svcName, service, formats, matchedServices } = getTaskTemplate(task);
                                            const hasTemplate = formats.length > 0;
                                            const generatable = isGeneratableContent(task.contentType);
                                            const multiService = matchedServices.length > 1;
                                            const selectedSvc = service?.serviceKey || "";
                                            const autoFmtKey = resolveFormatKey(task.contentType);
                                            const autoFmt = formats.find((f) => f.formatKey === autoFmtKey);
                                            const selectedFmt = task.instructionFormat || autoFmt?.formatKey || formats[0]?.formatKey || "";
                                            const busy = genBusyRow === ri || genAllBusy;
                                            const disabled = !generatable || !svcName || !hasTemplate || busy;
                                            const title = !generatable
                                                ? "Автогенерация только для типов: Текст, Аудио, Изображение, Интерактив, Видео, Данные"
                                                : !svcName
                                                ? "Укажите сервис в колонке «Сервисы» или «Инструмент»"
                                                : !hasTemplate
                                                ? `Для сервиса «${svcName}» не загружен шаблон`
                                                : multiService
                                                ? `Несколько сервисов — выбран «${svcName}». Сгенерировать инструкцию.`
                                                : "Сгенерировать PDF-инструкцию из шаблона и карты задания";
                                            return (
                                                <td key={ci} style={{ ...cellStyle, borderLeft: "1px solid #e2e8f0", padding: "2px 4px" }}>
                                                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                                        {multiService && (
                                                            <select
                                                                value={selectedSvc}
                                                                onChange={(e) => handleServiceChange(ri, e.target.value)}
                                                                title="К какому сервису привязать инструкцию"
                                                                style={{ fontSize: 11, maxWidth: 80, border: "1px solid #f59e0b", borderRadius: 4, padding: "2px" }}>
                                                                {matchedServices.map((s) => (
                                                                    <option key={s.serviceKey} value={s.serviceKey}>{s.serviceName}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                        {formats.length > 1 && (
                                                            <select
                                                                value={selectedFmt}
                                                                onChange={(e) => handleFormatChange(ri, e.target.value)}
                                                                title="Формат инструкции"
                                                                style={{ fontSize: 11, maxWidth: 72, border: "1px solid #cbd5e1", borderRadius: 4, padding: "2px" }}>
                                                                {formats.map((f) => (
                                                                    <option key={f.formatKey} value={f.formatKey}>{f.formatName}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                        <button
                                                            type="button"
                                                            disabled={disabled}
                                                            title={title}
                                                            onClick={() => handleGenerateInstruction(ri)}
                                                            style={{
                                                                fontSize: 11,
                                                                fontWeight: 600,
                                                                padding: "4px 8px",
                                                                borderRadius: 4,
                                                                border: "none",
                                                                cursor: disabled ? "default" : "pointer",
                                                                color: "#fff",
                                                                background: disabled ? "#cbd5e1" : "#7c3aed",
                                                                whiteSpace: "nowrap",
                                                            }}>
                                                            {busy ? "..." : "Обновить"}
                                                        </button>
                                                    </div>
                                                </td>
                                            );
                                        }

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

                                        if (col.selectAnchor) {
                                            return (
                                                <td key={ci} style={{ ...cellStyle, borderLeft: "1px solid #e2e8f0", padding: "2px 4px" }}>
                                                    <select
                                                        value={val || ""}
                                                        onChange={(e) => handleTypeAnchorChange(ri, e.target.value)}
                                                        title="Тип-якорь: по клику на эту плашку в тренажёре откроется данное задание. Один якорь на тип."
                                                        style={{ fontSize: 11, width: "100%", border: "1px solid #cbd5e1", borderRadius: 4, padding: "2px" }}>
                                                        <option value="">—</option>
                                                        {ANCHOR_OPTIONS.map((o) => (
                                                            <option key={o.key} value={o.key}>{o.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
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
