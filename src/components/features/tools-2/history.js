import { useEffect, useMemo, useState } from "react";

import Header from "@/components/layout/Header";
import CopyIcon from "@/assets/general/copy.svg";
import Button from "@/components/ui/Button";
import Switcher from "@/components/ui/Switcher";
import Block from "@/components/features/public/Block";

const TRAINER_PREFIX = "trainer_v2";
const getStorageKey = (key) => `${TRAINER_PREFIX}_${key}`;
const CLOSE_BUTTON_STYLE = { width: "2.25rem", height: "2.25rem", flex: "0 0 2.25rem" };
const CLOSE_BUTTON_CLASSNAME = "inline-flex appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-black shadow-none outline-none transition hover:bg-black/5";
const ACTION_BUTTON_CLASSNAME = "!px-3 !py-2 !text-sm !whitespace-nowrap !border-2 !border-black !bg-white !text-black hover:!bg-slate-50";

function parseHistoryStorage() {
    const raw = localStorage.getItem(getStorageKey("history")) || "";
    if (!raw) return [];

    try {
        return JSON.parse(raw);
    } catch (error) {
        console.error("Failed to parse history storage", error);
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

function getHistoryItemKey(item) {
    return item.id || `${item.date || ""}_${item.type || ""}_${item.prompt || ""}`;
}

export default function HistoryPage({ goTo }) {
    const [type, setType] = useState("text");
    const [history, setHistory] = useState([]);
    const [copiedKey, setCopiedKey] = useState(null);

    useEffect(() => {
        setHistory(parseHistoryStorage());
    }, []);

    const filteredHistory = useMemo(() => {
        return history.filter((item) => {
            if (type === "misc") {
                return item.type === "misc" || item.type === "misc-static" || item.type === "misc-dynamic";
            }
            return item.type === type;
        });
    }, [history, type]);

    const handleCopy = async (text, copyKey) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedKey(copyKey);
            window.setTimeout(() => setCopiedKey(null), 1200);
        } catch {
            alert("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0442\u0435\u043a\u0441\u0442");
        }
    };

    const handleDelete = (itemToDelete) => {
        const deleteKey = getHistoryItemKey(itemToDelete);
        const nextHistory = history.filter((item) => getHistoryItemKey(item) !== deleteKey);
        setHistory(nextHistory);
        localStorage.setItem(getStorageKey("history"), JSON.stringify(nextHistory));
    };

    const handleApplyToMayak = (item) => {
        if (!item?.mayakValues) return;
        const previousPage = sessionStorage.getItem("previousPage") || "mayakOko";
        sessionStorage.setItem(getStorageKey("historyApplyFields"), JSON.stringify(item.mayakValues));
        sessionStorage.setItem("currentPage", previousPage);
        goTo(previousPage);
    };

    const handleClose = () => {
        const previousPage = sessionStorage.getItem("previousPage") || "mayakOko";
        sessionStorage.setItem("currentPage", previousPage);
        goTo(previousPage);
    };

    return (
        <>
            <Header>
                <Header.Heading>{"\u041c\u0410\u042f\u041a \u041e\u041a\u041e"}</Header.Heading>
                <button type="button" onClick={handleClose} aria-label={"\u0412\u044b\u0439\u0442\u0438 \u0438\u0437 \u0438\u0441\u0442\u043e\u0440\u0438\u0438"} className={CLOSE_BUTTON_CLASSNAME} style={CLOSE_BUTTON_STYLE}>
                    <span className="text-[1.75rem] font-light leading-none text-black">{"\u00D7"}</span>
                </button>
            </Header>
            <div className="flex min-h-screen w-full justify-center p-6">
                <div className="flex h-full w-full max-w-4xl flex-col gap-[1.6rem]">
                    <div className="flex w-full flex-col gap-[1rem]">
                        <Switcher value={type} onChange={setType} className="!w-full !flex-nowrap gap-1 overflow-x-auto scrollbar-hide">
                            <Switcher.Option value="text" className="flex-1 whitespace-nowrap text-center">{"\u0422\u0435\u043a\u0441\u0442"}</Switcher.Option>
                            <Switcher.Option value="audio" className="flex-1 whitespace-nowrap text-center">{"\u0410\u0443\u0434\u0438\u043e"}</Switcher.Option>
                            <Switcher.Option value="visual-static" className="flex-1 whitespace-nowrap text-center">{"\u0418\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435"}</Switcher.Option>
                            <Switcher.Option value="visual-dynamic" className="flex-1 whitespace-nowrap text-center">{"\u0412\u0438\u0434\u0435\u043e"}</Switcher.Option>
                            <Switcher.Option value="interactive" className="flex-1 whitespace-nowrap text-center">{"\u0418\u043d\u0442\u0435\u0440\u0430\u043a\u0442\u0438\u0432"}</Switcher.Option>
                            <Switcher.Option value="data" className="flex-1 whitespace-nowrap text-center">{"\u0414\u0430\u043d\u043d\u044b\u0435"}</Switcher.Option>
                            <Switcher.Option value="misc" className="flex-1 whitespace-nowrap text-center">{"\u0420\u0430\u0437\u043d\u043e\u0435"}</Switcher.Option>
                        </Switcher>
                    </div>

                    <div className="flex w-full flex-col gap-[1.6rem]">
                        <div className="flex flex-col gap-[0.25rem]">
                            <h3>{"\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044f \u0437\u0430\u043f\u0440\u043e\u0441\u043e\u0432"}</h3>
                            <p className="small text-(--color-gray-black)">{"\u0417\u0434\u0435\u0441\u044c \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u0442\u0441\u044f \u0438\u0441\u0442\u043e\u0440\u0438\u044f \u043f\u0440\u043e\u043c\u0442\u043e\u0432 \u043f\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0439 \u0432\u044b\u0448\u0435 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438"}</p>
                        </div>

                        <div className="flex w-full flex-col gap-[0.75rem]">
                            {filteredHistory.length > 0 ? (
                                filteredHistory.map((item) => {
                                    const itemKey = getHistoryItemKey(item);
                                    return (
                                        <Block key={itemKey} className="relative flex flex-col gap-3">
                                            <div className="flex items-start gap-2">
                                                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">{item.prompt}</p>
                                                <button type="button" onClick={() => handleDelete(item)} title={"\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0438\u0437 \u0438\u0441\u0442\u043e\u0440\u0438\u0438"} aria-label={"\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0438\u0437 \u0438\u0441\u0442\u043e\u0440\u0438\u0438"} className={CLOSE_BUTTON_CLASSNAME} style={CLOSE_BUTTON_STYLE}>
                                                    <span className="text-[1.75rem] font-light leading-none text-black">{"\u00D7"}</span>
                                                </button>
                                            </div>

                                            <div className="mt-1 flex w-full items-center justify-between gap-3 border-t border-gray-100 pt-2 max-md:flex-col max-md:items-stretch">
                                                <span className="text-sm text-gray-400">{formatDate(item.date)}</span>
                                                <div className="flex flex-nowrap items-center justify-end gap-2 overflow-x-auto max-md:justify-start">
                                                    {item.mayakValues && (
                                                        <Button inverted className={ACTION_BUTTON_CLASSNAME} onClick={() => handleApplyToMayak(item)} title={"\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043f\u043e\u043b\u044f \u041c\u0410\u042f\u041a-\u041e\u041a\u041e \u0438 \u0441\u0440\u0430\u0437\u0443 \u043f\u043e\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u0438\u0445 \u0432 \u0444\u043e\u0440\u043c\u0443"}>
                                                            <CopyIcon className="mr-2 h-4 w-4" /> {"\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043f\u043e\u043b\u044f \u041c\u0410\u042f\u041a-\u041e\u041a\u041e"}
                                                        </Button>
                                                    )}
                                                    <div className="relative">
                                                        <Button inverted className={ACTION_BUTTON_CLASSNAME} onClick={() => handleCopy(item.prompt, `${itemKey}_prompt`)} title={"\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043f\u0440\u043e\u043c\u0442"}>
                                                            <CopyIcon className="mr-2 h-4 w-4" /> {"\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043f\u0440\u043e\u043c\u0442"}
                                                        </Button>
                                                        {copiedKey === `${itemKey}_prompt` && <span className="absolute bottom-full right-0 z-10 mb-2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white shadow-lg">{"\u041f\u0440\u043e\u043c\u0442 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d"}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </Block>
                                    );
                                })
                            ) : (
                                <Block className="flex flex-col gap-2">
                                    <p className="w-full text-gray-400">{"\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0437\u0430\u043f\u0440\u043e\u0441\u043e\u0432 \u043f\u0443\u0441\u0442\u0430"}</p>
                                </Block>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
