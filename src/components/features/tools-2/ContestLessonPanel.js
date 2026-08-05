import { useEffect, useRef, useState } from "react";

import { getContestTrainerTask } from "@/lib/contestTrainerTasks";
import { useContestLessons } from "@/components/features/tools-2/useContestLessons";

// Конкурсный режим тренажёра: карточка задания вместо управления сессией.
//
// Раскладка: сверху краткое задание и видеоурок в две колонки, под ними —
// широкий блок ответа. Подробное описание задания вынесено в попап, чтобы
// шаги не съедали высоту экрана.

// Цвета инлайном: глобальные стили портала красят <button> в чёрный.
const LOOK = {
    start: { background: "var(--color-green-noise)", color: "var(--color-green-peace)" },
    finish: { background: "var(--color-red-noise)", color: "var(--color-red)" },
    next: { background: "var(--color-blue-noise)", color: "var(--color-blue)" },
    ghost: { background: "var(--color-white)", color: "var(--color-blue)" },
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

function TaskBriefPopup({ brief, lessonName, onClose }) {
    return (
        <div
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
            <div
                onClick={(event) => event.stopPropagation()}
                style={{ background: "var(--color-white)", borderRadius: "1rem", padding: "1.5rem", maxWidth: "34rem", width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
                <div className="flex items-start justify-between gap-[0.75rem] mb-[0.75rem]">
                    <div className="flex flex-col">
                        <span className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                            {lessonName}
                        </span>
                        <span className="font-semibold">Задание — формат «{brief.format}»</span>
                    </div>
                    <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", lineHeight: 1 }}>
                        ×
                    </button>
                </div>

                <p className="text-sm mb-[0.75rem]" style={{ color: "var(--color-gray-black)" }}>
                    {brief.goal}
                </p>

                <ol className="text-sm flex flex-col gap-[0.375rem] mb-[0.75rem]" style={{ color: "var(--color-gray-black)", paddingLeft: "1.1rem", listStyle: "decimal" }}>
                    {brief.steps.map((step) => (
                        <li key={step}>{step}</li>
                    ))}
                </ol>

                <p className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                    <span style={{ fontWeight: 600 }}>Результат: </span>
                    {brief.result}
                </p>
            </div>
        </div>
    );
}

export default function ContestLessonPanel() {
    const { activeLesson, nextLesson, isLoading, reload, openLesson } = useContestLessons();
    const fileInputRef = useRef(null);

    const [isRunning, setIsRunning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [answerText, setAnswerText] = useState("");
    const [answerFile, setAnswerFile] = useState(null);
    const [error, setError] = useState("");
    const [isBriefOpen, setIsBriefOpen] = useState(false);

    // Сброс при переходе на другой урок — иначе новый урок открывался бы уже
    // запущенным и с чужим ответом в поле.
    useEffect(() => {
        setIsRunning(false);
        setAnswerText("");
        setAnswerFile(null);
        setError("");
        setIsBriefOpen(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, [activeLesson?.id]);

    if (isLoading || !activeLesson) {
        return null;
    }

    const brief = getContestTrainerTask(activeLesson.lesson_number);
    const isLessonDone = activeLesson.is_completed === "true";
    const hasAnswer = Boolean(answerText.trim() || answerFile);

    const finishTask = async () => {
        if (!hasAnswer) {
            setError("Приложите файл или впишите ответ текстом");
            return;
        }

        setIsSaving(true);
        setError("");
        try {
            const form = new FormData();
            form.append("lessonId", String(activeLesson.id));
            form.append("lessonNumber", String(activeLesson.lesson_number));
            form.append("text", answerText);
            if (answerFile) {
                form.append("file", answerFile);
            }

            const answerResponse = await fetch("/api/contest/answer", { method: "POST", credentials: "include", body: form });
            const answerPayload = await answerResponse.json();
            if (!answerPayload.success) {
                setError(answerPayload.error || "Не удалось сохранить ответ");
                return;
            }

            const progressResponse = await fetch("/api/cours/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ course_id: activeLesson.id, is_completed: true }),
            });
            const progressPayload = await progressResponse.json();
            if (!progressPayload.success) {
                setError(progressPayload.error || "Ответ сохранён, но урок не закрылся");
                return;
            }

            setIsRunning(false);
            await reload();
        } catch (err) {
            console.error("Ошибка завершения задания:", err);
            setError("Ошибка сети");
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
            {isBriefOpen && brief && <TaskBriefPopup brief={brief} lessonName={activeLesson.lesson_name} onClose={() => setIsBriefOpen(false)} />}

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

            <div className="grid grid-cols-2 gap-[0.75rem] max-[900px]:grid-cols-1">
                {/* Слева коротко: цель одной фразой, детали — в попапе. */}
                {brief && (
                    <div className="flex flex-col gap-[0.5rem] p-[0.875rem] rounded-[0.75rem]" style={{ background: "var(--color-white-gray)" }}>
                        <span className="text-sm font-semibold">Формат «{brief.format}»</span>
                        <p className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                            {brief.goal}
                        </p>
                        <button type="button" onClick={() => setIsBriefOpen(true)} style={{ ...buttonStyle(LOOK.ghost, false), alignSelf: "flex-start", padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}>
                            Задание целиком
                        </button>
                    </div>
                )}

                {/* Справа видеоурок. */}
                {activeLesson.download_url?.includes("rutube.ru") && (
                    <iframe
                        src={activeLesson.download_url}
                        style={{ border: "none", borderRadius: "0.75rem", aspectRatio: 16 / 9, width: "100%" }}
                        allow="autoplay; fullscreen"
                        allowFullScreen
                    />
                )}
            </div>

            {/* Ответ — широким блоком под видео: текст слева, файл справа. */}
            {!isLessonDone && (
                <div className="flex flex-col gap-[0.5rem] p-[0.875rem] rounded-[0.75rem]" style={{ background: "var(--color-white-gray)" }}>
                    <span className="text-sm font-semibold">Ваш ответ</span>

                    <div className="flex gap-[0.75rem] items-start max-[900px]:flex-col">
                        <textarea
                            value={answerText}
                            onChange={(event) => setAnswerText(event.target.value)}
                            placeholder="Вставьте текст ответа или опишите, что сделали"
                            rows={3}
                            style={{
                                flex: "1 1 auto",
                                minWidth: 0,
                                width: "100%",
                                border: "1.5px solid var(--color-gray-plus-50)",
                                borderRadius: "0.75rem",
                                padding: "0.625rem 0.75rem",
                                fontSize: "0.875rem",
                                resize: "vertical",
                                background: "var(--color-white)",
                            }}
                        />

                        <div className="flex flex-col gap-[0.25rem]" style={{ flex: "0 0 14rem", maxWidth: "100%" }}>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".doc,.docx,.pdf,.txt,.rtf,.odt,.png,.jpg,.jpeg"
                                onChange={(event) => setAnswerFile(event.target.files?.[0] || null)}
                                style={{ fontSize: "0.75rem", maxWidth: "100%" }}
                            />
                            <span className="text-xs" style={{ color: "var(--color-gray-black)" }}>
                                {answerFile ? answerFile.name : "или приложите файл, до 20 МБ"}
                            </span>
                        </div>
                    </div>

                    {error && (
                        <span className="text-sm" style={{ color: "var(--color-red)" }}>
                            {error}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
