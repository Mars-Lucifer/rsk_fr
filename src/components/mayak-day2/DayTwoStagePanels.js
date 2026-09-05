"use client";

// День 2, админка: содержимое девяти этапов. Страница /admin/mayak-day2
// держит состояние и вызывает API, панели только показывают и отдают
// намерения через колбэки. Импорты — только чистая модель (без fs).

import { useEffect, useMemo, useState } from "react";
import {
    DAY_TWO_KIND_NAMES,
    DAY_TWO_TRACKS,
    DEFAULT_PARTICIPANT_LIMIT,
    DEFAULT_TABLE_COUNT,
    TRACK_MARKS,
    countTaskWords,
    formatMsk,
    sessionEarliestAt,
    trackDates,
} from "@/lib/mayakDayTwoModel";

export const ui = {
    input: "!w-full !rounded-[0.95rem] !border-2 !border-stone-700/80 !bg-white !px-4 !py-3 !text-sm !text-(--color-black) !shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] outline-none transition placeholder:!text-[#94a3b8] focus:!border-black",
    primary: "!inline-flex !w-auto !items-center !justify-center !rounded-[1rem] !border-0 !bg-[linear-gradient(135deg,#0f766e_0%,#115e59_100%)] !px-4 !py-3 !text-sm !font-bold !text-white shadow-[0_12px_24px_rgba(15,118,110,0.18)] transition hover:-translate-y-px disabled:!cursor-not-allowed disabled:!opacity-40 disabled:hover:translate-y-0",
    secondary: "!inline-flex !w-auto !items-center !justify-center !rounded-[1rem] !border !border-(--color-gray-plus-50) !bg-white !px-4 !py-3 !text-sm !font-semibold !text-(--color-black) transition hover:!border-(--color-main) hover:!text-(--color-main) disabled:!cursor-not-allowed disabled:!opacity-40",
    small: "!inline-flex !w-auto !items-center !justify-center !rounded-[0.75rem] !border !border-(--color-gray-plus-50) !bg-white !px-3 !py-1.5 !text-xs !font-semibold !text-(--color-black) transition hover:!border-(--color-main) hover:!text-(--color-main) disabled:!cursor-not-allowed disabled:!opacity-40",
    label: "text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]",
    hint: "text-sm leading-6 text-[#64748b]",
    ok: "rounded-[1rem] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm font-medium text-[#166534]",
    warn: "rounded-[1rem] border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm font-medium text-[#92400e]",
    bad: "rounded-[1rem] border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm font-medium text-[#b91c1c]",
};

const STATUS_LABELS = { pending: "на проверке", approved: "принято", expired: "истекло — принято", rejected: "на доработку", none: "не начато", started: "в работе", pending_review: "на проверке" };
const HINT_FIELDS = [
    ["m", "М — что сделать"],
    ["a", "А — аудитория"],
    ["ya", "Я — роль"],
    ["k", "К — как"],
    ["o1", "О — объём"],
    ["k2", "К — контекст"],
    ["o2", "О — формат"],
];

function Field({ label, children, className = "" }) {
    return (
        <label className={`block rounded-[0.95rem] border-2 border-stone-300 bg-white px-3 py-2 ${className}`.trim()}>
            <div className={ui.label}>{label}</div>
            <div className="mt-2">{children}</div>
        </label>
    );
}

function statusLabel(status) {
    return STATUS_LABELS[status] || status || "";
}

function statusClass(status) {
    if (status === "approved" || status === "expired") return "border-l-4 border-l-[#7AB929]";
    if (status === "pending" || status === "pending_review") return "border-l-4 border-l-[#f2c777]";
    if (status === "rejected") return "border-l-4 border-l-[#D9412B]";
    return "border-l-4 border-l-[#e5e7eb]";
}

export function sessionLinks(session, origin = "") {
    if (!session) return null;
    return {
        participant: session.tokenValue ? `${origin}/tools/mayak-oko?token=${session.tokenValue}aaaaa` : "",
        master: session.masterSecret ? `${origin}/mayak-master/${session.masterSecret}` : "",
        dashboard: session.dashboardSecret ? `${origin}/mayak-dashboard/${session.dashboardSecret}` : "",
    };
}

