import { useEffect, useRef, useState } from "react";

import CloseIcon from "@/assets/general/close.svg";
import MayakInspectorPanel from "./MayakInspectorPanel";

const DEFAULT_WIDTH = 320;
const DEFAULT_MARGIN = 16;
const DEFAULT_TOP = 16;

function clampPosition(position) {
    if (typeof window === "undefined") {
        return position;
    }

    const maxX = Math.max(DEFAULT_MARGIN, window.innerWidth - DEFAULT_WIDTH - DEFAULT_MARGIN);
    const maxY = Math.max(DEFAULT_MARGIN, window.innerHeight - 180);

    return {
        x: Math.min(Math.max(DEFAULT_MARGIN, position.x), maxX),
        y: Math.min(Math.max(DEFAULT_MARGIN, position.y), maxY),
    };
}

function getDefaultPosition() {
    if (typeof window === "undefined") {
        return { x: DEFAULT_MARGIN, y: DEFAULT_TOP };
    }

    return clampPosition({
        x: window.innerWidth - DEFAULT_WIDTH - 24,
        y: DEFAULT_TOP,
    });
}

export default function MayakInspectorWidget({ currentTaskState, onClose, onOpenTask, onReviewTask, sessionSnapshot, storageKey }) {
    const [position, setPosition] = useState(getDefaultPosition);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined" || !storageKey) return;
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
                setPosition(clampPosition(parsed));
            }
        } catch {}
    }, [storageKey]);

    useEffect(() => {
        if (typeof window === "undefined" || !storageKey) return;
        localStorage.setItem(storageKey, JSON.stringify(position));
    }, [position, storageKey]);

    useEffect(() => {
        const handleResize = () => setPosition((prev) => clampPosition(prev));
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const handlePointerMove = (event) => {
            if (!isDraggingRef.current) return;
            setPosition(
                clampPosition({
                    x: event.clientX - dragOffsetRef.current.x,
                    y: event.clientY - dragOffsetRef.current.y,
                })
            );
        };

        const handlePointerUp = () => {
            isDraggingRef.current = false;
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, []);

    const handlePointerDown = (event) => {
        if (event.button !== 0) return;
        isDraggingRef.current = true;
        dragOffsetRef.current = {
            x: event.clientX - position.x,
            y: event.clientY - position.y,
        };
    };

    return (
        <div className="fixed z-40 w-[20rem] max-w-[calc(100vw-2rem)]" style={{ left: position.x, top: position.y }}>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex cursor-move items-center justify-between bg-slate-900 px-4 py-3 text-white" onPointerDown={handlePointerDown}>
                    <div>
                        <div className="text-sm font-semibold">Инспектор</div>
                        <div className="text-[11px] text-slate-300">Перетащите окно в удобное место</div>
                    </div>
                    <button type="button" onClick={onClose} className="inline-flex h-8 w-8 min-h-[2rem] min-w-[2rem] shrink-0 items-center justify-center rounded-full bg-transparent p-0 text-slate-200 transition hover:bg-white/10 hover:text-white" aria-label="Закрыть виджет инспектора">
                        <CloseIcon className="h-3.5 w-3.5" />
                    </button>
                </div>

                <MayakInspectorPanel currentTaskState={currentTaskState} floating onOpenTask={onOpenTask} onReviewTask={onReviewTask} sessionSnapshot={sessionSnapshot} />
            </div>
        </div>
    );
}