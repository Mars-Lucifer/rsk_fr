"use client";

import { useCallback, useState } from "react";

import GuideTour from "./GuideTour";
import { INDEX_HOWTO, buildTrainerHowTo, pickSampleTask, rangeOf } from "./howToTour.mjs";

// Кнопка «Как это работает» в шапке МАЯК-ОКО.
//
// Она видна всем, кто открыл ссылку: участнику на занятии, мастеру на пробе, тому, кто
// догоняет группу дома. Разбор идёт по его собственному экрану — не по скриншотам и не
// по чужой демонстрации.
//
// Стоит в шапке рядом с заданиями и историей, а не плавает над страницей: разбор — такой
// же инструмент экрана, как они, и место ему в одном ряду.

// Задание для разбора берётся из настоящей колоды. Номер текущего задания на экране
// даёт раздел, раздел — список заданий, из него выбирается карта с материалами.
// Если колода не отвечает (или её нет), разбор идёт без номера — шаги от этого не
// ломаются, только текст становится общим.
async function findSample() {
    if (typeof document === "undefined") return null;
    const input = document.querySelector(".input-wrapper.text-center input");
    const current = Number(String(input?.value || "").trim());
    if (!Number.isFinite(current) || current <= 0) return null;

    try {
        const res = await fetch(`/api/mayak/content-bundle?sectionId=${encodeURIComponent(rangeOf(current))}`);
        const payload = await res.json().catch(() => ({}));
        return pickSampleTask(payload?.data?.tasks);
    } catch {
        return null;
    }
}

export default function HowTo({ screen = "index", label = "Как это работает", hint = "Разбор экрана по шагам" }) {
    const [open, setOpen] = useState(false);
    const [steps, setSteps] = useState([]);

    const start = useCallback(async () => {
        if (screen === "trainer") {
            const sample = await findSample();
            setSteps(buildTrainerHowTo(sample));
        } else {
            setSteps(INDEX_HOWTO);
        }
        setOpen(true);
    }, [screen]);

    return (
        <>
            <button type="button" className="howto" onClick={start} title={hint} aria-label={label}>
                ?
            </button>

            <GuideTour steps={steps} open={open && steps.length > 0} onClose={() => setOpen(false)} title={label} />

            <style jsx>{`
                /* Знак вопроса в квадрате и ничего больше. Подпись «Как это работает»
                   тянула на себя внимание сильнее, чем задания и завершение сессии, —
                   а это подсказка, а не главное действие экрана. Что за кнопка,
                   объясняет всплывающая подпись при наведении.
                   Размер и радиус — как у соседних иконок шапки. */
                .howto {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    padding: 0;
                    border: 1px solid #dbe3e9;
                    border-radius: 10px;
                    background: #fff;
                    box-shadow: none;
                    color: #8a969c;
                    font-size: 15px;
                    font-weight: 800;
                    line-height: 1;
                    cursor: pointer;
                    transition:
                        border-color 0.15s ease,
                        color 0.15s ease;
                }
                .howto:hover {
                    border-color: #b9c4cc;
                    color: #33424a;
                }
            `}</style>
        </>
    );
}
