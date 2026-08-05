import { useState } from "react";

import { addKeyToCookies } from "@/components/features/tools-2/actions";
import { buildContestToken } from "@/lib/mayakContestAccess";
import { useContestLessons } from "@/components/features/tools-2/useContestLessons";

// Конкурсный режим тренажёра: панель урока вместо управления сессией.
//
// Лесенка уроков живёт в шапке (ContestLessonStepper), здесь — само задание
// и видеоурок под рукой, чтобы не возвращаться на страницу урока.
//
// ponytail: содержимого задания пока нет — «Начать/Завершить» работает как
// заглушка, чтобы цепочку можно было пройти целиком. Появится вместе с
// конкурсной колодой.

// Цвета инлайном: глобальные стили портала красят <button> в чёрный.
const ACTION_LOOK = {
    start: { background: "var(--color-green-noise)", color: "var(--color-green-peace)" },
    finish: { background: "var(--color-red-noise)", color: "var(--color-red)" },
    next: { background: "var(--color-blue-noise)", color: "var(--color-blue)" },
};

function actionButtonStyle(look, disabled) {
    return {
        ...look,
        border: "none",
        borderRadius: "0.75rem",
        padding: "0.5rem 1rem",
        fontSize: "0.875rem",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
    };
}

export default function ContestLessonPanel() {
    const { activeLesson, nextLesson, isLoading, reload } = useContestLessons();
    const [isRunning, setIsRunning] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isVideoOpen, setIsVideoOpen] = useState(true);

    if (isLoading || !activeLesson) {
        return null;
    }

    const isLessonDone = isFinished || activeLesson.is_completed === "true";

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
                setIsFinished(true);
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
        addKeyToCookies(buildContestToken(nextLesson.lesson_number));
        window.location.reload();
    };

    return (
        <div className="flex flex-col gap-[0.75rem]">
            <div className="flex items-center justify-between gap-[0.75rem] flex-wrap">
                <span className="text-sm text-gray-500">
                    Урок {activeLesson.lesson_number} — {activeLesson.lesson_name}
                </span>

                <div className="flex items-center gap-[0.5rem]">
                    {!isLessonDone && (
                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={isRunning ? finishTask : () => setIsRunning(true)}
                            style={actionButtonStyle(isRunning ? ACTION_LOOK.finish : ACTION_LOOK.start, isSaving)}>
                            {isRunning ? (isSaving ? "Сохраняем..." : "Завершить задание") : "Начать задание"}
                        </button>
                    )}

                    {isLessonDone && (
                        <button type="button" onClick={goToNextLesson} style={actionButtonStyle(ACTION_LOOK.next, false)}>
                            {nextLesson ? "Перейти к следующему уроку" : "Вернуться к урокам"}
                        </button>
                    )}
                </div>
            </div>

            {activeLesson.download_url?.includes("rutube.ru") && (
                <div className="flex flex-col gap-[0.375rem]">
                    {isVideoOpen && (
                        <iframe
                            src={activeLesson.download_url}
                            width="100%"
                            style={{ border: "none", borderRadius: "0.75rem", aspectRatio: 16 / 9 }}
                            allow="autoplay; fullscreen"
                            allowFullScreen
                        />
                    )}
                    <button
                        type="button"
                        className="text-sm w-fit"
                        style={{ background: "none", border: "none", padding: 0, color: "var(--color-blue)", cursor: "pointer" }}
                        onClick={() => setIsVideoOpen((open) => !open)}>
                        {isVideoOpen ? "Свернуть видеоурок" : "Показать видеоурок"}
                    </button>
                </div>
            )}
        </div>
    );
}
