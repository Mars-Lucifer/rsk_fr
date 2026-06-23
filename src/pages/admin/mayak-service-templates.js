"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

import Header from "@/components/layout/Header";
import MayakAdminBackLink from "@/components/mayak-admin/MayakAdminBackLink";
import { buildMayakAdminLoginUrl, getMayakAdminAuthStatus } from "@/lib/mayakAdminClient";

const API_URL = "/api/admin/mayak-service-templates";
const SELF_PATH = "/admin/mayak-service-templates";

export default function AdminMayakServiceTemplatesPage() {
    const router = useRouter();
    const fileInputRef = useRef(null);
    const [isAuth, setIsAuth] = useState(false);
    const [loading, setLoading] = useState(true);
    const [services, setServices] = useState([]);
    const [serviceName, setServiceName] = useState("");
    const [serviceUrl, setServiceUrl] = useState("");
    const [formatName, setFormatName] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [busyKey, setBusyKey] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const redirectToLogin = useCallback(() => {
        router.replace(buildMayakAdminLoginUrl(SELF_PATH));
    }, [router]);

    const applyResponse = useCallback(
        async (response) => {
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.success === false) {
                if (response.status === 401) {
                    redirectToLogin();
                    throw new Error("Сессия администратора истекла. Войдите снова.");
                }
                throw new Error(payload?.error || "Не удалось выполнить запрос");
            }
            if (payload?.data?.services) setServices(payload.data.services);
            return payload;
        },
        [redirectToLogin]
    );

    const loadTemplates = useCallback(async () => {
        await applyResponse(await fetch(API_URL));
    }, [applyResponse]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { authenticated } = await getMayakAdminAuthStatus();
                if (cancelled) return;
                if (!authenticated) {
                    router.replace(buildMayakAdminLoginUrl(SELF_PATH));
                    return;
                }
                setIsAuth(true);
                await loadTemplates();
            } catch (authError) {
                if (!cancelled) setError(authError.message || "Не удалось проверить доступ");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [loadTemplates, router]);

    const handleUpload = async (event) => {
        event.preventDefault();
        if (!serviceName.trim() || !formatName.trim()) {
            setError("Заполните сервис и формат");
            return;
        }
        if (!selectedFile) {
            setError("Выберите .pptx файл шаблона");
            return;
        }
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const data = new FormData();
            data.append("serviceName", serviceName.trim());
            data.append("serviceUrl", serviceUrl.trim());
            data.append("formatName", formatName.trim());
            data.append("file", selectedFile);
            await applyResponse(await fetch(API_URL, { method: "POST", body: data }));
            setFormatName("");
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setMessage("Шаблон загружен и проверен");
        } catch (uploadError) {
            setError(uploadError.message || "Не удалось загрузить шаблон");
        } finally {
            setSaving(false);
        }
    };

    // Добавить/обновить сервис без шаблона (каталог: имя + ссылка).
    const handleAddService = async () => {
        if (!serviceName.trim()) {
            setError("Укажите название сервиса");
            return;
        }
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const data = new FormData();
            data.append("serviceName", serviceName.trim());
            data.append("serviceUrl", serviceUrl.trim());
            await applyResponse(await fetch(API_URL, { method: "POST", body: data }));
            setServiceUrl("");
            setMessage(`Сервис «${serviceName.trim()}» сохранён в каталоге`);
        } catch (saveError) {
            setError(saveError.message || "Не удалось сохранить сервис");
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveFormat = async (serviceKey, formatKey) => {
        const key = `${serviceKey}:${formatKey}`;
        setBusyKey(key);
        setError("");
        setMessage("");
        try {
            const data = new FormData();
            data.append("serviceKey", serviceKey);
            data.append("formatKey", formatKey);
            await applyResponse(await fetch(API_URL, { method: "DELETE", body: data }));
            setMessage("Формат удалён");
        } catch (removeError) {
            setError(removeError.message || "Не удалось удалить формат");
        } finally {
            setBusyKey("");
        }
    };

    const handleRemoveService = async (serviceKey) => {
        setBusyKey(serviceKey);
        setError("");
        setMessage("");
        try {
            const data = new FormData();
            data.append("serviceKey", serviceKey);
            await applyResponse(await fetch(API_URL, { method: "DELETE", body: data }));
            setMessage("Сервис удалён");
        } catch (removeError) {
            setError(removeError.message || "Не удалось удалить сервис");
        } finally {
            setBusyKey("");
        }
    };

    if (loading || !isAuth) {
        return (
            <>
                <Header />
                <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px", color: "#64748b" }}>Загрузка...</div>
            </>
        );
    }

    return (
        <>
            <Header />
            <main style={pageStyle}>
                <div style={topBarStyle}>
                    <div>
                        <h1 style={pageTitleStyle}>Шаблоны инструкций</h1>
                        <div style={pageLeadStyle}>
                            Загрузите .pptx-шаблон для пары «сервис + формат». На первом слайде шаблона должна быть картинка-плейсхолдер —
                            при генерации она заменяется картой задания, и шаблон превращается в PDF-инструкцию.
                        </div>
                    </div>
                    <MayakAdminBackLink />
                </div>

                {error ? <div style={{ ...noticeStyle, background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" }}>{error}</div> : null}
                {message ? <div style={{ ...noticeStyle, background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}>{message}</div> : null}

                <form onSubmit={handleUpload} style={panelStyle}>
                    <label style={fieldStyle}>
                        <span style={labelStyle}>Сервис</span>
                        <input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="Например, Suno" style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                        <span style={labelStyle}>Ссылка на сервис</span>
                        <input value={serviceUrl} onChange={(e) => setServiceUrl(e.target.value)} placeholder="https://suno.com/" style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                        <span style={labelStyle}>Формат</span>
                        <input value={formatName} onChange={(e) => setFormatName(e.target.value)} placeholder="Например, База песни" style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                        <span style={labelStyle}>Файл .pptx</span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            style={inputStyle}
                        />
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button type="submit" style={primaryButtonStyle} disabled={saving}>
                            {saving ? "..." : "Загрузить шаблон"}
                        </button>
                        <button type="button" onClick={handleAddService} disabled={saving} title="Добавить сервис в каталог без шаблона (имя + ссылка)" style={secondaryButtonStyle}>
                            Только сервис
                        </button>
                    </div>
                </form>
                <div style={{ ...pageLeadStyle, marginTop: 8 }}>
                    «Загрузить шаблон» — сервис + формат + .pptx. «Только сервис» — добавить сервис в каталог (имя + ссылка) без шаблона; такие сервисы используются для проверки названий в разделе «Контент».
                </div>

                <section style={listStyle}>
                    {services.length ? (
                        services.map((service) => (
                            <article key={service.serviceKey} style={serviceCardStyle}>
                                <div style={serviceHeaderStyle}>
                                    <h2 style={serviceTitleStyle}>{service.serviceName}</h2>
                                    {service.serviceUrl ? (
                                        <a href={service.serviceUrl} target="_blank" rel="noreferrer" style={serviceUrlStyle}>
                                            {service.serviceUrl}
                                        </a>
                                    ) : (
                                        <span style={serviceUrlEmptyStyle}>ссылка не указана</span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveService(service.serviceKey)}
                                        disabled={busyKey === service.serviceKey}
                                        style={{ ...dangerButtonStyle, marginLeft: "auto" }}>
                                        {busyKey === service.serviceKey ? "Удаляем..." : "Удалить сервис"}
                                    </button>
                                </div>
                                {service.formats.length ? (
                                    <div style={formatsListStyle}>
                                        {service.formats.map((format) => {
                                            const key = `${service.serviceKey}:${format.formatKey}`;
                                            return (
                                                <div key={format.formatKey} style={formatRowStyle}>
                                                    <span style={formatNameStyle}>{format.formatName}</span>
                                                    <span style={formatMetaStyle}>{format.templateFile}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFormat(service.serviceKey, format.formatKey)}
                                                        disabled={busyKey === key}
                                                        style={{ ...dangerButtonStyle, marginLeft: "auto" }}>
                                                        {busyKey === key ? "Удаляем..." : "Удалить"}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div style={emptyInlineStyle}>У сервиса пока нет форматов.</div>
                                )}
                            </article>
                        ))
                    ) : (
                        <div style={emptyStyle}>Шаблоны пока не загружены.</div>
                    )}
                </section>
            </main>
        </>
    );
}

const pageStyle = { maxWidth: 1180, margin: "0 auto", padding: "16px 20px 40px" };
const topBarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 };
const pageTitleStyle = { margin: 0, color: "#0f172a", fontSize: 24 };
const pageLeadStyle = { marginTop: 6, color: "#64748b", fontSize: 13, maxWidth: 760 };
const panelStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(140px, 1fr) minmax(160px, 1fr) minmax(150px, 1fr) minmax(180px, 1fr) auto",
    gap: 12,
    alignItems: "end",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#fff",
    padding: 16,
};
const fieldStyle = { display: "grid", gap: 6 };
const labelStyle = { color: "#64748b", fontSize: 12, fontWeight: 800 };
const inputStyle = { height: 38, border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 10px", fontSize: 13, background: "#fff", color: "#0f172a" };
const primaryButtonStyle = {
    width: "auto",
    flexShrink: 0,
    height: 38,
    border: "1px solid #0f172a",
    borderRadius: 8,
    background: "#0f172a",
    color: "#fff",
    padding: "0 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
};
const secondaryButtonStyle = {
    width: "auto",
    flexShrink: 0,
    height: 38,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#fff",
    color: "#334155",
    padding: "0 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
};
const noticeStyle = { marginBottom: 12, border: "1px solid", borderRadius: 10, padding: "10px 12px", fontSize: 14 };
const listStyle = { display: "grid", gap: 12, marginTop: 16 };
const serviceCardStyle = { border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", padding: 16 };
const serviceHeaderStyle = { display: "flex", alignItems: "center", gap: 10, marginBottom: 10, minWidth: 0 };
const serviceTitleStyle = { margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" };
const serviceUrlStyle = { fontSize: 12, color: "#2563eb", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 360 };
const serviceUrlEmptyStyle = { fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" };
const formatsListStyle = { display: "grid", gap: 8 };
const formatRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    background: "#f8fafc",
    padding: "8px 12px",
    minWidth: 0,
};
const formatNameStyle = { fontWeight: 600, color: "#0f172a", fontSize: 14, whiteSpace: "nowrap" };
const formatMetaStyle = { color: "#94a3b8", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const dangerButtonStyle = {
    width: "auto",
    flexShrink: 0,
    height: 30,
    border: "1px solid #fecaca",
    borderRadius: 7,
    background: "#fef2f2",
    color: "#b91c1c",
    padding: "0 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
};
const emptyInlineStyle = { color: "#94a3b8", fontSize: 13 };
const emptyStyle = { border: "1px dashed #cbd5e1", borderRadius: 12, background: "#fff", color: "#64748b", padding: 18 };
