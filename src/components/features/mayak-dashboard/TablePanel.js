import { memo } from "react";
import styles from "./dashboard.module.css";
import ParticipantRow from "./ParticipantRow";
import { FolderIcon } from "./icons";

function formatDuration(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return "—";
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return `${mm}:${ss}`;
}

// Панель одного стола. mode: "ya" | "we".
function TablePanel({
    table,
    mode,
    directionsMeta = [],
    editorMode = false,
    expanded = false,
    draggingUserId = null,
    dropActive = false,
    onChangeRole,
    onRemove,
    onPersonDragStart,
    onPersonDragEnd,
    onTableDragOver,
    onTableDragLeave,
    onTableDrop,
}) {
    return (
        <section
            className={`${styles.panel} ${styles.tablePanel} ${dropActive ? styles.panelDropActive : ""} ${expanded ? styles.tablePanelExpanded : ""}`}
            onDragOver={editorMode ? (event) => onTableDragOver?.(event, table.tableNumber) : undefined}
            onDragLeave={editorMode ? onTableDragLeave : undefined}
            onDrop={editorMode ? (event) => onTableDrop?.(event, table.tableNumber) : undefined}
        >
            <header className={styles.panelHead}>
                <div className={styles.panelHeadLeft}>
                    <FolderIcon className={styles.panelFolderIcon} />
                    <h3 className={styles.panelTitle}>Стол №{table.tableNumber}</h3>
                </div>
            </header>

            <div className={styles.panelBody}>
                {table.participants.length === 0 ? (
                    <div className={styles.emptyHint}>
                        {editorMode ? "Перетащите участника сюда" : "Пока никто не подключился к этому столу"}
                    </div>
                ) : (
                    <>
                        <div className={styles.tableResponsive}>
                            <table className={styles.participantTable}>
                                {mode === "ya" ? (
                                    <>
                                        <thead>
                                            <tr>
                                                <th>УЧАСТНИК</th>
                                                <th>РОЛЬ</th>
                                                <th className={styles.thCenter}>ДЕЛЬТА 5 УР.</th>
                                                <th>СПЕЦИАЛИЗАЦИЯ</th>
                                                <th>Прогресс Я</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {table.participants.map((participant) => (
                                                <ParticipantRow
                                                    key={participant.userId}
                                                    participant={participant}
                                                    mode={mode}
                                                    editorMode={editorMode}
                                                    big={expanded}
                                                    dragging={draggingUserId === participant.userId}
                                                    onChangeRole={onChangeRole}
                                                    onRemove={onRemove}
                                                    onDragStart={onPersonDragStart}
                                                    onDragEnd={onPersonDragEnd}
                                                />
                                            ))}
                                        </tbody>
                                    </>
                                ) : (
                                    <>
                                        <thead>
                                            <tr>
                                                <th>УЧАСТНИК</th>
                                                <th>РОЛЬ</th>
                                                <th>Направление</th>
                                                <th>Индекс цифровой зрелости</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {table.participants.map((participant, index) => (
                                                <ParticipantRow
                                                    key={participant.userId}
                                                    participant={participant}
                                                    mode={mode}
                                                    rowIndex={index}
                                                    directionsMeta={directionsMeta}
                                                    editorMode={editorMode}
                                                    big={expanded}
                                                    dragging={draggingUserId === participant.userId}
                                                    onChangeRole={onChangeRole}
                                                    onRemove={onRemove}
                                                    onDragStart={onPersonDragStart}
                                                    onDragEnd={onPersonDragEnd}
                                                />
                                            ))}
                                        </tbody>
                                    </>
                                )}
                            </table>
                        </div>

                        {/* Table specific metrics under table */}
                        <div className={styles.statsRow} style={{
                            marginTop: "auto",
                            padding: "0 4px",
                            display: "grid",
                            gridTemplateColumns: mode === "we" ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
                            gap: "12px"
                        }}>
                            {mode !== "we" && (
                                <div className={styles.statCard} style={{ padding: "10px 12px", gap: "10px", borderRadius: "12px", boxShadow: "none", border: "1px solid var(--border-color)" }}>
                                    <div className={`${styles.statIconWrapper} ${styles.statIconWrapperGreen}`} style={{ width: "36px", height: "36px" }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                            <polyline points="17 6 23 6 23 12" />
                                        </svg>
                                    </div>
                                    <div className={styles.statInfo} style={{ gap: "2px" }}>
                                        <span className={styles.statLabel} style={{ fontSize: "11px" }}>Ср. дельта</span>
                                        <span className={`${styles.statValue} ${styles.statValueGreen}`} style={{ fontSize: "18px" }}>
                                            {table.totals.averageDelta !== null && table.totals.averageDelta !== undefined ? table.totals.averageDelta : "—"}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className={styles.statCard} style={{ padding: "10px 12px", gap: "10px", borderRadius: "12px", boxShadow: "none", border: "1px solid var(--border-color)" }}>
                                <div className={`${styles.statIconWrapper} ${styles.statIconWrapperPurple}`} style={{ width: "36px", height: "36px" }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                                <div className={styles.statInfo} style={{ gap: "2px" }}>
                                    <span className={styles.statLabel} style={{ fontSize: "11px" }}>Выполнено</span>
                                    <span className={`${styles.statValue} ${styles.statValuePurple}`} style={{ fontSize: "18px" }}>
                                        {mode === "we"
                                            ? `${table.totals.weApproved !== undefined ? table.totals.weApproved : "0"} из ${(table.totals.participantCount || 0) * 6}`
                                            : (table.totals.approvedTotal !== undefined ? table.totals.approvedTotal : "0")}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.statCard} style={{ padding: "10px 12px", gap: "10px", borderRadius: "12px", boxShadow: "none", border: "1px solid var(--border-color)" }}>
                                <div className={`${styles.statIconWrapper} ${styles.statIconWrapperBlue}`} style={{ width: "36px", height: "36px" }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                </div>
                                <div className={styles.statInfo} style={{ gap: "2px" }}>
                                    <span className={styles.statLabel} style={{ fontSize: "11px" }}>Среднее время выполнения задания</span>
                                    <span className={`${styles.statValue} ${styles.statValueBlue}`} style={{ fontSize: "18px" }}>
                                        {formatDuration(table.totals.averageTaskTime)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}

// memo: перетаскивание/таймер/тик в других панелях не перерисовывают
// неизменившиеся столы. Props стабильны (callbacks из useCallback родителя).
export default memo(TablePanel);
