// DropdownInput.jsx
import { useEffect, useRef } from "react";
import { useDropdownFilter } from "./helpers";

export default function DropdownInput({
    value: controlledValue, // ожидаем ID (число) или строку
    onChange,
    name,
    src,
    options,
    ...props
}) {
    const dropdownRef = useRef(null);
    const { inputValue, filtered, showDropdown, handleInput, handleSelect, setShowDropdown, handleEnter } = useDropdownFilter(controlledValue, onChange, src, name, options);

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleEnter();
        }
    };

    useEffect(() => {
        const close = (e) => {
            if (!dropdownRef.current?.contains(e.target)) setShowDropdown(false);
        };
        document.addEventListener("click", close);
        return () => document.removeEventListener("click", close);
    }, [setShowDropdown]);

    return (
        <div className={`input-wrapper relative w-full ${showDropdown ? " input-wrapper--dropdown-open" : ""}`} ref={dropdownRef}>
            <input
                type="text"
                value={inputValue} // ← теперь отображается название
                onChange={(e) => handleInput(e.target.value)}
                onFocus={() => inputValue && setShowDropdown(true)}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                name={name}
                {...props}
            />
            {showDropdown && (
                <div className="dropdown-wrapper">
                    <div className="dropdown" style={{ transition: "opacity 0.25s, transform 0.25s", opacity: 1, transform: "translateY(0)" }}>
                        {filtered.map((item) => (
                            <p key={item.value} onClick={() => handleSelect(item)} className="cursor-pointer hover:bg-gray-100 px-2 py-1">
                                {item.label}
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
