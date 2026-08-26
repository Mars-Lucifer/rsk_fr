"use client";

import { useState } from "react";

import GuideTour from "./GuideTour";
import { MAYAK_HOWTO } from "./howToTour.mjs";

// Постоянная кнопка «Как это работает» на странице МАЯК-ОКО.
//
// Она видна всегда и всем, кто открыл ссылку: участнику на занятии, мастеру на пробе,
// тому, кто догоняет группу дома. Инструкция идёт по его собственному экрану и по его
// текущему заданию — не по скриншотам и не по чужой демонстрации.
//
// Компонент самодостаточен: кнопка, подсказки и сценарий внутри. Странице-хозяйке
// достаточно одной строки, поэтому направление гайда не расползается по чужим файлам.
export default function HowTo({ steps = MAYAK_HOWTO, label = "Как это работает" }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button type="button" className="howto" onClick={() => setOpen(true)}>
                <span aria-hidden="true">?</span>
                <span className="howto-text">{label}</span>
            </button>

            <GuideTour steps={steps} open={open} onClose={() => setOpen(false)} title={label} />

            <style jsx>{`
                /* Кнопка висит над страницей справа снизу: в потоке ей места нет — экран
                   тренажёра занят полями и промтом, а подсказка нужна с любого места
                   страницы, включая прокрученный низ. */
                .howto {
                    position: fixed;
                    right: 18px;
                    bottom: 18px;
                    z-index: 7000;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    width: auto;
                    min-height: 42px;
                    padding: 0 16px;
                    border: 1px solid #b45309;
                    border-radius: 999px;
                    background: #fff8ef;
                    box-shadow: 0 10px 26px rgba(8, 12, 16, 0.16);
                    color: #8a4708;
                    font-size: 14px;
                    font-weight: 800;
                    cursor: pointer;
                }
                .howto:hover {
                    background: #fff2e0;
                }
                /* На узком экране остаётся только знак вопроса: подпись в 150 пикселей
                   перекрывала бы поля ввода, ради которых человек сюда и пришёл. */
                @media (max-width: 640px) {
                    .howto {
                        right: 12px;
                        bottom: 12px;
                        padding: 0;
                        width: 44px;
                        height: 44px;
                        justify-content: center;
                        font-size: 18px;
                    }
                    .howto-text {
                        display: none;
                    }
                }
            `}</style>
        </>
    );
}
