import styles from "./dashboard.module.css";
import { ROLE_OPTIONS, roleLabel } from "./dashboardConstants";
import { StarIcon } from "./icons";

export default function ParticipantRow({
    participant,
    mode,
    editorMode = false,
    big = false,
    dragging = false,
    onChangeRole,
    onDragStart,
    onDragEnd,
}) {
    const deltaText = participant.delta === null || participant.delta === undefined ? "—" : participant.delta;
    
    // Calculate progress
    const approvedCount = mode === "ya" ? (participant.ya?.approvedCount || 0) : (participant.we?.approvedCount || 0);
    const targetCount = mode === "ya" ? (participant.ya?.target || 4) : 4;
    const pct = Math.min(approvedCount, targetCount) / Math.max(targetCount, 1);
    const done = approvedCount >= targetCount;

    // Get star state for Stage "Я"
    const showStar = mode === "ya";
    let starColorClass = styles.starOutline;
    let starFilled = false;

    if (showStar) {
        if (approvedCount >= 4) {
            starColorClass = styles.starRed;
            starFilled = true;
        } else if (approvedCount === 3) {
            starColorClass = styles.starYellow;
            starFilled = true;
        }
    }

    const getRoleClass = (role) => {
        switch (role) {
            case "ИНСПЕКТОР": return styles.roleInspector;
            case "АДМИНИСТРАТОР": return styles.roleAdmin;
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
                (participant.we?.directions || []).map((dir) => (
                    <td key={dir.key} className={styles.tdCenter} title={`${dir.label}: ${dir.count}`}>
                        <StarIcon
                            className={`${styles.dirStar} ${dir.lit ? styles.dirStarLit : ""}`}
                            filled={dir.lit}
                        />
                    </td>
                ))
            )}
        </tr>
    );
}
