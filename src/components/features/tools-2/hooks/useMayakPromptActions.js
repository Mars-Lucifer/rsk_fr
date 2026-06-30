import { useCallback } from "react";

import { copyMayakText } from "../utils/copyMayakText";
import { pickRandomMayakFieldValue } from "../utils/mayakBufferStorage";
import { createEmptyMayakFields } from "../utils/mayakPromptState";

export const useMayakPromptActions = ({
    buildPromptDraft,
    clearSovaState,
    mayakData,
    setFields,
    setIsCopied,
    setPrompt,
    type,
    handleChange,
}) => {
    const handleResetFields = useCallback(() => {
        setFields(createEmptyMayakFields());
        setPrompt("");
        clearSovaState();
    }, [clearSovaState, setFields, setPrompt]);

    const handleCopy = useCallback(
        (value) => {
            if (!value) return;
            copyMayakText(value)
                .then(() => {
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                })
                .catch((err) => {
                    console.error("Ошибка при копировании: ", err);
                    alert("Не удалось скопировать текст.");
                });
        },
        [setIsCopied]
    );

    const handleRandom = useCallback(
        (code) => {
            const randomValue = pickRandomMayakFieldValue({
                code,
                type,
                contentTypeOptions: mayakData.contentTypeOptions,
            });

            if (randomValue) {
                handleChange(code, randomValue);
            }
        },
        [handleChange, mayakData.contentTypeOptions, type]
    );

    const createPrompt = useCallback(() => {
        const promptDraft = buildPromptDraft();
        if (!promptDraft) return;

        clearSovaState();
    }, [buildPromptDraft, clearSovaState]);

    return {
        createPrompt,
        handleCopy,
        handleRandom,
        handleResetFields,
    };
};
