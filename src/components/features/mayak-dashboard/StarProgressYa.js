import styles from "./dashboard.module.css";
import { StarIcon } from "./icons";

// Прогресс части «Я»: бар до target и звезда, загорающаяся при достижении цели.
export default function StarProgressYa({ approvedCount = 0, target = 4, star = false, big = false }) {
    const pct = Math.min(approvedCount, target) / Math.max(target, 1);
    return (
        <div className={styles.yaWrap}>
            <span className={`${styles.yaCount} ${star ? styles.yaCountDone : ""}`}>
                {approvedCount}/{target}
            </span>
            <div className={styles.yaBarTrack}>
                <div className={styles.yaBarFill} style={{ width: `${Math.round(pct * 100)}%` }} />
            </div>
            <StarIcon className={`${styles.star} ${big ? styles.starBig : ""} ${star ? styles.starLit : ""}`} />
        </div>
    );
}
