import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/layout/Layout";

const MAYAK_GUEST_SUFFIX = "aaaaa";

function formatDateTime(value) {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return "-";
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
    if (!Number.isFinite(expiresTs)) return "--:--:--";

    const remainingMs = Math.max(0, expiresTs - nowTs);
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getStorageKey(accessId) {
    return `mayak_delegated_access_${accessId}`;
}

function buildTableOptions() {
    return Array.from({ length: 6 }, (_, index) => String(index + 1));
}

function formatFileSize(value) {
    const size = Number(value) || 0;
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} МБ`;
    if (size >= 1024) return `${Math.round(size / 1024)} КБ`;
    return `${size} Б`;
}

export default function MayakDelegatedAccessPage() {
    const router = useRouter();
    const accessId = String(router.query?.accessId || "");
    const restoredAccessRef = useRef("");
    const [password, setPassword] = useState("");
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [createFeedback, setCreateFeedback] = useState("");
    const [copiedKey, setCopiedKey] = useState("");
    const [overview, setOverview] = useState({ right: null, sessions: [] });
    const [nowTs, setNowTs] = useState(Date.now());
    const [isCompact, setIsCompact] = useState(false);
    const [form, setForm] = useState({
        sessionName: "",
        tableCount: "1",
    });

    const tableOptions = useMemo(() => buildTableOptions(), []);
    const right = overview.right || null;
    const sessions = Array.isArray(overview.sessions) ? overview.sessions : [];
    const materials = Array.isArray(overview.materials) ? overview.materials : [];

    const apiRequest = useCallback(
        async (body, passwordOverride) => {
            const resolvedPassword = passwordOverride ?? password;
            const response = await fetch(`/api/mayak/delegated-access/${encodeURIComponent(accessId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: resolvedPassword, ...body }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || "Ошибка доступа");
            }
            return payload.data || {};
        },
        [accessId, password]
    );

    const loadOverview = useCallback(
        async (passwordOverride = password) => {
            const resolvedPassword = String(passwordOverride || "").trim();
            if (!accessId || !resolvedPassword) return;

            setLoading(true);
            setError("");
            try {
                const data = await apiRequest({ action: "overview" }, resolvedPassword);
                setOverview(data);
                setPassword(resolvedPassword);
                setIsUnlocked(true);
                window.sessionStorage.setItem(getStorageKey(accessId), resolvedPassword);
            } catch (loadError) {
                setIsUnlocked(false);
                setError(loadError.message || "Неверный пароль");
                window.sessionStorage.removeItem(getStorageKey(accessId));
            } finally {
                setLoading(false);
            }
        },
        [accessId, apiRequest, password]
    );

    useEffect(() => {
        if (!router.isReady || !accessId || restoredAccessRef.current === accessId) return;
        restoredAccessRef.current = accessId;
        const savedPassword = window.sessionStorage.getItem(getStorageKey(accessId)) || "";
        if (savedPassword) {
            loadOverview(savedPassword);
        }
    }, [accessId, loadOverview, router.isReady]);

    useEffect(() => {
        if (!isUnlocked) return undefined;
        const intervalId = window.setInterval(() => setNowTs(Date.now()), 1000);
        return () => window.clearInterval(intervalId);
    }, [isUnlocked]);

    useEffect(() => {
        const updateCompact = () => setIsCompact(window.innerWidth < 900);
        updateCompact();
        window.addEventListener("resize", updateCompact);
        return () => window.removeEventListener("resize", updateCompact);
    }, []);

    useEffect(() => {
        if (!message && !error) return undefined;
        const timeoutId = window.setTimeout(() => {
            setMessage("");
            setError("");
        }, message ? 1800 : 2600);
        return () => window.clearTimeout(timeoutId);
    }, [message, error]);

    useEffect(() => {
        if (!createFeedback) return undefined;
        const timeoutId = window.setTimeout(() => setCreateFeedback(""), 1800);
        return () => window.clearTimeout(timeoutId);
    }, [createFeedback]);

    useEffect(() => {
        if (!router.isReady || !isUnlocked || !accessId || !router.query.paymentId) return undefined;
        let cancelled = false;
        let timeoutId = null;
        const paymentId = String(router.query.paymentId || "").trim();

        async function checkPaymentStatus() {
            try {
                const response = await fetch(`/api/payments/status/${encodeURIComponent(paymentId)}`);
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || payload?.success === false) {
                    throw new Error(payload?.error || "Не удалось проверить оплату");
                }
                if (cancelled) return;
                const status = payload?.data?.status;
                if (status === "paid") {
                    await loadOverview(password);
                    setMessage("Входы пополнены");
                    router.replace(`/mayak-access/${encodeURIComponent(accessId)}`, undefined, { shallow: true });
                    return;
                }
                if (status === "canceled") {
                    setError("Оплата отменена");
                    router.replace(`/mayak-access/${encodeURIComponent(accessId)}`, undefined, { shallow: true });
                    return;
                }
                timeoutId = window.setTimeout(checkPaymentStatus, 3000);
            } catch (statusError) {
                if (!cancelled) setError(statusError.message || "Не удалось проверить оплату");
            }
        }

        checkPaymentStatus();
        return () => {
            cancelled = true;
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [accessId, isUnlocked, loadOverview, password, router, router.isReady, router.query.paymentId]);

    const handleLogin = async (event) => {
        event.preventDefault();
        await loadOverview(password);
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        setCreating(true);
        setError("");
        setMessage("");
        setCreateFeedback("");

        try {
            const data = await apiRequest({
                action: "create_session",
                sessionName: form.sessionName,
                tableCount: form.tableCount,
            });
            setOverview(data);
            setForm((current) => ({
                ...current,
                sessionName: "",
            }));
            setCreateFeedback("Сессия создана");
        } catch (createError) {
            setError(createError.message || "Не удалось создать сессию");
        } finally {
            setCreating(false);
        }
    };

    const handleComplete = async (sessionId) => {
        setError("");
        setMessage("");
        try {
            const data = await apiRequest({ action: "complete_session", sessionId });
            setOverview(data);
            setMessage("Сессия завершена");
        } catch (completeError) {
            setError(completeError.message || "Не удалось завершить сессию");
        }
    };

    const copyText = async (key, value) => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopiedKey(key);
            window.setTimeout(() => setCopiedKey((current) => (current === key ? "" : current)), 1600);
        } catch {
            setError("Не удалось скопировать");
        }
    };

    const buildParticipantLink = (tokenValue) => {
        if (!tokenValue || typeof window === "undefined") return "";
        const token = String(tokenValue).trim();
        const guestToken = token.toLowerCase().endsWith(MAYAK_GUEST_SUFFIX) ? token : `${token}${MAYAK_GUEST_SUFFIX}`;
        return `${window.location.origin}/tools/mayak-oko?token=${encodeURIComponent(guestToken)}`;
    };

    if (!isUnlocked) {
        return (
            <Layout style={layoutStyle}>
                <section style={loginShellStyle}>
                    <form onSubmit={handleLogin} style={loginBoxStyle}>
                        <h1 style={loginTitleStyle}>Введите пароль</h1>
                        <input
                            autoFocus
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            style={loginInputStyle}
                            aria-label="Пароль доступа"
                        />
                        {error ? <div style={errorStyle}>{error}</div> : null}
                        <button type="submit" style={primaryButtonStyle} disabled={loading || !password.trim()}>
                            {loading ? "Проверяем..." : "Войти"}
                        </button>
                    </form>
                </section>
            </Layout>
        );
    }

    return (
        <Layout style={layoutStyle}>
            <section style={pageStyle}>
                <header style={{ ...headerStyle, ...(isCompact ? compactHeaderStyle : null) }}>
                    <div>
                        <div style={eyebrowStyle}>Доступ МАЯК</div>
                        <h1 style={titleStyle}>{right?.title || right?.fullName || "Сессии"}</h1>
                    </div>
                    <div style={{ ...metricGridStyle, ...(isCompact ? compactMetricGridStyle : null) }}>
                        <div style={metricStyle}>
                            <span style={metricValueStyle}>{`${right?.remainingParticipantLimit ?? 0}/${right?.totalParticipantLimit ?? 0}`}</span>
                            <span style={metricLabelStyle}>входов осталось</span>
                            <a href={`/pay?accessId=${encodeURIComponent(accessId)}`} style={metricTopUpLinkStyle}>
                                Пополнить
                            </a>
                        </div>
                    </div>
                </header>

                <div style={metaLineStyle}>
                    <span>{right?.taskRange || right?.sectionId || "Колода"}</span>
                    {right?.sectionId && right.sectionId !== right.taskRange ? <span>{right.sectionId}</span> : null}
                </div>

                {error ? <div style={noticeErrorStyle}>{error}</div> : null}
                {message ? <div style={noticeSuccessStyle}>{message}</div> : null}

                <form onSubmit={handleCreate} style={{ ...createPanelStyle, ...(isCompact ? compactCreatePanelStyle : null) }}>
                    <label style={fieldStyle}>
                        <span style={labelStyle}>Название</span>
                        <input
                            value={form.sessionName}
                            onChange={(event) => setForm((current) => ({ ...current, sessionName: event.target.value }))}
                            style={inputStyle}
                            maxLength={80}
                        />
                    </label>

                    <label style={fieldStyle}>
                        <span style={labelStyle}>Столы</span>
                        <select
                            value={form.tableCount}
                            onChange={(event) => setForm((current) => ({ ...current, tableCount: event.target.value }))}
                            style={inputStyle}>
                            {tableOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div style={createActionStyle}>
                        <button
                            type="submit"
                            style={primaryButtonStyle}
                            disabled={creating}>
                            {creating ? "Создаём..." : "Создать сессию"}
                        </button>
                        <span style={createFeedbackStyle}>{createFeedback}</span>
                    </div>
                </form>

                {materials.length ? (
                    <section style={materialsPanelStyle}>
                        <h2 style={panelTitleStyle}>Материалы</h2>
                        <div style={materialsGridStyle}>
                            {materials.map((material) => (
                                <a key={material.id} href={material.url} download style={materialLinkStyle}>
                                    <span style={materialTitleStyle}>{material.title || material.originalName || "Материал"}</span>
                                    <span style={materialMetaStyle}>
                                        {String(material.extension || "").replace(".", "").toUpperCase() || "Файл"} · {formatFileSize(material.size)}
                                    </span>
                                </a>
                            ))}
                        </div>
                    </section>
                ) : null}

                <div style={sessionsListStyle}>
                    {sessions.length === 0 ? <div style={emptyStyle}>Активных сессий нет</div> : null}

                    {sessions.map((item) => {
                        const token = item.token || {};
                        const participantLink = buildParticipantLink(token.value);

                        return (
                            <article key={item.sessionId} style={sessionRowStyle}>
                                <div style={{ ...sessionHeaderStyle, ...(isCompact ? compactSessionHeaderStyle : null) }}>
                                    <div>
                                        <h2 style={sessionTitleStyle}>{item.sessionName || "Сессия"}</h2>
                                        <div style={sessionMetaStyle}>
                                            <span>{`24 часа: ${item.isExpired ? "истекла" : formatRemainingTime(item.expiresAt, nowTs)}`}</span>
                                            <span>{`Столы: ${item.tableCount}`}</span>
                                            <span>{`Входы: ${token.usedCount || 0}/${token.usageLimit || item.participantLimit || 0}`}</span>
                                            <span>{formatDateTime(item.expiresAt)}</span>
                                        </div>
                                    </div>
                                    <button type="button" style={secondaryButtonStyle} onClick={() => handleComplete(item.sessionId)}>
                                        Завершить
                                    </button>
                                </div>

                                <div style={{ ...shareGridStyle, ...(isCompact ? compactShareGridStyle : null) }}>
                                    <div style={shareBoxStyle}>
                                        <span style={labelStyle}>Ссылка</span>
                                        <div style={linkLineStyle}>
                                            <code style={codeStyle}>{participantLink}</code>
                                            <button
                                                type="button"
                                                title="Скопировать ссылку"
                                                aria-label="Скопировать ссылку"
                                                style={participantCopyButtonStyle}
                                                onClick={() => copyText(`${item.sessionId}:link`, participantLink)}>
                                                ⧉
                                            </button>
                                        </div>
                                        <span style={copyHintStyle}>{copiedKey === `${item.sessionId}:link` ? "Скопировано" : ""}</span>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>
        </Layout>
    );
}

const layoutStyle = {
    minHeight: "100vh",
    background: "#f5f7f8",
    color: "#101820",
};

const pageStyle = {
    width: "min(1180px, 100%)",
    margin: "0 auto",
    padding: "28px 22px 40px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
};

const loginShellStyle = {
    minHeight: "calc(100vh - 56px)",
    display: "grid",
    placeItems: "center",
    padding: 20,
};

const loginBoxStyle = {
    width: "min(360px, 100%)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    border: "1px solid #d9e0e5",
    borderRadius: 8,
    background: "#fff",
    padding: 20,
};

const loginTitleStyle = {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.2,
};

const loginInputStyle = {
    minHeight: 46,
    border: "1px solid #b9c4cc",
    borderRadius: 8,
    padding: "0 12px",
    fontSize: 18,
};

const headerStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 18,
    alignItems: "center",
};

const compactHeaderStyle = {
    gridTemplateColumns: "minmax(0, 1fr)",
};

const eyebrowStyle = {
    fontSize: 12,
    letterSpacing: 0,
    color: "#627178",
    marginBottom: 6,
    fontWeight: 800,
};

const titleStyle = {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.08,
};

const metricGridStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(140px, 180px)",
    justifyContent: "end",
    gap: 10,
};

const compactMetricGridStyle = {
    gridTemplateColumns: "minmax(0, 1fr)",
    justifyContent: "stretch",
};

const metricStyle = {
    padding: 0,
    textAlign: "right",
};

const metricValueStyle = {
    display: "block",
    fontSize: 30,
    fontWeight: 800,
    lineHeight: 1,
};

const metricLabelStyle = {
    display: "block",
    marginTop: 6,
    color: "#627178",
    fontSize: 13,
};

const metricTopUpLinkStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    marginTop: 12,
    border: "1px solid #152022",
    borderRadius: 8,
    background: "#152022",
    color: "#fff",
    padding: "0 14px",
    fontSize: 13,
    fontWeight: 800,
    textDecoration: "none",
};

const metaLineStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 12px",
    color: "#627178",
    fontSize: 14,
};

const createPanelStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1fr) 110px auto",
    gap: 12,
    alignItems: "end",
    border: "1px solid #d9e0e5",
    borderRadius: 8,
    background: "#fff",
    padding: 14,
};

const panelTitleStyle = {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.25,
};

const compactCreatePanelStyle = {
    gridTemplateColumns: "minmax(0, 1fr)",
};

const createActionStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 245,
};

const createFeedbackStyle = {
    minWidth: 104,
    color: "#1c6b33",
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
};

const fieldStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
};

const labelStyle = {
    fontSize: 12,
    fontWeight: 700,
    color: "#627178",
};

const inputStyle = {
    minHeight: 42,
    border: "1px solid #b9c4cc",
    borderRadius: 8,
    padding: "0 12px",
    fontSize: 14,
    background: "#fff",
};

const primaryButtonStyle = {
    minHeight: 42,
    border: "1px solid #152022",
    borderRadius: 8,
    background: "#152022",
    color: "#fff",
    padding: "0 16px",
    fontWeight: 800,
    cursor: "pointer",
};

const secondaryButtonStyle = {
    minHeight: 38,
    border: "1px solid #b9c4cc",
    borderRadius: 8,
    background: "#fff",
    color: "#152022",
    padding: "0 12px",
    fontWeight: 700,
    cursor: "pointer",
};

