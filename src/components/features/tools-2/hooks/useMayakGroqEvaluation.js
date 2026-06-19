import { useCallback, useEffect, useRef, useState } from "react";

export const GROQ_EVALUATION_LIMIT = 20;

const GROQ_MASCOT_POOLS = {
    green: [{ animatedSrc: "/mascot-good-transparent-anim-smooth.webp" }, { animatedSrc: "/mascot-good-2-transparent-anim.webp" }, { animatedSrc: "/mascot-good-3-transparent-anim.webp" }],
    yellow: [{ animatedSrc: "/mascot-neutral-1-transparent-anim.webp" }, { animatedSrc: "/mascot-neutral-2-transparent-anim.webp" }, { animatedSrc: "/mascot-neutral-3-transparent-anim.webp" }],
    red: [{ animatedSrc: "/mascot-bad-transparent-anim.webp" }, { animatedSrc: "/mascot-bad-2-transparent-anim.webp" }, { animatedSrc: "/mascot-bad-3-transparent-anim.webp", hideAfterMs: 5980 }],
};

const getRandomGroqMascotAsset = (zone) => {
    const pool = GROQ_MASCOT_POOLS[zone];
    if (!Array.isArray(pool) || pool.length === 0) {
        return null;
    }

    const selectedAsset = pool[Math.floor(Math.random() * pool.length)];
    return selectedAsset ? { ...selectedAsset } : null;
};

const GROQ_UNAVAILABLE_MASCOT_ASSET = { animatedSrc: "/mascot-bad-3-transparent-anim.webp", hideAfterMs: 5980 };
const GROQ_MASCOT_ASSET_PRELOAD_LIST = Array.from(
    new Set([
        GROQ_UNAVAILABLE_MASCOT_ASSET.animatedSrc,
        ...Object.values(GROQ_MASCOT_POOLS)
            .flat()
            .map((asset) => asset.animatedSrc)
            .filter(Boolean),
    ])
);

function sanitizeGroqMessage(message) {
    let msg = message || "Нет ответа";
    msg = msg.replace(/<details>.*?<\/details>/gs, "");
    msg = msg.replace(/Response ID:.*?Request ID:[^\n]+/gs, "");
    msg = msg.replace(/```.*?```/gs, "");
    msg = msg.trim();
    msg = msg.replace(/\btask_context\b/gi, "задания");
    msg = msg.replace(/из\s+задания/gi, "задачи");
    return msg;
}

