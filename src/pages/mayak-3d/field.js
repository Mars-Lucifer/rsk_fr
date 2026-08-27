import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";

// Разбор одного предмета: поле крупно и со свободной камерой. Общий стол — на /mayak-guide-3d.
const FieldStand = dynamic(() => import("@/components/features/mayak-guide/stands").then((m) => m.FieldStand), {
    ssr: false,
    loading: () => <div className="boot">Расстилаем поле…</div>,
});

export default function FieldPage() {
    return (
        <>
            <Head>
                <title>МАЯК · поле в 3D</title>
            </Head>
            <main>
                <header>
                    <div>
                        <h1>МАЯК · поле</h1>
                        <p>Двустороннее полотно 700×550 мм из габардина: базовая сторона — «Я», изнанка — «МЫ». Переворот идёт как с настоящей тканью — с провисом и складкой.</p>
                    </div>
                    <nav>
                        <Link href="/mayak-guide-3d">Стол в 3D</Link>
                        <Link href="/mayak-guide">Текстовое руководство</Link>
                    </nav>
                </header>
                <div className="stage">
                    <FieldStand />
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
