import { useState, useEffect } from "react";

import Header from "@/components/layout/Header";

import TimeIcon from "@/assets/general/time.svg";
import SettsIcon from "@/assets/general/setts.svg";
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

function parseHistoryCookie() {
    //const cookie = getLocalStorage('history') || []
    //const cookie = getCookie('history')
    const cookie = localStorage.getItem("history") || "";
    //console.log(cookie) // Массив с последними 50 записями
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
    const [visualType, setVisualType] = useState("visual-static");
    const [history, setHistory] = useState([]);

    useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            setHistory(parseHistoryCookie());
        });

        return () => window.cancelAnimationFrame(frameId);
    }, []);

    const filteredHistory = history.filter((item) => {
        if (type === "text") return item.type === "text";
        if (type === "audio") return item.type === "audio";
        if (type === "visual") return item.type === "visual";
        if (type === "interactive") return item.type === "interactive";
        if (type === "data") return item.type === "data";
        return true;
    });

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <>
            <Header>
                <Header.Heading>МАЯК ОКО</Header.Heading>
                <Button icon active onClick={() => goTo("mayakOko")}>
                    <TimeIcon />
                </Button>
                <Button icon onClick={() => goTo("settings")}>
                    <SettsIcon />
                </Button>
            </Header>
            <div className="hero" style={{ placeItems: "center" }}>
                <div className=" flex flex-col gap-[1.6rem] items-center col-start-4 col-end-10 h-full">
                    <div className="flex flex-col gap-[1rem] w-full">
                        <div className="flex flex-col gap-[0.5rem]">
                            <Switcher value={type} onChange={setType} className="!w-full">
                                <Switcher.Option value="text">Текст</Switcher.Option>
                                <Switcher.Option value="audio">Аудио</Switcher.Option>
                                <Switcher.Option value="visual">Визуал</Switcher.Option>
                                <Switcher.Option value="interactive">Интерактив</Switcher.Option>
                                <Switcher.Option value="data">Данные</Switcher.Option>
                            </Switcher>
                            <Switcher value={visualType} onChange={setVisualType} className={`!w-full ${type === "visual" ? "flex" : "!hidden"}`}>
                                <Switcher.Option value="visual-static">Статика</Switcher.Option>
                                <Switcher.Option value="visual-dynamic">Динамика</Switcher.Option>
                            </Switcher>
                        </div>
                    </div>
                    <div className="flex flex-col gap-[1.6rem] items-center w-[70%]">
                        <h3>История</h3>
                        <div className="flex flex-col gap-[0.75rem]">
                            <div className="flex flex-col gap-[0.25rem]">
                                <span className="big">История создания запросов</span>
                                <p className="small text-(--color-gray-black)">Здесь отображается история промтов по выбранной выше категории</p>
                            </div>
                            {filteredHistory.length > 0 ? (
                                filteredHistory.map((item, index) => (
                                    <Block key={index}>
                                        <p className="line-clamp-3">{item.prompt}</p>
                                        <div className="flex items-center">
                                            <span className="text-(--color-gray-black) w-full">{formatDate(item.date)}</span>
                                            <Button inverted className="!w-fit" onClick={() => handleCopy(item.prompt)}>
                                                <CopyIcon />
                                            </Button>
                                        </div>
                                    </Block>
                                ))
                            ) : (
                                <Block>
                                    <p className="text-(--color-gray-black)">История запросов пуста</p>
                                </Block>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
