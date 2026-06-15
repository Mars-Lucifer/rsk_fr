"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import Header from "@/components/layout/Header";
import MayakAdminBackLink from "@/components/mayak-admin/MayakAdminBackLink";
import { buildMayakAdminLoginUrl, getMayakAdminAuthStatus } from "@/lib/mayakAdminClient";

const TOKEN_TYPES = [
    { id: "all", label: "Все токены" },
    { id: "legacy", label: "Обычный токен" },
    { id: "session", label: "Сессионный токен" },
    { id: "external_link", label: "Внешняя ссылка" },
];

const MAYAK_GUEST_SUFFIX = "aaaaa";

const CREATE_TOKEN_TYPES = TOKEN_TYPES.filter((type) => type.id !== "all");

const initialLegacyForm = {
    name: "",
    sectionId: "",
    taskRange: "",
    usageLimit: "1",
};

const initialSessionForm = {
    name: "",
    sectionId: "",
    taskRange: "",
    tableCount: "1",
    tokenUsageLimit: "1",
    reviewTimeoutSeconds: "130",
    reworkTimeoutSeconds: "180",
};

const initialExternalForm = {
    title: "",
    sectionId: "",
    taskRange: "",
    rangeName: "",
    totalQuota: "1000000",
    totalParticipantLimit: "180",
};

function getTypeLabel(type) {
    return TOKEN_TYPES.find((item) => item.id === type)?.label || type;
}

function getTypeTone(type) {
    if (type === "legacy") return "ink";
    if (type === "session") return "teal";
    return "amber";
}

function formatDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatStatus(item) {
    if (item.status === "completed") return "Завершена";
    if (item.status === "revoked") return "Неактивна";
    if (item.status === "inactive") return "Неактивна";
    if (item.status === "exhausted") return "Лимит исчерпан";
    return "Активна";
}

