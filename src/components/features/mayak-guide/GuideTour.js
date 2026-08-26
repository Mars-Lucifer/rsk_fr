"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Подсказки поверх живого экрана: подсветить элемент, сказать что с ним делать, дождаться
// действия. Мастер учится на своей странице, а не на скриншоте.
//
// Библиотеку тура (driver.js, shepherd) не берём: обе умеют подсветку и «Далее», а нам
// нужно ровно обратное — шаг закрывается фактом, а не кнопкой. Своей озвучки у них тоже
// нет, а голос здесь уже записан. Остаётся сто строк, ради которых зависимость не заводят.
//
// Шаг:
//   { sel, title, text, wait, place }
//   sel   — CSS-селектор цели. Пустой — шаг без цели, карточка по центру.
//   wait  — чего ждём, чтобы засчитать шаг:
//             "click"  клик по самой цели (по умолчанию, если есть sel);
//             "next"   нажатие кнопки в карточке;
//             функция  () => boolean, опрашивается 4 раза в секунду — так ловятся
//                      действия, не сводимые к клику: строка появилась, счётчик вырос.
//   place — сторона карточки: "auto" (по умолчанию), "top", "bottom", "left", "right".
//
// Цель может появиться не сразу (панель раскрывается, ответ сервера едет). Поэтому шаг
// не падает на отсутствующем селекторе, а ждёт его и держит карточку по центру.

const PAD = 8; // зазор между вырезом и краем цели
const GAP = 14; // отступ карточки от выреза
const CARD_W = 340;
const POLL_MS = 250;
// Сколько ждать необязательную цель, прежде чем перешагнуть. Такие шаги описывают то,
// что есть не у каждой карты: инструкция, доп.материал, источник. Без пропуска мастер
// упирался бы в подсказку про кнопку, которой на его задании нет, — и инструкция
// заканчивалась бы тупиком вместо разбора.
const OPTIONAL_MS = 6000;

// Документ, в котором ищется цель. Шаг с frame целится внутрь встроенной страницы:
// демонстрация тренажёра открывается в консоли через iframe, и подсветить кнопку внутри
// иначе нельзя. Работает потому, что тренажёр лежит на том же домене — у чужого сайта
// contentDocument закрыт браузером, и шаг просто останется в ожидании.
function docOf(frameSel) {
    if (typeof document === "undefined") return null;
    if (!frameSel) return document;
    const frame = document.querySelector(frameSel);
    try {
        return frame?.contentDocument || null;
    } catch {
        return null;
    }
}

// Смещение встроенной страницы в окне: координаты внутри iframe считаются от его левого
// верхнего угла, а карточка и вырез живут в координатах окна.
function frameOffset(frameSel) {
    if (!frameSel) return { x: 0, y: 0 };
    const frame = document.querySelector(frameSel);
    if (!frame) return { x: 0, y: 0 };
    const box = frame.getBoundingClientRect();
    return { x: box.left, y: box.top };
}

// N-я подходящая цель. Нужна там, где селектора на одну штуку не существует: в тренажёре
// ряд кнопок сервисов размечен теми же классами, что ряд «Начать задание», и отличаются
// они только порядком. Городить ради этого атрибуты в чужой странице — дороже.
function pick(scope, sel, nth = 0, match = "") {
    if (!scope || !sel) return null;
    // Поиск по надписи. В тренажёре кнопки задания различаются только текстом: классы у
    // «Инструкции», «Доп.материала» и «Начать задание» общие, а имена классов ещё и
    // собраны Tailwind'ом из утилит. Текст на кнопке — то же, что видит мастер, и меняется
    // он вместе со смыслом кнопки, а не при перевёрстке.
    if (match) {
        const wanted = match.toLowerCase();
        const all = [...scope.querySelectorAll(sel)];
        const hit = all.filter((node) => node.textContent.trim().toLowerCase().includes(wanted));
        return hit[nth] || null;
    }
    if (!nth) return scope.querySelector(sel);
    return scope.querySelectorAll(sel)[nth] || null;
}

function rectOf(sel, frameSel, nth, match) {
    if (!sel) return null;
    const scope = docOf(frameSel);
    const node = pick(scope, sel, nth, match);
    if (!node) return null;
    const box = node.getBoundingClientRect();
    // Скрытый элемент даёт нулевую рамку в левом верхнем углу. Подсветить её значит
    // вырезать дырку в пустом месте — для шага это то же самое, что цели ещё нет.
    if (box.width < 1 && box.height < 1) return null;
    const shift = frameOffset(frameSel);
    return {
        left: box.left + shift.x,
        top: box.top + shift.y,
        right: box.right + shift.x,
        bottom: box.bottom + shift.y,
        width: box.width,
        height: box.height,
    };
}