export function CopyButton({ text, label = "Скопировать" }) {
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied) return undefined;
        const timeoutId = window.setTimeout(() => setCopied(false), 1600);
        return () => window.clearTimeout(timeoutId);
    }, [copied]);
    return (
        <button
            type="button"
            className={ui.small}
            disabled={!text}
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                } catch {
                    window.prompt("Скопируйте ссылку", text);
                }
            }}>
            {copied ? "Скопировано" : label}
        </button>
    );
}

function LinkRow({ title, href, extra = null, big = false }) {
    return (
        <div className="rounded-[1rem] border border-(--color-gray-plus-50) bg-white p-3">
            <div className={ui.label}>{title}</div>
            <div className={`mt-2 break-all font-mono ${big ? "text-base font-semibold" : "text-xs"} text-(--color-black)`}>{href || "—"}</div>
            <div className="mt-2 flex flex-wrap gap-2">
                <CopyButton text={href} />
                {href ? (
                    <a href={href} target="_blank" rel="noreferrer" className={ui.small}>
                        Открыть
                    </a>
                ) : null}
                {extra}
            </div>
        </div>
    );
}

// ---------- 1. Бриф ----------

export function BriefPanel({ day, problems, onSave, onTemplate, busy }) {
    const [draft, setDraft] = useState(() => briefDraft(day));
    useEffect(() => {
        setDraft(briefDraft(day));
    }, [day?.id, day?.updatedAt]);

    const setTable = (index, key, value) =>
        setDraft((current) => ({ ...current, tables: current.tables.map((table, i) => (i === index ? { ...table, [key]: value } : table)) }));

    return (
        <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
                <Field label="Организация">
                    <input className={ui.input} value={draft.org} onChange={(e) => setDraft({ ...draft, org: e.target.value })} placeholder="Профсоюз образования" />
                </Field>
                <Field label="Дата дня (обязательна)">
                    <input type="date" className={ui.input} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                </Field>
                <Field label="Папка столов (ссылка 1 на всех карточках, чек-лист дня)">
                    <input className={ui.input} value={draft.folder_url} onChange={(e) => setDraft({ ...draft, folder_url: e.target.value })} placeholder="http://ctr5.ru/1109/" />
                </Field>
                <Field label="Логотип">
                    <input className={ui.input} value={draft.logo} onChange={(e) => setDraft({ ...draft, logo: e.target.value })} placeholder="http://ctr5.ru/media/logo.png" />
                </Field>
            </div>
            <div className="space-y-2">
                {draft.tables.map((table, index) => (
                    <div key={table.n} className="rounded-[1rem] border border-(--color-gray-plus-50) bg-[#f8fafc] p-3">
                        <div className="text-sm font-black text-(--color-black)">Стол {table.n}</div>
                        <div className="mt-2 grid gap-2 md:grid-cols-5">
                            <Field label="Продукт">
                                <input className={ui.input} value={table.product} onChange={(e) => setTable(index, "product", e.target.value)} />
                            </Field>
                            <Field label="Кому">
                                <input className={ui.input} value={table.user} onChange={(e) => setTable(index, "user", e.target.value)} />
                            </Field>
                            <Field label="Боль">
                                <input className={ui.input} value={table.pain} onChange={(e) => setTable(index, "pain", e.target.value)} />
                            </Field>
                            <Field label="Через полгода">
                                <input className={ui.input} value={table.after6m} onChange={(e) => setTable(index, "after6m", e.target.value)} />
                            </Field>
                            <Field label="Адрес продукта">
                                <input className={ui.input} value={table.url} onChange={(e) => setTable(index, "url", e.target.value)} placeholder="http://ctr5.ru/1109/1/" />
                            </Field>
                        </div>
                    </div>
                ))}
            </div>
            {problems.length ? <div className={ui.warn}>Не хватает: {problems.join("; ")}</div> : <div className={ui.ok}>Бриф заполнен</div>}
            <div className="flex flex-wrap gap-2">
                <button type="button" className={ui.primary} disabled={busy} onClick={() => onSave(draft)}>
                    Сохранить бриф
                </button>
                <button type="button" className={ui.secondary} disabled={busy || (day?.cards || []).length > 0} onClick={onTemplate}>
                    {(day?.cards || []).length > 0 ? `Колода собрана: ${day.cards.length} карточек` : "Собрать день из шаблона"}
                </button>
            </div>
        </div>
    );
}

