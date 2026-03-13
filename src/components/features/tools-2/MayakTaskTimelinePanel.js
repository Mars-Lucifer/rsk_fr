function getStatusLabel(entry) {
    if (entry.status === "rejected") {
        return entry.rejectionCount > 0 ? `Отклонено ${entry.rejectionCount} раз` : "Отклонено";
    }
    if (entry.status === "pending_inspection") return "На проверке";
    if (entry.status === "approved" || entry.status === "auto_approved" || entry.status === "completed") return "Успешно выполнено";
    if (entry.status === "started") return "В процессе";
    return "Без статуса";
}

export default function MayakTaskTimelinePanel({ entries = [], onClose }) {
    return (
        <div className="fixed right-4 top-20 z-40 w-[24rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                    <div className="text-sm font-semibold text-slate-900">{"\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0437\u0430\u0434\u0430\u043d\u0438\u0439"}</div>
                    <div className="text-xs text-slate-500">{"\u0425\u0440\u043e\u043d\u043e\u043b\u043e\u0433\u0438\u044f \u043f\u043e \u0442\u0435\u043a\u0443\u0449\u0435\u0439 \u0441\u0435\u0441\u0441\u0438\u0438"}</div>
                </div>
                <button type="button" onClick={onClose} className="inline-flex items-center justify-center rounded-full bg-transparent p-0 text-slate-900 transition hover:bg-black/5" style={{ width: "2.25rem", height: "2.25rem", flex: "0 0 2.25rem" }} aria-label={"\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0438\u0441\u0442\u043e\u0440\u0438\u044e \u0437\u0430\u0434\u0430\u043d\u0438\u0439"}>
                    <span className="text-2xl leading-none text-black">{"\u00D7"}</span>
                </button>
            </div>
            <div className="max-h-[min(70vh,34rem)] overflow-y-auto p-3">
                {entries.length > 0 ? (
                    <div className="space-y-2">
                        {entries.map((entry) => (
                            <div key={entry.taskKey || entry.number} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">{"\u0417\u0430\u0434\u0430\u043d\u0438\u0435 \u2116"}{entry.number}</div>
                                        <div className="text-xs text-slate-500">{entry.time || "00:00"}</div>
                                    </div>
                                    <div className={`text-xs font-semibold ${entry.status === "rejected" ? "text-red-600" : "text-emerald-700"}`}>{getStatusLabel(entry)}</div>
                                </div>
                                {entry.rejectionReason && entry.status === "rejected" && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{"\u041f\u0440\u0438\u0447\u0438\u043d\u0430:"} {entry.rejectionReason}</div>}
                                {entry.qwen?.requested && <div className="mt-2 text-xs text-slate-600">{"\u041e\u0446\u0435\u043d\u043a\u0430 \u043d\u0435\u0439\u0440\u043e\u0441\u0435\u0442\u0438:"} {entry.qwen.score}</div>}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">{"\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0437\u0430\u0434\u0430\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043f\u0443\u0441\u0442\u0430"}</div>
                )}
            </div>
        </div>
    );
}
