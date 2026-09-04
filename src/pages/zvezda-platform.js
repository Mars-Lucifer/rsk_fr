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

const icz = (l) => (l.icz > 0 ? `+${l.icz}` : String(l.icz));

export default function ZvezdaPlatform() {
    const router = useRouter();
    const [level, setLevel] = useState(1);
    const [ray, setRay] = useState(null);
    // ?print=0.35 останавливает печать на заданном моменте — для проверки кадром.
    const [freeze, setFreeze] = useState(null);
    // Наведение на тумбу подсвечивает её строку в списке справа. Подписей над предметами
    // больше нет: они садились прямо на вещь и портили кадр. Связь «тумба ↔ строка» и есть
    // замена подписи — она работает в обе стороны и ничего не загораживает.
    const [hover, setHover] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!router.isReady) return;
        const l = Number(router.query.level);
        if (l >= 1 && l <= 6) setLevel(l);
        const r = router.query.ray;
        setRay(RAYS.some((x) => x.id === r) ? r : null);
        const f = router.query.print;
        setFreeze(f == null ? null : Math.max(0, Math.min(1, Number(f))));
        setReady(true);
    }, [router.isReady, router.query.level, router.query.ray, router.query.print]);

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

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            if (e.key === "ArrowLeft") {
                e.preventDefault();
                const currIdx = ray ? RAYS.findIndex((r) => r.id === ray) : 0;
                const prevIdx = (currIdx - 1 + RAYS.length) % RAYS.length;
                pickRay(RAYS[prevIdx].id);
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                const currIdx = ray ? RAYS.findIndex((r) => r.id === ray) : -1;
                const nextIdx = (currIdx + 1) % RAYS.length;
                pickRay(RAYS[nextIdx].id);
            } else if (e.key === "Escape") {
                pickRay(null);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                pickLevel(Math.min(6, level + 1));
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                pickLevel(Math.max(1, level - 1));
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [ray, level, pickRay, pickLevel]);

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
                {ready && <Platform level={level} ray={ray} freeze={freeze} onPickRay={pickRay} onHoverRay={setHover} />}

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
                            <button
                                key={r.id}
                                onClick={() => pickRay(r.id)}
                                onMouseEnter={() => setHover(r.id)}
                                onMouseLeave={() => setHover(null)}
                                className={hover === r.id ? "on" : ""}
                                style={{ "--c": ACCENT[r.id] }}
                            >
                                <i />
                                {r.name}
                            </button>
                        ))}
                    </div>

                    <div className={"panel" + (ray ? " open" : "")} role="complementary" aria-hidden={!ray}>
                        {cell && (
                            <>
                                <div className="panelNav">
                                    <button className="back" onClick={() => pickRay(null)}>
                                        ← к обзору
                                    </button>
                                    <div className="rayFlippers">
                                        <button
                                            className="flipBtn"
                                            onClick={() => {
                                                const idx = RAYS.findIndex((r) => r.id === ray);
                                                const prev = RAYS[(idx - 1 + RAYS.length) % RAYS.length];
                                                pickRay(prev.id);
                                            }}
                                            title="Предыдущий луч (←)"
                                        >
                                            ‹
                                        </button>
                                        <button
                                            className="flipBtn"
                                            onClick={() => {
                                                const idx = RAYS.findIndex((r) => r.id === ray);
                                                const next = RAYS[(idx + 1) % RAYS.length];
                                                pickRay(next.id);
                                            }}
                                            title="Следующий луч (→)"
                                        >
                                            ›
                                        </button>
                                    </div>
                                </div>
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
                .rays button:hover,
                .rays button.on {
                    color: #1b2130;
                }
                .rays button.on i {
                    box-shadow: 0 0 0 3px rgba(27, 33, 48, 0.08);
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
                .panelNav {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin: 0 0 18px;
                }
                .back {
                    display: block;
                    margin: 0;
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
                .rayFlippers {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .flipBtn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    border: 1px solid rgba(27, 33, 48, 0.12);
                    background: rgba(255, 255, 255, 0.7);
                    color: rgba(27, 33, 48, 0.65);
                    font-size: 16px;
                    font-weight: 600;
                    line-height: 1;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .flipBtn:hover {
                    background: #ffffff;
                    color: #1b2130;
                    border-color: rgba(27, 33, 48, 0.28);
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
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