const participantCopyButtonStyle = {
    width: 42,
    minHeight: 34,
    border: "1px solid #b9c4cc",
    borderRadius: 8,
    background: "#fff",
    color: "#152022",
    fontSize: 16,
    fontWeight: 900,
    cursor: "pointer",
};

const sessionsListStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 12,
};

const materialsPanelStyle = {
    display: "grid",
    gap: 12,
    border: "1px solid #d9e0e5",
    borderRadius: 8,
    background: "#fff",
    padding: 16,
};

const materialsGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
};

const materialLinkStyle = {
    display: "grid",
    gap: 6,
    border: "1px solid #d9e0e5",
    borderRadius: 8,
    background: "#f5f7f8",
    padding: 12,
    color: "#152022",
    textDecoration: "none",
};

const materialTitleStyle = {
    fontSize: 14,
    fontWeight: 800,
    overflowWrap: "anywhere",
};

const materialMetaStyle = {
    color: "#627178",
    fontSize: 12,
    fontWeight: 700,
};

const sessionRowStyle = {
    border: "1px solid #d9e0e5",
    borderRadius: 8,
    background: "#fff",
    padding: 14,
};

const sessionHeaderStyle = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "start",
};

const compactSessionHeaderStyle = {
    flexDirection: "column",
};

