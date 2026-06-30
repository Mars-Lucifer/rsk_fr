import { useCallback, useEffect, useRef, useState } from "react";

export const SOVA_EVALUATION_LIMIT = 20;

const SOVA_MASCOT_POOLS = {
    green: [{ animatedSrc: "/mascot-good-transparent-anim-smooth.webp" }, { animatedSrc: "/mascot-good-2-transparent-anim.webp" }, { animatedSrc: "/mascot-good-3-transparent-anim.webp" }],
    yellow: [{ animatedSrc: "/mascot-neutral-1-transparent-anim.webp" }, { animatedSrc: "/mascot-neutral-2-transparent-anim.webp" }, { animatedSrc: "/mascot-neutral-3-transparent-anim.webp" }],
    red: [{ animatedSrc: "/mascot-bad-transparent-anim.webp" }, { animatedSrc: "/mascot-bad-2-transparent-anim.webp" }, { animatedSrc: "/mascot-bad-3-transparent-anim.webp", hideAfterMs: 5980 }],
};

const getRandomSovaMascotAsset = (zone) => {
    const pool = SOVA_MASCOT_POOLS[zone];
    if (!Array.isArray(pool) || pool.length === 0) {
        return null;
    }

    const selectedAsset = pool[Math.floor(Math.random() * pool.length)];
    return selectedAsset ? { ...selectedAsset } : null;
};

const SOVA_UNAVAILABLE_MASCOT_ASSET = { animatedSrc: "/mascot-bad-3-transparent-anim.webp", hideAfterMs: 5980 };
const SOVA_MASCOT_ASSET_PRELOAD_LIST = Array.from(
    new Set([
        SOVA_UNAVAILABLE_MASCOT_ASSET.animatedSrc,
        ...Object.values(SOVA_MASCOT_POOLS)
            .flat()
            .map((asset) => asset.animatedSrc)
            .filter(Boolean),
    ])
);

function sanitizeSovaMessage(message) {
    let msg = message || "Нет ответа";
    msg = msg.replace(/<details>.*?<\/details>/gs, "");
    msg = msg.replace(/Response ID:.*?Request ID:[^\n]+/gs, "");
    msg = msg.replace(/```.*?```/gs, "");
    msg = msg.trim();
    msg = msg.replace(/\btask_context\b/gi, "задания");
    msg = msg.replace(/из\s+задания/gi, "задачи");
    return msg;
}

