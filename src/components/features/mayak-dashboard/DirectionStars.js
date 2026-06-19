import styles from "./dashboard.module.css";
import { StarIcon } from "./icons";

// Компактная горизонтальная полоса из 6 звёзд-направлений (на участника).
export function DirectionStripH({ directions = [] }) {
    return (
        <div className={styles.dirStripH}>
            {directions.map((direction) => (
                <span key={direction.key} title={`${direction.label}: ${direction.count}`}>
                    <StarIcon className={`${styles.dirStar} ${direction.lit ? styles.dirStarLit : ""}`} filled={direction.lit} />
                </span>
            ))}
        </div>
    );
}

// Общий блок направлений части «Мы» (агрегат стола, не привязан к участнику).
// Подпись направления — слева, звезда и счётчик — справа.
export function DirectionLegend({ directions = [], title = "Направления «Мы»" }) {
    return (
        <div className={styles.dirLegend}>
            {title && <div className={styles.dirLegendTitle}>{title}</div>}
            {directions.map((direction) => (
                <div className={styles.dirLegendRow} key={direction.key}>
                    <span className={`${styles.dirLegendLabel} ${direction.lit ? styles.dirLegendLabelLit : ""}`}>
                        {direction.label}
                    </span>
                    <div className={styles.dirStarsRow}>
                        {[...Array(6)].map((_, starIdx) => {
                            const isLit = (direction.count || 0) > starIdx;
                            return (
                                <StarIcon
                                    key={starIdx}
                                    className={`${styles.dirStar} ${isLit ? styles.dirStarLit : ""}`}
                                    filled={isLit}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
