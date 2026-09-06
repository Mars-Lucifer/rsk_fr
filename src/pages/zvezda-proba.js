import Head from "next/head";

import { SKETCHES } from "@/components/features/mayak-zvezda/proba/Sketches";

// Страница-проба: три наброска трёх подходов рядом, на реальных данных модели.
//
// Зачем отдельной страницей. Диораму на /zvezda забраковали дважды, причём второй раз уже после
// доводки света. Значит показывать надо раньше и дешевле: не готовую вещь, а направление. Здесь
// нет ни анимации, ни интерактива намеренно — выбирается подход, а не качество исполнения.
//
// Настоящая страница /zvezda остаётся нетронутой, пока направление не выбрано.
export default function ZvezdaProba() {
    return (
        <>
            <Head>
                <title>ЗВЕЗДА · три подхода</title>
            </Head>
            <main>
                <header>
                    <h1>Три подхода к одной модели</h1>
                    <p>
                        Наброски, а не готовые экраны: ни анимации, ни интерактива. Данные настоящие — те же шесть лучей и шесть уровней,
                        поэтому видно, помещаются ли реальные названия и не душно ли от них.
                    </p>
                </header>

                <div className="row">
                    {SKETCHES.map(({ id, title, about, risk, Component }) => (
                        <figure key={id}>
                            <div className="frame">
                                <Component />
                            </div>
                            <figcaption>
                                <h2>{title}</h2>
                                <p>{about}</p>
                                <p className="risk">Риск: {risk}</p>
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </main>

            <style jsx>{`
                main {
                    min-height: 100vh;
                    padding: 42px 32px 64px;
                    background: #07090f;
                    color: #f4efe6;
                    border: 0;
                    box-shadow: none;
                }
                header {
                    max-width: 760px;
                    margin: 0 auto 38px;
                    text-align: center;
                }
                h1 {
                    margin: 0 0 12px;
                    font-size: 30px;
                    font-weight: 500;
                    letter-spacing: -0.01em;
                }
                header p {
                    margin: 0;
                    font-size: 15px;
                    line-height: 1.55;
                    color: rgba(244, 239, 230, 0.5);
                }
                .row {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 26px;
                    max-width: 1560px;
                    margin: 0 auto;
                }
                figure {
                    margin: 0;
                }
                .frame {
                    border: 1px solid rgba(244, 239, 230, 0.12);
                    border-radius: 10px;
                    overflow: hidden;
                    background: #0b1020;
                }
                .frame :global(svg) {
                    display: block;
                    width: 100%;
                    height: auto;
                }
                figcaption {
                    padding: 16px 4px 0;
                }
                h2 {
                    margin: 0 0 8px;
                    font-size: 17px;
                    font-weight: 500;
                }
                figcaption p {
                    margin: 0 0 6px;
                    font-size: 14px;
                    line-height: 1.5;
                    color: rgba(244, 239, 230, 0.62);
                }
                .risk {
                    color: rgba(255, 122, 92, 0.75);
                }
                @media (max-width: 1100px) {
                    .row {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </>
    );
}
