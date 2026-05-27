"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

import Header from "@/components/layout/Header";
import MayakAdminBackLink from "@/components/mayak-admin/MayakAdminBackLink";
import { buildMayakAdminLoginUrl, getMayakAdminAuthStatus } from "@/lib/mayakAdminClient";

function formatFileSize(value) {
    const size = Number(value) || 0;
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} МБ`;
    if (size >= 1024) return `${Math.round(size / 1024)} КБ`;
    return `${size} Б`;
}

export default function AdminMayakTokenMaterialsPage() {
    const router = useRouter();
    const fileInputRef = useRef(null);
    const [isAuth, setIsAuth] = useState(false);
    const [loading, setLoading] = useState(true);
    const [materials, setMaterials] = useState([]);
    const [title, setTitle] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [removingId, setRemovingId] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const loadMaterials = useCallback(async () => {
        const response = await fetch("/api/admin/mayak-token-materials");
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) {
            throw new Error(payload?.error || "Не удалось загрузить материалы");
        }
        setMaterials(Array.isArray(payload.data) ? payload.data : []);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { authenticated } = await getMayakAdminAuthStatus();
                if (cancelled) return;
                if (!authenticated) {
                    router.replace(buildMayakAdminLoginUrl("/admin/mayak-token-materials"));
                    return;
                }
                setIsAuth(true);
                await loadMaterials();
            } catch (authError) {
                if (!cancelled) setError(authError.message || "Не удалось проверить доступ");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [loadMaterials, router]);

    const handleUpload = async (event) => {
        event.preventDefault();
        if (!selectedFile) {
            setError("Выберите PDF или PPTX файл");
            return;
        }
        setSaving(true);
        setError("");
        setMessage("");

        try {
            const data = new FormData();
            data.append("file", selectedFile);
            data.append("title", title.trim());
            const response = await fetch("/api/admin/mayak-token-materials", {
                method: "POST",
                body: data,
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || "Не удалось загрузить материал");
            }
            setTitle("");
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            await loadMaterials();
            setMessage("Материал добавлен");
        } catch (uploadError) {
            setError(uploadError.message || "Не удалось загрузить материал");
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (materialId) => {
        setRemovingId(materialId);
        setError("");
        setMessage("");
        try {
            const data = new FormData();
            data.append("id", materialId);
            const response = await fetch("/api/admin/mayak-token-materials", {
                method: "DELETE",
                body: data,
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || "Не удалось удалить материал");
            }
            await loadMaterials();
            setMessage("Материал удален");
        } catch (removeError) {
            setError(removeError.message || "Не удалось удалить материал");
        } finally {
            setRemovingId("");
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
                        <h1 style={pageTitleStyle}>Материалы для токенов</h1>
                        <div style={pageLeadStyle}>Загрузите PDF или PPTX. Эти файлы появятся во внешних ссылках токенов для скачивания участниками.</div>
                    </div>
                    <MayakAdminBackLink />
                </div>

                {error ? <div style={{ ...noticeStyle, background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" }}>{error}</div> : null}
                {message ? <div style={{ ...noticeStyle, background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}>{message}</div> : null}

                <form onSubmit={handleUpload} style={panelStyle}>
                    <label style={fieldStyle}>
                        <span style={labelStyle}>Название</span>
                        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, инструкция для участников" style={inputStyle} />
                    </label>
                    <label style={fieldStyle}>
                        <span style={labelStyle}>Файл PDF или PPTX</span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                            style={inputStyle}
                        />
                    </label>
                    <button type="submit" style={primaryButtonStyle} disabled={saving}>
                        {saving ? "Загружаем..." : "Добавить материал"}
                    </button>
                </form>

                <section style={listStyle}>
                    {materials.length ? (
                        materials.map((material) => (
                            <article key={material.id} style={materialCardStyle}>
                                <div>
                                    <h2 style={materialTitleStyle}>{material.title || material.originalName || "Материал"}</h2>
                                    <div style={materialMetaStyle}>
                                        {(material.extension || "").replace(".", "").toUpperCase()} · {formatFileSize(material.size)}
                                    </div>
                                </div>
                                <div style={actionsStyle}>
                                    <a href={material.url} target="_blank" rel="noreferrer" style={secondaryLinkStyle}>
                                        Открыть
                                    </a>
                                    <button type="button" onClick={() => handleRemove(material.id)} disabled={removingId === material.id} style={dangerButtonStyle}>
                                        {removingId === material.id ? "Удаляем..." : "Удалить"}
                                    </button>
                                </div>
                            </article>
                        ))
                    ) : (
                        <div style={emptyStyle}>Материалы пока не загружены.</div>
                    )}
                </section>
            </main>
        </>
    );
}

const pageStyle = {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "16px 20px 40px",
};

const topBarStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
};

const pageTitleStyle = {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
};

const pageLeadStyle = {
    marginTop: 6,
    color: "#64748b",
    fontSize: 13,
};

const panelStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1fr) minmax(260px, 1fr) auto",
    gap: 12,
    alignItems: "end",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#fff",
    padding: 16,
};

const fieldStyle = {
    display: "grid",
    gap: 6,
};

const labelStyle = {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
};

const inputStyle = {
    minHeight: 42,
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "8px 12px",
    background: "#fff",
    color: "#0f172a",
};

const primaryButtonStyle = {
    minHeight: 42,
    border: "1px solid #0f172a",
    borderRadius: 10,
    background: "#0f172a",
    color: "#fff",
    padding: "0 16px",
    fontWeight: 800,
    cursor: "pointer",
};

const noticeStyle = {
    marginBottom: 12,
    border: "1px solid",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
};

const listStyle = {
    display: "grid",
    gap: 10,
    marginTop: 16,
};

const materialCardStyle = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#fff",
    padding: 16,
};

const materialTitleStyle = {
    margin: 0,
    fontSize: 17,
};

const materialMetaStyle = {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
};

const actionsStyle = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
};

const secondaryLinkStyle = {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 38,
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    background: "#fff",
    color: "#0f172a",
    padding: "0 12px",
    fontWeight: 700,
    textDecoration: "none",
};

const dangerButtonStyle = {
    minHeight: 38,
    border: "1px solid #fecaca",
    borderRadius: 10,
    background: "#fef2f2",
    color: "#b91c1c",
    padding: "0 12px",
    fontWeight: 700,
    cursor: "pointer",
};

const emptyStyle = {
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    background: "#fff",
    color: "#64748b",
    padding: 18,
};

