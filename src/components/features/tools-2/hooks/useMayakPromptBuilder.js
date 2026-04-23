import { useCallback, useEffect, useState } from "react";

const INITIAL_FIELDS = {
    m: "",
    a: "",
    y: "",
    k: "",
    o1: "",
    k2: "",
    o2: "",
};

const FIELD_MAPPING = {
    m: "mission",
    a: "audience",
    y: "role",
    k: "criteria",
    o1: "limitations",
    k2: "context",
    o2: "format",
};

const copyToClipboard = (text) => {
    if (!text) return Promise.reject(new Error("No text to copy"));

    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        return successful ? Promise.resolve() : Promise.reject(new Error("execCommand failed"));
    } catch (err) {
        document.body.removeChild(textArea);
        return Promise.reject(err);
    }
};

const cleanupPrompt = (str) =>
    str
        .replace(/\s{2,}/g, " ")
        .replace(/ ,/g, ",")
        .replace(/ \./g, ".")
        .trim();

function getCookie(name) {
    const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name, value, days = 365) {
    try {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
    } catch (error) {
        console.error("Error setting cookie:", error);
    }
}

export function useMayakPromptBuilder({ type, mayakData, tasksTexts, currentTaskNumber, getStorageKey, buildTaskContext, onInvalidDraft }) {
    const [savedField, setSavedField] = useState(null);
    const [fields, setFields] = useState(INITIAL_FIELDS);
    const [prompt, setPrompt] = useState("");
    const [isCopied, setIsCopied] = useState(false);
    const [buffer, setBuffer] = useState({});
    const [history, setHistory] = useState([]);
    const [showBuffer, setShowBuffer] = useState(false);
    const [currentField, setCurrentField] = useState(null);

    const savePromptToHistory = useCallback(
        (promptValue) => {
            const entry = { date: new Date().toISOString(), type, prompt: promptValue };
            const newHist = [entry, ...JSON.parse(localStorage.getItem(getStorageKey("history")) || "[]")].slice(0, 50);
            localStorage.setItem(getStorageKey("history"), JSON.stringify(newHist));
            setHistory(newHist);
        },
        [getStorageKey, type]
    );

    const buildPromptDraft = useCallback(() => {
        const values = fields;
        if (Object.values(values).some((v) => !v.trim())) {
            setPrompt('Пожалуйста, заполните все поля (или используйте "кубики").');
            return null;
        }

        const draftPrompt = `Представь, что ты ${values.y}. Твоя миссия — ${values.m.toLowerCase()}. Ты создаешь контент для следующей аудитории: ${values.a.toLowerCase()}. При работе ты должен учитывать такие ограничения: ${values.o1.toLowerCase()}. Готовый результат должен соответствовать следующим критериям: ${values.k.toLowerCase()}. Этот материал будет использоваться в следующем контексте: ${values.k2.toLowerCase()}. Финальное оформление должно быть таким: ${values.o2.toLowerCase()}.`;
        const finalPrompt = cleanupPrompt(draftPrompt);
        const taskTextData = currentTaskNumber ? tasksTexts.find((t) => t.number === currentTaskNumber) : null;
        const taskContext = {
            description: taskTextData?.description || "",
            task: taskTextData?.task || "",
        };

        setPrompt(finalPrompt);
        savePromptToHistory(finalPrompt);

        return {
            values,
            finalPrompt,
            taskContext,
        };
    }, [buildTaskContext, currentTaskNumber, fields, onInvalidDraft, savePromptToHistory, tasksTexts]);

    useEffect(() => {
        let frameId = null;
        const storedBuffer = getCookie(getStorageKey("buffer"));
        let nextBuffer = {};
        if (storedBuffer) {
            try {
                nextBuffer = JSON.parse(storedBuffer);
            } catch {
                nextBuffer = {};
            }
        }

        let nextHistory = [];
        try {
            const storedHistory = JSON.parse(localStorage.getItem(getStorageKey("history")) || "[]");
            if (Array.isArray(storedHistory)) {
                nextHistory = storedHistory;
            }
        } catch {
            nextHistory = [];
        }

        frameId = requestAnimationFrame(() => {
            setBuffer(nextBuffer);
            setHistory(nextHistory);
        });

        return () => {
            if (frameId) {
                cancelAnimationFrame(frameId);
            }
        };
    }, [getStorageKey]);

    const handleChange = useCallback((code, value) => {
        setFields((prev) => ({ ...prev, [code]: value }));
    }, []);

    const handleCopy = useCallback((value) => {
        if (!value) return;
        copyToClipboard(value)
            .then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            })
            .catch((err) => {
                console.error("Ошибка при копировании: ", err);
                alert("Не удалось скопировать текст.");
            });
    }, []);

    const handleCloseBuffer = useCallback(() => {
        setShowBuffer(false);
        setCurrentField(null);
    }, []);

    const handleUpdateBuffer = useCallback(
        (newBuffer) => {
            setBuffer(newBuffer);
            setCookie(getStorageKey("buffer"), JSON.stringify(newBuffer));
        },
        [getStorageKey]
    );

    const handleAddToBuffer = useCallback(
        (code) => {
            const fieldValue = fields[code];
            if (!fieldValue || fieldValue.trim() === "") return;

            const newBuffer = { ...buffer };
            if (!newBuffer[code]) {
                newBuffer[code] = [];
            }

            const trimmedValue = fieldValue.trim();
            if (!newBuffer[code].includes(trimmedValue)) {
                const updatedBuffer = [trimmedValue, ...newBuffer[code]].slice(0, 6);
                newBuffer[code] = updatedBuffer;
                setBuffer(newBuffer);
                setCookie(getStorageKey("buffer"), JSON.stringify(newBuffer));
            }
            setSavedField(code);
            setTimeout(() => setSavedField(null), 1000);
        },
        [buffer, fields, getStorageKey]
    );

    const handleInsertFromBuffer = useCallback(
        (text) => {
            if (currentField) {
                handleChange(currentField, text);
            }
            handleCloseBuffer();
        },
        [currentField, handleChange, handleCloseBuffer]
    );

    const handleShowBufferForField = useCallback(
        (code) => {
            setCurrentField(code);

            if (buffer[code] === undefined) {
                const mappedKey = FIELD_MAPPING[code];
                if (mappedKey) {
                    const typeOptions = mayakData.contentTypeOptions[type];
                    if (typeOptions && typeOptions[mappedKey]) {
                        const options = typeOptions[mappedKey];
                        if (Array.isArray(options) && options.length > 0) {
                            const randomValues = [...options].sort(() => 0.5 - Math.random()).slice(0, 6);
                            const newBuffer = { ...buffer, [code]: randomValues };
                            setBuffer(newBuffer);
                            setCookie(getStorageKey("buffer"), JSON.stringify(newBuffer));
                        }
                    }
                }
            }

            setShowBuffer(true);
        },
        [buffer, getStorageKey, mayakData.contentTypeOptions, type]
    );

    const handleRandom = useCallback(
        (code) => {
            const mappedKey = FIELD_MAPPING[code];
            if (!mappedKey) return;

            const typeOptions = mayakData.contentTypeOptions[type];
            if (!typeOptions || !typeOptions[mappedKey]) return;

            const options = typeOptions[mappedKey];
            if (Array.isArray(options) && options.length > 0) {
                const randomValue = options[Math.floor(Math.random() * options.length)];
                handleChange(code, randomValue);
            }
        },
        [handleChange, mayakData.contentTypeOptions, type]
    );

    const resetPromptBuilder = useCallback(() => {
        setFields(INITIAL_FIELDS);
        setPrompt("");
        setShowBuffer(false);
        setCurrentField(null);
        setSavedField(null);
        setIsCopied(false);
    }, []);

    return {
        savedField,
        fields,
        prompt,
        isCopied,
        buffer,
        history,
        showBuffer,
        currentField,
        setPrompt,
        buildPromptDraft,
        handleChange,
        handleCopy,
        handleCloseBuffer,
        handleUpdateBuffer,
        handleAddToBuffer,
        handleInsertFromBuffer,
        handleShowBufferForField,
        handleRandom,
        resetPromptBuilder,
    };
}
