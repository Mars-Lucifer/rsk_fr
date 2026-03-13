import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";

const STATUS_LABELS = {
    started: { text: "Выполняет", className: "bg-blue-100 text-blue-700" },
    pending_inspection: { text: "На проверке", className: "bg-amber-100 text-amber-800" },
    approved: { text: "Одобрено", className: "bg-green-100 text-green-700" },
    auto_approved: { text: "Пропущено", className: "bg-emerald-100 text-emerald-700" },
    rejected: { text: "Исправить", className: "bg-red-100 text-red-700" },
};

function StatusBadge({ status }) {
    const meta = STATUS_LABELS[status] || { text: status || "Нет статуса", className: "bg-gray-100 text-gray-700" };
    return <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${meta.className}`}>{meta.text}</span>;
}

function formatCountdown(isoValue, now) {
    if (!isoValue) return null;
    const diff = new Date(isoValue).getTime() - now;
    if (diff <= 0) return "00:00";
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function buildPendingDeadline(taskState) {
    if (!taskState?.submittedAt) return null;
    return new Date(new Date(taskState.submittedAt).getTime() + 2 * 60 * 1000).toISOString();
}

export default function MayakInspectorPanel({ currentTaskState, floating = false, onOpenTask, onReviewTask, sessionSnapshot }) {
    const [now, setNow] = useState(Date.now());
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectReason, setRejectReason] = useState("");
    const inspectorView = sessionSnapshot?.inspectorView || null;

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const participantStatusMeta = useMemo(() => {
        if (!currentTaskState) return null;
        if (currentTaskState.status === "pending_inspection") {
            return {
                status: currentTaskState.status,
                timer: formatCountdown(buildPendingDeadline(currentTaskState), now),
                reason: "",
            };
        }
        if (currentTaskState.status === "rejected") {
            return {
                status: currentTaskState.status,
                timer: formatCountdown(currentTaskState.correctionDeadlineAt, now),
                reason: currentTaskState.rejectionReason || "",
            };
        }
        if (currentTaskState.status === "approved" || currentTaskState.status === "auto_approved") {
            return { status: currentTaskState.status, timer: null, reason: "" };
        }
        return null;
    }, [currentTaskState, now]);

    const summaryParticipants = useMemo(() => {
        if (!inspectorView) return [];
        const pendingKeys = new Set((inspectorView.pendingTasks || []).map((task) => task.taskKey));
        return (inspectorView.participants || []).filter((entry) => {
            const latestTask = entry.latestTask || null;
            return !latestTask?.taskKey || !pendingKeys.has(latestTask.taskKey);
        });
    }, [inspectorView]);

    const submitReject = async () => {
        if (!rejectTarget) return;
        if (!rejectReason.trim()) {
            alert("Укажите причину отклонения");
            return;
        }
        try {
            await onReviewTask({ taskKey: rejectTarget.taskKey, action: "reject", reason: rejectReason.trim() });
            setRejectTarget(null);
            setRejectReason("");
        } catch (error) {
            alert(error.message || "Не удалось отклонить задание");
        }
    };

    if (!inspectorView) {
        if (!participantStatusMeta) return null;
        return (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                    <StatusBadge status={participantStatusMeta.status} />
                    {participantStatusMeta.timer && <span className="text-sm font-semibold text-slate-700">{participantStatusMeta.timer}</span>}
                </div>
                {participantStatusMeta.reason && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Причина: {participantStatusMeta.reason}</div>}
            </div>
        );
    }

    const panelClassName = floating ? "max-h-[min(75vh,38rem)] overflow-y-auto bg-slate-50 p-3" : "rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto";

    return (
        <>
            <div className={panelClassName}>
                <div className="mb-3">
                    <div className="text-sm font-semibold text-slate-900">Стол {inspectorView.targetTableNumber || "?"}</div>
                    <div className="text-xs text-slate-600">На проверке: {inspectorView.pendingTasks?.length || 0}</div>
                </div>

                {inspectorView.pendingTasks?.length > 0 && (
                    <div className="mb-3 space-y-2">
                        {inspectorView.pendingTasks.map((task) => (
                            <div key={task.taskKey} className="rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-slate-900">{task.participantName}</div>
                                        <div className="text-[11px] text-slate-600">№{task.taskNumber}</div>
                                    </div>
                                    <span className="shrink-0 text-xs font-semibold text-amber-800">{formatCountdown(buildPendingDeadline(task), now)}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <Button small inverted className="!border-slate-300 !bg-white !text-slate-900 hover:!bg-slate-100" onClick={() => onOpenTask?.(task.taskKey)}>Открыть</Button>
                                    <Button small className="!bg-green-600 !text-white hover:!bg-green-700" onClick={() => onReviewTask({ taskKey: task.taskKey, action: "approve", reason: "" })}>Принять</Button>
                                    <Button small inverted className="!bg-red-50 !text-red-700 hover:!bg-red-100" onClick={() => { setRejectTarget(task); setRejectReason(""); }}>Отклонить</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {summaryParticipants.length > 0 && (
                    <div className="space-y-2 border-t border-slate-200 pt-3">
                        {summaryParticipants.map((entry) => {
                            const latestTask = entry.latestTask || null;
                            const correctionTimer = latestTask?.status === "rejected" ? formatCountdown(latestTask.correctionDeadlineAt, now) : null;
                            return (
                                <div key={entry.userId} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-slate-900">{entry.name}</div>
                                            <div className="text-[11px] text-slate-600">{latestTask ? `№${latestTask.taskNumber}` : "Без активности"}</div>
                                        </div>
                                        <StatusBadge status={latestTask?.status || ""} />
                                    </div>
                                    {correctionTimer && <div className="mt-1 text-[11px] font-medium text-slate-600">{correctionTimer}</div>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {rejectTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                        <h3 className="mb-3 text-lg font-semibold">Причина отклонения</h3>
                        <div className="mb-2 text-sm text-slate-600">{rejectTarget.participantName}, задание №{rejectTarget.taskNumber}</div>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="mb-4 min-h-[110px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                            placeholder="Что нужно исправить"
                        />
                        <div className="flex justify-end gap-2">
                            <Button inverted onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Отмена</Button>
                            <Button className="!bg-red-600 !text-white hover:!bg-red-700" onClick={submitReject}>Отклонить</Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
