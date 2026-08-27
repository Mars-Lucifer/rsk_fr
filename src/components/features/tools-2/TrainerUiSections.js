import { memo, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";

import Button from "@/components/ui/Button";
import ContestLessonPanel from "@/components/features/tools-2/ContestLessonPanel";
import { formatDay2TaskNumber } from "@/lib/mayakDay2Mode";
import Input from "@/components/ui/Input/Input";
import Switcher from "@/components/ui/Switcher";

import InfoIcon from "@/assets/general/info.svg";
import CopyIcon from "@/assets/general/copy.svg";
import Plusicon from "@/assets/general/plus.svg";
import RandomIcon from "@/assets/general/random.svg";

/**
 * Открытая карточка второго дня.
 *
 * Полоса слева повторяет цвет тайла, который лежит у человека в руке: у детали
 * один цвет луча, у узла и переходника два — как раскрашена грань стыка на
 * картоне. Сверять номера глазами после этого не нужно, рука и экран говорят
 * одно (ТЗ, раздел В9).
 *
 * Порядок чтения задан сверху вниз: номер, вопрос дня, ситуация, что сделать.
 * Вопрос стоит вторым и набран крупнее остального — в 12:40 человек читает
 * первые две строки, а не абзац.
 */
function Day2Card({ card }) {
    const accent = card.accent?.length ? card.accent : ["#E5E7EB"];

    return (
        <div className="flex overflow-hidden rounded-[0.75rem] border border-gray-200">
            <div className="flex w-[0.375rem] shrink-0 flex-col" aria-hidden="true">
                {accent.map((color, index) => (
                    <span key={`${color}-${index}`} className="flex-1" style={{ background: color }} />
                ))}
            </div>

            <div className="flex min-w-0 flex-col gap-[0.75rem] p-[1rem]">
                <div className="flex flex-wrap items-baseline gap-x-[0.5rem] gap-y-[0.125rem]">
                    <span className="text-lg font-semibold leading-none">{card.numberLabel}</span>
                    {card.title && <span className="text-sm text-gray-500">{card.title}</span>}
                </div>

                {card.question && <span className="text-base leading-snug">{card.question}</span>}
                {card.description && <span className="text-sm text-gray-500">{card.description}</span>}

                {card.task && (
                    <div className="flex flex-col gap-[0.25rem]">
                        <span className="text-xs uppercase tracking-wide text-gray-400">Что сделать</span>
                        <span className="text-sm">{card.task}</span>
                    </div>
                )}

                {card.dueMidday && (
                    <span className="text-sm text-gray-500">Готово, когда: {card.dueMidday}</span>
                )}
            </div>
        </div>
    );
}

/**
 * Блок навигации второго дня.
 *
 * Заменяет собой «Задание №N» со стрелками. Отличий три: поле принимает текст,
 * а не только цифры; ходить по колоде некуда, поэтому стрелок нет; подпись
 * показывает такт, а не номер задания. Отказ разбора пишется тут же — участник
 * в зале должен понять, что делать, без ведущего.
 */
function Day2TaskNav({ state, card, takt, problem, onOpen, disabled }) {
    const [value, setValue] = useState("");
    // Отказ относится к тому, что набрали, а не к полю вообще: «сначала сдайте
    // деталь 13» обязан исчезнуть, как только человек начал править ввод.
    // Иначе он висит поверх уже открывшегося такта и читается как поломка.
    const [asked, setAsked] = useState("");

    const submit = (event) => {
        event.preventDefault();
        setAsked(value);
        onOpen(value);
    };

    return (
        <div className="flex flex-col gap-[0.75rem]">
            {/* Строка такта. Слева — какой такт идёт в зале, справа — сколько
                до его конца. Время серверное, здесь оно только тикает: три
                команды иначе разойдутся к вечеру на четверть часа. Больше на
                экране участника про расписание ничего нет (ТЗ, раздел В10). */}
            <div className="flex items-center justify-between w-full gap-[0.5rem]">
                <span className="text-sm font-medium">
                    {takt?.label || state?.label || "Такт 1 · деталь"}
                </span>
                {takt?.running && (
                    <span
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: takt.overdue ? "var(--color-red)" : "var(--color-black)" }}>
                        {takt.overdue ? "время вышло" : takt.remaining}
                    </span>
                )}
            </div>

            <div className="flex items-start justify-between w-full gap-[0.5rem]">
                <span className="text-sm text-gray-500">
                    {!state && "Наберите номер своей детали с тайла."}
                    {state?.takt === "DETAIL" && `Партнёр — ${state.partner}. Соединяетесь после обеда.`}
                    {state?.takt === "NODE" && `Ваш узел — ${state.node.replace("-", " ")}. Не сошлось — так и наберите.`}
                    {state?.takt === "PRODUCT" && "Изделие открывается словом стола."}
                </span>
                <div className="flex items-center gap-[0.25rem] shrink-0 pt-[0.4rem]">
                    {[1, 2, 3].map((i) => (
                        <span
                            key={i}
                            className="inline-block w-[1.5rem] h-[0.3rem] rounded-full"
                            style={{ background: state && i <= state.index ? "var(--color-black)" : "#E5E7EB" }}
                        />
                    ))}
                </div>
            </div>

            {/* Отметка такта. Всплывает сама и у всех разом, потому что привязана
                к серверному времени. Первая ловит главный дефект дня — проверку
                продукта на машине автора (ТЗ, раздел В3). */}
            {takt?.mark && (
                <div
                    className="rounded-[0.75rem] px-[0.875rem] py-[0.625rem] text-sm"
                    style={{ background: "#FAEEDA", color: "#633806" }}>
                    {takt.mark.text}
                </div>
            )}

            <form onSubmit={submit} className="flex items-center gap-[0.5rem]">
                <div className="flex-1 min-w-0">
                    <Input
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="13 · 13 14 · 13 14 не сошлось · среда"
                        className="!h-10"
                        disabled={disabled}
                    />
                </div>
                <Button className="!w-auto !h-10 !px-[1.25rem]" type="submit" disabled={disabled}>
                    Открыть
                </Button>
            </form>

            {problem && value === asked && (
                <span className="text-sm" style={{ color: "var(--color-red)" }}>{problem}</span>
            )}

            {card && <Day2Card card={card} />}
        </div>
    );
}

