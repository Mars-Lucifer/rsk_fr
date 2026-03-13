import { memo } from "react";
import TextareaAutosize from "react-textarea-autosize";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";
import Switcher from "@/components/ui/Switcher";

import InfoIcon from "@/assets/general/info.svg";
import CopyIcon from "@/assets/general/copy.svg";
import Plusicon from "@/assets/general/plus.svg";
import RandomIcon from "@/assets/general/random.svg";

const ROLE_DESCRIPTIONS = {
    ЛЕТОПИСЕЦ: "Превращает рабочий процесс в историю. Фиксирует не только факты, но и эмоции команды. Делает фото и видео ярких моментов, создает итоговый ролик о пути команды.",
    ИНСПЕКТОР: "Страж качества и правил. Следит за объективностью оценки, анализирует работу соседних команд и предоставляет им аргументированную обратную связь.",
    МЕДИАТОР: "Хранитель гармонии и атмосферы безопасности. Отвечает за то, чтобы голос каждого участника был услышан. Проводит сессии рефлексии и вовлекает тихих участников в обсуждение.",
    "ХРАНИТЕЛЬ МАЯКА": "Ответственный за темп, энергию и боевой дух. Проводит специальные ритуалы для поднятия командного духа и следит, чтобы огонь в команде не гас в трудные моменты.",
    ИНЖЕНЕР: "Мастер технологий. Устраняет технический хаос, помогает участникам с настройкой ноутбуков и цифровых инструментов, обеспечивая стабильную работу всей команды.",
    КАПИТАН: "Стратег и лидер. Ведет команду к цели через продуктивные дебаты, гарантирует внутреннюю дисциплину и проверяет выполнение ролевых задач каждым участником.",
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
                                <TextareaAutosize minRows={1} className="w-full resize-none bg-transparent outline-none text-black" placeholder={placeholder} value={value} onChange={handleChange} disabled={disabled} />
                                {value && <p className="text-xs text-gray-400 pb-2 pl-[0.875rem] opacity-70">{label}</p>}
                            </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                            <Button icon type="button" onClick={handleShowBuffer} disabled={disabled} title="Сохраненные варианты"><CopyIcon /></Button>
                            <div className="relative">
                                <Button icon type="button" onClick={handleAddToBuffer} disabled={disabled} title="Сохранить"><Plusicon /></Button>
                                {savedField === code && <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg whitespace-nowrap z-10 transition-opacity duration-300">Сохранено</span>}
                            </div>
                            <Button icon type="button" onClick={handleRandom} disabled={disabled} title="Случайный вариант"><RandomIcon /></Button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex-1 min-w-0 flex flex-col">
                            <div className="input-wrapper w-full">
                                <TextareaAutosize minRows={1} className="w-full resize-none bg-transparent outline-none text-black" placeholder={placeholder} value={value} onChange={handleChange} disabled={disabled} />
                                {value && <p className="text-xs text-gray-400 pb-2 pl-[0.875rem] opacity-70">{label}</p>}
                            </div>
                        </div>
                        <Button icon className="!flex lg:!hidden lg:group-hover:!flex" onClick={handleShowBuffer} type="button" disabled={disabled} title="Сохраненные варианты"><CopyIcon /></Button>
                        <div className="relative !flex lg:!hidden lg:group-hover:!flex">
                            <Button icon className="!flex" onClick={handleAddToBuffer} type="button" disabled={disabled} title="Сохранить"><Plusicon /></Button>
                            {savedField === code && <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg whitespace-nowrap z-50 transition-opacity duration-300 pointer-events-none">Сохранено</span>}
                        </div>
                        <Button icon className="!flex lg:!hidden lg:group-hover:!flex" onClick={handleRandom} type="button" disabled={disabled} title="Случайный вариант"><RandomIcon /></Button>
                    </>
                )}
            </div>
        </div>
    );
});

