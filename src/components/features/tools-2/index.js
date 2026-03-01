import Header from "@/components/layout/Header";
import Buffer from "./addons/popup";
import { getKeyFromCookies } from "./actions";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import LinkIcon from "@/assets/general/link.svg";
import CopyIcon from "@/assets/general/copy.svg";
import TimeIcon from "@/assets/general/time.svg";
import Plusicon from "@/assets/general/plus.svg";
import SettsIcon from "@/assets/general/setts.svg";
import RandomIcon from "@/assets/general/random.svg";
import ResetIcon from "@/assets/general/ResetIcon.svg";
import TelegramIcon from "@/assets/general/TelegramIcon.svg";
import TopIcon from "@/assets/general/TopIcon.svg";
import HotIcon from "@/assets/general/HotIcon.svg";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import TextareaAutosize from "react-textarea-autosize";
import CourseIcon from "@/assets/nav/course.svg";

import Input from "@/components/ui/Input/Input";
import Button from "@/components/ui/Button";
import Switcher from "@/components/ui/Switcher";
import Block from "@/components/features/public/Block";

import { STATIC_MAYAK_DATA } from "../../../../data/mayakDataConst";

const STORAGE_PREFIX = "trainer_v2_"; // Префикс для новой версии
const getStorageKey = (key) => `${STORAGE_PREFIX}${key}`;

