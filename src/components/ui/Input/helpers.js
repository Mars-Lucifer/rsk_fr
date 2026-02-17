// helpers.js
import { useState, useEffect } from "react";

export function useDropdownFilter(controlledValue, onChange, src, name, options) {
    const [inputValue, setInputValue] = useState(""); // то, что видит пользователь
    const [selectedValue, setSelectedValue] = useState(controlledValue || "");
    const [items, setItems] = useState([]); // массив { value, label }
    const [filtered, setFiltered] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);

    // Синхронизация с controlledValue (извне)
    useEffect(() => {
        if (controlledValue !== undefined) {
            setSelectedValue(controlledValue);
            // Если есть items, найдём лейбл для отображения
            if (items.length > 0) {
                const match = items.find((item) => item.value == controlledValue);
                setInputValue(match ? match.label : "");
            }
        }
    }, [controlledValue, items]);

    // Загрузка/преобразование опций
    useEffect(() => {
        if (options && Array.isArray(options)) {
            // Если передан массив объектов с id/short_name
            if (options.length > 0 && typeof options[0] === "object" && options[0].id != null) {
                const mapped = options.map((opt) => ({
                    value: opt.id,
                    label: opt.short_name,
                }));
                // Уникализация по value (на всякий случай)
                const unique = Array.from(new Map(mapped.map((item) => [item.value, item])).values());
                unique.sort((a, b) => a.label.localeCompare(b.label));
                setItems(unique);
            } else {
                // Массив строк
                const unique = [...new Set(options)];
                unique.sort((a, b) => a.localeCompare(b));
                setItems(unique.map((str) => ({ value: str, label: str })));
            }
            return;
        }

        // Загрузка из файла (регионы)
        if (src) {
            fetch(src)
                .then((res) => res.text())
                .then((text) => {
                    const loaded = text
                        .split("\n")
                        .map((l) => l.trim())
                        .filter(Boolean);
                    const unique = [...new Set(loaded)];
                    unique.sort((a, b) => a.localeCompare(b));
                    setItems(unique.map((str) => ({ value: str, label: str })));
                })
                .catch((err) => console.error("Failed to load:", err));
        }
    }, [src, options]);

    // Фильтрация по введённому тексту
    useEffect(() => {
        if (!inputValue) {
            setFiltered([]);
            setShowDropdown(false);
            return;
        }
        const matches = items.filter((item) => item.label.toLowerCase().includes(inputValue.toLowerCase()));
        setFiltered(matches);
        setShowDropdown(matches.length > 0);
    }, [inputValue, items]);

    const handleInput = (val) => {
        setInputValue(val);
        // Если пользователь стирает текст, сбрасываем выбранное значение
        if (!val) {
            setSelectedValue("");
            onChange?.({ target: { name: name || "", value: "" } });
        }
        setShowDropdown(true);
    };

    const handleSelect = (item) => {
        setInputValue(item.label);
        setSelectedValue(item.value);
        onChange?.({ target: { name: name || "", value: item.value } });
        setShowDropdown(false);
    };

    const handleEnter = () => {
        if (filtered.length > 0) {
            handleSelect(filtered[0]);
        }
    };

    return {
        inputValue, // для отображения в <input>
        selectedValue, // для внешнего контрола (controlledValue)
        filtered,
        showDropdown,
        setShowDropdown,
        handleInput,
        handleSelect,
        handleEnter,
        items, // если понадобятся все опции
    };
}
