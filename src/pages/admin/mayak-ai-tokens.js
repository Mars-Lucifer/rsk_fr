"use client";

import { useCallback, useEffect, useState } from "react";

import Header from "@/components/layout/Header";
import MayakAdminBackLink from "@/components/mayak-admin/MayakAdminBackLink";
import { buildMayakAdminLoginUrl, getMayakAdminAuthStatus } from "@/lib/mayakAdminClient";

const initialSettings = {
    finalFileOpenrouterApiKey: "",
    finalFileOpenrouterApiKeyIsSet: false,
    finalFileModel: "google/gemini-3-flash-preview",
    sovaPrompt: "",
    analyticsPrompt: "",
};

async function parseJsonResponse(response, fallbackMessage) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
        throw new Error(payload.error || fallbackMessage);
    }
    return payload;
}

function StatusMark({ active, value }) {
    return <span className={active ? "status ok" : "status warn"}>{active ? value || "задан" : "не задан"}</span>;
}

function SecretRow({ label, statusActive, statusValue, value, placeholder, onChange, onSave, disabled, type = "password" }) {
    return (
        <div className="field-row">
            <label>
                <span>
                    {label}
                    <StatusMark active={statusActive} value={statusValue} />
                </span>
                <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
            </label>
            <button type="button" onClick={onSave} disabled={disabled}>
                Сохранить
            </button>
        </div>
    );
}

