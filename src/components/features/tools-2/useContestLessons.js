import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { addKeyToCookies, getKeyFromCookies } from "@/components/features/tools-2/actions";
import { buildContestToken, parseContestToken } from "@/lib/mayakContestAccess";

export const LESSON_STATUS = {
    done: "done",
    current: "current",
    locked: "locked",
};

// Лесенка: пройденные — done, первый непройденный — current, остальные закрыты.
function resolveLessonStatuses(lessons) {
    let currentTaken = false;

    return lessons.map((lesson) => {
        const isDone = lesson.is_completed === "true";
        let status = LESSON_STATUS.locked;

        if (isDone) {
            status = LESSON_STATUS.done;
        } else if (!currentTaken) {
            status = LESSON_STATUS.current;
            currentTaken = true;
        }

        return { ...lesson, status };
    });
}

// Общее состояние уроков для шапки и панели задания.
//
// Через контекст, а не двумя вызовами хука: иначе переключение урока в шапке
// не видно панели, и пришлось бы перезагружать страницу — а перезагрузка на
// каждом переходе между уроками выглядит рвано.
const ContestLessonsContext = createContext(null);

export function ContestLessonsProvider({ children }) {
    const [lessons, setLessons] = useState([]);
    const [lessonNumber, setLessonNumber] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const reload = useCallback(async () => {
        try {
            const response = await fetch("/api/cours", { credentials: "include" });
            const payload = await response.json();
            if (payload?.success && Array.isArray(payload.data)) {
                setLessons(resolveLessonStatuses(payload.data));
            }
        } catch (error) {
            console.error("Не удалось загрузить уроки конкурса:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        reload();
        getKeyFromCookies().then((key) => {
            const parsed = parseContestToken(key?.text);
            setLessonNumber(parsed?.lessonNumber ?? null);
        });
    }, [reload]);

    // Переключение урока без перезагрузки: обновляем ключ (его читает
    // access-gate при следующем входе) и активный номер в состоянии.
    const openLesson = useCallback((nextLessonNumber) => {
        addKeyToCookies(buildContestToken(nextLessonNumber));
        setLessonNumber(Number(nextLessonNumber));
    }, []);

    const value = useMemo(() => {
        const activeLesson = lessons.find((lesson) => Number(lesson.lesson_number) === Number(lessonNumber)) || null;
        const nextLesson = lessons.find((lesson) => Number(lesson.lesson_number) === Number(lessonNumber) + 1) || null;
        return { lessons, lessonNumber, activeLesson, nextLesson, isLoading, reload, openLesson };
    }, [lessons, lessonNumber, isLoading, reload, openLesson]);

    return <ContestLessonsContext.Provider value={value}>{children}</ContestLessonsContext.Provider>;
}

export function useContestLessons() {
    return (
        useContext(ContestLessonsContext) || {
            lessons: [],
            lessonNumber: null,
            activeLesson: null,
            nextLesson: null,
            isLoading: true,
            reload: () => {},
            openLesson: () => {},
        }
    );
}
