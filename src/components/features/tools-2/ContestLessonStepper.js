import { LESSON_STATUS, useContestLessons } from "@/components/features/tools-2/useContestLessons";

// Лесенка уроков в шапке тренажёра: горизонтальная, на уровне «МАЯК ОКО».
//
// Цвета заданы инлайном намеренно: глобальные стили портала красят <button>
// в чёрный на всю ширину, и утилитарные классы их не перебивают.
const LOOK = {
    [LESSON_STATUS.done]: {
        background: "var(--color-green-noise)",
        color: "var(--color-green-peace)",
        badge: "var(--color-green-peace)",
        badgeText: "var(--color-white)",
    },
    [LESSON_STATUS.current]: {
        background: "var(--color-blue-noise)",
        color: "var(--color-blue)",
        badge: "var(--color-blue)",
        badgeText: "var(--color-white)",
    },
    [LESSON_STATUS.locked]: {
        background: "transparent",
        color: "var(--color-gray-white)",
        badge: "var(--color-gray-plus-50)",
        badgeText: "var(--color-gray-white)",
    },
};

const ACTIVE = {
    background: "var(--color-blue)",
    color: "var(--color-white)",
    badge: "rgba(255,255,255,0.25)",
    badgeText: "var(--color-white)",
};

export default function ContestLessonStepper() {
    const { lessons, lessonNumber, isLoading, openLesson } = useContestLessons();

    if (isLoading || lessons.length === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-[0.25rem] max-[1200px]:hidden" style={{ flex: "1 1 0", minWidth: 0, overflow: "hidden" }}>
            {lessons.map((lesson) => {
                const isActive = Number(lesson.lesson_number) === Number(lessonNumber);
                const isLocked = lesson.status === LESSON_STATUS.locked;
                const look = isActive ? ACTIVE : LOOK[lesson.status];

                return (
                    <button
                        key={lesson.id}
                        type="button"
                        onClick={() => !isLocked && !isActive && openLesson(lesson.lesson_number)}
                        disabled={isLocked}
                        title={`${lesson.lesson_number}. ${lesson.lesson_name}`}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.375rem",
                            background: look.background,
                            color: look.color,
                            border: isLocked ? "1.5px solid var(--color-gray-plus-50)" : "1.5px solid transparent",
                            borderRadius: "6.25rem",
                            padding: "0.25rem 0.625rem 0.25rem 0.25rem",
                            flex: "1 1 0",
                            minWidth: 0,
                            justifyContent: "center",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            fontSize: "0.75rem",
                            fontWeight: isActive ? 600 : 500,
                            lineHeight: 1.2,
                            whiteSpace: "nowrap",
                            cursor: isLocked || isActive ? "default" : "pointer",
                            transition: "all .2s ease",
                        }}>
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "1.25rem",
                                height: "1.25rem",
                                borderRadius: "50%",
                                background: look.badge,
                                color: look.badgeText,
                                fontSize: "0.6875rem",
                                fontWeight: 600,
                                flexShrink: 0,
                            }}>
                            {lesson.status === LESSON_STATUS.done ? "✓" : lesson.lesson_number}
                        </span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{lesson.lesson_name}</span>
                    </button>
                );
            })}
        </div>
    );
}
