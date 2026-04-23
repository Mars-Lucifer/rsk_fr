"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import Header from "@/components/layout/Header";
import MayakAdminBackLink from "@/components/mayak-admin/MayakAdminBackLink";
import { buildMayakAdminLoginUrl, getMayakAdminAuthStatus } from "@/lib/mayakAdminClient";

const initialForm = {
    userId: "",
    sectionId: "",
    taskRange: "",
    rangeName: "",
    totalQuota: "10",
};

function formatDateTime(value) {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
        return "-";
    }

    return parsed.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function MayakAdminRightsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAuth, setIsAuth] = useState(false);
    const [rights, setRights] = useState([]);
    const [ranges, setRanges] = useState([]);
    const [form, setForm] = useState(initialForm);
    const [editingId, setEditingId] = useState("");
    const [saving, setSaving] = useState(false);
    const [revokingId, setRevokingId] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const rangeOptions = useMemo(
        () =>
            ranges.map((range) => ({
                value: range.sectionId || range.range,
                sectionId: range.sectionId || range.range,
                taskRange: range.range || range.sectionId || range.range,
                rangeName: range.rangeName || "",
            })),
        [ranges]
    );

    const loadAll = useCallback(async () => {
        try {
            setLoading(true);
            const [rightsRes, rangesRes] = await Promise.all([fetch("/api/admin/mayak-admin-rights"), fetch("/api/admin/mayak-content/ranges")]);

            const rightsPayload = await rightsRes.json().catch(() => ({}));
            const rangesPayload = await rangesRes.json().catch(() => ({}));

            if (!rightsRes.ok || !rightsPayload.success) {
                throw new Error(rightsPayload.error || "Не удалось загрузить выданные права");
            }
            if (!rangesRes.ok || !rangesPayload.success) {
                throw new Error(rangesPayload.error || "Не удалось загрузить колоды МАЯК");
            }

            setRights(Array.isArray(rightsPayload.data) ? rightsPayload.data : []);
            setRanges(Array.isArray(rangesPayload.data) ? rangesPayload.data : []);
            setError("");
        } catch (loadError) {
            setError(loadError.message || "Не удалось загрузить данные");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!router.isReady) return;

        let cancelled = false;

        async function checkAuth() {
            try {
                const { authenticated } = await getMayakAdminAuthStatus();
                if (cancelled) return;

                if (authenticated) {
                    setIsAuth(true);
                } else {
                    router.replace(buildMayakAdminLoginUrl(router.asPath || "/admin/mayak-admin-rights"));
                }
            } catch {
                if (!cancelled) {
                    router.replace(buildMayakAdminLoginUrl(router.asPath || "/admin/mayak-admin-rights"));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        checkAuth();

        return () => {
            cancelled = true;
        };
    }, [router]);

    useEffect(() => {
        if (isAuth) {
            loadAll();
        }
    }, [isAuth, loadAll]);

    const resetForm = () => {
        setForm(initialForm);
        setEditingId("");
    };

    const handleRangeChange = (value) => {
        const selectedRange = rangeOptions.find((range) => range.value === value) || null;
        setForm((current) => ({
            ...current,
            sectionId: selectedRange?.sectionId || "",
            taskRange: selectedRange?.taskRange || "",
            rangeName: selectedRange?.rangeName || "",
        }));
    };

    const handleSubmit = async () => {
        setSaving(true);
        setError("");
        setMessage("");

        try {
            const response = await fetch(editingId ? `/api/admin/mayak-admin-rights/${editingId}` : "/api/admin/mayak-admin-rights", {
                method: editingId ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || "Не удалось сохранить права");
            }

            setMessage(editingId ? "Право обновлено" : "Право выдано");
            resetForm();
            await loadAll();
        } catch (submitError) {
            setError(submitError.message || "Не удалось сохранить права");
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (right) => {
        setEditingId(right.id);
        setForm({
            userId: right.userId || "",
            sectionId: right.sectionId || "",
            taskRange: right.taskRange || "",
            rangeName: right.rangeName || "",
            totalQuota: String(right.totalQuota || 10),
        });
        setError("");
        setMessage("");
    };

    const handleRevoke = async (right) => {
        if (!window.confirm(`Отозвать права у пользователя ${right.fullName || right.userId}?`)) {
            return;
        }

        setRevokingId(right.id);
        setError("");
        setMessage("");

        try {
            const response = await fetch(`/api/admin/mayak-admin-rights/${right.id}`, {
                method: "DELETE",
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || "Не удалось отозвать права");
            }

            if (editingId === right.id) {
                resetForm();
            }

            setMessage("Права отозваны");
            await loadAll();
        } catch (revokeError) {
            setError(revokeError.message || "Не удалось отозвать права");
        } finally {
            setRevokingId("");
        }
    };

    if (!isAuth) {
        return (
            <>
                <Header />
                {!loading ? <div style={{ padding: 32, textAlign: "center" }}>Проверка доступа...</div> : null}
            </>
        );
    }

    return (
        <>
            <Header />
            <div style={{ maxWidth: 1240, margin: "0 auto", padding: "16px 20px 40px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                    <div>
                        <h1 style={{ fontSize: 24, margin: 0, color: "#0f172a" }}>Админ-права МАЯК</h1>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
                            Выдача прав на создание пользовательских токенов по ID с привязкой к конкретной колоде.
                        </div>
                    </div>
                    <MayakAdminBackLink />
                </div>

                {error ? <div style={{ ...noticeStyle, background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" }}>{error}</div> : null}
                {message ? <div style={{ ...noticeStyle, background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}>{message}</div> : null}

                <section style={panelStyle}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>{editingId ? "Обновить право" : "Выдать право"}</div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(220px, 1.05fr) minmax(220px, 1.35fr) minmax(160px, 0.8fr) minmax(140px, 0.75fr) auto",
                            gap: 12,
                            alignItems: "end",
                        }}>
                        <label style={fieldStyle}>
                            <span style={labelStyle}>ID пользователя</span>
                            <input
                                value={form.userId}
                                onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
                                style={inputStyle}
                                placeholder="Например, 900001"
                                disabled={Boolean(editingId)}
                            />
                        </label>

                        <label style={fieldStyle}>
                            <span style={labelStyle}>Колода МАЯК</span>
                            <select value={form.sectionId} onChange={(event) => handleRangeChange(event.target.value)} style={inputStyle}>
                                <option value="">Выберите колоду</option>
                                {rangeOptions.map((range) => (
                                    <option key={range.value} value={range.value}>
                                        {range.value}
                                        {range.rangeName ? ` • ${range.rangeName}` : ""}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label style={fieldStyle}>
                            <span style={labelStyle}>Диапазон</span>
                            <input value={form.taskRange} readOnly style={{ ...inputStyle, background: "#f8fafc" }} />
                        </label>

                        <label style={fieldStyle}>
                            <span style={labelStyle}>Кол-во выдач</span>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={form.totalQuota}
                                onChange={(event) => setForm((current) => ({ ...current, totalQuota: event.target.value }))}
                                style={inputStyle}
                                placeholder="10"
                            />
                        </label>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            {editingId ? (
                                <button type="button" style={secondaryButtonStyle} onClick={resetForm}>
                                    Отмена
                                </button>
                            ) : null}
                            <button type="button" style={primaryButtonStyle} onClick={handleSubmit} disabled={saving}>
                                {saving ? "Сохраняем..." : editingId ? "Сохранить" : "Выдать"}
                            </button>
                        </div>
                    </div>
                </section>

                <section style={{ marginTop: 24 }}>
                    <div style={sectionHeaderStyle}>
                        <h2 style={{ margin: 0, fontSize: 18 }}>Выданные права</h2>
                        <span style={sectionCountStyle}>{rights.length}</span>
                    </div>

                    {loading ? (
                        <div style={emptyHintStyle}>Загрузка...</div>
                    ) : rights.length === 0 ? (
                        <div style={emptyHintStyle}>Выданных прав пока нет.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {rights.map((right) => (
                                <article key={right.id} style={rowCardStyle}>
                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns:
                                                "minmax(220px, 1.2fr) minmax(90px, 110px) minmax(180px, 1fr) minmax(120px, 120px) minmax(120px, 140px) minmax(160px, 0.9fr) auto",
                                            gap: 12,
                                            alignItems: "center",
                                            width: "100%",
                                        }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {right.fullName || "Без имени"}
                                            </div>
                                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{`ID: ${right.userId}`}</div>
                                        </div>

                                        <span
                                            style={{
                                                ...statusBadgeStyle,
                                                background: right.status === "active" ? "#dcfce7" : "#f1f5f9",
                                                color: right.status === "active" ? "#166534" : "#475569",
                                            }}>
                                            {right.status === "active" ? "Активно" : "Отозвано"}
                                        </span>

                                        <div style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#334155" }}>
                                            {right.rangeName || right.sectionId || right.taskRange}
                                        </div>

                                        <div style={{ color: "#334155" }}>{`${right.remainingQuota}/${right.totalQuota}`}</div>
                                        <div style={{ color: "#64748b" }}>{`Исп.: ${right.usedQuota}`}</div>
                                        <div style={{ color: "#64748b", fontSize: 12 }}>{formatDateTime(right.grantedAt)}</div>

                                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                                            <button type="button" style={secondaryButtonStyle} onClick={() => handleEdit(right)}>
                                                Изменить
                                            </button>
                                            {right.status === "active" ? (
                                                <button type="button" style={dangerButtonStyle} onClick={() => handleRevoke(right)} disabled={revokingId === right.id}>
                                                    {revokingId === right.id ? "Отзываем..." : "Отозвать"}
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </>
    );
}

const panelStyle = {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#fff",
    padding: 16,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
};

const rowCardStyle = {
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#fff",
    padding: "14px 16px",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.03)",
    overflowX: "auto",
};

const fieldStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
};

const labelStyle = {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
};

const inputStyle = {
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    minHeight: 44,
    padding: "0 14px",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
};

const noticeStyle = {
    border: "1px solid",
    borderRadius: 12,
    padding: "12px 14px",
    marginBottom: 12,
};

const sectionHeaderStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
};

const sectionCountStyle = {
    display: "inline-flex",
    minWidth: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    background: "#e2e8f0",
    color: "#334155",
    fontSize: 12,
    fontWeight: 700,
    padding: "0 8px",
};

const emptyHintStyle = {
    borderRadius: 16,
    border: "1px dashed #cbd5e1",
    padding: "24px 18px",
    color: "#64748b",
    background: "#fff",
};

const statusBadgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
};

const primaryButtonStyle = {
    borderRadius: 12,
    background: "#0f172a",
    color: "#fff",
    border: "none",
    minHeight: 44,
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
};

const secondaryButtonStyle = {
    borderRadius: 12,
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    minHeight: 40,
    padding: "0 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
};

const dangerButtonStyle = {
    borderRadius: 12,
    background: "#fff1f2",
    color: "#be123c",
    border: "1px solid #fecdd3",
    minHeight: 40,
    padding: "0 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
};
