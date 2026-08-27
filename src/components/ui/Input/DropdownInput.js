import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useDropdownFilter } from "./helpers";

const DropdownInput = forwardRef(function DropdownInput(
    { value: controlledValue, onChange, name, src, options, onQueryChange, ...props },
    ref
) {
    const dropdownRef = useRef(null);
    const { inputValue, filtered, showDropdown, handleInput, handleSelect, setShowDropdown, handleEnter, handleBlur, commitPendingValue, openDropdown } =
        useDropdownFilter(controlledValue, onChange, src, name, options, onQueryChange);

    useImperativeHandle(ref, () => ({ commitPendingValue }), [commitPendingValue]);

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleEnter?.();
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
                value={inputValue}
                onChange={(e) => handleInput(e.target.value)}
                onBlur={handleBlur}
                onFocus={() => !props.disabled && openDropdown()}
                onClick={() => !props.disabled && openDropdown()}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                name={name}
                {...props}
            />
            {showDropdown && (
                // mousedown по варианту гасим: иначе input теряет фокус, handleBlur
                // закрывает список, вариант размонтируется — и click по нему уже
                // некому обработать. Выбор мышью просто не срабатывал.
                <div className="dropdown-wrapper" onMouseDown={(event) => event.preventDefault()}>
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
});

DropdownInput.displayName = "DropdownInput";

export default DropdownInput;
