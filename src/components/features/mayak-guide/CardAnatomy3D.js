"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Карта задания как физический предмет: её можно крутить мышью и перевернуть.
// Обе стороны лежат в одной плоскости, поэтому переворот — поворот по Y, а не подмена картинки.
// Номера-подсказки живут на своей стороне и поворачиваются вместе с ней.

const FACE_IMG = "/mayak-guide/cards-ya/text-face-sample.png";
// рубашка того же раздела «Текст», где есть и метка этапа, и номер
const BACK_IMG = "/mayak-guide/cards/text.png?v=2";

// За сколько градусов перетаскивания карта проходит половину оборота.
const DRAG_SPEED = 0.55;
const MAX_TILT = 24;

export default function CardAnatomy3D({ side, onSide, pins, hint = null }) {
    const [spin, setSpin] = useState(0);
    const [tilt, setTilt] = useState(0);
    const [dragging, setDragging] = useState(false);
    const boxRef = useRef(null);
    const dragRef = useRef(null);

    // Источник правды — угол поворота. Наружу сторона сообщается только по факту
    // завершённого действия (отпустили карту, перевернули), а не из эффекта:
    // двусторонняя синхронизация side ↔ spin зацикливала рендер.
    const facing = (spin) => (((spin % 360) + 360) % 360 >= 90 && ((spin % 360) + 360) % 360 < 270 ? "face" : "back");

    // Переключатель «Рубашка / Лицо» снаружи доворачивает карту до нужной стороны.
    const prevSide = useRef(side);
    useEffect(() => {
        if (prevSide.current === side) return;
        prevSide.current = side;
        setSpin((current) => {
            if (facing(current) === side) return current;
            return Math.round(current / 180) * 180 + 180;
        });
    }, [side]);

    const report = useCallback(
        (value) => {
            const next = facing(value);
            if (next !== prevSide.current) {
                prevSide.current = next;
                onSide(next);
            }
        },
        [onSide]
    );

    const onPointerDown = useCallback(
        (event) => {
            dragRef.current = { x: event.clientX, y: event.clientY, spin, tilt };
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        [spin, tilt]
    );

    const onPointerMove = useCallback((event) => {
        const from = dragRef.current;
        if (!from) return;
        setSpin(from.spin + (event.clientX - from.x) * DRAG_SPEED);
        setTilt(Math.max(-MAX_TILT, Math.min(MAX_TILT, from.tilt - (event.clientY - from.y) * DRAG_SPEED)));
    }, []);

    const stopDrag = useCallback(() => {
        if (!dragRef.current) return;
        dragRef.current = null;
        setDragging(false);
        // отпустили — карта доворачивается до ровной стороны и выравнивает наклон
        setSpin((current) => {
            const settled = Math.round(current / 180) * 180;
            report(settled);
            return settled;
        });
        setTilt(0);
    }, [report]);

    const flip = useCallback(() => {
        setSpin((current) => {
            const next = Math.round(current / 180) * 180 + 180;
            report(next);
            return next;
        });
    }, [report]);

    return (
        <div className="wrap">
            <div
                ref={boxRef}
                className={`scene ${dragging ? "grabbing" : ""}`}
                onPointerDown={onPointerDown}
                onPointerMove={dragging ? onPointerMove : undefined}
                onPointerUp={stopDrag}
                onPointerCancel={stopDrag}
                onDoubleClick={flip}
                role="button"
                tabIndex={0}
                aria-label="Карта задания: потяните, чтобы повернуть, двойной клик — перевернуть"
                onKeyDown={(event) => {
                    if (event.key === "ArrowLeft") setSpin((c) => c - 30);
                    if (event.key === "ArrowRight") setSpin((c) => c + 30);
                    if (event.key === "Enter" || event.key === " ") flip();
                }}>
                <div className="card" style={{ transform: `rotateX(${tilt}deg) rotateY(${spin}deg)`, transition: dragging ? "none" : "transform 0.55s cubic-bezier(0.16, 1, 0.3, 1)" }}>
                    <div className={`face back ${facing(spin) === "back" ? "" : "away"}`}>
                        <img src={BACK_IMG} alt="Рубашка карты задания" draggable="false" />
                        {pins.back.map((pin, index) => (
                            <span
                                key={pin.t}
                                className={`pin ${pin.x > 40 && pin.x < 60 ? "toup" : pin.x < 50 ? "toleft" : "toright"} ${hint === index ? "on" : ""}`}
                                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
                                <b>{index + 1}</b>
                            </span>
                        ))}
                    </div>
                    <div className={`face front ${facing(spin) === "face" ? "" : "away"}`}>
                        <img src={FACE_IMG} alt="Лицо карты задания" draggable="false" />
                        {pins.face.map((pin, index) => (
                            <span
                                key={pin.t}
                                className={`pin ${pin.x > 40 && pin.x < 60 ? "toup" : pin.x < 50 ? "toleft" : "toright"} ${hint === index ? "on" : ""}`}
                                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
                                <b>{index + 1}</b>
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <button type="button" className="flipbtn" onClick={flip}>
                <span className="ico" aria-hidden="true">
                    ⟳
                </span>
                Перевернуть карту
            </button>
            <p className="tip">Карту можно и просто крутить мышью.</p>

            <style jsx>{`
                .wrap {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .scene {
                    perspective: 1400px;
                    padding: 10px 0 18px;
                    cursor: grab;
                    touch-action: none;
                    user-select: none;
                    outline: none;
                }
                .scene.grabbing {
                    cursor: grabbing;
                }
                .scene:focus-visible .card {
                    outline: 2px solid #c9503f;
                    outline-offset: 6px;
                }
                .card {
                    position: relative;
                    width: 100%;
                    aspect-ratio: 481 / 667;
                    transform-style: preserve-3d;
                    will-change: transform;
                }
                .face {
                    position: absolute;
                    inset: 0;
                    border-radius: 14px;
                    overflow: hidden;
                    background: #fff;
                    /* тонкая рамка: край карты читается на белом фоне страницы */
                    border: 1px solid rgba(21, 32, 34, 0.16);
                    /* слоистая нейтральная тень: карта лежит в пространстве, а не наклеена */
                    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06), 0 1px 1px -0.5px rgba(0, 0, 0, 0.06), 0 3px 3px -1.5px rgba(0, 0, 0, 0.06),
                        0 6px 6px -3px rgba(0, 0, 0, 0.06), 0 12px 12px -6px rgba(0, 0, 0, 0.06), 0 24px 24px -12px rgba(0, 0, 0, 0.08);
                }
                .front {
                    transform: rotateY(180deg);
                }
                /* backface-visibility в Chrome местами игнорируется и обратная сторона
                   просвечивает зеркально — прячем ту грань, что смотрит от зрителя */
                .face.away {
                    opacity: 0;
                }
                .face :global(img) {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }
                /* точка стоит ровно на элементе, номер вынесен вбок — ничего не перекрывается */
                .pin {
                    position: absolute;
                    width: 9px;
                    height: 9px;
                    margin: -4.5px 0 0 -4.5px;
                    border-radius: 50%;
                    background: #c9503f;
                    box-shadow: 0 0 0 2px #fff, 0 1px 4px rgba(0, 0, 0, 0.3);
                }
                .pin b {
                    position: absolute;
                    top: 50%;
                    width: 20px;
                    height: 20px;
                    margin-top: -10px;
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    font-size: 11px;
                    font-weight: 700;
                    color: #fff;
                    background: #c9503f;
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
                    transition: transform 0.16s ease, background 0.16s ease;
                }
                .pin.toleft b {
                    right: 16px;
                }
                .pin.toright b {
                    left: 16px;
                }
                /* у центральных элементов номер уходит вверх, иначе он ложится на текст */
                .pin.toup b {
                    top: auto;
                    bottom: 14px;
                    left: 50%;
                    margin: 0 0 0 -10px;
                }
                .pin.on {
                    background: #152022;
                }
                .pin.on b {
                    background: #152022;
                    transform: scale(1.25);
                }
                .flipbtn {
                    font: inherit;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 9px;
                    width: 100%;
                    padding: 11px 16px;
                    font-size: 14px;
                    font-weight: 700;
                    border-radius: 999px;
                    border: 1px solid #152022;
                    background: #152022;
                    color: #fff;
                    cursor: pointer;
                    transition: background 0.18s ease;
                }
                .flipbtn:hover {
                    background: #24343a;
                }
                .flipbtn .ico {
                    font-size: 15px;
                }
                .tip {
                    margin: 0;
                    font-size: 12.5px;
                    line-height: 1.4;
                    color: var(--muted, #7c8a94);
                }
                @media (prefers-reduced-motion: reduce) {
                    .card {
                        transition: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