// Куда положить карточку. Снизу, если внизу есть место, иначе сверху; когда цель
// занимает экран по высоте — сбоку. Считается по видимой области, а не по документу:
// карточка не должна уезжать под сгиб.
function placeCard(box, prefer) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!box) return { left: Math.max(16, (vw - CARD_W) / 2), top: Math.max(16, vh / 2 - 120), arrow: null };

    const below = vh - box.bottom;
    const above = box.top;
    const side = prefer && prefer !== "auto" ? prefer : below > 180 || below > above ? "bottom" : "top";

    let left = box.left + box.width / 2 - CARD_W / 2;
    left = Math.min(Math.max(16, left), vw - CARD_W - 16);

    if (side === "left" || side === "right") {
        const top = Math.min(Math.max(16, box.top), vh - 200);
        return {
            left: side === "left" ? Math.max(16, box.left - CARD_W - GAP) : Math.min(vw - CARD_W - 16, box.right + GAP),
            top,
            arrow: side === "left" ? "right" : "left",
        };
    }

    return {
        left,
        top: side === "bottom" ? box.bottom + GAP : Math.max(16, box.top - GAP - 190),
        arrow: side === "bottom" ? "top" : "bottom",
    };
}

export default function GuideTour({ steps, open, onClose, onFinish, title = "Инструкция" }) {
    const [index, setIndex] = useState(0);
    const [box, setBox] = useState(null);
    const [ready, setReady] = useState(false);
    const step = steps[Math.min(index, steps.length - 1)] || null;
    const selRef = useRef("");
    const frameRef = useRef("");
    const nthRef = useRef(0);
    const matchRef = useRef("");
    selRef.current = step?.sel || "";
    frameRef.current = step?.frame || "";
    nthRef.current = step?.nth || 0;
    matchRef.current = step?.match || "";

    const finish = useCallback(() => {
        onFinish?.();
        onClose?.();
    }, [onFinish, onClose]);

    const advance = useCallback(() => {
        setIndex((current) => {
            if (current + 1 >= steps.length) {
                // Завершение откладывается на следующий тик: вызывать onFinish внутри
                // updater'а нельзя, React выполняет его дважды в строгом режиме, и урок
                // засчитывался бы дважды.
                window.setTimeout(finish, 0);
                return current;
            }
            return current + 1;
        });
    }, [steps.length, finish]);

    // Рамка цели пересчитывается на прокрутке, ресайзе и просто по таймеру: страница под
    // туром живая, панели раскрываются, список сессий приезжает с сервера. Опрос дешевле
    // ResizeObserver на произвольном селекторе, который может ещё не существовать.
    useEffect(() => {
        if (!open) return undefined;
        const measure = () => {
            const next = rectOf(selRef.current, frameRef.current, nthRef.current, matchRef.current);
            setBox(next);
            setReady(!selRef.current || Boolean(next));
        };
        measure();
        const timer = window.setInterval(measure, POLL_MS);
        window.addEventListener("scroll", measure, true);
        window.addEventListener("resize", measure);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("scroll", measure, true);
            window.removeEventListener("resize", measure);
        };
    }, [open, index]);

    // Цель уводит в кадр сама: инструкция, которая просит нажать кнопку под сгибом,
    // хуже отсутствия инструкции.
    useEffect(() => {
        if (!open || !step?.sel) return;
        const scope = docOf(step.frame);
        pick(scope, step.sel, step.nth, step.match)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, [open, index, step?.sel, step?.frame, step?.nth, step?.match]);

    // Ожидание клика по цели. Слушаем на всплытии в document, а не на самом узле: узел
    // может смениться между рендерами (список перерисовался), и подписка на старый
    // элемент молча перестала бы срабатывать.
    useEffect(() => {
        if (!open || !step) return undefined;
        const wait = step.wait ?? (step.sel ? "click" : "next");
        if (wait !== "click") return undefined;
        // Слушаем в том документе, где живёт цель: клик внутри встроенной страницы
        // наружу не всплывает, и подписка на своё окно его не увидит.
        const scope = docOf(step.frame);
        if (!scope) return undefined;
        const onClick = (event) => {
            const node = pick(scope, step.sel, step.nth, step.match);
            if (node && (node === event.target || node.contains(event.target))) window.setTimeout(advance, 350);
        };
        scope.addEventListener("click", onClick, true);
        return () => scope.removeEventListener("click", onClick, true);
    }, [open, step, advance]);

    // Ожидание условия: строка появилась, счётчик вырос, ссылка скопирована.
    useEffect(() => {
        if (!open || typeof step?.wait !== "function") return undefined;
        const timer = window.setInterval(() => {
            if (step.wait()) advance();
        }, POLL_MS);
        return () => window.clearInterval(timer);
    }, [open, step, advance]);

    // Необязательный шаг сам уступает дорогу, если его цели на экране нет.
    //
    // Переход берётся из ref, а не из зависимостей: страница под туром живая — в консоли
    // раз в секунду тикает таймер сессии, — и onClose приходит новой функцией на каждом
    // рендере. Через зависимости таймаут пересоздавался бы ежесекундно и не доживал бы
    // до срабатывания: шаг про кнопку, которой на карте нет, висел бы вечно.
    const advanceRef = useRef(advance);
    advanceRef.current = advance;

    // Куда листают. Пропуск идёт в ту же сторону: иначе шаг, которого на этом экране нет,
    // при движении назад отбрасывал бы обратно вперёд — и до первого шага не добраться.
    const dirRef = useRef(1);

    useEffect(() => {
        if (!open || !step?.optional) return undefined;
        const { sel, frame, nth, match } = step;
        const timer = window.setTimeout(() => {
            if (rectOf(sel, frame, nth, match)) return;
            if (dirRef.current < 0) setIndex((current) => Math.max(0, current - 1));
            else advanceRef.current();
        }, OPTIONAL_MS);
        return () => window.clearTimeout(timer);
    }, [open, index, step]);

    // Клавиатура: стрелки листают, Esc закрывает.
    //
    // Вперёд пускаем только там, где шаг ничего не требует. Шаг, который ждёт действия
    // — создать сессию, скопировать ссылку, — стрелкой не проматывается: иначе инструкция
    // снова превращается в слайды, а весь её смысл в том, что мастер делает, а не смотрит.
    // Назад пускаем всегда: перечитать уже пройденное ничему не мешает.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => {
            if (event.key === "Escape") {
                onClose?.();
                return;
            }
            // В поле ввода стрелки двигают курсор — забирать их у пользователя нельзя.
            const tag = event.target?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;

            if (event.key === "ArrowLeft") {
                event.preventDefault();
                dirRef.current = -1;
                setIndex((current) => Math.max(0, current - 1));
                return;
            }
            if (event.key === "ArrowRight") {
                const blocking = step && (step.wait ?? (step.sel ? "click" : "next")) !== "next";
                if (blocking) return;
                event.preventDefault();
                dirRef.current = 1;
                advance();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose, step, advance]);

    useEffect(() => {
        if (open) setIndex(0);
    }, [open]);

    if (!open || !step) return null;

    const card = placeCard(box, step.place);
    const waiting = step.wait ?? (step.sel ? "click" : "next");
    const hole = box
        ? {
              left: box.left - PAD,
              top: box.top - PAD,
              width: box.width + PAD * 2,
              height: box.height + PAD * 2,
          }
        : null;

    return (
        <div className="tour" role="dialog" aria-label={title}>
            {/* Затемнение с дыркой. Дырка — не вырез в маске, а элемент с гигантской
                тенью наружу: так подсветка не перехватывает клик по цели, а именно
                клик и засчитывает шаг. */}
            {hole ? (
                <div className="hole" style={hole} />
            ) : (
                <div className="veil" />
            )}

            <div className="card" style={{ left: card.left, top: card.top }}>
                {card.arrow ? <span className={`arrow ${card.arrow}`} /> : null}

                <div className="head">
                    <span className="count">{`${index + 1} / ${steps.length}`}</span>
                    <button type="button" className="close" onClick={onClose} aria-label="Закрыть инструкцию">
                        ✕
                    </button>
                </div>

                <h3>{step.title}</h3>
                <p>{step.text}</p>

                {!ready && step.sel ? <span className="hint">Ждём, пока это появится на экране…</span> : null}

                <div className="foot">
                    {waiting === "next" ? (
                        <button
                            type="button"
                            className="go"
                            onClick={() => {
                                dirRef.current = 1;
                                advance();
                            }}>
                            {index + 1 >= steps.length ? "Готово" : "Дальше"}
                        </button>
                    ) : (
                        <span className="await">{waiting === "click" ? "Нажмите подсвеченное" : "Сделайте это на странице"}</span>
                    )}
                    {index > 0 ? (
                        <button
                            type="button"
                            className="back"
                            onClick={() => {
                                dirRef.current = -1;
                                setIndex((c) => Math.max(0, c - 1));
                            }}>
                            Назад
                        </button>
                    ) : null}
                </div>
                <span className="keys">← → листать, Esc закрыть</span>
            </div>

            <style jsx>{`
                .tour {
                    position: fixed;
                    inset: 0;
                    z-index: 9000;
                    pointer-events: none;
                }
                .veil,
                .hole {
                    position: fixed;
                    pointer-events: none;
                }
                .veil {
                    inset: 0;
                    background: rgba(10, 14, 18, 0.62);
                }
                .hole {
                    border-radius: 12px;
                    box-shadow: 0 0 0 9999px rgba(10, 14, 18, 0.62);
                    outline: 2px solid #ffd166;
                    outline-offset: 0;
                    transition: left 0.18s ease, top 0.18s ease, width 0.18s ease, height 0.18s ease;
                }
                .card {
                    position: fixed;
                    width: ${CARD_W}px;
                    pointer-events: auto;
                    background: #fff;
                    color: #101820;
                    border-radius: 12px;
                    box-shadow: 0 18px 48px rgba(8, 12, 16, 0.38);
                    padding: 14px 16px 12px;
                }
                .arrow {
                    position: absolute;
                    width: 12px;
                    height: 12px;
                    background: #fff;
                    transform: rotate(45deg);
                }
                .arrow.top {
                    top: -6px;
                    left: 50%;
                    margin-left: -6px;
                }
                .arrow.bottom {
                    bottom: -6px;
                    left: 50%;
                    margin-left: -6px;
                }
                .arrow.left {
                    left: -6px;
                    top: 28px;
                }
                .arrow.right {
                    right: -6px;
                    top: 28px;
                }
                .head {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .count {
                    font-size: 12px;
                    font-weight: 800;
                    color: #627178;
                    white-space: nowrap;
                }
                /* Размеры заданы явно, включая width и box-shadow: тур живёт поверх чужих
                   страниц, а у портала глобальный стиль тега button тянет кнопку во всю
                   строку и подкладывает белую плашку. Крестик от этого превращался
                   в широкую пилюлю поперёк карточки. */
                .close {
                    flex: none;
                    width: 28px;
                    height: 28px;
                    min-height: 0;
                    padding: 0;
                    border: 0;
                    border-radius: 8px;
                    background: transparent;
                    box-shadow: none;
                    color: #8a969c;
                    font-size: 15px;
                    line-height: 1;
                    cursor: pointer;
                }
                .close:hover {
                    background: #f1f4f6;
                    color: #33424a;
                }
                h3 {
                    margin: 6px 0 4px;
                    font-size: 17px;
                    line-height: 1.25;
                }
                p {
                    margin: 0;
                    font-size: 14px;
                    line-height: 1.45;
                    color: #33424a;
                }
                .hint {
                    display: block;
                    margin-top: 8px;
                    font-size: 12px;
                    color: #8a969c;
                }
                .foot {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-top: 12px;
                }
                .go {
                    width: auto;
                    min-height: 36px;
                    border: 1px solid #152022;
                    border-radius: 8px;
                    background: #152022;
                    box-shadow: none;
                    color: #fff;
                    padding: 0 14px;
                    font-weight: 800;
                    cursor: pointer;
                }
                .await {
                    font-size: 13px;
                    font-weight: 700;
                    color: #b06d00;
                }
                .keys {
                    display: block;
                    margin-top: 8px;
                    font-size: 11px;
                    color: #a3adb3;
                }
                .back {
                    width: auto;
                    min-height: 0;
                    margin-left: auto;
                    padding: 0 4px;
                    border: 0;
                    border-radius: 8px;
                    background: transparent;
                    box-shadow: none;
                    color: #627178;
                    font-size: 13px;
                    cursor: pointer;
                }
                @media (prefers-reduced-motion: reduce) {
                    .hole {
                        transition: none;
                    }
                }
            `}</style>
        </div>
    );
}
