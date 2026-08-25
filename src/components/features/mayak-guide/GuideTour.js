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

function rectOf(sel) {
    if (!sel) return null;
    const node = typeof document === "undefined" ? null : document.querySelector(sel);
    if (!node) return null;
    const box = node.getBoundingClientRect();
    // Скрытый элемент даёт нулевую рамку в левом верхнем углу. Подсветить её значит
    // вырезать дырку в пустом месте — для шага это то же самое, что цели ещё нет.
    if (box.width < 1 && box.height < 1) return null;
    return box;
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
    selRef.current = step?.sel || "";

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
            const next = rectOf(selRef.current);
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
        const node = document.querySelector(step.sel);
        node?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, [open, index, step?.sel]);

    // Ожидание клика по цели. Слушаем на всплытии в document, а не на самом узле: узел
    // может смениться между рендерами (список перерисовался), и подписка на старый
    // элемент молча перестала бы срабатывать.
    useEffect(() => {
        if (!open || !step) return undefined;
        const wait = step.wait ?? (step.sel ? "click" : "next");
        if (wait !== "click") return undefined;
        const onClick = (event) => {
            const node = document.querySelector(step.sel);
            if (node && (node === event.target || node.contains(event.target))) window.setTimeout(advance, 350);
        };
        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
    }, [open, step, advance]);

    // Ожидание условия: строка появилась, счётчик вырос, ссылка скопирована.
    useEffect(() => {
        if (!open || typeof step?.wait !== "function") return undefined;
        const timer = window.setInterval(() => {
            if (step.wait()) advance();
        }, POLL_MS);
        return () => window.clearInterval(timer);
    }, [open, step, advance]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => {
            if (event.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

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
                        <button type="button" className="go" onClick={advance}>
                            {index + 1 >= steps.length ? "Готово" : "Дальше"}
                        </button>
                    ) : (
                        <span className="await">{waiting === "click" ? "Нажмите подсвеченное" : "Сделайте это на странице"}</span>
                    )}
                    {index > 0 ? (
                        <button type="button" className="back" onClick={() => setIndex((c) => Math.max(0, c - 1))}>
                            Назад
                        </button>
                    ) : null}
                </div>
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
