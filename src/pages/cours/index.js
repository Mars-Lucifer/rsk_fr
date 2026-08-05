import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";
import { getContestTrainerTask } from "@/lib/contestTrainerTasks";
import { buildContestToken } from "@/lib/mayakContestAccess";
import { addKeyToCookies, addUserToCookies } from "@/components/features/tools-2/actions";
import VideoFacade from "@/components/ui/VideoFacade";

// Список уроков конкурса. Состояния и подписи совпадают с лесенкой в шапке
// тренажёра (ContestLessonStepper): участник ходит между двумя экранами и
// должен видеть одно и то же.
//
// Цвета инлайном: глобальные стили портала красят <button> в чёрный на всю
// ширину, и утилитарные классы их не перебивают.
const STATUS = {
    done: "done",
    current: "current",
    locked: "locked",
};

const LOOK = {
    [STATUS.done]: {
        badge: "var(--color-green-peace)",
        badgeText: "var(--color-white)",
        chip: "var(--color-green-noise)",
        chipText: "var(--color-green-peace)",
        label: "Пройден",
    },
    [STATUS.current]: {
        badge: "var(--color-blue)",
        badgeText: "var(--color-white)",
        chip: "var(--color-blue-noise)",
        chipText: "var(--color-blue)",
        label: "Доступен",
    },
    [STATUS.locked]: {
        badge: "var(--color-gray-plus-50)",
        badgeText: "var(--color-gray-white)",
        chip: "var(--color-gray-plus-50)",
        chipText: "var(--color-gray-white)",
        label: "Закрыт",
    },
};

// Лесенка: пройденные — done, первый непройденный — current, остальные закрыты.
function resolveStatuses(lessons) {
    let currentTaken = false;

    return [...lessons]
        .sort((left, right) => Number(left.lesson_number) - Number(right.lesson_number))
        .map((lesson) => {
            const isDone = lesson.is_completed === "true";
            let status = STATUS.locked;

            if (isDone) {
                status = STATUS.done;
            } else if (!currentTaken) {
                status = STATUS.current;
                currentTaken = true;
            }

            return { ...lesson, status, isPending: lesson.is_completed === "process" };
        });
}

