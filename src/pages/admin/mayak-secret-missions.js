"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Header from "@/components/layout/Header";
import MayakAdminBackLink from "@/components/mayak-admin/MayakAdminBackLink";
import { buildMayakAdminLoginUrl, getMayakAdminAuthStatus } from "@/lib/mayakAdminClient";
import { ROLE_OPTIONS } from "@/components/features/mayak-dashboard/dashboardConstants";

// Роли, у которых осмысленны тайные миссии (исключаем «Участник» — это роль по умолчанию).
const MISSION_ROLES = ROLE_OPTIONS.filter((option) => option.value !== "Участник").map((option) => option.value);

const PAGE_BTN_CLASS = "px-5 py-2 rounded-md! bg-blue-500! text-white! text-[13px] font-semibold border-none cursor-pointer disabled:opacity-70 w-auto!";

export default function AdminMayakSecretMissions() {
    const router = useRouter();
    const [isAuth, setIsAuth] = useState(false);
    const [loading, setLoading] = useState(true);
    const [missions, setMissions] = useState({});
    const [activeRole, setActiveRole] = useState(MISSION_ROLES[0] || "");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!router.isReady) return;
        let cancelled = false;
        async function checkAuth() {
            try {
                const { authenticated } = await getMayakAdminAuthStatus();
                if (cancelled) return;
                if (authenticated) setIsAuth(true);
                else router.replace(buildMayakAdminLoginUrl(router.asPath || "/admin/mayak-secret-missions"));
            } catch {
                if (!cancelled) router.replace(buildMayakAdminLoginUrl(router.asPath || "/admin/mayak-secret-missions"));
            }
            if (!cancelled) setLoading(false);
        }
        checkAuth();
        return () => { cancelled = true; };
    }, [router]);

    const fetchMissions = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/admin/mayak-secret-missions");
            const json = await res.json();
            if (json.success && json.data) {
                setMissions(json.data.missions || {});
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (isAuth) fetchMissions();
    }, [isAuth, fetchMissions]);

    const roleItems = missions[activeRole] || [];

    const updateItem = (index, field, value) => {
        setMissions((prev) => {
            const list = [...(prev[activeRole] || [])];
            list[index] = { ...list[index], [field]: value };
            return { ...prev, [activeRole]: list };
        });
    };

    const addItem = () => {
        setMissions((prev) => {
            const list = [...(prev[activeRole] || [])];
            const id = `${activeRole}-${Date.now().toString(36)}`;
            list.push({ id, title: "", text: "" });
            return { ...prev, [activeRole]: list };
        });
    };

    const removeItem = (index) => {
        setMissions((prev) => {
            const list = [...(prev[activeRole] || [])];
            list.splice(index, 1);
            return { ...prev, [activeRole]: list };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const res = await fetch("/api/admin/mayak-secret-missions", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ missions }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Не удалось сохранить пул миссий");
            setMissions(json.data?.missions || {});
            setMessage("Пул миссий сохранён");
        } catch (err) {
            setError(err.message || "Не удалось сохранить пул миссий");
        }
        setSaving(false);
    };

    if (!isAuth) return (<><Header /><div className="p-8 text-center">Проверка доступа...</div></>);
    if (loading) return (<><Header /><div className="p-8 text-center">Загрузка...</div></>);

    return (
        <>
            <Header />
            <div className="mx-auto px-5 py-4">
                <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
                    <h1 className="text-xl m-0 text-slate-800">Тайные миссии МАЯК</h1>
                    <MayakAdminBackLink />
                </div>

                <div className="text-[12px] text-slate-500 mb-4 max-w-3xl">
                    Пул секретных заданий по ролям. В сессионном режиме участник нажимает «Получить миссию» и получает
                    случайную миссию из пула своей роли (один раз). Текст миссии виден только самому участнику.
                </div>

                <div className="flex gap-2 flex-wrap mb-4">
                    {MISSION_ROLES.map((role) => {
                        const count = (missions[role] || []).length;
                        const isActive = role === activeRole;
                        return (
                            <button
                                key={role}
                                type="button"
                                onClick={() => setActiveRole(role)}
                                className={`px-3.5 py-2 rounded-full! text-[13px] font-semibold border cursor-pointer w-auto! ${
                                    isActive ? "bg-violet-600! text-white! border-violet-600" : "bg-white! text-slate-700! border-slate-200"
                                }`}>
                                {role} <span className="opacity-70">({count})</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-col gap-3">
                    {roleItems.length === 0 && (
                        <div className="text-[13px] text-slate-400 py-4">Для роли «{activeRole}» миссий пока нет.</div>
                    )}
                    {roleItems.map((item, index) => (
                        <div key={item.id || index} className="p-4 border border-slate-200 rounded-xl bg-white">
                            <div className="flex justify-between items-center gap-3 mb-2">
                                <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{item.id || "—"}</code>
                                <button
                                    type="button"
                                    onClick={() => removeItem(index)}
                                    className="px-3 py-1.5 rounded-md! bg-red-50! text-red-600! text-[12px] font-semibold border border-red-200 cursor-pointer w-auto!">
                                    Удалить
                                </button>
                            </div>
                            <input
                                value={item.title || ""}
                                onChange={(e) => updateItem(index, "title", e.target.value)}
                                placeholder="Название миссии"
                                className="px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm w-full mb-2"
                            />
                            <textarea
                                value={item.text || ""}
                                onChange={(e) => updateItem(index, "text", e.target.value)}
                                placeholder="Текст миссии"
                                rows={3}
                                className="px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm w-full resize-y"
                            />
                        </div>
                    ))}
                </div>

                <div className="flex gap-2.5 items-center mt-4 flex-wrap">
                    <button type="button" onClick={addItem} className="px-5 py-2 rounded-md! bg-slate-100! text-slate-700! text-[13px] font-semibold border border-slate-200 cursor-pointer w-auto!">
                        + Добавить миссию
                    </button>
                    <button type="button" onClick={handleSave} disabled={saving} className={PAGE_BTN_CLASS}>
                        {saving ? "..." : "Сохранить пул"}
                    </button>
                    {message && <span className="text-[12px] text-green-600">{message}</span>}
                    {error && <span className="text-[12px] text-red-600">{error}</span>}
                </div>
            </div>
        </>
    );
}
