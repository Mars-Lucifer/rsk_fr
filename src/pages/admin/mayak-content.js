"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Header from "@/components/layout/Header";
import MayakAdminBackLink from "@/components/mayak-admin/MayakAdminBackLink";
import { buildMayakAdminLoginUrl, getMayakAdminAuthStatus } from "@/lib/mayakAdminClient";
import { RangeEditor } from "@/components/features/admin-content/RangeEditor";

// ============ Главная страница ============
export default function AdminMayakContent() {
    const router = useRouter();
    const [isAuth, setIsAuth] = useState(false);
    const [ranges, setRanges] = useState([]);
    const [selectedRange, setSelectedRange] = useState(() => {
        try { return sessionStorage.getItem("mayak_admin_selected_range") || null; } catch { return null; }
    });
    const [loading, setLoading] = useState(true);
    const [newRange, setNewRange] = useState("");
    const [newRangeName, setNewRangeName] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [tokensBySection, setTokensBySection] = useState({});
    const [introQuestionnaireUrl, setIntroQuestionnaireUrl] = useState("");
    const [completionSurveyUrl, setCompletionSurveyUrl] = useState("");
    const [questionnaireSaving, setQuestionnaireSaving] = useState(false);
    const [questionnaireError, setQuestionnaireError] = useState("");
    const [questionnaireMessage, setQuestionnaireMessage] = useState("");

    useEffect(() => {
        if (!router.isReady) return;
        let cancelled = false;

        async function checkAuth() {
            try {
                const { authenticated } = await getMayakAdminAuthStatus();
                if (cancelled) return;

                if (authenticated) {
                    setIsAuth(true);
                } else {
                    router.replace(buildMayakAdminLoginUrl(router.asPath || "/admin/mayak-content"));
                }
            } catch {
                if (!cancelled) {
                    router.replace(buildMayakAdminLoginUrl(router.asPath || "/admin/mayak-content"));
                }
            }

            if (!cancelled) {
                setLoading(false);
            }
        }

        checkAuth();
        return () => {
            cancelled = true;
        };
    }, [router]);

    const fetchRanges = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/mayak-content/ranges`);
            const json = await res.json();
            if (json.success) setRanges(json.data || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, []);

    const fetchQuestionnaireSettings = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/mayak-settings");
            const json = await res.json();
            if (json.success && json.data) {
                setIntroQuestionnaireUrl(json.data.introQuestionnaireUrl || "");
                setCompletionSurveyUrl(json.data.completionSurveyUrl || "");
            }
        } catch (err) { console.error(err); }
    }, []);

    const fetchTokensBySection = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/mayak-tokens`);
            const json = await res.json();
            if (json.data) {
                const grouped = {};
                json.data.forEach((t) => {
                    const r = t.sectionId || t.taskRange || "_all";
                    if (!grouped[r]) grouped[r] = [];
                    grouped[r].push(t);
                });
                setTokensBySection(grouped);
            }
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => {
        if (isAuth) {
            fetchRanges();
            fetchTokensBySection();
            fetchQuestionnaireSettings();
        }
    }, [isAuth, fetchQuestionnaireSettings, fetchRanges, fetchTokensBySection]);

    const selectRange = (r) => { setSelectedRange(r); sessionStorage.setItem("mayak_admin_selected_range", r); };
    const goBack = () => { setSelectedRange(null); sessionStorage.removeItem("mayak_admin_selected_range"); fetchRanges(); };

    const handleSaveQuestionnaireSettings = async () => {
        setQuestionnaireSaving(true);
        setQuestionnaireError("");
        setQuestionnaireMessage("");
        try {
            const res = await fetch("/api/admin/mayak-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ introQuestionnaireUrl, completionSurveyUrl }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Не удалось сохранить ссылки анкет");
            setQuestionnaireMessage("Ссылки анкет сохранены");
            await fetchQuestionnaireSettings();
        } catch (err) {
            setQuestionnaireError(err.message || "Не удалось сохранить ссылки анкет");
        }
        setQuestionnaireSaving(false);
    };

    const handleCreateRange = async () => {
        if (!newRange.trim()) return;
        setCreating(true);
        setError("");
        try {
            const res = await fetch("/api/admin/mayak-content/ranges", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ range: newRange.trim(), rangeName: newRangeName.trim() }),
            });
            const json = await res.json();
            if (json.success) { setNewRange(""); setNewRangeName(""); await fetchRanges(); }
            else setError(json.error);
        } catch (err) { setError(err.message); }
        setCreating(false);
    };

    if (!isAuth) return (<><Header /><div className="p-8 text-center">Проверка доступа...</div></>);
    if (loading) return (<><Header /><div className="p-8 text-center">Загрузка...</div></>);

    return (
        <>
            <Header />
            <div className="mx-auto px-5 py-4">
                <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
                    <h1 className="text-xl m-0 text-slate-800">Управление контентом МАЯК</h1>
                    <MayakAdminBackLink />
                </div>

                {!selectedRange ? (
                    <div>
                        <div className="flex gap-2 items-center mb-5 flex-wrap">
                            <input
                                value={newRange}
                                onChange={(e) => setNewRange(e.target.value)}
                                placeholder="Диапазон, напр. 101-200"
                                className="px-3.5 py-2.5 rounded-lg border border-gray-300 text-[15px] w-[200px]"
                                onKeyDown={(e) => e.key === "Enter" && handleCreateRange()}
                            />
                            <input
                                value={newRangeName}
                                onChange={(e) => setNewRangeName(e.target.value)}
                                placeholder="Название раздела"
                                className="px-3.5 py-2.5 rounded-lg border border-gray-300 text-[15px] w-[260px]"
                                onKeyDown={(e) => e.key === "Enter" && handleCreateRange()}
                            />
                            <button onClick={handleCreateRange} disabled={creating} className={PAGE_BTN_CLASS}>
                                {creating ? "..." : "Создать раздел"}
                            </button>
                        </div>
                        {error && <div className="text-red-600 text-[13px] mb-3">{error}</div>}
                        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                            {ranges.map((r) => {
                                const key = r.sectionId || r.range;
                                const sectionTokens = tokensBySection[key] || [];
                                return (
                                    <div
                                        key={key}
                                        onClick={() => selectRange(key)}
                                        className="p-4 border border-slate-200 rounded-[10px] cursor-pointer transition-colors bg-white hover:border-blue-500"
                                    >
                                        <div className="font-bold text-lg mb-1">{r.range}</div>
                                        {key !== r.range && <div className="text-[11px] text-slate-400 mb-0.5">{key}</div>}
                                        {r.rangeName && <div className="text-[13px] text-slate-600 mb-0.5">{r.rangeName}</div>}
                                        {sectionTokens.length > 0 ? (
                                            <div className="mt-1.5">
                                                {sectionTokens.map((t) => (
                                                    <div key={t.id} className="text-[11px] text-indigo-700 leading-relaxed">
                                                        <span className="font-semibold">{t.name}</span>
                                                        <code className="text-[9px] bg-indigo-100 px-1 rounded-[3px] ml-1 text-indigo-500">{t.token.substring(0, 12)}...</code>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-[11px] text-slate-400 mt-1.5">Нет токенов</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 p-4 border border-slate-200 rounded-xl bg-white">
                            <div className="text-base font-bold text-slate-800 mb-2">Глобальные анкеты MAYAK</div>
                            <div className="text-[12px] text-slate-500 mb-4">
                                Эти ссылки используются во всех колодах для вводной Яндекс-анкеты и анкеты обратной связи при завершении сессии. Trainer берёт их отсюда, а не из отдельных колод.
                            </div>
                            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-700">Входная анкета</label>
                                    <input
                                        value={introQuestionnaireUrl}
                                        onChange={(e) => setIntroQuestionnaireUrl(e.target.value)}
                                        placeholder="https://forms.yandex.ru/u/..."
                                        className="px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-700">Выходная анкета</label>
                                    <input
                                        value={completionSurveyUrl}
                                        onChange={(e) => setCompletionSurveyUrl(e.target.value)}
                                        placeholder="https://forms.yandex.ru/u/..."
                                        className="px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2.5 items-center mt-3.5 flex-wrap">
                                <button onClick={handleSaveQuestionnaireSettings} disabled={questionnaireSaving} className={PAGE_BTN_CLASS}>
                                    {questionnaireSaving ? "..." : "Сохранить ссылки"}
                                </button>
                                {questionnaireMessage && <span className="text-[12px] text-green-600">{questionnaireMessage}</span>}
                                {questionnaireError && <span className="text-[12px] text-red-600">{questionnaireError}</span>}
                            </div>
                        </div>
                    </div>
                ) : (
                    <RangeEditor range={selectedRange} onBack={goBack} />
                )}
            </div>
        </>
    );
}

// Кнопка-действие страницы. `!`-важные классы перебивают глобальный
// button{} из styles/colour.css+spacing.css (там фон чёрный и width:100%).
const PAGE_BTN_CLASS = "px-5 py-2 rounded-md! bg-blue-500! text-white! text-[13px] font-semibold border-none cursor-pointer disabled:opacity-70 w-auto!";

