import { useState, useEffect, useCallback, useRef } from "react";

export function useDropdownFilter(controlledValue, onChange, src, name, options, onQueryChange) {
    const [inputValue, setInputValue] = useState("");
    const [items, setItems] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    // Выбранный вариант исчезает из DOM прямо во время обработки клика, и
    // браузер добивает событие по элементу под курсором — то есть по самому
    // полю. Его onClick открывал список заново: значение выбрано, а список
    // снова висит, будто выбор не сработал. Флаг съедает ровно этот клик.
    const skipNextOpenRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        let frameId = null;
        if (options && Array.isArray(options)) {
            const mapped = options.map((opt) => ({
                value: opt.id ?? opt.organization_id ?? opt.value ?? opt,
                label: opt.short_name ?? opt.label ?? opt,
            }));
            frameId = requestAnimationFrame(() => {
                setItems(mapped);
            });
        } else if (src) {
            fetch(src)
                .then((res) => res.text())
                .then((text) => {
                    if (cancelled) return;
                    const lines = text
                        .split("\n")
                        .map((l) => l.trim())
                        .filter(Boolean);
                    setItems(lines.map((l) => ({ value: l, label: l })));
                });
        }

        return () => {
            cancelled = true;
            if (frameId) {
                cancelAnimationFrame(frameId);
            }
        };
    }, [options, src]);

    useEffect(() => {
        let frameId = null;
        if (controlledValue && items.length > 0) {
            const match = items.find((i) => String(i.value) === String(controlledValue));
            if (match) {
                frameId = requestAnimationFrame(() => {
                    setInputValue(match.label);
                });
            } else if (!options) {
                // Справочник из текстового файла: значение и есть подпись.
                // Регион, которого нет в regions.txt (старая запись, ручной
                // ввод), иначе показывался пустым полем — как будто не заполнен.
                frameId = requestAnimationFrame(() => {
                    setInputValue(String(controlledValue));
                });
            }
        } else if (!controlledValue) {
            frameId = requestAnimationFrame(() => {
                setInputValue("");
            });
        }

        return () => {
            if (frameId) {
                cancelAnimationFrame(frameId);
            }
        };
    }, [controlledValue, items, options]);

    const handleInput = (val) => {
        setInputValue(val);
        onQueryChange?.(val);
        if (!val) {
            onChange?.({ target: { name, value: "" } });
            setFiltered([]);
            setShowDropdown(false);
            return;
        }
        const matches = items.filter((i) => String(i.label).toLowerCase().includes(val.toLowerCase()));
        setFiltered(matches);
        setShowDropdown(true);
    };

    // Открыть список без ввода: пользователю нужно уметь пролистать варианты,
    // а не угадывать первую букву. Раньше список появлялся только при наборе,
    // и заполненное поле выглядело как тупик.
    const openDropdown = () => {
        if (skipNextOpenRef.current) {
            skipNextOpenRef.current = false;
            return;
        }
        const query = String(inputValue || "").trim().toLowerCase();
        // Значение в поле — уже выбранный вариант, а не поисковый запрос:
        // фильтровать по нему нельзя, иначе список схлопывается в одну строку
        // и соседний регион не выбрать, не стерев поле руками.
        const isPickedValue = items.some((i) => String(i.label).toLowerCase() === query);
        const matches = query && !isPickedValue ? items.filter((i) => String(i.label).toLowerCase().includes(query)) : items;
        setFiltered(matches.length > 0 ? matches : items);
        setShowDropdown(true);
    };

    const handleBlur = () => {
        const trimmed = String(inputValue || "").trim();
        if (!trimmed) {
            onChange?.({ target: { name, value: "" } });
            setShowDropdown(false);
            return;
        }
        const byLabel = items.find((i) => String(i.label).toLowerCase() === trimmed.toLowerCase());
        if (byLabel) {
            onChange?.({ target: { name, value: byLabel.value } });
            setInputValue(byLabel.label);
            setShowDropdown(false);
            return;
        }
        if (/^\d+$/.test(trimmed)) {
            onChange?.({ target: { name, value: Number(trimmed) } });
            setShowDropdown(false);
            return;
        }
        setShowDropdown(false);
    };

    const commitPendingValue = useCallback(() => {
        const trimmed = String(inputValue || "").trim();
        if (!trimmed) {
            onChange?.({ target: { name, value: "" } });
            setShowDropdown(false);
            return "";
        }
        const byLabel = items.find((i) => String(i.label).toLowerCase() === trimmed.toLowerCase());
        if (byLabel) {
            onChange?.({ target: { name, value: byLabel.value } });
            setInputValue(byLabel.label);
            setShowDropdown(false);
            return byLabel.value;
        }
        if (/^\d+$/.test(trimmed)) {
            const n = Number(trimmed);
            onChange?.({ target: { name, value: n } });
            setShowDropdown(false);
            return n;
        }
        setShowDropdown(false);
        return controlledValue ?? "";
    }, [controlledValue, inputValue, items, name, onChange]);

    const handleSelect = (item) => {
        skipNextOpenRef.current = true;
        setInputValue(item.label);
        setShowDropdown(false);
        onChange?.({ target: { name, value: item.value } });
    };

    const handleEnter = () => {
        const normalizedInput = String(inputValue || "").toLowerCase();
        const exactMatch = items.find((item) => String(item.label).toLowerCase() === normalizedInput);
        if (exactMatch) {
            handleSelect(exactMatch);
            return;
        }

        if (filtered.length > 0) {
            handleSelect(filtered[0]);
            return;
        }

        setShowDropdown(false);
    };

    return {
        inputValue,
        filtered,
        openDropdown,
        showDropdown,
        setShowDropdown,
        handleInput,
        handleSelect,
        handleEnter,
        handleBlur,
        commitPendingValue,
    };
}
