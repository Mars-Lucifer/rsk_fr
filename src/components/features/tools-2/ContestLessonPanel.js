import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";

import Button from "@/components/ui/Button";
import { addKeyToCookies, getKeyFromCookies } from "@/components/features/tools-2/actions";
import { buildContestToken, parseContestToken } from "@/lib/mayakContestAccess";

// Конкурсный режим тренажёра: панель урока вместо управления сессией.
//
// Отличия от обычного входа (сессия/легаси-токен):
//   - вверху лесенка уроков, а не переключатель номеров задач;
//   - нет ролей и инспектора — это командный этап «Мы», здесь его нет;
//   - завершение задания сразу закрывает урок и открывает следующий.
//
// ponytail: содержимого задания пока нет — «Начать/Завершить» работает как
// заглушка, чтобы можно было пройти цепочку целиком. Когда появится
// конкурсная колода, сюда встанут реальные задачи.

const STATUS = {
    done: "done",
    current: "current",
    locked: "locked",
};

function resolveLessonStatuses(lessons) {
    let currentTaken = false;

    return lessons.map((lesson) => {
        const isDone = lesson.is_completed === "true";
        let status = STATUS.locked;

        if (isDone) {
            status = STATUS.done;
        } else if (!currentTaken) {
            status = STATUS.current;
            currentTaken = true;
        }

        return { ...lesson, status };
    });
}

export default function ContestLessonPanel() {
    const router = useRouter();
    // Номер урока берём из того же ключа, по которому пустил access-gate, —
    // отдельного канала не заводим.
    const [lessonNumber, setLessonNumber] = useState(null);
    const [lessons, setLessons] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isVideoOpen, setIsVideoOpen] = useState(false);

    const loadLessons = useCallback(async () => {
        try {
            const response = await fetch("/api/cours", { credentials: "include" });
            const payload = await response.json();
            if (payload.success && Array.isArray(payload.data)) {
                setLessons(resolveLessonStatuses(payload.data));
            }
        } catch (error) {
            console.error("Не удалось загрузить уроки конкурса:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLessons();

        getKeyFromCookies().then((key) => {
            const parsed = parseContestToken(key?.text);
            setLessonNumber(parsed?.lessonNumber ?? null);
        });
    }, [loadLessons]);

    const activeLesson = lessons.find((lesson) => Number(lesson.lesson_number) === Number(lessonNumber)) || null;
    const nextLesson = lessons.find((lesson) => Number(lesson.lesson_number) === Number(lessonNumber) + 1) || null;

    // Смена урока внутри тренажёра: меняем ключ и перезагружаем — access-gate
    // перепроверит доступ и подтянет задачи нужного урока.
    const openLesson = (lesson) => {
        if (lesson.status === STATUS.locked || Number(lesson.lesson_number) === Number(lessonNumber)) {
            return;
        }
        addKeyToCookies(buildContestToken(lesson.lesson_number));
        router.reload();
    };

    const finishTask = async () => {
        if (!activeLesson) return;
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
                await loadLessons();
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
            router.push("/cours");
            return;
        }
        addKeyToCookies(buildContestToken(nextLesson.lesson_number));
        router.reload();
    };

    if (isLoading) {
        return <div className="text-sm text-gray-500">Загружаем уроки...</div>;
    }

    return (
        <div className="flex flex-col gap-[0.75rem]">
            {/* Лесенка уроков: видно, где участник и что ещё закрыто. */}
            <div className="flex flex-wrap gap-[0.375rem]">
                {lessons.map((lesson) => {
                    const isActive = Number(lesson.lesson_number) === Number(lessonNumber);
                    const base = "px-[0.75rem] py-[0.375rem] rounded-full text-sm whitespace-nowrap transition";
                    const look = isActive
                        ? "bg-(--color-blue) text-white"
                        : lesson.status === STATUS.done
                          ? "bg-(--color-green-noise) text-(--color-green-peace) cursor-pointer"
                          : lesson.status === STATUS.current
                            ? "bg-(--color-blue-noise) text-(--color-blue) cursor-pointer"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed";

                    return (
                        <button
                            key={lesson.id}
                            type="button"
                            className={`${base} ${look}`}
                            onClick={() => openLesson(lesson)}
                            disabled={lesson.status === STATUS.locked}
                            title={lesson.lesson_name}>
                            {lesson.lesson_number}. {lesson.lesson_name}
                        </button>
                    );
                })}
            </div>

            {activeLesson && (
                <div className="flex flex-col gap-[0.5rem]">
                    <span className="text-sm text-gray-500">
                        Урок {activeLesson.lesson_number} — {activeLesson.lesson_name}
                    </span>

                    <div className="flex flex-wrap gap-[0.5rem]">
                        {!isFinished && activeLesson.is_completed !== "true" && (
                            <Button
                                className={isRunning ? "!bg-(--color-red-noise) !text-(--color-red)" : "!bg-(--color-green-noise) !text-(--color-green-peace)"}
                                disabled={isSaving}
                                onClick={isRunning ? finishTask : () => setIsRunning(true)}>
                                {isRunning ? (isSaving ? "Сохраняем..." : "Завершить задание") : "Начать задание"}
                            </Button>
                        )}

                        {(isFinished || activeLesson.is_completed === "true") && (
                            <Button className="!bg-(--color-blue-noise) !text-(--color-blue)" onClick={goToNextLesson}>
                                {nextLesson ? "Перейти к следующему уроку" : "Вернуться к урокам"}
                            </Button>
                        )}
                    </div>

                    {/* Видеоурок под рукой: не нужно возвращаться на страницу урока. */}
                    {activeLesson.download_url?.includes("rutube.ru") && (
                        <div className="flex flex-col gap-[0.375rem]">
                            <button type="button" className="text-sm text-(--color-blue) w-fit" onClick={() => setIsVideoOpen((open) => !open)}>
                                {isVideoOpen ? "Свернуть видеоурок" : "Показать видеоурок"}
                            </button>
                            {isVideoOpen && (
                                <iframe
                                    src={activeLesson.download_url}
                                    width="100%"
                                    style={{ border: "none", borderRadius: "0.75rem", aspectRatio: 16 / 9 }}
                                    allow="autoplay; fullscreen"
                                    allowFullScreen
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
