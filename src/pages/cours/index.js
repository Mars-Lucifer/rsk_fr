import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";
import Button from "@/components/ui/Button";
import Warning from "@/assets/general/warning.svg";
import Clock from "@/assets/general/clock.svg";
import Cours_les from "@/assets/general/cours_les.svg";
import BadgeAlert from "@/assets/general/badge-alert.svg";

export default function Cours() {
    const router = useRouter();
    const [lessons, setLessons] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadLessons = async () => {
            try {
                const res = await fetch("/api/cours", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                });
                const data = await res.json();

                if (data.success) {
                    setLessons(data.data);
                } else {
                    console.error("Ошибка API:", data);
                }
            } catch (err) {
                console.error("Ошибка запроса:", err);
            } finally {
                setLoading(false);
            }
        };

        loadLessons();
    }, []);

    return (
        <Layout>
            <Header>
                <Header.Heading>Конкурс</Header.Heading>
            </Header>

            <div className="hero overflow-hidden" style={{ placeItems: "center" }}>
                <div className="h-full w-full col-span-12 grid grid-cols-3 gap-[1.5rem] max-[900px]:grid-cols-2 max-[640px]:grid-cols-1">
                    {loading &&
                        [...Array(6)].map((_, idx) => (
                            <div key={idx} className="animate-pulse flex flex-col justify-center items-center gap-[0.75rem] p-[1rem] rounded-[1rem] bg-(--color-white-gray)" style={{ aspectRatio: "16/9", width: "100%" }}>
                                <div className="w-12 h-12 bg-gray-300 rounded-full" />
                                <div className="h-4 w-1/2 bg-gray-300 rounded" />
                                <div className="h-3 w-2/3 bg-gray-200 rounded" />
                            </div>
                        ))}

                    {!loading &&
                        lessons &&
                        (() => {
                            let lockFound = true;
                            let lockEnd = false;

                            return lessons.map((lesson) => {
                                const isCompleted = lesson.is_completed === "true";
                                const isRutube = lesson.download_url.includes("rutube");

                                // 1️⃣ Выполненный и рабочий урок
                                if (isCompleted && isRutube) {
                                    return (
                                        <div key={lesson.id} className="flex flex-col justify-center items-center gap-[0.75rem] p-[1rem] rounded-[1rem] bg-(--color-white-gray)" style={{ aspectRatio: "16/9" }}>
                                            <span className="w-[2.25rem] h-[2.25rem] grid place-items-center rounded-full bg-(--color-green-noise)">
                                                <Cours_les />
                                            </span>
                                            <h6>Урок {lesson.id}</h6>
                                            <p className="w-[60%] text-center">{lesson.lesson_name}</p>
                                            <Button onClick={() => router.push(`/cours/${lesson.id}`)}>К уроку</Button>
                                        </div>
                                    );
                                }

                                // 2️⃣ Сломанный урок (есть отметка выполнен, но нет rutube)
                                if (isCompleted && !isRutube) {
                                    return (
                                        <div key={lesson.id} className="flex flex-col justify-center items-center gap-[0.75rem] p-[1rem] rounded-[1rem] bg-(--color-white-gray)" style={{ aspectRatio: "16/9" }}>
                                            <span className="w-[2.25rem] h-[2.25rem] grid place-items-center rounded-full bg-(--color-red-noise)">
                                                <BadgeAlert />
                                            </span>
                                            <h6>Урок {lesson.id} недоступен</h6>
                                            <p className="w-[60%] text-center">Файл урока повреждён. Обратитесь в поддержку.</p>
                                        </div>
                                    );
                                }

                                // 3️⃣ Следующий после завершённых (доступен к изучению)
                                if (!isCompleted && lockFound) {
                                    lockFound = false; // После этого урока доступ блокируется
                                    return (
                                        <div key={lesson.id} className="flex flex-col justify-center items-center gap-[0.75rem] p-[1rem] rounded-[1rem] bg-(--color-white-gray)" style={{ aspectRatio: "16/9" }}>
                                            <span className="w-[2.25rem] h-[2.25rem] grid place-items-center rounded-full bg-(--color-green-noise)">
                                                <Cours_les />
                                            </span>
                                            <h6>Урок {lesson.id}</h6>
                                            <p className="w-[60%] text-center">{lesson.lesson_name}</p>
                                            <Button onClick={() => router.push(`/cours/${lesson.id}`)}>К уроку</Button>
                                        </div>
                                    );
                                }

                                // 4️⃣ Недоступен (жёлтый) — предыдущий не выполнен
                                if (!isCompleted && !lockFound && !lockEnd) {
                                    lockEnd = true;
                                    return (
                                        <div key={lesson.id} className="flex flex-col justify-center items-center gap-[0.75rem] p-[1rem] rounded-[1rem] bg-(--color-white-gray)" style={{ aspectRatio: "16/9" }}>
                                            <span className="w-[2.25rem] h-[2.25rem] text-yellow-500">
                                                <Warning />
                                            </span>
                                            <h6>Нет доступа</h6>
                                            <p className="w-[60%] text-center">Пройдите предыдущий урок, чтобы открыть этот.</p>
                                        </div>
                                    );
                                }

                                // 5️⃣ Всё остальное — "в будущем" (синий)
                                if (lockEnd) {
                                    return (
                                        <div key={lesson.id} className="flex flex-col justify-center items-center gap-[0.75rem] p-[1rem] rounded-[1rem] bg-(--color-white-gray)" style={{ aspectRatio: "16/9" }}>
                                            <span className="w-[2.25rem] h-[2.25rem] text-blue-500">
                                                <Clock />
                                            </span>
                                            <h6>В будущем</h6>
                                            <p className="w-[60%] text-center">Закончите предыдущие задания и уроки</p>
                                        </div>
                                    );
                                }
                            });
                        })()}

                    {!loading && (!lessons || lessons.length === 0) && <div className="col-span-3 max-[900px]:col-span-2 max-[640px]:col-span-1 text-center py-10 text-gray-500">Уроки не найдены</div>}
                </div>
            </div>
        </Layout>
    );
}

