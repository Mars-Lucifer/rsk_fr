import { useState, useRef, useEffect } from "react";

// Drag-and-drop для теста-ранжирования (вынесено из RankingTestPopup, этап 5).
// Кастомное перетаскивание без HTML5 DnD (убирает курсор 🚫 и «призрак»),
// с автоскроллом у краёв, поддержкой мыши и тача.
//
// ВАЖНО: семантика сохранена 1:1 с исходным инлайном —
//  - обработчики не мемоизированы (обычные функции), document/element-слушатели
//    переподписываются каждый рендер (deps [handleMove, handleEnd]);
//  - актуальный уровень читается через currentLevelRef (а не из замыкания).
//
// Параметры:
//   userOrder        — текущий порядок id на активном уровне (для handle*Start)
//   isLevelDone      — уровень завершён → перетаскивание заблокировано
//   currentLevelRef  — ref на индекс активного уровня
//   setUserOrders    — сеттер массива порядков по уровням
//
// Возвращает refs для разметки (listRef, scrollContainerRef), dragId (для
// подсветки) и обработчики начала перетаскивания (handleMouseDown/handleTouchStart).
export function useRankingDragAndDrop({ userOrder, isLevelDone, currentLevelRef, setUserOrders }) {
    const [dragId, setDragId] = useState(null);
    const dragIdRef = useRef(null);

    const touchState = useRef({ dragging: false, dragId: null });
    const mouseState = useRef({ dragging: false, dragId: null });
    const listRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const autoScrollRef = useRef(null);

    // --- Автоскролл при перетаскивании к краям ---
    const SCROLL_ZONE = 80; // px от края где начинается скролл
    const SCROLL_SPEED = 12; // px за кадр

    const startAutoScroll = (clientY) => {
        stopAutoScroll();
        const container = scrollContainerRef.current;
        if (!container) return;

        const tick = () => {
            const rect = container.getBoundingClientRect();
            const y = autoScrollRef.current?.lastY ?? clientY;

            if (y < rect.top + SCROLL_ZONE) {
                // Скролл вверх
                const intensity = 1 - Math.max(0, y - rect.top) / SCROLL_ZONE;
                container.scrollTop -= SCROLL_SPEED * intensity;
            } else if (y > rect.bottom - SCROLL_ZONE) {
                // Скролл вниз
                const intensity = 1 - Math.max(0, rect.bottom - y) / SCROLL_ZONE;
                container.scrollTop += SCROLL_SPEED * intensity;
            }

            autoScrollRef.current.raf = requestAnimationFrame(tick);
        };

        autoScrollRef.current = { lastY: clientY, raf: requestAnimationFrame(tick) };
    };

    const updateAutoScroll = (clientY) => {
        if (autoScrollRef.current) {
            autoScrollRef.current.lastY = clientY;
        }
    };

    const stopAutoScroll = () => {
        if (autoScrollRef.current?.raf) {
            cancelAnimationFrame(autoScrollRef.current.raf);
        }
        autoScrollRef.current = null;
    };

    // --- Mouse Drag: кастомное перетаскивание без HTML5 DnD ---
    const handleMouseDown = (e, idx) => {
        if (isLevelDone) return;
        // Игнорируем клики по кнопкам стрелок
        if (e.target.closest("button")) return;
        e.preventDefault();
        const id = userOrder[idx];
        mouseState.current.dragging = true;
        mouseState.current.dragId = id;
        setDragId(id);
        dragIdRef.current = id;
        startAutoScroll(e.clientY);
    };

    const handleMouseMove = (e) => {
        if (!mouseState.current.dragging || !listRef.current) return;
        e.preventDefault();
        updateAutoScroll(e.clientY);
        const currentDragId = mouseState.current.dragId;
        if (currentDragId === null) return;

        const lvl = currentLevelRef.current;
        const items = Array.from(listRef.current.querySelectorAll("[data-drag-idx]"));

        // Ищем элемент под курсором
        let targetItem = null;
        for (const item of items) {
            const rect = item.getBoundingClientRect();
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                targetItem = item;
                break;
            }
        }

        if (!targetItem) return;

        const overIdx = parseInt(targetItem.getAttribute("data-drag-idx"), 10);
        setUserOrders((prev) => {
            const order = prev[lvl];
            const currentIdx = order.indexOf(currentDragId);
            if (currentIdx === -1 || currentIdx === overIdx) return prev;

            const rect = targetItem.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            if (currentIdx < overIdx && e.clientY < centerY) return prev;
            if (currentIdx > overIdx && e.clientY > centerY) return prev;

            const newOrders = [...prev];
            const newOrder = [...order];
            const [moved] = newOrder.splice(currentIdx, 1);
            newOrder.splice(overIdx, 0, moved);
            newOrders[lvl] = newOrder;
            return newOrders;
        });
    };

    const handleMouseUp = () => {
        if (!mouseState.current.dragging) return;
        stopAutoScroll();
        mouseState.current.dragging = false;
        mouseState.current.dragId = null;
        setDragId(null);
        dragIdRef.current = null;
    };

    // Слушаем mousemove/mouseup на document чтобы drag работал даже за пределами списка
    useEffect(() => {
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    // --- Touch: живое перемещение ---
    const handleTouchStart = (e, idx) => {
        if (isLevelDone) return;
        const id = userOrder[idx];
        touchState.current.dragging = true;
        touchState.current.dragId = id;
        setDragId(id);
        dragIdRef.current = id;
        const touch = e.touches[0];
        startAutoScroll(touch.clientY);
    };

    const handleTouchMove = (e) => {
            if (!touchState.current.dragging || !listRef.current) return;
            e.preventDefault();
            const touch = e.touches[0];
            updateAutoScroll(touch.clientY);
            const currentDragId = touchState.current.dragId;
            if (currentDragId === null) return;

            const lvl = currentLevelRef.current;
            const items = Array.from(listRef.current.querySelectorAll("[data-drag-idx]"));

            // Ищем элемент под пальцем
            let targetItem = null;
            for (const item of items) {
                const rect = item.getBoundingClientRect();
                if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                    targetItem = item;
                    break;
                }
            }

            if (!targetItem) return;

            const overIdx = parseInt(targetItem.getAttribute("data-drag-idx"), 10);
            // Получаем актуальный порядок через ref-accessible state
            setUserOrders((prev) => {
                const order = prev[lvl];
                const currentIdx = order.indexOf(currentDragId);
                if (currentIdx === -1 || currentIdx === overIdx) return prev;

                const rect = targetItem.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                if (currentIdx < overIdx && touch.clientY < centerY) return prev;
                if (currentIdx > overIdx && touch.clientY > centerY) return prev;

                const newOrders = [...prev];
                const newOrder = [...order];
                const [moved] = newOrder.splice(currentIdx, 1);
                newOrder.splice(overIdx, 0, moved);
                newOrders[lvl] = newOrder;
                return newOrders;
            });
        };

    const handleTouchEnd = () => {
        if (!touchState.current.dragging) return;
        stopAutoScroll();
        touchState.current.dragging = false;
        touchState.current.dragId = null;
        setDragId(null);
        dragIdRef.current = null;
    };

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        el.addEventListener("touchmove", handleTouchMove, { passive: false });
        el.addEventListener("touchend", handleTouchEnd);
        return () => {
            el.removeEventListener("touchmove", handleTouchMove);
            el.removeEventListener("touchend", handleTouchEnd);
        };
    }, [handleTouchMove, handleTouchEnd]);

    return {
        dragId,
        listRef,
        scrollContainerRef,
        handleMouseDown,
        handleTouchStart,
    };
}
