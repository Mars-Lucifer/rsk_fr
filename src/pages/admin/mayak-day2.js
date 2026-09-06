"use client";

// День 2, страница администратора: список дней слева, справа выбранный день —
// строка «Следующий шаг» и девять этапов аккордеоном (АДМИН_ДЕНЬ2.md, раздел 3).
// Этап нельзя перепрыгнуть: кнопка следующего активна, когда предыдущий закрыт
// проверкой (computeStage). Вход — как у остальных админских страниц МАЯК.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Header from "@/components/layout/Header";
import MayakAdminBackLink from "@/components/mayak-admin/MayakAdminBackLink";
import { buildMayakAdminLoginUrl, getMayakAdminAuthStatus } from "@/lib/mayakAdminClient";
import { DAY_TWO_STAGE_TITLES, computeStage } from "@/lib/mayakDayTwoModel";
import {
    BriefPanel,
    DeckPanel,
    ExportPanel,
    FinishPanel,
    LiveDayPanel,
    MailingPanel,
    SectionPanel,
    SessionPanel,
    TablesSitePanel,
    TracksPanel,
    ui,
} from "@/components/mayak-day2/DayTwoStagePanels";

const API = "/api/admin/mayak-day2";

async function api(path, { method = "GET", body } = {}) {
    const response = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "Запрос не выполнен");
    }
    return payload.data;
}

function formatDate(value) {
    const [year, month, day] = String(value || "").split("-");
    return day && month && year ? `${day}.${month}.${year}` : value || "без даты";
}