function normalizeNumberInput(value, fallback) {
    const parsed = Number.parseInt(String(value || ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : String(fallback);
}

function buildAbsoluteUrl(path) {
    if (!path || typeof window === "undefined") return path || "";
    if (/^https?:\/\//i.test(path)) return path;
    if (!path.startsWith("/")) return path;
    return `${window.location.origin}${path}`;
}

function buildGuestToken(token) {
    if (!token) return "";
    const tokenValue = String(token).trim();
    return tokenValue.toLowerCase().endsWith(MAYAK_GUEST_SUFFIX) ? tokenValue : `${tokenValue}${MAYAK_GUEST_SUFFIX}`;
}

function buildTrainerLink(token) {
    const guestToken = buildGuestToken(token);
    return guestToken ? `/tools/mayak-oko?token=${encodeURIComponent(guestToken)}` : "";
}

async function parseJsonResponse(response, fallbackMessage) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
        throw new Error(payload.error || fallbackMessage);
    }
    return payload;
}

function RangeSelect({ value, ranges, onChange }) {
    return (
        <select
            value={value}
            onChange={(event) => {
                const sectionId = event.target.value;
                const range = ranges.find((item) => (item.sectionId || item.range) === sectionId) || null;
                onChange({
                    sectionId,
                    taskRange: range?.range || "",
                    rangeName: range?.rangeName || "",
                });
            }}
            className="token-input">
            <option value="">Выберите раздел</option>
            {ranges.map((range) => {
                const key = range.sectionId || range.range;
                return (
                    <option key={key} value={key}>
                        {key}
                        {range.rangeName ? ` - ${range.rangeName}` : ""}
                    </option>
                );
            })}
        </select>
    );
}

function CreateForm({ activeType, ranges, forms, setForms, onSubmit, saving }) {
    const { legacyForm, sessionForm, externalForm } = forms;

    if (activeType === "legacy") {
        return (
            <form className="create-form" onSubmit={onSubmit}>
                <label>
                    <span>Название</span>
                    <input className="token-input" value={legacyForm.name} onChange={(event) => setForms.setLegacyForm((current) => ({ ...current, name: event.target.value }))} placeholder="Например, индивидуальный доступ" />
                </label>
                <label>
                    <span>Раздел / колода</span>
                    <RangeSelect
                        value={legacyForm.sectionId}
                        ranges={ranges}
                        onChange={(nextRange) => setForms.setLegacyForm((current) => ({ ...current, ...nextRange }))}
                    />
                </label>
                <label>
                    <span>Лимит использований</span>
                    <input className="token-input" type="number" min="1" value={legacyForm.usageLimit} onChange={(event) => setForms.setLegacyForm((current) => ({ ...current, usageLimit: event.target.value }))} />
                </label>
                <button className="primary-button" type="submit" disabled={saving}>
                    {saving ? "Создаем..." : "Создать обычный токен"}
                </button>
            </form>
        );
    }

    if (activeType === "session") {
        return (
            <form className="create-form" onSubmit={onSubmit}>
                <label>
                    <span>Название сессии</span>
                    <input className="token-input" value={sessionForm.name} onChange={(event) => setForms.setSessionForm((current) => ({ ...current, name: event.target.value }))} placeholder="Например, Сессия 10А" />
                </label>
                <label>
                    <span>Раздел / колода</span>
                    <RangeSelect
                        value={sessionForm.sectionId}
                        ranges={ranges}
                        onChange={(nextRange) => setForms.setSessionForm((current) => ({ ...current, ...nextRange }))}
                    />
                </label>
                <label>
                    <span>Количество столов</span>
                    <input className="token-input" type="number" min="1" value={sessionForm.tableCount} onChange={(event) => setForms.setSessionForm((current) => ({ ...current, tableCount: event.target.value }))} />
                </label>
                <label>
                    <span>Лимит входов</span>
                    <input className="token-input" type="number" min="1" value={sessionForm.tokenUsageLimit} onChange={(event) => setForms.setSessionForm((current) => ({ ...current, tokenUsageLimit: event.target.value }))} />
                </label>
                <label>
                    <span>Таймер проверки, сек</span>
                    <input className="token-input" type="number" min="1" value={sessionForm.reviewTimeoutSeconds} onChange={(event) => setForms.setSessionForm((current) => ({ ...current, reviewTimeoutSeconds: event.target.value }))} />
                </label>
                <label>
                    <span>Таймер исправления, сек</span>
                    <input className="token-input" type="number" min="1" value={sessionForm.reworkTimeoutSeconds} onChange={(event) => setForms.setSessionForm((current) => ({ ...current, reworkTimeoutSeconds: event.target.value }))} />
                </label>
                <button className="primary-button" type="submit" disabled={saving}>
                    {saving ? "Создаем..." : "Создать сессию"}
                </button>
            </form>
        );
    }

    return (
        <form className="create-form" onSubmit={onSubmit}>
            <label>
                <span>Название доступа</span>
                <input className="token-input" value={externalForm.title} onChange={(event) => setForms.setExternalForm((current) => ({ ...current, title: event.target.value }))} placeholder="Например, Интенсив май" />
            </label>
            <label>
                <span>Раздел / колода</span>
                <RangeSelect
                    value={externalForm.sectionId}
                    ranges={ranges}
                    onChange={(nextRange) => setForms.setExternalForm((current) => ({ ...current, ...nextRange }))}
                />
            </label>
            <label>
                <span>Общий лимит входов</span>
                <input className="token-input" type="number" min="1" value={externalForm.totalParticipantLimit} onChange={(event) => setForms.setExternalForm((current) => ({ ...current, totalParticipantLimit: event.target.value }))} />
            </label>
            <button className="primary-button" type="submit" disabled={saving}>
                {saving ? "Генерируем..." : "Сгенерировать"}
            </button>
        </form>
    );
}

export default function AdminMayakTokens() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionId, setActionId] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [ranges, setRanges] = useState([]);
    const [items, setItems] = useState([]);
    const [totals, setTotals] = useState({});
    const [activeType, setActiveType] = useState("legacy");
    const [filterType, setFilterType] = useState("all");
    const [legacyForm, setLegacyForm] = useState(initialLegacyForm);
    const [sessionForm, setSessionForm] = useState(initialSessionForm);
    const [externalForm, setExternalForm] = useState(initialExternalForm);
    const [lastCreated, setLastCreated] = useState(null);
    const [editingId, setEditingId] = useState("");
    const [editDraft, setEditDraft] = useState({});
    const [actionFeedback, setActionFeedback] = useState({ id: "", text: "", type: "success" });

    useEffect(() => {
        if (!router.isReady) return;
        const requestedType = String(router.query.type || "");
        if (CREATE_TOKEN_TYPES.some((type) => type.id === requestedType)) {
            setActiveType(requestedType);
            setFilterType(requestedType);
        }
    }, [router.isReady, router.query.type]);

    useEffect(() => {
        let cancelled = false;

        async function checkAuth() {
            try {
                const { authenticated } = await getMayakAdminAuthStatus();
                if (cancelled) return;
                if (!authenticated) {
                    window.location.replace(buildMayakAdminLoginUrl(`${window.location.pathname}${window.location.search}`));
                    return;
                }
                setIsAuthenticated(true);
            } catch {
                if (!cancelled) {
                    window.location.replace(buildMayakAdminLoginUrl(`${window.location.pathname}${window.location.search}`));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        checkAuth();

        return () => {
            cancelled = true;
        };
    }, []);

    const loadRanges = useCallback(async () => {
        const payload = await parseJsonResponse(await fetch("/api/admin/mayak-content/ranges"), "Не удалось загрузить разделы");
        setRanges(Array.isArray(payload.data) ? payload.data : []);
    }, []);

    const loadItems = useCallback(async () => {
        const payload = await parseJsonResponse(await fetch("/api/admin/mayak-token-center"), "Не удалось загрузить токены");
        setItems(Array.isArray(payload.data) ? payload.data : []);
        setTotals(payload.totals || {});
    }, []);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([loadRanges(), loadItems()]);
            setError("");
        } catch (loadError) {
            setError(loadError.message || "Не удалось загрузить данные");
        } finally {
            setLoading(false);
        }
    }, [loadItems, loadRanges]);

    useEffect(() => {
        if (isAuthenticated) loadAll();
    }, [isAuthenticated, loadAll]);

    useEffect(() => {
        if (!message && !error) return undefined;
        const timeoutId = window.setTimeout(() => {
            setMessage("");
            setError("");
        }, 2400);
        return () => window.clearTimeout(timeoutId);
    }, [message, error]);

    useEffect(() => {
        if (!actionFeedback.text) return undefined;
        const timeoutId = window.setTimeout(() => setActionFeedback({ id: "", text: "", type: "success" }), 1600);
        return () => window.clearTimeout(timeoutId);
    }, [actionFeedback]);

    const visibleItems = useMemo(() => {
        return items.filter((item) => {
            if (filterType !== "all" && item.type !== filterType) return false;
            return true;
        });
    }, [filterType, items]);

    const copyAccess = async (item) => {
        const link = buildAbsoluteUrl(item.link);
        const text =
            item.type === "external_link"
                ? [
                      `Ссылка: ${link}`,
                      item.password ? `Пароль: ${item.password}` : "",
                      "",
                      "Это данные для входа в вашу админ-панель МАЯК.",
                      "Вход выполняется по ссылке и паролю. В панели можно создавать отдельные сессии для участников.",
                      "Введите название сессии, выберите количество столов/команд, которые будут проходить обучение, и скопируйте ссылку для участников.",
                      "",
                      "Важно: каждая созданная ссылка для обучения действует 24 часа, после чего данные удаляются.",
                  ]
                      .filter((line) => line !== null && line !== undefined)
                      .join("\n")
                : link;
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setActionFeedback({ id: item.id, text: "Скопировано", type: "success" });
        } catch {
            setActionFeedback({ id: item.id, text: "Не скопировано", type: "error" });
        }
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setMessage("");
        setLastCreated(null);

        try {
            let payload;
            if (activeType === "legacy") {
                payload = await parseJsonResponse(
                    await fetch("/api/admin/mayak-tokens/generate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: legacyForm.name.trim(),
                            usageLimit: normalizeNumberInput(legacyForm.usageLimit, 1),
                            sectionId: legacyForm.sectionId || null,
                            taskRange: legacyForm.taskRange || null,
                        }),
                    }),
                    "Не удалось создать обычный токен"
                );
                setLegacyForm(initialLegacyForm);
                setLastCreated({ type: "legacy", token: buildGuestToken(payload.data?.token || ""), link: buildTrainerLink(payload.data?.token || "") });
            } else if (activeType === "session") {
                payload = await parseJsonResponse(
                    await fetch("/api/admin/mayak-sessions", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: sessionForm.name.trim(),
                            sectionId: sessionForm.sectionId,
                            taskRange: sessionForm.taskRange,
                            tableCount: normalizeNumberInput(sessionForm.tableCount, 1),
                            tokenUsageLimit: normalizeNumberInput(sessionForm.tokenUsageLimit, 1),
                            reviewTimeoutSeconds: normalizeNumberInput(sessionForm.reviewTimeoutSeconds, 130),
                            reworkTimeoutSeconds: normalizeNumberInput(sessionForm.reworkTimeoutSeconds, 180),
                        }),
                    }),
                    "Не удалось создать сессию"
                );
                setSessionForm(initialSessionForm);
                setLastCreated({ type: "session", sessionId: payload.data?.id || "" });
            } else {
                payload = await parseJsonResponse(
                    await fetch("/api/admin/mayak-admin-rights", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            title: externalForm.title.trim(),
                            sectionId: externalForm.sectionId,
                            taskRange: externalForm.taskRange,
                            rangeName: externalForm.rangeName,
                            totalQuota: normalizeNumberInput(externalForm.totalQuota, 1000000),
                            totalParticipantLimit: normalizeNumberInput(externalForm.totalParticipantLimit, 180),
                        }),
                    }),
                    "Не удалось создать внешнюю ссылку"
                );
                setExternalForm(initialExternalForm);
                setLastCreated({
                    type: "external_link",
                    link: payload.data?.accessId ? `/mayak-access/${payload.data.accessId}` : "",
                    password: payload.data?.accessPassword || "",
                });
            }

            setMessage("Доступ создан");
            await loadItems();
        } catch (createError) {
            setError(createError.message || "Не удалось создать доступ");
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setEditDraft({
            title: item.title || "",
            sectionId: item.sectionId || "",
            taskRange: item.taskRange || "",
            rangeName: item.sourceRef?.rangeName || "",
            usageLimit: String(item.usageLimit || 1),
            tableCount: String(item.sourceRef?.tableCount || 1),
            tokenUsageLimit: String(item.sourceRef?.tokenUsageLimit || item.usageLimit || 1),
            reviewTimeoutSeconds: String(item.sourceRef?.reviewTimeoutSeconds || 130),
            reworkTimeoutSeconds: String(item.sourceRef?.reworkTimeoutSeconds || 180),
            totalQuota: String(item.sourceRef?.totalQuota || 1000000),
            totalParticipantLimit: String(item.sourceRef?.totalParticipantLimit || item.usageLimit || 180),
        });
    };

    const cancelEdit = () => {
        setEditingId("");
        setEditDraft({});
    };

    const saveEdit = async (item) => {
        setActionId(item.id);
        setError("");
        setMessage("");

        try {
            if (item.type === "legacy") {
                await parseJsonResponse(
                    await fetch(`/api/admin/mayak-tokens/${encodeURIComponent(item.id)}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: editDraft.title,
                            sectionId: editDraft.sectionId || null,
                            taskRange: editDraft.taskRange || null,
                            usageLimit: normalizeNumberInput(editDraft.usageLimit, item.usageLimit || 1),
                        }),
                    }),
                    "Не удалось обновить обычный токен"
                );
            } else if (item.type === "session") {
                await parseJsonResponse(
                    await fetch(`/api/admin/mayak-sessions/${encodeURIComponent(item.id)}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: editDraft.title,
                            sectionId: editDraft.sectionId,
                            taskRange: editDraft.taskRange,
                            tableCount: normalizeNumberInput(editDraft.tableCount, item.sourceRef?.tableCount || 1),
                            tokenUsageLimit: normalizeNumberInput(editDraft.tokenUsageLimit, item.usageLimit || 1),
                            reviewTimeoutSeconds: normalizeNumberInput(editDraft.reviewTimeoutSeconds, item.sourceRef?.reviewTimeoutSeconds || 130),
                            reworkTimeoutSeconds: normalizeNumberInput(editDraft.reworkTimeoutSeconds, item.sourceRef?.reworkTimeoutSeconds || 180),
                        }),
                    }),
                    "Не удалось обновить сессию"
                );
            } else {
                await parseJsonResponse(
                    await fetch(`/api/admin/mayak-admin-rights/${encodeURIComponent(item.id)}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            title: editDraft.title,
                            sectionId: editDraft.sectionId,
                            taskRange: editDraft.taskRange,
                            rangeName: editDraft.rangeName || "",
                            totalQuota: normalizeNumberInput(editDraft.totalQuota, item.sourceRef?.totalQuota || 1000000),
                            totalParticipantLimit: normalizeNumberInput(editDraft.totalParticipantLimit, item.sourceRef?.totalParticipantLimit || 180),
                        }),
                    }),
                    "Не удалось обновить внешнюю ссылку"
                );
            }
            setActionFeedback({ id: item.id, text: "Сохранено", type: "success" });
            cancelEdit();
            await loadItems();
        } catch (editError) {
            setActionFeedback({ id: item.id, text: editError.message || "Не сохранено", type: "error" });
        } finally {
            setActionId("");
        }
    };

    const handleRemove = async (item) => {
        const actionLabel = item.type === "session" ? "завершить" : "удалить";
        if (!window.confirm(`${actionLabel[0].toUpperCase()}${actionLabel.slice(1)} "${item.title}"?`)) return;

        setActionId(item.id);
        setError("");
        setMessage("");

        try {
            const url =
                item.type === "legacy"
                    ? `/api/admin/mayak-tokens/${encodeURIComponent(item.id)}`
                    : item.type === "session"
                      ? `/api/admin/mayak-sessions/${encodeURIComponent(item.id)}`
                      : `/api/admin/mayak-admin-rights/${encodeURIComponent(item.id)}`;

            await parseJsonResponse(await fetch(url, { method: "DELETE" }), "Не удалось выполнить действие");
            setActionFeedback({ id: item.id, text: item.type === "session" ? "Завершено" : "Удалено", type: "success" });
            await loadItems();
        } catch (removeError) {
            setActionFeedback({ id: item.id, text: removeError.message || "Ошибка", type: "error" });
        } finally {
            setActionId("");
        }
    };

    if (!isAuthenticated) {
        return (
            <>
                <Header />
                <main className="token-page">
                    <div className="muted">{loading ? "Проверка доступа..." : "Нужна авторизация администратора"}</div>
                </main>
            </>
        );
    }

    return (
        <>
            <Header />
            <main className="token-page">
                <div className="token-topbar">
                    <div>
                        <div className="eyebrow">MAYAK admin</div>
                        <h1>Выдача токенов</h1>
                    </div>
                    <MayakAdminBackLink />
                </div>

                {error ? <div className="notice error">{error}</div> : null}
                {message ? <div className="notice success">{message}</div> : null}

                <section className="panel">
                    <div className="type-switcher">
                        {TOKEN_TYPES.map((type) => (
                            <button
                                key={type.id}
                                type="button"
                                className={activeType === type.id ? "active" : ""}
                                onClick={() => {
                                    if (type.id === "all") {
                                        setActiveType("all");
                                        setFilterType("all");
                                        router.replace({ pathname: router.pathname }, undefined, { shallow: true });
                                        return;
                                    }
                                    setActiveType(type.id);
                                    setFilterType(type.id);
                                    router.replace({ pathname: router.pathname, query: { type: type.id } }, undefined, { shallow: true });
                                }}>
                                <strong>{type.label}</strong>
                                <span>
                                    {type.id === "all"
                                        ? totals.total || 0
                                        : type.id === "legacy"
                                          ? totals.legacy || 0
                                          : type.id === "session"
                                            ? totals.session || 0
                                            : totals.external_link || 0}
                                </span>
                            </button>
                        ))}
                    </div>

                    {activeType !== "all" ? (
                        <CreateForm
                            activeType={activeType}
                            ranges={ranges}
                            forms={{ legacyForm, sessionForm, externalForm }}
                            setForms={{ setLegacyForm, setSessionForm, setExternalForm }}
                            onSubmit={handleCreate}
                            saving={saving}
                        />
                    ) : null}

                    {lastCreated ? (
                        <div className="created-box">
                            <strong>Создано:</strong>
                            {lastCreated.token ? <code>{lastCreated.token}</code> : null}
                            {lastCreated.link ? <code>{buildAbsoluteUrl(lastCreated.link)}</code> : null}
                            {lastCreated.sessionId ? <span>Сессия появится в списке ниже после обновления данных.</span> : null}
                        </div>
                    ) : null}
                </section>

                <section className="panel">
                    {activeType === "all" ? (
                        <div className="filters">
                            <select
                                className="token-input"
                                value={filterType}
                                onChange={(event) => setFilterType(event.target.value)}>
                                <option value="all">Все токены ({totals.total || 0})</option>
                                <option value="legacy">Обычные ({totals.legacy || 0})</option>
                                <option value="session">Сессии ({totals.session || 0})</option>
                                <option value="external_link">Внешние ({totals.external_link || 0})</option>
                            </select>
                        </div>
                    ) : null}

                    {loading ? <div className="empty">Загрузка...</div> : null}
                    {!loading && visibleItems.length === 0 ? <div className="empty">Доступы не найдены</div> : null}

                    <div className="access-list">
                        {visibleItems.map((item) => {
                            const tone = getTypeTone(item.type);
                            const isEditing = editingId === item.id;
                            const removeLabel = item.type === "session" ? "Завершить" : "Удалить";
                            return (
                                <article key={`${item.type}:${item.id}`} className={`access-card ${tone}`}>
                                    <div className="access-main">
                                        <div>
                                            <div className="card-line">
                                                <span className={`type-badge ${tone}`}>{getTypeLabel(item.type)}</span>
                                                <span className="status-badge">{formatStatus(item)}</span>
                                            </div>
                                            {isEditing ? (
                                                <div className="edit-stack">
                                                    <input className="token-input compact" value={editDraft.title || ""} onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))} />
                                                    <RangeSelect value={editDraft.sectionId || ""} ranges={ranges} onChange={(nextRange) => setEditDraft((current) => ({ ...current, ...nextRange }))} />
                                                </div>
                                            ) : (
                                                <>
                                                    <h3>{item.title}</h3>
                                                    <div className="meta">
                                                        <span>{item.sectionId || "Без раздела"}</span>
                                                        {item.taskRange && item.taskRange !== item.sectionId ? <span>{item.taskRange}</span> : null}
                                                        <span>{formatDate(item.updatedAt || item.createdAt)}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="usage-meter">
                                            {isEditing ? (
                                                <div className="edit-grid">
                                                    {item.type === "legacy" ? (
                                                        <label>
                                                            <span>Лимит</span>
                                                            <input className="token-input compact" type="number" min="1" value={editDraft.usageLimit || ""} onChange={(event) => setEditDraft((current) => ({ ...current, usageLimit: event.target.value }))} />
                                                        </label>
                                                    ) : null}
                                                    {item.type === "session" ? (
                                                        <>
                                                            <label>
                                                                <span>Столы</span>
                                                                <input className="token-input compact" type="number" min="1" value={editDraft.tableCount || ""} onChange={(event) => setEditDraft((current) => ({ ...current, tableCount: event.target.value }))} />
                                                            </label>
                                                            <label>
                                                                <span>Лимит</span>
                                                                <input className="token-input compact" type="number" min="1" value={editDraft.tokenUsageLimit || ""} onChange={(event) => setEditDraft((current) => ({ ...current, tokenUsageLimit: event.target.value }))} />
                                                            </label>
                                                            <label>
                                                                <span>Проверка</span>
                                                                <input className="token-input compact" type="number" min="1" value={editDraft.reviewTimeoutSeconds || ""} onChange={(event) => setEditDraft((current) => ({ ...current, reviewTimeoutSeconds: event.target.value }))} />
                                                            </label>
                                                            <label>
                                                                <span>Исправл.</span>
                                                                <input className="token-input compact" type="number" min="1" value={editDraft.reworkTimeoutSeconds || ""} onChange={(event) => setEditDraft((current) => ({ ...current, reworkTimeoutSeconds: event.target.value }))} />
                                                            </label>
                                                        </>
                                                    ) : null}
                                                    {item.type === "external_link" ? (
                                                        <>
                                                            <label>
                                                                <span>Входы</span>
                                                                <input className="token-input compact" type="number" min="1" value={editDraft.totalParticipantLimit || ""} onChange={(event) => setEditDraft((current) => ({ ...current, totalParticipantLimit: event.target.value }))} />
                                                            </label>
                                                        </>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="usage-line">
                                                        <strong>{item.usedCount || 0}</strong>
                                                        <span>/ {item.usageLimit || 0} входов</span>
                                                    </div>
                                                    <div className="usage-track">
                                                        <span style={{ width: `${Math.min(100, Math.max(0, ((item.usedCount || 0) / Math.max(1, item.usageLimit || 1)) * 100))}%` }} />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="value-grid">
                                        {item.token ? (
                                            <div>
                                                <span>Токен</span>
                                                <code>{item.token}</code>
                                            </div>
                                        ) : null}
                                        {item.link ? (
                                            <div>
                                                <span>Ссылка</span>
                                                <code>{buildAbsoluteUrl(item.link)}</code>
                                            </div>
                                        ) : null}
                                        {item.password && item.type !== "external_link" ? (
                                            <div>
                                                <span>Пароль</span>
                                                <code>{item.password}</code>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="actions">
                                        <span className={`action-feedback ${actionFeedback.id === item.id ? actionFeedback.type : ""}`}>
                                            {actionFeedback.id === item.id ? actionFeedback.text : ""}
                                        </span>
                                        {isEditing ? (
                                            <>
                                                <button type="button" className="icon-button save" onClick={() => saveEdit(item)} disabled={actionId === item.id}>
                                                    OK
                                                </button>
                                                <button type="button" className="icon-button" onClick={cancelEdit} disabled={actionId === item.id}>
                                                    Esc
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {item.type === "session" && item.status !== "completed" ? (
                                                    <button
                                                        type="button"
                                                        className="icon-button dashboard"
                                                        title="Дашборд аналитики"
                                                        aria-label="Дашборд аналитики"
                                                        onClick={() => router.push(`/admin/mayak-sessions/${item.sourceRef?.sessionId || item.id}/dashboard`)}
                                                    >
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M3 3v18h18" />
                                                            <rect x="7" y="11" width="3" height="6" />
                                                            <rect x="12" y="7" width="3" height="10" />
                                                            <rect x="17" y="13" width="3" height="4" />
                                                        </svg>
                                                    </button>
                                                ) : null}
                                                <button type="button" className="icon-button" title="Скопировать" aria-label="Скопировать" onClick={() => copyAccess(item)} disabled={!item.link}>
                                                    ⧉
                                                </button>
                                                <button type="button" className="icon-button" title="Редактировать" aria-label="Редактировать" onClick={() => startEdit(item)} disabled={item.status === "completed" || item.status === "revoked"}>
                                                    ✎
                                                </button>
                                                <button type="button" className="icon-button danger" title={removeLabel} aria-label={removeLabel} onClick={() => handleRemove(item)} disabled={actionId === item.id || item.status === "revoked"}>
                                                    ×
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            </main>

            <style jsx global>{`
                .token-page {
                    width: 100%;
                    max-width: none;
                    margin: 0;
                    padding: 10px 14px 28px;
                    color: #0f172a;
                    background: #f8fafc;
                }

                .token-topbar,
                .list-header,
                .access-main {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    align-items: center;
                }

                .eyebrow {
                    color: #475569;
                    font-size: 12px;
                    font-weight: 800;
                    letter-spacing: 0;
                    text-transform: uppercase;
                }

                h1,
                h2,
                h3,
                p {
                    margin: 0;
                }

                h1 {
                    margin-top: 2px;
                    font-size: 26px;
                    line-height: 1.1;
                    color: #020617;
                }

                h2 {
                    font-size: 18px;
                    color: #020617;
                }

                h3 {
                    margin-top: 7px;
                    font-size: 16px;
                    line-height: 1.25;
                    color: #020617;
                }

                .token-topbar p,
                .list-header p,
                .empty,
                .muted {
                    margin-top: 8px;
                    color: #64748b;
                    font-size: 14px;
                    line-height: 1.5;
                }

                .panel {
                    margin-top: 10px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: #ffffff;
                    padding: 12px;
                    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
                }

                .type-switcher {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 8px;
                    margin-bottom: 10px;
                }

                .type-switcher button,
                .primary-button,
                .ghost-button,
                .danger-button,
                .icon-button {
                    border-radius: 8px;
                    font: inherit;
                    cursor: pointer;
                    transition:
                        transform 0.15s ease,
                        border-color 0.15s ease,
                        background 0.15s ease;
                }

                .type-switcher button {
                    border: 1px solid #dbe4ef;
                    background: #f8fafc;
                    padding: 10px 12px;
                    text-align: center;
                    color: #0f172a;
                }

                .type-switcher button.active {
                    border-color: #0f766e;
                    background: #0f766e;
                    color: #ffffff;
                }

                .type-switcher strong,
                .type-switcher span {
                    display: inline;
                    font-size: 14px;
                    line-height: 1.2;
                }

                .type-switcher span {
                    margin-left: 8px;
                    opacity: 0.75;
                }

                .create-form {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
                    gap: 9px;
                    align-items: end;
                }

                label {
                    display: flex;
                    flex-direction: column;
                    gap: 7px;
                    min-width: 0;
                }

                label span {
                    color: #1f2937;
                    font-size: 12px;
                    font-weight: 800;
                    text-transform: uppercase;
                }

                .token-input {
                    width: 100%;
                    min-height: 38px;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    background: #fff;
                    color: #020617;
                    font-size: 14px;
                    padding: 8px 10px;
                    outline: none;
                }

                .token-input:focus {
                    border-color: #0f766e;
                    box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
                }

                .filters,
                .actions,
                .card-line,
                .meta {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    flex-wrap: wrap;
                }

                .primary-button {
                    min-height: 38px;
                    border: 1px solid #0f766e;
                    background: #0f766e;
                    color: #fff;
                    font-weight: 800;
                    padding: 10px 16px;
                }

                .ghost-button {
                    min-height: 38px;
                    border: 1px solid #cbd5e1;
                    background: #fff;
                    color: #0f172a;
                    font-weight: 700;
                    padding: 8px 12px;
                }

                .danger-button {
                    min-height: 38px;
                    border: 1px solid #fecaca;
                    background: #fef2f2;
                    color: #b91c1c;
                    font-weight: 800;
                    padding: 8px 12px;
                }

                button:disabled {
                    cursor: not-allowed;
                    opacity: 0.55;
                }

                .notice {
                    position: fixed;
                    top: 12px;
                    right: 14px;
                    z-index: 1000;
                    max-width: min(420px, calc(100vw - 28px));
                    border-radius: 8px;
                    padding: 10px 12px;
                    font-size: 14px;
                    line-height: 1.45;
                    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
                }

                .created-box {
                    margin-top: 10px;
                    border-radius: 8px;
                    padding: 10px 12px;
                    font-size: 14px;
                    line-height: 1.45;
                }

                .notice.error {
                    border: 1px solid #fecaca;
                    background: #fef2f2;
                    color: #991b1b;
                }

                .notice.success {
                    border: 1px solid #bbf7d0;
                    background: #f0fdf4;
                    color: #166534;
                }

                .action-feedback {
                    display: inline-flex;
                    align-items: center;
                    min-height: 28px;
                    min-width: 92px;
                    color: #166534;
                    font-size: 13px;
                    font-weight: 700;
                    white-space: nowrap;
                }

                .action-feedback.error {
                    color: #b91c1c;
                }

                .created-box {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    flex-wrap: wrap;
                    border: 1px solid #bae6fd;
                    background: #f0f9ff;
                    color: #0c4a6e;
                }

                .filters {
                    margin-top: 10px;
                    display: grid;
                    grid-template-columns: minmax(220px, 340px);
                    gap: 10px;
                    align-items: center;
                }

                .access-list {
                    display: grid;
                    gap: 8px;
                    margin-top: 10px;
                }

                .access-card {
                    display: grid;
                    grid-template-columns: minmax(240px, 1.15fr) minmax(360px, 1.65fr) minmax(250px, auto);
                    gap: 12px;
                    align-items: center;
                    border: 1px solid #e2e8f0;
                    border-left-width: 5px;
                    border-radius: 8px;
                    padding: 10px 12px;
                    background: #fff;
                }

                .access-card.ink {
                    border-left-color: #334155;
                }

                .access-card.teal {
                    border-left-color: #0f766e;
                }

                .access-card.amber {
                    border-left-color: #d97706;
                }

                .type-badge,
                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    min-height: 22px;
                    border-radius: 999px;
                    padding: 2px 8px;
                    font-size: 12px;
                    font-weight: 800;
                }

                .type-badge.ink {
                    background: #f1f5f9;
                    color: #334155;
                }

                .type-badge.teal {
                    background: #ccfbf1;
                    color: #115e59;
                }

                .type-badge.amber {
                    background: #fef3c7;
                    color: #92400e;
                }

                .status-badge {
                    background: #f8fafc;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                }

                .meta {
                    margin-top: 6px;
                    color: #475569;
                    font-size: 13px;
                }

                .meta span:not(:last-child)::after {
                    content: "·";
                    margin-left: 8px;
                    color: #cbd5e1;
                }

                .usage-meter {
                    min-width: 132px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: #f8fafc;
                    padding: 8px;
                }

                .usage-line {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    gap: 8px;
                    color: #334155;
                }

                .usage-line strong {
                    color: #020617;
                    font-size: 18px;
                    line-height: 1;
                }

                .usage-line span {
                    color: #475569;
                    font-size: 12px;
                }

                .usage-track {
                    height: 5px;
                    overflow: hidden;
                    border-radius: 999px;
                    background: #e2e8f0;
                    margin-top: 7px;
                }

                .usage-track span {
                    display: block;
                    height: 100%;
                    border-radius: inherit;
                    background: #0f766e;
                }

                .value-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 8px;
                    margin-top: 0;
                    min-width: 0;
                }

                .value-grid div {
                    min-width: 0;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: #f8fafc;
                    padding: 7px 9px;
                }

                .value-grid span {
                    display: block;
                    color: #334155;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                }

                code {
                    display: block;
                    max-width: 100%;
                    margin-top: 3px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #0f172a;
                    font-size: 13px;
                }

                .actions {
                    align-self: center;
                    justify-content: flex-end;
                    margin-top: 0;
                    flex-wrap: nowrap;
                }

                .empty {
                    border: 1px dashed #cbd5e1;
                    border-radius: 8px;
                    padding: 18px;
                    text-align: center;
                }

                .edit-stack {
                    display: grid;
                    grid-template-columns: minmax(150px, 1fr) minmax(150px, 1fr);
                    gap: 8px;
                    margin-top: 7px;
                }

                .edit-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(82px, 1fr));
                    gap: 6px;
                    min-width: 260px;
                }

                .token-input.compact {
                    min-height: 34px;
                    padding: 6px 8px;
                }

                .icon-button {
                    min-width: 42px;
                    min-height: 34px;
                    border: 1px solid #cbd5e1;
                    background: #fff;
                    color: #0f172a;
                    font-size: 12px;
                    font-weight: 900;
                    padding: 6px 9px;
                }

                .icon-button.save {
                    border-color: #0f766e;
                    background: #ecfdf5;
                    color: #115e59;
                }

                .icon-button.danger {
                    border-color: #fecaca;
                    background: #fef2f2;
                    color: #b91c1c;
                    font-size: 16px;
                    line-height: 1;
                }

                .icon-button.dashboard {
                    border-color: #c7d2fe;
                    background: #eef2ff;
                    color: #4338ca;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }

                .icon-button.dashboard:hover {
                    border-color: #6366f1;
                    background: #e0e7ff;
                }

                @media (max-width: 1160px) {
                    .access-card {
                        grid-template-columns: 1fr;
                    }

                    .token-topbar,
                    .list-header,
                    .access-main {
                        flex-direction: column;
                    }

                    .type-switcher,
                    .filters {
                        grid-template-columns: 1fr;
                    }

                    .usage-meter {
                        width: 100%;
                        text-align: left;
                    }

                    .actions {
                        justify-content: flex-start;
                    }
                }

                @media (max-width: 720px) {
                    .token-page {
                        padding: 8px;
                    }

                    .type-switcher,
                    .filters {
                        grid-template-columns: 1fr;
                    }

                    .panel {
                        padding: 10px;
                    }
                }
            `}</style>
        </>
    );
}

