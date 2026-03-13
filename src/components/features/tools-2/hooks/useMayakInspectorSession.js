import { useCallback, useEffect, useMemo, useState } from "react";

import { getKeyFromCookies } from "../actions";

function buildTaskKey(sectionId, taskNumber) {
    return `${sectionId || "global"}:${String(taskNumber || "").trim()}`;
}

function resolveTaskState(snapshot, sectionId, taskNumber) {
    if (!snapshot?.taskStates) return null;
    const key = buildTaskKey(sectionId, taskNumber);
    return snapshot.taskStates.find((taskState) => taskState.taskKey === key) || null;
}

export function useMayakInspectorSession({ activeUser, currentTask, tokenSectionId, setSelectedRole }) {
    const [token, setToken] = useState("");
    const [sessionSnapshot, setSessionSnapshot] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        async function loadToken() {
            const keyInCookies = await getKeyFromCookies();
            if (!cancelled) setToken(keyInCookies?.text || "");
        }
        loadToken();
        return () => {
            cancelled = true;
        };
    }, []);

    const refreshSessionState = useCallback(async () => {
        if (!token || !activeUser?.id) {
            setSessionSnapshot(null);
            return null;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/mayak/session/me?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(activeUser.id)}`);
            const payload = await response.json().catch(() => ({}));
            if (response.status === 404) {
                setSessionSnapshot(null);
                setError("");
                return null;
            }
            if (!response.ok || !payload.success) throw new Error(payload.error || "Не удалось загрузить состояние сессии");
            setSessionSnapshot(payload.data || null);
            setError("");
            return payload.data || null;
        } catch (fetchError) {
            console.error("Session refresh failed:", fetchError);
            setError(fetchError.message || "Ошибка чтения состояния сессии");
            return null;
        } finally {
            setLoading(false);
        }
    }, [activeUser?.id, token]);

    useEffect(() => {
        refreshSessionState();
    }, [refreshSessionState]);

    useEffect(() => {
        if (!sessionSnapshot?.session?.id || !activeUser?.id) return undefined;
        const intervalId = window.setInterval(() => {
            refreshSessionState();
        }, 5000);
        return () => window.clearInterval(intervalId);
    }, [activeUser?.id, refreshSessionState, sessionSnapshot?.session?.id]);

    useEffect(() => {
        if (sessionSnapshot?.participant?.role && sessionSnapshot.participant.role !== localStorage.getItem("trainer_v2_userRole")) {
            setSelectedRole(sessionSnapshot.participant.role);
            localStorage.setItem("trainer_v2_userRole", sessionSnapshot.participant.role);
        }
    }, [sessionSnapshot?.participant?.role, setSelectedRole]);

    const currentTaskKey = useMemo(() => buildTaskKey(tokenSectionId, currentTask?.number || ""), [currentTask?.number, tokenSectionId]);
    const currentTaskState = useMemo(() => (sessionSnapshot?.taskStates || []).find((taskState) => taskState.taskKey === currentTaskKey) || null, [currentTaskKey, sessionSnapshot?.taskStates]);

    const syncRole = useCallback(async (role) => {
        if (!token || !activeUser?.id || !sessionSnapshot?.session?.id) return true;
        const response = await fetch("/api/mayak/session/role", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, userId: activeUser.id, role }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.error || "Не удалось сохранить роль");
        await refreshSessionState();
        return true;
    }, [activeUser?.id, refreshSessionState, sessionSnapshot?.session?.id, token]);

    const notifyTaskStarted = useCallback(async ({ taskNumber, taskName, sectionId }) => {
        if (!token || !activeUser?.id || !sessionSnapshot?.session?.id) return true;
        const response = await fetch("/api/mayak/session/task-start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, userId: activeUser.id, taskNumber, taskName, sectionId }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.error || "Не удалось зафиксировать старт задания");
        const snapshot = await refreshSessionState();
        return resolveTaskState(snapshot, sectionId, taskNumber);
    }, [activeUser?.id, refreshSessionState, sessionSnapshot?.session?.id, token]);

    const submitTaskForReview = useCallback(async ({ file, taskNumber, taskName, elapsedSeconds, sectionId }) => {
        if (!token || !activeUser?.id || !sessionSnapshot?.session?.id) return null;
        if (!(file instanceof File)) throw new Error("Прикрепите файл результата");

        const formData = new FormData();
        formData.append("token", token);
        formData.append("userId", activeUser.id);
        formData.append("taskNumber", String(taskNumber || ""));
        formData.append("taskName", taskName || "");
        formData.append("elapsedSeconds", String(elapsedSeconds || 0));
        if (sectionId) formData.append("sectionId", sectionId);
        formData.append("file", file);

        const response = await fetch("/api/mayak/session/task-submit-upload", {
            method: "POST",
            body: formData,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.error || "Не удалось отправить задание инспектору");
        const snapshot = await refreshSessionState();
        return resolveTaskState(snapshot, sectionId, taskNumber);
    }, [activeUser?.id, refreshSessionState, sessionSnapshot?.session?.id, token]);

    const reviewTask = useCallback(async ({ taskKey, action, reason }) => {
        const response = await fetch("/api/mayak/session/task-review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, userId: activeUser.id, taskKey, action, reason }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.error || "Не удалось обработать задание");
        await refreshSessionState();
        return true;
    }, [activeUser?.id, refreshSessionState, token]);

    const fetchTaskDetails = useCallback(async ({ mode = "inspector", taskKey }) => {
        if (!token || !activeUser?.id || !taskKey) return null;
        const response = await fetch(`/api/mayak/session/task-details?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(activeUser.id)}&taskKey=${encodeURIComponent(taskKey)}&mode=${encodeURIComponent(mode)}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.error || "Не удалось загрузить детали задания");
        return payload.data || null;
    }, [activeUser?.id, token]);

    return {
        currentTaskState,
        error,
        fetchTaskDetails,
        loading,
        refreshSessionState,
        reviewTask,
        sessionSnapshot,
        submitTaskForReview,
        syncRole,
        taskKeyForCurrentTask: currentTaskKey,
        token,
        notifyTaskStarted,
    };
}