export const ROLE_DESCRIPTIONS = {
    ЛЕТОПИСЕЦ: "Превращает рабочий процесс в историю. Фиксирует не только факты, но и эмоции команды. Делает фото и видео ярких моментов, создает итоговый ролик о пути команды.",
    Инспектор: "Страж качества и правил. Следит за объективностью оценки, анализирует работу соседних команд и предоставляет им аргументированную обратную связь.",
    МЕДИАТОР: "Хранитель гармонии и атмосферы безопасности. Отвечает за то, чтобы голос каждого участника был услышан. Проводит сессии рефлексии и вовлекает «тихих» участников в обсуждение.",
    "ХРАНИТЕЛЬ МАЯКА": "Ответственный за темп, энергию и боевой дух. Проводит специальные ритуалы для поднятия командного духа и следит, чтобы «огонь» в команде не гас в трудные моменты.",
    ИНЖЕНЕР: "Мастер технологий. Устраняет технический хаос, помогает участникам с настройкой ноутбуков и цифровых инструментов, обеспечивая стабильную работу всей команды.",
    КАПИТАН: "Стратег и лидер. Ведет команду к цели через продуктивные дебаты, гарантирует внутреннюю дисциплину и проверяет выполнение ролевых задач каждым участником.",
};

const contentTypesOrder = [
    { key: "текст", label: "Текст" },
    { key: "аудио", label: "Аудио" },
    { key: "изображение", label: "Изображение", shortLabel: "Изобр." },
    { key: "интерактив", label: "Интерактив", shortLabel: "Интеракт." },
    { key: "данные", label: "Данные" },
    { key: "видео", label: "Видео" }
];

