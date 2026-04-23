import { useCallback, useEffect, useRef, useState } from "react";

export const QWEN_EVALUATION_LIMIT = 20;

const QWEN_MASCOT_POOLS = {
    green: [{ animatedSrc: "/mascot-good-transparent-anim-smooth.webp" }, { animatedSrc: "/mascot-good-2-transparent-anim.webp" }, { animatedSrc: "/mascot-good-3-transparent-anim.webp" }],
    yellow: [{ animatedSrc: "/mascot-neutral-1-transparent-anim.webp" }, { animatedSrc: "/mascot-neutral-2-transparent-anim.webp" }, { animatedSrc: "/mascot-neutral-3-transparent-anim.webp" }],
    red: [{ animatedSrc: "/mascot-bad-transparent-anim.webp" }, { animatedSrc: "/mascot-bad-2-transparent-anim.webp" }, { animatedSrc: "/mascot-bad-3-transparent-anim.webp", hideAfterMs: 5980 }],
};

const getRandomQwenMascotAsset = (zone) => {
    const pool = QWEN_MASCOT_POOLS[zone];
    if (!Array.isArray(pool) || pool.length === 0) {
        return null;
    }

    const selectedAsset = pool[Math.floor(Math.random() * pool.length)];
    return selectedAsset ? { ...selectedAsset } : null;
};

const QWEN_UNAVAILABLE_MASCOT_ASSET = { animatedSrc: "/mascot-bad-3-transparent-anim.webp", hideAfterMs: 5980 };
const QWEN_MASCOT_ASSET_PRELOAD_LIST = Array.from(
    new Set([
        QWEN_UNAVAILABLE_MASCOT_ASSET.animatedSrc,
        ...Object.values(QWEN_MASCOT_POOLS)
            .flat()
            .map((asset) => asset.animatedSrc)
            .filter(Boolean),
    ])
);

function sanitizeQwenMessage(message) {
    let msg = message || "Нет ответа";
    msg = msg.replace(/<details>.*?<\/details>/gs, "");
    msg = msg.replace(/Response ID:.*?Request ID:[^\n]+/gs, "");
    msg = msg.replace(/```.*?```/gs, "");
    msg = msg.trim();
    msg = msg.replace(/\btask_context\b/gi, "задания");
    msg = msg.replace(/из\s+задания/gi, "задачи");
    return msg;
}

