import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import styles from "./dashboard.module.css";
import TablePanel from "./TablePanel";
import OverviewPanel from "./OverviewPanel";
import ParticipantRow from "./ParticipantRow";
import DashboardTimer from "./DashboardTimer";
import { RefreshIcon, PencilIcon, BackIcon, CloseIcon, StarIcon } from "./icons";
import { ROLE_OPTIONS, roleLabel } from "./dashboardConstants";

const POLL_INTERVAL_MS = 5000;

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

const getDemoData = (sessionId) => {
    const dummyDirections = [
        { key: "KNOWLEDGE", label: "Знания и навыки" },
        { key: "INTERACTION", label: "Внешние взаимодействия" },
        { key: "ENVIRONMENT", label: "Единое цифровое пространство" },
        { key: "PROTECTION", label: "Защита данных" },
        { key: "DATA", label: "Данные и аналитика" },
        { key: "AUTOMATION", label: "Автоматизация" },
    ];

    const tables = [
        {
            tableNumber: 1,
            participants: [
                { userId: "demo-1", name: "Соколов Д.С.", role: "Капитан", delta: 43, ya: { approvedCount: 4, target: 4, progress: 1.0, star: true }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 8 },
                { userId: "demo-2", name: "Лебедев Е.А.", role: "Летописец", delta: 46, ya: { approvedCount: 3, target: 4, progress: 0.75, star: false }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 7 },
                { userId: "demo-3", name: "Петров Ю.Е.", role: "Инженер", delta: 49, ya: { approvedCount: 2, target: 4, progress: 0.5, star: false }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 6 },
                { userId: "demo-4", name: "Михайлов Р.М.", role: "Хранитель Маяка", delta: 52, ya: { approvedCount: 4, target: 4, progress: 1.0, star: true }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 8 },
                { userId: "demo-5", name: "Семенов М.Н.", role: "ИНСПЕКТОР", delta: 55, ya: { approvedCount: 4, target: 4, progress: 1.0, star: true }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 8 },
                { userId: "demo-6", name: "Сидоров О.В.", role: "Медиатор", delta: 58, ya: { approvedCount: 1, target: 4, progress: 0.25, star: false }, we: { approvedCount: 1, stars: 1, directions: [] }, approvedTotal: 2 },
            ],
            totals: { participantCount: 6, yaStars: 3, weStars: 21, approvedTotal: 39, yaApproved: 18, weApproved: 21, averageDelta: 50.5, averageTaskTime: 245 }
        },
        {
            tableNumber: 2,
            participants: [
                { userId: "demo-7", name: "Новиков Д.В.", role: "Капитан", delta: 61, ya: { approvedCount: 4, target: 4, progress: 1.0, star: true }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 8 },
                { userId: "demo-8", name: "Егоров А.Д.", role: "Летописец", delta: 64, ya: { approvedCount: 3, target: 4, progress: 0.75, star: false }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 7 },
                { userId: "demo-9", name: "Смирнов В.А.", role: "Инженер", delta: 42, ya: { approvedCount: 2, target: 4, progress: 0.5, star: false }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 6 },
                { userId: "demo-10", name: "Федоров Н.М.", role: "Хранитель Маяка", delta: 45, ya: { approvedCount: 4, target: 4, progress: 1.0, star: true }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 8 },
                { userId: "demo-11", name: "Павлов А.И.", role: "ИНСПЕКТОР", delta: 48, ya: { approvedCount: 4, target: 4, progress: 1.0, star: true }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 8 },
                { userId: "demo-12", name: "Кузнецов Я.А.", role: "Медиатор", delta: 51, ya: { approvedCount: 1, target: 4, progress: 0.25, star: false }, we: { approvedCount: 1, stars: 1, directions: [] }, approvedTotal: 2 },
            ],
            totals: { participantCount: 6, yaStars: 3, weStars: 21, approvedTotal: 39, yaApproved: 18, weApproved: 21, averageDelta: 52.0, averageTaskTime: 250 }
        },
        {
            tableNumber: 3,
            participants: [
                { userId: "demo-13", name: "Морозов А.И.", role: "Капитан", delta: 54, ya: { approvedCount: 4, target: 4, progress: 1.0, star: true }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 8 },
                { userId: "demo-14", name: "Козлов С.П.", role: "Летописец", delta: 57, ya: { approvedCount: 3, target: 4, progress: 0.75, star: false }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 7 },
                { userId: "demo-15", name: "Попов В.А.", role: "Инженер", delta: 60, ya: { approvedCount: 2, target: 4, progress: 0.5, star: false }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 6 },
                { userId: "demo-16", name: "Волков М.С.", role: "Хранитель Маяка", delta: 63, ya: { approvedCount: 4, target: 4, progress: 1.0, star: true }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 8 },
                { userId: "demo-17", name: "Степанов Д.А.", role: "ИНСПЕКТОР", delta: 41, ya: { approvedCount: 4, target: 4, progress: 1.0, star: true }, we: { approvedCount: 4, stars: 4, directions: [] }, approvedTotal: 8 },
                { userId: "demo-18", name: "Васильев И.Е.", role: "Медиатор", delta: 44, ya: { approvedCount: 1, target: 4, progress: 0.25, star: false }, we: { approvedCount: 1, stars: 1, directions: [] }, approvedTotal: 2 },
            ],
            totals: { participantCount: 6, yaStars: 3, weStars: 21, approvedTotal: 39, yaApproved: 18, weApproved: 21, averageDelta: 54.2, averageTaskTime: 240 }
        }
    ];

    tables.forEach(t => {
        t.participants.forEach(p => {
            p.we.directions = dummyDirections.map((d, index) => ({
                key: d.key,
                label: d.label,
                count: p.we.approvedCount > index ? 1 : 0,
                lit: p.we.approvedCount > index
            }));
            p.we.stars = p.we.directions.filter(d => d.lit).length;
        });
    });

    const overall = {
        participantCount: 18,
        averageDelta: 52.1,
        approvedTotal: 117,
        averageTaskTime: 245,
        tables: tables.map(t => ({
            tableNumber: t.tableNumber,
            participantCount: 6,
            approvedTotal: t.totals.approvedTotal,
            yaStars: t.totals.yaStars,
            weStars: t.totals.weStars
        }))
    };

    return {
        session: {
            id: sessionId,
            name: "Сессия: 1 (Демо)",
            sectionId: "8001-8100",
            tableCount: 3,
            status: "active"
        },
        directions: dummyDirections,
        yaStarTarget: 4,
        tables,
        unassigned: [],
        overall,
        generatedAt: new Date().toISOString()
    };
};

