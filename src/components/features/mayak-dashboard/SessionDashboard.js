import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import styles from "./dashboard.module.css";
import TablePanel from "./TablePanel";
import OverviewPanel from "./OverviewPanel";
import ParticipantRow from "./ParticipantRow";
import { RefreshIcon, PencilIcon, BackIcon } from "./icons";
import { playTimerEndChime, resumeTimerAudio, stopTimerSound } from "./timerSound";

const POLL_INTERVAL_MS = 5000;

function clampMinutes(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.min(parsed, 180);
}

function formatDuration(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return "—";
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return `${mm}:${ss}`;
}

export default function SessionDashboard({ sessionId, onAuthFail }) {
    const router = useRouter();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");

    const [mode, setMode] = useState("ya"); // "ya" | "we"
    const [editorMode, setEditorMode] = useState(false);

    const [draggingUserId, setDraggingUserId] = useState(null);
    const [dropTable, setDropTable] = useState(null);

    const [timer, setTimer] = useState({ inputMinutes: "5", totalSeconds: 300, remainingSeconds: 300, running: false });

    const toastTimerRef = useRef(null);
    // Предыдущее значение остатка таймера — чтобы поймать переход >0 -> 0 и
    // проиграть звук окончания ровно один раз.
    const prevRemainingRef = useRef(300);
    // Снимок последнего payload (без generatedAt) — чтобы не вызывать setData,
    // когда данные не изменились: иначе каждые 5с весь дашборд перерисовывается.
    const lastDataSigRef = useRef("");
    // Защита от наложения запросов и от подмены данных во время редактирования.
    const inFlightRef = useRef(false);
    const editorModeRef = useRef(false);

    const showToast = useCallback((message) => {
        setToast(message);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(""), 3500);
    }, []);

    // --- Загрузка данных ---
    const fetchData = useCallback(
        async (isManual = false, { force = false } = {}) => {
            // Фоновый поллинг не наслаиваем и не дёргаем во время редактирования
            // (drag/role). Ручной refresh и явный force (после правки) проходят.
            if (!isManual && !force && (inFlightRef.current || editorModeRef.current)) return;
            inFlightRef.current = true;
            if (isManual) setRefreshing(true);
            try {
                const response = await fetch(`/api/admin/mayak-sessions/${encodeURIComponent(sessionId)}/dashboard`, {
                    cache: "no-store",
                });
                if (response.status === 401) {
                    onAuthFail?.();
                    return;
                }
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.success) {
                    throw new Error(payload.error || "Не удалось загрузить дашборд");
                }
                // Сравниваем без generatedAt: если ничего не поменялось — не
                // обновляем state, чтобы избежать лишней перерисовки таблиц.
                const { generatedAt, ...rest } = payload.data || {};
                const sig = JSON.stringify(rest);
                if (sig !== lastDataSigRef.current) {
                    lastDataSigRef.current = sig;
                    setData(payload.data);
                }
                setError("");
            } catch (err) {
                setError(err.message || "Ошибка загрузки");
            } finally {
                inFlightRef.current = false;
                setLoading(false);
                if (isManual) setRefreshing(false);
            }
        },
        [sessionId, onAuthFail]
    );

    // editorMode держим в ref, чтобы fetchData (стабильный useCallback) видел
    // актуальное значение без пересоздания и перезапуска интервала.
    useEffect(() => {
        editorModeRef.current = editorMode;
    }, [editorMode]);

    useEffect(() => {
        // Сбрасываем сигнатуру при смене сессии, иначе первый реальный ответ
        // может совпасть со старым снимком и не примениться.
        lastDataSigRef.current = "";
        fetchData();
        const intervalId = setInterval(() => fetchData(), POLL_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [fetchData, sessionId]);

    // --- Тик таймера ---
    useEffect(() => {
        if (!timer.running) return undefined;
        const id = setInterval(() => {
            setTimer((prev) => {
                if (!prev.running) return prev;
                const next = prev.remainingSeconds - 1;
                if (next <= 0) {
                    return { ...prev, remainingSeconds: 0, running: false };
                }
                return { ...prev, remainingSeconds: next };
            });
        }, 1000);
        return () => clearInterval(id);
    }, [timer.running]);

    // Звук окончания таймера: при переходе остатка из >0 в 0.
    useEffect(() => {
        const prev = prevRemainingRef.current;
        prevRemainingRef.current = timer.remainingSeconds;
        if (prev > 0 && timer.remainingSeconds === 0) {
            playTimerEndChime();
        }
    }, [timer.remainingSeconds]);

    const timerHandlers = useMemo(
        () => ({
            setMinutes: (value) => {
                setTimer((prev) => {
                    const minutes = clampMinutes(value);
                    if (prev.running) {
                        return { ...prev, inputMinutes: String(value) };
                    }
                    return {
                        ...prev,
                        inputMinutes: String(value),
                        totalSeconds: minutes * 60,
                        remainingSeconds: minutes * 60,
                    };
                });
            },
            start: () => {
                // Разблокируем аудио-контекст на пользовательском жесте, чтобы
                // звук окончания гарантированно сыграл по истечении таймера.
                resumeTimerAudio();
                stopTimerSound(); // на случай, если звук ещё доигрывает с прошлого раза
                setTimer((prev) => {
                    if (prev.remainingSeconds > 0) {
                        return { ...prev, running: true };
                    }
                    const minutes = clampMinutes(prev.inputMinutes);
                    if (minutes <= 0) return prev;
                    return { ...prev, totalSeconds: minutes * 60, remainingSeconds: minutes * 60, running: true };
                });
            },
            pause: () => {
                stopTimerSound(); // пауза останавливает звук окончания
                setTimer((prev) => ({ ...prev, running: false }));
            },
            reset: () => {
                stopTimerSound(); // сброс останавливает звук окончания
                setTimer((prev) => {
                    const minutes = clampMinutes(prev.inputMinutes);
                    return { ...prev, running: false, totalSeconds: minutes * 60, remainingSeconds: minutes * 60 };
                });
            },
        }),
        []
    );

    // --- Мутации редактора ---
    const patchParticipant = useCallback(
        async (body, fallbackError) => {
            try {
                const response = await fetch(`/api/admin/mayak-sessions/${encodeURIComponent(sessionId)}/participants`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.success) {
                    throw new Error(payload.error || fallbackError);
                }
                await fetchData(false, { force: true });
                return true;
            } catch (err) {
                showToast(err.message || fallbackError);
                return false;
            }
        },
        [sessionId, fetchData, showToast]
    );

    const handleChangeRole = useCallback(
        (participant, role) => {
            patchParticipant({ userId: participant.userId, role }, "Не удалось изменить роль");
        },
        [patchParticipant]
    );

    // Скрыть участника из дашборда: его метрики (столы/средние/звёзды/время) не
    // учитываются, но сессия участника продолжает работать, прогресс сохраняется.
    // Возврат — кнопкой «показать» в секции «Скрытые».
    const handleHideParticipant = useCallback(
        async (participant) => {
            if (!participant?.userId) return;
            const ok = await patchParticipant({ userId: participant.userId, hidden: true }, "Не удалось скрыть участника");
            if (ok) showToast(`«${participant.name || "участник"}» скрыт из дашборда`);
        },
        [patchParticipant, showToast]
    );

    const handleUnhideParticipant = useCallback(
        async (participant) => {
            if (!participant?.userId) return;
            const ok = await patchParticipant({ userId: participant.userId, hidden: false }, "Не удалось вернуть участника");
            if (ok) showToast(`«${participant.name || "участник"}» снова в дашборде`);
        },
        [patchParticipant, showToast]
    );

    // Удаление участника из запущенной сессии (режим редактора): подтверждение →
    // DELETE → принудительное обновление дашборда. Сессия у участника завершится
    // сама при следующем поллинге его тренажёра (participant=null).
    const handleRemoveParticipant = useCallback(
        async (participant) => {
            if (!participant?.userId) return;
            const name = participant.name || "участника";
            if (!window.confirm(`Удалить «${name}» из сессии? Его сессия будет завершена.`)) return;
            try {
                const response = await fetch(`/api/admin/mayak-sessions/${encodeURIComponent(sessionId)}/participants`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: participant.userId }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.success) {
                    throw new Error(payload.error || "Не удалось удалить участника");
                }
                await fetchData(false, { force: true });
                showToast(`«${name}» удалён из сессии`);
            } catch (err) {
                showToast(err.message || "Не удалось удалить участника");
            }
        },
        [sessionId, fetchData, showToast]
    );

    const handlePersonDragStart = useCallback((event, participant) => {
        setDraggingUserId(participant.userId);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", participant.userId);
    }, []);

    const handlePersonDragEnd = useCallback(() => {
        setDraggingUserId(null);
        setDropTable(null);
    }, []);

    const handleTableDragOver = useCallback((event, tableNumber) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        // dragover стреляет десятками раз в секунду — обновляем state только
        // при реальной смене целевого стола, иначе перерисовка «подвисает».
        setDropTable((prev) => (prev === tableNumber ? prev : tableNumber));
    }, []);

    const handleTableDragLeave = useCallback(() => {
        setDropTable(null);
    }, []);

    const currentTableOf = useCallback(
        (userId) => {
            if (!data) return null;
            for (const table of data.tables) {
                if (table.participants.some((participant) => participant.userId === userId)) {
                    return table.tableNumber;
                }
            }
            return null;
        },
        [data]
    );

    const handleTableDrop = useCallback(
        (event, tableNumber) => {
            event.preventDefault();
            const userId = event.dataTransfer.getData("text/plain") || draggingUserId;
            setDropTable(null);
            setDraggingUserId(null);
            if (!userId) return;
            if (currentTableOf(userId) === tableNumber) return;
            patchParticipant({ userId, tableNumber }, "Не удалось переместить участника");
        },
        [draggingUserId, currentTableOf, patchParticipant]
    );

    // --- Рендер ---
    if (loading && !data) {
        return (
            <div className={styles.root}>
                <div className={styles.center}>
                    <div className={styles.spinner} />
                    <span>Загружаем дашборд сессии…</span>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className={styles.root}>
                <div className={styles.center}>
                    <div className={styles.errorBox}>{error || "Нет данных по сессии"}</div>
                    <button type="button" className={styles.iconBtn} onClick={() => fetchData(true)}>
                        <RefreshIcon /> Повторить
                    </button>
                </div>
            </div>
        );
    }

    const tablePanelProps = {
        mode,
        directionsMeta: data.directions,
        editorMode,
        draggingUserId,
        onChangeRole: handleChangeRole,
        onRemove: handleRemoveParticipant,
        onHide: handleHideParticipant,
        onPersonDragStart: handlePersonDragStart,
        onPersonDragEnd: handlePersonDragEnd,
        onTableDragOver: handleTableDragOver,
        onTableDragLeave: handleTableDragLeave,
        onTableDrop: handleTableDrop,
    };

    return (
        <div className={styles.root}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <button type="button" className={styles.backLink} onClick={() => router.push("/admin/mayak-sessions")}>
                        ← В список токенов
                    </button>
                    <h1 className={styles.title}>{data.session.name || "Сессия: 1"}</h1>
                </div>

                <div className={styles.headerRight}>
                    {/* Stage Toggle (Я / Мы) - Borderless, single line, to the right */}
                    <div className={styles.stageToggle}>
                        <button
                            type="button"
                            className={`${styles.stageBtn} ${mode === "ya" ? styles.stageBtnActive : ""}`}
                            onClick={() => setMode("ya")}
                        >
                            Я
                        </button>
                        <button
                            type="button"
                            className={`${styles.stageBtn} ${mode === "we" ? styles.stageBtnActive : ""}`}
                            onClick={() => setMode("we")}
                        >
                            Мы
                        </button>
                    </div>

                    <div className={styles.divider} />

                        {/* Editor mode button */}
                    <button
                        type="button"
                        className={`${styles.iconBtn} ${editorMode ? styles.iconBtnActiveDone : ""}`}
                        onClick={() => setEditorMode((prev) => !prev)}
                    >
                        <PencilIcon /> {editorMode ? "Готово" : "Редактор"}
                    </button>
                </div>
            </header>

            {data.deck && data.deck.dashboardReady === false && (
                <div className={styles.deckWarningBanner}>
                    <strong>Колода не размечена по стандарту</strong>
                    <span>
                        Прогресс «Я»/«Мы» не отображается: {(data.deck.issues || []).join("; ") || "типы контента не распознаны"}.
                        Заполните contentType заданий в редакторе колоды.
                    </span>
                </div>
            )}
            <div className={styles.grid}>
                {data.tables.map((table) => (
                    <TablePanel
                        key={table.tableNumber}
                        table={table}
                        dropActive={dropTable === table.tableNumber}
                        expanded={false}
                        {...tablePanelProps}
                    />
                ))}

                {data.unassigned.length > 0 && (
                    <section className={`${styles.panel} ${styles.tablePanel}`}>
                        <header className={styles.panelHead}>
                            <span className={styles.panelBadge} style={{ background: "rgba(255,255,255,0.1)" }}>?</span>
                            <div>
                                <h3 className={styles.panelTitle}>Нераспределённые</h3>
                                <span className={styles.panelMeta}>{data.unassigned.length} участников</span>
                            </div>
                        </header>
                        <div className={styles.panelBody}>
                            <div className={styles.tableResponsive}>
                                <table className={styles.participantTable}>
                                    <thead>
                                        <tr>
                                            <th>УЧАСТНИК</th>
                                            <th>РОЛЬ</th>
                                            {mode === "ya" ? (
                                                <>
                                                    <th className={styles.thCenter}>ДЕЛЬТА 5 УР.</th>
                                                    <th>СПЕЦИАЛИЗАЦИЯ</th>
                                                    <th>Прогресс Я</th>
                                                </>
                                            ) : (
                                                <>
                                                    {/* В «Мы» у нераспределённых нет стола, а значит и
                                                        командных направлений — только участник и роль. */}
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mode === "ya" ? (
                                            data.unassigned.map((participant) => (
                                                <ParticipantRow
                                                    key={participant.userId}
                                                    participant={participant}
                                                    mode={mode}
                                                    editorMode={editorMode}
                                                    dragging={draggingUserId === participant.userId}
                                                    onChangeRole={handleChangeRole}
                                                    onRemove={handleRemoveParticipant}
                                                    onHide={handleHideParticipant}
                                                    onDragStart={handlePersonDragStart}
                                                    onDragEnd={handlePersonDragEnd}
                                                />
                                            ))
                                        ) : (
                                            data.unassigned.map((participant, index) => (
                                                <ParticipantRow
                                                    key={participant.userId}
                                                    participant={participant}
                                                    mode={mode}
                                                    rowIndex={index}
                                                    directionsMeta={data.directions}
                                                    editorMode={editorMode}
                                                    dragging={draggingUserId === participant.userId}
                                                    onChangeRole={handleChangeRole}
                                                    onRemove={handleRemoveParticipant}
                                                    onHide={handleHideParticipant}
                                                    onDragStart={handlePersonDragStart}
                                                    onDragEnd={handlePersonDragEnd}
                                                />
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                )}

                {editorMode && (data.hidden?.length || 0) > 0 && (
                    <section className={`${styles.panel} ${styles.tablePanel}`}>
                        <header className={styles.panelHead}>
                            <span className={styles.panelBadge} style={{ background: "rgba(100,116,139,0.18)" }}>🙈</span>
                            <div>
                                <h3 className={styles.panelTitle}>Скрытые</h3>
                                <span className={styles.panelMeta}>{data.hidden.length} — не учитываются в метриках</span>
                            </div>
                        </header>
                        <div className={styles.panelBody}>
                            <div className={styles.tableResponsive}>
                                <table className={styles.participantTable}>
                                    <thead>
                                        <tr>
                                            <th>УЧАСТНИК</th>
                                            <th>РОЛЬ</th>
                                            <th>СТОЛ</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.hidden.map((participant) => (
                                            <tr key={participant.userId} className={styles.personRow}>
                                                <td className={styles.tdName}>
                                                    <span className={styles.personName}>{participant.name || "Без имени"}</span>
                                                </td>
                                                <td className={styles.tdRole}>{participant.role || "Участник"}</td>
                                                <td>{participant.tableNumber || "—"}</td>
                                                <td style={{ textAlign: "right" }}>
                                                    <button
                                                        type="button"
                                                        className={styles.iconBtn}
                                                        onClick={() => handleUnhideParticipant(participant)}
                                                    >
                                                        Вернуть
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                )}

                <OverviewPanel
                    overall={data.overall}
                    tables={data.tables}
                    mode={mode}
                    directionsMeta={data.directions}
                    wide={(data.tables.length + (data.unassigned.length > 0 ? 1 : 0)) % 2 === 0}
                    timer={timer}
                    timerHandlers={timerHandlers}
                />
            </div>

            {toast && <div className={styles.toast}>{toast}</div>}
        </div>
    );
}