export default function AdminMayakAiTokens() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [settings, setSettings] = useState(initialSettings);
    const [drafts, setDrafts] = useState({
        finalFileOpenrouterApiKey: "",
        finalFileModel: "",
        sovaPrompt: "",
        analyticsPrompt: "",
    });

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

    const loadSettings = useCallback(async () => {
        const payload = await parseJsonResponse(await fetch("/api/admin/mayak-settings"), "Не удалось загрузить настройки");
        const nextSettings = { ...initialSettings, ...(payload.data || {}) };
        setSettings(nextSettings);
        setDrafts((current) => ({
            ...current,
            finalFileModel: nextSettings.finalFileModel || "",
            sovaPrompt: nextSettings.sovaPrompt || "",
            analyticsPrompt: nextSettings.analyticsPrompt || "",
        }));
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
        loadSettings().catch((loadError) => setError(loadError.message));
    }, [isAuthenticated, loadSettings]);

    useEffect(() => {
        if (!message && !error) return undefined;
        const timeoutId = window.setTimeout(() => {
            setMessage("");
            setError("");
        }, 6000);
        return () => window.clearTimeout(timeoutId);
    }, [message, error]);

    const updateDraft = (key, value) => {
        setDrafts((current) => ({ ...current, [key]: value }));
    };

    const resizeTextarea = useCallback((textarea) => {
        if (!textarea) return;
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight + 2}px`;
    }, []);

    useEffect(() => {
        const resizeAll = () => {
            document.querySelectorAll(".prompt-textarea").forEach((textarea) => resizeTextarea(textarea));
        };
        window.requestAnimationFrame(resizeAll);
        const timeoutId = window.setTimeout(resizeAll, 80);
        return () => window.clearTimeout(timeoutId);
    }, [drafts.sovaPrompt, drafts.analyticsPrompt, resizeTextarea]);

    const updatePromptDraft = (key, event) => {
        updateDraft(key, event.target.value);
        resizeTextarea(event.target);
    };

    const saveSettings = async (body, successMessage, clearKeys = []) => {
        try {
            setSaving(true);
            setError("");
            await parseJsonResponse(
                await fetch("/api/admin/mayak-settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                }),
                "Не удалось сохранить настройки"
            );
            setMessage(successMessage);
            if (clearKeys.length > 0) {
                setDrafts((current) => clearKeys.reduce((next, key) => ({ ...next, [key]: "" }), current));
            }
            await loadSettings();
        } catch (saveError) {
            setError(saveError.message || "Не удалось сохранить настройки");
        } finally {
            setSaving(false);
        }
    };

    const saveTextField = (field, successMessage, required = false) => {
        const value = String(drafts[field] || "").trim();
        if (required && !value) {
            setError("Заполните поле перед сохранением");
            return;
        }
        saveSettings({ [field]: value }, successMessage, field.includes("Key") ? [field] : []);
    };

    if (!isAuthenticated || loading) {
        return (
            <>
                <Header />
                <main className="ai-page">
                    <div className="empty">Проверка доступа...</div>
                </main>
                <style jsx global>{pageStyles}</style>
            </>
        );
    }

    return (
        <>
            <Header />
            <main className="ai-page">
                <div className="topbar">
                    <div>
                        <p>Админ МАЯК</p>
                        <h1>AI токены</h1>
                    </div>
                    <MayakAdminBackLink />
                </div>

                {message ? <div className="notice success">{message}</div> : null}
                {error ? <div className="notice error">{error}</div> : null}

                <section className="grid">
                    <article className="panel">
                        <h2>OpenRouter</h2>
                        <p className="panel-note">
                            Единственный провайдер нейросети: оценка промптов СОВА (проверка полей МАЯК-ОКО) и итоговая PDF-аналитика. Один и тот же API-ключ используется для обеих задач. Модель ниже относится к генерации аналитики.
                        </p>
                        <SecretRow
                            label="OpenRouter API Key"
                            statusActive={settings.finalFileOpenrouterApiKeyIsSet}
                            statusValue={settings.finalFileOpenrouterApiKey}
                            value={drafts.finalFileOpenrouterApiKey}
                            placeholder="sk-or-v1..."
                            onChange={(value) => updateDraft("finalFileOpenrouterApiKey", value)}
                            onSave={() => saveTextField("finalFileOpenrouterApiKey", "OpenRouter API Key сохранен", true)}
                            disabled={saving}
                        />
                        <SecretRow
                            label="Модель OpenRouter (итоговая аналитика)"
                            statusActive={Boolean(settings.finalFileModel)}
                            statusValue={settings.finalFileModel}
                            value={drafts.finalFileModel}
                            placeholder="google/gemini-3-flash-preview"
                            onChange={(value) => updateDraft("finalFileModel", value)}
                            onSave={() => saveTextField("finalFileModel", "Модель OpenRouter сохранена", true)}
                            disabled={saving}
                            type="text"
                        />
                    </article>
                </section>

                <section className="grid">
                    <article className="panel">
                        <h2>Промпт СОВА</h2>
                        <p className="panel-note">Это текущий системный промпт для проверки полей СОВА.</p>
                        <textarea
                            className="prompt-textarea"
                            value={drafts.sovaPrompt}
                            onChange={(event) => updatePromptDraft("sovaPrompt", event)}
                            placeholder="Системный промпт для оценки полей СОВА"
                        />
                        <button type="button" className="mt" onClick={() => saveSettings({ sovaPrompt: drafts.sovaPrompt }, "Промпт СОВА сохранен")} disabled={saving}>
                            Сохранить промпт
                        </button>
                    </article>
                    <article className="panel">
                        <h2>Инструкция итоговой аналитики</h2>
                        <p className="panel-note">
                            Это управляемая часть: она добавляется перед динамическим промптом, который собирается из данных участника и прохождения.
                        </p>
                        <textarea
                            className="prompt-textarea"
                            value={drafts.analyticsPrompt}
                            onChange={(event) => updatePromptDraft("analyticsPrompt", event)}
                            placeholder="Дополнительные инструкции для итоговой аналитики"
                        />
                        <button
                            type="button"
                            className="mt"
                            onClick={() => saveSettings({ analyticsPrompt: drafts.analyticsPrompt }, "Промпт итоговой аналитики сохранен")}
                            disabled={saving}
                        >
                            Сохранить промпт
                        </button>
                    </article>
                </section>
            </main>
            <style jsx global>{pageStyles}</style>
        </>
    );
}

const pageStyles = `
    .ai-page {
        width: 100%;
        max-width: none;
        margin: 0;
        padding: 12px 16px 34px;
        color: #0f172a;
        background: #f8fafc;
    }

    .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
    }

    .panel-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
    }

    .panel-title-row {
        display: flex;
        align-items: baseline;
        gap: 10px;
        min-width: 0;
    }

    .panel-title-row span {
        color: #64748b;
        font-size: 13px;
        font-weight: 800;
        white-space: nowrap;
    }

    .topbar p {
        margin: 0 0 2px;
        color: #64748b;
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
    }

    .topbar h1,
    .panel h2 {
        margin: 0;
        color: #020617;
    }

    .topbar h1 {
        font-size: clamp(28px, 3vw, 42px);
    }

    .grid {
        display: grid;
        gap: 12px;
        margin-top: 12px;
    }

    .grid.two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .panel {
        border: 1px solid #dbe3ea;
        border-radius: 8px;
        background: #fff;
        padding: 14px;
    }

    .panel h2 {
        font-size: 19px;
    }

    .field-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: end;
        margin-top: 12px;
    }

    .field-row.split {
        grid-template-columns: minmax(150px, 1fr) minmax(180px, 1.2fr) auto;
    }

    label {
        display: grid;
        gap: 5px;
        min-width: 0;
    }

    label span {
        color: #334155;
        font-size: 13px;
        font-weight: 800;
    }

    input,
    select,
    textarea {
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

    textarea {
        height: auto;
        min-height: 260px;
        margin-top: 12px;
        overflow: hidden !important;
        overflow-y: hidden !important;
        resize: none;
        line-height: 1.45;
        scrollbar-width: none;
    }

    textarea::-webkit-scrollbar {
        display: none;
    }

    input:focus,
    select:focus,
    textarea:focus {
        border-color: #0f766e;
        box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
    }

    button {
        min-height: 38px;
        border: 1px solid #0f766e;
        border-radius: 8px;
        background: #0f766e;
        color: #fff;
        font-size: 14px;
        font-weight: 800;
        padding: 8px 12px;
        cursor: pointer;
        white-space: nowrap;
    }

    button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
    }

    button.ghost {
        border-color: #cbd5e1;
        background: #fff;
        color: #0f172a;
    }

    button.refresh,
    .icon.refresh-icon {
        border-color: #99f6e4;
        background: #ccfbf1;
        color: #0f766e;
    }

    .import-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 38px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #fff;
        color: #0f172a;
        font-size: 14px;
        font-weight: 800;
        padding: 8px 12px;
        cursor: pointer;
        white-space: nowrap;
    }

    .import-button.disabled {
        cursor: not-allowed;
        opacity: 0.55;
    }

    .import-button input {
        display: none;
    }

    .icon.danger {
        border-color: #fecaca;
        background: #fef2f2;
        color: #b91c1c;
    }

    .icon {
        width: 36px;
        min-height: 32px;
        border-color: #cbd5e1;
        background: #fff;
        color: #0f172a;
        padding: 4px;
        font-size: 18px;
        line-height: 1;
    }

    .icon.ok {
        border-color: #bbf7d0;
        background: #f0fdf4;
        color: #15803d;
    }

    .icon.edit {
        border-color: transparent;
        background: transparent;
        color: #0f766e;
    }

    .icon.edit:hover {
        background: #ecfdf5;
    }

    .token-list {
        display: grid;
        gap: 8px;
        margin-top: 12px;
    }

    .token-summary {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-top: 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #f8fafc;
        padding: 12px;
        color: #475569;
        font-weight: 800;
    }

    .token-summary strong {
        color: #020617;
        font-size: 22px;
    }

    .token-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #f8fafc;
        padding: 9px 10px;
    }

    .token-actions {
        display: flex;
        flex-flow: row nowrap;
        gap: 6px;
        align-items: center;
        justify-content: flex-end;
        min-width: 162px;
    }

    .token-info {
        display: grid;
        grid-template-columns: 76px minmax(220px, 0.95fr) minmax(180px, 0.85fr) minmax(260px, 1.25fr);
        gap: 10px;
        align-items: center;
        min-width: 0;
    }

    .token-info-edit {
        grid-template-columns: 76px minmax(220px, 0.95fr) minmax(260px, 1.15fr) minmax(260px, 1fr);
    }

    .account-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        min-height: 30px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #fff;
        color: #0f766e;
        font-size: 13px;
        font-weight: 900;
        letter-spacing: 0;
    }

    .token-info strong {
        display: block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    code {
        display: block;
        max-width: 100%;
        margin-top: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #334155;
        font-size: 13px;
    }

    .status,
    .expiry {
        display: inline-block;
        max-width: min(340px, 60vw);
        overflow: hidden;
        text-overflow: ellipsis;
        vertical-align: bottom;
        white-space: nowrap;
        font-size: 12px;
        font-weight: 800;
    }

    .status {
        margin-left: 6px;
        font-size: 11px;
    }

    .expiry {
        margin-top: 0;
    }

    .status.ok,
    .expiry.active {
        color: #15803d;
    }

    .expiry.expiring,
    .expiry.unknown {
        color: #b45309;
    }

    .status.warn,
    .expiry.expired {
        color: #dc2626;
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
        font-weight: 700;
        box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
    }

    .notice.success {
        border: 1px solid #bbf7d0;
        background: #f0fdf4;
        color: #166534;
    }

    .notice.error {
        border: 1px solid #fecaca;
        background: #fef2f2;
        color: #991b1b;
    }

    .empty {
        border: 1px dashed #cbd5e1;
        border-radius: 8px;
        padding: 14px;
        color: #64748b;
    }

    .panel-note {
        margin: 8px 0 0;
        color: #64748b;
        font-size: 13px;
        line-height: 1.45;
    }

    .mt {
        margin-top: 10px;
    }

    @media (max-width: 1100px) {
        .grid.two,
        .field-row,
        .field-row.split {
            grid-template-columns: 1fr;
        }

        .token-info {
            grid-template-columns: 1fr;
            gap: 4px;
        }

        .topbar {
            align-items: flex-start;
            flex-direction: column;
        }
    }
`;