export function useMayakSovaEvaluation({ getStorageKey, buildPromptDraft, currentTaskIndex, isIntroTask }) {
    const [sovaResponse, setSovaResponse] = useState("");
    const [sovaLoading, setSovaLoading] = useState(false);
    const [sovaZone, setSovaZone] = useState(null);
    const [sovaStrongFields, setSovaStrongFields] = useState([]);
    const [sovaWeakFields, setSovaWeakFields] = useState([]);
    const [sovaGreenCount, setSovaGreenCount] = useState(null);
    const [sovaTotalFields, setSovaTotalFields] = useState(7);
    const [sovaChecksRemaining, setSovaChecksRemaining] = useState(SOVA_EVALUATION_LIMIT);
    const [showMascotVideo, setShowMascotVideo] = useState(false);
    const [activeSovaMascotAsset, setActiveSovaMascotAsset] = useState(null);
    const [isPromptCopyAwaitingEvaluation, setIsPromptCopyAwaitingEvaluation] = useState(false);
    const [mascotPlaybackKey, setMascotPlaybackKey] = useState(0);
    const mascotHideTimeoutRef = useRef(null);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const preloadedAssets = SOVA_MASCOT_ASSET_PRELOAD_LIST.map((src) => {
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

    const syncSovaEvaluationQuota = useCallback((sessionIdArg = null) => {
        try {
            const sessionId = sessionIdArg || localStorage.getItem(getStorageKey("sessionStartTime"));
            if (!sessionId) {
                setSovaChecksRemaining(SOVA_EVALUATION_LIMIT);
                return SOVA_EVALUATION_LIMIT;
            }

            const rawQuota = localStorage.getItem(getStorageKey("sovaEvaluationQuota"));
            if (rawQuota) {
                const parsedQuota = JSON.parse(rawQuota);
                const parsedRemaining = Number.parseInt(parsedQuota?.remaining, 10);
                if (parsedQuota?.sessionId === sessionId && !Number.isNaN(parsedRemaining)) {
                    const safeRemaining = Math.max(0, Math.min(SOVA_EVALUATION_LIMIT, parsedRemaining));
                    setSovaChecksRemaining(safeRemaining);
                    return safeRemaining;
                }
            }

            const nextQuota = { sessionId, remaining: SOVA_EVALUATION_LIMIT };
            localStorage.setItem(getStorageKey("sovaEvaluationQuota"), JSON.stringify(nextQuota));
            setSovaChecksRemaining(SOVA_EVALUATION_LIMIT);
            return SOVA_EVALUATION_LIMIT;
        } catch (error) {
            console.error("Ошибка синхронизации лимита СОВА:", error);
            setSovaChecksRemaining(SOVA_EVALUATION_LIMIT);
            return SOVA_EVALUATION_LIMIT;
        }
    }, [getStorageKey]);

    const consumeSovaEvaluationQuota = useCallback(() => {
        const sessionId = localStorage.getItem(getStorageKey("sessionStartTime"));
        if (!sessionId) {
            return syncSovaEvaluationQuota();
        }

        const currentRemaining = syncSovaEvaluationQuota(sessionId);
        const nextRemaining = Math.max(0, currentRemaining - 1);
        localStorage.setItem(
            getStorageKey("sovaEvaluationQuota"),
            JSON.stringify({ sessionId, remaining: nextRemaining })
        );
        setSovaChecksRemaining(nextRemaining);
        return nextRemaining;
    }, [getStorageKey, syncSovaEvaluationQuota]);

    useEffect(() => {
        let frameId = null;
        const existingSessionStartTime = localStorage.getItem(getStorageKey("sessionStartTime"));

        frameId = requestAnimationFrame(() => {
            if (existingSessionStartTime) {
                syncSovaEvaluationQuota(existingSessionStartTime);
                return;
            }

            const nextSessionStartTime = Date.now().toString();
            localStorage.setItem(getStorageKey("sessionStartTime"), nextSessionStartTime);
            syncSovaEvaluationQuota(nextSessionStartTime);
        });

        return () => {
            if (frameId) {
                cancelAnimationFrame(frameId);
            }
        };
    }, [getStorageKey, syncSovaEvaluationQuota]);

    const resetSovaFeedback = useCallback(() => {
        if (mascotHideTimeoutRef.current) {
            clearTimeout(mascotHideTimeoutRef.current);
            mascotHideTimeoutRef.current = null;
        }
        setSovaResponse("");
        setSovaZone(null);
        setSovaStrongFields([]);
        setSovaWeakFields([]);
        setSovaGreenCount(null);
        setSovaTotalFields(7);
        setShowMascotVideo(false);
        setActiveSovaMascotAsset(null);
    }, []);

    const clearSovaState = useCallback(() => {
        setSovaLoading(false);
        setIsPromptCopyAwaitingEvaluation(false);
        resetSovaFeedback();
    }, [resetSovaFeedback]);

    const resetSovaSessionState = useCallback(() => {
        localStorage.removeItem(getStorageKey("sovaEvaluationQuota"));
        setSovaChecksRemaining(SOVA_EVALUATION_LIMIT);
        clearSovaState();
    }, [clearSovaState, getStorageKey]);

    const playMascotAnimation = useCallback((zone, overrideAsset = null) => {
        if (mascotHideTimeoutRef.current) {
            clearTimeout(mascotHideTimeoutRef.current);
            mascotHideTimeoutRef.current = null;
        }

        const nextMascotAsset = overrideAsset ? { ...overrideAsset } : getRandomSovaMascotAsset(zone);
        setActiveSovaMascotAsset(nextMascotAsset);
        setShowMascotVideo(Boolean(nextMascotAsset));
        if (nextMascotAsset) {
            setMascotPlaybackKey((prev) => prev + 1);
            if (typeof nextMascotAsset.hideAfterMs === "number" && nextMascotAsset.hideAfterMs > 0) {
                mascotHideTimeoutRef.current = setTimeout(() => {
                    setShowMascotVideo(false);
                    setActiveSovaMascotAsset(null);
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
            clearSovaState();
            setSovaResponse("Оценка недоступна на первых трех заданиях каждой колоды: это вводные задания для выбора роли, входной анкеты и тестирования.");
            return;
        }

        const promptDraft = buildPromptDraft();
        if (!promptDraft) return;

        setIsPromptCopyAwaitingEvaluation(true);
        const remainingChecks = syncSovaEvaluationQuota();
        if (remainingChecks <= 0) {
            clearSovaState();
            setSovaZone("red");
            setSovaResponse("Лимит оценок от нейросети для этой сессии исчерпан. Завершите сессию и начните новую, чтобы снова получить 20 оценок.");
            return;
        }

        resetSovaFeedback();
        setSovaLoading(true);

        fetch("/api/mayak/sova-check", {
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
                consumeSovaEvaluationQuota();
                setIsPromptCopyAwaitingEvaluation(false);
                const nextZone = data.zone || null;
                setSovaResponse(sanitizeSovaMessage(data.message));
                setSovaZone(nextZone);
                setSovaStrongFields(Array.isArray(data.strongFields) ? data.strongFields : []);
                setSovaWeakFields(Array.isArray(data.weakFields) ? data.weakFields : []);
                setSovaGreenCount(Number.isFinite(data.greenCount) ? data.greenCount : 0);
                setSovaTotalFields(Number.isFinite(data.totalFields) && data.totalFields > 0 ? data.totalFields : 7);
                if (nextZone) {
                    playMascotAnimation(nextZone);
                } else {
                    setActiveSovaMascotAsset(null);
                    setShowMascotVideo(false);
                }
            })
            .catch((err) => {
                resetSovaFeedback();
                setIsPromptCopyAwaitingEvaluation(false);
                setSovaResponse(err?.message || "Проверка временно недоступна");
                setSovaZone("red");
                playMascotAnimation("red", SOVA_UNAVAILABLE_MASCOT_ASSET);
            })
            .finally(() => setSovaLoading(false));
    }, [buildPromptDraft, clearSovaState, consumeSovaEvaluationQuota, currentTaskIndex, isIntroTask, playMascotAnimation, resetSovaFeedback, syncSovaEvaluationQuota]);

    return {
        sovaResponse,
        sovaLoading,
        sovaZone,
        sovaStrongFields,
        sovaWeakFields,
        sovaGreenCount,
        sovaTotalFields,
        sovaChecksRemaining,
        showMascotVideo,
        activeSovaMascotAsset,
        isPromptCopyAwaitingEvaluation,
        mascotPlaybackKey,
        evaluationLimit: SOVA_EVALUATION_LIMIT,
        syncSovaEvaluationQuota,
        clearSovaState,
        resetSovaSessionState,
        createPromptWithEvaluation,
    };
}
