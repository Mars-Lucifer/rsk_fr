import dynamic from "next/dynamic";
import Head from "next/head";
import { useEffect, useState } from "react";

// Стенд для сравнения 3D-комнаты с эталонным кадром. Отдельной страницей, а не вместо
// /zvezda-3d: рабочий вариант на кадрах должен остаться нетронутым, пока не станет ясно,
// что 3D его обгоняет.
//
// Ползунок сверху накладывает эталон поверх рендера. Сравнивать две картинки, переключая
// вкладки, бесполезно — глаз не удерживает разницу; наложение показывает промах сразу.
const RoomScene = dynamic(() => import("@/components/features/mayak-guide/RoomScene"), {
    ssr: false,
    loading: () => null,
});

const REFERENCE = { 1: "/zvezda/l1-rest.png", 2: "/zvezda/l2-rest.png" };

export default function ZvezdaRoom() {
    const [level, setLevel] = useState(1);
    const [overlay, setOverlay] = useState(0);

    // Уровень и наложение можно задать прямо в адресе: ?level=2&overlay=0.5. Нужно для
    // проверки кадром — снимок делается фоновым браузером, кликать в нём некому.
    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        const wanted = Number(query.get("level"));
        if (wanted === 1 || wanted === 2) setLevel(wanted);
        const mix = Number(query.get("overlay"));
        if (mix >= 0 && mix <= 1) setOverlay(mix);
    }, []);

    return (
        <>
            <Head>
                <title>ЗВЕЗДА · комната в 3D против эталона</title>
            </Head>
            <main>
                <div className="scene">
                    <RoomScene level={level} />
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={REFERENCE[level]} alt="" style={{ opacity: overlay }} />

                <div className="panel">
                    <div className="group">
                        <button type="button" className={level === 1 ? "on" : ""} onClick={() => setLevel(1)}>
                            Уровень 1
                        </button>
                        <button type="button" className={level === 2 ? "on" : ""} onClick={() => setLevel(2)}>
                            Уровень 2
                        </button>
                    </div>
                    <label>
                        эталон
                        <input type="range" min="0" max="1" step="0.01" value={overlay} onChange={(event) => setOverlay(Number(event.target.value))} />
                    </label>
                </div>
            </main>

            <style jsx>{`
                main {
                    position: relative;
                    display: block;
                    height: 100vh;
                    background: #0b0b0b;
                    color: #f4efe6;
                    border: 0;
                    box-shadow: none;
                    overflow: hidden;
                }
                .scene {
                    position: absolute;
                    inset: 0;
                }
                main img {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    pointer-events: none;
                }
                .panel {
                    position: absolute;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    align-items: center;
                    gap: 18px;
                    padding: 8px 14px;
                    border: 1px solid rgba(244, 239, 230, 0.16);
                    border-radius: 999px;
                    background: rgba(11, 11, 11, 0.72);
                }
                .group {
                    display: flex;
                    gap: 6px;
                }
                .panel button {
                    padding: 5px 14px;
                    border: 1px solid rgba(244, 239, 230, 0.22);
                    border-radius: 999px;
                    background: transparent;
                    color: rgba(244, 239, 230, 0.62);
                    font: inherit;
                    font-size: 13px;
                    cursor: pointer;
                }
                .panel button.on {
                    border-color: rgba(244, 239, 230, 0.7);
                    color: #f4efe6;
                }
                .panel label {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 13px;
                    color: rgba(244, 239, 230, 0.55);
                }
                .panel input {
                    width: 160px;
                }
            `}</style>
        </>
    );
}