export default function Cours() {
    const router = useRouter();
    const [lessons, setLessons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [openingLesson, setOpeningLesson] = useState(null);

    useEffect(() => {
        const loadLessons = async () => {
            try {
                const res = await fetch("/api/cours", { credentials: "include" });
                const data = await res.json();

                if (data.success && Array.isArray(data.data)) {
                    setLessons(resolveStatuses(data.data));
                } else {
                    setError(data.error || "Не удалось загрузить уроки");
                }
            } catch (err) {
                console.error("Ошибка запроса:", err);
                setError("Ошибка сети");
            } finally {
                setLoading(false);
            }
        };

        loadLessons();
    }, []);

    // Промежуточной страницы урока нет: из списка ведём прямо в тренажёр.
    // Ключ участнику не выдаётся — тренажёр опознаёт конкурсный вход по
    // префиксу `contest-` и пускает по сессии портала.
    const openLessonInTrainer = async (lesson) => {
        setOpeningLesson(lesson.id);
        try {
            const response = await fetch("/api/profile/info", { credentials: "include" });
            const payload = await response.json();
            const profile = payload?.data || {};
            const participantId = String(profile.username || profile.email || "").trim();
            const participantName = `${profile.Surname || ""} ${profile.NameIRL || ""}`.trim();

            if (!participantId) {
                setError("Не удалось определить участника");
                setOpeningLesson(null);
                return;
            }

            await addKeyToCookies(buildContestToken(lesson.lesson_number));
            await addUserToCookies(participantId, participantName || participantId, { tokenType: "contest" });
            router.push("/tools/mayak-oko?contest=1");
        } catch (err) {
            console.error("Ошибка перехода в тренажёр:", err);
            setError("Не удалось открыть тренажёр");
            setOpeningLesson(null);
        }
    };

    const completedCount = lessons.filter((lesson) => lesson.status === STATUS.done).length;
    const progress = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;

    return (
        <Layout>
            <Header>
                <Header.Heading>Конкурс</Header.Heading>
            </Header>

            <div className="hero" style={{ gridTemplateRows: "max-content" }}>
                <hgroup className="flex flex-col col-span-8 max-[900px]:col-span-12 gap-[.5rem]">
                    <h3>Этап «Я»</h3>
                    <p className="text-(--color-gray-black)">
                        Восемь уроков. К каждому — задание в тренажёре. Следующий урок открывается после того, как закрыт предыдущий.
                    </p>
                </hgroup>

                {!loading && lessons.length > 0 && (
                    <div className="col-span-4 max-[900px]:col-span-12 flex flex-col gap-[.5rem] justify-center">
                        <span className="link big">
                            Пройдено <span className="text-(--color-blue)">{completedCount}</span> из <span className="text-(--color-blue)">{lessons.length}</span>
                        </span>
                        <div className="w-full h-[.5rem] rounded-[6.25rem] overflow-hidden bg-(--color-blue-noise)">
                            <div className="bg-(--color-blue) h-full" style={{ width: `${progress}%`, transition: "width .3s" }} />
                        </div>
                    </div>
                )}

                {/* Четыре в ряд: восемь уроков ложатся в два ряда. */}
                <div className="col-span-12 grid grid-cols-4 gap-[1.25rem] h-fit max-[1200px]:grid-cols-3 max-[900px]:grid-cols-2 max-[640px]:grid-cols-1">
                    {loading &&
                        [...Array(8)].map((_, idx) => (
                            <div key={idx} className="animate-pulse flex flex-col gap-[.75rem] p-[1.25rem] rounded-[1rem] bg-(--color-white-gray)" style={{ minHeight: "170px" }}>
                                <div className="w-9 h-9 bg-(--color-gray-plus) rounded-full" />
                                <div className="h-4 w-2/3 bg-(--color-gray-plus) rounded" />
                                <div className="h-3 w-1/2 bg-(--color-gray-plus-50) rounded" />
                            </div>
                        ))}

                    {!loading && error && <div className="col-span-4 max-[900px]:col-span-2 max-[640px]:col-span-1 text-center py-10 text-(--color-red)">{error}</div>}

                    {!loading &&
                        !error &&
                        lessons.map((lesson) => {
                            const look = LOOK[lesson.status];
                            const brief = getContestTrainerTask(lesson.lesson_number);
                            const isLocked = lesson.status === STATUS.locked;

                            return (
                                <div
                                    key={lesson.id}
                                    className="flex flex-col justify-between gap-[.75rem] p-[1.25rem] rounded-[1rem] border-[1.5px] transition"
                                    style={{
                                        minHeight: "260px",
                                        borderColor: lesson.status === STATUS.current ? "var(--color-blue)" : "var(--color-gray-plus-50)",
                                        background: lesson.status === STATUS.current ? "var(--color-blue-noise)" : "var(--color-white)",
                                        opacity: isLocked ? 0.7 : 1,
                                    }}>
                                    <div className="flex flex-col gap-[.5rem]">
                                        {/* Ролик прямо в карточке: отдельная страница урока
                                            больше не нужна, смотреть можно отсюда. */}
                                        {lesson.download_url?.includes("rutube.ru") && <VideoFacade url={lesson.download_url} title={lesson.lesson_name} eager={!isLocked} />}
                                        <div className="flex items-center justify-between gap-[.5rem]">
                                            <span
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    width: "2rem",
                                                    height: "2rem",
                                                    borderRadius: "50%",
                                                    background: look.badge,
                                                    color: look.badgeText,
                                                    fontWeight: 600,
                                                    fontSize: "0.875rem",
                                                    flexShrink: 0,
                                                }}>
                                                {lesson.status === STATUS.done ? "✓" : lesson.lesson_number}
                                            </span>
                                            <span
                                                style={{
                                                    background: look.chip,
                                                    color: look.chipText,
                                                    borderRadius: "6.25rem",
                                                    padding: "0.25rem 0.625rem",
                                                    fontSize: "0.75rem",
                                                    fontWeight: 500,
                                                    whiteSpace: "nowrap",
                                                }}>
                                                {lesson.isPending ? "На проверке" : look.label}
                                            </span>
                                        </div>

                                        <h6>{lesson.lesson_name}</h6>
                                        {brief && (
                                            <p className="text-[0.8125rem]" style={{ color: "var(--color-gray-black)" }}>
                                                Формат «{brief.format}»
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        disabled={isLocked || openingLesson === lesson.id}
                                        onClick={() => !isLocked && openLessonInTrainer(lesson)}
                                        style={{
                                            background: isLocked ? "var(--color-gray-plus-50)" : lesson.status === STATUS.done ? "var(--color-green-noise)" : "var(--color-blue)",
                                            color: isLocked ? "var(--color-gray-white)" : lesson.status === STATUS.done ? "var(--color-green-peace)" : "var(--color-white)",
                                            border: "none",
                                            borderRadius: "0.75rem",
                                            padding: "0.5rem 1rem",
                                            fontSize: "0.875rem",
                                            fontWeight: 500,
                                            cursor: isLocked ? "not-allowed" : "pointer",
                                            width: "100%",
                                        }}>
                                        {isLocked ? "Закрыт" : openingLesson === lesson.id ? "Открываем..." : lesson.status === STATUS.done ? "Открыть снова" : "К уроку"}
                                    </button>
                                </div>
                            );
                        })}

                    {!loading && !error && lessons.length === 0 && (
                        <div className="col-span-4 max-[900px]:col-span-2 max-[640px]:col-span-1 text-center py-10 text-gray-500">Уроки не найдены</div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
