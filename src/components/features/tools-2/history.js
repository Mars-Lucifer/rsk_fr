import { useState, useEffect } from "react";

import Header from "@/components/layout/Header";

// ИЗМЕНЕНИЕ 1: Импортируем иконку крестика и убираем ненужные
import CloseIcon from "@/assets/general/close.svg";
import CopyIcon from "@/assets/general/copy.svg";

import Button from "@/components/ui/Button";
import Switcher from "@/components/ui/Switcher";
import Block from "@/components/features/public/Block";

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
}

function getLocalStorage(key) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null; // или return [] если нужно гарантированно массив
    } catch (error) {
        console.error("Ошибка чтения из localStorage:", error);
        return null; // или return [] если нужно гарантированно массив
    }
}

const TRAINER_PREFIX = "trainer_v2";
const getStorageKey = (key) => `${TRAINER_PREFIX}_${key}`;

function parseHistoryCookie() {
    const cookie = localStorage.getItem(getStorageKey("history")) || "";
    if (!cookie) return [];

    try {
        return JSON.parse(cookie);
    } catch (e) {
        console.error("Failed to parse history cookie", e);
        return [];
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

export default function HistoryPage({ goTo }) {
    const [type, setType] = useState("text");
    const [history, setHistory] = useState([]);
    const [copiedId, setCopiedId] = useState(null);

    useEffect(() => {
        const historyData = parseHistoryCookie();
        setHistory(historyData);
    }, []);

    // ИЗМЕНЕНИЕ 2: Обновляем логику фильтрации для объединенной категории "Разное"
    const filteredHistory = history.filter((item) => {
        if (type === "misc") {
            // Показываем все типы "Разное", если выбрана эта категория
            return item.type === "misc" || item.type === "misc-static" || item.type === "misc-dynamic";
        }
        return item.type === type;
    });

    const handleCopy = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedId(index);
        setTimeout(() => setCopiedId(null), 1000);
    };

    const handleDelete = (indexToDelete) => {
        // Создаем новый массив без удаляемого элемента
        const newHistory = history.filter((_, index) => index !== indexToDelete);

        // Обновляем состояние
        setHistory(newHistory);

        // Обновляем localStorage
        // Используем тот же ключ, что и при чтении
        const TRAINER_PREFIX = "trainer_v2";
        const storageKey = `${TRAINER_PREFIX}_history`;
        localStorage.setItem(storageKey, JSON.stringify(newHistory));
    };

    return (
        <>
            <Header>
                <Header.Heading>МАЯК ОКО</Header.Heading>
                <Button
                    icon
                    className="!bg-transparent !text-black hover:!bg-black/5"
                    onClick={() => {
                        const previousPage = sessionStorage.getItem("previousPage") || "mayakOko";
                        sessionStorage.setItem("currentPage", previousPage);
                        goTo(previousPage);
                    }}>
                    <CloseIcon />
                </Button>
            </Header>
            <div className="flex justify-center w-full min-h-screen p-6">
                <div className="w-full max-w-4xl flex flex-col gap-[1.6rem] h-full">
                    <div className="flex flex-col gap-[1rem] w-full">
                        <Switcher value={type} onChange={setType} className="!w-full !flex-nowrap overflow-x-auto scrollbar-hide gap-1">
                            <Switcher.Option value="text" className="flex-1 text-center whitespace-nowrap">Текст</Switcher.Option>
                            <Switcher.Option value="audio" className="flex-1 text-center whitespace-nowrap">Аудио</Switcher.Option>
                            <Switcher.Option value="visual-static" className="flex-1 text-center whitespace-nowrap">Изображение</Switcher.Option>
                            <Switcher.Option value="visual-dynamic" className="flex-1 text-center whitespace-nowrap">Видео</Switcher.Option>
                            <Switcher.Option value="interactive" className="flex-1 text-center whitespace-nowrap">Интерактив</Switcher.Option>
                            <Switcher.Option value="data" className="flex-1 text-center whitespace-nowrap">Данные</Switcher.Option>
                            <Switcher.Option value="misc" className="flex-1 text-center whitespace-nowrap">Разное</Switcher.Option>
                        </Switcher>
                    </div>

                    <div className="w-full flex flex-col gap-[1.6rem]">
                        <div className="flex flex-col gap-[0.25rem]">
                            <h3>История создания запросов</h3>
                            <p className="small text-(--color-gray-black)">Здесь отображается история промтов по выбранной выше категории</p>
                        </div>

                        <div className="flex flex-col gap-[0.75rem] w-full">
                            {filteredHistory.length > 0 ? (
                                filteredHistory.map((item, index) => (
                                    <Block key={index} className="flex flex-col gap-2 relative group">
                                        <div className="flex items-start gap-2">
                                            <p className="flex-1 min-w-0 whitespace-pre-wrap break-words">{item.prompt}</p>
                                            <Button
                                                icon
                                                className="!w-9 !h-9 !p-0 !bg-transparent !text-black hover:!bg-black/5 flex items-center justify-center flex-shrink-0"
                                                onClick={() => handleDelete(index)}
                                                title="Удалить из истории"
                                            >
                                                <CloseIcon className="w-5 h-5" />
                                            </Button>
                                        </div>

                                        <div className="flex justify-between items-center w-full border-t border-gray-100 pt-2 mt-1">
                                            <span className="text-sm text-gray-400">{formatDate(item.date)}</span>
                                            <div className="relative">
                                                <Button
                                                    inverted
                                                    className="!w-9 !h-9 !p-0 flex items-center justify-center"
                                                    onClick={() => handleCopy(item.prompt, index)}
                                                    title="Скопировать"
                                                >
                                                    <CopyIcon className="w-4 h-4" />
                                                </Button>
                                                {copiedId === index && (
                                                    <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg whitespace-nowrap z-10 transition-opacity duration-300">
                                                        Скопировано
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </Block>
                                ))
                            ) : (
                                <Block className="flex flex-col gap-2">
                                    <p className="text-gray-400 w-full">История запросов пуста</p>
                                    <div className="flex justify-between items-center w-full border-t border-transparent pt-2 mt-1">
                                         <span className="text-sm text-transparent select-none">00.00.0000</span>
                                         <div className="w-9 h-9"></div>
                                    </div>
                                </Block>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
