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

export default function ZvezdaProp() {
    const router = useRouter();
    const file = typeof router.query.file === "string" ? router.query.file : "smart_home_hub.glb";
    // Модель может оказаться и одним предметом, и целой сценой: ?dist отводит камеру,
    // ?raw=1 убирает тумбу, которая для сцены только мешает.
    const dist = Number(router.query.dist) > 0 ? Number(router.query.dist) : 1;
    const raw = router.query.raw === "1";

    return (
        <>
            <Head>
                <title>ЗВЕЗДА · предмет</title>
            </Head>
            <div className="stage">
                <PropView file={file} dist={dist} raw={raw} />
                <p className="mono">{file}</p>
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
                    position: absolute;
                    left: 24px;
                    bottom: 20px;
                    margin: 0;
                    font-family: ui-monospace, Menlo, Consolas, monospace;
                    font-size: 11px;
                    letter-spacing: 0.08em;
                    color: rgba(27, 33, 48, 0.45);
                }
            `}</style>
        </>
    );
}
