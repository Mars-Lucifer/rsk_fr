import Head from "next/head";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";

import { CELLS, transitionTo } from "@/components/features/mayak-zvezda/model/artifacts.mjs";
import { ACCENT } from "@/components/features/mayak-zvezda/model/platform.mjs";
import { LEVELS, RAYS } from "@/components/features/mayak-zvezda/model/zvezda.mjs";

// Звезда-платформа: сцена на весь экран, интерфейс поверх.
//
// Уровень один на организацию и переключается снизу. Луч выбирается кликом по тумбе, по
// подписи над ней или по списку справа — камера подъезжает, справа выезжает клетка
// «луч × уровень» дословно из таблицы 8.0. Клик по пустому месту или «к обзору» — назад.
//
// Состояние в адресе (?level=&ray=): кадром проверяется без кликов, ссылкой делится.
const Platform = dynamic(() => import("@/components/features/mayak-zvezda/star/Platform"), { ssr: false });
// Предметы приходят в сцену детьми: платформа о них ничего не знает.
const Props = dynamic(() => import("@/components/features/mayak-zvezda/star/Props"), { ssr: false });

const icz = (l) => (l.icz > 0 ? `+${l.icz}` : String(l.icz));

export default function ZvezdaPlatform() {
    const router = useRouter();
    const [level, setLevel] = useState(1);
    const [ray, setRay] = useState(null);

    useEffect(() => {
        if (!router.isReady) return;
        const l = Number(router.query.level);
        if (l >= 1 && l <= 6) setLevel(l);
        const r = router.query.ray;
        setRay(RAYS.some((x) => x.id === r) ? r : null);
    }, [router.isReady, router.query.level, router.query.ray]);

    // Адрес обновляется без перезагрузки и без записи в историю: «назад» в браузере должен
    // уводить со страницы, а не отматывать двадцать кликов по лучам.
    const sync = useCallback(
        (next) => {
            const q = { ...router.query, ...next };
            Object.keys(q).forEach((k) => q[k] == null && delete q[k]);
            router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true, scroll: false });
        },
        [router]
    );
    const pickRay = useCallback(
        (id) => {
            setRay(id);
            sync({ ray: id });
        },
        [sync]
    );
    const pickLevel = useCallback(
        (n) => {
            setLevel(n);
            sync({ level: n });
        },
        [sync]
    );

    const lv = LEVELS[level - 1];
    const step = transitionTo(level);
    const rayInfo = ray ? RAYS.find((r) => r.id === ray) : null;
    const cell = ray ? CELLS[ray][level] : null;

    return (
        <>
            <Head>
                <title>ЗВЕЗДА · платформа</title>
            </Head>
            <div className="stage">
                <Platform level={level} ray={ray} onPickRay={pickRay}>
                    <Props ray={ray} />
                </Platform>

                <div className="hud">
                    <div className="tl">
                        <p className="mono">// ЗВЕЗДА</p>
                        <h1>
                            {icz(lv)} · {lv.name}
                        </h1>
                        <p className="about">{lv.about}</p>
                    </div>

                    <div className={"rays mono" + (ray ? " hidden" : "")}>
                        {RAYS.map((r) => (
                            <button key={r.id} onClick={() => pickRay(r.id)} style={{ "--c": ACCENT[r.id] }}>
                                <i />
                                {r.name}
                            </button>
                        ))}
                    </div>

                    <div className={"panel" + (ray ? " open" : "")} role="complementary" aria-hidden={!ray}>
                        {cell && (
                            <>
                                <button className="back" onClick={() => pickRay(null)}>
                                    ← к обзору
                                </button>
                                <p className="mono kicker" style={{ color: ACCENT[ray] }}>
                                    {rayInfo.name} · {icz(lv)} {lv.name}
                                </p>
                                <h2>{cell.lead}</h2>
                                <p className="about">{rayInfo.about}</p>

                                <h3>Что должно быть</h3>
                                <ul className={level === 1 ? "no" : "yes"}>
                                    {cell.artifacts.map((a) => (
                                        <li key={a}>{a}</li>
                                    ))}
                                </ul>

                                <h3>Что измеряем</h3>
                                <ul className="num">
                                    {cell.indicators.map((i) => (
                                        <li key={i}>{i}</li>
                                    ))}
                                </ul>

                                {step && (
                                    <p className="crit">
                                        <b>Как сюда попадают.</b> {step.static}
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    <div className="bl">
                        {LEVELS.map((l) => (
                            <button key={l.n} onClick={() => pickLevel(l.n)} className={l.n === level ? "on" : ""} title={l.name}>
                                {icz(l)}
                            </button>
                        ))}
                    </div>
                    <p className={"br mono" + (ray ? " hidden" : "")}>
                        маяк горит на {level} из {LEVELS.length} · клик по тумбе — подъехать · пустое место — назад
                    </p>
                </div>
            </div>

            <style jsx global>{`
                /* Подписи над тумбами рисует сцена через Html из drei, поэтому стили только
                   глобальные: внутрь портала scoped-классы Next не попадают. */
                .ray-label {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    padding: 0;
                    border: 0;
                    background: none;
                    color: #1b2130;
                    font-family: inherit;
                    cursor: pointer;
                    transform: translateY(-100%);
                    white-space: nowrap;
                    transition: opacity 0.35s;
                }
                .ray-label i {
                    display: block;
                    width: 1px;
                    height: 34px;
                    background: linear-gradient(to top, var(--c), rgba(27, 33, 48, 0));
                    order: 2;
                }
                .ray-label b {
                    order: 1;
                    font-size: 12px;
                    font-weight: 500;
                    letter-spacing: 0.02em;
                    padding: 4px 9px;
                    border-radius: 4px;
                    background: rgba(255, 255, 255, 0.82);
                    border: 1px solid rgba(27, 33, 48, 0.1);
                    border-bottom: 2px solid var(--c);
                    backdrop-filter: blur(4px);
                }
                .ray-label span {
                    order: 0;
                    max-width: 250px;
                    white-space: normal;
                    text-align: center;
                    font-size: 12px;
                    line-height: 1.4;
                    color: rgba(27, 33, 48, 0.62);
                    margin-bottom: 4px;
                }
                .ray-label:hover b {
                    background: #fff;
                }
                .ray-label.dim {
                    opacity: 0.22;
                }
            `}</style>

            <style jsx>{`
                .stage {
                    position: fixed;
                    inset: 0;
                    background: #eceef1;
                }
                .stage :global(canvas) {
                    display: block;
                }
                .hud {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    color: #1b2130;
                }
                .hud > * {
                    position: absolute;
                    pointer-events: auto;
                }
                .mono {
                    font-family: ui-monospace, Menlo, Consolas, monospace;
                    font-size: 11px;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: rgba(27, 33, 48, 0.42);
                }
                .tl {
                    top: 30px;
                    left: 34px;
                    max-width: 360px;
                }
                .tl .mono {
                    margin: 0 0 10px;
                }
                h1 {
                    margin: 0 0 6px;
                    font-size: 26px;
                    font-weight: 400;
                }
                .about {
                    margin: 0;
                    font-size: 13.5px;
                    line-height: 1.5;
                    color: rgba(27, 33, 48, 0.55);
                }
                .rays {
                    top: 30px;
                    right: 34px;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 8px;
                    transition: opacity 0.3s;
                }
                .rays.hidden {
                    opacity: 0;
                    pointer-events: none;
                }
                .rays button {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    padding: 0;
                    border: 0;
                    background: none;
                    font-family: ui-monospace, Menlo, Consolas, monospace;
                    font-size: 11px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: rgba(27, 33, 48, 0.5);
                    cursor: pointer;
                }
                .rays button:hover {
                    color: #1b2130;
                }
                .rays i {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: var(--c);
                }
                .panel {
                    top: 0;
                    right: 0;
                    /* left гасится явно: у layout-шного aside он задан глобально, и при
                       заданной ширине left побеждает right — панель уезжала к левому краю. */
                    left: auto;
                    bottom: 0;
                    width: min(440px, 92vw);
                    padding: 30px 34px 40px;
                    overflow-y: auto;
                    background: rgba(255, 255, 255, 0.86);
                    backdrop-filter: blur(10px);
                    border-left: 1px solid rgba(27, 33, 48, 0.08);
                    transform: translateX(100%);
                    transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
                }
                .panel.open {
                    transform: translateX(0);
                }
                .back {
                    display: block;
                    margin: 0 0 18px;
                    padding: 0;
                    border: 0;
                    background: none;
                    color: rgba(27, 33, 48, 0.5);
                    font-size: 13px;
                    font-family: inherit;
                    cursor: pointer;
                }
                .back:hover {
                    color: #1b2130;
                }
                .kicker {
                    margin: 0 0 8px;
                }
                h2 {
                    margin: 0 0 10px;
                    font-size: 22px;
                    font-weight: 500;
                    line-height: 1.3;
                }
                .panel .about {
                    margin-bottom: 22px;
                }
                h3 {
                    margin: 0 0 9px;
                    font-family: ui-monospace, Menlo, Consolas, monospace;
                    font-size: 11px;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    font-weight: 500;
                    color: rgba(27, 33, 48, 0.42);
                }
                ul {
                    margin: 0 0 22px;
                    padding: 0;
                    list-style: none;
                }
                li {
                    position: relative;
                    padding-left: 22px;
                    margin-bottom: 9px;
                    font-size: 13.5px;
                    line-height: 1.5;
                    color: rgba(27, 33, 48, 0.8);
                }
                li::before {
                    position: absolute;
                    left: 0;
                    top: 0;
                }
                .yes li::before {
                    content: "✓";
                    color: #3aac99;
                }
                .no li::before {
                    content: "✕";
                    color: #d6533f;
                }
                .num li::before {
                    content: "◆";
                    color: #448ac5;
                    font-size: 9px;
                    top: 3px;
                }
                .crit {
                    margin: 0;
                    padding: 12px 14px;
                    border-left: 2px solid #448ac5;
                    background: rgba(68, 138, 197, 0.07);
                    font-size: 13px;
                    line-height: 1.5;
                    color: rgba(27, 33, 48, 0.7);
                }
                .bl {
                    bottom: 30px;
                    left: 34px;
                    display: flex;
                    gap: 6px;
                }
                .bl button {
                    width: 42px;
                    height: 32px;
                    border: 1px solid rgba(27, 33, 48, 0.16);
                    background: rgba(255, 255, 255, 0.72);
                    color: rgba(27, 33, 48, 0.5);
                    font-family: ui-monospace, Menlo, Consolas, monospace;
                    font-size: 12px;
                    cursor: pointer;
                    border-radius: 4px;
                }
                .bl button.on {
                    border-color: #1b2130;
                    color: #1b2130;
                    background: #fff;
                }
                .br.hidden {
                    opacity: 0;
                }
                .br {
                    transition: opacity 0.3s;
                    bottom: 30px;
                    right: 34px;
                    margin: 0;
                    max-width: 420px;
                    text-align: right;
                    line-height: 1.6;
                }
            `}</style>
        </>
    );
}
