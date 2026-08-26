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

export default function HowTo({ screen = "index", label = "Как это работает" }) {
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
            <button type="button" className="howto" onClick={start}>
                <span aria-hidden="true">?</span>
                <span className="howto-text">{label}</span>
            </button>

            <GuideTour steps={steps} open={open && steps.length > 0} onClose={() => setOpen(false)} title={label} />

            <style jsx>{`
                /* Высота и радиус — как у соседних кнопок шапки: разбор должен читаться
                   как часть панели инструментов, а не как баннер поверх неё. */
                .howto {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    width: auto;
                    height: 36px;
                    padding: 0 14px;
                    border: 1px solid #b45309;
                    border-radius: 999px;
                    background: #fff8ef;
                    box-shadow: none;
                    color: #8a4708;
                    font-size: 13px;
                    font-weight: 800;
                    white-space: nowrap;
                    cursor: pointer;
                }
                .howto:hover {
                    background: #fff2e0;
                }
                /* На узком экране остаётся знак вопроса: шапка тесная, и подпись выдавливала
                   бы из неё номер стола и роль. */
                @media (max-width: 900px) {
                    .howto {
                        width: 36px;
                        padding: 0;
                        justify-content: center;
                        font-size: 16px;
                    }
                    .howto-text {
                        display: none;
                    }
                }
            `}</style>
        </>
    );
}