function briefDraft(day) {
    const tables = Array.isArray(day?.tables) && day.tables.length ? day.tables : [1, 2, 3].map((n) => ({ n }));
    return {
        org: day?.org || "",
        date: day?.date || "",
        folder_url: day?.folder_url || "",
        logo: day?.logo || "",
        tables: tables.map((table, i) => ({ n: table.n || i + 1, product: table.product || "", user: table.user || "", pain: table.pain || "", after6m: table.after6m || "", url: table.url || "" })),
    };
}

// ---------- 2. Колода ----------

function CardEditor({ card, onSave, onClose, busy }) {
    const [draft, setDraft] = useState(() => ({ ...card, hint: { ...(card.hint || {}) }, tool: { ...(card.tool || { name: "", url: "" }) } }));
    const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
    const words = countTaskWords(draft.task);
    return (
        <div className="rounded-[1rem] border-2 border-stone-300 bg-[#f8fafc] p-3">
            <div className="grid gap-2 md:grid-cols-4">
                <Field label="Заголовок" className="md:col-span-2">
                    <input className={ui.input} value={draft.title} onChange={(e) => set("title", e.target.value)} />
                </Field>
                <Field label="Пилюля">
                    <input className={ui.input} value={draft.pill} onChange={(e) => set("pill", e.target.value)} />
                </Field>
                <Field label="Минуты">
                    <input type="number" min="0" className={ui.input} value={draft.mins} onChange={(e) => set("mins", Number(e.target.value || 0))} />
                </Field>
                <Field label="Зачем (одна строка)" className="md:col-span-4">
                    <input className={ui.input} value={draft.why} onChange={(e) => set("why", e.target.value)} />
                </Field>
                <Field label={`Задание · ${words} слов${words > 10 ? " — больше десяти" : ""}`} className="md:col-span-4">
                    <input className={`${ui.input} ${words > 10 ? "!border-[#dc2626]" : ""}`} value={draft.task} onChange={(e) => set("task", e.target.value)} />
                </Field>
                <Field label="Сдать" className="md:col-span-2">
                    <input className={ui.input} value={draft.submit} onChange={(e) => set("submit", e.target.value)} />
                </Field>
                <Field label="Готово, когда" className="md:col-span-2">
                    <input className={ui.input} value={draft.done} onChange={(e) => set("done", e.target.value)} />
                </Field>
                {HINT_FIELDS.map(([key, label]) => (
                    <Field key={key} label={label}>
                        <input className={ui.input} value={draft.hint?.[key] || ""} onChange={(e) => set("hint", { ...(draft.hint || {}), [key]: e.target.value })} />
                    </Field>
                ))}
                <Field label="Заметки (после подсказки, для инспектора)" className="md:col-span-4">
                    <textarea className={`${ui.input} min-h-[70px] resize-y`} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
                </Field>
                <Field label="Инструмент — название">
                    <input className={ui.input} value={draft.tool?.name || ""} onChange={(e) => set("tool", { ...(draft.tool || {}), name: e.target.value })} />
                </Field>
                <Field label="Инструмент — ссылка" className="md:col-span-2">
                    <input className={ui.input} value={draft.tool?.url || ""} onChange={(e) => set("tool", { ...(draft.tool || {}), url: e.target.value })} />
                </Field>
                <Field label="Файл (имя в Files/)">
                    <input className={ui.input} value={draft.file} onChange={(e) => set("file", e.target.value)} placeholder="8119.docx" />
                </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={ui.primary} disabled={busy} onClick={() => onSave(draft)}>
                    Сохранить карточку
                </button>
                <button type="button" className={ui.secondary} onClick={onClose}>
                    Закрыть
                </button>
            </div>
        </div>
    );
}

