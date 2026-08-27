import { useEffect, useMemo, useRef, useState } from "react";

import Button from "@/components/ui/Button";
import CloseIcon from "@/assets/general/close.svg";
import { formatDay2TaskNumber } from "@/lib/mayakDay2Mode";

const REJECT_REASON_OPTIONS = [
    { value: "mismatch", label: "Результат не соответствует задаче", comment: "Результат не соответствует задаче" },
    { value: "missing_file", label: "Нет файла", comment: "Нет файла" },
    { value: "wrong_format", label: "Другой формат", comment: "Другой формат" },
    { value: "other", label: "Другое (указать)", comment: "" },
];
const MAX_SESSION_SUBMISSION_TEXT_LENGTH = 10000;

function formatRemaining(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Обратный отсчёт по АБСОЛЮТНОЙ серверной метке, а не по локально
// накопленному счётчику: вкладку можно свернуть, усыпить ноутбук и вернуться —
// остаток всё равно останется верным. Тем же хуком идёт такт второго дня,
// поэтому он экспортируется.
export function useRemainingSeconds(expiresAt, fallbackSeconds = 0) {
    const [remainingSeconds, setRemainingSeconds] = useState(() => {
        if (!expiresAt) return Math.max(0, Number(fallbackSeconds) || 0);
        return Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
    });

    useEffect(() => {
        const compute = () => {
            if (!expiresAt) {
                setRemainingSeconds(Math.max(0, Number(fallbackSeconds) || 0));
                return;
            }
            setRemainingSeconds(Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000)));
        };

        compute();
        const intervalId = window.setInterval(compute, 1000);
        return () => window.clearInterval(intervalId);
    }, [expiresAt, fallbackSeconds]);

    return remainingSeconds;
}

function buildProgress(remainingSeconds, totalSeconds) {
    const safeTotal = Math.max(1, Number(totalSeconds) || 0, Number(remainingSeconds) || 0);
    return Math.max(0, Math.min(100, (Math.max(0, Number(remainingSeconds) || 0) / safeTotal) * 100));
}

function isOfficeConvertibleFile(file) {
    const name = String(file?.name || file?.originalName || "").toLowerCase();
    return name.endsWith(".doc") || name.endsWith(".docx") || name.endsWith(".ppt") || name.endsWith(".pptx");
}

