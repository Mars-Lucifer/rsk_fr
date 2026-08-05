import { addKeyToCookies } from "@/components/features/tools-2/actions";
import { buildContestToken } from "@/lib/mayakContestAccess";
import { LESSON_STATUS, useContestLessons } from "@/components/features/tools-2/useContestLessons";

// Лесенка уроков в шапке тренажёра: горизонтальная, компактная, на уровне
// заголовка «МАЯК ОКО».
//
// Цвета заданы инлайном намеренно: глобальные стили портала красят <button>
// в чёрный, и утилитарные классы их не перебивают.
const CHIP_LOOK = {
    [LESSON_STATUS.done]: { background: "var(--color-green-noise)", color: "var(--color-green-peace)" },
    [LESSON_STATUS.current]: { background: "var(--color-blue-noise)", color: "var(--color-blue)" },
    [LESSON_STATUS.locked]: { background: "var(--color-gray-plus-50)", color: "var(--color-gray-white)" },
};

const ACTIVE_LOOK = { background: "var(--color-blue)", color: "var(--color-white)" };

export default function ContestLessonStepper() {
    const { lessons, lessonNumber, isLoading } = useContestLessons();

    if (isLoading || lessons.length === 0) {
        return null;
    }

    const openLesson = (lesson) => {
        if (lesson.status === LESSON_STATUS.locked || Number(lesson.lesson_number) === Number(lessonNumber)) {
            return;
        }
        addKeyToCookies(buildContestToken(lesson.lesson_number));
        window.location.reload();
    };

    return (
        <div className="flex items-center gap-[0.25rem] overflow-x-auto max-[900px]:hidden">
            {lessons.map((lesson) => {
                const isActive = Number(lesson.lesson_number) === Number(lessonNumber);
                const isLocked = lesson.status === LESSON_STATUS.locked;

                return (
                    <button
                        key={lesson.id}
                        type="button"
                        onClick={() => openLesson(lesson)}
                        disabled={isLocked}
                        title={`${lesson.lesson_number}. ${lesson.lesson_name}`}
                        style={{
                            ...(isActive ? ACTIVE_LOOK : CHIP_LOOK[lesson.status]),
                            border: "none",
                            borderRadius: "6.25rem",
                            padding: "0.25rem 0.625rem",
                            fontSize: "0.75rem",
                            lineHeight: 1.2,
                            whiteSpace: "nowrap",
                            cursor: isLocked ? "not-allowed" : "pointer",
                        }}>
                        {lesson.lesson_number}. {lesson.lesson_name}
                    </button>
                );
            })}
        </div>
    );
}