export function DeckPanel({ day, dayId, checks, onSaveCards, onTemplate, busy }) {
    const [openNum, setOpenNum] = useState(null);
    const [previewNum, setPreviewNum] = useState(null);
    const [jsonOpen, setJsonOpen] = useState(false);
    const [jsonText, setJsonText] = useState("");
    const [jsonError, setJsonError] = useState("");
    const cards = Array.isArray(day?.cards) ? day.cards : [];

    const saveCard = (next) => {
        const normalized = { ...next, tool: next.tool?.name || next.tool?.url ? next.tool : null };
        onSaveCards(cards.map((card) => (card.num === next.num ? normalized : card)));
        setOpenNum(null);
    };

    const loadJson = () => {
        try {
            const parsed = JSON.parse(jsonText);
            const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.cards) ? parsed.cards : null;
            if (!list || !list.length) throw new Error("Ожидается массив карточек или объект дня с полем cards");
            setJsonError("");
            onSaveCards(list);
            setJsonOpen(false);
            setJsonText("");
        } catch (error) {
            setJsonError(error instanceof Error ? error.message : "JSON не разобран");
        }
    };

    return (
        <div className="space-y-3">
            {cards.length === 0 ? (
                <div className={ui.warn}>
                    Колода пуста.{" "}
                    <button type="button" className={`${ui.small} ml-2`} disabled={busy} onClick={onTemplate}>
                        Собрать день из шаблона
                    </button>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-[1rem] border border-(--color-gray-plus-50)">
                    <table className="w-full text-sm">
                        <thead className="bg-[#f8fafc] text-left text-xs uppercase tracking-[0.1em] text-[#64748b]">
                            <tr>
                                <th className="px-3 py-2">№</th>
                                <th className="px-3 py-2">Вид</th>
                                <th className="px-3 py-2">Заголовок</th>
                                <th className="px-3 py-2">Задание</th>
                                <th className="px-3 py-2">Слов</th>
                                <th className="px-3 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {cards.map((card) => {
                                const words = countTaskWords(card.task);
                                const tooLong = words > 10 && card.kind !== "intro";
                                return (
                                    <tr key={card.num} className="border-t border-(--color-gray-plus-50) align-top">
                                        <td className="px-3 py-2 font-mono">{card.num}</td>
                                        <td className="px-3 py-2">
                                            {DAY_TWO_KIND_NAMES[card.kind] || card.kind}
                                            {card.hexes?.length ? <span className="ml-1 text-xs text-[#64748b]">{card.hexes.join("+")}</span> : null}
                                        </td>
                                        <td className="px-3 py-2 font-semibold">{card.title}</td>
                                        <td className="px-3 py-2">{card.task}</td>
                                        <td className={`px-3 py-2 font-mono ${tooLong ? "font-bold text-[#dc2626]" : ""}`}>{words}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <button type="button" className={ui.small} onClick={() => setOpenNum(openNum === card.num ? null : card.num)}>
                                                Открыть
                                            </button>{" "}
                                            <button type="button" className={ui.small} onClick={() => setPreviewNum(previewNum === card.num ? null : card.num)}>
                                                Карта
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {openNum ? <CardEditor key={openNum} card={cards.find((card) => card.num === openNum)} onSave={saveCard} onClose={() => setOpenNum(null)} busy={busy} /> : null}
            {previewNum ? (
                <div className="rounded-[1rem] border border-(--color-gray-plus-50) bg-white p-3">
                    <div className="flex items-center justify-between">
                        <div className={ui.label}>Карта карточки {previewNum}</div>
                        <button type="button" className={ui.small} onClick={() => setPreviewNum(null)}>
                            Закрыть
                        </button>
                    </div>
                    <img alt={`Карта ${previewNum}`} src={`/api/admin/mayak-day2/${dayId}/card?number=${previewNum}&t=${encodeURIComponent(day?.updatedAt || "")}`} className="mx-auto mt-3 max-h-[720px] rounded-[0.75rem] border border-(--color-gray-plus-50)" />
                </div>
            ) : null}
            {checks.ok ? <div className={ui.ok}>Всё в порядке: {cards.length} карточек, состав 3·1·6·3·1·1·1</div> : (
                <div className={ui.bad}>
                    <div className="font-bold">Проблемы колоды</div>
                    <ul className="mt-1 list-disc pl-5">
                        {checks.problems.map((problem) => (
                            <li key={problem}>{problem}</li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="flex flex-wrap gap-2">
                <button type="button" className={ui.secondary} onClick={() => setJsonOpen((value) => !value)}>
                    Загрузить JSON
                </button>
            </div>
            {jsonOpen ? (
                <div className="space-y-2">
                    <div className={ui.hint}>Вставьте JSON дня (mayak-day2/1) или массив карточек — он заменит колоду. Проверки покажут проблемы, править можно здесь же.</div>
                    <textarea className={`${ui.input} min-h-[200px] resize-y font-mono !text-xs`} value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder='{"schema": "mayak-day2/1", "cards": [ ... ]}' />
                    {jsonError ? <div className={ui.bad}>{jsonError}</div> : null}
                    <button type="button" className={ui.primary} disabled={busy || !jsonText.trim()} onClick={loadJson}>
                        Заменить колоду
                    </button>
                </div>
            ) : null}
        </div>
    );
}

// ---------- 3. Раздел ----------

export function SectionPanel({ day, checks, suggestedSectionId, onPublish, busy }) {
    const [sectionId, setSectionId] = useState(day?.sectionId || suggestedSectionId || "");
    useEffect(() => {
        setSectionId(day?.sectionId || suggestedSectionId || "");
    }, [day?.sectionId, suggestedSectionId]);
    const published = day?.published;
    const stale = published && day?.cardsUpdatedAt && String(day.cardsUpdatedAt) > String(published.at);
    const locked = Boolean(day?.session?.id);
    return (
        <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <Field label="Раздел (диапазон номеров карточек)">
                    <input className={ui.input} value={sectionId} disabled={locked} onChange={(e) => setSectionId(e.target.value)} placeholder="8201-8300" />
                </Field>
                <button type="button" className={ui.primary} disabled={busy || !checks.ok || !sectionId.trim()} onClick={() => onPublish(sectionId.trim())}>
                    {published ? "Записать раздел заново" : "Записать раздел"}
                </button>
            </div>
            <div className={ui.hint}>
                По умолчанию — первый свободный диапазон в сотне категории. Карточки получат номера раздела по порядку, карты нарисуются на сервере в SVG.
                {locked ? " Сессия уже создана — раздел менять нельзя." : ""}
            </div>
            {!checks.ok ? <div className={ui.warn}>Запись недоступна: колода не прошла проверки (этап 2).</div> : null}
            {published ? (
                <div className={stale ? ui.warn : ui.ok}>
                    Записано {formatMsk(Date.parse(published.at))} (МСК): {published.cardCount} карточек в разделе {published.sectionId}.{" "}
                    <a className="underline" href={`/api/mayak/content-bundle?sectionId=${encodeURIComponent(published.sectionId)}`} target="_blank" rel="noreferrer">
                        content-bundle
                    </a>
                    {stale ? " — колода менялась после записи, запишите заново." : ""}
                </div>
            ) : null}
        </div>
    );
}

// ---------- 4. Сессия ----------

export function SessionPanel({ day, origin, onCreate, busy, now }) {
    const [tableCount, setTableCount] = useState(DEFAULT_TABLE_COUNT);
    const [participantLimit, setParticipantLimit] = useState(DEFAULT_PARTICIPANT_LIMIT);
    const session = day?.session;
    const publishedFresh = Boolean(day?.published?.sectionId) && day.published.sectionId === day.sectionId && !(day?.cardsUpdatedAt && String(day.cardsUpdatedAt) > String(day.published.at));
    const earliest = sessionEarliestAt(day?.date);
    const tooEarly = Number.isFinite(earliest) && now < earliest;
    const links = sessionLinks(session, origin);

    if (session?.id) {
        const expired = session.expiresAt && Date.parse(session.expiresAt) < now;
        return (
            <div className="space-y-3">
                <div className={expired ? ui.warn : ui.ok}>
                    Сессия «{session.name}» создана {formatMsk(Date.parse(session.createdAt))}, {expired ? "истекла" : "истекает"} {formatMsk(Date.parse(session.expiresAt))} (МСК) · столов {session.tableCount} · участников до {session.participantLimit} · таймеры 15/20 мин
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                    <LinkRow title="Участник" href={links.participant} />
                    <LinkRow title="Мастер" href={links.master} />
                    <LinkRow title="Дашборд" href={links.dashboard} />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <Field label="Столов">
                    <input type="number" min="1" max="6" className={ui.input} value={tableCount} onChange={(e) => setTableCount(Number(e.target.value || 0))} />
                </Field>
                <Field label="Участников (с запасом)">
                    <input type="number" min="1" max="200" className={ui.input} value={participantLimit} onChange={(e) => setParticipantLimit(Number(e.target.value || 0))} />
                </Field>
                <button type="button" className={ui.primary} disabled={busy || !publishedFresh || tooEarly} onClick={() => onCreate({ tableCount, participantLimit })}>
                    Создать сессию
                </button>
            </div>
            {!publishedFresh ? <div className={ui.warn}>Сначала запишите раздел (этап 3).</div> : null}
            {Number.isFinite(earliest) ? (
                <div className={tooEarly ? ui.warn : ui.hint}>
                    Сессия живёт 48 часов и должна дожить до 20:00 дня. {tooEarly ? `Можно создавать с ${formatMsk(earliest)} (МСК).` : `Создавать можно с ${formatMsk(earliest)} (МСК) — время подошло.`}
                </div>
            ) : (
                <div className={ui.warn}>В брифе нет даты — от неё считается, когда можно создавать сессию.</div>
            )}
        </div>
    );
}

// ---------- 5. Рассылка ----------

export function MailingPanel({ day, origin, onToggleMailed, busy }) {
    const links = sessionLinks(day?.session, origin);
    if (!links) return <div className={ui.warn}>Сессия ещё не создана (этап 4).</div>;
    return (
        <div className="space-y-3">
            <LinkRow title="Ссылка участника — разослать в чат столов" href={links.participant} big />
            <div className="grid gap-3 md:grid-cols-2">
                <LinkRow
                    title="Дашборд"
                    href={links.dashboard}
                    extra={
                        <a href={links.dashboard} target="_blank" rel="noreferrer" className={ui.small}>
                            Открыть на проекторе
                        </a>
                    }
                />
                <LinkRow title="Чек-лист дня (папка столов)" href={day?.folder_url || ""} />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-(--color-black)">
                <input type="checkbox" checked={Boolean(day?.mailed)} disabled={busy} onChange={(e) => onToggleMailed(e.target.checked)} />
                <span>Разослано: ссылка участника ушла, дашборд открыт</span>
            </label>
        </div>
    );
}

// ---------- 6. День ----------

function HexBadge({ hex }) {
    const status = hex?.status || "none";
    const color = status === "approved" ? "bg-[#dcfce7] border-[#7AB929]" : status === "pending_review" ? "bg-[#fef3c7] border-[#f2c777]" : status === "rejected" ? "bg-[#fee2e2] border-[#D9412B]" : status === "started" ? "bg-[#e0f2fe] border-[#6EC1E4]" : "bg-white border-[#e5e7eb]";
    return (
        <div className={`rounded-[0.75rem] border-2 px-2 py-1 text-xs ${color}`} title={statusLabel(status)}>
            <span className="font-bold">{hex.hex}</span> {hex.label}
            {hex.owner ? <span className="text-[#64748b]"> · {hex.owner}</span> : null}
        </div>
    );
}

export function LiveDayPanel({ day, live, origin, onRefresh, busy }) {
    const links = sessionLinks(day?.session, origin);
    const tables = live?.tables || [];
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                {links?.dashboard ? (
                    <a href={links.dashboard} target="_blank" rel="noreferrer" className={ui.secondary}>
                        Дашборд мастера
                    </a>
                ) : null}
                <button type="button" className={ui.primary} disabled={busy || !day?.session?.id} onClick={onRefresh}>
                    Обновить
                </button>
                {live?.at ? <span className={ui.hint}>Обновлено {formatMsk(Date.parse(live.at))} · участников {live.participants} · заявок {live.reviews}, принято {live.accepted}</span> : null}
            </div>
            {!day?.session?.id ? <div className={ui.warn}>Сессия ещё не создана.</div> : null}
            {tables.length ? (
                <div className="grid gap-3 md:grid-cols-3">
                    {tables.map((table) => (
                        <div key={table.table} className="rounded-[1rem] border border-(--color-gray-plus-50) bg-white p-3">
                            <div className="text-sm font-black text-(--color-black)">Стол {table.table}</div>
                            <div className={ui.hint}>{table.members.map((m) => `${m.name}${m.role ? ` (${m.role})` : ""}`).join(" · ") || "никто не вошёл"}</div>
                            {table.state ? (
                                <>
                                    <div className="mt-2 space-y-1">
                                        {table.state.hexes.map((hex) => (
                                            <HexBadge key={hex.hex} hex={hex} />
                                        ))}
                                    </div>
                                    <div className="mt-2 space-y-1 text-xs">
                                        {table.state.pairs.map((pair) => (
                                            <div key={pair.n} className="flex justify-between rounded-[0.5rem] bg-[#f8fafc] px-2 py-1">
                                                <span>
                                                    Узел {pair.hexes.join("+")} · детали {pair.detailsDone}/2
                                                </span>
                                                <span className="font-semibold">{statusLabel(pair.status)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                                        {["point0", "assembly", "acceptance", "roadmap"].map((kind) => {
                                            const item = table[kind];
                                            return (
                                                <div key={kind} className="rounded-[0.5rem] bg-[#f8fafc] px-2 py-1">
                                                    {DAY_TWO_KIND_NAMES[kind]}: <span className="font-semibold">{item ? statusLabel(item.status) : "не сдано"}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className={`mt-2 ${ui.hint}`}>Состояние появится, когда за стол войдёт первый участник.</div>
                            )}
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

// ---------- 7. Выгрузка ----------

function ReviewItem({ item }) {
    return (
        <div className={`rounded-[0.75rem] border border-(--color-gray-plus-50) bg-white px-3 py-2 ${statusClass(item.status)}`}>
            <div className="text-xs text-[#64748b]">
                <b>{item.kindName}</b> · карточка {item.taskNumber} · {item.participantName} · {String(item.resolvedAt || item.createdAt || "").slice(0, 16).replace("T", " ")} · <i>{statusLabel(item.status)}</i>
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm">{item.text || <span className="text-[#94a3b8]">без текста</span>}</div>
            {item.file ? (
                <div className="mt-1 text-xs">
                    Файл:{" "}
                    <a className="underline" href={item.file.url} target="_blank" rel="noreferrer">
                        {item.file.name}
                    </a>{" "}
                    ·{" "}
                    <a className="underline" href={item.file.downloadUrl}>
                        скачать
                    </a>
                </div>
            ) : null}
        </div>
    );
}

function NoteEditor({ label, value, onSave, busy }) {
    const [draft, setDraft] = useState(value || "");
    useEffect(() => {
        setDraft(value || "");
    }, [value]);
    return (
        <Field label={label}>
            <textarea className={`${ui.input} min-h-[90px] resize-y`} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="mt-2">
                <button type="button" className={ui.small} disabled={busy || draft === (value || "")} onClick={() => onSave(draft)}>
                    Сохранить правку
                </button>
            </div>
        </Field>
    );
}

export function ExportPanel({ day, live, onSnapshot, onSaveNote, busy }) {
    const snapshot = day?.results;
    const data = snapshot || live;
    const notes = day?.notes || {};
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={ui.primary} disabled={busy || !day?.session?.id} onClick={onSnapshot}>
                    {snapshot ? "Обновить снимок результатов" : "Сделать снимок результатов"}
                </button>
                {snapshot ? <span className={ui.ok}>Снимок от {formatMsk(Date.parse(snapshot.at))} (МСК) хранится в дне и переживёт удаление сессии</span> : <span className={ui.warn}>Снимка нет: платформа удалит результаты при завершении сессии и через 48 часов</span>}
            </div>
            {!data ? <div className={ui.hint}>Нажмите «Обновить» на этапе 6 или сделайте снимок — здесь появятся результаты по столам.</div> : null}
            {(data?.tables || []).map((table) => (
                <div key={table.table} className="rounded-[1rem] border border-(--color-gray-plus-50) bg-[#f8fafc] p-3">
                    <div className="text-base font-black text-(--color-black)">
                        Стол {table.table} <span className="text-sm font-medium text-[#64748b]">· {table.members.map((m) => m.name).join(", ") || "без участников"}</span>
                    </div>
                    <div className="mt-2 grid gap-3 lg:grid-cols-2">
                        <div className="space-y-2">
                            <div className={ui.label}>Точка 0</div>
                            {table.point0 ? <ReviewItem item={table.point0} /> : <div className={ui.hint}>не сдана</div>}
                            <NoteEditor label="Точка 0 — правка копии" value={notes[String(table.table)]?.point0 || table.point0?.text || ""} busy={busy} onSave={(text) => onSaveNote(table.table, "point0", text)} />
                        </div>
                        <div className="space-y-2">
                            <div className={ui.label}>Дорожная карта</div>
                            {table.roadmap ? <ReviewItem item={table.roadmap} /> : <div className={ui.hint}>не сдана</div>}
                            <NoteEditor label="Дорожная карта — правка копии" value={notes[String(table.table)]?.roadmap || table.roadmap?.text || ""} busy={busy} onSave={(text) => onSaveNote(table.table, "roadmap", text)} />
                        </div>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <div className="space-y-2">
                            <div className={ui.label}>Детали</div>
                            {table.details.length ? table.details.map((item) => <ReviewItem key={item.id} item={item} />) : <div className={ui.hint}>нет</div>}
                        </div>
                        <div className="space-y-2">
                            <div className={ui.label}>Узлы</div>
                            {table.nodes.length ? table.nodes.map((item) => <ReviewItem key={item.id} item={item} />) : <div className={ui.hint}>нет</div>}
                            <div className={ui.label}>Сборка</div>
                            {table.assembly ? <ReviewItem item={table.assembly} /> : <div className={ui.hint}>нет</div>}
                            <div className={ui.label}>Приёмка</div>
                            {table.acceptance ? <ReviewItem item={table.acceptance} /> : <div className={ui.hint}>нет</div>}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ---------- 8. Завершение ----------

export function FinishPanel({ day, onComplete, busy }) {
    if (!day?.results?.at) return <div className={ui.warn}>Кнопка появится после снимка результатов (этап 7) — иначе завершение стёрло бы итоги.</div>;
    if (day.completed) return <div className={ui.ok}>Сессия отмечена завершённой. В платформе завершите её в консоли мастера или дайте сроку истечь.</div>;
    return (
        <div className="space-y-3">
            <div className={ui.hint}>Отметка ставится только в дне: саму сессию платформа не завершает. Завершите её в консоли мастера или дайте 48-часовому сроку истечь — снимок результатов уже сохранён.</div>
            <button type="button" className={ui.primary} disabled={busy} onClick={onComplete}>
                Сессия завершена
            </button>
        </div>
    );
}

// ---------- 9. Треки ----------

export function TracksPanel({ day, onToggle, busy }) {
    const dates = useMemo(() => trackDates(day?.date), [day?.date]);
    const tables = Array.isArray(day?.tables) ? day.tables : [];
    const tracks = day?.tracks || {};
    return (
        <div className="space-y-3">
            <div className={ui.hint}>Клик по клетке: пусто → ✓ сделано → ~ частично → × нет. Даты — от даты дня.</div>
            <div className="overflow-x-auto rounded-[1rem] border border-(--color-gray-plus-50)">
                <table className="w-full text-sm">
                    <thead className="bg-[#f8fafc] text-left text-xs uppercase tracking-[0.1em] text-[#64748b]">
                        <tr>
                            <th className="px-3 py-2">Стол</th>
                            {dates.map((track) => (
                                <th key={track.key} className="px-3 py-2 text-center">
                                    {track.label}
                                    <div className="font-mono text-[10px] normal-case tracking-normal">{track.short}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tables.map((table) => (
                            <tr key={table.n} className="border-t border-(--color-gray-plus-50)">
                                <td className="px-3 py-2 font-semibold">
                                    {table.n} · {table.product || "—"}
                                </td>
                                {DAY_TWO_TRACKS.map((track, i) => {
                                    const mark = tracks[String(table.n)]?.[i] || "";
                                    const color = mark === "✓" ? "bg-[#dcfce7]" : mark === "~" ? "bg-[#fef3c7]" : mark === "×" ? "bg-[#fee2e2]" : "bg-white";
                                    return (
                                        <td key={track.key} className="px-2 py-1 text-center">
                                            <button type="button" disabled={busy} className={`h-10 w-12 rounded-[0.6rem] border border-(--color-gray-plus-50) text-lg font-bold ${color}`} onClick={() => onToggle(table.n, i, TRACK_MARKS[(TRACK_MARKS.indexOf(mark) + 1) % TRACK_MARKS.length])}>
                                                {mark || "·"}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
