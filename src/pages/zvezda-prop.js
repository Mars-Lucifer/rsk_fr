import Head from "next/head";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";

// Смотрелка одного предмета: загрузить GLB, перекрасить в наш гипс, поставить на тумбу
// нашего размера и снять кадр. Нужна ровно для одного вопроса — годится форма или нет.
//
// Тумба и клетчатая подложка дают масштаб: без опоры любой предмет выглядит убедительно,
// а на постаменте сразу видно, что он либо великан, либо крошка.
//
// Адрес: /zvezda-prop?file=smart_home_hub.glb
const PropView = dynamic(() => import("@/components/features/mayak-zvezda/star/PropView"), { ssr: false });

const PROPS = [
    { id: "tall_narrow_six-drawer_storage_cabinet_sharp_edge.glb", name: "Шкаф с ящиками", tag: "Данные · -1 Хаос" },
    { id: "stylized_monitor_displaying_ascending_bar_chart_s.glb", name: "Монитор с графиком", tag: "Данные · +2 Результат" },
    { id: "knowledge.glb", name: "Планшет", tag: "Знания · +1" },
    { id: "smart_home_hub.glb", name: "Хаб умного дома", tag: "Реквизит" },
];

export default function ZvezdaProp() {
    const router = useRouter();
    const queryFile = router.isReady && typeof router.query.file === "string" ? router.query.file : null;
    const file = queryFile || "tall_narrow_six-drawer_storage_cabinet_sharp_edge.glb";
    // Модель может оказаться и одним предметом, и целой сценой: ?dist отводит камеру,
    // ?raw=1 убирает тумбу, которая для сцены только мешает.
    const distQuery = router.isReady ? Number(router.query.dist) : 0;
    const defaultDist = file.includes("cabinet") ? 1.35 : 1;
    const dist = distQuery > 0 ? distQuery : defaultDist;
    const raw = router.isReady && router.query.raw === "1";
    // Печать голограммой. Момент задаётся адресом, а не таймером: любой кадр надо уметь снять
    // и сверить, иначе эффект проверяется на глаз и правится вслепую.
    const print = router.isReady && (router.query.print === "1" || router.query.play === "1");
    const play = router.isReady && router.query.play === "1";
    const t = router.isReady && router.query.t != null ? Math.max(0, Math.min(1, Number(router.query.t))) : 1;

    const selectProp = (propId) => {
        const nextQuery = { ...router.query, file: propId };
        if (propId.includes("cabinet") && !router.query.dist) {
            nextQuery.dist = "1.35";
        }
        router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    };

    const togglePlay = () => {
        router.replace({ pathname: router.pathname, query: { ...router.query, play: play ? "0" : "1" } }, undefined, { shallow: true });
    };

    const togglePrint = () => {
        router.replace({ pathname: router.pathname, query: { ...router.query, print: print ? "0" : "1" } }, undefined, { shallow: true });
    };

    return (
        <>
            <Head>
                <title>ЗВЕЗДА · предмет</title>
            </Head>
            <div className="stage">
                <PropView file={file} dist={dist} raw={raw} print={print} t={t} play={play} />

                <div className="nav-bar mono">
                    <div className="models">
                        {PROPS.map((p) => (
                            <button
                                key={p.id}
                                className={file === p.id ? "active" : ""}
                                onClick={() => selectProp(p.id)}
                            >
                                <span className="label">{p.name}</span>
                                <span className="tag">{p.tag}</span>
                            </button>
                        ))}
                    </div>

                    <div className="actions">
                        <button className={play ? "active" : ""} onClick={togglePlay}>
                            {play ? "Стоп печать" : "Анимация печати"}
                        </button>
                        <button className={print && !play ? "active" : ""} onClick={togglePrint}>
                            Голограмма
                        </button>
                        <a href="/zvezda-platform" className="link-platform">
                            Платформа ЗВЕЗДА →
                        </a>
                    </div>
                </div>

                <p className="mono filename">{file}</p>
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
                .mono {
                    font-family: ui-monospace, Menlo, Consolas, monospace;
                    font-size: 11px;
                    letter-spacing: 0.04em;
                }
                .nav-bar {
                    position: absolute;
                    top: 20px;
                    left: 24px;
                    right: 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    pointer-events: none;
                }
                .models, .actions {
                    display: flex;
                    gap: 8px;
                    pointer-events: auto;
                }
                button, .link-platform {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 2px;
                    padding: 8px 14px;
                    background: rgba(255, 255, 255, 0.72);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(27, 33, 48, 0.12);
                    border-radius: 6px;
                    color: #1b2130;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-decoration: none;
                    line-height: 1.2;
                }
                .actions button, .link-platform {
                    justify-content: center;
                    align-items: center;
                    padding: 8px 16px;
                    font-weight: 500;
                }
                button:hover, .link-platform:hover {
                    background: #fff;
                    border-color: rgba(27, 33, 48, 0.25);
                }
                button.active {
                    background: #1b2130;
                    border-color: #1b2130;
                    color: #fff;
                }
                button.active .tag {
                    color: rgba(255, 255, 255, 0.65);
                }
                .label {
                    font-weight: 500;
                }
                .tag {
                    font-size: 9px;
                    color: rgba(27, 33, 48, 0.5);
                }
                .link-platform {
                    background: rgba(175, 196, 58, 0.18);
                    border-color: rgba(175, 196, 58, 0.4);
                    color: #485412;
                }
                .link-platform:hover {
                    background: rgba(175, 196, 58, 0.3);
                }
                .filename {
                    position: absolute;
                    left: 24px;
                    bottom: 20px;
                    margin: 0;
                    font-size: 11px;
                    letter-spacing: 0.08em;
                    color: rgba(27, 33, 48, 0.45);
                    pointer-events: none;
                }
            `}</style>
        </>
    );
}
