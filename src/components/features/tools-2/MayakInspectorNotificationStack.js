import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";

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

export default function MayakInspectorNotificationStack({ onOpenTask, onReviewTask, pendingTasks = [] }) {
    const [now, setNow] = useState(Date.now());
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectReason, setRejectReason] = useState("");

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const visibleTasks = useMemo(() => pendingTasks.filter((task) => formatCountdown(buildPendingDeadline(task), now) !== "00:00"), [now, pendingTasks]);

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

    if (!visibleTasks.length) return null;

    return (
        <>
            <div className="fixed right-4 top-20 z-50 flex w-[18rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
                {visibleTasks.map((task) => (
                    <div key={task.taskKey} className="rounded-xl border border-amber-200 bg-white/95 p-3 shadow-xl backdrop-blur">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-900">{task.participantName}</div>
                                <div className="text-xs text-slate-600">№{task.taskNumber}</div>
                            </div>
                            <div className="shrink-0 text-xs font-semibold text-amber-700">{formatCountdown(buildPendingDeadline(task), now)}</div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button small inverted className="!border-slate-300 !bg-white !text-slate-900 hover:!bg-slate-100" onClick={() => onOpenTask?.(task.taskKey)}>Открыть</Button>
                            <Button small className="!bg-green-600 !text-white hover:!bg-green-700" onClick={() => onReviewTask({ taskKey: task.taskKey, action: "approve", reason: "" })}>Принять</Button>
                            <Button small inverted className="!bg-red-50 !text-red-700 hover:!bg-red-100" onClick={() => { setRejectTarget(task); setRejectReason(""); }}>Отклонить</Button>
                        </div>
                    </div>
                ))}
            </div>

            {rejectTarget && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
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
