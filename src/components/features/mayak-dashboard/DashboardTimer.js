import styles from "./dashboard.module.css";
import { TimerIcon, ExpandIcon } from "./icons";

function formatTime(totalSeconds) {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const mm = String(Math.floor(safe / 60)).padStart(2, "0");
    const ss = String(safe % 60).padStart(2, "0");
    return `${mm}:${ss}`;
}

const PRESETS = [1, 3, 5, 10, 15];

// Таймер обратного отсчёта. Состояние поднято в SessionDashboard.
export default function DashboardTimer({ timer, onSetMinutes, onStart, onPause, onReset, onExpand, big = false }) {
    const danger = timer.running && timer.remainingSeconds <= 10 && timer.remainingSeconds > 0;

    return (
        <div className={styles.timer}>
            <div className={styles.timerHead}>
                <span className={styles.timerTitle}>
                    <TimerIcon /> Таймер
                </span>
                {onExpand && !big && (
                    <button type="button" className={styles.expandButton} title="Развернуть на весь экран" onClick={onExpand}>
                        <ExpandIcon />
                    </button>
                )}
            </div>

            <div className={`${styles.timerDisplay} ${danger ? styles.timerDisplayDanger : ""}`}>
                {formatTime(timer.remainingSeconds)}
            </div>

            <div className={styles.timerControls}>
                {PRESETS.map((minutes) => (
                    <button key={minutes} type="button" className={styles.timerPreset} onClick={() => onSetMinutes(minutes)}>
                        {minutes} мин
                    </button>
                ))}
                <input
                    className={styles.timerInput}
                    type="number"
                    min="0"
                    max="180"
                    value={timer.inputMinutes}
                    onChange={(event) => onSetMinutes(event.target.value)}
                    aria-label="Минуты"
                />
                {timer.running ? (
                    <button type="button" className={styles.timerGhost} onClick={onPause}>
                        Пауза
                    </button>
                ) : (
                    <button type="button" className={styles.timerPrimary} onClick={onStart}>
                        Старт
                    </button>
                )}
                <button type="button" className={styles.timerGhost} onClick={onReset}>
                    Сброс
                </button>
            </div>
        </div>
    );
}
