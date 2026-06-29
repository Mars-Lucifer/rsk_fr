import { memo } from "react";

import styles from "./dashboard.module.css";
import { ROLE_OPTIONS, roleLabel } from "./dashboardConstants";
import { StarIcon } from "./icons";

function ParticipantRow({
    participant,
    mode,
    editorMode = false,
    big = false,
    dragging = false,
    rowIndex = 0,
    directionsMeta = [],
    onChangeRole,
    onDragStart,
    onDragEnd,
}) {
    const deltaText = participant.delta === null || participant.delta === undefined ? "—" : participant.delta;

    // Прогресс-бар используется только в режиме «Я» (в «Мы» показывается стрип
    // из 6 звёзд направлений, а не бар), поэтому считаем по части «Я».
    const approvedCount = participant.ya?.approvedCount || 0;
    const targetCount = participant.ya?.target || 4;
    const pct = Math.min(approvedCount, targetCount) / Math.max(targetCount, 1);
    const done = approvedCount >= targetCount;

    // Get star state for Stage "Я"
    const showStar = mode === "ya";
    let starColorClass = styles.starOutline;
    let starFilled = false;

    if (showStar) {
        const star = participant.ya?.star;
        if (star === "gold" || star === true) {
            starColorClass = styles.starRed;
            starFilled = true;
        } else if (star === "joker") {
            starColorClass = styles.starYellow;
            starFilled = true;
        }
    }

    const getRoleClass = (role) => {
        switch (role) {
            case "Инспектор": return styles.roleInspector;
            case "Капитан": return styles.roleCaptain;
            case "Инженер": return styles.roleEngineer;
            case "Медиатор": return styles.roleMediator;
            case "Хранитель Маяка": return styles.roleKeeper;
            case "Летописец": return styles.roleChronicler;
            default: return styles.roleDefault;
        }
    };

    return (
        <tr
            className={`${styles.personRow} ${big ? styles.personRowBig : ""} ${editorMode ? styles.personDraggable : ""} ${dragging ? styles.personDragging : ""}`}
            draggable={editorMode}
            onDragStart={editorMode ? (event) => onDragStart?.(event, participant) : undefined}
            onDragEnd={editorMode ? onDragEnd : undefined}
        >
            <td className={styles.tdName}>
                <span className={styles.personName}>{participant.name || "Без имени"}</span>
            </td>
            <td className={styles.tdRole}>
                {editorMode ? (
                    <select
                        className={styles.roleSelect}
                        value={participant.role || "Участник"}
                        onChange={(event) => onChangeRole?.(participant, event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                    >
                        {ROLE_OPTIONS.map((option) => (
                            <option key={option.value || "participant"} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                ) : (
                    <span className={`${styles.roleLabelText} ${getRoleClass(participant.role)}`}>
                        {roleLabel(participant.role)}
                    </span>
                )}
            </td>
            {mode === "ya" ? (
                <>
                    <td className={styles.tdDelta}>
                        <span className={styles.deltaValue}>{deltaText}</span>
                    </td>
                    <td className={styles.tdName}>
                        {participant.ya?.direction ? (
                            <span className={styles.dirChip} title={`Выбранная специализация: ${participant.ya.direction}`}>
                                {participant.ya.direction}
                            </span>
                        ) : (
                            <span className={styles.dirChipEmpty}>—</span>
                        )}
                    </td>
                    <td className={styles.tdProgress}>
                        <div className={styles.progressCellWrap}>
                            <span className={styles.progressText}>
                                {approvedCount}/{targetCount}
                            </span>
                            <div className={styles.progressBarTrack}>
                                <div
                                    className={`${styles.progressBarFill} ${done ? styles.progressBarFillDone : ""}`}
                                    style={{ width: `${Math.round(pct * 100)}%` }}
                                />
                            </div>
                            <StarIcon className={`${styles.progressStar} ${starColorClass}`} filled={starFilled} />
                        </div>
                    </td>
                </>
            ) : (
                <>
                    <td className={styles.tdName}>
                        {directionsMeta?.[rowIndex]?.label ? (
                            <span className={styles.weDirectionLabel}>
                                {directionsMeta[rowIndex].label}
                            </span>
                        ) : (
                            <span className={styles.dirChipEmpty}>—</span>
                        )}
                    </td>
                    <td className={styles.tdProgress}>
                        <div className={styles.dirStarsRow}>
                            {(participant.we?.directions || []).map((dir) => (
                                <span
                                    key={dir.key}
                                    title={`${dir.label}: ${dir.count || 0}${dir.viaJoker ? " (звезда-джокер)" : ""}`}
                                >
                                    <StarIcon
                                        className={`${styles.dirStar} ${dir.viaJoker ? styles.dirStarJoker : dir.lit ? styles.dirStarLit : ""}`}
                                        filled={dir.lit}
                                    />
                                </span>
                            ))}
                        </div>
                    </td>
                </>
            )}
        </tr>
    );
}

// memo: при поллинге каждые 5с участники, чьи данные не изменились, не
// перерисовываются (props стабильны — callbacks обёрнуты в useCallback выше).
export default memo(ParticipantRow);
