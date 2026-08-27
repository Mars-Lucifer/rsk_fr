"use client";

import { useCallback, useState } from "react";

import Button from "@/components/ui/Button";

import GuideTour from "./GuideTour";
import { INDEX_HOWTO, buildTrainerHowTo, pickSampleTask } from "./howToTour.mjs";

// Кнопка «Как это работает» в шапке МАЯК-ОКО.
//
// Она видна всем, кто открыл ссылку: участнику на занятии, мастеру на пробе, тому, кто
// догоняет группу дома. Разбор идёт по его собственному экрану — не по скриншотам и не
// по чужой демонстрации.
//
// Стоит в шапке рядом с заданиями и историей, а не плавает над страницей: разбор — такой
// же инструмент экрана, как они, и место ему в одном ряду.
//
// tasks / onPickTask / bounds приходят из тренажёра: колода уже загружена там, и второй
// раз тянуть её с сервера незачем. По ним разбор сам выбирает карту с материалами
// и сам её открывает — участнику не приходится угадывать номер, на котором кнопки
// «Инструкция», «Доп.материал» и глазик вообще есть.
export default function HowTo({
    screen = "index",
    label = "Как это работает",
    hint = "Разбор экрана по шагам",
    tasks = null,
    onPickTask = null,
    minIndex = 0,
    maxIndex = Number.MAX_SAFE_INTEGER,
}) {
    const [open, setOpen] = useState(false);
    const [steps, setSteps] = useState([]);

    const start = useCallback(() => {
        if (screen === "trainer") {
            const sample = pickSampleTask(tasks, { from: minIndex, to: maxIndex });
            if (sample) onPickTask?.(sample.index);
            setSteps(buildTrainerHowTo(sample));
        } else {
            setSteps(INDEX_HOWTO);
        }
        setOpen(true);
    }, [screen, tasks, onPickTask, minIndex, maxIndex]);

    return (
        <>
            {/* Знак вопроса и ничего больше: подпись «Как это работает» тянула на себя
                внимание сильнее, чем задания и завершение сессии, — а это подсказка,
                не главное действие экрана. Что за кнопка, объясняет всплывающая подпись.
                Размер берётся у штатной icon-кнопки: своя разметка давала квадрат
                на 36 пикселей рядом с соседями на 44. */}
            <Button icon type="button" className="howto" onClick={start} title={hint} aria-label={label}>
                <span className="howto-glyph">?</span>
            </Button>

            <GuideTour steps={steps} open={open && steps.length > 0} onClose={() => setOpen(false)} title={label} />

            <style jsx global>{`
                button.howto .howto-glyph {
                    font-size: 1rem;
                    font-weight: 800;
                    line-height: 1;
                    /* Соседи в этом ряду — тёмные иконки на светлой плашке. Знак,
                       унаследовавший цвет кнопки, выходил почти белым по белому. */
                    color: #33424a;
                }
            `}</style>
        </>
    );
}
