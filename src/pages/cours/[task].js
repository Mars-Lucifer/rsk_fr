"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";
import Warning from "@/assets/general/warning.svg";
import TimeBefore from "@/assets/general/timeBefore.svg";
import Button from "@/components/ui/Button";
import { buildTrainerSubmissionMarker, getContestTrainerTask } from "@/lib/contestTrainerTasks";

// ponytail: вход в тренажёр по отладочному bypass-токену — работает только
// локально. В бою нужна ветка tokenType: "contest" в resolveMayakTokenContext,
// которая пускает по авторизации портала (docs/contest-core.md, §1.4).
const TRAINER_ENTRY_TOKEN = "fffff";

export default function Task() {
    const params = useParams();
    const task = params?.task;
    const [lesson, setLesson] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState("false");
    const [isSending, setIsSending] = useState(false);

    // Урок конкурса → колода и диапазон задач в тренажёре.
    const trainerTask = getContestTrainerTask(lesson?.lesson_number);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch(`/api/cours/${task}`, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                });
                if (!res.ok) throw new Error("Ошибка загрузки");

                const data = await res.json();
                switch (data.data.is_completed) {
                    case "process":
                        setSubmitted("process");
                        break;
                    case "true":
                        setSubmitted("true");
                    default:
                        break;
                }
                setLesson(data.data || null);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        if (task) fetchData();
    }, [task]);

    // Задание выполняется в тренажёре, поэтому сюда прилетает не ссылка на файл,
    // а отметка о прохождении. Сдача уходит в ту же очередь модерации.
    const handleSubmit = async () => {
        setIsSending(true);
        try {
            const res = await fetch("/api/cours/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    course_id: lesson.id,
                    file_url: buildTrainerSubmissionMarker(trainerTask),
                }),
            });

            if (res.ok) {
                setSubmitted("process");
            }
        } catch (err) {
            console.error("Ошибка отправки:", err);
        } finally {
            setIsSending(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <Header>
                    <Header.Heading>Конкурс</Header.Heading>
                </Header>
                <div className="flex h-full flex items-center justify-center">
                    <p>Загрузка...</p>
                </div>
            </Layout>
        );
    }

    if (!lesson) {
        return (
            <Layout>
                <Header>
                    <Header.Heading>Конкурс</Header.Heading>
                </Header>
                <div className="flex h-full items-center justify-center">
                    <h1>Задание не найдено</h1>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <Header>
                <Header.Heading>Конкурс</Header.Heading>
            </Header>
            <div className="hero overflow-hidden" style={{ placeItems: "center" }}>
                <div className="h-full w-full col-span-12 grid grid-cols-2 gap-[1.5rem] max-[900px]:grid-cols-1">
                    {/* Блок доступа */}
                    {lesson.download_url.includes("rutube.ru") ? (
                        <iframe
                            key={lesson.id}
                            src={lesson.download_url}
                            width="100%"
                            style={{
                                border: "none",
                                borderRadius: "1rem",
                                aspectRatio: 16 / 9,
                            }}
                            allow="autoplay; fullscreen"
                            allowFullScreen
                        />
                    ) : (
                        <p className="w-full ratio-16/9 flex items-center justify-center text-center">Видео с Rutube не отображается</p>
                    )}

                    {/* Блок описания */}
                    <div className="flex flex-col justify-start items-start gap-[1rem]">
                        <h3>{lesson.lesson_name}</h3>
                        <p>{lesson.description}</p>

                        {submitted == "process" ? (
                            <a className="bg-(--color-gray-plus-50) gap-[0.75rem] p-[0.75rem] rounded-[0.75rem] text-(--color-gray-black) flex flex-row align-center">
                                <TimeBefore />
                                Ожидание проверки
                            </a>
                        ) : submitted == "false" ? (
                            <div className="flex flex-col gap-[0.75rem] w-full p-[1rem] rounded-[1rem] bg-(--color-white-gray)">
                                <h6>Задание</h6>
                                {trainerTask ? (
                                    <>
                                        <p className="text-(--color-gray-black)">
                                            Формат «{trainerTask.format}». Задачи {trainerTask.taskRange} в тренажёре МАЯК ОКО.
                                        </p>
                                        <div className="flex flex-row gap-[0.75rem] max-[640px]:flex-col">
                                            <a href={`/tools/mayak-oko?token=${TRAINER_ENTRY_TOKEN}`} target="_blank" rel="noopener noreferrer">
                                                <Button className="!w-fit">Выполнить задание в тренажёре</Button>
                                            </a>
                                            <Button className="!w-fit" inverted disabled={isSending} onClick={handleSubmit}>
                                                {isSending ? "Отправляем..." : "Задание выполнено"}
                                            </Button>
                                        </div>
                                        <p className="text-(--color-gray-black) text-[0.8125rem]">
                                            Тренажёр откроется в новой вкладке. Выполните задачи и вернитесь сюда, чтобы отправить работу на проверку.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-(--color-gray-black)">Задание к этому уроку пока не настроено.</p>
                                )}
                            </div>
                        ) : (
                            <a className="bg-(--color-green-plus-50) gap-[0.75rem] p-[0.75rem] rounded-[0.75rem] text-(--color-green-minus-50) flex flex-row align-center">Успешно выполнено</a>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}

