import { memo, useMemo } from "react";
import Button from "@/components/ui/Button";
import { resolveDirectionKey, isStartType } from "@/lib/mayakProgressModel";

// День 2 (стратегическая сессия): блок «Стол» в тренажёре.
//
// Показывает шесть гексов стола, три пары-узла, точку 0 стола и — главное —
// строку «Следующий шаг», которая ведёт участника по порядку дня:
// intro → point0 → pitch → detail → node → pitch → assembly → acceptance → pitch → roadmap.
// Состояние стола приходит с /api/mayak/session-runtime/table (гексы и пары —
// по всему столу), собственные статусы карточек — из taskStates участника.
// Рендерится только за флагом isDayTwo в trainer.js.

const HEX_COLORS = {
    11: "#F2A900",
    12: "#D9412B",
    13: "#1F6FD0",
    14: "#1B4F9C",
    15: "#6EC1E4",
    16: "#7AB929",
};

const HEX_SHORT = {
    11: "Знания",
    12: "Внешние",
    13: "Данные",
    14: "Автомат.",
    15: "Экраны",
    16: "Доступы",
};

const HEX_BY_DIRECTION = {
    KNOWLEDGE: 11,
    INTERACTION: 12,
    DATA: 13,
    AUTOMATION: 14,
    ENVIRONMENT: 15,
    PROTECTION: 16,
};

const PAIR_NAMES = {
    1: "Как пользуются",
    2: "Как считает",
    3: "Как выглядит и кому видно",
};

const STATUS_WORDS = {
    none: "не начато",
    started: "в работе",
    pending_review: "у инспектора",
    approved: "принято",
    rejected: "на доработку",
};

const STATUS_BG = {
    none: "bg-white",
    started: "bg-slate-50",
    pending_review: "bg-orange-50",
    approved: "bg-emerald-50",
    rejected: "bg-red-50",
};

// Статус задания участника → статус дня 2 (как taskStatusOf на сервере).
function normalizeStatus(status) {
    const s = String(status || "");
    if (s === "approved" || s === "expired" || s === "rework_expired") return "approved";
    if (s === "pending_review" || s === "rejected") return s;
    if (!s) return "none";
    return "started";
}

// Вид карты: day2-поле генератора, иначе — по contentType (как describeDayTwoCard).
function describeCard(card, index) {
    const meta = card?.day2 && typeof card.day2 === "object" ? card.day2 : null;
    if (meta?.kind) {
        return { kind: String(meta.kind), hexes: Array.isArray(meta.hexes) ? meta.hexes.map(Number).filter(Boolean) : [] };
    }
    const ct = card?.contentType || "";
    // Позиция внутри колоды, а не в общем массиве тренажёра: там перед колодой
    // лежат пустые заглушки с индексами 0..N, и «первые три» считались бы от них.
    const positionInDeck = Number.isFinite(Number(card?._sectionStart)) ? index - (Number(card._sectionStart) - 1) : index;
    if (positionInDeck < 3) return { kind: "intro", hexes: [] };
    if (isStartType(ct)) return { kind: "point0", hexes: [] };
    const dirKey = resolveDirectionKey(ct);
    if (dirKey && HEX_BY_DIRECTION[dirKey]) return { kind: "detail", hexes: [HEX_BY_DIRECTION[dirKey]] };
    return { kind: "other", hexes: [] };
}

function listHexes(hexes) {
    return hexes.length > 1 ? `детали ${hexes.join(" и ")}` : `деталь ${hexes[0]}`;
}

// Текст состояния пары под гексами.
function describePair(pair, hexByNumber) {
    if (pair.status === "approved") return "принят";
    if (pair.status === "pending_review") return "у инспектора";
    if (pair.status === "rejected") return "на доработку";
    const waiting = pair.hexes.filter((h) => hexByNumber.get(h)?.status !== "approved");
    if (waiting.length > 0) return `ждёт ${listHexes(waiting)}`;
    if (pair.status === "started") return "соединяют";
    return "детали готовы — соединяйте";
}