export function useMayakGroqEvaluation({ getStorageKey, buildPromptDraft, currentTaskIndex, isIntroTask, isSessionMode }) {
    const [groqResponse, setGroqResponse] = useState("");
    const [groqLoading, setGroqLoading] = useState(false);
    const [groqZone, setGroqZone] = useState(null);
    const [groqStrongFields, setGroqStrongFields] = useState([]);
    const [groqWeakFields, setGroqWeakFields] = useState([]);
    const [groqGreenCount, setGroqGreenCount] = useState(null);
    const [groqTotalFields, setGroqTotalFields] = useState(7);
    const [groqChecksRemaining, setGroqChecksRemaining] = useState(GROQ_EVALUATION_LIMIT);
    const [showMascotVideo, setShowMascotVideo] = useState(false);
    const [activeGroqMascotAsset, setActiveGroqMascotAsset] = useState(null);
    const [isPromptCopyAwaitingEvaluation, setIsPromptCopyAwaitingEvaluation] = useState(false);
    const [mascotPlaybackKey, setMascotPlaybackKey] = useState(0);
    const mascotHideTimeoutRef = useRef(null);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const preloadedAssets = GROQ_MASCOT_ASSET_PRELOAD_LIST.map((src) => {
            const image = new window.Image();
            image.decoding = "sync";
            image.src = src;
            return image;
        });

        return () => {
            preloadedAssets.forEach((image) => {
                image.src = "";
            });
        };
    }, []);

    const syncGroqEvaluationQuota = useCallback((sessionIdArg = null) => {
        try {
            const sessionId = sessionIdArg || localStorage.getItem(getStorageKey("sessionStartTime"));
            if (!sessionId) {
                setGroqChecksRemaining(GROQ_EVALUATION_LIMIT);
                return GROQ_EVALUATION_LIMIT;
            }

            const rawQuota = localStorage.getItem(getStorageKey("groqEvaluationQuota"));
            if (rawQuota) {
                const parsedQuota = JSON.parse(rawQuota);
                const parsedRemaining = Number.parseInt(parsedQuota?.remaining, 10);
                if (parsedQuota?.sessionId === sessionId && !Number.isNaN(parsedRemaining)) {
                    const safeRemaining = Math.max(0, Math.min(GROQ_EVALUATION_LIMIT, parsedRemaining));
                    setGroqChecksRemaining(safeRemaining);
                    return safeRemaining;
                }
            }

            const nextQuota = { sessionId, remaining: GROQ_EVALUATION_LIMIT };
            localStorage.setItem(getStorageKey("groqEvaluationQuota"), JSON.stringify(nextQuota));
            setGroqChecksRemaining(GROQ_EVALUATION_LIMIT);
            return GROQ_EVALUATION_LIMIT;
        } catch (error) {
            console.error("Ошибка синхронизации лимита Groq:", error);
            setGroqChecksRemaining(GROQ_EVALUATION_LIMIT);
            return GROQ_EVALUATION_LIMIT;
        }
    }, [getStorageKey]);

    const consumeGroqEvaluationQuota = useCallback(() => {
        const sessionId = localStorage.getItem(getStorageKey("sessionStartTime"));
        if (!sessionId) {
            return syncGroqEvaluationQuota();
        }

        const currentRemaining = syncGroqEvaluationQuota(sessionId);
        const nextRemaining = Math.max(0, currentRemaining - 1);
        localStorage.setItem(
            getStorageKey("groqEvaluationQuota"),
            JSON.stringify({ sessionId, remaining: nextRemaining })
        );
        setGroqChecksRemaining(nextRemaining);
        return nextRemaining;
    }, [getStorageKey, syncGroqEvaluationQuota]);

    useEffect(() => {
        let frameId = null;
        const existingSessionStartTime = localStorage.getItem(getStorageKey("sessionStartTime"));

        frameId = requestAnimationFrame(() => {
            if (existingSessionStartTime) {
                syncGroqEvaluationQuota(existingSessionStartTime);
                return;
            }

            const nextSessionStartTime = Date.now().toString();
            localStorage.setItem(getStorageKey("sessionStartTime"), nextSessionStartTime);
            syncGroqEvaluationQuota(nextSessionStartTime);
        });

        return () => {
            if (frameId) {
                cancelAnimationFrame(frameId);
            }
        };
    }, [getStorageKey, syncGroqEvaluationQuota]);

    const resetGroqFeedback = useCallback(() => {
        if (mascotHideTimeoutRef.current) {
            clearTimeout(mascotHideTimeoutRef.current);
            mascotHideTimeoutRef.current = null;
        }
        setGroqResponse("");
        setGroqZone(null);
        setGroqStrongFields([]);
        setGroqWeakFields([]);
        setGroqGreenCount(null);
        setGroqTotalFields(7);
        setShowMascotVideo(false);
        setActiveGroqMascotAsset(null);
    }, []);

    const clearGroqState = useCallback(() => {
        setGroqLoading(false);
        setIsPromptCopyAwaitingEvaluation(false);
        resetGroqFeedback();
    }, [resetGroqFeedback]);

    const resetGroqSessionState = useCallback(() => {
        localStorage.removeItem(getStorageKey("groqEvaluationQuota"));
        setGroqChecksRemaining(GROQ_EVALUATION_LIMIT);
        clearGroqState();
    }, [clearGroqState, getStorageKey]);

    const playMascotAnimation = useCallback((zone, overrideAsset = null) => {
        if (mascotHideTimeoutRef.current) {
            clearTimeout(mascotHideTimeoutRef.current);
            mascotHideTimeoutRef.current = null;
        }

        const nextMascotAsset = overrideAsset ? { ...overrideAsset } : getRandomGroqMascotAsset(zone);
        setActiveGroqMascotAsset(nextMascotAsset);
        setShowMascotVideo(Boolean(nextMascotAsset));
        if (nextMascotAsset) {
            setMascotPlaybackKey((prev) => prev + 1);
            if (typeof nextMascotAsset.hideAfterMs === "number" && nextMascotAsset.hideAfterMs > 0) {
                mascotHideTimeoutRef.current = setTimeout(() => {
                    setShowMascotVideo(false);
                    setActiveGroqMascotAsset(null);
                    mascotHideTimeoutRef.current = null;
                }, nextMascotAsset.hideAfterMs);
            }
        }
    }, []);

    useEffect(() => {
        return () => {
            if (mascotHideTimeoutRef.current) {
                clearTimeout(mascotHideTimeoutRef.current);
                mascotHideTimeoutRef.current = null;
            }
        };
    }, []);

    const createPromptWithEvaluation = useCallback(() => {
        if (isSessionMode && isIntroTask(currentTaskIndex)) {
            clearGroqState();
            setGroqResponse("Оценка недоступна на первых трех заданиях каждой колоды: это вводные задания для выбора роли, входной анкеты и тестирования.");
            return;
        }

        const promptDraft = buildPromptDraft();
        if (!promptDraft) return;

        setIsPromptCopyAwaitingEvaluation(true);
        const remainingChecks = syncGroqEvaluationQuota();
        if (remainingChecks <= 0) {
            clearGroqState();
            setGroqZone("red");
            setGroqResponse("Лимит оценок от нейросети для этой сессии исчерпан. Завершите сессию и начните новую, чтобы снова получить 20 оценок.");
            return;
        }

        resetGroqFeedback();
        setGroqLoading(true);

        fetch("/api/mayak/groq-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fields: promptDraft.values,
                taskContext: promptDraft.taskContext,
            }),
        })
            .then(async (r) => {
                const data = await r.json().catch(() => ({}));
                if (!r.ok) {
                    throw new Error(data.message || data.error || "Не удалось получить оценку");
                }
                return data;
            })
            .then((data) => {
                consumeGroqEvaluationQuota();
                setIsPromptCopyAwaitingEvaluation(false);
                const nextZone = data.zone || null;
                setGroqResponse(sanitizeGroqMessage(data.message));
                setGroqZone(nextZone);
                setGroqStrongFields(Array.isArray(data.strongFields) ? data.strongFields : []);
                setGroqWeakFields(Array.isArray(data.weakFields) ? data.weakFields : []);
                setGroqGreenCount(Number.isFinite(data.greenCount) ? data.greenCount : 0);
                setGroqTotalFields(Number.isFinite(data.totalFields) && data.totalFields > 0 ? data.totalFields : 7);
                if (nextZone) {
                    playMascotAnimation(nextZone);
                } else {
                    setActiveGroqMascotAsset(null);
                    setShowMascotVideo(false);
                }
            })
            .catch((err) => {
                resetGroqFeedback();
                setIsPromptCopyAwaitingEvaluation(false);
                setGroqResponse(err?.message || "Проверка временно недоступна");
                setGroqZone("red");
                playMascotAnimation("red", GROQ_UNAVAILABLE_MASCOT_ASSET);
            })
            .finally(() => setGroqLoading(false));
    }, [buildPromptDraft, clearGroqState, consumeGroqEvaluationQuota, currentTaskIndex, isIntroTask, playMascotAnimation, resetGroqFeedback, syncGroqEvaluationQuota]);

    return {
        groqResponse,
        groqLoading,
        groqZone,
        groqStrongFields,
        groqWeakFields,
        groqGreenCount,
        groqTotalFields,
        groqChecksRemaining,
        showMascotVideo,
        activeGroqMascotAsset,
        isPromptCopyAwaitingEvaluation,
        mascotPlaybackKey,
        evaluationLimit: GROQ_EVALUATION_LIMIT,
        syncGroqEvaluationQuota,
        clearGroqState,
        resetGroqSessionState,
        createPromptWithEvaluation,
    };
}
