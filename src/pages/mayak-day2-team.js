import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

import { day2AccentColors } from "@/lib/mayakDay2Palette";
import { formatDay2Remaining } from "@/lib/mayakDay2Schedule";

// Седьмая ячейка стола: экран, на котором день виден целиком, пока тайлы лежат
// врозь. Открывается на ноутбуке команды утром и не закрывается до вечера,
// поэтому здесь нет ни входа, ни навигации, ни ничего, что можно случайно
// нажать. Смотрят на него с трёх метров — отсюда размеры.
//
//     /mayak-day2-team?session=<id>&table=1
//
// Чего на нём нет намеренно (ТЗ, раздел В11): содержания заданий, чужих команд
// и персональных показателей. Кто сдал — общее дело, как кто работал — нет.

const POLL_MS = 5000;

const TILE_LOOK = {
    approved: { label: "сдано", fg: "#0F6E56", bg: "#E1F5EE" },
    pending: { label: "на проверке", fg: "#854F0B", bg: "#FAEEDA" },
    rejected: { label: "вернули", fg: "#A32D2D", bg: "#FCEBEB" },
    none: { label: "", fg: "#5F5E5A", bg: "#F1EFE8" },
};

function Tile({ tile }) {
    const look = TILE_LOOK[tile.status] || TILE_LOOK.none;
    const [color] = day2AccentColors(tile.number);

    return (
        <div
            style={{
                background: look.bg,
                borderRadius: 16,
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                opacity: tile.taken ? 1 : 0.45,
            }}>
            <span style={{ width: 8, alignSelf: "stretch", borderRadius: 4, background: color || "#D3D1C7" }} />
            <span style={{ fontSize: 40, fontWeight: 600, color: look.fg, lineHeight: 1 }}>{tile.number}</span>
            <span style={{ fontSize: 18, color: look.fg }}>
                {tile.taken ? look.label || "в работе" : "никто не взял"}
            </span>
        </div>
    );
}

function Row({ title, value }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, padding: "6px 0" }}>
            <span style={{ color: "#5F5E5A" }}>{title}</span>
            <span style={{ fontWeight: 600 }}>{value}</span>
        </div>
    );
}

export default function MayakDay2TeamScreen() {
    const router = useRouter();
    const sessionId = String(router.query?.session || "");
    const table = String(router.query?.table || "");

    const [board, setBoard] = useState(null);
    const [error, setError] = useState("");
    // Секундная стрелка. Остаток считается от серверной метки конца, а не
    // накапливается: ноутбук за день успеет и уснуть, и потерять сеть, а
    // накопленный счётчик после этого врал бы.
    const [now, setNow] = useState(() => Date.now());

    const load = useCallback(async () => {
        if (!sessionId || !table) return;
        try {
            const response = await fetch(
                `/api/mayak/session-runtime/team?sessionId=${encodeURIComponent(sessionId)}&table=${encodeURIComponent(table)}`,
                { cache: "no-store" }
            );
            const payload = await response.json();
            if (!payload?.success) {
                setError(payload?.error || "Экран не собрался");
                return;
            }
            setError("");
            setBoard(payload.data);
        } catch {
            setError("Сеть не отвечает");
        }
    }, [sessionId, table]);

    useEffect(() => {
        if (!router.isReady) return undefined;
        // Первый запрос — следующим тиком, а не прямо в эффекте: иначе первая
        // же отрисовка тянет за собой каскад из ответа сети.
        const first = window.setTimeout(load, 0);
        const id = window.setInterval(load, POLL_MS);
        return () => {
            window.clearTimeout(first);
            window.clearInterval(id);
        };
    }, [router.isReady, load]);

    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);

    if (!router.isReady) return null;

    if (!sessionId || !table) {
        return (
            <Screen>
                <p style={{ fontSize: 22, color: "#5F5E5A" }}>
                    Экран открывается со ссылкой вида
                    <br />
                    <code>/mayak-day2-team?session=&lt;id сессии&gt;&amp;table=1</code>
                </p>
            </Screen>
        );
    }

    if (error) {
        return (
            <Screen>
                <p style={{ fontSize: 24, color: "#A32D2D" }}>{error}</p>
            </Screen>
        );
    }

    if (!board) {
        return (
            <Screen>
                <p style={{ fontSize: 24, color: "#5F5E5A" }}>Собираем экран стола…</p>
            </Screen>
        );
    }

    const takt = board.takt || {};
    const remaining = takt.expiresAt
        ? Math.max(0, Math.ceil((Date.parse(takt.expiresAt) - now) / 1000))
        : takt.remainingSeconds || 0;

    return (
        <Screen>
            <Head>
                <title>{`Команда «${board.name}»`}</title>
            </Head>

            <header
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 24,
                    borderBottom: "1px solid #D3D1C7",
                    paddingBottom: 18,
                }}>
                <h1 style={{ fontSize: 44, fontWeight: 600, margin: 0 }}>Команда «{board.name}»</h1>
                <div style={{ fontSize: 30, fontWeight: 600, textAlign: "right" }}>
                    <div style={{ fontSize: 20, color: "#5F5E5A", fontWeight: 400 }}>{takt.label}</div>
                    {takt.running
                        ? takt.overdue || remaining <= 0
                            ? <span style={{ color: "#A32D2D" }}>время вышло</span>
                            : <span>осталось {formatDay2Remaining(remaining)}</span>
                        : <span style={{ color: "#5F5E5A" }}>не начат</span>}
                </div>
            </header>

            <section>
                <h2 style={{ fontSize: 20, color: "#5F5E5A", fontWeight: 400, letterSpacing: "0.04em", margin: "28px 0 14px" }}>
                    СДАНО
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
                    {board.tiles.map((tile) => (
                        <Tile key={tile.number} tile={tile} />
                    ))}
                </div>
            </section>

            <section style={{ marginTop: 32, maxWidth: 560 }}>
                <h2 style={{ fontSize: 20, color: "#5F5E5A", fontWeight: 400, letterSpacing: "0.04em", margin: "0 0 8px" }}>
                    СОБРАНО
                </h2>
                <Row title="детали" value={`${board.counts.details} из ${board.counts.detailsTotal}`} />
                <Row title="узлы" value={`${board.counts.nodes} из ${board.counts.nodesTotal}`} />
                <Row title="изделие" value={board.assembly === "approved" ? "готово" : "—"} />
                {board.counts.adapters > 0 && (
                    <Row title="переходники" value={board.counts.adapters} />
                )}
            </section>
        </Screen>
    );
}

function Screen({ children }) {
    return (
        <main
            style={{
                minHeight: "100vh",
                background: "#FFFFFF",
                color: "#2C2C2A",
                padding: "48px 56px",
                fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            }}>
            {children}
        </main>
    );
}
