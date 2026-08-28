import { useEffect, useState } from "react";

import { formatDay2Remaining } from "@/lib/mayakDay2Schedule";

// Пульт такта второго дня.
//
// Кнопку нажимает человек: по расписанию само ничего не переключается, потому
// что реальность вносит поправки каждый раз, и решение «идём дальше» принимает
// ведущий, глядя в зал, а не таймер, глядя в календарь (ТЗ, раздел В10).
//
// Локального таймера здесь намеренно нет — тот, что рядом в OverviewPanel,
// живёт в браузере ведущего, и два открытых пульта показывают разное время.
// Этот отсчёт идёт от серверной метки конца, поэтому у ведущего, у командного
// экрана и у восемнадцати телефонов он один.

const SHIFTS = [-10, -5, 5, 10];

export default function Day2TaktPanel({ takt, onAction, busy, error, debug }) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);

    if (!takt) return null;

    const remaining = takt.expiresAt
        ? Math.max(0, Math.ceil((Date.parse(takt.expiresAt) - now) / 1000))
        : takt.remainingSeconds || 0;
    const overdue = takt.running && remaining <= 0;

    const button = (label, action, minutes, extra = {}) => (
        <button
            type="button"
            disabled={busy || extra.off}
            title={extra.why || ""}
            onClick={() => onAction(action, minutes)}
            style={{
                border: "1px solid #D3D1C7",
                background: extra.primary ? "#2C2C2A" : "#FFFFFF",
                color: extra.primary ? "#FFFFFF" : "#2C2C2A",
                borderRadius: 10,
                padding: "8px 14px",
                fontSize: 14,
                cursor: busy || extra.off ? "default" : "pointer",
                opacity: busy || extra.off ? 0.4 : 1,
                // В проекте глобальное `button { width: 100% }` — без этого
                // «Снять» и «Следующий такт» растягиваются на всю панель.
                width: "auto",
                flex: "0 0 auto",
            }}>
            {label}
        </button>
    );

    return (
        <section
            style={{
                border: "1px solid #D3D1C7",
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginBottom: 16,
            }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <span style={{ fontSize: 18, fontWeight: 500 }}>{takt.label}</span>
                <span style={{ fontSize: 26, fontWeight: 600, color: overdue ? "#A32D2D" : "#2C2C2A" }}>
                    {takt.running ? (overdue ? "время вышло" : formatDay2Remaining(remaining)) : "не начат"}
                </span>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {takt.running
                    ? button("Снять", "stop")
                    : button("Запустить такт", "start", undefined, { primary: true })}
                {takt.running && !overdue && button("Завершить такт", "finish")}
                {button("Следующий такт", "next", undefined, {
                    primary: overdue,
                    // Через голову идущего такта не перешагиваем: три стола
                    // окажутся в разных местах дня. Закончить раньше можно,
                    // но осознанно — соседней кнопкой.
                    off: !takt.running || !overdue,
                    why: !takt.running
                        ? "Текущий такт ещё не запускали"
                        : !overdue
                        ? "Такт ещё идёт — дождитесь конца или завершите его"
                        : "",
                })}
                <span style={{ width: 12 }} />
                {debug && button("Сбросить в такт 1", "reset")}
                {SHIFTS.map((minutes) =>
                    <span key={minutes}>{button(minutes > 0 ? `+${minutes} мин` : `${minutes} мин`, "shift", minutes)}</span>
                )}
            </div>

            <span style={{ fontSize: 13, color: error ? "#A32D2D" : "#5F5E5A" }}>
                {error
                    || (overdue
                        ? "Время такта вышло. Можно переходить к следующему."
                        : takt.running
                        ? "Такт идёт у всех столов одновременно. Следующий откроется, когда время выйдет."
                        : "Такт зала: 90 · 70 · 45 минут. Пока не запущен, у участников время не идёт.")}
            </span>
        </section>
    );
}
