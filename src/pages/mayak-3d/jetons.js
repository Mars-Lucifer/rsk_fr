import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";

// Жетоны направлений в настоящем 3D: 36 отдельных твёрдых тел на общем столе.
//
// Сцена грузится только на клиенте, иначе three и физика уедут в общий бандл портала.
const JetonsStand = dynamic(() => import("@/components/features/mayak-guide/stands").then((m) => m.JetonsStand), {
    ssr: false,
    loading: () => <div className="boot">Раскладываем жетоны…</div>,
});

export default function MayakJetons3D() {
    return (
        <>
            <Head>
                <title>МАЯК · жетоны в 3D</title>
            </Head>
            <main>
                <header>
                    <div>
                        <h1>МАЯК · жетоны направлений</h1>
                        <p>36 жетонов Ø40×3 мм: шесть направлений по шесть задач, разложены по клеткам четырёх тактов рубашкой вверх. Каждый жетон — отдельное физическое тело, а не картинка на поле.</p>
                    </div>
                    <nav>
                        <Link href="/mayak-guide-3d">Поле в 3D</Link>
                        <Link href="/mayak-guide">Текстовое руководство</Link>
                    </nav>
                </header>
                <div className="stage">
                    <JetonsStand />
                </div>
            </main>

            <style jsx>{`
                main {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    background: #15110e;
                    color: #f4efe6;
                }
                header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 24px;
                    padding: 22px 28px 14px;
                }
                h1 {
                    margin: 0;
                    font-size: 19px;
                    font-weight: 600;
                    letter-spacing: 0.01em;
                }
                p {
                    margin: 6px 0 0;
                    max-width: 62ch;
                    font-size: 14px;
                    color: rgba(244, 239, 230, 0.62);
                }
                nav {
                    display: flex;
                    gap: 18px;
                    font-size: 14px;
                    white-space: nowrap;
                }
                nav :global(a) {
                    color: rgba(244, 239, 230, 0.72);
                    text-decoration: none;
                    border-bottom: 1px solid rgba(244, 239, 230, 0.25);
                }
                nav :global(a:hover) {
                    color: #f4efe6;
                }
                .stage {
                    flex: 1;
                    min-height: 0;
                }
                .boot {
                    display: grid;
                    place-items: center;
                    height: 100%;
                    color: rgba(244, 239, 230, 0.5);
                    font-size: 14px;
                }
            `}</style>
        </>
    );
}
