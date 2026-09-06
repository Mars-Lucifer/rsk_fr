"use client";

import { LEVELS, MAX_LEVEL, RAYS } from "./model/zvezda.mjs";
import { PHASES } from "./model/story.mjs";

// Слой поверх канваса — обычный DOM, а не <Html> из drei. Причина не в удобстве: по
// свидетельству соседнего направления Html тянет вторую копию react-dom и ломает монтирование
// сцены. Плюс DOM даёт клавиатуру и текст для скринридера, чего у канваса нет вовсе, и
// переживает выключенный WebGL: если сцена не поднялась, объяснялка всё равно читается.

// Шестиконечная звезда — шкала, а не разбор по лучам. Наливается по мере уровня: контур всегда
// полный, заливка — доля level / 6. Лучи по отдельности здесь ничего не значат, подсвечивать их
// в шкале нельзя: это читалось бы как «закрыто N направлений из шести».
function starPoints(radius, inner) {
    const points = [];
    for (let step = 0; step < 12; step += 1) {
        const r = step % 2 === 0 ? radius : inner;
        const angle = (Math.PI / 6) * step - Math.PI / 2;
        points.push(`${(Math.cos(angle) * r).toFixed(2)},${(Math.sin(angle) * r).toFixed(2)}`);
    }
    return points.join(" ");
}

function StarScale({ level }) {
    const fill = Math.max(0.001, level / MAX_LEVEL);
    const current = LEVELS.find((item) => item.n === level);
    return (
        <div className="star">
            <svg viewBox="-30 -30 60 60" width="46" height="46" aria-hidden="true">
                <polygon points={starPoints(27, 12)} fill="none" stroke="rgba(244,239,230,0.35)" strokeWidth="1.2" />
                <polygon points={starPoints(27 * fill, 12 * fill)} fill="#d9a441" />
            </svg>
            <em>
                {current ? `${current.name} · ИЦЗ ${current.icz > 0 ? "+" : ""}${current.icz}` : ""}
                <span>уровень {level} из {MAX_LEVEL}</span>
            </em>
            <style jsx>{`
                .star {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    pointer-events: auto;
                }
                .star em {
                    display: flex;
                    flex-direction: column;
                    font-style: normal;
                    font-size: 13px;
                    line-height: 1.35;
                    color: #f4efe6;
                }
                .star em span {
                    font-size: 11px;
                    color: rgba(244, 239, 230, 0.5);
                }
            `}</style>
        </div>
    );
}

export default function Hud({ step, orgKinds, orgIndex, onOrg, ray, onRay, playing, onPlay, onNext, onRestart, onLevel }) {
    const level = LEVELS.find((item) => item.n === step.level);

    return (
        <div className="hud">
            <div className="top">
                {/* Отдельной подписи рядом с кнопками нет: активная кнопка и есть подпись.
                    Когда стояло и то и другое, строка читалась как перечисление. */}
                <div className="org">
                    {orgKinds.map((name, index) => (
                        <button key={name} type="button" className={index === orgIndex ? "on" : ""} onClick={() => onOrg(index)}>
                            {name}
                        </button>
                    ))}
                </div>
                <StarScale level={step.phase === "mind" ? step.level + 1 : step.level} />
            </div>

            <div className="rays">
                {RAYS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={ray === item.id ? "on" : ""}
                        title={item.about}
                        onClick={() => onRay(ray === item.id ? null : item.id)}>
                        {item.name}
                    </button>
                ))}
            </div>

            <div className="bar">
                <div className="phases">
                    {PHASES.map((phase) => (
                        <span key={phase.id} className={phase.id === step.phase ? "on" : ""}>
                            {phase.name}
                        </span>
                    ))}
                </div>
                <p>{step.caption}</p>
                {level ? (
                    <small>
                        проект уровня — «{level.project}»
                        {level.visionary ? " · визионерский: направления исследований, а не типовые проекты" : ""}
                    </small>
                ) : null}
                <div className="scale">
                    {LEVELS.map((item) => (
                        <button
                            key={item.n}
                            type="button"
                            className={item.n === step.level ? "on" : ""}
                            title={`${item.name}: ${item.about}`}
                            onClick={() => onLevel(item.n)}>
                            {item.n}
                        </button>
                    ))}
                </div>
                <div className="controls">
                    <button type="button" onClick={onPlay}>
                        {playing ? "Пауза" : "Играть"}
                    </button>
                    <button type="button" onClick={onNext}>
                        Дальше
                    </button>
                    <button type="button" onClick={onRestart}>
                        Сначала
                    </button>
                </div>
            </div>

            <style jsx>{`
                .hud {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    color: #f4efe6;
                    font-size: 13px;
                }
                .top {
                    position: absolute;
                    top: 22px;
                    left: 26px;
                    right: 26px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                }
                .org,
                .rays,
                .scale,
                .controls {
                    display: flex;
                    gap: 6px;
                    pointer-events: auto;
                }
                .rays {
                    position: absolute;
                    top: 78px;
                    left: 26px;
                    flex-direction: column;
                    align-items: flex-start;
                }
                button {
                    padding: 5px 14px;
                    border: 1px solid rgba(244, 239, 230, 0.22);
                    border-radius: 999px;
                    background: rgba(11, 11, 11, 0.55);
                    color: rgba(244, 239, 230, 0.62);
                    font: inherit;
                    font-size: 13px;
                    cursor: pointer;
                    transition: color 200ms ease, border-color 200ms ease;
                }
                button:hover {
                    color: #f4efe6;
                }
                button.on {
                    border-color: #d9a441;
                    color: #f4efe6;
                }
                .rays button {
                    font-size: 12px;
                    padding: 4px 12px;
                }
                .bar {
                    position: absolute;
                    left: 50%;
                    bottom: 26px;
                    transform: translateX(-50%);
                    width: min(860px, calc(100% - 52px));
                    text-align: center;
                }
                .phases {
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    margin-bottom: 12px;
                }
                .phases span {
                    padding: 4px 14px;
                    border-radius: 999px;
                    font-size: 13px;
                    color: rgba(244, 239, 230, 0.42);
                    background: rgba(244, 239, 230, 0.07);
                    transition: color 400ms ease, background 400ms ease;
                }
                .phases span.on {
                    color: #15110e;
                    background: #d9a441;
                }
                .bar p {
                    margin: 0 0 6px;
                    font-size: 17px;
                    line-height: 1.5;
                    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.85);
                }
                .bar small {
                    display: block;
                    margin-bottom: 12px;
                    font-size: 12px;
                    color: rgba(244, 239, 230, 0.45);
                }
                .scale {
                    justify-content: center;
                    margin-bottom: 10px;
                }
                .scale button {
                    width: 30px;
                    padding: 4px 0;
                    text-align: center;
                }
                .controls {
                    justify-content: center;
                }
                @media (max-width: 760px) {
                    .rays {
                        display: none;
                    }
                    /* На узком экране строка не помещается, и шкала уезжает за правый край —
                       проверено кадром 390 × 844. Ставим её над кнопками, а не рядом. */
                    .top {
                        flex-direction: column-reverse;
                        align-items: flex-start;
                        gap: 10px;
                    }
                    .org {
                        flex-wrap: wrap;
                    }
                    .bar p {
                        font-size: 15px;
                    }
                }
            `}</style>
        </div>
    );
}