function removeKeyCookie() {
    document.cookie = "activated_key=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

const CORRECT_TOKENS = [
    "MA8YQ-OKO2V-P3XZM-LR9QD-K7N4E",
    "JX3FQ-7B2WK-9PL8D-M4R6T-VN5YH",
    "KL9ZD-4WX7M-P2Q8R-T6H3Y-F5V1E",
    "QZ4R7-M8N3K-L2P9D-X6Y1T-VB5WU",
    "D9F2K-5T7XJ-R3M8P-Y4N6Q-W1VHZ",
    "T3Y8H-P6K2M-9D4R7-Q1X5W-LN9VZ",
    "R7W4E-K2N5D-M8P3Q-Y1T6X-V9BZJ",
    "H5L9M-3X2P8-Q6R4T-K1Y7W-N9VZD",
    "F2K8J-4D7N3-P5Q9R-M1W6X-T3YVH",
    "B6N9Q-1M4K7-R3T8P-Y2X5W-Z7VHD",
    "W4P7Z-2K9N5-D3R8M-Q1Y6T-X5VHB",
];

export default function IndexPage({ goTo }) {
    const [contentData, setContentData] = useState({
        ...STATIC_MAYAK_DATA, 
        // Динамические части, которые точно придут от API, можно инициализировать пустыми
        defaultLinks: {},
    });

    const [fields, setFields] = useState({
        m: "",
        a: "",
        y: "",
        k: "",
        o1: "",
        k2: "",
        o2: "",
    });

    // Восстанавливаем поля из sessionStorage при загрузке
    useEffect(() => {
        const savedFields = sessionStorage.getItem(getStorageKey("fields"));
        if (savedFields) {
            try {
                setFields(JSON.parse(savedFields));
            } catch (e) {
                console.error("Error parsing saved fields", e);
            }
        }
    }, []);

    // Сохраняем поля в sessionStorage при изменении
    useEffect(() => {
        sessionStorage.setItem(getStorageKey("fields"), JSON.stringify(fields));
    }, [fields]);

    const [prompt, setPrompt] = useState("");
    const [buffer, setBuffer] = useState({});
    const [history, setHistory] = useState([]);
    const [showBuffer, setShowBuffer] = useState(false);
    const [currentField, setCurrentField] = useState(null);

    const [type, setType] = useState("text");
    const [copied, setCopied] = useState(false);

    const [isTokenValid, setIsTokenValid] = useState(false);
    const [showAdminLogin, setShowAdminLogin] = useState(false);
    const [savedField, setSavedField] = useState(null);

    const isMobile = useMediaQuery("(max-width: 1023px)");

    const [isMiscAccordionOpen, setIsMiscAccordionOpen] = useState(false);
    const [openSubAccordionKey, setOpenSubAccordionKey] = useState(null);
    const [instructionModal, setInstructionModal] = useState(null);

    useEffect(() => {
        const completionKey = "trainer_v2_sessionCompletionPending";
        const isCompletionPending = localStorage.getItem(getStorageKey("sessionCompletionPending")) === "true";
        if (isCompletionPending) {
            // Мы пришли после завершения тренажера. Токен УЖЕ удален.
            // Наша задача - просто убрать флаг и почистить сессию.
            localStorage.removeItem("trainer_v2_sessionCompletionPending");
            sessionStorage.removeItem("currentPage");
            sessionStorage.setItem("currentPage", "mayakOko");
        } else {
            // Если процесс завершения не идет, работаем как обычно:
            // восстанавливаем последнюю страницу из сессии.
            const savedPage = sessionStorage.getItem("currentPage");
            if (savedPage && savedPage !== "mayakOko") {
                goTo(savedPage);
            } else {
                // Если истории нет, устанавливаем текущую страницу как главную.
                sessionStorage.setItem("currentPage", "mayakOko");
            }
        }
    }, [goTo]);

    useEffect(() => {
        async function fetchDynamicData() {
            try {
                const response = await fetch("/api/mayak/content-data");
                // data будет содержать { fieldsList, defaultTypes, defaultLinks }
                const dynamicData = await response.json(); 
                
                // ОБНОВЛЯЕМ состояние, объединяя старые (статичные) и новые (динамические) данные
                setContentData(prevData => ({
                    ...prevData,
                    ...dynamicData
                }));

            } catch (error) {
                console.error("Ошибка при загрузке динамических данных:", error);
            }
        }
        fetchDynamicData();
    }, []);

    useEffect(() => {
        async function checkToken() {
            const KeyInCookies = await getKeyFromCookies();
            // Используем опциональную цепочку (?.) для безопасного доступа к .text
            const token = KeyInCookies?.text;
            if (token && CORRECT_TOKENS.includes(token)) {
                setIsTokenValid(true);
            }
        }
        checkToken();
    }, []);

    useEffect(() => {
        const buf = getCookie(getStorageKey("buffer"));
        if (buf) {
            try {
                setBuffer(JSON.parse(buf));
            } catch {
                setBuffer({});
            }
        }

        const hist = localStorage.getItem(getStorageKey("history"));
        if (hist) {
            try {
                setHistory(JSON.parse(hist));
            } catch {
                setHistory([]);
            }
        }
    }, []);

    function getCookie(name) {
        const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
        return match ? decodeURIComponent(match[2]) : null;
    }

    function setCookie(name, value, days = 30) {
        try {
            const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
            const stringValue = value;
            document.cookie = `${name}=${decodeURIComponent(encodeURIComponent(stringValue))};` + `expires=${expires};` + `path=/;`;
            console.log(`Cookie ${name} set successfully`);
        } catch (error) {
            console.error("Error setting cookie:", error);
        }
    }

    function handleUpdateBuffer(newBuffer) {
        setBuffer(newBuffer);
        setCookie(getStorageKey("buffer"), JSON.stringify(newBuffer));
    }

    {
        showBuffer && <Buffer onClose={handleCloseBuffer} onInsert={handleInsertFromBuffer} onUpdate={handleUpdateBuffer} buffer={buffer} currentField={currentField} />;
    }

    function handleChange(code, value) {
        setFields((prev) => ({ ...prev, [code]: value }));
    }

    function handleCopy(value) {
        if (!value) return;
        if (navigator.clipboard) {
            navigator.clipboard
                .writeText(value)
                .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                })
                .catch((err) => {
                    console.error("Ошибка при копировании через Clipboard API: ", err);
                    alert("Не удалось скопировать текст.");
                });
        } else {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = value;
                textArea.style.position = "fixed";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                if (document.execCommand("copy")) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }
                document.body.removeChild(textArea);
            } catch (err) {
                console.error("Ошибка при вызове execCommand: ", err);
                alert("Не удалось скопировать текст.");
            }
        }
    }

    function handleCloseBuffer() {
        setShowBuffer(false);
        setCurrentField(null);
    }

    function handleAddToBuffer(code) {
        const fieldValue = fields[code];
        if (!fieldValue || fieldValue.trim() === "") return;

        const newBuffer = { ...buffer };
        if (!newBuffer[code]) {
            newBuffer[code] = [];
        }

        const trimmedValue = fieldValue.trim();
        if (!newBuffer[code].includes(trimmedValue)) {
            const currentBuffer = newBuffer[code];
            const updatedBuffer = [trimmedValue, ...currentBuffer].slice(0, 6);
            newBuffer[code] = updatedBuffer;
            setBuffer(newBuffer);
            setCookie(getStorageKey("buffer"), JSON.stringify(newBuffer));
        }
        setSavedField(code);
        setTimeout(() => setSavedField(null), 1000);
    }

    const handleResetFields = () => {
        setFields({ m: "", a: "", y: "", k: "", o1: "", k2: "", o2: "" });
        setPrompt("");
    };

    const { fieldsList, defaultTypes, defaultLinks, contentTypeOptions, synonyms, contentTypePlaceholders } = contentData;

    function handleInsertFromBuffer(text) {
        if (currentField) {
            handleChange(currentField, text);
        }
        handleCloseBuffer();
    }

    function handleShowBufferForField(code) {
        setCurrentField(code);

        // Исправленная логика: заполняем только если буфер undefined (никогда не трогали)
        if (buffer[code] === undefined) {
            const fieldMapping = { m: "mission", a: "audience", y: "role", k: "criteria", o1: "limitations", k2: "context", o2: "format" };
            const mappedKey = fieldMapping[code];
            if (mappedKey && contentTypeOptions[type] && contentTypeOptions[type][mappedKey]) {
                const options = contentTypeOptions[type][mappedKey];

                // Если опции есть, берем 6 случайных
                if (Array.isArray(options) && options.length > 0) {
                    const shuffled = [...options].sort(() => 0.5 - Math.random());
                    const additionalValues = [];
                    for (const value of shuffled) {
                        if (additionalValues.length >= 6) break;
                        additionalValues.push(value);
                    }
                    const newBuffer = { ...buffer, [code]: additionalValues };
                    setBuffer(newBuffer);
                    setCookie(getStorageKey("buffer"), JSON.stringify(newBuffer));
                }
            }
        }

        setShowBuffer(true);
    }

    function handleRandom(code) {
        const fieldMapping = { m: "mission", a: "audience", y: "role", k: "criteria", o1: "limitations", k2: "context", o2: "format" };
        const mappedKey = fieldMapping[code];
        if (!mappedKey) return;
        const typeOptions = contentTypeOptions[type];
        if (!typeOptions || !typeOptions[mappedKey]) return;
        const options = typeOptions[mappedKey];
        if (Array.isArray(options) && options.length > 0) {
            const randomValue = options[Math.floor(Math.random() * options.length)];
            handleChange(code, randomValue);
        }
    }

    function pickOne(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
    function cleanupPrompt(str) {
        return str
            .replace(/\s{2,}/g, " ")
            .replace(/,\s*,/g, ", ")
            .replace(/\.\s*\./g, ".")
            .trim();
    }

    function createPrompt() {
        const values = fields;
        if (!Object.values(values).every((v) => v)) {
            setPrompt('Пожалуйста, заполните все поля (или используйте "кубики").');
            return;
        }

        // Статическая генерация промпта
        let draftPrompt = `Представь, что ты ${
            values.y
        }. Твоя миссия — ${values.m.toLowerCase()}. Ты создаешь контент для следующей аудитории: ${values.a.toLowerCase()}. При работе ты должен учитывать такие ограничения: ${values.o1.toLowerCase()}. Готовый результат должен соответствовать следующим критериям: ${values.k.toLowerCase()}. Этот материал будет использоваться в следующем контексте: ${values.k2.toLowerCase()}. Финальное оформление должно быть таким: ${values.o2.toLowerCase()}.`;

        // Чистим итог от лишних пробелов и обновляем состояние
        let finalPrompt = cleanupPrompt(draftPrompt);
        setPrompt(finalPrompt);

        // Запись в историю (логика из вашего целевого файла сохранена)
        const entry = { date: new Date().toISOString(), type, prompt: finalPrompt };
        const newHist = [entry, ...history].slice(0, 50);
        setHistory(newHist);
        localStorage.setItem(getStorageKey("history"), JSON.stringify(newHist));
    }

    const isCreateDisabled = !Object.values(fields).every((field) => field.trim() !== "");

    const miscCategory = (defaultTypes || []).find((t) => t.key === "misc");

    // ИЗМЕНЕНИЕ 1: Логика для исправления бага с кнопкой "Разное"
    const activeTypeKey = isMiscAccordionOpen ? (miscCategory ? miscCategory.key : type) : type;

    const sortByOrder = (a, b) => {
        // Преобразуем order в число, если оно не число - считаем его бесконечностью (чтобы было в конце)
        const orderA = isNaN(Number(a.order)) ? Infinity : Number(a.order);
        const orderB = isNaN(Number(b.order)) ? Infinity : Number(b.order);
        return orderA - orderB;
    };

    const ServiceIcon = ({ type }) => {
        const iconProps = { className: "w-5 h-5 flex-shrink-0" };
        switch (type) {
            case "top":
                return <TopIcon {...iconProps} />;
            case "telegram":
                return <TelegramIcon {...iconProps} />;
            case "hot": // <-- ДОБАВЬ ЭТОТ БЛОК
                return <HotIcon {...iconProps} />;
            default: // 'standard' or any other
                return <LinkIcon {...iconProps} />;
        }
    };

    return (
        <>
            <Header>
                <Header.Heading>МАЯК ОКО</Header.Heading>
                <Button icon active onClick={() => goTo("trainer")}>
                    <CourseIcon />
                </Button>
                <Button
                    icon
                    onClick={() => {
                        sessionStorage.setItem("previousPage", "mayakOko");
                        goTo("history");
                    }}>
                    <TimeIcon />
                </Button>
            </Header>

            <div className="hero relative">
                {/* Левая колонка */}
                <Block className="col-span-12 lg:col-span-6 !h-full">
                    <form className="flex flex-col h-full justify-between" onSubmit={(e) => e.preventDefault()}>
                        <div>
                            <div className="flex flex-col gap-[0.5rem] mb-6">
                                <Switcher
                                    value={activeTypeKey}
                                    onChange={(newType) => {
                                        const selectedOption = defaultTypes.find((t) => t.key === newType);
                                        // --- НАЧАЛО РЕШЕНИЯ ---
                                        if (selectedOption && selectedOption.subCategories) {
                                            // Если это кнопка "Разное"
                                            setIsMiscAccordionOpen((prev) => !prev);
                                            // Устанавливаем тип 'misc', чтобы поля МАЯК обновились
                                            if (newType !== type) {
                                                setType(newType);
                                                // УБРАНА ОЧИСТКА БУФЕРА
                                            }
                                        } else {
                                            // Логика для всех остальных кнопок
                                            if (newType !== type) {
                                                setType(newType);
                                                // УБРАНА ОЧИСТКА БУФЕРА
                                            }
                                            setIsMiscAccordionOpen(false);
                                        }
                                    }}
                                    className="!w-full !flex-wrap">
                                    {defaultTypes.map((t) => {
                                        const label = t.label || t.key;
                                        return (
                                            <Switcher.Option key={t.key} value={t.key}>
                                                {label.charAt(0).toUpperCase() + label.slice(1)}
                                            </Switcher.Option>
                                        );
                                    })}
                                </Switcher>
                                {/* ИЗМЕНЕНИЕ 1: Передаем исправленное активное значение в Switcher */}
                            </div>

                            {/* Остальная часть формы */}
                            <div className="flex flex-col gap-[1.25rem]">
                                <div className="flex flex-col gap-[0.5rem]">
                                    <div className="flex justify-between items-center">
                                        <span className="big">Цели и целевая направленность</span>
                                        <Button icon type="button" onClick={handleResetFields} className="!w-auto !h-auto !p-1 !bg-transparent" title="Сбросить все поля">
                                            <ResetIcon className="!text-black" />
                                        </Button>
                                    </div>
                                    {(fieldsList || []).slice(0, 4).map((f) => (
                                        // ИЗМЕНЕНИЕ 3: Новый дизайн поля ввода
                                        <div key={f.code} className="flex w-full items-center gap-4">
                                            <span className="w-6 text-center font-bold text-lg text-gray-400">{f.label.charAt(0)}</span>
                                            <div className="group flex-1 flex w-full items-start gap-2">
                                                {isMobile ? (
                                                    <>
                                                        <div className="flex-1 min-w-0 flex flex-col">
                                                            <div className="input-wrapper w-full">
                                                                <TextareaAutosize
                                                                    minRows={1}
                                                                    className="w-full resize-none bg-transparent outline-none text-black overflow-hidden"
                                                                    placeholder={f.label.split(" - ")[1]}
                                                                    value={fields[f.code]}
                                                                    onChange={(e) => handleChange(f.code, e.target.value)}
                                                                />
                                                                {fields[f.code] && (
                                                                    <p className="text-xs text-gray-400 pb-2 pl-[0.875rem] opacity-70">
                                                                        {f.label}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-shrink-0 items-center gap-2">
                                                            <Button icon onClick={() => handleShowBufferForField(f.code)} title="Сохраненные варианты">
                                                                <CopyIcon />
                                                            </Button>
                                                            <div className="relative">
                                                                <Button icon onClick={() => handleAddToBuffer(f.code)} title="Сохранить">
                                                                    <Plusicon />
                                                                </Button>
                                                                {savedField === f.code && (
                                                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg whitespace-nowrap z-10 transition-opacity duration-300">
                                                                        Сохранено
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <Button icon onClick={() => handleRandom(f.code)} title="Случайный вариант">
                                                                <RandomIcon />
                                                            </Button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex-1 min-w-0 flex flex-col">
                                                            <div className="input-wrapper w-full">
                                                                <TextareaAutosize
                                                                    minRows={1}
                                                                    className="w-full resize-none bg-transparent outline-none text-black overflow-hidden"
                                                                    placeholder={f.label.split(" - ")[1]}
                                                                    value={fields[f.code]}
                                                                    onChange={(e) => handleChange(f.code, e.target.value)}
                                                                />
                                                                {fields[f.code] && (
                                                                    <p className="text-xs text-gray-400 pb-2 pl-[0.875rem] opacity-70">
                                                                        {f.label}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Button icon className="!flex lg:!hidden lg:group-hover:!flex" onClick={() => handleShowBufferForField(f.code)} title="Сохраненные варианты">
                                                            <CopyIcon />
                                                        </Button>
                                                        <div className="relative !flex lg:!hidden lg:group-hover:!flex">
                                                            <Button icon onClick={() => handleAddToBuffer(f.code)} title="Сохранить">
                                                                <Plusicon />
                                                            </Button>
                                                            {savedField === f.code && (
                                                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg whitespace-nowrap z-10 transition-opacity duration-300">
                                                                    Сохранено
                                                                </span>
                                                            )}
                                                        </div>
                                                        <Button icon className="!flex lg:!hidden lg:group-hover:!flex" onClick={() => handleRandom(f.code)} title="Случайный вариант">
                                                            <RandomIcon />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col gap-[0.5rem]">
                                    <span className="big">Условия реализации и параметры оформления</span>
                                    {(fieldsList || []).slice(4).map((f) => (
                                        // ИЗМЕНЕНИЕ 3: Новый дизайн поля ввода
                                        <div key={f.code} className="flex w-full items-center gap-4">
                                            <span className="w-6 text-center font-bold text-lg text-gray-400">{f.label.charAt(0)}</span>
                                            <div className="group flex-1 flex w-full items-start gap-2">
                                                {isMobile ? (
                                                    <>
                                                        <div className="flex-1 min-w-0 flex flex-col">
                                                            <div className="input-wrapper w-full">
                                                                <TextareaAutosize
                                                                    minRows={1}
                                                                    className="w-full resize-none bg-transparent outline-none text-black overflow-hidden"
                                                                    placeholder={f.label.split(" - ")[1]}
                                                                    value={fields[f.code]}
                                                                    onChange={(e) => handleChange(f.code, e.target.value)}
                                                                />
                                                                {fields[f.code] && (
                                                                    <p className="text-xs text-gray-400 pb-2 pl-[0.875rem] opacity-70">
                                                                        {f.label}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-shrink-0 items-center gap-2">
                                                            <Button icon onClick={() => handleShowBufferForField(f.code)} title="Сохраненные варианты">
                                                                <CopyIcon />
                                                            </Button>
                                                            <div className="relative">
                                                                <Button icon onClick={() => handleAddToBuffer(f.code)} title="Сохранить">
                                                                    <Plusicon />
                                                                </Button>
                                                                {savedField === f.code && (
                                                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg whitespace-nowrap z-10 transition-opacity duration-300">
                                                                        Сохранено
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <Button icon onClick={() => handleRandom(f.code)} title="Случайный вариант">
                                                                <RandomIcon />
                                                            </Button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex-1 min-w-0 flex flex-col">
                                                            <div className="input-wrapper w-full">
                                                                <TextareaAutosize
                                                                    minRows={1}
                                                                    className="w-full resize-none bg-transparent outline-none text-black overflow-hidden"
                                                                    placeholder={f.label.split(" - ")[1]}
                                                                    value={fields[f.code]}
                                                                    onChange={(e) => handleChange(f.code, e.target.value)}
                                                                />
                                                                {fields[f.code] && (
                                                                    <p className="text-xs text-gray-400 pb-2 pl-[0.875rem] opacity-70">
                                                                        {f.label}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Button icon className="!flex lg:!hidden lg:group-hover:!flex" onClick={() => handleShowBufferForField(f.code)} title="Сохраненные варианты">
                                                            <CopyIcon />
                                                        </Button>
                                                        <div className="relative !flex lg:!hidden lg:group-hover:!flex">
                                                            <Button icon onClick={() => handleAddToBuffer(f.code)} title="Сохранить">
                                                                <Plusicon />
                                                            </Button>
                                                            {savedField === f.code && (
                                                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg whitespace-nowrap z-10 transition-opacity duration-300">
                                                                    Сохранено
                                                                </span>
                                                            )}
                                                        </div>
                                                        <Button icon className="!flex lg:!hidden lg:group-hover:!flex" onClick={() => handleRandom(f.code)} title="Случайный вариант">
                                                            <RandomIcon />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <span className="block w-full mt-4" title={isCreateDisabled ? "Сначала заполните все поля" : ""}>
                            <Button className="blue w-full" type="button" onClick={createPrompt} disabled={isCreateDisabled}>
                                Создать&nbsp;запрос
                            </Button>
                        </span>
                    </form>
                </Block>

                {/* Правая колонка */}
                <div className="col-span-12 lg:col-span-6 h-full flex flex-col gap-4">
                    <Block className="flex-grow !bg-slate-50 flex flex-col">
                        <h6 className="text-black mb-2">Ваш промт</h6>
                        <div className="flex-grow overflow-y-auto">
                            <p className="text-gray-600">{prompt || 'Заполните поля и нажмите "Создать запрос"'}</p>
                        </div>
                    </Block>

                    <div className="flex flex-col gap-[1rem]">
                        <div className="flex flex-col gap-[0.5rem]">
                            <Button onClick={() => handleCopy(prompt)} disabled={!prompt || copied}>
                                {copied ? "Скопировано!" : "Скопировать"}
                            </Button>

                            <div className="flex flex-wrap lg:flex-nowrap gap-[0.5rem]">
                                {!isMiscAccordionOpen &&
                                    (defaultLinks[type] || [])
                                        .slice()
                                        .sort(sortByOrder)
                                        .map((service, index) => (
                                            <Button key={index} inverted className="relative group stroke-gray-900 !flex !items-center !gap-2" onClick={() => window.open(service.url, "_blank")}>
                                                <ServiceIcon type={service.iconType} />
                                                <span>{service.name}</span>
                                                {service.description && (
                                                    <div
                                                        className="absolute bottom-full right-0 mb-2 w-max max-w-xs
                                invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200
                                pointer-events-none z-10">
                                                        <div className="bg-white text-gray-700 text-sm rounded-lg shadow-lg px-3 py-2 text-center border border-gray-200">{service.description}</div>
                                                        {/* Треугольная стрелочка внизу (смещена вправо) */}
                                                        <div
                                                            className="absolute right-4 top-full w-0 h-0
                                    border-t-4 border-t-white
                                    border-l-4 border-l-transparent
                                    border-r-4 border-r-transparent"
                                                            style={{ filter: "drop-shadow(0 -1px 1px rgb(0 0 0 / 0.05))" }}></div>
                                                    </div>
                                                )}
                                            </Button>
                                        ))}
                            </div>

                            {miscCategory && isMiscAccordionOpen && (
                                <div className="flex flex-col gap-2">
                                    <Block className="flex flex-col gap-2">
                                        {miscCategory.subCategories.map((subItem) => (
                                            <div key={subItem.key} className="flex flex-col gap-2">
                                                <Button
                                                    inverted
                                                    onClick={() => setOpenSubAccordionKey((prevKey) => (prevKey === subItem.key ? null : subItem.key))}
                                                    className={`${openSubAccordionKey === subItem.key ? "!bg-gray-100 !text-black" : ""}`}>
                                                    {subItem.label}
                                                </Button>
                                                {openSubAccordionKey === subItem.key && subItem.key === 'services' && (() => {
                                                    const allServices = (defaultLinks[subItem.key] || []).slice().sort(sortByOrder);
                                                    const requiredServices = allServices.filter(s => s.required !== false);
                                                    const optionalServices = allServices.filter(s => s.required === false);
                                                    const renderServiceCard = (link, linkIndex) => (
                                                        <div key={linkIndex} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-semibold text-sm text-gray-900">{link.name}</span>
                                                                {link.description && <span className="text-xs text-gray-500 truncate">{link.description}</span>}
                                                            </div>
                                                            <div className="flex gap-2 flex-shrink-0">
                                                                <Button inverted className="!px-3 !py-1.5 !text-xs" disabled={!link.url} onClick={() => link.url && window.open(link.url, "_blank")}>
                                                                    {link.buttonLabel || (link.url ? "Регистрация" : "Скачать")}
                                                                </Button>
                                                                {link.instructionImage && (
                                                                    <Button inverted className="!px-3 !py-1.5 !text-xs" onClick={() => setInstructionModal({ name: link.name, image: link.instructionImage })}>
                                                                        Инструкция
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                    return (
                                                        <div className="flex flex-col gap-4 pt-2">
                                                            {requiredServices.length > 0 && (
                                                                <div className="flex flex-col gap-2">
                                                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Обязательные</span>
                                                                    {requiredServices.map(renderServiceCard)}
                                                                </div>
                                                            )}
                                                            {optionalServices.length > 0 && (
                                                                <div className="flex flex-col gap-2">
                                                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Необязательные</span>
                                                                    {optionalServices.map(renderServiceCard)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                                {openSubAccordionKey === subItem.key && subItem.key !== 'services' && (
                                                    <div className="flex flex-nowrap gap-2 pt-2 overflow-x-auto">
                                                        {(subItem.links || defaultLinks[subItem.key] || [])
                                                            .slice()
                                                            .sort(sortByOrder)
                                                            .map((link, linkIndex) => (
                                                                <Button key={linkIndex} inverted className="stroke-gray-900" onClick={() => window.open(link.url, "_blank")} title={link.description}>
                                                                    {link.name} <LinkIcon />
                                                                </Button>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </Block>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {showBuffer && <Buffer onClose={handleCloseBuffer} onInsert={handleInsertFromBuffer} onUpdate={handleUpdateBuffer} buffer={buffer} currentField={currentField} />}

                {instructionModal && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={() => setInstructionModal(null)}>
                        <div className="relative bg-white rounded-2xl shadow-2xl max-w-[95vw] max-h-[95vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 rounded-t-2xl">
                                <h3 className="text-base font-semibold text-gray-900">Инструкция: {instructionModal.name}</h3>
                                <Button
                                    icon
                                    className="!bg-transparent !text-black hover:!bg-black/5"
                                    onClick={() => setInstructionModal(null)}
                                >
                                    ✕
                                </Button>
                            </div>
                            <div className="p-4">
                                <img
                                    src={instructionModal.image}
                                    alt={`Инструкция ${instructionModal.name}`}
                                    className="w-full max-w-[900px] rounded-xl"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
