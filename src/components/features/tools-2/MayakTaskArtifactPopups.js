import { useMemo, useState } from "react";

import CloseIcon from "@/assets/general/close.svg";
import Button from "@/components/ui/Button";

function isInlinePreviewable(mimetype = "", filename = "") {
    const value = `${mimetype} ${filename}`.toLowerCase();
    return value.includes("pdf") || value.includes("image/") || value.includes("video/") || value.includes("text/");
}

function buildFileUrl({ attachment, mode, taskKey, token, userId, download = false }) {
    return `/api/mayak/session/file?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId)}&taskKey=${encodeURIComponent(taskKey)}&attachmentId=${encodeURIComponent(attachment.id)}&mode=${encodeURIComponent(mode)}&download=${download ? "true" : "false"}`;
}

function SmallCloseButton({ onClick, title = "\u0417\u0430\u043a\u0440\u044b\u0442\u044c" }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={title}
            title={title}
            className="inline-flex h-9 w-9 min-h-[2.25rem] min-w-[2.25rem] shrink-0 items-center justify-center rounded-full bg-transparent p-0 text-slate-500 transition hover:bg-black/5 hover:text-slate-900">
            <CloseIcon className="h-3.5 w-3.5" />
        </button>
    );
}

function AttachmentPreview({ attachment, mode, taskKey, token, userId }) {
    const inlineUrl = buildFileUrl({ attachment, mode, taskKey, token, userId, download: false });
    const downloadUrl = buildFileUrl({ attachment, mode, taskKey, token, userId, download: true });
    const value = `${attachment?.mimetype || ""} ${attachment?.originalFilename || ""}`.toLowerCase();

    if (!isInlinePreviewable(attachment?.mimetype, attachment?.originalFilename)) {
        return (
            <div className="flex h-full min-h-[32rem] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="max-w-md text-center">
                    <div className="mb-2 text-base font-semibold text-slate-900">{attachment.originalFilename}</div>
                    <div className="mb-4 text-sm text-slate-500">{"\u041f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0434\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u0444\u043e\u0440\u043c\u0430\u0442\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d"}</div>
                    <a href={downloadUrl} className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white" download>
                        {"\u0421\u043a\u0430\u0447\u0430\u0442\u044c \u0444\u0430\u0439\u043b"}
                    </a>
                </div>
            </div>
        );
    }

    if (value.includes("image/")) {
        return (
            <div className="flex h-full min-h-[36rem] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <img src={inlineUrl} alt={attachment.originalFilename} className="max-h-[72vh] w-full rounded-xl object-contain" />
            </div>
        );
    }

    if (value.includes("video/")) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-black p-2">
                <video controls className="h-[72vh] min-h-[32rem] w-full rounded-xl bg-black object-contain" src={inlineUrl} />
            </div>
        );
    }

    if (value.includes("pdf")) {
        return <iframe title={attachment.originalFilename} src={inlineUrl} className="h-[74vh] min-h-[34rem] w-full rounded-2xl border border-slate-200 bg-white" />;
    }

    return <iframe title={attachment.originalFilename} src={inlineUrl} className="h-[68vh] min-h-[30rem] w-full rounded-2xl border border-slate-200 bg-white" />;
}

