import { useCallback, useEffect, useState } from "react";

import { getKeyFromCookies } from "@/components/features/tools-2/actions";
import { parseContestToken } from "@/lib/mayakContestAccess";

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

// Общий источник для шапки и панели урока: иначе оба компонента дёргают
// /api/cours на каждый рендер экрана.
let inFlightRequest = null;

async function fetchLessonsOnce() {
    if (!inFlightRequest) {
        inFlightRequest = fetch("/api/cours", { credentials: "include" })
            .then((response) => response.json())
            .finally(() => {
                // Ответ не кэшируем: прогресс меняется прямо на этом экране.
                inFlightRequest = null;
            });
    }
    return inFlightRequest;
}

export function useContestLessons() {
    const [lessons, setLessons] = useState([]);
    const [lessonNumber, setLessonNumber] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const reload = useCallback(async () => {
        try {
            const payload = await fetchLessonsOnce();
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

    const activeLesson = lessons.find((lesson) => Number(lesson.lesson_number) === Number(lessonNumber)) || null;
    const nextLesson = lessons.find((lesson) => Number(lesson.lesson_number) === Number(lessonNumber) + 1) || null;

    return { lessons, lessonNumber, activeLesson, nextLesson, isLoading, reload };
}
