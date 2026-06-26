import { memo } from "react";

// Оверлеи тренажёра, вынесенные из монолита trainer.js (этап 3 рефакторинга):
// презентационные компоненты, рисующиеся поверх основного layout. Логика
// (bypass-состояние, расчёт прогресса/джокеров) остаётся в trainer.js и
// приходит сюда пропсами — компоненты чистые и мемоизированные.

// --- Тост достижения ------------------------------------------------------
// Показывается в правом нижнем углу. Управляется родителем: рендерится только
// когда achievement задан; onDismiss закрывает.
export const AchievementToast = memo(function AchievementToast({ achievement, onDismiss }) {
    if (!achievement) return null;
    return (
        <>
            <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white/95 backdrop-blur-md border border-emerald-100/80 shadow-[0_12px_40px_rgba(16,185,129,0.12)] p-3 rounded-xl w-max max-w-[360px] animate-slide-in pointer-events-auto transition-all duration-300">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-amber-100 to-orange-200 border border-amber-200/40 flex items-center justify-center text-xl shadow-[inset_0_1.5px_3px_rgba(255,255,255,0.6)]">
                    {achievement.icon}
                </div>
                <div className="flex-1 min-w-0 pr-1" style={{ textWrap: "normal" }}>
                    <div className="text-[13px] font-extrabold text-slate-800 leading-tight">
                        {achievement.title.replace(/^Достижение:\s*/, "").replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim()}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {achievement.message}
                    </div>
                </div>
                <div
                    role="button"
                    tabIndex={0}
                    onClick={onDismiss}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onDismiss();
                        }
                    }}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-full bg-transparent hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center w-5 h-5 min-w-[20px] min-h-[20px] flex-shrink-0"
                >
                    ✕
                </div>
            </div>
            <style>{`
                @keyframes slideInUp {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-in {
                    animation: slideInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </>
    );
});

// --- Панель отладки (bypass) ----------------------------------------------
// Перетаскиваемое окно для администратора/bypass-режима: ручная подмена фазы
// прогресса, направления, баланса джокеров. Видимостью (canUseDebugPanel &&
// showBypassMenu) управляет родитель — здесь только отрисовка.
export const TrainerDebugPanel = memo(function TrainerDebugPanel({
    position,
    onDragStart,
    onClose,
    jokerBalance,
    yaProgress,
    yaDirectionOptions,
    panelJokerSpent,
    onPhaseChange,
    onProgressChange,
    onWeProgressChange,
    onDirectionChange,
    onJokerSpentChange,
    onResetAchievements,
}) {
    return (
        <div
            style={{
                position: "fixed",
                left: `${position.x}px`,
                top: `${position.y}px`,
                zIndex: 9999,
            }}
            className="w-80 bg-white border border-slate-200/80 rounded-2xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.4)] overflow-hidden flex flex-col select-none"
        >
            {/* Шапка */}
            <div
                onPointerDown={onDragStart}
                className="flex justify-between items-center px-3.5 py-2.5 bg-gradient-to-r from-slate-800 to-slate-700 cursor-move"
            >
                <span className="flex items-center gap-1.5 text-[11px] uppercase font-bold text-slate-200 tracking-wider">
                    <span className="inline-flex w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                    Панель отладки
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-slate-300 hover:text-white !bg-white/0 hover:!bg-white/15 p-0.5 rounded-md cursor-pointer !shadow-none !border-none flex items-center justify-center !w-6 !h-6 flex-shrink-0 transition-colors"
                >
                    ✕
                </button>
            </div>

            <div className="p-3.5 flex flex-col gap-3">
                {/* Индикатор звёзд-джокеров */}
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/60 border border-rose-200/70">
                    <div className="flex items-center gap-2">
                        <svg className={`w-5 h-5 transition-all duration-300 ${jokerBalance > 0 ? "text-red-500 fill-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.6)]" : "text-slate-300 fill-slate-300"}`} viewBox="0 0 24 24">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                        <span className="text-[11px] font-bold text-rose-800">Звёзды-джокеры</span>
                    </div>
                    <span className={`text-base font-extrabold tabular-nums ${jokerBalance > 0 ? "text-red-600" : "text-slate-400"}`}>
                        {jokerBalance}
                    </span>
                </div>

                {/* Раздел: Этапы прогресса (Я → ИЦЗ единым рядом) */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Этап прогресса</span>
                        <span className="flex-1 h-px bg-slate-150" />
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                        {[
                            { key: "START", label: "1. Старт" },
                            { key: "CONTENT_TYPES", label: "2. Контент" },
                            { key: "SPECIALIZATION", label: "3. Спец" },
                            { key: "WE_INDEX", label: "4. ИЦЗ" },
                        ].map((step) => {
                            const active =
                                yaProgress.phase === step.key ||
                                (step.key === "SPECIALIZATION" && yaProgress.phase === "CHOOSING_DIRECTION");
                            return (
                                <button
                                    key={step.key}
                                    type="button"
                                    onClick={() => onPhaseChange(step.key)}
                                    title={step.key === "WE_INDEX" ? "Индекс цифровой зрелости" : undefined}
                                    className={`text-[10px] py-1.5 px-1 rounded-lg font-semibold border transition-all cursor-pointer !shadow-none !w-auto ${
                                        active
                                            ? "!bg-blue-600 !border-blue-600 !text-white shadow-sm"
                                            : "!bg-slate-50 !border-slate-200 !text-slate-500 hover:!bg-slate-100 hover:!text-slate-700"
                                    }`}
                                >
                                    {step.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Прогресс части «Я» (чипы 0..target) */}
                    {yaProgress.phase !== "WE_INDEX" && (
                        <div className="flex items-center justify-between text-[11px] text-slate-600 gap-2">
                            <span className="flex-shrink-0 font-medium">Прогресс:</span>
                            <div className="flex flex-wrap gap-1 justify-end">
                                {Array.from({ length: yaProgress.target + 1 }).map((_, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => onProgressChange(idx)}
                                        className={`!w-[24px] !h-[24px] rounded-lg flex items-center justify-center font-bold text-[10px] border transition-all cursor-pointer !shadow-none ${
                                            yaProgress.count === idx
                                                ? "!bg-blue-600 !border-blue-600 !text-white"
                                                : "!bg-slate-50 !border-slate-200 !text-slate-500 hover:!bg-slate-100"
                                        }`}
                                    >
                                        {idx}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Прогресс ИЦЗ (часть «Мы») — слайдер 0..36 + пресеты */}
                    {yaProgress.phase === "WE_INDEX" && (
                        <>
                            <div className="flex items-center justify-between text-[11px] text-slate-600">
                                <span className="font-medium">Индекс цифровой зрелости:</span>
                                <span className="font-extrabold text-slate-800 tabular-nums">{yaProgress.count} из {yaProgress.target}</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={36}
                                step={1}
                                value={Math.min(yaProgress.count, 36)}
                                onChange={(e) => onWeProgressChange(parseInt(e.target.value, 10) || 0)}
                                className="w-full accent-blue-600 cursor-pointer"
                            />
                            <div className="flex flex-wrap gap-1">
                                {[0, 6, 12, 18, 24, 30, 36].map((mark) => (
                                    <button
                                        key={mark}
                                        type="button"
                                        onClick={() => onWeProgressChange(mark)}
                                        className={`flex-1 min-w-[28px] !h-[22px] rounded-md flex items-center justify-center font-bold text-[10px] border transition-all cursor-pointer !shadow-none ${
                                            yaProgress.count === mark
                                                ? "!bg-blue-600 !border-blue-600 !text-white"
                                                : "!bg-slate-50 !border-slate-200 !text-slate-500 hover:!bg-slate-100"
                                        }`}
                                    >
                                        {mark}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Направление специализации */}
                    {(yaProgress.phase === "SPECIALIZATION" || yaProgress.phase === "CHOOSING_DIRECTION" || yaProgress.phase === "WE_INDEX") && (
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span className="font-medium">Направление:</span>
                            <select
                                value={yaProgress.direction || ""}
                                onChange={(e) => onDirectionChange(e.target.value)}
                                className="text-[10px] py-1 px-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
                            >
                                <option value="">-- Выбрать --</option>
                                {yaDirectionOptions.map((opt) => (
                                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Раздел: Звезда-джокер (трата) */}
                {yaProgress.hasStar && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] font-medium text-slate-600">Потратить джокер:</span>
                        <div className="flex gap-1">
                            <button
                                type="button"
                                onClick={() => onJokerSpentChange(0)}
                                className={`text-[10px] py-1 px-2.5 rounded-lg font-bold border transition-all cursor-pointer !shadow-none ${
                                    panelJokerSpent === 0
                                        ? "!bg-amber-500 !border-amber-500 !text-white"
                                        : "!bg-slate-50 !border-slate-200 !text-slate-500 hover:!bg-slate-100"
                                }`}
                            >
                                Нет
                            </button>
                            <button
                                type="button"
                                onClick={() => onJokerSpentChange(1)}
                                className={`text-[10px] py-1 px-2.5 rounded-lg font-bold border transition-all cursor-pointer !shadow-none ${
                                    panelJokerSpent === 1
                                        ? "!bg-slate-700 !border-slate-700 !text-white"
                                        : "!bg-slate-50 !border-slate-200 !text-slate-500 hover:!bg-slate-100"
                                }`}
                            >
                                Да
                            </button>
                        </div>
                    </div>
                )}

                <div className="pt-2.5 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onResetAchievements}
                        className="!w-full text-[10.5px] !bg-red-50 hover:!bg-red-100 !text-red-600 !border-red-200 border py-1.5 rounded-lg font-bold text-center cursor-pointer transition-colors !shadow-none"
                    >
                        Сбросить достижения
                    </button>
                </div>
            </div>
        </div>
    );
});
