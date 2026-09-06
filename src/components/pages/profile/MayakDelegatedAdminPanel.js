import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";

function formatDateTime(value) {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
        return "Дата не указана";
    }

    return parsed.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatRemainingTime(expiresAt, nowTs) {
    const expiresTs = Date.parse(expiresAt || "");
    if (!Number.isFinite(expiresTs)) {
        return "Таймер недоступен";
    }

    const remainingMs = Math.max(0, expiresTs - nowTs);
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildTableOptions() {
    return Array.from({ length: 6 }, (_, index) => {
        const value = String(index + 1);
        return {
            value,
            label: `${value} ${Number(value) === 1 ? "стол" : Number(value) < 5 ? "стола" : "столов"}`,
        };
    });
}

export default function MayakDelegatedAdminPanel() {
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [finishingSessionId, setFinishingSessionId] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [sessionName, setSessionName] = useState("");
    const [tableCount, setTableCount] = useState("1");
    const [copiedTokenId, setCopiedTokenId] = useState("");
    const [right, setRight] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [nowTs, setNowTs] = useState(Date.now());

    const tableOptions = useMemo(() => buildTableOptions(), []);
    const activeRight = right && right.status === "active" ? right : null;
    const shouldRender = loading || error || activeRight || sessions.length > 0;

    const loadOverview = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/profile/mayak-admin-rights", {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                cache: "no-store",
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (response.status === 401) {
                    setRight(null);
                    setSessions([]);
                    setError("");
                    return;
                }
                throw new Error(payload.error || "Не удалось загрузить права МАЯК");
            }

            setRight(payload?.data?.right || null);
            setSessions(Array.isArray(payload?.data?.sessions) ? payload.data.sessions : []);
            setError("");
        } catch (loadError) {
            setError(loadError.message || "Не удалось загрузить права МАЯК");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    useEffect(() => {
        if (!shouldRender) {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            setNowTs(Date.now());
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, [shouldRender]);

    const handleCreate = async () => {
        setCreating(true);
        setError("");
        setMessage("");

        try {
            const response = await fetch("/api/profile/mayak-admin-rights", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    sessionName,
                    tableCount,
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || "Не удалось создать токен");
            }

            setMessage("Токен создан и будет действовать 48 часов.");
            setSessionName("");
            await loadOverview();
        } catch (createError) {
            setError(createError.message || "Не удалось создать токен");
        } finally {
            setCreating(false);
        }
    };

    const handleCopy = async (tokenId, value) => {
        if (!value) return;

        try {
            await navigator.clipboard.writeText(value);
            setCopiedTokenId(tokenId);
            window.setTimeout(() => setCopiedTokenId((current) => (current === tokenId ? "" : current)), 1600);
        } catch {
            setError("Не удалось скопировать токен");
        }
    };

    const handleComplete = async (sessionId) => {
        if (!sessionId) return;

        const confirmed = window.confirm("Завершить эту сессию?");
        if (!confirmed) {
            return;
        }

        setFinishingSessionId(sessionId);
        setError("");
        setMessage("");

        try {
            const response = await fetch(`/api/profile/mayak-admin-rights/${sessionId}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok || !payload.success) {
                throw new Error(payload.error || "Не удалось завершить сессию");
            }

            setSessions((current) => current.filter((session) => session.sessionId !== sessionId));
            setMessage("Сессия завершена.");
            await loadOverview();
        } catch (completeError) {
            setError(completeError.message || "Не удалось завершить сессию");
        } finally {
            setFinishingSessionId("");
        }
    };

    if (!shouldRender) {
        return null;
    }

    return (
        <div className="block-wrapper col-span-12 max-[900px]:col-span-12">
            <div className="flex items-center justify-between gap-[0.75rem] flex-wrap">
                <div className="flex flex-col gap-[0.25rem]">
                    <h6>Админ-права МАЯК</h6>
                    <p className="small text-(--color-gray-black)">Ваши активные сессии и доступные входы.</p>
                </div>
                {activeRight ? (
                    <span className="small rounded-full bg-(--color-white-gray) px-3 py-2 text-(--color-gray-black) whitespace-nowrap">
                        {`Входы: ${activeRight.remainingParticipantLimit}/${activeRight.totalParticipantLimit}`}
                    </span>
                ) : null}
            </div>

            <div className="mt-[1rem] flex flex-col gap-[0.75rem]">
                {loading ? <p className="text-(--color-gray-black)">Загружаем доступы МАЯК...</p> : null}
                {!loading && error ? <p className="text-[var(--color-red)]">{error}</p> : null}
                {!loading && message ? <p className="text-[var(--color-green)]">{message}</p> : null}

                {right ? (
                    <div className="rounded-[18px] border border-(--color-gray-plus) bg-white px-4 py-4">
                        {activeRight ? (
                            <div className="flex w-full items-end gap-[0.75rem] max-[900px]:flex-wrap max-[760px]:flex-col max-[760px]:items-stretch">
                                <div className="flex min-w-[280px] flex-1 flex-col gap-[0.35rem] max-[760px]:w-full">
                                    <span className="small text-(--color-gray-black)">Название</span>
                                    <input
                                        value={sessionName}
                                        onChange={(event) => setSessionName(event.target.value)}
                                        className="input-wrapper w-full px-4 py-2"
                                        placeholder="Название сессии"
                                        maxLength={80}
                                    />
                                </div>

                                <div className="flex min-w-[150px] flex-col gap-[0.35rem] max-[760px]:w-full">
                                    <span className="small text-(--color-gray-black)">Столы</span>
                                    <select
                                        value={tableCount}
                                        onChange={(event) => setTableCount(event.target.value)}
                                        className="input-wrapper w-full px-4 py-2">
                                        {tableOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <Button
                                    small
                                    inverted
                                    roundeful
                                    className="w-fit! shrink-0 border border-(--color-gray-plus) shadow-none! px-4! max-[760px]:w-full!"
                                    onClick={handleCreate}
                                    disabled={creating}>
                                    {creating ? "Создаём..." : "Создать"}
                                </Button>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {!loading && sessions.length === 0 && activeRight ? <p className="text-(--color-gray-black)">Активных сессий сейчас нет.</p> : null}

                {!loading && sessions.length > 0 ? (
                    <div className="flex flex-col gap-[0.75rem]">
                        {sessions.map((item) => {
                            const token = item.token || {};

                            return (
                                <div key={item.sessionId} className="rounded-[18px] border border-(--color-gray-plus) bg-white px-4 py-4">
                                    <div className="flex items-center justify-between gap-[0.75rem] max-[1100px]:flex-wrap">
                                        <div className="flex min-w-0 flex-1 flex-col gap-[0.15rem]">
                                            <span className="big truncate">{item.sessionName || "Токен"}</span>
                                            <span className="small text-(--color-gray-black)">
                                                {item.isExpired ? "Истёк" : `Осталось ${formatRemainingTime(item.expiresAt, nowTs)}`}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-end gap-[0.5rem] max-[1100px]:justify-start">
                                            <span className="small rounded-full bg-(--color-white-gray) px-3 py-2 text-(--color-gray-black) whitespace-nowrap">
                                                {`Столы: ${item.tableCount}`}
                                            </span>
                                            <span className="small rounded-full bg-(--color-white-gray) px-3 py-2 text-(--color-gray-black) whitespace-nowrap">
                                                {`Входы: ${token.usedCount || 0}/${token.usageLimit || item.participantLimit || 0}`}
                                            </span>
                                            <span className="small rounded-full bg-(--color-white-gray) px-3 py-2 text-(--color-gray-black) whitespace-nowrap">
                                                {`До: ${formatDateTime(item.expiresAt)}`}
                                            </span>
                                        </div>
                                    </div>

                                    {token.value ? (
                                        <div className="mt-[0.8rem] flex items-center gap-[0.5rem] max-[900px]:flex-col">
                                            <div className="min-w-0 flex-1 overflow-x-auto rounded-[14px] bg-(--color-white-gray) px-4 py-3">
                                                <code className="block w-max min-w-full text-left text-[0.8rem] leading-6 whitespace-nowrap [overflow-wrap:normal] [text-wrap:nowrap]">
                                                    {token.value}
                                                </code>
                                            </div>

                                            <div className="flex shrink-0 items-center gap-[0.5rem] max-[900px]:w-full">
                                                <Button
                                                    small
                                                    inverted
                                                    roundeful
                                                    className="border border-(--color-gray-plus) shadow-none! min-w-[96px] px-3!"
                                                    onClick={() => handleCopy(token.id, token.value)}>
                                                    {copiedTokenId === token.id ? "Скопировано" : "Копировать"}
                                                </Button>
                                                <Button
                                                    small
                                                    roundeful
                                                    className="min-w-[96px] px-3! shadow-none!"
                                                    onClick={() => handleComplete(item.sessionId)}
                                                    disabled={finishingSessionId === item.sessionId}>
                                                    {finishingSessionId === item.sessionId ? "Завершаем" : "Завершить"}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