// «Следующий шаг»: идём по порядку дня и останавливаемся на первом незакрытом.
// Табличные вещи (точка 0, гексы, пары) — по состоянию стола, личные
// (вводные, питчи, сборка, приёмка, карта) — по собственным статусам карточек.
function computeNextStep({ cards, myStatusByIndex, hexByNumber, pairs, point0, myHexes, tableCards }) {
    // Карты стола (точка 0, сборка, приёмка, дорожная карта) сдаёт один за всех:
    // их статус — по столу, личные карты — по своим статусам.
    const TABLE_KINDS = new Set(["point0", "assembly", "acceptance", "roadmap"]);
    const my = (c) => {
        if (TABLE_KINDS.has(c.kind) && tableCards && tableCards[c.number]) return tableCards[c.number];
        return myStatusByIndex.get(c.index) || "none";
    };
    const step = (text, card, hint) => ({ text, cardNumber: card ? card.number : null, hint: hint || "" });
    const byKind = (kind) => cards.filter((c) => c.kind === kind);

    // 1. Вводные карточки.
    const intro = byKind("intro").find((c) => my(c) !== "approved");
    if (intro) return step(`Вводная: карточка ${intro.number}`, intro);

    // 2. Точка 0 — одна на стол.
    const point0Card = byKind("point0")[0] || null;
    if (point0Card) {
        if (!point0) return step(`Сначала точка 0 (карточка ${point0Card.number})`, point0Card);
        if (point0.status === "rejected") return step(`Точка 0 на доработку: карточка ${point0Card.number}`, point0Card);
        if (point0.status === "pending_review" && my(point0Card) !== "approved") {
            return step("Точка 0 у инспектора — дождитесь решения", null);
        }
    }

    // 3. Питч первого экрана — первый питч до деталей.
    const pitches = byKind("pitch");
    const details = byKind("detail");
    const firstDetailIndex = details.length ? details[0].index : Infinity;
    const pitch1 = pitches.find((c) => c.index < firstDetailIndex);
    if (pitch1 && my(pitch1) !== "approved") return step(`Питч первого экрана: карточка ${pitch1.number}`, pitch1);

    // 4. Своя деталь.
    let myDetail = details.find((c) => my(c) !== "none") || null;
    if (!myDetail && myHexes.length) myDetail = details.find((c) => c.hexes.some((h) => myHexes.includes(h))) || null;
    if (!myDetail) {
        // Ещё не выбрана — предлагаем первый свободный гекс.
        const free = details.find((c) => c.hexes.every((h) => (hexByNumber.get(h)?.status || "none") === "none"));
        const target = free || details[0];
        if (target) return step(`Ваша деталь: карточка ${target.number} (гекс ${target.hexes.join("+")})`, target);
    } else {
        const s = my(myDetail);
        const hexLabel = myDetail.hexes.join("+");
        if (s === "none" || s === "started") return step(`Ваша деталь: карточка ${myDetail.number}`, myDetail);
        if (s === "rejected") return step(`Деталь ${hexLabel} на доработку: карточка ${myDetail.number}`, myDetail);
        if (s === "pending_review") {
            // Ждать у экрана не нужно: пока инспектор смотрит деталь, участник
            // открывает карточку узла своей пары и начинает соединение.
            const pair = pairs.find((p) => p.hexes.some((h) => myDetail.hexes.includes(h)));
            const nodeCard = pair && pair.cardNumber ? cards.find((c) => c.number === String(pair.cardNumber)) || null : null;
            return step(
                `Деталь ${hexLabel} у инспектора. Пока ждёте — откройте узел ${pair ? pair.n : ""}`.trim(),
                nodeCard,
                "Истекло — значит принято"
            );
        }
    }

    // 5. Узлы: свой узел, затем узлы стола.
    const ownHexes = myDetail ? myDetail.hexes : myHexes;
    const myPair = pairs.find((p) => p.hexes.some((h) => ownHexes.includes(h))) || null;
    const nodeCardOf = (p) => (p && p.cardNumber ? cards.find((c) => c.number === String(p.cardNumber)) || null : null);
    if (myPair && myPair.status !== "approved") {
        const nodeCard = nodeCardOf(myPair);
        const num = myPair.cardNumber ? ` (карточка ${myPair.cardNumber})` : "";
        if (myPair.status === "pending_review") return step(`Узел ${myPair.n} у инспектора — дождитесь решения`, null);
        if (myPair.status === "rejected") return step(`Узел ${myPair.n} на доработку${num}`, nodeCard);
        const waiting = myPair.hexes.filter((h) => hexByNumber.get(h)?.status !== "approved");
        if (waiting.length > 0) return step(`Узел ${myPair.n}: ждём ${listHexes(waiting)}`, null, `Потом — карточка ${myPair.cardNumber || "узла"}`);
        return step(`Соединяйте узел ${myPair.n}${num}`, nodeCard);
    }
    const openPairs = pairs.filter((p) => p.status !== "approved");
    if (openPairs.length > 0) {
        return step(`Ждём узлы стола: ${openPairs.map((p) => p.n).join(", ")}`, null);
    }

    // 6. Питч трёх узлов, сборка, приёмка, питч изделия, карта — по порядку колоды.
    const assembly = byKind("assembly")[0] || null;
    const pitch2 = pitches.find((c) => c.index > firstDetailIndex && (!assembly || c.index < assembly.index));
    if (pitch2 && my(pitch2) !== "approved") return step(`Питч трёх узлов: карточка ${pitch2.number}`, pitch2);
    if (assembly && my(assembly) !== "approved") {
        if (my(assembly) === "pending_review") return step("Изделие у инспектора — дождитесь решения", null);
        return step(`Сборка: карточка ${assembly.number}`, assembly);
    }
    const acceptance = byKind("acceptance")[0] || null;
    if (acceptance && my(acceptance) !== "approved") return step(`Приёмка: карточка ${acceptance.number}`, acceptance);
    const pitch3 = assembly ? pitches.find((c) => c.index > assembly.index) : null;
    if (pitch3 && my(pitch3) !== "approved") return step(`Питч изделия: карточка ${pitch3.number}`, pitch3);
    const roadmap = byKind("roadmap")[0] || null;
    if (roadmap && my(roadmap) !== "approved") return step(`Карта шести месяцев: карточка ${roadmap.number}`, roadmap);

    return step("Все карточки дня пройдены", null);
}