export default function SessionDashboard({ sessionId, onAuthFail }) {
    const router = useRouter();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");

    const [mode, setMode] = useState("ya"); // "ya" | "we"
    const [isDemo, setIsDemo] = useState(false); // Реал / Демо toggle
    const [editorMode, setEditorMode] = useState(false);
    const [fullscreen, setFullscreen] = useState(null); // {type:'overview'} | {type:'timer'}

    const [draggingUserId, setDraggingUserId] = useState(null);
    const [dropTable, setDropTable] = useState(null);

    const [timer, setTimer] = useState({ inputMinutes: "5", totalSeconds: 300, remainingSeconds: 300, running: false });

    const toastTimerRef = useRef(null);

    const showToast = useCallback((message) => {
        setToast(message);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(""), 3500);
    }, []);

    // --- Загрузка данных ---
    const fetchData = useCallback(
        async (isManual = false) => {
            if (isDemo) return;
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
                setData(payload.data);
                setError("");
            } catch (err) {
                setError(err.message || "Ошибка загрузки");
            } finally {
                setLoading(false);
                if (isManual) setRefreshing(false);
            }
        },
        [sessionId, onAuthFail, isDemo]
    );

    useEffect(() => {
        if (isDemo) {
            setData(getDemoData(sessionId));
            setLoading(false);
            setError("");
            return undefined;
        }
        fetchData();
        const intervalId = setInterval(() => fetchData(), POLL_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [fetchData, isDemo, sessionId]);

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
                setTimer((prev) => {
                    if (prev.remainingSeconds > 0) {
                        return { ...prev, running: true };
                    }
                    const minutes = clampMinutes(prev.inputMinutes);
                    if (minutes <= 0) return prev;
                    return { ...prev, totalSeconds: minutes * 60, remainingSeconds: minutes * 60, running: true };
                });
            },
            pause: () => setTimer((prev) => ({ ...prev, running: false })),
            reset: () =>
                setTimer((prev) => {
                    const minutes = clampMinutes(prev.inputMinutes);
                    return { ...prev, running: false, totalSeconds: minutes * 60, remainingSeconds: minutes * 60 };
                }),
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
                await fetchData();
                return true;
            } catch (err) {
                showToast(err.message || fallbackError);
                return false;
            }
        },
        [sessionId, fetchData, showToast]
    );

    // --- Локальные мутации демо-режима (без обращения к API) ---
    const updateDemoParticipant = useCallback((userId, updater) => {
        setData((prev) => {
            if (!prev) return prev;
            const tables = prev.tables.map((table) => ({
                ...table,
                participants: table.participants.map((participant) =>
                    participant.userId === userId ? updater(participant) : participant
                ),
            }));
            return { ...prev, tables };
        });
    }, []);

    const moveDemoParticipant = useCallback((userId, targetTable) => {
        setData((prev) => {
            if (!prev) return prev;
            let moving = null;
            const stripped = prev.tables.map((table) => ({
                ...table,
                participants: table.participants.filter((participant) => {
                    if (participant.userId === userId) {
                        moving = participant;
                        return false;
                    }
                    return true;
                }),
            }));
            if (!moving) return prev;
            const tables = stripped.map((table) =>
                table.tableNumber === targetTable
                    ? { ...table, participants: [...table.participants, { ...moving, tableNumber: targetTable }] }
                    : table
            );
            return { ...prev, tables };
        });
    }, []);

    const handleChangeRole = useCallback(
        (participant, role) => {
            if (isDemo) {
                updateDemoParticipant(participant.userId, (prev) => ({ ...prev, role }));
                return;
            }
            patchParticipant({ userId: participant.userId, role }, "Не удалось изменить роль");
        },
        [isDemo, updateDemoParticipant, patchParticipant]
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
        setDropTable(tableNumber);
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
            if (isDemo) {
                moveDemoParticipant(userId, tableNumber);
                return;
            }
            patchParticipant({ userId, tableNumber }, "Не удалось переместить участника");
        },
        [draggingUserId, currentTableOf, patchParticipant, isDemo, moveDemoParticipant]
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

                    {/* Real / Demo Toggle capsule */}
                    <div className={styles.segment}>
                        <button
                            type="button"
                            className={`${styles.segmentBtn} ${!isDemo ? styles.segmentBtnActive : ""}`}
                            onClick={() => {
                                setIsDemo(false);
                                showToast("Переключено на реальные данные");
                            }}
                        >
                            Реал
                        </button>
                        <button
                            type="button"
                            className={`${styles.segmentBtn} ${isDemo ? styles.segmentBtnActive : ""}`}
                            onClick={() => {
                                setIsDemo(true);
                                showToast("Переключено на демо-данные");
                            }}
                        >
                            Демо
                        </button>
                    </div>

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

            <div className={styles.grid}>
                {data.tables.map((table) => (
                    <TablePanel
                        key={table.tableNumber}
                        table={table}
                        dropActive={dropTable === table.tableNumber}
                        expanded={false}
                        onExpand={(tableNumber) => setFullscreen({ type: "table", tableNumber })}
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
                                                    <th>Прогресс Я</th>
                                                </>
                                            ) : (
                                                <>
                                                    <th>НАПРАВЛЕНИЕ</th>
                                                    <th colSpan={data.unassigned.length} className={styles.thCenter}>Индекс цифровой зрелости</th>
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
                                                    onDragStart={handlePersonDragStart}
                                                    onDragEnd={handlePersonDragEnd}
                                                />
                                            ))
                                        ) : (
                                            (data.directions || []).map((dir, dirIndex) => {
                                                const p = data.unassigned[dirIndex];
                                                return (
                                                    <tr key={dir.key} className={styles.personRow}>
                                                        {p ? (
                                                            <>
                                                                <td
                                                                    className={`${styles.tdName} ${editorMode ? styles.personDraggable : ""} ${draggingUserId === p.userId ? styles.personDragging : ""}`}
                                                                    draggable={editorMode}
                                                                    onDragStart={editorMode ? (e) => handlePersonDragStart(e, p) : undefined}
                                                                    onDragEnd={editorMode ? handlePersonDragEnd : undefined}
                                                                >
                                                                    <span className={styles.personName}>{p.name || "Без имени"}</span>
                                                                </td>
                                                                <td className={styles.tdRole}>
                                                                    {editorMode ? (
                                                                        <select
                                                                            className={styles.roleSelect}
                                                                            value={p.role || "Участник"}
                                                                            onChange={(event) => handleChangeRole(p, event.target.value)}
                                                                            onClick={(event) => event.stopPropagation()}
                                                                        >
                                                                            {ROLE_OPTIONS.map((option) => (
                                                                                <option key={option.value || "participant"} value={option.value}>
                                                                                    {option.label}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    ) : (
                                                                        <span className={`${styles.roleLabelText} ${getRoleClass(p.role)}`}>
                                                                            {roleLabel(p.role)}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td className={styles.tdName}>—</td>
                                                                <td className={styles.tdRole}>—</td>
                                                            </>
                                                        )}
                                                        <td className={styles.tdName}>
                                                            <span className={styles.dirLabelText}>{dir.label}</span>
                                                        </td>
                                                        {data.unassigned.map((pAll) => {
                                                            const pDir = pAll.we?.directions?.[dirIndex] || dir;
                                                            return (
                                                                <td key={pAll.userId} className={styles.tdCenter} title={`${pAll.name}: ${pDir.label}`}>
                                                                    <StarIcon
                                                                        className={`${styles.dirStar} ${pDir.lit ? styles.dirStarLit : ""}`}
                                                                        filled={pDir.lit}
                                                                    />
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })
                                        )}
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
                    timer={timer}
                    timerHandlers={timerHandlers}
                    onExpand={() => setFullscreen({ type: "overview" })}
                    onExpandTimer={() => setFullscreen({ type: "timer" })}
                />
            </div>


            {fullscreen && (
                <div className={styles.overlay}>
                    {fullscreen.type === "timer" && (
                        <button
                            type="button"
                            className={styles.floatingCloseBtn}
                            onClick={() => setFullscreen(null)}
                            title="Закрыть"
                        >
                            <CloseIcon />
                        </button>
                    )}
 
                    <div className={styles.overlayPanel}>
                        {fullscreen.type === "overview" && (
                            <OverviewPanel
                                overall={data.overall}
                                tables={data.tables}
                                mode={mode}
                                directionsMeta={data.directions}
                                expanded
                                timer={timer}
                                timerHandlers={timerHandlers}
                                onExpand={() => setFullscreen(null)}
                            />
                        )}
                        {fullscreen.type === "timer" && (
                            <DashboardTimer
                                timer={timer}
                                big
                                onSetMinutes={timerHandlers.setMinutes}
                                onStart={timerHandlers.start}
                                onPause={timerHandlers.pause}
                                onReset={timerHandlers.reset}
                            />
                        )}
                        {fullscreen.type === "table" && (
                            <TablePanel
                                table={data.tables.find((t) => t.tableNumber === fullscreen.tableNumber)}
                                expanded
                                onExpand={() => setFullscreen(null)}
                                {...tablePanelProps}
                            />
                        )}
                    </div>
                </div>
            )}

            {toast && <div className={styles.toast}>{toast}</div>}
        </div>
    );
}
