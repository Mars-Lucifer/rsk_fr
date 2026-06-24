// Вычисляемые из данных стили ячеек таблицы. Цвета зависят от состояния
// (ошибка/предупреждение/выделение/активная/наличие файла) и не выражаются
// статическими Tailwind-классами без потери читаемости, поэтому остаются
// инлайновыми, но собраны здесь в одном месте.

// Фон ячейки. warn — янтарная подсветка «нужно исправить» (напр. тип не по
// стандарту); приоритет: ошибка → warn → выделение → состояние файла.
export function getCellBg({ error, warn, selected, isActive, fileCol, fileNumberMismatch, value, fileExists }) {
    return error ? "#fff0f0"
        : warn && !selected ? "#fff7ed"
        : selected && !isActive ? "#d3e3fd"
        : fileCol && fileNumberMismatch && value ? "#fef2f2"
        : fileCol && fileExists === true && !fileNumberMismatch ? "#f0fdf4"
        : fileCol && fileExists === false && value ? "#fefce8"
        : "#fff";
}

// Рамка ячейки. Активная ячейка — толстая синяя (как в Google Sheets).
export function getCellBorder({ error, isActive, warn, fileCol, fileNumberMismatch, value, selected }) {
    return error ? "1px solid #f87171"
        : isActive ? "2px solid #1a73e8"
        : warn ? "1px solid #f59e0b"
        : fileCol && fileNumberMismatch && value ? "1px solid #f87171"
        : selected ? "1px solid #1a73e8"
        : "1px solid #e2e8f0";
}

// Цвета авто-галочки по состоянию: "none" | "yellow" | "green".
export function getAutoCheckboxColors(state) {
    const st = state || "none";
    return {
        bgColor: st === "green" ? "#f0fdf4" : st === "yellow" ? "#fefce8" : "#fff",
        borderColor: st === "green" ? "#22c55e" : st === "yellow" ? "#eab308" : "#cbd5e1",
        fillColor: st === "green" ? "#22c55e" : st === "yellow" ? "#eab308" : "#fff",
        show: st !== "none",
    };
}
