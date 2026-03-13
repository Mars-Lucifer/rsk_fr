function normalizeEntries(rawValue) {
    if (!Array.isArray(rawValue)) return [];
    return rawValue.filter(Boolean);
}

export function readMayakTaskLog(storageKey) {
    try {
        return normalizeEntries(JSON.parse(localStorage.getItem(storageKey) || "[]"));
    } catch {
        return [];
    }
}

export function writeMayakTaskLog(storageKey, entries) {
    localStorage.setItem(storageKey, JSON.stringify(normalizeEntries(entries)));
}

export function upsertMayakTaskLogEntry(storageKey, entry) {
    const current = readMayakTaskLog(storageKey);
    const matchIndex = current.findIndex((item) => item.taskKey && item.taskKey === entry.taskKey);
    const previous = matchIndex >= 0 ? current[matchIndex] : null;
    const nextEntry = {
        ...previous,
        ...entry,
        rejectionCount: previous?.rejectionCount || entry.rejectionCount || 0,
    };

    if (matchIndex >= 0) {
        current[matchIndex] = nextEntry;
    } else {
        current.unshift(nextEntry);
    }

    writeMayakTaskLog(storageKey, current);
    return current;
}

export function syncMayakTaskLogFromStates(storageKey, taskStates) {
    const current = readMayakTaskLog(storageKey);
    if (!current.length || !Array.isArray(taskStates) || !taskStates.length) return current;

    const statesByTaskKey = new Map(taskStates.filter((item) => item?.taskKey).map((item) => [item.taskKey, item]));
    let changed = false;

    const next = current.map((entry) => {
        const state = statesByTaskKey.get(entry.taskKey);
        if (!state) return entry;

        const nextRejectionCount = state.status === "rejected" && entry.status !== "rejected" ? (entry.rejectionCount || 0) + 1 : entry.rejectionCount || 0;
        const updatedEntry = {
            ...entry,
            status: state.status,
            rejectionReason: state.rejectionReason || "",
            reviewedByName: state.reviewedByName || entry.reviewedByName || "",
            decidedAt: state.decidedAt || entry.decidedAt || null,
            updatedAt: state.updatedAt || entry.updatedAt || null,
            rejectionCount: nextRejectionCount,
        };

        if (JSON.stringify(updatedEntry) !== JSON.stringify(entry)) {
            changed = true;
        }

        return updatedEntry;
    });

    if (changed) {
        writeMayakTaskLog(storageKey, next);
    }

    return next;
}