export function TaskArtifactUploadPopup({ isSubmitting, onCancel, onConfirm, taskLabel }) {
    const [file, setFile] = useState(null);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-xl font-semibold">{"\u041f\u0440\u0438\u043a\u0440\u0435\u043f\u0438\u0442\u0435 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442"}</h3>
                        <p className="text-sm text-slate-500">{taskLabel}</p>
                    </div>
                    <SmallCloseButton onClick={onCancel} />
                </div>

                <label className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.webm,.txt,.xls,.xlsx,.csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                    <div className="text-sm font-medium text-slate-700">{"\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0430\u0439\u043b \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u0430"}</div>
                    <div className="mt-1 text-xs text-slate-500">PDF, Word, {"\u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f, \u0432\u0438\u0434\u0435\u043e, \u0442\u0430\u0431\u043b\u0438\u0446\u044b \u0438 \u0442\u0435\u043a\u0441\u0442\u043e\u0432\u044b\u0435 \u0444\u0430\u0439\u043b\u044b"}</div>
                    {file && <div className="mt-3 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">{file.name}</div>}
                </label>

                <div className="flex justify-end gap-2">
                    <Button inverted onClick={onCancel} disabled={isSubmitting}>{"\u041e\u0442\u043c\u0435\u043d\u0430"}</Button>
                    <Button className="!bg-slate-900 !text-white hover:!bg-slate-800" onClick={() => onConfirm(file)} disabled={!file || isSubmitting}>
                        {isSubmitting ? "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e..." : "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0441 \u0444\u0430\u0439\u043b\u043e\u043c"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function MayakInspectorReviewPopup({ details, loading, mode = "inspector", onClose, onApprove, onReject, token, userId }) {
    const [rejectReason, setRejectReason] = useState("");
    const [showRejectForm, setShowRejectForm] = useState(false);
    const attachment = details?.taskState?.attachments?.[0] || null;
    const taskLabel = useMemo(() => {
        if (!details?.taskState) return "";
        return `\u0417\u0430\u0434\u0430\u043d\u0438\u0435 \u2116${details.taskState.taskNumber}`;
    }, [details]);

    return (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/55 p-4">
            <div className="flex h-[92vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl xl:max-w-[92rem]">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div>
                        <h3 className="text-[2rem] font-semibold leading-none text-slate-950">{"\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u0430"}</h3>
                        <p className="mt-2 text-base text-slate-500">{details?.participant?.name || "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a"} - {taskLabel}</p>
                    </div>
                    <SmallCloseButton onClick={onClose} title="\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0443" />
                </div>

                <div className="grid min-h-0 flex-1 gap-6 overflow-hidden p-6 lg:grid-cols-[minmax(0,1.55fr)_24rem]">
                    <div className="flex min-h-0 flex-col gap-4">
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-100/70 p-3">
                            {attachment ? (
                                <AttachmentPreview attachment={attachment} mode={mode} taskKey={details?.taskState?.taskKey} token={token} userId={userId} />
                            ) : (
                                <div className="flex h-full min-h-[34rem] items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-6 text-center text-sm text-red-700">
                                    {"\u0424\u0430\u0439\u043b \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d"}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
                        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                            <div className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">{"\u0417\u0430\u0434\u0430\u043d\u0438\u0435"}</div>
                            {loading ? (
                                <div className="text-sm text-slate-500">{"\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435..."}</div>
                            ) : (
                                <div className="space-y-4 text-sm leading-6 text-slate-700">
                                    <div>
                                        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{"\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0441\u0438\u0442\u0443\u0430\u0446\u0438\u0438"}</div>
                                        <div>{details?.taskText?.description || "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e"}</div>
                                    </div>
                                    <div>
                                        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{"\u0412\u0430\u0448\u0435\u0439 \u0437\u0430\u0434\u0430\u0447\u0435\u0439 \u0431\u044b\u043b\u043e"}</div>
                                        <div>{details?.taskText?.task || "\u0422\u0435\u043a\u0441\u0442 \u0437\u0430\u0434\u0430\u043d\u0438\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d"}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                            <div className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">{"\u0424\u0430\u0439\u043b"}</div>
                            {attachment ? (
                                <div className="space-y-3 text-sm text-slate-700">
                                    <div className="break-all font-medium text-slate-900">{attachment.originalFilename}</div>
                                    <a href={buildFileUrl({ attachment, mode, taskKey: details?.taskState?.taskKey, token, userId, download: true })} className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 transition hover:bg-slate-100" download>
                                        {"\u0421\u043a\u0430\u0447\u0430\u0442\u044c \u0444\u0430\u0439\u043b"}
                                    </a>
                                </div>
                            ) : (
                                <div className="text-sm text-slate-500">{"\u0424\u0430\u0439\u043b \u043d\u0435 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d"}</div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Button className="!w-full !bg-green-600 !py-3 !text-base !font-semibold !text-white hover:!bg-green-700" onClick={onApprove}>
                                {"\u041f\u0440\u0438\u043d\u044f\u0442\u044c"}
                            </Button>
                            <Button inverted className="!w-full !bg-red-50 !py-3 !text-base !font-semibold !text-red-700 hover:!bg-red-100" onClick={() => setShowRejectForm(true)}>
                                {"\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c"}
                            </Button>
                        </div>

                        {showRejectForm && (
                            <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-4">
                                <div className="mb-2 text-sm font-semibold text-red-700">{"\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u043e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u0438\u044f"}</div>
                                <textarea
                                    value={rejectReason}
                                    onChange={(event) => setRejectReason(event.target.value)}
                                    className="mb-3 min-h-[140px] w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm outline-none"
                                    placeholder="\u0427\u0442\u043e \u043d\u0443\u0436\u043d\u043e \u0438\u0441\u043f\u0440\u0430\u0432\u0438\u0442\u044c"
                                />
                                <div className="flex gap-2">
                                    <Button inverted className="!flex-1" onClick={() => { setShowRejectForm(false); setRejectReason(""); }}>
                                        {"\u041e\u0442\u043c\u0435\u043d\u0430"}
                                    </Button>
                                    <Button className="!flex-1 !bg-red-600 !text-white hover:!bg-red-700" onClick={() => onReject(rejectReason)}>
                                        {"\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
