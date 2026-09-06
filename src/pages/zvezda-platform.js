import Head from "next/head";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

import { shortCell } from "@/components/features/mayak-zvezda/model/short/index.mjs";
import { ACCENT } from "@/components/features/mayak-zvezda/model/platform.mjs";
import { TOUR, TOUR_AUDIO, TOUR_RATE, tourCueIndexAt, tourCues, tourParts } from "@/components/features/mayak-zvezda/model/tour.mjs";
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
    // Сумерки — выбранный вариант сцены. Остальные пресеты никуда не делись и открываются
    // адресом ?light=1..3, но переключателя в интерфейсе больше нет: выбор сделан.
    const [light, setLight] = useState(4);
    const [ready, setReady] = useState(false);
    // Экскурсия: дорожка ведёт, сцена идёт за ней. Состояние тура держится в ref, а не
    // в адресе: в адрес пишется то, что показано, и запись каждого кадра тура забила бы
    // историю переходами.
    const [touring, setTouring] = useState(false);
    // Какая глава звучит сейчас: подсветка в списке и подпись внизу.
    const [cueIndex, setCueIndex] = useState(0);
    const audioRef = useRef(null);
    const cuesRef = useRef(null);

    useEffect(() => {
        if (!router.isReady) return;
        const l = Number(router.query.level);
        if (l >= 1 && l <= 6) setLevel(l);
        const r = router.query.ray;
        setRay(RAYS.some((x) => x.id === r) ? r : null);
        const f = router.query.print;
        setFreeze(f == null ? null : Math.max(0, Math.min(1, Number(f))));
        const g = Number(router.query.light);
        setLight(g >= 1 && g <= 4 ? g : 4);
        setReady(true);
    }, [router.isReady, router.query.level, router.query.ray, router.query.print, router.query.light]);

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

    // Пуск и стоп экскурсии. Аудио создаётся по первому нажатию: до жеста пользователя
    // браузер его всё равно не проиграет, а держать заранее — лишний запрос на каждой
    // загрузке страницы.
    const stopTour = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
        setTouring(false);
    }, []);

    // Дорожка заводится при первом обращении — и от «пуска», и от клика по главе. Раньше
    // её создавал только «пуск», и глава, нажатая с холодного старта, молчала.
    const ensureAudio = useCallback(() => {
        let audio = audioRef.current;
        if (audio) return audio;
        audio = new Audio(TOUR_AUDIO);
        audio.preload = "auto";
        audio.playbackRate = TOUR_RATE;
        audioRef.current = audio;
        audio.addEventListener("ended", () => setTouring(false));
        audio.addEventListener("timeupdate", () => {
            if (!cuesRef.current) return;
            const i = tourCueIndexAt(cuesRef.current, audio.currentTime);
            const cue = cuesRef.current[i];
            setCueIndex(i);
            setLevel(cue.level);
            setRay(cue.ray);
        });
        return audio;
    }, []);

    // Что бы ни попросили — играть с начала или с главы, — дождаться метаданных: до них
    // неизвестна длительность, а по ней считаются метки.
    const playFrom = useCallback(
        (index) => {
            const audio = ensureAudio();
            const go = () => {
                cuesRef.current = tourCues(audio.duration);
                const cue = cuesRef.current[index];
                audio.currentTime = cue.at + 0.05;
                setCueIndex(index);
                setLevel(cue.level);
                setRay(cue.ray);
                audio.play();
                setTouring(true);
            };
            if (audio.readyState >= 1) go();
            else audio.addEventListener("loadedmetadata", go, { once: true });
        },
        [ensureAudio]
    );

    const seekTour = useCallback((index) => playFrom(index), [playFrom]);
    const startTour = useCallback(() => playFrom(0), [playFrom]);

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            // WASD работает наравне со стрелками. Сравнение идёт по e.code, а не по e.key:
            // code — это физическая клавиша, и на русской раскладке те же кнопки шлют «ц»,
            // «ф», «ы», «в». По e.key пришлось бы держать таблицу букв двух алфавитов.
            const key = { KeyW: "ArrowUp", KeyS: "ArrowDown", KeyA: "ArrowLeft", KeyD: "ArrowRight" }[e.code] ?? e.key;
            if (key === "ArrowLeft") {
                e.preventDefault();
                const currIdx = ray ? RAYS.findIndex((r) => r.id === ray) : 0;
                const prevIdx = (currIdx - 1 + RAYS.length) % RAYS.length;
                pickRay(RAYS[prevIdx].id);
            } else if (key === "ArrowRight") {
                e.preventDefault();
                const currIdx = ray ? RAYS.findIndex((r) => r.id === ray) : -1;
                const nextIdx = (currIdx + 1) % RAYS.length;
                pickRay(RAYS[nextIdx].id);
            } else if (key === "Escape") {
                if (touring) stopTour();
                pickRay(null);
            } else if (key === "ArrowUp") {
                e.preventDefault();
                pickLevel(Math.min(6, level + 1));
            } else if (key === "ArrowDown") {
                e.preventDefault();
                pickLevel(Math.max(1, level - 1));
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [ray, level, pickRay, pickLevel, touring, stopTour]);

    // Дорожка живёт дольше страницы, если её не остановить руками.
    useEffect(() => () => audioRef.current?.pause(), []);

    const lv = LEVELS[level - 1];
    const rayInfo = ray ? RAYS.find((r) => r.id === ray) : null;
    const cell = ray ? shortCell(ray, level) : null;

    return (
        <>
            <Head>
                <title>ЗВЕЗДА · платформа</title>
            </Head>
            <div className="stage">
                {ready && <Platform level={level} ray={ray} light={light} freeze={freeze} onPickRay={pickRay} />}

                <div className="hud">
                    <div className="tl">
                        {/* Подпись показывает выбранный луч. На обзоре её нет: строка «обзор,
                            все шесть лучей» повторяла то, что и так видно на экране. */}
                        {rayInfo && (
                            <p className="mono where">
                                <i style={{ background: ACCENT[ray] }} />
                                {rayInfo.name}
                            </p>
                        )}
                        <h1>
                            {icz(lv)} · {lv.name}
                        </h1>
                        <p className="about">{lv.about}</p>
                    </div>

                    <div className={"panel" + (ray ? " open" : "")} role="complementary" aria-hidden={!ray}>
                        {cell && (
                            <>
                                {/* Кнопок возврата и перелистывания здесь нет: Esc уводит к обзору,
                                    ← → переключают лучи, ↑ ↓ — уровни. */}
                                <p className="mono kicker" style={{ color: ACCENT[ray] }}>
                                    {rayInfo.name} · {icz(lv)} {lv.name}
                                </p>
                                <h2>{cell.lead}</h2>
                                <p className="about">{rayInfo.about}</p>

                                <div className="card">
                                    <h3>Что должно быть</h3>
                                    <ul className={level === 1 ? "no" : "yes"}>
                                        {cell.artifacts.map((a) => (
                                            <li key={a}>
                                                <i />
                                                <span>{a}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="card">
                                    <h3>Что измеряем</h3>
                                    <ul className="num">
                                        {cell.indicators.map((i) => (
                                            <li key={i}>
                                                <i style={{ background: ACCENT[ray] }} />
                                                <span>{i}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Главы. Список — единственный способ увидеть, о чём сейчас речь, и
                        уйти на нужный кусок: дорожка одна, резать её на файлы незачем —
                        глава это одно число, секунда начала. */}
                    <div className={"chapters" + (touring ? " on" : " idle")}>
                        {tourParts().map((group) => (
                            <div className="part" key={group.part}>
                                <p className="mono partName">{group.part}</p>
                                {group.items.map((item) => (
                                    <button
                                        key={item.index}
                                        className={"chapter" + (item.index === cueIndex ? " on" : "") + (item.index < cueIndex ? " passed" : "")}
                                        onClick={() => seekTour(item.index)}
                                    >
                                        {item.title}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>

                    {touring && <p className="caption">{TOUR[cueIndex].text}</p>}

                    <div className="bl">
                        <button className="play" onClick={touring ? stopTour : startTour} title={touring ? "Остановить (Esc)" : "Экскурсия с озвучкой"}>
                            {touring ? "■ стоп" : "▶ пуск"}
                        </button>
                        {LEVELS.map((l) => (
                            <button key={l.n} onClick={() => pickLevel(l.n)} className={l.n === level ? "on" : ""} title={l.name}>
                                {icz(l)}
                            </button>
                        ))}
                    </div>

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
                .where {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .where i {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
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
                .panel {
                    top: 0;
                    right: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    /* left гасится явно: у layout-шного aside он задан глобально, и при
                       заданной ширине left побеждает right — панель уезжала к левому краю. */
                    left: auto;
                    bottom: 0;
                    width: min(500px, 94vw);
                    padding: 40px 38px;
                    overflow-y: auto;
                    background: rgba(252, 253, 254, 0.94);
                    border-left: 1px solid rgba(27, 33, 48, 0.08);
                    transform: translateX(100%);
                    transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
                }
                .panel.open {
                    transform: translateX(0);
                }
                .kicker {
                    margin: 0 0 10px;
                    font-size: 11.5px;
                }
                h2 {
                    margin: 0 0 12px;
                    /* Заголовок ломается по смыслу, а не по краю колонки: без этого в шапке
                       регулярно оставалось висячее слово в последней строке. */
                    text-wrap: balance;
                    font-size: 27px;
                    font-weight: 600;
                    line-height: 1.22;
                    letter-spacing: -0.01em;
                }
                .panel .about {
                    margin-bottom: 24px;
                    font-size: 14.5px;
                }
                /* Карточка. Каждый список — свой блок на подложке: на сплошном полотне
                   «что должно быть» и «что измеряем» сливались в один длинный столбец,
                   и граница между предъявимым и измеримым пропадала. */
                .card {
                    padding: 16px 18px 6px;
                    margin-bottom: 14px;
                    border: 1px solid rgba(27, 33, 48, 0.07);
                    border-radius: 16px;
                    background: rgba(255, 255, 255, 0.6);
                }
                h3 {
                    margin: 0 0 6px;
                    font-family: ui-monospace, Menlo, Consolas, monospace;
                    font-size: 11px;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    font-weight: 500;
                    color: rgba(27, 33, 48, 0.42);
                }
                ul {
                    margin: 0;
                    padding: 0;
                    list-style: none;
                    /* Лигатуры выключены: шрифт склеивает «<3» в сердечко, а «>7» в «›7».
                       В индикаторах это не украшение — это подмена знака сравнения. */
                    font-variant-ligatures: none;
                }
                li {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 11px 0;
                    font-size: 14.5px;
                    line-height: 1.35;
                    color: rgba(27, 33, 48, 0.86);
                    border-bottom: 1px solid rgba(27, 33, 48, 0.06);
                }
                li:last-child {
                    border-bottom: 0;
                }
                /* Маркер — кружок, а не символ в строке: у знака ✓ базовая линия своя, и
                   на двухстрочном пункте он уезжал от текста. Кружок стоит по центру строки
                   независимо от её высоты. */
                li span {
                    /* Перенос по правилам, а не по ширине: браузер не оставляет одно слово
                       в последней строке и не разрывает пару «тире + число». */
                    text-wrap: pretty;
                    hyphens: none;
                }
                li i {
                    flex: 0 0 auto;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    position: relative;
                }
                .yes li i {
                    background: rgba(58, 172, 153, 0.14);
                }
                .yes li i::after {
                    content: "✓";
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    color: #2f9e8a;
                }
                .no li i {
                    background: rgba(214, 83, 63, 0.14);
                }
                .no li i::after {
                    content: "✕";
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    color: #d6533f;
                }
                .num li i {
                    width: 10px;
                    height: 10px;
                    margin: 0 6px;
                    opacity: 0.85;
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
                /* Главы стоят слева столбцом: справа панель клетки, снизу шкала уровней,
                   а левый край всё равно пустой — сцена там уходит за кадр. */
                .chapters {
                    top: 132px;
                    left: 34px;
                    width: 228px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    /* Подложка обязательна: список лежит поверх сцены, и без неё серый текст
                       на белой плите не читается — а на тёмном полу читается уже другой. */
                    padding: 16px 18px;
                    border-radius: 16px;
                    border: 1px solid rgba(27, 33, 48, 0.06);
                    background: rgba(252, 253, 254, 0.9);
                    transition: opacity 0.35s;
                }
                /* До запуска список приглушён: он не должен спорить с самой сценой, но и
                   прятать его нельзя — с него начинают, когда нужен конкретный кусок. */
                .chapters.idle {
                    opacity: 0.45;
                }
                .chapters.idle:hover {
                    opacity: 1;
                }
                .part {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .partName {
                    margin: 0 0 4px;
                    font-size: 10px;
                }
                .chapter {
                    /* Глобальный стиль кнопок в шапке проекта делает их flex по центру, и
                       одного text-align мало: выравнивание задаётся раскладкой, а не текстом. */
                    display: block;
                    width: 100%;
                    padding: 3px 0;
                    border: 0;
                    background: none;
                    text-align: left;
                    font-family: inherit;
                    font-size: 13px;
                    line-height: 1.3;
                    color: rgba(27, 33, 48, 0.42);
                    cursor: pointer;
                    transition: color 0.2s;
                }
                .chapter:hover {
                    color: rgba(27, 33, 48, 0.8);
                }
                .chapter.passed {
                    color: rgba(27, 33, 48, 0.3);
                }
                .chapter.on {
                    color: #1b2130;
                    font-weight: 600;
                }
                /* Подпись к тому, что звучит. Не расшифровка слово в слово — сжатие фразы:
                   читать субтитр целиком и одновременно смотреть сцену нельзя. */
                .caption {
                    left: 34px;
                    right: auto;
                    bottom: 84px;
                    max-width: 560px;
                    margin: 0;
                    padding: 12px 16px;
                    border-radius: 14px;
                    border: 1px solid rgba(27, 33, 48, 0.06);
                    background: rgba(252, 253, 254, 0.92);
                    font-size: 15px;
                    line-height: 1.45;
                    color: rgba(27, 33, 48, 0.72);
                    text-wrap: pretty;
                }
                .play {
                    /* Кнопка пуска шире цифровых: она не член ряда уровней, а вход в другой
                       режим, и путать их нельзя. */
                    width: auto !important;
                    padding: 0 12px;
                    margin-right: 10px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .bl button.on {
                    border-color: #1b2130;
                    color: #1b2130;
                    background: #fff;
                }

            `}</style>
        </>
    );
}
