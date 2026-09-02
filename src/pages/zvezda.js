import dynamic from "next/dynamic";
import Head from "next/head";
import { useCallback, useEffect, useRef, useState } from "react";

import Hud from "@/components/features/mayak-zvezda/Hud";
import { STEPS, stepIndexOf } from "@/components/features/mayak-zvezda/model/story.mjs";

// Объяснялка модели «ЗВЕЗДА» и цикла «Среда — Деятельность — Сознание»: одна универсальная
// организация, комната которой меняется на глазах. Показывает не состояние конкретного
// колледжа, а то, как устроен уровень и почему подъём занимает три такта.
//
// Организация демонстрационная намеренно: реальные цифры увели бы разговор в частный случай.
// По обстановке не видно, колледж это, завод или больница — подпись переключается, комната не
// меняется, и это доказательство универсальности модели.
//
// Проигрывается, а не проматывается. Скролл сюда не заведён сознательно: ScrollControls
// перехватывает колесо у OrbitControls, и осмотр сцены пришлось бы переделывать, а не
// дописывать. Если объяснялку когда-нибудь встроят в длинную статью — вот место, где это решается.
const Scene = dynamic(() => import("@/components/features/mayak-zvezda/Scene"), {
    ssr: false,
    loading: () => null,
});

const ORG_KINDS = ["Колледж", "Завод", "Больница", "Департамент"];

// Доля такта, после которой человек в «Деятельности» разворачивается от привезённого к столу.
const PICKUP_SHARE = 0.45;

export default function ZvezdaPage() {
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [org, setOrg] = useState(0);
    const [ray, setRay] = useState(null);
    // 0 — человек идёт за привезённым, 1 — стоит у своего стола. Вне «Деятельности» всегда 1.
    const [waypoint, setWaypoint] = useState(1);
    const started = useRef(false);

    const step = STEPS[index];

    // Состояние можно задать прямо в адресе: ?level=3&phase=activity&waypoint=0&play=0.
    // Нужно для проверки кадром — снимок делает фоновый браузер, кликать в нём некому.
    useEffect(() => {
        if (started.current) return;
        started.current = true;
        const query = new URLSearchParams(window.location.search);
        const level = Number(query.get("level"));
        if (level >= 1 && level <= 6) setIndex(stepIndexOf(level, query.get("phase") || "rest"));
        if (query.get("play") === "0") setPlaying(false);
        if (query.get("waypoint") === "0") setWaypoint(0);
        const wanted = query.get("ray");
        if (wanted) setRay(wanted);
    }, []);

    // Ход истории. Таймер, а не покадровый счётчик: выдержка задана в миллисекундах и от
    // частоты кадров зависеть не должна.
    useEffect(() => {
        if (!playing) return undefined;
        const timer = window.setTimeout(() => setIndex((current) => (current + 1) % STEPS.length), step.hold);
        return () => window.clearTimeout(timer);
    }, [playing, index, step.hold]);

    // Разворот на середине такта «Деятельность»: сходил за вещью — вернулся с ней на место.
    useEffect(() => {
        if (step.phase !== "activity") {
            setWaypoint(1);
            return undefined;
        }
        // На паузе половину такта не переключаем: её задают адресом при проверке кадром, и
        // сброс в ноль затирал бы заданное значение сразу после загрузки.
        if (!playing) return undefined;
        setWaypoint(0);
        const timer = window.setTimeout(() => setWaypoint(1), step.hold * PICKUP_SHARE);
        return () => window.clearTimeout(timer);
    }, [index, step.phase, step.hold, playing]);

    const goLevel = useCallback((level) => {
        setIndex(stepIndexOf(level, "rest"));
    }, []);

    return (
        <>
            <Head>
                <title>ЗВЕЗДА · как меняется организация</title>
                <meta name="description" content="Шесть уровней цифровой зрелости и цикл «Среда — Деятельность — Сознание» на одной комнате" />
            </Head>
            <main>
                <Scene level={step.level} phase={step.phase} ray={ray} waypoint={waypoint} />
                <Hud
                    step={step}
                    orgKinds={ORG_KINDS}
                    orgIndex={org}
                    onOrg={setOrg}
                    ray={ray}
                    onRay={setRay}
                    playing={playing}
                    onPlay={() => setPlaying((current) => !current)}
                    onNext={() => setIndex((current) => (current + 1) % STEPS.length)}
                    onRestart={() => setIndex(0)}
                    onLevel={goLevel}
                />
            </main>

            <style jsx>{`
                main {
                    position: relative;
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
