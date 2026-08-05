import { useEffect, useState } from "react";

import { getContestTrainerTask } from "@/lib/contestTrainerTasks";
import { useContestLessons } from "@/components/features/tools-2/useContestLessons";

// Конкурсный режим тренажёра: карточка задания вместо управления сессией.
//
// Лесенка уроков живёт в шапке (ContestLessonStepper), здесь — что нужно
// сделать, кнопки выполнения и компактный видеоурок под рукой.

// Цвета инлайном: глобальные стили портала красят <button> в чёрный.
const LOOK = {
    start: { background: "var(--color-green-noise)", color: "var(--color-green-peace)" },
    finish: { background: "var(--color-red-noise)", color: "var(--color-red)" },
    next: { background: "var(--color-blue-noise)", color: "var(--color-blue)" },
};

function buttonStyle(look, disabled) {
    return {
        ...look,
        border: "none",
        borderRadius: "0.75rem",
        padding: "0.5rem 1rem",
        fontSize: "0.875rem",
        fontWeight: 500,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
    };
}

export default function ContestLessonPanel() {
    const { activeLesson, nextLesson, isLoading, reload, openLesson } = useContestLessons();
    const [isRunning, setIsRunning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Сброс состояния при переходе на другой урок — иначе новый урок
    // открывался бы уже «запущенным».
    useEffect(() => {
        setIsRunning(false);
    }, [activeLesson?.id]);

    if (isLoading || !activeLesson) {
        return null;
    }

    const brief = getContestTrainerTask(activeLesson.lesson_number);
    const isLessonDone = activeLesson.is_completed === "true";

    const finishTask = async () => {
        setIsSaving(true);
        try {
            const response = await fetch("/api/cours/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ course_id: activeLesson.id, is_completed: true }),
            });
            const payload = await response.json();
            if (payload.success) {
                setIsRunning(false);
                await reload();
            } else {
                console.error("Не удалось закрыть урок:", payload.error);
            }
        } catch (error) {
            console.error("Ошибка сохранения прогресса:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const goToNextLesson = () => {
        if (!nextLesson) {
            window.location.href = "/cours";
            return;
        }
        openLesson(nextLesson.lesson_number);
    };

    return (
        <div className="flex flex-col gap-[0.75rem]">
            <div className="flex items-start justify-between gap-[0.75rem] flex-wrap">
                <div className="flex flex-col">
                    <span className="text-sm text-gray-500">Урок {activeLesson.lesson_number}</span>
                    <span className="font-semibold">{activeLesson.lesson_name}</span>
                </div>

                <div className="flex items-center gap-[0.5rem]">
                    {isLessonDone ? (
                        <>
                            <span
                                style={{
                                    background: "var(--color-green-noise)",
                                    color: "var(--color-green-peace)",
                                    borderRadius: "6.25rem",
                                    padding: "0.375rem 0.75rem",
                                    fontSize: "0.8125rem",
                                    fontWeight: 500,
                                    whiteSpace: "nowrap",
                                }}>
                                ✓ Задание выполнено
                            </span>
                            <button type="button" onClick={goToNextLesson} style={buttonStyle(LOOK.next, false)}>
                                {nextLesson ? "Следующий урок" : "К урокам"}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={isRunning ? finishTask : () => setIsRunning(true)}
                            style={buttonStyle(isRunning ? LOOK.finish : LOOK.start, isSaving)}>
                            {isRunning ? (isSaving ? "Сохраняем..." : "Завершить задание") : "Начать задание"}
                        </button>
                    )}
                </div>
            </div>

            {/* Задание: что сделать, по шагам, и каким должен быть результат. */}
            {brief && (
                <div className="flex flex-col gap-[0.5rem] p-[1rem] rounded-[0.75rem]" style={{ background: "var(--color-white-gray)" }}>
                    <span className="text-sm font-semibold">Задание — формат «{brief.format}»</span>
                    <p className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                        {brief.goal}
                    </p>
                    <ol className="text-sm flex flex-col gap-[0.25rem]" style={{ color: "var(--color-gray-black)", paddingLeft: "1.1rem", listStyle: "decimal" }}>
                        {brief.steps.map((step) => (
                            <li key={step}>{step}</li>
                        ))}
                    </ol>
                    <p className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                        <span style={{ fontWeight: 600 }}>Результат: </span>
                        {brief.result}
                    </p>
                </div>
            )}

            {activeLesson.download_url?.includes("rutube.ru") && (
                <iframe
                    src={activeLesson.download_url}
                    style={{ border: "none", borderRadius: "0.75rem", aspectRatio: 16 / 9, width: "100%", maxWidth: "22rem" }}
                    allow="autoplay; fullscreen"
                    allowFullScreen
                />
            )}
        </div>
    );
}