export function useMayakQwenEvaluation({ getStorageKey, buildPromptDraft, currentTaskIndex, isIntroTask }) {
    const [qwenResponse, setQwenResponse] = useState("");
    const [qwenLoading, setQwenLoading] = useState(false);
    const [qwenZone, setQwenZone] = useState(null);
    const [qwenStrongFields, setQwenStrongFields] = useState([]);
    const [qwenWeakFields, setQwenWeakFields] = useState([]);
    const [qwenGreenCount, setQwenGreenCount] = useState(null);
    const [qwenTotalFields, setQwenTotalFields] = useState(7);
    const [qwenChecksRemaining, setQwenChecksRemaining] = useState(QWEN_EVALUATION_LIMIT);
    const [showMascotVideo, setShowMascotVideo] = useState(false);
    const [activeQwenMascotAsset, setActiveQwenMascotAsset] = useState(null);
    const [isPromptCopyAwaitingEvaluation, setIsPromptCopyAwaitingEvaluation] = useState(false);
    const [mascotPlaybackKey, setMascotPlaybackKey] = useState(0);
    const mascotHideTimeoutRef = useRef(null);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const preloadedAssets = QWEN_MASCOT_ASSET_PRELOAD_LIST.map((src) => {
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

    const syncQwenEvaluationQuota = useCallback((sessionIdArg = null) => {
        try {
            const sessionId = sessionIdArg || localStorage.getItem(getStorageKey("sessionStartTime"));
            if (!sessionId) {
                setQwenChecksRemaining(QWEN_EVALUATION_LIMIT);
                return QWEN_EVALUATION_LIMIT;
            }

            const rawQuota = localStorage.getItem(getStorageKey("qwenEvaluationQuota"));
            if (rawQuota) {
                const parsedQuota = JSON.parse(rawQuota);
                const parsedRemaining = Number.parseInt(parsedQuota?.remaining, 10);
                if (parsedQuota?.sessionId === sessionId && !Number.isNaN(parsedRemaining)) {
                    const safeRemaining = Math.max(0, Math.min(QWEN_EVALUATION_LIMIT, parsedRemaining));
                    setQwenChecksRemaining(safeRemaining);
                    return safeRemaining;
                }
            }

            const nextQuota = { sessionId, remaining: QWEN_EVALUATION_LIMIT };
            localStorage.setItem(getStorageKey("qwenEvaluationQuota"), JSON.stringify(nextQuota));
            setQwenChecksRemaining(QWEN_EVALUATION_LIMIT);
            return QWEN_EVALUATION_LIMIT;
        } catch (error) {
            console.error("Ошибка синхронизации лимита Qwen:", error);
            setQwenChecksRemaining(QWEN_EVALUATION_LIMIT);
            return QWEN_EVALUATION_LIMIT;
        }
    }, [getStorageKey]);

    const consumeQwenEvaluationQuota = useCallback(() => {
        const sessionId = localStorage.getItem(getStorageKey("sessionStartTime"));
        if (!sessionId) {
            return syncQwenEvaluationQuota();
        }

        const currentRemaining = syncQwenEvaluationQuota(sessionId);
        const nextRemaining = Math.max(0, currentRemaining - 1);
        localStorage.setItem(
            getStorageKey("qwenEvaluationQuota"),
            JSON.stringify({ sessionId, remaining: nextRemaining })
        );
        setQwenChecksRemaining(nextRemaining);
        return nextRemaining;
    }, [getStorageKey, syncQwenEvaluationQuota]);

    useEffect(() => {
        let frameId = null;
        const existingSessionStartTime = localStorage.getItem(getStorageKey("sessionStartTime"));

        frameId = requestAnimationFrame(() => {
            if (existingSessionStartTime) {
                syncQwenEvaluationQuota(existingSessionStartTime);
                return;
            }

            const nextSessionStartTime = Date.now().toString();
            localStorage.setItem(getStorageKey("sessionStartTime"), nextSessionStartTime);
            syncQwenEvaluationQuota(nextSessionStartTime);
        });

        return () => {
            if (frameId) {
                cancelAnimationFrame(frameId);
            }
        };
    }, [getStorageKey, syncQwenEvaluationQuota]);

    const resetQwenFeedback = useCallback(() => {
        if (mascotHideTimeoutRef.current) {
            clearTimeout(mascotHideTimeoutRef.current);
            mascotHideTimeoutRef.current = null;
        }
        setQwenResponse("");
        setQwenZone(null);
        setQwenStrongFields([]);
        setQwenWeakFields([]);
        setQwenGreenCount(null);
        setQwenTotalFields(7);
        setShowMascotVideo(false);
        setActiveQwenMascotAsset(null);
    }, []);

    const clearQwenState = useCallback(() => {
        setQwenLoading(false);
        setIsPromptCopyAwaitingEvaluation(false);
        resetQwenFeedback();
    }, [resetQwenFeedback]);

    const resetQwenSessionState = useCallback(() => {
        localStorage.removeItem(getStorageKey("qwenEvaluationQuota"));
        setQwenChecksRemaining(QWEN_EVALUATION_LIMIT);
        clearQwenState();
    }, [clearQwenState, getStorageKey]);

    const playMascotAnimation = useCallback((zone, overrideAsset = null) => {
        if (mascotHideTimeoutRef.current) {
            clearTimeout(mascotHideTimeoutRef.current);
            mascotHideTimeoutRef.current = null;
        }

        const nextMascotAsset = overrideAsset ? { ...overrideAsset } : getRandomQwenMascotAsset(zone);
        setActiveQwenMascotAsset(nextMascotAsset);
        setShowMascotVideo(Boolean(nextMascotAsset));
        if (nextMascotAsset) {
            setMascotPlaybackKey((prev) => prev + 1);
            if (typeof nextMascotAsset.hideAfterMs === "number" && nextMascotAsset.hideAfterMs > 0) {
                mascotHideTimeoutRef.current = setTimeout(() => {
                    setShowMascotVideo(false);
                    setActiveQwenMascotAsset(null);
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
        if (isIntroTask(currentTaskIndex)) {
            clearQwenState();
            setQwenResponse("Оценка недоступна на первых трех заданиях каждой колоды: это вводные задания для выбора роли, входной анкеты и тестирования.");
            return;
        }

        const promptDraft = buildPromptDraft();
        if (!promptDraft) return;

        setIsPromptCopyAwaitingEvaluation(true);
        const remainingChecks = syncQwenEvaluationQuota();
        if (remainingChecks <= 0) {
            clearQwenState();
            setQwenZone("red");
            setQwenResponse("Лимит оценок от нейросети для этой сессии исчерпан. Завершите сессию и начните новую, чтобы снова получить 20 оценок.");
            return;
        }

        resetQwenFeedback();
        setQwenLoading(true);

        fetch("/api/mayak/qwen-check", {
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
                consumeQwenEvaluationQuota();
                setIsPromptCopyAwaitingEvaluation(false);
                const nextZone = data.zone || null;
                setQwenResponse(sanitizeQwenMessage(data.message));
                setQwenZone(nextZone);
                setQwenStrongFields(Array.isArray(data.strongFields) ? data.strongFields : []);
                setQwenWeakFields(Array.isArray(data.weakFields) ? data.weakFields : []);
                setQwenGreenCount(Number.isFinite(data.greenCount) ? data.greenCount : 0);
                setQwenTotalFields(Number.isFinite(data.totalFields) && data.totalFields > 0 ? data.totalFields : 7);
                if (nextZone) {
                    playMascotAnimation(nextZone);
                } else {
                    setActiveQwenMascotAsset(null);
                    setShowMascotVideo(false);
                }
            })
            .catch((err) => {
                resetQwenFeedback();
                setIsPromptCopyAwaitingEvaluation(false);
                setQwenResponse(err?.message || "Проверка временно недоступна");
                setQwenZone("red");
                playMascotAnimation("red", QWEN_UNAVAILABLE_MASCOT_ASSET);
            })
            .finally(() => setQwenLoading(false));
    }, [buildPromptDraft, clearQwenState, consumeQwenEvaluationQuota, currentTaskIndex, isIntroTask, playMascotAnimation, resetQwenFeedback, syncQwenEvaluationQuota]);

    return {
        qwenResponse,
        qwenLoading,
        qwenZone,
        qwenStrongFields,
        qwenWeakFields,
        qwenGreenCount,
        qwenTotalFields,
        qwenChecksRemaining,
        showMascotVideo,
        activeQwenMascotAsset,
        isPromptCopyAwaitingEvaluation,
        mascotPlaybackKey,
        evaluationLimit: QWEN_EVALUATION_LIMIT,
        syncQwenEvaluationQuota,
        clearQwenState,
        resetQwenSessionState,
        createPromptWithEvaluation,
    };
}