const DayTwoTableBoard = memo(function DayTwoTableBoard({ table, tasks, taskStates, currentTaskIndex, onOpenCard }) {
    // Пустые заглушки тренажёра (без номера) — не карточки колоды, их не считаем.
    const cards = useMemo(
        () =>
            (tasks || [])
                .map((card, index) => ({ index, number: String(card?.number ?? "").trim(), ...describeCard(card, index) }))
                .filter((c) => c.number),
        [tasks]
    );

    const myStatusByIndex = useMemo(() => {
        const map = new Map();
        (Array.isArray(taskStates) ? taskStates : []).forEach((s) => {
            const idx = Number(s?.taskIndex);
            if (Number.isFinite(idx)) map.set(idx, normalizeStatus(s?.status));
        });
        return map;
    }, [taskStates]);

    const hexes = Array.isArray(table?.hexes) ? table.hexes : [];
    const pairs = Array.isArray(table?.pairs) ? table.pairs : [];
    const members = Array.isArray(table?.members) ? table.members : [];
    const point0 = table?.point0 || null;
    const hexByNumber = useMemo(() => new Map(hexes.map((h) => [Number(h.hex), h])), [hexes]);

    // Свои гексы: детали, которые я начинал, плюс текущая карточка-деталь.
    const myHexes = useMemo(() => {
        const set = new Set();
        cards.forEach((c) => {
            if (c.kind !== "detail") return;
            if (myStatusByIndex.has(c.index) || c.index === currentTaskIndex) c.hexes.forEach((h) => set.add(h));
        });
        return Array.from(set);
    }, [cards, myStatusByIndex, currentTaskIndex]);

    const tableCards = table?.tableCards && typeof table.tableCards === "object" ? table.tableCards : null;
    const nextStep = useMemo(
        () => computeNextStep({ cards, myStatusByIndex, hexByNumber, pairs, point0, myHexes, tableCards }),
        [cards, myStatusByIndex, hexByNumber, pairs, point0, myHexes, tableCards]
    );

    const point0Card = cards.find((c) => c.kind === "point0") || null;
    const point0Lines = String(point0?.text || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 3);

    const openCard = (number) => {
        if (number && typeof onOpenCard === "function") onOpenCard(String(number));
    };

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
            {/* Следующий шаг — главная строка блока */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Следующий шаг</div>
                    <div className="text-sm font-semibold text-slate-900">{nextStep.text}</div>
                    {nextStep.hint ? <div className="text-xs text-slate-600">{nextStep.hint}</div> : null}
                </div>
                {nextStep.cardNumber ? (
                    <Button type="button" className="!w-auto !px-3 !py-1.5 !text-xs whitespace-nowrap" onClick={() => openCard(nextStep.cardNumber)}>
                        Открыть
                    </Button>
                ) : null}
            </div>

            {/* Шапка стола и участники */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h6 className="text-black !text-base leading-tight">Стол №{table?.tableNumber || "—"}</h6>
                {members.length > 0 ? (
                    <div className="text-xs text-slate-600">
                        {members.map((m) => (m.role ? `${m.name} (${m.role})` : m.name)).filter(Boolean).join(" · ")}
                    </div>
                ) : null}
            </div>

            {/* Шесть гексов */}
            <div className="grid grid-cols-3 gap-2">
                {hexes.map((h) => {
                    const num = Number(h.hex);
                    const status = STATUS_WORDS[h.status] ? h.status : "none";
                    const isMine = myHexes.includes(num);
                    return (
                        <div
                            key={num}
                            title={h.label || ""}
                            className={`rounded-lg border-[3px] px-1.5 py-2 text-center leading-tight ${STATUS_BG[status]} ${isMine ? "outline outline-2 outline-offset-2 outline-slate-900" : ""}`}
                            style={{ borderColor: HEX_COLORS[num] || "#94a3b8" }}>
                            <div className="text-lg font-bold text-slate-900">{num}</div>
                            <div className="text-xs font-semibold text-slate-800">{HEX_SHORT[num] || h.label || ""}</div>
                            <div className="mt-0.5 text-[11px] text-slate-500">{STATUS_WORDS[status]}</div>
                        </div>
                    );
                })}
            </div>

            {/* Три пары-узла */}
            <div className="flex flex-col gap-1.5">
                {pairs.map((p) => {
                    const clickable = !!p.cardNumber;
                    return (
                        <div
                            key={p.n}
                            role={clickable ? "button" : undefined}
                            tabIndex={clickable ? 0 : undefined}
                            onClick={clickable ? () => openCard(p.cardNumber) : undefined}
                            onKeyDown={
                                clickable
                                    ? (e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              openCard(p.cardNumber);
                                          }
                                      }
                                    : undefined
                            }
                            title={clickable ? `Открыть карточку узла ${p.cardNumber}` : undefined}
                            className={`flex items-center justify-between gap-2 rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-xs ${STATUS_BG[STATUS_WORDS[p.status] ? p.status : "none"]} ${clickable ? "cursor-pointer hover:bg-slate-100" : ""}`}>
                            <span className="font-semibold text-slate-900">
                                Узел {p.n} · {p.hexes.join("+")} · {PAIR_NAMES[p.n] || ""}
                            </span>
                            <span className="whitespace-nowrap text-slate-600">{describePair(p, hexByNumber)}</span>
                        </div>
                    );
                })}
            </div>

            {/* Точка 0 стола */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Точка 0 стола</span>
                    {point0 ? (
                        <span className="text-[11px] text-amber-800">
                            {STATUS_WORDS[point0.status] || ""}
                            {point0.by ? ` · ${point0.by}` : ""}
                        </span>
                    ) : null}
                </div>
                {point0Lines.length > 0 ? (
                    <div className="mt-1 text-xs leading-snug text-slate-800">
                        {point0Lines.map((line, i) => (
                            <div key={i}>{line}</div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-600">Стол ещё не сдал точку 0</span>
                        {point0Card ? (
                            <Button type="button" inverted className="!w-auto !px-3 !py-1 !text-xs whitespace-nowrap" onClick={() => openCard(point0Card.number)}>
                                Карточка {point0Card.number}
                            </Button>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
});

export default DayTwoTableBoard;