const sessionTitleStyle = {
    margin: 0,
    fontSize: 20,
};

const sessionMetaStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 12px",
    marginTop: 6,
    color: "#627178",
    fontSize: 13,
};

const shareGridStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 10,
    marginTop: 12,
};

const compactShareGridStyle = {
    gridTemplateColumns: "minmax(0, 1fr)",
};

const shareBoxStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 8,
    alignItems: "center",
    borderRadius: 8,
    background: "#f5f7f8",
    padding: 10,
};

const linkLineStyle = {
    gridColumn: "1 / -1",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 8,
    alignItems: "center",
};

const codeStyle = {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 13,
};

const copyHintStyle = {
    minWidth: 92,
    color: "#1c6b33",
    fontSize: 13,
    fontWeight: 700,
};

const emptyStyle = {
    border: "1px dashed #b9c4cc",
    borderRadius: 8,
    padding: 18,
    background: "#fff",
    color: "#627178",
};

const errorStyle = {
    color: "#b42318",
    fontSize: 13,
};

const noticeErrorStyle = {
    border: "1px solid #f4b8b1",
    borderRadius: 8,
    background: "#fff3f1",
    color: "#9f1f14",
    padding: "10px 12px",
};

const noticeSuccessStyle = {
    border: "1px solid #bde4c7",
    borderRadius: 8,
    background: "#f1fff4",
    color: "#1c6b33",
    padding: "10px 12px",
};

