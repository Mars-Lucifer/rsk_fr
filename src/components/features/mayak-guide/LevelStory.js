"use client";

import { useEffect, useState } from "react";

import { PHASES } from "./ssd.mjs";
import { FRAMES, MAX_LEVEL, ORG_KINDS, holdOf } from "./levelStory.mjs";

// Плеер истории уровня. Все кадры смонтированы разом и переключаются прозрачностью:
// так браузер грузит их заранее, и на переходе не мигает белым. Кроссфейд, а не смена
// src — именно наложение двух кадров и создаёт ощущение, что меняется одна комната.

// Шестиконечная звезда — шкала, а не разбор по лучам. Наливается по мере уровня: контур
// всегда полный, заливка — доля level / 6. Лучи по отдельности ничего не значат,
// поэтому подсвечивать их поштучно нельзя, это читалось бы как «закрыто N направлений».
function starPath(radius, inner) {
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
    return (
        <div className="star">
            <svg viewBox="-30 -30 60 60" width="52" height="52" aria-hidden="true">
                <polygon points={starPath(27, 12)} fill="none" stroke="rgba(244,239,230,0.35)" strokeWidth="1.2" />
                <polygon points={starPath(27 * fill, 12 * fill)} fill="#d9a441" />
            </svg>
            <em>
                уровень {level} из {MAX_LEVEL}
            </em>
            <style jsx>{`
                .star {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .star em {
                    font-style: normal;
                    font-size: 13px;
                    color: rgba(244, 239, 230, 0.55);
                }
                .star svg {
                    transition: transform 600ms ease;
                }
            `}</style>
        </div>
    );
}

export default function LevelStory() {
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [kind, setKind] = useState(0);

    const frame = FRAMES[index];

    useEffect(() => {
        if (!playing) return undefined;
        const timer = setTimeout(() => setIndex((current) => (current + 1) % FRAMES.length), holdOf(frame));
        return () => clearTimeout(timer);
    }, [playing, index, frame]);

    return (
        <div className="story">
            <div className="stage">
                {FRAMES.map((item, position) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={item.src} src={item.src} alt="" className={position === index ? "on" : ""} />
                ))}
            </div>

            <div className="hud">
                {/* Отдельной подписи рядом с кнопками нет: активная кнопка и есть подпись.
                    Когда стояло и то и другое, строка читалась как «Департамент, Колледж,
                    Завод, Больница, Департамент». */}
                <div className="org">
                    {ORG_KINDS.map((name, position) => (
                        <button key={name} type="button" className={position === kind ? "on" : ""} onClick={() => setKind(position)}>
                            {name}
                        </button>
                    ))}
                </div>
                <StarScale level={frame.level} />
            </div>

            <div className="bar">
                <div className="phases">
                    {PHASES.map((phase) => (
                        <span key={phase.id} className={phase.id === frame.phase ? "on" : ""}>
                            {phase.name}
                        </span>
                    ))}
                </div>
                <p>{frame.caption}</p>
                <div className="controls">
                    <button type="button" onClick={() => setPlaying((current) => !current)}>
                        {playing ? "Пауза" : "Играть"}
                    </button>
                    <button type="button" onClick={() => setIndex((current) => (current + 1) % FRAMES.length)}>
                        Дальше
                    </button>
                    <button type="button" onClick={() => setIndex(0)}>
                        Сначала
                    </button>
                </div>
            </div>

            <style jsx>{`
                .story {
                    position: relative;
                    height: 100vh;
                    background: #0b0b0b;
                    color: #f4efe6;
                    overflow: hidden;
                }
                .stage {
                    position: absolute;
                    inset: 0;
                }
                .stage :global(img) {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    opacity: 0;
                    transition: opacity 900ms ease;
                }
                .stage :global(img.on) {
                    opacity: 1;
                }
                .hud {
                    position: absolute;
                    top: 22px;
                    left: 26px;
                    right: 26px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    pointer-events: none;
                }
                .org {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    pointer-events: auto;
                }
                .org button {
                    padding: 5px 14px;
                    border: 1px solid rgba(244, 239, 230, 0.22);
                    border-radius: 999px;
                    background: rgba(11, 11, 11, 0.55);
                    color: rgba(244, 239, 230, 0.62);
                    font: inherit;
                    font-size: 13px;
                    cursor: pointer;
                }
                .org button.on {
                    border-color: rgba(244, 239, 230, 0.7);
                    color: #f4efe6;
                }
                .bar {
                    position: absolute;
                    left: 50%;
                    bottom: 28px;
                    transform: translateX(-50%);
                    width: min(820px, calc(100% - 52px));
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
                    margin: 0 0 14px;
                    font-size: 17px;
                    line-height: 1.5;
                    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
                }
                .controls {
                    display: flex;
                    justify-content: center;
                    gap: 8px;
                }
                .controls button {
                    padding: 6px 16px;
                    border: 1px solid rgba(244, 239, 230, 0.22);
                    border-radius: 999px;
                    background: rgba(11, 11, 11, 0.55);
                    color: rgba(244, 239, 230, 0.8);
                    font: inherit;
                    font-size: 13px;
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
}