function triggerDownload(url) {
    if (!url || typeof document === "undefined") return;
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function ReviewFilePreview({ file, title, submissionText }) {
    if (!file?.fileUrl) {
        if (submissionText) {
            return (
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{"\u0422\u0435\u043a\u0441\u0442\u043e\u0432\u044b\u0439 \u043e\u0442\u0432\u0435\u0442"}</div>
                    <div className="text-sm whitespace-pre-line text-slate-800">{submissionText}</div>
                </div>
            );
        }
        return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">{"\u0424\u0430\u0439\u043b \u043d\u0435 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d."}</div>;
    }

    if (file.previewStatus === "pending" || file.previewStatus === "processing") {
        return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">{"\u041f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0444\u0430\u0439\u043b\u0430 \u0433\u043e\u0442\u043e\u0432\u0438\u0442\u0441\u044f. \u041f\u043e\u043a\u0430 \u043c\u043e\u0436\u043d\u043e \u0441\u043a\u0430\u0447\u0430\u0442\u044c \u0438\u0441\u0445\u043e\u0434\u043d\u044b\u0439 \u0444\u0430\u0439\u043b."}</div>;
    }

    if (file.previewStatus === "failed") {
        return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">{file.previewError || "\u0414\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u0444\u0430\u0439\u043b\u0430 \u043d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u0438\u0442\u044c \u0432\u0441\u0442\u0440\u043e\u0435\u043d\u043d\u044b\u0439 \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440. \u0424\u0430\u0439\u043b \u043c\u043e\u0436\u043d\u043e \u0441\u043a\u0430\u0447\u0430\u0442\u044c."}</div>;
    }

    if (!file.previewKind) {
        return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">{"\u0414\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u0442\u0438\u043f\u0430 \u0444\u0430\u0439\u043b\u0430 \u0432\u0441\u0442\u0440\u043e\u0435\u043d\u043d\u044b\u0439 \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u043f\u043e\u043a\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d. \u0424\u0430\u0439\u043b \u043c\u043e\u0436\u043d\u043e \u0441\u043a\u0430\u0447\u0430\u0442\u044c."}</div>;
    }

    if (file.previewKind === "image") {
        return <img src={file.fileUrl} alt={title} className="max-h-[70vh] w-full rounded-lg border border-slate-200 object-contain bg-white" />;
    }

    if (file.previewKind === "audio") {
        return (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
                <audio controls className="w-full">
                    <source src={file.fileUrl} type={file.mimeType || "audio/mpeg"} />
                </audio>
            </div>
        );
    }

    if (file.previewKind === "video") {
        return (
            <div className="rounded-lg border border-slate-200 bg-black p-2">
                <video controls className="max-h-[70vh] w-full rounded-md bg-black">
                    <source src={file.fileUrl} type={file.mimeType || "video/mp4"} />
                </video>
            </div>
        );
    }

    return <iframe title={title} src={file.fileUrl} className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white" />;
}

export function SessionTaskReviewPopup({ taskData, elapsedTime, rejectedComment, uploadLoading, uploadError, canUseJoker = false, jokerBalance = 0, onUseJoker, onClose, onSubmit }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [isDragActive, setIsDragActive] = useState(false);
    const [submissionText, setSubmissionText] = useState("");
    const fileInputRef = useRef(null);
    const isOfficeFile = isOfficeConvertibleFile(selectedFile);

    if (!taskData) return null;

    const handleSelectFile = (file) => {
        if (!file) return;
        setSelectedFile(file);
        setIsDragActive(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
                    <div>
                        <h3 className="text-xl font-bold">Загрузить материал по заданию №{formatDay2TaskNumber(taskData.number)}</h3>
                        <p className="mt-1 text-sm text-slate-500">Время выполнения: {elapsedTime}</p>
                    </div>
                    <Button icon className="!bg-transparent !text-black hover:!bg-black/5" onClick={onClose}>
                        <CloseIcon />
                    </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                {rejectedComment ? (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="mb-1 text-sm font-semibold text-red-700">Комментарий инспектора</div>
                        <div className="text-sm text-red-700">{rejectedComment}</div>
                    </div>
                ) : null}

                <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                    {taskData.title ? (
                        <div>
                            <div className="text-sm font-semibold text-slate-800">Название задания</div>
                            <div className="text-sm text-slate-700">{taskData.title}</div>
                        </div>
                    ) : null}
                    {taskData.contentType ? (
                        <div>
                            <div className="text-sm font-semibold text-slate-800">Тип контента</div>
                            <div className="text-sm text-slate-700">{taskData.contentType}</div>
                        </div>
                    ) : null}
                    <div>
                        <div className="text-sm font-semibold text-slate-800">Описание</div>
                        <div className="text-sm whitespace-pre-line text-slate-700">{taskData.description}</div>
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-slate-800">Задача</div>
                        <div className="text-sm whitespace-pre-line text-slate-700">{taskData.task}</div>
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                    <input ref={fileInputRef} type="file" onChange={(event) => handleSelectFile(event.target.files?.[0] || null)} className="hidden" />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(event) => {
                            event.preventDefault();
                            setIsDragActive(true);
                        }}
                        onDragLeave={(event) => {
                            event.preventDefault();
                            setIsDragActive(false);
                        }}
                        onDrop={(event) => {
                            event.preventDefault();
                            handleSelectFile(event.dataTransfer.files?.[0] || null);
                        }}
                        className={`!w-full appearance-none flex min-h-[132px] w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-5 text-center transition !text-slate-800 ${isDragActive ? "border-violet-500 !bg-violet-50" : "border-slate-300 !bg-slate-50 hover:!bg-slate-100"}`}>
                        <div className="text-sm font-semibold text-slate-900">Перетащите сюда файл или откройте вручную</div>
                        {selectedFile ? <div className="mt-3 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-900 shadow-sm">{selectedFile.name}</div> : null}
                    </button>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <label className="text-sm font-semibold text-slate-800">{"\u0422\u0435\u043a\u0441\u0442\u043e\u0432\u044b\u0439 \u043e\u0442\u0432\u0435\u0442"}</label>
                            <span className="text-xs text-slate-500">{submissionText.length}/{MAX_SESSION_SUBMISSION_TEXT_LENGTH}</span>
                        </div>
                        <textarea
                            value={submissionText}
                            onChange={(event) => setSubmissionText(String(event.target.value || "").slice(0, MAX_SESSION_SUBMISSION_TEXT_LENGTH))}
                            className="min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                            placeholder={"\u041c\u043e\u0436\u043d\u043e \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0439 \u0442\u0435\u043a\u0441\u0442\u043e\u0432\u044b\u0439 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u0434\u0430\u0436\u0435 \u0431\u0435\u0437 \u0444\u0430\u0439\u043b\u0430."}
                        />
                    </div>
                    <div className="text-xs text-slate-500">{"\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u044b PDF, DOC/DOCX, PPT/PPTX, \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f, \u0430\u0443\u0434\u0438\u043e \u0438 \u0432\u0438\u0434\u0435\u043e. \u041c\u0430\u043a\u0441\u0438\u043c\u0443\u043c 30 \u041c\u0411."}</div>
                    {uploadError ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{uploadError}</div> : null}
                </div>

                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
                    {canUseJoker ? (
                        <Button
                            inverted
                            onClick={onUseJoker}
                            disabled={uploadLoading}
                            className="mr-auto !border-rose-300 !text-rose-700 !bg-rose-50 hover:!bg-rose-100"
                            title="Мгновенно засчитать задание без инспектора, потратив звезду-джокер">
                            ⭐ Использовать звезду-джокер ({jokerBalance})
                        </Button>
                    ) : null}
                    <Button inverted onClick={onClose} disabled={uploadLoading}>
                        Позже
                    </Button>
                    <Button onClick={() => onSubmit(selectedFile, submissionText)} disabled={(!selectedFile && !submissionText.trim()) || uploadLoading}>
                        {uploadLoading ? "Загрузка..." : rejectedComment ? "Исправить и отправить" : "Отправить инспектору"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function InspectorQueueCard({ review, onOpen }) {
    const remainingSeconds = useRemainingSeconds(review?.expiresAt, review?.remainingSeconds || 0);
    const progress = buildProgress(remainingSeconds, review?.durationSeconds || review?.remainingSeconds || 120);

    return (
        <div className="rounded-2xl border border-slate-200 bg-white px-2.5 py-2 shadow-lg">
            <div className="flex items-center justify-between gap-2">
                <div className="rounded-full bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-800">{formatRemaining(remainingSeconds)}</div>
                <button
                    type="button"
                    onClick={() => onOpen(review)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition hover:border-slate-300"
                    style={{ background: "#ffffff", backgroundColor: "#ffffff", color: "#334155", WebkitAppearance: "none", appearance: "none", boxShadow: "none", backgroundImage: "none" }}>
                    Открыть
                </button>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full transition-[width] duration-1000 ${remainingSeconds > 60 ? "bg-emerald-500" : remainingSeconds > 20 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${progress}%` }} />
            </div>
        </div>
    );
}

export function InspectorReviewQueue({ reviews, onOpen }) {
    if (!Array.isArray(reviews) || reviews.length === 0) return null;

    const orderedReviews = reviews
        .slice()
        .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));

    return (
        <div className="fixed right-6 top-3 z-40 flex w-[min(220px,calc(100vw-1.5rem))] flex-col gap-2">
            {orderedReviews.map((review) => (
                <InspectorQueueCard key={review.id} review={review} onOpen={onOpen} />
            ))}
        </div>
    );
}

function RejectReasonPicker({ onRejectPreset, onCancelOther, loading }) {
    return (
        <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-800">Причина отклонения</div>
            <div className="grid gap-2">
                {REJECT_REASON_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        disabled={loading}
                        onClick={() => {
                            if (option.value === "other") {
                                onCancelOther(true);
                                return;
                            }
                            onRejectPreset(option.comment);
                        }}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm transition hover:border-slate-300"
                        style={{ background: "#ffffff", backgroundColor: "#ffffff", color: "#334155", WebkitAppearance: "none", appearance: "none", boxShadow: "none", backgroundImage: "none" }}>
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function InspectorReviewModal({ review, loading, error, onApprove, onReject, onClose }) {
    const title = useMemo(
        () => `Проверка задания №${formatDay2TaskNumber(review?.taskNumber || "")}`,
        [review?.taskNumber]
    );
    const remainingSeconds = useRemainingSeconds(review?.expiresAt, review?.remainingSeconds || 0);
    const progress = buildProgress(remainingSeconds, review?.durationSeconds || review?.remainingSeconds || 120);
    const [showRejectOptions, setShowRejectOptions] = useState(false);
    const [showCustomReject, setShowCustomReject] = useState(false);
    const [customRejectComment, setCustomRejectComment] = useState("");

    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            setShowRejectOptions(false);
            setShowCustomReject(false);
            setCustomRejectComment("");
        });

        return () => {
            cancelAnimationFrame(frameId);
        };
    }, [review?.id]);

    if (!review) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="flex h-[min(88vh,860px)] w-full max-w-[1400px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex min-w-0 flex-1 flex-col border-r border-slate-200">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <h4 className="text-lg font-semibold">{title}</h4>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 self-start">
                                {review.file?.downloadUrl ? (
                                    <button
                                        type="button"
                                        onClick={() => triggerDownload(review.file.downloadUrl)}
                                        className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 px-4 text-xs font-semibold whitespace-nowrap transition hover:border-slate-300"
                                        style={{
                                            width: "auto",
                                            minWidth: "128px",
                                            background: "#ffffff",
                                            backgroundColor: "#ffffff",
                                            color: "#334155",
                                            WebkitAppearance: "none",
                                            appearance: "none",
                                            boxShadow: "none",
                                            backgroundImage: "none",
                                            flex: "0 0 auto",
                                        }}>
                                        {"\u0421\u043a\u0430\u0447\u0430\u0442\u044c \u0444\u0430\u0439\u043b"}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                            <div className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{formatRemaining(remainingSeconds)}</div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div className={`h-full rounded-full transition-[width] duration-1000 ${remainingSeconds > 60 ? "bg-emerald-500" : remainingSeconds > 20 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto p-5">
                        <ReviewFilePreview file={review.file} title={title} submissionText={review.submissionText} />
                    </div>
                </div>

                <div className="flex w-[460px] shrink-0 flex-col bg-slate-50">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold whitespace-nowrap text-slate-900">{"\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0437\u0430\u0434\u0430\u043d\u0438\u044f"}</div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 transition hover:border-slate-300"
                                style={{
                                    width: "28px",
                                    minWidth: "28px",
                                    maxWidth: "28px",
                                    height: "28px",
                                    background: "#ffffff",
                                    backgroundColor: "#ffffff",
                                    color: "#0f172a",
                                    WebkitAppearance: "none",
                                    appearance: "none",
                                    boxShadow: "none",
                                    backgroundImage: "none",
                                    flex: "0 0 auto",
                                }}>
                                <span className="text-lg leading-none font-medium">×</span>
                            </button>
                        </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto p-5">
                        <div className="grid gap-3 rounded-xl bg-white p-4 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{"\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0437\u0430\u0434\u0430\u043d\u0438\u044f"}</div>
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{"\u0422\u0438\u043f \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0430"}</div>
                                <div className="text-sm text-slate-800">{review.contentType || "-"}</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{"\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435"}</div>
                                <div className="text-sm whitespace-pre-line text-slate-800">{review.description || "-"}</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{"\u0417\u0430\u0434\u0430\u0447\u0430"}</div>
                                <div className="text-sm whitespace-pre-line text-slate-800">{review.taskText || "-"}</div>
                            </div>
                            {review.submissionText ? (
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{"\u0422\u0435\u043a\u0441\u0442\u043e\u0432\u044b\u0439 \u043e\u0442\u0432\u0435\u0442"}</div>
                                    <div className="text-sm whitespace-pre-line text-slate-800">{review.submissionText}</div>
                                </div>
                            ) : null}
                            <div className="flex gap-2 pt-1">
                                <Button onClick={onApprove} disabled={loading} className="!flex-1 !bg-emerald-600 hover:!bg-emerald-700 !text-white">
                                    {loading ? "..." : "\u041f\u0440\u0438\u043d\u044f\u0442\u044c"}
                                </Button>
                                <Button
                                    onClick={() => setShowRejectOptions((prev) => !prev)}
                                    disabled={loading}
                                    className="!flex-1 !bg-red-600 hover:!bg-red-700 !text-white">
                                    {"\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c"}
                                </Button>
                            </div>
                        </div>

                        {showRejectOptions ? (
                            <div className="mt-4 space-y-3">
                                <RejectReasonPicker
                                    loading={loading}
                                    onRejectPreset={(comment) => onReject(comment)}
                                    onCancelOther={() => setShowCustomReject(true)}
                                />
                                {showCustomReject ? (
                                    <>
                                        <textarea
                                            value={customRejectComment}
                                            onChange={(event) => setCustomRejectComment(event.target.value)}
                                            className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                                            placeholder="Укажите, что нужно исправить."
                                        />
                                        <div className="flex justify-end">
                                            <Button
                                                onClick={() => onReject(customRejectComment)}
                                                disabled={loading || !String(customRejectComment || "").trim()}
                                                className="!bg-red-600 hover:!bg-red-700 !text-white">
                                                {loading ? "..." : "Отправить"}
                                            </Button>
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        ) : null}

                        {error ? <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function SessionReviewStatusBanner({ taskNumber, status, comment, expiresAt, remainingSeconds, durationSeconds }) {
    const liveRemainingSeconds = useRemainingSeconds(expiresAt, remainingSeconds || 0);
    const progress = buildProgress(liveRemainingSeconds, durationSeconds || remainingSeconds || 0);

    if (!status) return null;

    if (status === "rejected") {
        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="font-semibold">{"\u0422\u0440\u0435\u0431\u0443\u0435\u0442 \u0438\u0441\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f"}</div>
                        <div className="mt-1 text-amber-700">{comment ? `Комментарий инспектора: ${comment}` : "Комментарий инспектора: требуется доработка."}</div>
                    </div>
                    <div className="shrink-0 rounded-full bg-white/80 px-3 py-1 font-semibold text-amber-900">{formatRemaining(liveRemainingSeconds)}</div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70">
                    <div className="h-full rounded-full bg-amber-500 transition-[width] duration-1000" style={{ width: `${progress}%` }} />
                </div>
            </div>
        );
    }

    if (status !== "pending_review") return null;

    return (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="font-semibold">Задание №{formatDay2TaskNumber(taskNumber)} на проверке</div>
                    <div className="mt-1 text-blue-700">Ожидаем решение инспектора.</div>
                </div>
                <div className="shrink-0 rounded-full bg-white/80 px-3 py-1 font-semibold text-blue-900">{formatRemaining(liveRemainingSeconds)}</div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70">
                <div className="h-full rounded-full bg-blue-500 transition-[width] duration-1000" style={{ width: `${progress}%` }} />
            </div>
        </div>
    );
}
