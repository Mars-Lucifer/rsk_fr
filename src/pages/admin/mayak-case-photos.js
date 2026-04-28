"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Header from "@/components/layout/Header";
import MayakAdminBackLink from "@/components/mayak-admin/MayakAdminBackLink";
import { buildMayakAdminLoginUrl, getMayakAdminAuthStatus } from "@/lib/mayakAdminClient";

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

const defaultDirections = [
    { id: "education", title: "Образование", color: "#2f6df6" },
    { id: "state", title: "Государство и общество", color: "#44bd32" },
    { id: "business", title: "Бизнес", color: "#ff7a00" },
    { id: "special", title: "Специализированная колода", color: "#8260d9" },
];

export default function AdminMayakCasePhotosPage() {
    const router = useRouter();
    const fileInputRef = useRef(null);
    const [isAuth, setIsAuth] = useState(false);
    const [loading, setLoading] = useState(true);
    const [directions, setDirections] = useState(defaultDirections);
    const [selectedDirection, setSelectedDirection] = useState(defaultDirections[0].id);
    const [photos, setPhotos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [removingId, setRemovingId] = useState("");
    const [sorting, setSorting] = useState(false);
    const [draggedPhotoId, setDraggedPhotoId] = useState("");
    const [dragOverPhotoId, setDragOverPhotoId] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const selectedPhotos = useMemo(() => photos.filter((photo) => photo.directionId === selectedDirection).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)), [photos, selectedDirection]);
    const photoCountByDirection = useMemo(
        () =>
            photos.reduce((acc, photo) => {
                acc[photo.directionId] = (acc[photo.directionId] || 0) + 1;
                return acc;
            }, {}),
        [photos]
    );

    const loadPhotos = useCallback(async () => {
        const response = await fetch("/api/admin/mayak-case-photos");
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) {
            throw new Error(payload?.error || "Не удалось загрузить фотки кейсов");
        }
        setDirections(Array.isArray(payload.directions) && payload.directions.length ? payload.directions : defaultDirections);
        setPhotos(Array.isArray(payload.photos) ? payload.photos : []);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { authenticated } = await getMayakAdminAuthStatus();
                if (cancelled) return;
                if (!authenticated) {
                    router.replace(buildMayakAdminLoginUrl("/admin/mayak-case-photos"));
                    return;
                }
                setIsAuth(true);
                await loadPhotos();
            } catch (authError) {
                if (!cancelled) {
                    setError(authError instanceof Error ? authError.message : "Не удалось проверить доступ");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [loadPhotos, router]);

    const handleUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        event.target.value = "";
        setUploading(true);
        setError("");
        setMessage("");

        try {
            if (!file.type.startsWith("image/")) {
                throw new Error("Можно загрузить только изображение");
            }
            if (file.size > 12 * 1024 * 1024) {
                throw new Error("Фото слишком большое. Максимум 12 МБ");
            }

            const data = await fileToBase64(file);
            const response = await fetch("/api/admin/mayak-case-photos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ directionId: selectedDirection, filename: file.name, data }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || "Не удалось загрузить фото");
            }

            await loadPhotos();
            setMessage("Фото добавлено");
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить фото");
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = async (photo) => {
        setRemovingId(photo.id);
        setError("");
        setMessage("");
        try {
            const response = await fetch("/api/admin/mayak-case-photos", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: photo.id }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || "Не удалось удалить фото");
            }
            await loadPhotos();
            setMessage("Фото удалено");
        } catch (removeError) {
            setError(removeError instanceof Error ? removeError.message : "Не удалось удалить фото");
        } finally {
            setRemovingId("");
        }
    };

    const saveDraggedOrder = async (orderedPhotos) => {
        const orderedIds = new Set(orderedPhotos.map((photo) => photo.id));
        const updates = orderedPhotos.map((photo, index) => ({ id: photo.id, order: index + 1 }));
        setSorting(true);
        setError("");
        setMessage("");
        setPhotos((currentPhotos) => [
            ...currentPhotos.filter((photo) => !orderedIds.has(photo.id)),
            ...orderedPhotos.map((photo, index) => ({ ...photo, order: index + 1 })),
        ]);

        try {
            const response = await fetch("/api/admin/mayak-case-photos", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updates }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || "Не удалось сохранить порядок");
            }
            await loadPhotos();
            setMessage("Порядок сохранён");
        } catch (orderError) {
            setError(orderError instanceof Error ? orderError.message : "Не удалось сохранить порядок");
            await loadPhotos().catch(() => {});
        } finally {
            setSorting(false);
        }
    };

    const movePhotoBefore = (draggedId, targetId) => {
        if (!draggedId || !targetId || draggedId === targetId || sorting) return;
        const fromIndex = selectedPhotos.findIndex((photo) => photo.id === draggedId);
        const toIndex = selectedPhotos.findIndex((photo) => photo.id === targetId);
        if (fromIndex === -1 || toIndex === -1) return;

        const orderedPhotos = [...selectedPhotos];
        const [draggedPhoto] = orderedPhotos.splice(fromIndex, 1);
        orderedPhotos.splice(toIndex, 0, draggedPhoto);
        saveDraggedOrder(orderedPhotos);
    };

    const handlePhotoDragStart = (event, photo) => {
        setDraggedPhotoId(photo.id);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", photo.id);
    };

    const handlePhotoDrop = (event, targetPhoto) => {
        event.preventDefault();
        const draggedId = event.dataTransfer.getData("text/plain") || draggedPhotoId;
        setDragOverPhotoId("");
        movePhotoBefore(draggedId, targetPhoto.id);
    };

    const handlePhotoDragEnd = () => {
        setDraggedPhotoId("");
        setDragOverPhotoId("");
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
            <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 20px 40px" }}>
                <div style={topBarStyle}>
                    <div>
                        <h1 style={pageTitleStyle}>Фотки кейсов MAYAK</h1>
                        <div style={pageLeadStyle}>Выберите одно из 4 направлений и загрузите фотографии для блока кейсов на странице тренажёра.</div>
                    </div>
                    <MayakAdminBackLink />
                </div>

                {error ? <div style={{ ...noticeStyle, background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" }}>{error}</div> : null}
                {message ? <div style={{ ...noticeStyle, background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}>{message}</div> : null}

                <section style={panelStyle}>
                    <div style={directionsGridStyle}>
                        {directions.map((direction) => {
                            const isActive = selectedDirection === direction.id;
                            return (
                                <button
                                    key={direction.id}
                                    type="button"
                                    onClick={() => setSelectedDirection(direction.id)}
                                    style={{
                                        ...directionButtonStyle,
                                        borderColor: isActive ? direction.color : "#e2e8f0",
                                        boxShadow: isActive ? `0 0 0 3px ${direction.color}24` : "none",
                                    }}>
                                    <span style={{ ...directionDotStyle, background: direction.color }} />
                                    <span style={{ flex: 1 }}>{direction.title}</span>
                                    <span style={countBadgeStyle}>{photoCountByDirection[direction.id] || 0}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div style={uploadRowStyle}>
                        <div>
                            <div style={sectionTitleStyle}>Загрузка фото</div>
                            <div style={hintStyle}>Фото сохраняется в выбранное направление. Текст для кейса вводить не нужно.</div>
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
                        <button type="button" style={primaryButtonStyle} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                            {uploading ? "Загружаем..." : "Добавить фото"}
                        </button>
                    </div>
                </section>

                <section style={{ marginTop: 18 }}>
                    <div style={sectionHeaderStyle}>
                        <h2 style={{ margin: 0, fontSize: 18 }}>Фото направления</h2>
                        <span style={countBadgeStyle}>{selectedPhotos.length}</span>
                        {selectedPhotos.length > 1 ? <span style={dragHintStyle}>Перетащите фото, чтобы изменить порядок</span> : null}
                    </div>

                    {selectedPhotos.length ? (
                        <div style={photosGridStyle}>
                            {selectedPhotos.map((photo) => (
                                <article
                                    key={photo.id}
                                    draggable={!sorting}
                                    onDragStart={(event) => handlePhotoDragStart(event, photo)}
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                        event.dataTransfer.dropEffect = "move";
                                        setDragOverPhotoId(photo.id);
                                    }}
                                    onDragLeave={() => setDragOverPhotoId((currentId) => (currentId === photo.id ? "" : currentId))}
                                    onDrop={(event) => handlePhotoDrop(event, photo)}
                                    onDragEnd={handlePhotoDragEnd}
                                    style={{
                                        ...photoCardStyle,
                                        ...(draggedPhotoId === photo.id ? draggingCardStyle : null),
                                        ...(dragOverPhotoId === photo.id && draggedPhotoId !== photo.id ? dragOverCardStyle : null),
                                    }}>
                                    <div style={photoFrameStyle}>
                                        <Image src={photo.url} alt="" width={520} height={390} unoptimized style={photoImageStyle} />
                                    </div>
                                    <div style={photoMetaStyle}>
                                        <span style={photoNameStyle} title={photo.originalName || photo.filename}>
                                            {photo.originalName || photo.filename}
                                        </span>
                                        <div style={photoActionsStyle}>
                                            <span style={orderBadgeStyle}>№ {photo.order || 1}</span>
                                            <button type="button" style={dangerButtonStyle} onClick={() => handleRemove(photo)} disabled={removingId === photo.id || sorting}>
                                                {removingId === photo.id ? "..." : "Удалить"}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div style={emptyHintStyle}>В этом направлении пока нет фото.</div>
                    )}
                </section>
            </div>
        </>
    );
}

const topBarStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
};

const pageTitleStyle = {
    fontSize: 24,
    margin: 0,
    color: "#0f172a",
};

const pageLeadStyle = {
    fontSize: 13,
    color: "#64748b",
    marginTop: 6,
};

const panelStyle = {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#fff",
    padding: 16,
};

const directionsGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
};

const directionButtonStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#fff",
    padding: "12px 14px",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
};

const directionDotStyle = {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
};

const uploadRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 18,
    paddingTop: 16,
    borderTop: "1px solid #e2e8f0",
};

const sectionTitleStyle = {
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
};

const hintStyle = {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
};

const primaryButtonStyle = {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#0f766e",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
};

const dangerButtonStyle = {
    padding: "8px 12px",
    borderRadius: 8,
    border: "none",
    background: "#ef4444",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
};

const sectionHeaderStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
};

const countBadgeStyle = {
    minWidth: 24,
    height: 24,
    padding: "0 8px",
    borderRadius: 999,
    background: "#e2e8f0",
    color: "#334155",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
};

const dragHintStyle = {
    marginLeft: 6,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 600,
};

const photosGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
};

const photoCardStyle = {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#fff",
    overflow: "hidden",
    cursor: "grab",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease, transform 0.15s ease",
};

const draggingCardStyle = {
    opacity: 0.55,
    cursor: "grabbing",
    transform: "scale(0.99)",
};

const dragOverCardStyle = {
    borderColor: "#0f766e",
    boxShadow: "0 0 0 3px rgba(15, 118, 110, 0.16)",
};

const photoFrameStyle = {
    aspectRatio: "4 / 3",
    background: "#f1f5f9",
};

const photoImageStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
};

const photoMetaStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 12,
    fontSize: 12,
    color: "#475569",
};

const photoNameStyle = {
    display: "block",
    width: "100%",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 13,
    color: "#334155",
};

const photoActionsStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
};

const orderBadgeStyle = {
    minWidth: 48,
    borderRadius: 999,
    background: "#f1f5f9",
    color: "#0f172a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
};

const emptyHintStyle = {
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 16,
    color: "#64748b",
    background: "#f8fafc",
    fontSize: 13,
};

const noticeStyle = {
    border: "1px solid transparent",
    borderRadius: 10,
    padding: "10px 14px",
    marginBottom: 16,
    fontSize: 13,
};
