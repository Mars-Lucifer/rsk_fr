export function readMayakActiveUser() {
    try {
        const rawCookie =
            document.cookie
                .split("; ")
                .find((row) => row.startsWith("active_user="))
                ?.split("=")[1] || "";

        if (!rawCookie) {
            return { id: "anonymous", name: "Участник" };
        }

        const decoded = decodeURIComponent(rawCookie);
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed === "object") {
            return {
                id: parsed.id || "anonymous",
                name: parsed.name || "Участник",
                sessionId: parsed.sessionId || null,
                tableNumber: parsed.tableNumber || null,
            };
        }

        return { id: decoded, name: decoded };
    } catch {
        return { id: "anonymous", name: "Участник" };
    }
}
