import { useEffect, useId, useMemo, useRef, useState } from "react";
import { regions } from "@/lib/rosdk-confrencia/regions";

// Нативный <datalist> подсказывал только по началу строки и молчал, если поле
// уже заполнено: отделение не могло увидеть список и исправить опечатку.
// Здесь список открывается по клику в любой момент, ищет по подстроке и
// управляется с клавиатуры.
//
// Важная поправка: если в поле стоит точное значение из справочника, список
// показывается ЦЕЛИКОМ. Раньше фильтр оставлял одну строку — выбранную, и
// сменить субъект без стирания текста было невозможно.

const MAX_VISIBLE = 8;

function matches(option, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return option.toLowerCase().includes(needle);
}

export function Combobox({
  name,
  value,
  onChange,
  placeholder,
  invalid = false,
  inputClassName,
  options,
  readOnlyInput = false,
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const exact = options.includes(value);

  const filtered = useMemo(() => {
    if (exact) return options;
    const found = options.filter((option) => matches(option, value ?? ""));
    return found.length > 0 ? found : options;
  }, [options, value, exact]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const openList = () => {
    const current = filtered.findIndex((option) => option === value);
    setHighlight(current >= 0 ? current : 0);
    setOpen(true);
    // Текст выделяем: следующая же набранная буква заменит прежний выбор.
    if (exact) inputRef.current?.select();
  };

  const choose = (option) => {
    onChange(option);
    setOpen(false);
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((current) => {
        const next = current + step;
        if (next < 0) return filtered.length - 1;
        if (next >= filtered.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = filtered[highlight];
      if (option) choose(option);
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        name={name}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        readOnly={readOnlyInput}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={openList}
        onClick={openList}
        onKeyDown={onKeyDown}
        className={`${inputClassName} ${readOnlyInput ? "cursor-pointer" : ""} pr-9`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? "Скрыть список" : "Показать список"}
        onClick={() => (open ? setOpen(false) : openList())}
        className="absolute right-0 top-0 flex h-10 !w-9 items-center !justify-center bg-transparent! p-0! text-slate-500! hover:text-slate-600! cursor-pointer"
      >
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 8l5 5 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl shadow-slate-900/10"
          style={{ maxHeight: `${MAX_VISIBLE * 2.5}rem` }}
        >
          {filtered.map((option, index) => (
            <li key={option}>
              <button
                type="button"
                data-index={index}
                role="option"
                aria-selected={option === value}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                className={`block w-full rounded-none! border-0! px-3 py-2 text-left! text-sm cursor-pointer !justify-start ${
                  index === highlight
                    ? "bg-indigo-50! text-indigo-900!"
                    : "bg-white! text-slate-700!"
                } ${option === value ? "font-semibold" : ""}`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}

      {invalid && (
        <span className="sr-only" role="alert">
          Значение не найдено в списке.
        </span>
      )}
    </div>
  );
}

/** Комбобокс субъектов РФ: тот же список, что и в справочнике заявки. */
export function RegionCombobox(props) {
  return <Combobox {...props} options={props.options ?? regions} />;
}
