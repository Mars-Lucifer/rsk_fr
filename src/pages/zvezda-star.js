import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import StarMap from "@/components/features/mayak-zvezda/star/StarMap";
import { CELLS, transitionTo } from "@/components/features/mayak-zvezda/model/artifacts.mjs";
import { LEVELS, RAYS } from "@/components/features/mayak-zvezda/model/zvezda.mjs";
import { RAY_COLOR } from "@/components/features/mayak-zvezda/proba/sketchGeometry.mjs";

// Звезда с шестью уровнями: центр — обзор организации, лучи — точки входа.
//
// Содержимое клетки «луч × уровень» берётся из единой таблицы артефактов 8.0 дословно.
// Тридцать шесть клеток здесь не комбинаторика, придуманная под интерфейс: именно так
// устроен первоисточник — шесть таблиц по шесть строк, в каждой артефакты и индикаторы.
//
// Кадр комнаты показывается там, где он сгенерирован. Для уровней выше второго кадра нет,
// и вместо него стоит явная заглушка: пустое место честнее подставленной чужой картинки,
// и по нему видно, сколько работы осталось.

const FRAME = { 1: "/zvezda/l1-rest.png", 2: "/zvezda/l2-rest.png" };

export default function ZvezdaStar() {
    const router = useRouter();
    const [level, setLevel] = useState(1);
    const [ray, setRay] = useState(null);

    // Состояние задаётся адресом: кликать в фоновом браузере некому, а проверять надо кадром.
    useEffect(() => {
        if (!router.isReady) return;
        const l = Number(router.query.level);
        if (l >= 1 && l <= 6) setLevel(l);
        const r = router.query.ray;
        if (RAYS.some((x) => x.id === r)) setRay(r);
    }, [router.isReady, router.query.level, router.query.ray]);

    const lv = LEVELS[level - 1];
    const step = transitionTo(level);
    const cell = ray ? CELLS[ray][level] : null;
    const rayInfo = ray ? RAYS.find((r) => r.id === ray) : null;

    return (
        <>
            <Head>
                <title>ЗВЕЗДА · шесть направлений, шесть уровней</title>
            </Head>
            <main>
                <div className="grid">
                    <section className="star">
                        <StarMap level={level} ray={ray} onPickRay={setRay} onPickCenter={() => setRay(null)} />
                        <div className="levels" role="group" aria-label="Уровень зрелости">
                            {LEVELS.map((l) => (
                                <button key={l.n} className={l.n === level ? "on" : ""} onClick={() => setLevel(l.n)} aria-pressed={l.n === level}>
                                    <b>{l.icz > 0 ? `+${l.icz}` : l.icz}</b>
                                    <span>{l.name}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="panel">
                        {!ray && (
                            <>
                                <p className="kicker">Организация целиком</p>
                                <h1>
                                    {lv.icz > 0 ? `+${lv.icz}` : lv.icz} · {lv.name}
                                </h1>
                                <p className="about">{lv.about}</p>
                                <p className="project">
                                    Проект уровня по редакции 6.0 — «{lv.project}»
                                    {lv.visionary && <em>. Уровень визионерский: его задачи — направления исследований, а не типовые проекты</em>}
                                </p>

                                {step ? (
                                    <div className="crit">
                                        <p className="kicker">Чтобы попасть сюда с предыдущего уровня</p>
                                        <p>
                                            <b>Артефакты.</b> {step.static}
                                        </p>
                                        <p>
                                            <b>Показатели.</b> {step.dynamic}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="crit">
                                        <p>Нижняя ступень шкалы: сюда не переходят, отсюда начинают.</p>
                                    </div>
                                )}

                                <p className="kicker pick">Выберите направление</p>
                                <div className="cards">
                                    {RAYS.map((r) => (
                                        <button key={r.id} className="card" onClick={() => setRay(r.id)} style={{ "--c": RAY_COLOR[r.id] }}>
                                            <span className="letter">{r.letter}</span>
                                            <span className="body">
                                                <b>{r.name}</b>
                                                <i>{CELLS[r.id][level].lead}</i>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {ray && (
                            <>
                                <button className="back" onClick={() => setRay(null)}>
                                    ← к обзору организации
                                </button>
                                <p className="kicker" style={{ color: RAY_COLOR[ray] }}>
                                    {rayInfo.name} · уровень {lv.icz > 0 ? `+${lv.icz}` : lv.icz} {lv.name}
                                </p>
                                <h1>{cell.lead}</h1>
                                <p className="about">{rayInfo.about}</p>

                                <div className="image">
                                    {FRAME[level] ? (
                                        <img src={FRAME[level]} alt={`Комната на уровне ${lv.icz}`} />
                                    ) : (
                                        <p className="empty">Кадр для уровня {lv.icz > 0 ? `+${lv.icz}` : lv.icz} ещё не сгенерирован</p>
                                    )}
                                </div>

                                <h2>Что должно быть</h2>
                                <ul className={level === 1 ? "no" : "yes"}>
                                    {cell.artifacts.map((a) => (
                                        <li key={a}>{a}</li>
                                    ))}
                                </ul>

                                <h2>Что измеряем</h2>
                                <ul className="num">
                                    {cell.indicators.map((i) => (
                                        <li key={i}>{i}</li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </section>
                </div>
            </main>

            <style jsx>{`
                main {
                    min-height: 100vh;
                    background: #0b1020;
                    color: #f4efe6;
                    padding: 28px 30px 60px;
                    border: 0;
                    box-shadow: none;
                }
                .grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(0, 460px);
                    gap: 30px;
                    max-width: 1500px;
                    margin: 0 auto;
                    align-items: start;
                }
                .star :global(svg) {
                    display: block;
                    width: 100%;
                    height: auto;
                }
                .levels {
                    display: grid;
                    grid-template-columns: repeat(6, minmax(0, 1fr));
                    gap: 7px;
                    margin-top: 6px;
                }
                .levels button {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    align-items: flex-start;
                    padding: 9px 10px;
                    border: 1px solid rgba(244, 239, 230, 0.13);
                    border-radius: 8px;
                    background: #121a2e;
                    color: rgba(244, 239, 230, 0.5);
                    cursor: pointer;
                    text-align: left;
                    font: inherit;
                }
                .levels button.on {
                    border-color: #8fb0ff;
                    background: #1b2740;
                    color: #f4efe6;
                }
                .levels b {
                    font-size: 17px;
                }
                .levels span {
                    font-size: 11.5px;
                    line-height: 1.25;
                }
                .panel {
                    background: #101728;
                    border: 1px solid rgba(244, 239, 230, 0.1);
                    border-radius: 12px;
                    padding: 22px 24px 28px;
                }
                .kicker {
                    margin: 0 0 8px;
                    font-size: 12px;
                    letter-spacing: 0.09em;
                    text-transform: uppercase;
                    color: rgba(244, 239, 230, 0.42);
                }
                h1 {
                    margin: 0 0 10px;
                    font-size: 24px;
                    font-weight: 500;
                    line-height: 1.28;
                }
                .about {
                    margin: 0 0 14px;
                    font-size: 14.5px;
                    line-height: 1.5;
                    color: rgba(244, 239, 230, 0.6);
                }
                .project {
                    margin: 0 0 18px;
                    font-size: 13.5px;
                    line-height: 1.5;
                    color: rgba(244, 239, 230, 0.45);
                }
                .project em {
                    font-style: normal;
                }
                .crit {
                    padding: 14px 16px;
                    border-left: 2px solid #8fb0ff;
                    background: rgba(107, 144, 255, 0.06);
                    border-radius: 0 8px 8px 0;
                    margin-bottom: 22px;
                }
                .crit p {
                    margin: 0 0 8px;
                    font-size: 13.5px;
                    line-height: 1.5;
                    color: rgba(244, 239, 230, 0.72);
                }
                .crit p:last-child {
                    margin-bottom: 0;
                }
                .pick {
                    margin-bottom: 10px;
                }
                .cards {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .card {
                    display: flex;
                    gap: 12px;
                    align-items: flex-start;
                    padding: 11px 13px;
                    border: 1px solid rgba(244, 239, 230, 0.1);
                    border-left: 3px solid var(--c);
                    border-radius: 8px;
                    background: #121a2e;
                    cursor: pointer;
                    text-align: left;
                    font: inherit;
                    color: inherit;
                }
                .card:hover {
                    background: #17203a;
                }
                .letter {
                    flex: 0 0 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: var(--c);
                    color: #0b1020;
                    font-size: 14px;
                    font-weight: 700;
                    display: grid;
                    place-items: center;
                }
                .body {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                .body b {
                    font-size: 14px;
                    font-weight: 500;
                }
                .body i {
                    font-style: normal;
                    font-size: 12.5px;
                    line-height: 1.45;
                    color: rgba(244, 239, 230, 0.55);
                }
                .back {
                    display: block;
                    text-align: left;
                    margin: 0 0 14px;
                    padding: 0;
                    border: 0;
                    background: none;
                    color: rgba(244, 239, 230, 0.5);
                    font: inherit;
                    font-size: 13px;
                    cursor: pointer;
                }
                .back:hover {
                    color: #f4efe6;
                }
                .image {
                    margin: 0 0 22px;
                    border-radius: 10px;
                    overflow: hidden;
                    background: #07090f;
                    aspect-ratio: 16 / 9;
                    display: grid;
                    place-items: center;
                }
                .image img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }
                .empty {
                    margin: 0;
                    padding: 0 20px;
                    text-align: center;
                    font-size: 13px;
                    color: rgba(244, 239, 230, 0.32);
                }
                h2 {
                    margin: 0 0 9px;
                    font-size: 12px;
                    letter-spacing: 0.09em;
                    text-transform: uppercase;
                    color: rgba(244, 239, 230, 0.42);
                    font-weight: 500;
                }
                ul {
                    margin: 0 0 22px;
                    padding: 0;
                    list-style: none;
                }
                li {
                    position: relative;
                    padding-left: 24px;
                    margin-bottom: 9px;
                    font-size: 13.5px;
                    line-height: 1.5;
                    color: rgba(244, 239, 230, 0.78);
                }
                li::before {
                    position: absolute;
                    left: 0;
                    top: 0;
                }
                .yes li::before {
                    content: "✓";
                    color: #b9f24b;
                }
                .no li::before {
                    content: "✕";
                    color: #ff7a5c;
                }
                .num li::before {
                    content: "◆";
                    color: #6b90ff;
                    font-size: 10px;
                    top: 3px;
                }
                @media (max-width: 1080px) {
                    .grid {
                        grid-template-columns: 1fr;
                    }
                    .levels {
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                    }
                }
            `}</style>
        </>
    );
}
