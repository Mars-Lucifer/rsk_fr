export function saveMayakPromptHistory({ promptValue, type, storageKey, mayakValues = null, limit = 50 }) {
    const entry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        date: new Date().toISOString(),
        type,
        prompt: promptValue,
        mayakValues,
    };
    const currentHistory = JSON.parse(localStorage.getItem(storageKey) || "[]");
    const nextHistory = [entry, ...currentHistory].slice(0, limit);
    localStorage.setItem(storageKey, JSON.stringify(nextHistory));
    return nextHistory;
}
