import Head from "next/head";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { LEVELS, RAYS } from "@/components/features/mayak-zvezda/model/zvezda.mjs";
import { RAY_COLOR } from "@/components/features/mayak-zvezda/proba/sketchGeometry.mjs";

// Купол на весь экран, интерфейс поверх. В референсах canvas никогда не лежит в рамке внутри
// вёрстки — это половина ощущения «опыт, а не страница», и стоит она ноль.
const Dome = dynamic(() => import("@/components/features/mayak-zvezda/star/Dome"), { ssr: false });

export default function ZvezdaDome() {
    const router = useRouter();
    const [level, setLevel] = useState(3);
    const [ray, setRay] = useState(null);
    const [spin, setSpin] = useState(true);

    // Состояние в адресе: кадром проверяется без кликов.
    useEffect(() => {
        if (!router.isReady) return;
        const l = Number(router.query.level);
        if (l >= 1 && l <= 6) setLevel(l);
        if (RAYS.some((x) => x.id === router.query.ray)) setRay(router.query.ray);
        if (router.query.spin === "0") setSpin(false);
    }, [router.isReady, router.query.level, router.query.ray, router.query.spin]);

    const lv = LEVELS[level - 1];

    return (
        <>
            <Head>
                <title>ЗВЕЗДА · купол</title>
            </Head>
            <div className="stage">
                <Dome level={level} ray={ray} spin={spin} />

                <div className="hud">
                    <div className="tl">
                        <p className="mono">// ЗВЕЗДА</p>
                        <h1>
                            {lv.icz > 0 ? `+${lv.icz}` : lv.icz} · {lv.name}
                        </h1>
                        <p className="about">{lv.about}</p>
                    </div>

                    <div className="tr mono">
                        {RAYS.map((r) => (
                            <button key={r.id} onClick={() => setRay(ray === r.id ? null : r.id)} className={ray === r.id ? "on" : ""} style={{ "--c": RAY_COLOR[r.id] }}>
                                <i />
                                {r.name}
                            </button>
                        ))}
                    </div>

                    <div className="bl">
                        {LEVELS.map((l) => (
                            <button key={l.n} onClick={() => setLevel(l.n)} className={l.n === level ? "on" : ""}>
                                {l.icz > 0 ? `+${l.icz}` : l.icz}
                            </button>
                        ))}
                    </div>

                    <p className="br mono">
                        блок — артефакт · сектор — луч · ярус — уровень
                        <br />
                        достроено {level} из {LEVELS.length}
                    </p>
                </div>
            </div>

            <style jsx>{`
                .stage {
                    position: fixed;
                    inset: 0;
                    background: #05070d;
                }
                .stage :global(canvas) {
                    display: block;
                }
                .hud {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    color: #e8eefc;
                    font-family: inherit;
                }
                .hud > * {
                    position: absolute;
                    pointer-events: auto;
                }
                .mono {
                    font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
                    font-size: 11px;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                }
                .tl {
                    top: 30px;
                    left: 34px;
                    max-width: 380px;
                }
                .tl .mono {
                    margin: 0 0 10px;
                    color: rgba(232, 238, 252, 0.4);
                }
                h1 {
                    margin: 0 0 8px;
                    font-size: 27px;
                    font-weight: 400;
                    letter-spacing: -0.01em;
                }
                .about {
                    margin: 0;
                    font-size: 13.5px;
                    line-height: 1.5;
                    color: rgba(232, 238, 252, 0.5);
                }
                .tr {
                    top: 30px;
                    right: 34px;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 7px;
                }
                .tr button {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    padding: 0;
                    border: 0;
                    background: none;
                    font: inherit;
                    font-family: ui-monospace, Menlo, Consolas, monospace;
                    font-size: 11px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: rgba(232, 238, 252, 0.42);
                    cursor: pointer;
                }
                .tr button:hover,
                .tr button.on {
                    color: #e8eefc;
                }
                .tr i {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: var(--c);
                    opacity: 0.5;
                }
                .tr button.on i {
                    opacity: 1;
                    box-shadow: 0 0 10px var(--c);
                }
                .bl {
                    bottom: 30px;
                    left: 34px;
                    display: flex;
                    gap: 6px;
                }
                .bl button {
                    width: 40px;
                    height: 30px;
                    border: 1px solid rgba(232, 238, 252, 0.14);
                    background: rgba(8, 12, 20, 0.6);
                    color: rgba(232, 238, 252, 0.45);
                    font: inherit;
                    font-family: ui-monospace, Menlo, Consolas, monospace;
                    font-size: 12px;
                    cursor: pointer;
                }
                .bl button.on {
                    border-color: #8fb0ff;
                    color: #e8eefc;
                    background: rgba(107, 144, 255, 0.12);
                }
                .br {
                    bottom: 30px;
                    right: 34px;
                    margin: 0;
                    text-align: right;
                    line-height: 1.7;
                    color: rgba(232, 238, 252, 0.3);
                }
            `}</style>
        </>
    );
}
