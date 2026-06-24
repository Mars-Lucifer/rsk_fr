import { useState } from "react";
import Link from "next/link";

// База кнопки-действия тулбара (фон задаётся отдельным классом у каждой кнопки).
// `!`/`w-auto!` перебивают глобальный button{} (чёрный фон, width:100%).
const BTN_BASE = "px-5 py-2 rounded-md! text-white! text-[13px] font-semibold border-none cursor-pointer w-auto!";

// Цвет счётчика готовности: всё загружено — зелёный, что-то нужно — красный, иначе серый.
function counterColor(loaded, needed) {
    if (loaded === needed && needed > 0) return "text-green-600";
    if (needed > 0) return "text-red-600";
    return "text-slate-500";
}

// Редактируемое имя раздела (клик → input). Локальное UI-состояние.
function RangeNameField({ rangeName, setRangeName }) {
    const [editing, setEditing] = useState(false);
    if (editing) {
        return (
            <input
                autoFocus
                value={rangeName}
                onChange={(e) => setRangeName(e.target.value)}
                onBlur={() => setEditing(false)}
                onKeyDown={(e) => { if (e.key === "Enter") setEditing(false); }}
                placeholder="Название раздела"
                className="px-2.5 py-1 rounded-md border border-slate-300 text-sm w-[220px]"
            />
        );
    }
    return (
        <span
            onClick={() => setEditing(true)}
            className={`text-sm cursor-pointer border-b border-dashed border-slate-400 pb-px ${rangeName ? "text-slate-600" : "text-slate-400"}`}
        >
            {rangeName || "Добавить название..."}
        </span>
    );
}

