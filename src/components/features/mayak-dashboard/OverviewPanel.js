import { useMemo } from "react";
import styles from "./dashboard.module.css";
import { MonitorIcon, StarIcon, PlayIcon, PauseIcon, StopIcon } from "./icons";

function formatTime(totalSeconds) {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const mm = String(Math.floor(safe / 60)).padStart(2, "0");
    const ss = String(safe % 60).padStart(2, "0");
    return `${mm}:${ss}`;
}

function AttractiveTimer({ timer, timerHandlers }) {
    const danger = timer.running && timer.remainingSeconds <= 10 && timer.remainingSeconds > 0;
    
    // Percentage for progress ring
    const pct = timer.totalSeconds > 0 ? timer.remainingSeconds / timer.totalSeconds : 1;
    const strokeDashoffset = 565.48 * (1 - pct);

    const PRESETS = [1, 3, 5, 10, 15];

    return (
        <div className={styles.attractiveTimerCard}>
            <div className={styles.timerRingContainer}>
                <svg className={styles.timerRingSvg} viewBox="0 0 200 200">
                    <circle className={styles.timerRingBg} cx="100" cy="100" r="90" />
                    <circle
                        className={`${styles.timerRingFill} ${danger ? styles.timerRingFillDanger : ""}`}
                        cx="100"
                        cy="100"
                        r="90"
                        strokeDasharray="565.48"
                        strokeDashoffset={strokeDashoffset}
                    />
                </svg>
                <div className={`${styles.timerRingDisplay} ${danger ? styles.timerRingDisplayDanger : ""}`}>
                    {formatTime(timer.remainingSeconds)}
                </div>
            </div>

            <div className={styles.timerPresetsRow}>
                {PRESETS.map((minutes) => (
                    <button
                        key={minutes}
                        type="button"
                        className={styles.timerPresetBtn}
                        onClick={() => timerHandlers.setMinutes(minutes)}
                    >
                        {minutes}м
                    </button>
                ))}
            </div>

            <div className={styles.timerActionsRow}>
                <div className={styles.timerInputGroup}>
                    <input
                        className={styles.timerMinutesInput}
                        type="number"
                        min="0"
                        max="180"
                        value={timer.inputMinutes}
                        onChange={(event) => timerHandlers.setMinutes(event.target.value)}
                        aria-label="Минуты"
                    />
                    <span className={styles.timerInputLabel}>мин</span>
                </div>

                {timer.running ? (
                    <button type="button" className={`${styles.iconCircleBtn} ${styles.iconCircleBtnPrimary}`} onClick={timerHandlers.pause} title="Пауза" aria-label="Пауза">
                        <PauseIcon className={styles.iconCircleGlyph} />
                    </button>
                ) : (
                    <button type="button" className={`${styles.iconCircleBtn} ${styles.iconCircleBtnPrimary}`} onClick={timerHandlers.start} title="Старт" aria-label="Старт">
                        <PlayIcon className={styles.iconCircleGlyph} />
                    </button>
                )}

                <button type="button" className={`${styles.iconCircleBtn} ${styles.iconCircleBtnGhost}`} onClick={timerHandlers.reset} title="Сброс" aria-label="Сброс">
                    <StopIcon className={styles.iconCircleGlyph} />
                </button>
            </div>
        </div>
    );
}

