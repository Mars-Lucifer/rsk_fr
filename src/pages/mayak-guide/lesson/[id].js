"use client";

import { useCallback, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

import GuideTour from "@/components/features/mayak-guide/GuideTour";
import { LESSONS, lessonById, tableSplit } from "@/components/features/mayak-guide/lessons.mjs";

// Урок мастера. Страница самостоятельная: открывается и прямой ссылкой, и внутри попапа
// консоли доступа через iframe. Внутри iframe подсветить кнопку соседнего документа
// нельзя, поэтому «нажми сюда» здесь идёт по самому уроку, а действия в консоли урок
// показывает и отдаёт ссылкой.
//
// Пройденность уезжает наверх сообщением, а не запросом: прогресс мастера хранится по
// accessId, а урок про accessId ничего не знает и знать не должен.
//
//   window.parent.postMessage({ type: "mayak-guide-lesson", id, status: "passed" }, "*")
//
// Консоль слушает это сообщение и вызывает свой pass_lesson. Пока она не слушает, урок
// работает как обычная страница и отметку показывает у себя.

export async function getStaticPaths() {
    return { paths: LESSONS.map((lesson) => ({ params: { id: lesson.id } })), fallback: false };
}

export async function getStaticProps({ params }) {
    const lesson = lessonById(String(params?.id || ""));
    if (!lesson) return { notFound: true };
    return { props: { lesson } };
}

export default function LessonPage({ lesson }) {
    const router = useRouter();
    const [tour, setTour] = useState(false);
    const [passed, setPassed] = useState(false);
    const [people, setPeople] = useState("18");

    // Откуда пришли: консоль передаёт свой адрес параметром, чтобы кнопка «Открыть
    // консоль» вела в тот же кабинет, а не на общий вход.
    const back = typeof router.query.back === "string" ? router.query.back : "";

    const split = useMemo(() => tableSplit(people), [people]);

    // Шаги тура строятся из блоков урока: у каждого блока свой якорь, и порядок шагов —
    // порядок чтения. Отдельного сценария нет намеренно, иначе текст и подсветка
    // разъедутся при первой же правке урока.
    const steps = useMemo(
        () =>
            lesson.blocks.map((block, i) => {
                // Считалка — единственный блок, где мастер что-то делает руками, поэтому
                // шаг на ней закрывается кликом по полю, а не кнопкой «Дальше». Разница
                // не косметическая: свою группу мастер должен посчитать здесь, а не в
                // аудитории, и шаг, который нельзя пролистать, это и обеспечивает.
                if (block.kind === "calc") {
                    return {
                        sel: `#b${i} input`,
                        title: block.h,
                        text: "Нажмите поле и поставьте размер своей группы: столы, входы и выпадающие роли пересчитаются сразу.",
                        wait: "click",
                        place: "auto",
                    };
                }
                return {
                    sel: `#b${i}`,
                    title: block.h,
                    text: block.p || (block.items ? block.items.map(([term]) => term).join(" · ") : ""),
                    wait: "next",
                    place: "auto",
                };
            }),
        [lesson]
    );

    const finish = useCallback(() => {
        setPassed(true);
        if (typeof window !== "undefined" && window.parent !== window) {
            window.parent.postMessage({ type: "mayak-guide-lesson", id: lesson.id, status: "passed" }, "*");
        }
    }, [lesson.id]);

    return (
        <>
            <Head>
                <title>{`МАЯК · урок мастера · ${lesson.title}`}</title>
            </Head>

            <main>
                <header className="head">
                    <div className="lead">
                        <span className="eyebrow">Урок мастера · {lesson.duration}</span>
                        <h1>{lesson.title}</h1>
                        <p className="sum">{lesson.summary}</p>
                    </div>
                    <button type="button" className="start" onClick={() => setTour(true)}>
                        {passed ? "Пройти ещё раз" : "Провести по уроку"}
                    </button>
                </header>

                {passed ? <div className="done">Урок пройден</div> : null}

                {lesson.blocks.map((block, i) => (
                    <section key={block.h} id={`b${i}`} className="block">
                        <h2>{block.h}</h2>
                        {block.p ? <p>{block.p}</p> : null}

                        {block.kind === "list" ? (
                            <dl>
                                {block.items.map(([term, text]) => (
                                    <div key={term} className="row">
                                        <dt>{term}</dt>
                                        <dd>{text}</dd>
                                    </div>
                                ))}
                            </dl>
                        ) : null}

                        {block.kind === "fork" ? (
                            <div className="fork">
                                {block.items.map(([term, text]) => (
                                    <article key={term}>
                                        <h3>{term}</h3>
                                        <p>{text}</p>
                                    </article>
                                ))}
                            </div>
                        ) : null}

                        {block.kind === "calc" ? (
                            <div className="calc">
                                <label>
                                    <span>Человек в группе</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="120"
                                        value={people}
                                        onChange={(event) => setPeople(event.target.value)}
                                    />
                                </label>
                                <div className="out">
                                    <span className="big">{split.tables}</span>
                                    <span className="cap">
                                        {split.tables ? `столов · ${split.full} полных${split.rest ? ` и один на ${split.rest}` : ""}` : "введите число"}
                                    </span>
                                </div>
                                <div className="out">
                                    <span className="big">{Math.max(0, Math.floor(Number(people) || 0))}</span>
                                    <span className="cap">входов спишется — по одному на участника</span>
                                </div>
                                {split.dropped.length ? (
                                    <p className="note">{`На неполном столе выпадают роли: ${split.dropped.join(", ")}. Инспектор и капитан остаются всегда.`}</p>
                                ) : null}
                                {split.warning ? <p className="warn">{split.warning}</p> : null}
                            </div>
                        ) : null}

                        {block.kind === "field" ? (
                            <a className="cta" href={`/mayak-guide-3d?side=${block.side}&phase=${block.phase}`} target="_blank" rel="noreferrer">
                                {block.cta}
                            </a>
                        ) : null}

                        {block.kind === "act" ? (
                            <a className="cta" href={back || "/mayak-access"} target={back ? "_top" : "_blank"} rel="noreferrer">
                                {block.cta}
                            </a>
                        ) : null}
                    </section>
                ))}
            </main>

            <GuideTour steps={steps} open={tour} onClose={() => setTour(false)} onFinish={finish} title={lesson.title} />

            <style jsx>{`
                main {
                    width: min(760px, 100%);
                    margin: 0 auto;
                    padding: 28px 22px 60px;
                    color: #101820;
                }
                .head {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 16px;
                    margin-bottom: 20px;
                }
                .eyebrow {
                    font-size: 12px;
                    font-weight: 800;
                    color: #627178;
                }
                h1 {
                    margin: 6px 0 4px;
                    font-size: 30px;
                    line-height: 1.1;
                }
                .sum {
                    margin: 0;
                    color: #33424a;
                    font-size: 15px;
                    line-height: 1.45;
                }
                .lead {
                    flex: 1 1 auto;
                    min-width: 0;
                }
                /* Портальный глобальный стиль тянет кнопку на всю строку: без явной
                   ширины заголовок сжимался до узкой колонки, а кнопка занимала полосу. */
                .start {
                    flex: 0 0 auto;
                    width: auto;
                    min-height: 42px;
                    border: 1px solid #152022;
                    border-radius: 8px;
                    background: #152022;
                    color: #fff;
                    padding: 0 16px;
                    font-weight: 800;
                    cursor: pointer;
                }
                .done {
                    border: 1px solid #bde4c7;
                    border-radius: 8px;
                    background: #f1fff4;
                    color: #1c6b33;
                    padding: 10px 12px;
                    font-weight: 700;
                    margin-bottom: 16px;
                }
                .block {
                    border: 1px solid #d9e0e5;
                    border-radius: 10px;
                    background: #fff;
                    padding: 16px 18px;
                    margin-bottom: 12px;
                }
                h2 {
                    margin: 0 0 8px;
                    font-size: 19px;
                    line-height: 1.2;
                }
                p {
                    margin: 0;
                    font-size: 14px;
                    line-height: 1.5;
                    color: #33424a;
                }
                dl {
                    margin: 10px 0 0;
                    display: grid;
                    gap: 8px;
                }
                .row {
                    display: grid;
                    grid-template-columns: minmax(120px, 180px) minmax(0, 1fr);
                    gap: 12px;
                }
                dt {
                    font-weight: 800;
                    font-size: 14px;
                }
                dd {
                    margin: 0;
                    font-size: 14px;
                    line-height: 1.5;
                    color: #33424a;
                }
                .fork {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 10px;
                    margin-top: 10px;
                }
                .fork article {
                    border: 1px solid #d9e0e5;
                    border-radius: 8px;
                    background: #f5f7f8;
                    padding: 12px;
                }
                h3 {
                    margin: 0 0 4px;
                    font-size: 15px;
                }
                .calc {
                    display: grid;
                    grid-template-columns: minmax(150px, 200px) repeat(2, minmax(0, 1fr));
                    gap: 12px;
                    align-items: end;
                    margin-top: 12px;
                }
                label {
                    display: grid;
                    gap: 6px;
                    font-size: 12px;
                    font-weight: 700;
                    color: #627178;
                }
                input {
                    min-height: 42px;
                    border: 1px solid #b9c4cc;
                    border-radius: 8px;
                    padding: 0 12px;
                    font-size: 16px;
                }
                .out {
                    display: grid;
                    gap: 2px;
                }
                .big {
                    font-size: 28px;
                    font-weight: 800;
                    line-height: 1;
                }
                .cap {
                    font-size: 12px;
                    color: #627178;
                }
                .note,
                .warn {
                    grid-column: 1 / -1;
                    font-size: 13px;
                }
                .warn {
                    color: #9f1f14;
                }
                .cta {
                    display: inline-flex;
                    align-items: center;
                    min-height: 40px;
                    margin-top: 12px;
                    border: 1px solid #152022;
                    border-radius: 8px;
                    padding: 0 16px;
                    color: #152022;
                    font-weight: 800;
                    text-decoration: none;
                }
                @media (max-width: 640px) {
                    .head {
                        flex-direction: column;
                    }
                    .row,
                    .calc {
                        grid-template-columns: minmax(0, 1fr);
                    }
                }
            `}</style>
        </>
    );
}