// Тулбар редактора раздела: кнопки (назад/генерация/проверка/сохранение),
// название раздела, счётчики готовности, и информационные баннеры
// (привязанные токены, сообщение операции, стандарт колоды, сервисы вне каталога).
export function RangeEditorToolbar({
    range, onBack, isDirtyRef,
    rangeName, setRangeName, toolbarCounts,
    genAllBusy, genProgress, handleGenerateAll, handleValidate, handleSave,
    saving, validationErrors,
    boundTokens, loading, saveMsg,
    deckStandard, tasksLength, serviceIssues,
    afterToolbar,
}) {
    return (
        <>
            {/* Тулбар */}
            <div className="flex justify-between items-center mb-2 flex-wrap gap-2 py-2">
                <div className="flex gap-2.5 items-center flex-wrap">
                    <button onClick={() => {
                        if (isDirtyRef.current && !window.confirm("Есть несохранённые изменения. Уйти без сохранения?")) return;
                        onBack();
                    }} className="px-4 py-[7px] rounded-md! bg-slate-800! text-white! border-none cursor-pointer text-[13px] font-semibold w-auto!">← Назад</button>
                    <span className="text-lg font-bold text-slate-800">Раздел {range}</span>
                    <RangeNameField rangeName={rangeName} setRangeName={setRangeName} />
                    <span className="text-[12px] text-slate-500 flex gap-3">
                        <span>Инструкций: <b className={counterColor(toolbarCounts.instrLoaded, toolbarCounts.instrNeeded)}>{toolbarCounts.instrLoaded}/{toolbarCounts.instrNeeded}</b></span>
                        <span>Доп.материалов: <b className={counterColor(toolbarCounts.matLoaded, toolbarCounts.matNeeded)}>{toolbarCounts.matLoaded}/{toolbarCounts.matNeeded}</b></span>
                        <span>Карт: <b className={counterColor(toolbarCounts.mapLoaded, toolbarCounts.mapNeeded)}>{toolbarCounts.mapLoaded}/{toolbarCounts.mapNeeded}</b></span>
                    </span>
                </div>
                <div className="flex gap-1.5 items-center flex-wrap">
                    <button onClick={handleGenerateAll} disabled={genAllBusy} title="Сгенерировать PDF-инструкции для контентных заданий (Текст/Аудио/Изображение/Интерактив/Видео/Данные) с шаблоном и картой" className={`${BTN_BASE} bg-violet-600! ${genAllBusy ? "opacity-70" : ""}`}>
                        {genAllBusy ? `Генерация ${genProgress?.done ?? 0}/${genProgress?.total ?? "?"}...` : "⚙ Сгенерировать все"}
                    </button>
                    <button onClick={handleValidate} className={`${BTN_BASE} bg-indigo-500!`}>Проверка</button>
                    <button onClick={handleSave} disabled={saving} className={`${BTN_BASE} ${validationErrors.length > 0 ? "bg-amber-500!" : "bg-green-500!"} ${saving ? "opacity-70" : ""}`}>
                        {saving ? "Сохранение..." : "Сохранить"}
                    </button>
                </div>
            </div>

            {/* Слот между тулбаром и баннерами (зона массовой загрузки) */}
            {afterToolbar}

            {/* Привязанные токены */}
            {boundTokens.length > 0 && (
                <div className="px-3.5 py-2 rounded-md mb-2 bg-indigo-50 border border-indigo-200 text-[12px]">
                    <div className="font-semibold text-indigo-700 mb-1.5">Привязанные токены ({boundTokens.length}):</div>
                    {boundTokens.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 py-[3px] border-b border-indigo-100">
                            <span className="font-semibold text-slate-800 min-w-[100px]">{t.name}</span>
                            <code className="text-[10px] bg-indigo-100 px-1.5 py-px rounded text-indigo-700 select-all">{t.token}</code>
                            <span className="text-[11px] text-slate-500">{t.usedCount}/{t.usageLimit}</span>
                            {!t.isActive && <span className="text-[10px] text-red-600 font-semibold">[неактивен]</span>}
                            {t.isActive && t.isExhausted && <span className="text-[10px] text-red-600 font-semibold">[исчерпан]</span>}
                        </div>
                    ))}
                </div>
            )}
            {boundTokens.length === 0 && !loading && (
                <div className="px-3.5 py-1.5 rounded-md mb-2 bg-yellow-50 border border-amber-200 text-[12px] text-amber-800">
                    Нет привязанных токенов к этому разделу
                </div>
            )}

            {saveMsg && (
                <div className={`px-3.5 py-2 rounded-md mb-2 text-[13px] whitespace-pre-line ${saveMsg.type === "success" ? "bg-green-100 text-green-800" : "bg-red-50 text-red-800"}`}>
                    {saveMsg.text}
                </div>
            )}

            {/* Стандарт колоды: что нужно исправить (подсветка типов — ниже, в ячейках «Тип») */}
            {!loading && tasksLength > 0 && (deckStandard.issues.length > 0 || deckStandard.warnings.length > 0) && (
                <div className={`px-3.5 py-2 rounded-md mb-2 text-[12px] border ${deckStandard.dashboardReady ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-red-50 border-red-300 text-red-800"}`}>
                    <div className="font-bold mb-1">
                        {deckStandard.dashboardReady
                            ? "Колода распознаётся, но есть замечания по стандарту:"
                            : "Колода НЕ по стандарту — дашборд прогресса для неё не строится:"}
                    </div>
                    {deckStandard.issues.map((msg, i) => (
                        <div key={`iss-${i}`}>• {msg}</div>
                    ))}
                    {deckStandard.warnings.map((msg, i) => (
                        <div key={`warn-${i}`} className="text-amber-800">⚠ {msg}</div>
                    ))}
                    <div className="mt-1 opacity-80">
                        Распознано форматов «Я»: {deckStandard.formats.length}/6 · направлений «Мы»: {deckStandard.directions.length}/6.
                        Проблемные значения в колонке «Тип» подсвечены янтарным.
                    </div>
                </div>
            )}

            {/* Проверка сервисов: сервис задания не найден в каталоге «Шаблоны инструкций» */}
            {!loading && serviceIssues.length > 0 && (
                <div className="px-3.5 py-2 rounded-md mb-2 text-[12px] bg-orange-50 border border-orange-300 text-orange-800">
                    <div className="font-bold mb-1">
                        Сервисы вне каталога ({serviceIssues.length}). Автогенерация по ним невозможна.
                    </div>
                    {serviceIssues.slice(0, 12).map((iss, i) => (
                        <div key={`svc-${i}`}>
                            {iss.kind === "no-service"
                                ? `• Задание ${iss.number}: контентный тип, но не указан сервис (колонка «Сервисы» или «Инструмент»).`
                                : `• Задание ${iss.number}: сервис «${iss.name}» не найден в каталоге.${iss.suggestion ? ` Возможно, имелся в виду «${iss.suggestion}».` : ""}`}
                        </div>
                    ))}
                    {serviceIssues.length > 12 && <div className="opacity-80">…и ещё {serviceIssues.length - 12}.</div>}
                    <div className="mt-1 opacity-85">
                        Решение: добавьте сервис на вкладке <Link href="/admin/mayak-service-templates" className="text-blue-600">«Шаблоны инструкций»</Link> (имя + ссылка, можно без шаблона), либо исправьте название сервиса в колонке так, чтобы оно совпадало с каталогом.
                    </div>
                </div>
            )}
        </>
    );
}