export const TrainerControls = memo(function TrainerControls({
    who,
    taskVersion,
    currentTaskIndex,
    tasks,
    taskInputValue,
    isTaskRunning,
    taskElapsedTime,
    instructionFileUrl,
    taskFileUrl,
    sourceUrl,
    currentTask,
    isCurrentTaskAllowed,
    allowedMinIndex,
    allowedMaxIndex,
    rankingDelta5,
    selectedRole,
    onWhoChange,
    onPrevTask,
    onNextTask,
    onTaskInputChange,
    onToggleTaskTimer,
    onCompleteSession,
    onShowRolePopup,
    onToolLink1Click,
    mayakData,
    onShowInstruction,
    isCurrentTaskIntro,
    taskActionLabel,
    isTaskActionDisabled,
    disableTaskNavigation,
    disableCompleteSession,
}) {
    const formatTaskTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const defaultTaskLabel = isTaskRunning ? (isCurrentTaskIntro ? "Завершить" : `Завершить (${formatTaskTime(taskElapsedTime)})`) : "Начать задание";
    const effectiveTaskActionLabel = taskActionLabel || defaultTaskLabel;
    const navigationDisabled = Boolean(disableTaskNavigation || isTaskRunning);
    const currentTaskNumber = Number(currentTask?.number || currentTaskIndex + 1);
    const shouldShowRoleAction = !selectedRole && currentTaskNumber === 2;

    return (
        <div className="flex flex-col gap-[1.6rem]">
            <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-4 lg:gap-[1.6rem]">
                    <h3>Тренажёр</h3>
                    {selectedRole && (
                        <div style={{ position: "relative" }} className="role-tooltip-wrap">
                            <div className="text-sm font-bold text-blue-600 p-2 bg-blue-100 rounded-lg whitespace-nowrap cursor-default">{selectedRole}</div>
                            <div className="role-tooltip" style={{ position: "absolute", left: 0, top: "100%", marginTop: "8px", width: "380px", padding: "12px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "#fff", color: "#111", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", opacity: 0, visibility: "hidden", transition: "opacity 0.2s, visibility 0.2s", zIndex: 50, pointerEvents: "none" }}>
                                <p style={{ fontSize: "12px", color: "#666", lineHeight: "1.5" }}>{ROLE_DESCRIPTIONS[selectedRole] || ""}</p>
                            </div>
                            <style>{`.role-tooltip-wrap:hover .role-tooltip { opacity: 1 !important; visibility: visible !important; }`}</style>
                        </div>
                    )}
                    {rankingDelta5 !== null && <span className="text-sm whitespace-nowrap" style={{ color: "var(--color-black)" }}>ур.5 Δ {rankingDelta5}</span>}
                </div>
                <div className="flex gap-[0.5rem]">
                    <Button inverted className="!bg-(--color-red-noise) !text-(--color-red)" onClick={onCompleteSession} disabled={disableCompleteSession}>Завершить сессию</Button>
                </div>
            </div>
            {taskVersion !== "v2" && (
                <div className="flex gap-[0.5rem]">
                    <Switcher value={who} onChange={onWhoChange} className="!w-full">
                        <Switcher.Option value="im">Я</Switcher.Option>
                        <Switcher.Option value="we">Мы</Switcher.Option>
                    </Switcher>
                </div>
            )}
            <div className="flex flex-col gap-[0.75rem]">
                <div className="flex flex-col gap-[0.75rem]">
                    <div className="flex items-center gap-[0.5rem]">
                        <span className="text-sm text-gray-500">Задание №{tasks.length > 0 && tasks[currentTaskIndex] ? tasks[currentTaskIndex].number || currentTaskIndex + 1 : 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button className="!w-10 !h-10 !p-0 flex items-center justify-center" onClick={onPrevTask} disabled={currentTaskIndex <= allowedMinIndex || navigationDisabled}>←</Button>
                        <Input type="text" inputMode="numeric" min="1" max={tasks.length || 1} value={taskInputValue} onChange={onTaskInputChange} className="text-center !w-15 !h-10" disabled={navigationDisabled} />
                        <Button className="!w-10 !h-10 !p-0 flex items-center justify-center" onClick={onNextTask} disabled={currentTaskIndex >= allowedMaxIndex || navigationDisabled}>→</Button>
                    </div>
                </div>
                <div className="flex flex-wrap lg:flex-nowrap gap-[0.5rem] items-center">
                    {(isCurrentTaskAllowed || isTaskRunning) && <Button className={isTaskRunning ? "!bg-(--color-red-noise) !text-(--color-red)" : "!bg-(--color-green-noise) !text-(--color-green-peace)"} onClick={onToggleTaskTimer} disabled={isTaskActionDisabled}>{effectiveTaskActionLabel}</Button>}
                    {instructionFileUrl && <span className="w-full" title={!isTaskRunning ? "Сначала начните задание" : ""}><Button as="a" href={instructionFileUrl} download onClick={(e) => { e.preventDefault(); window.open(instructionFileUrl, "_blank"); }} disabled={!isTaskRunning} className="w-full">Инструкция</Button></span>}
                    {taskFileUrl && <span className="w-full" title={!isTaskRunning ? "Сначала начните задание" : ""}><Button as="a" href={taskFileUrl} download onClick={(e) => { e.preventDefault(); window.open(taskFileUrl, "_blank"); }} disabled={!isTaskRunning} className="w-full">Доп.материал</Button></span>}
                    {currentTask?.toolLink1 && <span className="w-full" title={!isTaskRunning ? "Сначала начните задание" : ""}><Button inverted as="a" href={currentTask.toolLink1} target="_blank" disabled={!isTaskRunning} className={`w-full ${!isTaskRunning ? "opacity-50 cursor-not-allowed" : ""}`} onClick={onToolLink1Click}>{currentTask.toolName1 || "Инструмент"}</Button></span>}
                    {currentTask?.toolLink2 && <span className="w-full" title={!isTaskRunning ? "Сначала начните задание" : ""}><Button inverted as="a" href={currentTask.toolLink2} target="_blank" disabled={!isTaskRunning} className={`w-full ${!isTaskRunning ? "opacity-50 cursor-not-allowed" : ""}`} onClick={(e) => { e.preventDefault(); window.open(currentTask.toolLink2, "_blank"); }}>{currentTask.toolName2 || "Инструмент"}</Button></span>}
                    {currentTask?.services && (() => {
                        const items = currentTask.services.split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
                            try {
                                const parts = item.split("|");
                                const name = parts.length > 1 ? parts[0].trim() : item;
                                const url = parts.length > 1 ? parts[1].trim() : item;
                                const displayName = parts.length > 1 ? name : new URL(url).hostname.replace("www.", "");
                                const linked = mayakData.defaultLinks?.[currentTask?.contentType || ""]?.find((s) => s.url === url || s.name.toLowerCase() === displayName.toLowerCase());
                                return { name: displayName, url, instructionImage: linked?.instructionImage || "" };
                            } catch {
                                return null;
                            }
                        }).filter(Boolean);
                        if (items.length === 0) return null;
                        return items.map((svc) => (
                            <span key={`${currentTask.number}-${svc.url}`} className="w-full" title={!isTaskRunning ? "Сначала начните задание" : ""}>
                                <Button inverted as="a" href={svc.url} target="_blank" disabled={!isTaskRunning} className={`w-full ${!isTaskRunning ? "opacity-50 cursor-not-allowed" : ""}`} onClick={(e) => { e.preventDefault(); window.open(svc.url, "_blank"); }}>
                                    {svc.name}
                                    {svc.instructionImage && <span className="ml-2 inline-flex items-center" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onShowInstruction({ name: svc.name, image: svc.instructionImage }); }}><InfoIcon /></span>}
                                </Button>
                            </span>
                        ));
                    })()}
                    {shouldShowRoleAction && <Button inverted onClick={onShowRolePopup}>Выбрать роль</Button>}
                </div>
            </div>
        </div>
    );
});
