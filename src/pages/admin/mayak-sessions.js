import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";

const AUTH_STORAGE_KEY = "mayak_admin_auth";

export async function getServerSideProps() {
    return { props: {} };
}

function buildDefaultAssignments(tables) {
    if (!Array.isArray(tables) || tables.length === 0) return [];
    if (tables.length === 1) return [{ inspectorTableNumber: tables[0], targetTableNumber: tables[0] }];
    return tables.map((tableNumber, index) => ({ inspectorTableNumber: tableNumber, targetTableNumber: tables[(index + 1) % tables.length] }));
}

function assignmentLabel(entry) {
    return `Инспектор ${entry.inspectorTableNumber} -> стол ${entry.targetTableNumber}`;
}

export default function AdminMayakSessions() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [password, setPassword] = useState("");
    const [authError, setAuthError] = useState("");
    const [sessions, setSessions] = useState([]);
    const [rangesList, setRangesList] = useState([]);
    const [savingId, setSavingId] = useState("");
    const [createError, setCreateError] = useState("");
    const [lastCreatedToken, setLastCreatedToken] = useState("");
    const [tab, setTab] = useState("active");
    const [form, setForm] = useState({ name: "", tableCount: "3", usageLimit: "24", sectionId: "", taskRange: "", tokenName: "", customToken: "" });

    const selectedSection = useMemo(() => rangesList.find((range) => (range.sectionId || range.range) === form.sectionId) || null, [form.sectionId, rangesList]);
    const tableDraft = useMemo(() => {
        const parsedCount = Math.max(1, parseInt(form.tableCount, 10) || 0);
        return Array.from({ length: parsedCount }, (_, index) => String(index + 1));
    }, [form.tableCount]);
    const activeSessions = useMemo(() => sessions.filter((session) => session.status !== "completed"), [sessions]);
    const historySessions = useMemo(() => sessions.filter((session) => session.status === "completed"), [sessions]);

    useEffect(() => {
        const savedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY);
        async function checkAuth() {
            try {
                const res = await fetch("/api/admin/mayak-auth");
                const json = await res.json();
                if (savedAuth === "true" && json.authenticated) setIsAuthenticated(true);
                else sessionStorage.removeItem(AUTH_STORAGE_KEY);
            } catch {}
            setLoading(false);
        }
        checkAuth();
    }, []);

    const fetchSessions = async () => {
        const res = await fetch("/api/admin/mayak-sessions");
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Не удалось загрузить сессии");
        setSessions(json.data || []);
    };

    const fetchRanges = async () => {
        const res = await fetch("/api/admin/mayak-content/ranges");
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) setRangesList(data.data || []);
    };

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchSessions().catch((error) => setCreateError(error.message));
        fetchRanges();
    }, [isAuthenticated]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthError("");
        try {
            const res = await fetch("/api/admin/mayak-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
            const json = await res.json();
            if (!json.success) {
                setAuthError(json.error || "Неверный пароль");
                setPassword("");
                return;
            }
            setIsAuthenticated(true);
            sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
        } catch {
            setAuthError("Ошибка входа");
        }
    };

    const handleCreateSession = async (e) => {
        e.preventDefault();
        setCreateError("");
        setLastCreatedToken("");
        try {
            const payload = {
                name: form.name.trim(),
                usageLimit: parseInt(form.usageLimit, 10),
                tables: tableDraft,
                inspectorAssignments: buildDefaultAssignments(tableDraft),
                tokenName: form.tokenName.trim() || form.name.trim(),
                customToken: form.customToken.trim() || null,
                sectionId: selectedSection?.sectionId || form.sectionId || null,
                taskRange: selectedSection?.range || form.taskRange || null,
            };
            const res = await fetch("/api/admin/mayak-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || "Не удалось создать сессию");
            setLastCreatedToken(json.data?.token?.token || "");
            setForm({ name: "", tableCount: "3", usageLimit: "24", sectionId: "", taskRange: "", tokenName: "", customToken: "" });
            await fetchSessions();
        } catch (error) {
            setCreateError(error.message);
        }
    };

    const patchSession = async (sessionId, body) => {
        const res = await fetch(`/api/admin/mayak-sessions/${sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Не удалось обновить сессию");
        await fetchSessions();
    };

    const handleAssignmentChange = async (sessionId, inspectorTableNumber, targetTableNumber, session) => {
        try {
            setSavingId(sessionId);
            const nextAssignments = (session.inspectorAssignments || []).map((entry) => entry.inspectorTableNumber === inspectorTableNumber ? { ...entry, targetTableNumber } : entry);
            await patchSession(sessionId, { inspectorAssignments: nextAssignments });
        } catch (error) {
            alert(error.message || "Не удалось обновить привязку");
        } finally {
            setSavingId("");
        }
    };

    const handleCompleteSession = async (session) => {
        if (!window.confirm(`Завершить сессию "${session.name}"? Она уйдет в историю.`)) return;
        try {
            setSavingId(session.id);
            await patchSession(session.id, { status: "completed" });
        } catch (error) {
            alert(error.message || "Не удалось завершить сессию");
        } finally {
            setSavingId("");
        }
    };

    const copyToken = async (tokenValue) => {
        try {
            await navigator.clipboard.writeText(tokenValue);
        } catch {
            window.prompt("Скопируйте токен", tokenValue);
        }
    };

    const renderSessionCard = (session, isHistory = false) => (
        <div key={session.id} className="rounded-xl border border-slate-200 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="text-lg font-semibold">{session.name}</div>
                    <div className="text-sm text-slate-600">Колода: {session.sectionId || session.taskRange || "не указана"}</div>
                    <div className="text-sm text-slate-600">Участников: {session.participants?.length || 0}</div>
                    {session.completedAt && <div className="text-sm text-slate-500">Завершена: {new Date(session.completedAt).toLocaleString()}</div>}
                </div>
                {!isHistory && <Button onClick={() => handleCompleteSession(session)} disabled={savingId === session.id} className="!bg-slate-900 !text-white">Завершить</Button>}
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>Токен:</span>
                <code className="rounded bg-white px-2 py-1">{session.token}</code>
                <Button small inverted onClick={() => copyToken(session.token)}>Копировать</Button>
            </div>
            <div className="mb-4 text-sm text-slate-500">Столы: {(session.tables || []).join(", ")}</div>
            <div className="grid gap-3 md:grid-cols-2">
                {(session.inspectorAssignments || []).map((assignment) => (
                    <label key={`${session.id}-${assignment.inspectorTableNumber}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                        <div className="mb-2 font-medium">{assignmentLabel(assignment)}</div>
                        {!isHistory ? (
                            <select value={assignment.targetTableNumber} onChange={(e) => handleAssignmentChange(session.id, assignment.inspectorTableNumber, e.target.value, session)} disabled={savingId === session.id} className="w-full rounded-md border border-gray-300 px-3 py-2">
                                {(session.tables || []).map((tableNumber) => (
                                    <option key={`${session.id}-${assignment.inspectorTableNumber}-${tableNumber}`} value={tableNumber}>Инспектор {assignment.inspectorTableNumber} проверяет стол {tableNumber}</option>
                                ))}
                            </select>
                        ) : (
                            <div className="text-slate-700">Инспектор {assignment.inspectorTableNumber} проверяет стол {assignment.targetTableNumber}</div>
                        )}
                    </label>
                ))}
            </div>
        </div>
    );

    if (loading) return <div className="p-8">Загрузка...</div>;

    if (!isAuthenticated) {
        return (
            <Layout>
                <div className="mx-auto max-w-md p-8">
                    <h1 className="mb-4 text-2xl font-bold">Вход в MAYAK Sessions</h1>
                    <form className="flex flex-col gap-4" onSubmit={handleLogin}>
                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль администратора" />
                        {authError && <div className="text-sm text-red-600">{authError}</div>}
                        <Button type="submit">Войти</Button>
                    </form>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <Header>
                <Header.Heading>Сессии MAYAK</Header.Heading>
                <Link href="/admin/mayak-tokens" className="text-sm text-blue-700 underline underline-offset-4">К токенам</Link>
            </Header>
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                    <h2 className="mb-4 text-xl font-semibold">Новая сессия</h2>
                    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateSession}>
                        <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Название сессии" />
                        <Input value={form.tokenName} onChange={(e) => setForm((prev) => ({ ...prev, tokenName: e.target.value }))} placeholder="Название токена (опционально)" />
                        <Input value={form.tableCount} onChange={(e) => setForm((prev) => ({ ...prev, tableCount: e.target.value }))} placeholder="Количество столов" />
                        <Input value={form.usageLimit} onChange={(e) => setForm((prev) => ({ ...prev, usageLimit: e.target.value }))} placeholder="Лимит использований токена" />
                        <div className="md:col-span-2">
                            <select value={form.sectionId} onChange={(e) => setForm((prev) => ({ ...prev, sectionId: e.target.value, taskRange: e.target.selectedOptions[0]?.dataset.range || "" }))} className="input-wrapper w-full rounded-md border border-gray-300 px-4 py-2">
                                <option value="">Выберите колоду/раздел</option>
                                {rangesList.map((range) => (
                                    <option key={range.sectionId || range.range} value={range.sectionId || range.range} data-range={range.range || ""}>
                                        {(range.sectionId || range.range) + (range.title ? ` — ${range.title}` : "")}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Input value={form.customToken} onChange={(e) => setForm((prev) => ({ ...prev, customToken: e.target.value }))} placeholder="Кастомный токен (опционально)" />
                        <div className="flex items-center gap-3 text-sm text-slate-600">Столы: {tableDraft.join(", ")}</div>
                        {createError && <div className="md:col-span-2 text-sm text-red-600">{createError}</div>}
                        {lastCreatedToken && <div className="md:col-span-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">Сессия создана. Токен: <code>{lastCreatedToken}</code></div>}
                        <div className="md:col-span-2"><Button type="submit">Создать сессию и токен</Button></div>
                    </form>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                    <div className="mb-4 flex items-center gap-3">
                        <Button onClick={() => setTab("active")} className={tab === "active" ? "!bg-slate-900 !text-white" : ""}>Активные</Button>
                        <Button onClick={() => setTab("history")} className={tab === "history" ? "!bg-slate-900 !text-white" : ""}>История</Button>
                    </div>
                    <div className="space-y-4">
                        {tab === "active" && activeSessions.length === 0 && <div className="text-sm text-slate-500">Активных сессий пока нет.</div>}
                        {tab === "history" && historySessions.length === 0 && <div className="text-sm text-slate-500">История пока пустая.</div>}
                        {tab === "active" && activeSessions.map((session) => renderSessionCard(session, false))}
                        {tab === "history" && historySessions.map((session) => renderSessionCard(session, true))}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
