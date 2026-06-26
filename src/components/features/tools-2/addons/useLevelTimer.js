import { useState, useRef, useEffect } from "react";

// Посекундный таймер активного уровня теста-ранжирования (вынесено из
// RankingTestPopup, этап 5). Семантика 1:1 с исходным инлайном:
//  - начальное значение по уровню берётся из сохранённых результатов;
//  - тикает раз в секунду, пока уровень не завершён и тест не пройден целиком;
//  - при смене уровня/завершении интервал перезапускается/останавливается.
//
// setLevelTimers возвращается наружу, т.к. нужен при «пройти заново» (сброс в 0).
export function useLevelTimer({ levelsCount, currentLevel, isLevelDone, isFullyCompleted, savedData }) {
    const [levelTimers, setLevelTimers] = useState(() => {
        const timers = {};
        for (let i = 0; i < levelsCount; i++) {
            timers[i] = savedData?.[`level${i + 1}`]?.time || 0;
        }
        return timers;
    });
    const timerRef = useRef(null);

    useEffect(() => {
        if (isLevelDone || isFullyCompleted) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }
        timerRef.current = setInterval(() => {
            setLevelTimers((prev) => ({ ...prev, [currentLevel]: (prev[currentLevel] || 0) + 1 }));
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [currentLevel, isLevelDone, isFullyCompleted]);

    return { levelTimers, setLevelTimers };
}
