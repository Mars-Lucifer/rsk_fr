"use client";

import { useMemo, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";

import { STATIC_MAYAK_DATA } from "../../../../data/mayakDataConst";
import { buildMayakPromptDraft } from "@/components/features/tools-2/utils/buildMayakPromptDraft";
import { createEmptyMayakFields } from "@/components/features/tools-2/utils/mayakPromptState";
import { pickRandomMayakFieldValue } from "@/components/features/tools-2/utils/mayakBufferStorage";
import { CARD_FIELD_BY_CODE } from "./promptCard.mjs";

import RandomIcon from "@/assets/general/random.svg";

// Планшет МАЯК-ОКО: та же форма, что в тренажёре, но это предмет на столе — тёмное стекло,
// которое поднимается перед камерой, когда мастер садится за место игрока.
//
// Из тренажёра берётся только чистая логика: список полей, сборка промпта и «кубик».
// Разметка поля своя — MayakField из tools-2 жёстко завязан на светлую тему портала и
// тащит кнопки буфера, которого здесь нет.
//
// Переключателя типа контента здесь нет намеренно: раздел выбирается картой в подставке
// на столе, а не списком в панели. Две точки выбора одного и того же расходились бы.
//
// Стили объявлены как `jsx global` под классом .mayakoko, а не обычным scoped-блоком:
// глобальные стили портала (src/styles/spacing.css, colour.css) задают
// button { width: 100%; display: flex; background: black }, и каждую кнопку панели нужно
// перебивать явно. Менять сами глобальные правила нельзя — на них завязано около 380
// кнопок портала.
//
// Состояние живёт в памяти: ни сети, ни сессии, ни оценки. Закрыл — забылось.

const FIELDS = STATIC_MAYAK_DATA.fieldsList;
// Первые четыре поля — цели, остальные — условия. Ровно как в тренажёре.
const GOAL_COUNT = 4;
// «Кубик» берёт варианты из набора своего типа контента. Тип теперь задаёт карта на столе,
// а до её выбора работает первый — тот же, что открыт в тренажёре по умолчанию.
const DEFAULT_TYPE = STATIC_MAYAK_DATA.defaultTypes[0].key;

export default function MayakokoPanel({ onClose, onPickFromCard, picked, marked = true, type = DEFAULT_TYPE, embedded = false }) {
    const [fields, setFields] = useState(createEmptyMayakFields);
    const [copied, setCopied] = useState(false);

    const prompt = useMemo(() => buildMayakPromptDraft(fields)?.finalPrompt || null, [fields]);

    const setField = (code, value) => {
        setFields((prev) => ({ ...prev, [code]: value }));
        setCopied(false);
    };

    const rollField = (code) => {
        const value = pickRandomMayakFieldValue({ code, type, contentTypeOptions: STATIC_MAYAK_DATA.contentTypeOptions });
        if (value) setField(code, value);
    };

    const reset = () => {
        setFields(createEmptyMayakFields());
        setCopied(false);
    };

    const copy = async () => {
        if (!prompt) return;
        await navigator.clipboard.writeText(prompt);
        setCopied(true);
    };

    // «Взять с карты»: значение поля вычитывается из стоящей рядом карты задания, а на
    // самой карте подсвечивается фрагмент, откуда оно взято. Ровно то, что за столом
    // делает участник, разбирая задание по семи полям.
    const takeFromCard = (code) => {
        const found = CARD_FIELD_BY_CODE[code];
        if (!found) return;
        setField(code, found.value);
        onPickFromCard?.(code);
    };

    const row = (field) => (
        <label className={picked === field.code ? "mk-row mk-picked" : "mk-row"} key={field.code}>
            <span className="mk-letter">{field.label.charAt(0)}</span>
            <span className="mk-input">
                <TextareaAutosize
                    className="mk-area"
                    minRows={1}
                    placeholder={field.label.split(" - ")[1]}
                    value={fields[field.code]}
                    onChange={(event) => setField(field.code, event.target.value)}
                />
                <button
                    type="button"
                    className="mk-take"
                    onClick={() => takeFromCard(field.code)}
                    disabled={!marked}
                    title={marked ? "Взять с карты задания" : "У этого раздела ещё нет разбора карты"}>
                    ↰
                </button>
                <button type="button" className="mk-dice" onClick={() => rollField(field.code)} title="Случайный вариант">
                    <RandomIcon />
                </button>
            </span>
        </label>
    );

    return (
        <aside className={embedded ? "mayakoko mk-screen" : "mayakoko"}>
            <div className="mk-body">

                <div className="mk-head">
                    <p className="mk-group">Цели и целевая направленность</p>
                    <span className="mk-tools">
                        <button type="button" className="mk-tool" onClick={reset} title="Сбросить все поля">
                            ⟳
                        </button>
                        <button type="button" className="mk-tool" onClick={onClose} title="Закрыть (Esc)">
                            ✕
                        </button>
                    </span>
                </div>
                {FIELDS.slice(0, GOAL_COUNT).map(row)}

                <p className="mk-group mk-second">Условия реализации и параметры оформления</p>
                {FIELDS.slice(GOAL_COUNT).map(row)}
            </div>

            {/* Блок промпта стоит всегда, даже пустой: это часть формы, и появляющийся
                из ниоткуда блок дёргает всю раскладку планшета. */}
            <div className="mk-result">
                <p className="mk-group">Ваш промпт</p>
                <div className="mk-prompt">{prompt || <span className="mk-empty">Заполните семь полей — промпт соберётся здесь</span>}</div>
                <button type="button" className="mk-copy" onClick={copy} disabled={!prompt}>
                    {copied ? "Скопировано" : "Создать запрос"}
                </button>
            </div>

            <style jsx global>{`
                .mayakoko {
                    position: fixed;
                    /* Сверху над панелью висит «Ко всему столу», снизу — подпись зоны:
                       планшет обязан оставить им место, а не наезжать. */
                    left: 2.5vw;
                    /* Сверху над панелью висит «Ко всему столу», снизу — подпись зоны:
                       планшет обязан оставить им место, а не наезжать. Отсюда и верхняя
                       отметка, и нижняя граница — обе считаны по этим двум накладкам.
                       Планшет умещается в окно целиком: собранный промпт — часть той же
                       формы, и он не должен ни выдавливать поля за нижнюю кромку, ни
                       заставлять их скроллиться. Отсюда компактные отступы ниже и гибкий
                       блок промпта: он забирает остаток высоты и отдаёт его полям, когда
                       те разрастаются. */
                    top: 64px;
                    width: clamp(360px, 40vw, 640px);
                    max-height: calc(100vh - 172px);
                    display: flex;
                    flex-direction: column;
                    padding: 16px 10px 16px 22px;
                    border-radius: 22px;
                    /* Тёмное стекло: планшет — часть стола, а не лист бумаги поверх него. */
                    background: linear-gradient(150deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.02) 55%), rgba(22, 18, 15, 0.5);
                    backdrop-filter: blur(18px) saturate(140%);
                    -webkit-backdrop-filter: blur(18px) saturate(140%);
                    box-shadow: 0 20px 48px rgba(6, 4, 2, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.14);
                    color: #f4efe6;
                    font-size: 14px;
                    z-index: 5;
                    /* Подъём с плоскости стола уже сыгран самим планшетом в сцене — здесь
                       остаётся только подхват последних градусов. Полный подъём от
                       rotateX(76deg) играл движение второй раз: планшет вставал, исчезал,
                       и на его месте с изнанки разворачивалась «другая» плашка. */
                    transform-origin: 50% 100%;
                    animation: mk-settle 0.26s cubic-bezier(0.22, 0.8, 0.3, 1);
                }

                /* Форма на экране ноутбука. Это не «панель поменьше»: экран ноутбука
                   альбомный, а сама форма свёрстана в колонку, и на альбомном поле
                   собранный промпт уезжал бы под нижнюю кромку матрицы. Поэтому здесь
                   поля и промпт стоят рядом — те же два блока, что и в колонке, только
                   в строку.

                   Ни стекла, ни тени, ни размытия фона: под формой не стол, а матрица.
                   Backdrop-filter на CSS3D-слое к тому же ничего не размывает — сцена
                   рисуется в WebGL, за DOM-слоем для него пусто. */
                .mayakoko.mk-screen {
                    position: static;
                    width: 100%;
                    height: 100%;
                    max-height: none;
                    flex-direction: row;
                    gap: 16px;
                    padding: 18px 20px;
                    border-radius: 4px;
                    /* Экран светлый — тот же, что у формы в тренажёре. Тёмное стекло было
                       уместно, пока форма висела над столом и должна была читаться его
                       частью. На матрице ноутбука она обязана выглядеть тем же рабочим
                       окном, которое участник видит в браузере, иначе это две разные
                       формы: одна для тренировки, другая для игры. */
                    background: #f7f9fb;
                    color: #1d2126;
                    backdrop-filter: none;
                    -webkit-backdrop-filter: none;
                    box-shadow: none;
                    /* Подъём уже сыгран самой крышкой: форма включается на вставшем
                       экране, и второе движение читалось бы как вторая вещь. */
                    animation: mk-wake 0.3s ease-out;
                }

                /* Светлая тема экрана: заголовки, буквы полей, рамки и плейсхолдеры
                   повторяют форму тренажёра. Правила идут после базовых тёмных, поэтому
                   перебивают их без !important. */
                .mayakoko.mk-screen .mk-group {
                    color: #1d2126;
                    font-size: 15px;
                }

                .mayakoko.mk-screen .mk-letter {
                    color: #9aa3ad;
                    font-weight: 600;
                }

                .mayakoko.mk-screen .mk-input {
                    background: #ffffff;
                    border-color: #e3e8ee;
                }

                .mayakoko.mk-screen .mk-input:focus-within {
                    background: #ffffff;
                    border-color: #b8c2cc;
                }

                .mayakoko.mk-screen .mk-area {
                    color: #1d2126;
                }

                .mayakoko.mk-screen .mk-area::placeholder {
                    color: #9aa3ad;
                }

                .mayakoko.mk-screen .mk-tool {
                    color: #6b7480;
                }

                .mayakoko.mk-screen .mk-tool:hover {
                    background: #eaeef3;
                    color: #1d2126;
                }

                .mayakoko.mk-screen .mk-dice,
                .mayakoko.mk-screen .mk-take {
                    color: #4a5560;
                }

                .mayakoko.mk-screen .mk-take {
                    color: #1f9ab5;
                }

                .mayakoko.mk-screen .mk-dice:hover,
                .mayakoko.mk-screen .mk-take:hover:not(:disabled) {
                    background: #eaeef3;
                }

                .mayakoko.mk-screen .mk-picked .mk-input {
                    border-color: #7fcede;
                    background: #eaf7fa;
                }

                .mayakoko.mk-screen .mk-prompt {
                    background: #ffffff;
                    border-color: #e3e8ee;
                    color: #1d2126;
                }

                .mayakoko.mk-screen .mk-empty {
                    color: #9aa3ad;
                }

                .mayakoko.mk-screen .mk-copy {
                    background: #eef2f6;
                    border-color: #dbe2e9;
                    color: #1d2126;
                }

                .mayakoko.mk-screen .mk-copy:hover {
                    background: #e3e9ef;
                }

                .mayakoko.mk-screen::before {
                    display: none;
                }

                @keyframes mk-wake {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                .mayakoko.mk-screen .mk-body {
                    flex: 1 1 auto;
                    padding-right: 6px;
                }

                /* Промпт занимает правую треть матрицы: черта между блоками теперь
                   вертикальная, иначе два блока сливаются в один список. */
                .mayakoko.mk-screen .mk-result {
                    flex: 0 0 34%;
                    margin-top: 0;
                    padding: 0 0 0 16px;
                    border-top: 0;
                    border-left: 1px solid #e3e8ee;
                }

                .mayakoko::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    padding: 1px;
                    border-radius: inherit;
                    background: linear-gradient(145deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.06) 45%, rgba(79, 195, 217, 0.28));
                    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
                    mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
                    -webkit-mask-composite: xor;
                    mask-composite: exclude;
                    pointer-events: none;
                }

                @keyframes mk-settle {
                    from {
                        opacity: 0;
                        transform: perspective(1400px) rotateX(9deg) translateY(6px);
                    }
                    to {
                        opacity: 1;
                        transform: perspective(1400px) rotateX(0deg) translateY(0);
                    }
                }

                /* Сброс поверх глобальных стилей портала: без него каждая кнопка панели
                   разворачивается в чёрную плашку во всю ширину строки. */
                .mayakoko button {
                    width: auto;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    flex: 0 0 auto;
                    gap: 0;
                    padding: 0;
                    border: 0;
                    border-radius: 8px;
                    background: transparent;
                    color: inherit;
                    font: inherit;
                    line-height: 1;
                    box-shadow: none;
                    cursor: pointer;
                }

                /* Поля занимают ровно столько, сколько им нужно, и не листаются: растёт
                   строка — растёт блок, а высоту он забирает у промпта, который под ним. */
                .mayakoko .mk-body {
                    flex: 0 1 auto;
                    min-height: 0;
                    padding-right: 14px;
                    overflow-y: auto;
                    scrollbar-width: none;
                }

                .mayakoko .mk-body::-webkit-scrollbar {
                    display: none;
                }

                /* Кнопки стоят в одной строке с первым заголовком: своей строкой они
                   съедали высоту, которой не хватает полям на невысоком окне. */
                .mayakoko .mk-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 8px;
                }

                .mayakoko .mk-head .mk-group {
                    margin: 0;
                }

                .mayakoko .mk-tools {
                    display: flex;
                    gap: 4px;
                }

                .mayakoko .mk-tool {
                    width: 28px;
                    height: 28px;
                    font-size: 14px;
                    color: rgba(244, 239, 230, 0.55);
                }

                .mayakoko .mk-tool:hover {
                    background: rgba(255, 255, 255, 0.12);
                    color: #f4efe6;
                }

                .mayakoko .mk-group {
                    margin: 0 0 8px;
                    font-size: 13px;
                    color: rgba(244, 239, 230, 0.5);
                }

                .mayakoko .mk-second {
                    margin-top: 14px;
                }

                .mayakoko .mk-row {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    margin-bottom: 6px;
                    cursor: text;
                }

                .mayakoko .mk-letter {
                    width: 16px;
                    padding-top: 7px;
                    text-align: center;
                    font-size: 15px;
                    font-weight: 700;
                    color: rgba(244, 239, 230, 0.6);
                }

                .mayakoko .mk-input {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    padding: 7px 11px;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    transition: border-color 0.18s ease, background 0.18s ease;
                }

                .mayakoko .mk-input:focus-within {
                    background: rgba(255, 255, 255, 0.09);
                    border-color: rgba(255, 255, 255, 0.3);
                }

                .mayakoko .mk-area {
                    flex: 1;
                    min-width: 0;
                    resize: none;
                    border: 0;
                    outline: none;
                    background: transparent;
                    color: #f4efe6;
                    font: inherit;
                    font-size: 13.5px;
                    line-height: 1.5;
                    overflow: hidden;
                }

                .mayakoko .mk-area::placeholder {
                    color: rgba(244, 239, 230, 0.35);
                }

                .mayakoko .mk-dice,
                .mayakoko .mk-take {
                    width: 22px;
                    height: 22px;
                    margin-top: 1px;
                    font-size: 13px;
                    color: #ffffff;
                    opacity: 0;
                    transition: opacity 0.16s ease;
                }

                .mayakoko .mk-take {
                    color: #4fc3d9;
                }

                .mayakoko .mk-dice svg {
                    width: 15px;
                    height: 15px;
                }

                .mayakoko .mk-dice:hover,
                .mayakoko .mk-take:hover:not(:disabled) {
                    background: rgba(255, 255, 255, 0.12);
                }

                .mayakoko .mk-take:disabled {
                    color: rgba(244, 239, 230, 0.2);
                    cursor: default;
                }

                .mayakoko .mk-row:hover .mk-dice,
                .mayakoko .mk-row:hover .mk-take,
                .mayakoko .mk-input:focus-within .mk-dice,
                .mayakoko .mk-input:focus-within .mk-take {
                    opacity: 1;
                }

                /* Строка, чей фрагмент сейчас подсвечен на карте: связь «поле ↔ кусок
                   текста» читается с обеих сторон одним и тем же цветом. */
                .mayakoko .mk-picked .mk-input {
                    border-color: rgba(79, 195, 217, 0.55);
                    background: rgba(79, 195, 217, 0.1);
                }

                .mayakoko .mk-picked .mk-take {
                    opacity: 1;
                }

                /* Блок промпта забирает всю оставшуюся высоту панели: это самое длинное,
                   что здесь показывают, и пустой зазор над кнопкой копирования — потерянные
                   строки. Заполнились поля — блок сам ужимается до своего минимума. */
                .mayakoko .mk-result {
                    flex: 1 1 auto;
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                    margin-top: 10px;
                    padding: 10px 14px 0 0;
                    border-top: 1px solid rgba(255, 255, 255, 0.12);
                }

                .mayakoko .mk-prompt {
                    flex: 1 1 auto;
                    margin: 0 0 8px;
                    min-height: 52px;
                    padding: 10px 12px;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    overflow-y: auto;
                    font-size: 13px;
                    line-height: 1.5;
                    color: rgba(244, 239, 230, 0.85);
                    scrollbar-width: none;
                }

                .mayakoko .mk-empty {
                    color: rgba(244, 239, 230, 0.32);
                }

                .mayakoko .mk-copy:disabled {
                    opacity: 0.35;
                    cursor: default;
                }

                .mayakoko .mk-copy {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.18);
                    background: rgba(255, 255, 255, 0.1);
                    font-size: 13px;
                }

                .mayakoko .mk-copy:hover {
                    background: rgba(255, 255, 255, 0.16);
                }

                @media (max-width: 900px) {
                    .mayakoko {
                        left: 10px;
                        right: 10px;
                        width: auto;
                    }
                }
            `}</style>
        </aside>
    );
}
