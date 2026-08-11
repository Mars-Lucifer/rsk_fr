import Head from "next/head";

import LevelStory from "@/components/features/mayak-guide/LevelStory";

// Объяснялка модели «ЗВЕЗДА-6» и цикла «Среда — Сознание — Деятельность»: одна комната
// организации, которая меняется на глазах. Показывает не состояние конкретной
// организации, а то, как устроена модель и почему переход занимает три такта.
//
// Кадры генерённые, лежат в public/zvezda. Динамику даёт кроссфейд между ними, поэтому
// three здесь больше нет и страница грузится обычным образом, без dynamic и ssr:false.
// 3D-прототип остался в ветке отдельным компонентом — см. комментарий в levelStory.mjs.
export default function Zvezda3D() {
    return (
        <>
            <Head>
                <title>ЗВЕЗДА-6 · как меняется организация</title>
            </Head>
            <main>
                <LevelStory />
            </main>

            <style jsx>{`
                main {
                    display: block;
                    height: 100vh;
                    background: #0b0b0b;
                    border: 0;
                    box-shadow: none;
                    overflow: hidden;
                }
            `}</style>
        </>
    );
}