const contentTypeColors = {
    "текст": { bg: "bg-[#00a0e3]", border: "border-[#00a0e3]", text: "text-white" },
    "аудио": { bg: "bg-[#e3563e]", border: "border-[#e3563e]", text: "text-white" },
    "изображение": { bg: "bg-[#1d4f91]", border: "border-[#1d4f91]", text: "text-white" },
    "интерактив": { bg: "bg-[#8bbad3]", border: "border-[#8bbad3]", text: "text-white" },
    "данные": { bg: "bg-[#84bd00]", border: "border-[#84bd00]", text: "text-white" },
    "видео": { bg: "bg-[#e09a1c]", border: "border-[#e09a1c]", text: "text-white" }
};

export const MayakField = memo(function MayakField({ field, value, isMobile, disabled, onChange, onShowBuffer, onAddToBuffer, onRandom, savedField }) {
    const { code, label } = field;
    const placeholder = label.split(" - ")[1];

    const handleChange = (e) => onChange(code, e.target.value);
    const handleShowBuffer = () => onShowBuffer(code);
    const handleAddToBuffer = () => onAddToBuffer(code);
    const handleRandom = () => onRandom(code);

    return (
        <div className="flex w-full items-center gap-4">
            <span className="w-6 text-center font-bold text-lg text-gray-400">{label.charAt(0)}</span>
            <div className="group flex-1 flex w-full items-start gap-2">
                {isMobile ? (
                    <>
                        <div className="flex-1 min-w-0 flex flex-col">
                            <div className="input-wrapper w-full">
                                <TextareaAutosize minRows={1} style={{ lineHeight: "1.5rem" }} className="w-full resize-none bg-transparent outline-none text-black overflow-hidden" placeholder={placeholder} value={value} onChange={handleChange} disabled={disabled} />
                                {value && <p className="text-xs text-gray-400 pb-2 pl-[0.875rem] opacity-70">{label}</p>}
                            </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                            <Button icon type="button" onClick={handleShowBuffer} disabled={disabled} title="Сохраненные варианты">
                                <CopyIcon />
                            </Button>
                            <div className="relative">
                                <Button icon type="button" onClick={handleAddToBuffer} disabled={disabled} title="Сохранить">
                                    <Plusicon />
                                </Button>
                                {savedField === code && (
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg whitespace-nowrap z-10 transition-opacity duration-300">Сохранено</span>
                                )}
                            </div>
                            <Button icon type="button" onClick={handleRandom} disabled={disabled} title="Случайный вариант">
                                <RandomIcon />
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex-1 min-w-0 flex flex-col">
                            <div className="input-wrapper w-full">
                                <TextareaAutosize minRows={1} style={{ lineHeight: "1.5rem" }} className="w-full resize-none bg-transparent outline-none text-black overflow-hidden" placeholder={placeholder} value={value} onChange={handleChange} disabled={disabled} />
                                {value && <p className="text-xs text-gray-400 pb-2 pl-[0.875rem] opacity-70">{label}</p>}
                            </div>
                        </div>
                        <Button icon className="!flex lg:!hidden lg:group-hover:!flex" onClick={handleShowBuffer} type="button" disabled={disabled} title="Сохраненные варианты">
                            <CopyIcon />
                        </Button>
                        <div className="relative !flex lg:!hidden lg:group-hover:!flex">
                            <Button icon className="!flex" onClick={handleAddToBuffer} type="button" disabled={disabled} title="Сохранить">
                                <Plusicon />
                            </Button>
                            {savedField === code && (
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg whitespace-nowrap z-50 transition-opacity duration-300 pointer-events-none">
                                    Сохранено
                                </span>
                            )}
                        </div>
                        <Button icon className="!flex lg:!hidden lg:group-hover:!flex" onClick={handleRandom} type="button" disabled={disabled} title="Случайный вариант">
                            <RandomIcon />
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
});

const EyeOpenIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 12C3.9 7.8 7.4 5 12 5s8.1 2.8 10 7c-1.9 4.2-5.4 7-10 7S3.9 16.2 2 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
);

const EyeClosedIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10.6 5.2A10.7 10.7 0 0 1 12 5c4.6 0 8.1 2.8 10 7a11.8 11.8 0 0 1-4 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.7 6.7A11.8 11.8 0 0 0 2 12c1.9 4.2 5.4 7 10 7 1.7 0 3.2-.4 4.6-1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
export const TrainerControls = memo(function TrainerControls({
    isDay2,
    day2State,
    day2Card,
    day2Takt,
    day2Problem,
    onDay2Open,
    who,
    taskVersion,
    currentTaskIndex,
    tasks,
    taskInputValue,
    isTaskRunning,
    taskElapsedTime,
    instructionFileUrl,
    taskFileUrl,
    mapFileUrl,
    isMapPreviewOpen,
    isInstructionPreviewOpen,
    canToggleMapPreview,
    sourceUrl,
    currentTask,
    isCurrentTaskAllowed,
    allowedMinIndex,
    allowedMaxIndex,
    rankingDelta5,
    selectedRole,
    tableNumber,
    onWhoChange,
    onPrevTask,
    onNextTask,
    onTaskInputChange,
    onContentTypeClick,
    contentTypeAnchors = [],
    onToggleTaskTimer,
    onToggleMapPreview,
    onToggleInstructionPreview,
    onShowRolePopup,
    onToolLink1Click,
    mayakData,
    onShowInstruction,
    isCurrentTaskIntro,
    isCurrentTaskRoleSelection,
    isTaskActionDisabled,
    isReworkTask,
    isCurrentTaskApproved,
    isTaskNavigationLocked,
    canAccessTaskResources,
    taskActionLabel,
    materialDownloadNotice,
    onTaskFileDownloaded,
    yaProgress,
    isSessionMode,
    onShowYaDirectionSelection,
    tokenType,
    isContestMode = false,
}) {

    const formatTaskTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const handleDownloadTaskFile = () => {
        if (!taskFileUrl || !canAccessTaskResources || typeof document === "undefined") return;

        const link = document.createElement("a");
        link.href = taskFileUrl;
        link.download = "";
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onTaskFileDownloaded?.();
    };

    return (
        <div className="flex flex-col gap-[0.75rem]">
            {taskVersion !== "v2" && (
                <div className="flex gap-[0.5rem]">
                    <Switcher value={who} onChange={onWhoChange} className="!w-full">
                        <Switcher.Option value="im">Я</Switcher.Option>
                        <Switcher.Option value="we">Мы</Switcher.Option>
                    </Switcher>
                </div>
            )}

            {/* Счётчик «0 из 4» — прогресс автомата ПЕРВОГО дня
                (START → CONTENT_TYPES → …). У второго дня свой автомат из трёх
                состояний, и его подпись стоит в блоке навигации. Два прогресса
                на одном экране противоречили бы друг другу. */}
            {!isDay2 && (isSessionMode || tokenType === "bypass") && who === "im" && yaProgress && (
                <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 relative">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                        <span className="flex items-center gap-1 flex-wrap">
                            {yaProgress.phase === "START" && "Личный прогресс: Старт"}
                            {yaProgress.phase === "CONTENT_TYPES" && "Личный прогресс: Освоение типов контента"}
                            {yaProgress.phase === "CHOOSING_DIRECTION" && "Личный прогресс: Выбор специализации"}
                            {yaProgress.phase === "WE_INDEX" && "Индекс цифровой зрелости"}
                            {yaProgress.phase === "SPECIALIZATION" && (
                                <>
                                    Личный прогресс (Специализация: <span className="capitalize text-teal-700 font-bold">{yaProgress.direction}</span>)
                                    <button
                                        type="button"
                                        onClick={onShowYaDirectionSelection}
                                        className="inline-flex items-center justify-center !p-0.5 !bg-transparent !text-black hover:!text-slate-600 cursor-pointer !shadow-none !border-none !w-auto !h-auto !min-h-0 !min-w-0"
                                        title="Изменить специализацию"
                                    >
                                        ✎
                                    </button>
                                </>
                            )}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="font-bold text-slate-800">{yaProgress.count} из {yaProgress.target}</span>
                        </div>
                    </div>
                    {yaProgress.phase === "CONTENT_TYPES" ? (
                        <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 flex w-full gap-1 sm:gap-1.5">
                                {contentTypesOrder.map((type) => {
                                    const isCompleted = Array.isArray(yaProgress.completedTypes) && yaProgress.completedTypes.includes(type.key);
                                    const colorStyles = contentTypeColors[type.key] || { bg: "bg-blue-500", border: "border-blue-500", text: "text-white" };
                                    // Кликабельна только если для типа задан якорь и доступна навигация.
                                    const hasAnchor = Array.isArray(contentTypeAnchors) && contentTypeAnchors.includes(type.key);
                                    const clickable = hasAnchor && !isTaskRunning && !isTaskNavigationLocked && typeof onContentTypeClick === "function";
                                    return (
                                        // Плашка — это div (не button), чтобы глобальный стиль `button {}`
                                        // из colour.css не перекрашивал блок в чёрный/серый. Заливка типа
                                        // задаётся только классами Tailwind по isCompleted. Клик по якорю
                                        // остаётся доступным через role/tabIndex/onKeyDown.
                                        <div
                                            key={type.key}
                                            role={clickable ? "button" : undefined}
                                            tabIndex={clickable ? 0 : undefined}
                                            onClick={clickable ? () => onContentTypeClick(type.key) : undefined}
                                            onKeyDown={clickable ? (e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    onContentTypeClick(type.key);
                                                }
                                            } : undefined}
                                            aria-disabled={!clickable}
                                            title={hasAnchor ? "Перейти к заданию этого типа" : undefined}
                                            className={`flex-1 flex items-center justify-center py-1.5 px-0.5 sm:px-1 text-[9px] sm:text-[10.5px] font-bold rounded-lg border transition-all duration-300 ${
                                                isCompleted
                                                    ? `${colorStyles.bg} ${colorStyles.border} ${colorStyles.text} shadow-sm`
                                                    : "bg-white border-slate-200 text-slate-400"
                                            } ${clickable ? "cursor-pointer hover:brightness-95" : "cursor-default"}`}
                                        >
                                            <span className="hidden sm:inline">{type.label}</span>
                                            <span className="inline sm:hidden">{type.shortLabel || type.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-500 rounded-full ${yaProgress.hasStar ? "bg-gradient-to-r from-emerald-400 to-teal-500" : "bg-gradient-to-r from-blue-400 to-indigo-500"}`}
                                    style={{ width: `${yaProgress.percentage}%` }}
                                />
                            </div>
                            {yaProgress.phase === "SPECIALIZATION" && (
                                <svg className={`w-6 h-6 flex-shrink-0 transition-colors duration-300 ${
                                    yaProgress.count >= 4
                                        ? "text-red-500 fill-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.6)]"
                                        : yaProgress.count === 3
                                        ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]"
                                        : "text-slate-300 fill-slate-300"
                                }`} viewBox="0 0 24 24">
                                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                                </svg>
                            )}
                        </div>
                    )}
                    {yaProgress.phase === "CHOOSING_DIRECTION" && (
                        <Button
                            className="w-full !bg-blue-600 !text-white hover:!bg-blue-700 py-1.5 px-3 rounded-lg font-bold text-sm mt-1 flex items-center justify-center gap-1.5"
                            onClick={onShowYaDirectionSelection}
                        >
                            Выбрать специализацию
                        </Button>
                    )}
                </div>
            )}

            <div className="flex flex-col gap-[0.75rem]">
                {isContestMode && <ContestLessonPanel />}
                {/* Второй день: вместо ходьбы по колоде — одно текстовое поле.
                    Участник набирает то, что видит на тайле: 13 · 13 14 ·
                    13 14 не сошлось · среда. Стрелок нет: деталь у него одна. */}
                {!isContestMode && isDay2 && (
                    <Day2TaskNav
                        state={day2State}
                        card={day2Card}
                        takt={day2Takt}
                        problem={day2Problem}
                        onOpen={onDay2Open}
                        disabled={isTaskRunning || isTaskNavigationLocked}
                    />
                )}
                {!isContestMode && !isDay2 && <div className="flex flex-col gap-[0.75rem]">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-[0.5rem]">
                            <span className="text-sm text-gray-500">Задание №{tasks.length > 0 && tasks[currentTaskIndex] ? tasks[currentTaskIndex].number || currentTaskIndex + 1 : 0}</span>
                            {isCurrentTaskApproved ? <span className="text-sm font-medium text-emerald-600">Задание выполнено</span> : null}
                        </div>
                        {rankingDelta5 !== null && (
                            <span className="text-sm font-semibold whitespace-nowrap" style={{ color: "var(--color-black)" }}>
                                ур.5 Δ {rankingDelta5}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button className="!w-10 !h-10 !p-0 flex items-center justify-center" onClick={onPrevTask} disabled={currentTaskIndex <= allowedMinIndex || isTaskRunning || isTaskNavigationLocked}>
                            ←
                        </Button>
                        <Input type="text" inputMode="numeric" min="1" max={tasks.length || 1} value={taskInputValue} onChange={onTaskInputChange} className="text-center !w-15 !h-10" disabled={isTaskRunning || isTaskNavigationLocked} />
                        <Button className="!w-10 !h-10 !p-0 flex items-center justify-center" onClick={onNextTask} disabled={currentTaskIndex >= allowedMaxIndex || isTaskRunning || isTaskNavigationLocked}>
                            →
                        </Button>
                        {mapFileUrl && (
                            <span title={!canToggleMapPreview ? "Карта недоступна" : isMapPreviewOpen ? "Скрыть карту" : "Показать карту"}>
                                <Button icon type="button" className="!w-10 !h-10 !p-0 flex items-center justify-center !text-black" onClick={onToggleMapPreview} disabled={!canToggleMapPreview}>
                                    {isMapPreviewOpen ? <EyeOpenIcon /> : <EyeClosedIcon />}
                                </Button>
                            </span>
                        )}
                    </div>
                </div>}
                <div className="flex flex-wrap lg:flex-nowrap gap-[0.5rem] items-center">
                    {!isContestMode && (isCurrentTaskAllowed || isTaskRunning || isReworkTask) && (
                        <Button className={isTaskRunning || isReworkTask ? "!bg-(--color-red-noise) !text-(--color-red)" : isTaskActionDisabled ? "!bg-slate-100 !text-slate-500" : "!bg-(--color-green-noise) !text-(--color-green-peace)"} onClick={onToggleTaskTimer} disabled={isTaskActionDisabled}>
                            {isTaskRunning ? (isCurrentTaskIntro || isReworkTask ? "Завершить" : `Завершить (${formatTaskTime(taskElapsedTime)})`) : taskActionLabel || "Начать задание"}
                        </Button>
                    )}
                    {instructionFileUrl && (
                        <span className="w-full" title={!canAccessTaskResources ? "Сначала начните задание" : ""}>
                            <Button type="button" onClick={onToggleInstructionPreview} disabled={!canAccessTaskResources} className="w-full">
                                {isInstructionPreviewOpen ? "Закрыть инструкцию" : "Инструкция"}
                            </Button>
                        </span>
                    )}
                    {taskFileUrl && (
                        <span className="w-full" title={!canAccessTaskResources ? "Сначала начните задание" : ""}>
                            <Button
                                type="button"
                                onClick={handleDownloadTaskFile}
                                disabled={!canAccessTaskResources}
                                className="w-full">
                                Доп.материал
                            </Button>
                        </span>
                    )}
                    {currentTask?.toolLink1 && (
                        <span className="w-full" title={!canAccessTaskResources ? "Сначала начните задание" : ""}>
                            <Button inverted as="a" href={currentTask.toolLink1} target="_blank" disabled={!canAccessTaskResources} className={`w-full ${!canAccessTaskResources ? "opacity-50 cursor-not-allowed" : ""}`} onClick={onToolLink1Click}>
                                {currentTask.toolName1 || "Инструмент"}
                            </Button>
                        </span>
                    )}
                    {currentTask?.toolLink2 && (
                        <span className="w-full" title={!canAccessTaskResources ? "Сначала начните задание" : ""}>
                            <Button
                                inverted
                                as="a"
                                href={currentTask.toolLink2}
                                target="_blank"
                                disabled={!canAccessTaskResources}
                                className={`w-full ${!canAccessTaskResources ? "opacity-50 cursor-not-allowed" : ""}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.open(currentTask.toolLink2, "_blank");
                                }}>
                                {currentTask.toolName2 || "Инструмент"}
                            </Button>
                        </span>
                    )}
                    {currentTask?.services &&
                        (() => {
                            const items = currentTask.services
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean);
                            const serviceLinks = mayakData?.defaultLinks?.services || [];
                            const parsed = items
                                .map((item) => {
                                    const parts = item.split("|");
                                    const name = parts.length > 1 ? parts[0].trim() : item;
                                    const url = parts.length > 1 ? parts[1].trim() : item;
                                    if (!/^https?:\/\//.test(url)) return null;
                                    const displayName = parts.length > 1 ? name : new URL(url).hostname.replace("www.", "");
                                    const linked = serviceLinks.find((s) => s.url === url || s.name.toLowerCase() === displayName.toLowerCase());
                                    return { name: displayName, url, instructionImage: linked?.instructionImage || "" };
                                })
                                .filter(Boolean);
                            if (parsed.length === 0) return null;
                            return (
                                <div className="w-full flex flex-col gap-2 mt-1">
                                    {parsed.map((svc, idx) => (
                                        <div key={idx} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                                            <span className="font-semibold text-sm text-gray-900">{svc.name}</span>
                                            <div className="flex gap-2 flex-shrink-0">
                                                <Button inverted className={`!px-3 !py-1.5 !text-xs ${!isTaskRunning ? "!opacity-50 !cursor-not-allowed" : ""}`} disabled={!canAccessTaskResources} onClick={() => window.open(svc.url, "_blank")}>
                                                    Регистрация
                                                </Button>
                                                {svc.instructionImage && (
                                                    <Button inverted className="!px-3 !py-1.5 !text-xs" onClick={() => onShowInstruction({ name: svc.name, image: svc.instructionImage })}>
                                                        Инструкция
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    {sourceUrl && (
                        <span title={!isTaskRunning ? "Сначала начните задание" : "Источник / Доп. материал"}>
                            <Button
                                icon
                                as="a"
                                href={sourceUrl}
                                target="_blank"
                                disabled={!canAccessTaskResources}
                                className={`!w-9 !h-9 !p-0 flex items-center justify-center ${!canAccessTaskResources ? "opacity-50 cursor-not-allowed" : ""}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (isTaskRunning) {
                                        window.open(sourceUrl, "_blank");
                                    }
                                }}>
                                <div className="w-full h-full flex items-center justify-center">
                                    <InfoIcon className="w-4 h-4 relative translate-x-[0.25px] -translate-y-[0.25px]" />
                                </div>
                            </Button>
                        </span>
                    )}
                    {/* Роль во втором дне не выбирают: она задана номером тайла —
                        это луч участника. А инспектор здесь не назначенная роль,
                        а партнёр по паре (ТЗ В4). */}
                    {!isContestMode && !isDay2 && isCurrentTaskRoleSelection && who === "im" && (

                            <span className="w-full" title={!canAccessTaskResources ? "Сначала начните задание" : ""}>
                                <Button inverted onClick={onShowRolePopup} disabled={!canAccessTaskResources} className={`w-full ${!canAccessTaskResources ? "opacity-50 cursor-not-allowed" : ""}`}>
                                    Выбрать роль
                                </Button>
                            </span>
                        )}
                </div>
                {materialDownloadNotice ? <div className="text-sm font-medium text-emerald-600">{materialDownloadNotice}</div> : null}
            </div>
        </div>
    );
});