function TableOverviewCard({ table, mode, directionsMeta }) {
    // Stage "Я" stats
    const yaApproved = table.participants.reduce((sum, p) => sum + (p.ya?.approvedCount || 0), 0);
    
    const yaStars = useMemo(() => {
        const stars = (table.participants || []).map((p) => {
            const star = p.ya?.star;
            if (star === "gold" || star === true) return { type: "gold", lit: true, title: `${p.name}: Золотая звезда (4/4)` };
            if (star === "joker") return { type: "joker", lit: true, title: `${p.name}: Джокер (3/4)` };
            const count = p.ya?.approvedCount || 0;
            const target = p.ya?.target || 4;
            return { type: "empty", lit: false, title: `${p.name}: В процессе (${count}/${target})` };
        });
        
        // Sort: gold first, then jokers, then empty
        stars.sort((a, b) => {
            const score = (x) => (x.type === "gold" ? 2 : x.type === "joker" ? 1 : 0);
            return score(b) - score(a);
        });

        // Pad to at least 6 stars, do not clamp if more
        while (stars.length < 6) {
            stars.push({ type: "empty", lit: false, title: "Свободное место" });
        }
        return stars;
    }, [table.participants]);

    // Stage "Мы" stats
    const weApproved = table.participants.reduce((sum, p) => sum + (p.we?.approvedCount || 0), 0);
    const tableDirections = useMemo(() => {
        if (!directionsMeta || !table.participants) return [];
        return directionsMeta.map((dirMeta) => {
            let totalCount = 0;
            let viaJoker = false;
            table.participants.forEach((p) => {
                const found = p.we?.directions?.find((d) => d.key === dirMeta.key);
                if (found) {
                    totalCount += found.count || 0;
                    if (found.viaJoker) viaJoker = true;
                }
            });
            return {
                key: dirMeta.key,
                label: dirMeta.label,
                lit: totalCount > 0,
                viaJoker,
            };
        });
    }, [directionsMeta, table.participants]);

    return (
        <div className={styles.overviewTableCard}>
            <div className={styles.overviewTableHead}>
                <span className={styles.overviewTableTitle}>Стол №{table.tableNumber}</span>
                <span className={styles.overviewTableProgressText}>
                    Выполнено: {mode === "ya" ? yaApproved : weApproved} зад.
                </span>
            </div>

            {mode === "ya" ? (
                <div className={styles.overviewTableStats} style={{ justifyContent: "flex-start" }}>
                    <div className={styles.overviewTableStarsHorizontal}>
                        <span className={styles.overviewStatLabel} style={{ marginRight: "12px" }}>Прогресс стола:</span>
                        <div className={styles.overviewTableStarsStrip}>
                            {yaStars.map((star, idx) => (
                                <span key={idx} title={star.title}>
                                    <StarIcon
                                        className={`${styles.overviewTableStar} ${
                                            star.type === "gold"
                                                ? styles.overviewTableStarLitGold
                                                : star.type === "joker"
                                                ? styles.overviewTableStarLitJoker
                                                : ""
                                        }`}
                                        filled={star.lit}
                                    />
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className={styles.overviewDirList}>
                    {tableDirections.map((dir) => (
                        <span
                            key={dir.key}
                            className={styles.overviewDirItem}
                            title={`${dir.label}${dir.viaJoker ? " (звезда-джокер)" : ""}`}
                        >
                            <StarIcon
                                className={`${styles.overviewTableStar} ${dir.viaJoker ? styles.overviewTableStarLitRed : dir.lit ? styles.overviewTableStarLit : ""}`}
                                filled={dir.lit}
                            />
                            <span className={`${styles.overviewDirLabel} ${dir.lit ? styles.overviewDirLabelLit : ""}`}>
                                {dir.label}
                            </span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function OverviewPanel({
    overall,
    tables = [],
    mode = "ya",
    directionsMeta = [],
    expanded = false,
    wide = false,
    timer,
    timerHandlers
}) {
    // wide: «Общий экран» растянут на всю ширину строки сетки (когда столов
    // чётное число и иначе осталась бы пустая ячейка). Тогда таймер и
    // статистика раскладываются горизонтально.
    const compactWide = wide && !expanded;
    const avgDelta = overall?.averageDelta !== undefined ? overall.averageDelta : 0;
    const totalTasks = overall?.approvedTotal !== undefined ? overall.approvedTotal : 0;

    const pct = timer.totalSeconds > 0 ? timer.remainingSeconds / timer.totalSeconds : 1;
    const strokeDashoffset = 565.48 * (1 - pct);
    const danger = timer.running && timer.remainingSeconds <= 10 && timer.remainingSeconds > 0;

    const totalWeTasks = useMemo(() => {
        return tables.reduce((sum, t) => {
            return sum + (t.participants?.reduce((pSum, p) => pSum + (p.we?.approvedCount || 0), 0) || 0);
        }, 0);
    }, [tables]);

    return (
        <section className={`${styles.panel} ${styles.overviewPanel} ${expanded ? styles.panelExpanded : ""} ${compactWide ? styles.overviewWide : ""}`}>
            <header className={`${styles.panelHead} ${styles.overviewHead}`}>
                <div className={styles.panelHeadLeft}>
                    <MonitorIcon className={styles.panelIcon} />
                    <h3 className={styles.panelTitle}>Общий экран</h3>
                </div>
            </header>

            <div className={`${styles.panelBody} ${styles.overviewBody} ${compactWide ? styles.overviewBodyWide : ""}`}>
                {!expanded ? (
                    <>
                        <div className={styles.compactTimerCard}>
                            <div className={styles.compactTimerRingContainer}>
                                <svg className={styles.timerRingSvg} viewBox="0 0 200 200">
                                    <circle className={styles.timerRingBg} cx="100" cy="100" r="90" />
                                    <circle
                                        className={`${styles.timerRingFill} ${danger ? styles.timerRingFillDanger : ""}`}
                                        cx="100"
                                        cy="100"
                                        r="90"
                                        strokeDasharray="565.48"
                                        strokeDashoffset={strokeDashoffset}
                                    />
                                </svg>
                                <div className={`${styles.compactTimerRingDisplay} ${danger ? styles.compactTimerRingDisplayDanger : ""}`}>
                                    {formatTime(timer.remainingSeconds)}
                                </div>
                            </div>
                            <div className={styles.compactTimerControls}>
                                {timer.running ? (
                                    <div className={styles.compactTimerActions}>
                                        <button type="button" className={`${styles.iconCircleBtn} ${styles.iconCircleBtnSm} ${styles.iconCircleBtnPrimary}`} onClick={timerHandlers.pause} title="Пауза" aria-label="Пауза">
                                            <PauseIcon className={styles.iconCircleGlyph} />
                                        </button>
                                        <button type="button" className={`${styles.iconCircleBtn} ${styles.iconCircleBtnSm} ${styles.iconCircleBtnGhost}`} onClick={timerHandlers.reset} title="Остановить" aria-label="Остановить">
                                            <StopIcon className={styles.iconCircleGlyph} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className={styles.compactTimerSetup}>
                                        <div className={styles.compactTimerInputGroup}>
                                            <input
                                                className={styles.compactTimerInput}
                                                type="number"
                                                min="0"
                                                max="180"
                                                value={timer.inputMinutes}
                                                onChange={(event) => timerHandlers.setMinutes(event.target.value)}
                                                aria-label="Минуты"
                                            />
                                            <span className={styles.compactTimerInputLabel}>мин</span>
                                        </div>
                                        <button type="button" className={`${styles.iconCircleBtn} ${styles.iconCircleBtnSm} ${styles.iconCircleBtnPrimary}`} onClick={timerHandlers.start} title="Старт" aria-label="Старт">
                                            <PlayIcon className={styles.iconCircleGlyph} />
                                        </button>
                                        <div className={styles.compactTimerPresets}>
                                            <button
                                                type="button"
                                                className={styles.compactTimerPresetBtn}
                                                onClick={() => timerHandlers.setMinutes(Math.min(180, Math.max(0, (parseInt(timer.inputMinutes || "0", 10) || 0) - 5)))}
                                            >
                                                -5м
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.compactTimerPresetBtn}
                                                onClick={() => timerHandlers.setMinutes(Math.min(180, Math.max(0, (parseInt(timer.inputMinutes || "0", 10) || 0) - 1)))}
                                            >
                                                -1м
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.compactTimerPresetBtn}
                                                onClick={() => timerHandlers.setMinutes(Math.min(180, Math.max(0, (parseInt(timer.inputMinutes || "0", 10) || 0) + 1)))}
                                            >
                                                +1м
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.compactTimerPresetBtn}
                                                onClick={() => timerHandlers.setMinutes(Math.min(180, Math.max(0, (parseInt(timer.inputMinutes || "0", 10) || 0) + 5)))}
                                            >
                                                +5м
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.statsRow} style={{
                            marginTop: compactWide ? 0 : "auto",
                            padding: "0 4px",
                            display: "grid",
                            gridTemplateColumns: compactWide ? "1fr" : (mode === "we" ? "repeat(2, 1fr)" : "repeat(3, 1fr)"),
                            gap: "12px",
                            ...(compactWide ? { flex: "0 0 36%", alignContent: "center" } : {}),
                        }}>
                            {mode !== "we" && (
                                <div className={styles.statCard} style={{ padding: "10px 12px", gap: "10px", borderRadius: "12px", boxShadow: "none", border: "1px solid var(--border-color)", width: "100%", boxSizing: "border-box" }}>
                                    <div className={`${styles.statIconWrapper} ${styles.statIconWrapperGreen}`} style={{ width: "36px", height: "36px" }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                            <polyline points="17 6 23 6 23 12" />
                                        </svg>
                                    </div>
                                    <div className={styles.statInfo} style={{ gap: "2px" }}>
                                        <span className={styles.statLabel} style={{ fontSize: "11px" }}>Ср. дельта</span>
                                        <span className={`${styles.statValue} ${styles.statValueGreen}`} style={{ fontSize: "18px" }}>
                                            {avgDelta}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className={styles.statCard} style={{ padding: "10px 12px", gap: "10px", borderRadius: "12px", boxShadow: "none", border: "1px solid var(--border-color)", width: "100%", boxSizing: "border-box" }}>
                                <div className={`${styles.statIconWrapper} ${styles.statIconWrapperPurple}`} style={{ width: "36px", height: "36px" }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                                <div className={styles.statInfo} style={{ gap: "2px" }}>
                                    <span className={styles.statLabel} style={{ fontSize: "11px" }}>Выполнено</span>
                                    <span className={`${styles.statValue} ${styles.statValuePurple}`} style={{ fontSize: "18px" }}>
                                        {mode === "we" ? `${totalWeTasks} из ${overall?.participantCount * 6}` : totalTasks}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.statCard} style={{ padding: "10px 12px", gap: "10px", borderRadius: "12px", boxShadow: "none", border: "1px solid var(--border-color)", width: "100%", boxSizing: "border-box" }}>
                                <div className={`${styles.statIconWrapper} ${styles.statIconWrapperBlue}`} style={{ width: "36px", height: "36px" }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                </div>
                                <div className={styles.statInfo} style={{ gap: "2px" }}>
                                    <span className={styles.statLabel} style={{ fontSize: "11px" }}>Среднее время выполнения задания</span>
                                    <span className={`${styles.statValue} ${styles.statValueBlue}`} style={{ fontSize: "18px" }}>
                                        {formatTime(overall?.averageTaskTime || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className={styles.overviewSplit}>
                        <div className={styles.overviewLeftCol}>
                            {tables.map((table) => (
                                <TableOverviewCard
                                    key={table.tableNumber}
                                    table={table}
                                    mode={mode}
                                    directionsMeta={directionsMeta}
                                />
                            ))}
                        </div>
                        <div className={styles.overviewRightCol}>
                            <AttractiveTimer timer={timer} timerHandlers={timerHandlers} />
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