function StageBox({ n, title, done, open, current, onToggle, children }) {
    const badge = done ? "bg-[#dcfce7] text-[#166534] border-[#bbf7d0]" : current ? "bg-[#fef3c7] text-[#92400e] border-[#fde68a]" : "bg-white text-[#64748b] border-(--color-gray-plus-50)";
    return (
        <section className={`rounded-[1.25rem] border bg-white shadow-sm ${current ? "border-[#0f766e]" : "border-(--color-gray-plus-50)"}`}>
            <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={onToggle}>
                <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black ${badge}`}>{done ? "✓" : n}</span>
                <span className="text-base font-black text-(--color-black)">{title}</span>
                <span className="ml-auto text-xs text-[#64748b]">{done ? "закрыт" : current ? "текущий" : open ? "свернуть" : "открыть"}</span>
            </button>
            {open ? <div className="border-t border-(--color-gray-plus-50) p-4">{children}</div> : null}
        </section>
    );
}

export default function AdminMayakDayTwoPage() {
    const router = useRouter();
    const [isAuth, setIsAuth] = useState(false);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState([]);
    const [selectedId, setSelectedId] = useState("");
    const [day, setDay] = useState(null);
    const [live, setLive] = useState(null);
    const [suggestedSectionId, setSuggestedSectionId] = useState("");
    const [openStage, setOpenStage] = useState(1);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const [newForm, setNewForm] = useState({ org: "", date: "" });
    const [origin, setOrigin] = useState("");

    const stage = useMemo(() => (day ? computeStage(day, now) : null), [day, now]);

    const loadDays = useCallback(async () => {
        const list = await api(`${API}/days`);
        setDays(list);
        return list;
    }, []);

    const loadDay = useCallback(async (id) => {
        if (!id) {
            setDay(null);
            return;
        }
        const data = await api(`${API}/${id}`);
        setDay(data.day);
        setLive(null);
        setOpenStage(data.stage?.stage || 1);
        if (!data.day.sectionId) {
            api(`${API}/${id}/publish`)
                .then((info) => setSuggestedSectionId(info.sectionId || ""))
                .catch(() => setSuggestedSectionId(""));
        } else {
            setSuggestedSectionId(data.day.sectionId);
        }
    }, []);

    useEffect(() => {
        if (!router.isReady) return;
        let cancelled = false;
        setOrigin(typeof window !== "undefined" ? window.location.origin : "");

        (async () => {
            try {
                const { authenticated } = await getMayakAdminAuthStatus();
                if (cancelled) return;
                if (authenticated) {
                    setIsAuth(true);
                    const list = await loadDays();
                    const first = list[0]?.id || "";
                    setSelectedId(first);
                    if (first) await loadDay(first);
                } else {
                    router.replace(buildMayakAdminLoginUrl(router.asPath || "/admin/mayak-day2"));
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Не удалось загрузить дни");
                }
            }
            if (!cancelled) setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [loadDay, loadDays, router]);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60 * 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!message) return undefined;
        const timeoutId = window.setTimeout(() => setMessage(""), 3200);
        return () => window.clearTimeout(timeoutId);
    }, [message]);

    const run = useCallback(
        async (work, successText) => {
            setBusy(true);
            setError("");
            try {
                const result = await work();
                if (result?.day) setDay(result.day);
                if (successText) setMessage(successText);
                await loadDays();
                return result;
            } catch (err) {
                setError(err instanceof Error ? err.message : "Не удалось выполнить действие");
                return null;
            } finally {
                setBusy(false);
            }
        },
        [loadDays]
    );

    const patchDay = (body, text = "Сохранено") => run(() => api(`${API}/${day.id}`, { method: "PATCH", body }), text);

    const selectDay = async (id) => {
        setSelectedId(id);
        setError("");
        try {
            await loadDay(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Не удалось загрузить день");
        }
    };

    const createDay = async () => {
        if (!newForm.org.trim() || !newForm.date) {
            setError("Для нового дня нужны организация и дата");
            return;
        }
        const created = await run(() => api(`${API}/days`, { method: "POST", body: { org: newForm.org.trim(), date: newForm.date } }), "День создан: колода из шаблона уже внутри");
        if (created?.id) {
            setNewForm({ org: "", date: "" });
            await selectDay(created.id);
        }
    };

    // H4d: копия дня — бриф, столы, папка, колода; дата пустая, раздел и сессия не переносятся.
    const copyDay = async (id) => {
        const created = await run(() => api(`${API}/days`, { method: "POST", body: { copyFrom: id } }), "День скопирован: поставьте дату в брифе");
        if (created?.id) await selectDay(created.id);
    };

    const loadPrompt = (tableN) => api(`${API}/${day.id}/texts?table=${encodeURIComponent(tableN)}`);

    const publish = (sectionId) =>
        run(async () => {
            const result = await api(`${API}/${day.id}/publish`, { method: "POST", body: { sectionId } });
            setSuggestedSectionId(result.day.sectionId);
            return result;
        }, "Раздел записан");

    const createSession = ({ tableCount, participantLimit }) => run(() => api(`${API}/${day.id}/session`, { method: "POST", body: { tableCount, participantLimit } }), "Сессия создана");

    const refreshLive = () =>
        run(async () => {
            const result = await api(`${API}/${day.id}/results`);
            setLive(result.results);
            const fresh = await api(`${API}/${day.id}`);
            return fresh;
        }, "Состояние столов обновлено");

    const snapshot = () => run(() => api(`${API}/${day.id}/results`, { method: "POST", body: { snapshot: true } }), "Снимок результатов сохранён");

    const complete = () => patchDay({ completed: true }, "Отмечено: сессия завершена");

    const handleNext = async () => {
        const action = stage?.next?.action || "";
        if (action.startsWith("open:")) {
            setOpenStage(Number(action.slice(5)));
            return;
        }
        if (action === "template") await patchDay({ fromTemplate: true }, "Колода собрана из шаблона");
        if (action === "publish") await publish(suggestedSectionId || day.sectionId || "");
        if (action === "session") await createSession({ tableCount: day.tables?.length || 3, participantLimit: 60 });
        if (action === "snapshot") await snapshot();
        if (action === "complete") await complete();
        if (["publish", "session", "snapshot", "complete", "template"].includes(action)) {
            setOpenStage((current) => Math.min(9, current + 1));
        }
    };

    const toggleTrack = (tableN, index, mark) => {
        const tracks = JSON.parse(JSON.stringify(day.tracks || {}));
        const row = Array.isArray(tracks[String(tableN)]) ? tracks[String(tableN)] : ["", "", "", "", "", ""];
        row[index] = mark;
        tracks[String(tableN)] = row;
        return patchDay({ tracks }, "Трек отмечен");
    };

    const saveNote = (tableN, key, text) => patchDay({ notes: { [String(tableN)]: { ...(day.notes?.[String(tableN)] || {}), [key]: text } } }, "Правка сохранена в заметках дня");

    if (!isAuth) {
        return (
            <>
                <Header />
                {!loading && <div className="px-8 py-10 text-sm text-[#64748b]">Проверка доступа…</div>}
            </>
        );
    }

    return (
        <>
            <Header>
                <Header.Heading>День 2</Header.Heading>
            </Header>
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-5 pb-12">
                <section className="rounded-[1.5rem] border border-(--color-gray-plus-50) bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="max-w-2xl">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">MAYAK admin</div>
                            <h1 className="mt-2 text-[2rem] font-black text-(--color-black)">День 2</h1>
                            <p className="mt-2 text-sm leading-6 text-[#64748b]">Бриф → колода → раздел → сессия → рассылка → день → выгрузка → завершение → треки. Одна кнопка на экране, следующая появляется после проверки.</p>
                        </div>
                        <MayakAdminBackLink className="xl:self-end" />
                    </div>
                </section>

                {message ? <div className={ui.ok}>{message}</div> : null}
                {error ? <div className={ui.bad}>{error}</div> : null}

                <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
                    <aside className="space-y-3">
                        <section className="rounded-[1.25rem] border border-(--color-gray-plus-50) bg-white p-4 shadow-sm">
                            <div className={ui.label}>Новый день</div>
                            <input className={`${ui.input} mt-2`} placeholder="Организация" value={newForm.org} onChange={(e) => setNewForm({ ...newForm, org: e.target.value })} />
                            <input type="date" className={`${ui.input} mt-2`} value={newForm.date} onChange={(e) => setNewForm({ ...newForm, date: e.target.value })} />
                            <button type="button" className={`${ui.primary} mt-3 !w-full`} disabled={busy} onClick={createDay}>
                                Новый день
                            </button>
                        </section>
                        <section className="rounded-[1.25rem] border border-(--color-gray-plus-50) bg-white p-2 shadow-sm">
                            {loading ? <div className="p-3 text-sm text-[#64748b]">Загрузка…</div> : null}
                            {!loading && days.length === 0 ? <div className="p-3 text-sm text-[#64748b]">Дней пока нет — создайте первый.</div> : null}
                            {days.map((item) => (
                                <div key={item.id} className={`flex items-start gap-1 rounded-[0.9rem] transition ${item.id === selectedId ? "bg-[#0f766e] text-white" : "hover:bg-[#f1f5f9]"}`}>
                                    <button type="button" onClick={() => selectDay(item.id)} className="block min-w-0 flex-1 px-3 py-2 text-left">
                                        <div className="text-sm font-bold">{item.org || "Без названия"}</div>
                                        <div className={`text-xs ${item.id === selectedId ? "text-white/80" : "text-[#64748b]"}`}>
                                            {formatDate(item.date)} · этап {item.stage} · {DAY_TWO_STAGE_TITLES[item.stage - 1]}
                                            {item.sectionId ? ` · ${item.sectionId}` : ""}
                                        </div>
                                    </button>
                                    <button type="button" title="Скопировать день" disabled={busy} onClick={() => copyDay(item.id)} className={`my-2 mr-2 shrink-0 rounded-[0.6rem] border px-2 py-1 text-[11px] font-semibold ${item.id === selectedId ? "border-white/40 text-white" : "border-(--color-gray-plus-50) text-[#64748b]"}`}>
                                        Скопировать
                                    </button>
                                </div>
                            ))}
                        </section>
                    </aside>

                    <div className="space-y-3">
                        {!day ? (
                            <section className="rounded-[1.5rem] border border-(--color-gray-plus-50) bg-white p-6 text-sm text-[#64748b] shadow-sm">Выберите день слева или создайте новый.</section>
                        ) : (
                            <>
                                <section className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-(--color-gray-plus-50) bg-white px-4 py-3 shadow-sm">
                                    <div className="min-w-0">
                                        <div className="text-base font-black text-(--color-black)">{day.org || "Без названия"}</div>
                                        <div className="text-xs text-[#64748b]">
                                            {formatDate(day.date)}
                                            {day.sectionId ? ` · раздел ${day.sectionId}` : ""} · {(day.cards || []).length} карточек · столов {(day.tables || []).length}
                                        </div>
                                    </div>
                                    <button type="button" className={`${ui.secondary} ml-auto`} disabled={busy} onClick={() => copyDay(day.id)}>
                                        Скопировать день
                                    </button>
                                </section>
                                <section className="rounded-[1.5rem] border-2 border-[#0f766e] bg-[#f0fdfa] p-4 shadow-sm">
                                    <div className={ui.label}>Следующий шаг · этап {stage.stage} из 9 · {DAY_TWO_STAGE_TITLES[stage.stage - 1]}</div>
                                    <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div className="text-base font-bold text-(--color-black)">{stage.next.text}</div>
                                        {stage.next.label ? (
                                            <button type="button" className={ui.primary} disabled={busy || stage.next.disabled} onClick={handleNext}>
                                                {stage.next.label}
                                            </button>
                                        ) : null}
                                    </div>
                                </section>

                                {stage.stages.map((item) => {
                                    const n = item.n;
                                    const open = openStage === n;
                                    const common = { n, title: item.title, done: item.done, open, current: stage.stage === n, onToggle: () => setOpenStage(open ? 0 : n) };
                                    return (
                                        <StageBox key={n} {...common}>
                                            {n === 1 ? <BriefPanel day={day} problems={stage.briefProblems} warnings={stage.briefWarnings} busy={busy} onSave={(draft) => patchDay(draft, "Бриф сохранён")} onTemplate={() => patchDay({ fromTemplate: true }, "Колода собрана из шаблона")} /> : null}
                                            {n === 2 ? <DeckPanel day={day} dayId={day.id} checks={stage.checks} busy={busy} onSaveCards={(cards) => patchDay({ cards }, "Колода сохранена")} onTemplate={() => patchDay({ fromTemplate: true }, "Колода собрана из шаблона")} /> : null}
                                            {n === 3 ? <SectionPanel day={day} checks={stage.checks} suggestedSectionId={suggestedSectionId} busy={busy} onPublish={publish} /> : null}
                                            {n === 4 ? <SessionPanel day={day} origin={origin} busy={busy} now={now} onCreate={createSession} /> : null}
                                            {n === 5 ? <MailingPanel day={day} origin={origin} busy={busy} onToggleMailed={(mailed) => patchDay({ mailed }, mailed ? "Отмечено: разослано" : "Отметка снята")} /> : null}
                                            {n === 6 ? (
                                                <div className="space-y-3">
                                                    <LiveDayPanel day={day} live={live} origin={origin} busy={busy} onRefresh={refreshLive} />
                                                    <TablesSitePanel day={day} loadPrompt={loadPrompt} />
                                                </div>
                                            ) : null}
                                            {n === 7 ? <ExportPanel day={day} live={live} origin={origin} busy={busy} onSnapshot={snapshot} onSaveNote={saveNote} /> : null}
                                            {n === 8 ? <FinishPanel day={day} busy={busy} onComplete={complete} /> : null}
                                            {n === 9 ? <TracksPanel day={day} busy={busy} onToggle={toggleTrack} /> : null}
                                        </StageBox>
                                    );
                                })}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
