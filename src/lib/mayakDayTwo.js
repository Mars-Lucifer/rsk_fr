// День 2 (стратегическая сессия): состояние стола по гексам и парам.
//
// Модуль живёт отдельно и включается только для колод дня 2 — тех, где нет ни
// одной карты формата «Я» и есть карты направлений «Мы» (см. detectDeckLayout).
// Тренажёр, дашборд и рантайм других колод этот код не вызывают.
//
// Гекс — направление части «Мы» с номером 11..16 (как на фанере стола и на
// картах): 11 знания и навыки, 12 внешние взаимодействия, 13 данные и аналитика,
// 14 автоматизация, 15 единое цифровое пространство, 16 защита данных.
// Пара (узел) — два соседних гекса: 11+12, 13+14, 15+16.
//
// Вид карты берётся из поля day2.kind в index.json (пишет генератор колоды),
// а если поля нет — выводится из contentType: направление → деталь, «Старт» →
// вводная/точка 0. Так колода, собранная вручную в админке, тоже читается.

import { getSectionBundle } from "@/lib/mayakContentStorage";
import { detectDeckLayout, resolveDirectionKey, isStartType } from "@/lib/mayakProgressModel";
import { getMayakSessionById } from "@/lib/mayakSessions";
import { readSessionRuntimeParticipants, readSessionReviews } from "@/lib/mayakSessionRuntime";

export const HEX_BY_DIRECTION = {
    KNOWLEDGE: 11,
    INTERACTION: 12,
    DATA: 13,
    AUTOMATION: 14,
    ENVIRONMENT: 15,
    PROTECTION: 16,
};

export const HEX_LABELS = {
    11: "Знания и навыки",
    12: "Внешние взаимодействия",
    13: "Данные и аналитика",
    14: "Автоматизация",
    15: "Единое цифровое пространство",
    16: "Защита данных",
};

export const HEX_PAIRS = [
    [11, 12],
    [13, 14],
    [15, 16],
];

const STATUS_ORDER = ["none", "started", "pending_review", "rejected", "approved"];

function cardsByNumber(tasks) {
    const map = new Map();
    (tasks || []).forEach((card) => {
        const num = String(card?.number ?? "").trim();
        if (num) map.set(num, card);
    });
    return map;
}

export function isDayTwoDeck(tasks) {
    const layout = detectDeckLayout(cardsByNumber(tasks), 1);
    return layout.key === "day2";
}

// Вид и гексы карты. day2-поле генератора имеет приоритет, иначе — по contentType.
export function describeDayTwoCard(card, index) {
    const meta = card?.day2 && typeof card.day2 === "object" ? card.day2 : null;
    if (meta?.kind) {
        return { kind: String(meta.kind), hexes: Array.isArray(meta.hexes) ? meta.hexes.map(Number).filter(Boolean) : [] };
    }
    const ct = card?.contentType || "";
    if (index < 3) return { kind: "intro", hexes: [] };
    if (isStartType(ct)) return { kind: "point0", hexes: [] };
    const dirKey = resolveDirectionKey(ct);
    if (dirKey && HEX_BY_DIRECTION[dirKey]) return { kind: "detail", hexes: [HEX_BY_DIRECTION[dirKey]] };
    return { kind: "other", hexes: [] };
}

function strongerStatus(a, b) {
    return STATUS_ORDER.indexOf(b) > STATUS_ORDER.indexOf(a) ? b : a;
}

function taskStatusOf(participant, taskNumber) {
    const state = participant?.tasks?.[String(taskNumber)];
    if (!state) return "none";
    const status = String(state.status || "");
    if (status === "approved" || status === "expired" || status === "rework_expired") return "approved";
    if (status === "pending_review") return "pending_review";
    if (status === "rejected") return "rejected";
    return "started";
}

// Состояние стола участника: гексы, пары, точка 0.
export async function getDayTwoTableState({ sessionId, userId }) {
    const session = await getMayakSessionById(sessionId);
    if (!session || session.status !== "active") {
        return { dayTwo: false, sessionActive: false };
    }

    const bundle = await getSectionBundle(session.sectionId, { includeTexts: false });
    const tasks = bundle?.tasks || [];
    if (!isDayTwoDeck(tasks)) {
        return { dayTwo: false, sessionActive: true };
    }

    const participants = await readSessionRuntimeParticipants(sessionId);
    const me = participants.find((p) => p.userId === userId) || null;
    const tableNumber = me ? Number(me.tableNumber) : null;
    const tableMates = tableNumber ? participants.filter((p) => Number(p.tableNumber) === tableNumber) : [];

    const cards = tasks.map((card, index) => ({ card, index, ...describeDayTwoCard(card, index) }));

    // Гексы: по каждому направлению лучший статус среди заданий-деталей стола.
    const hexes = Object.keys(HEX_LABELS).map((hexStr) => {
        const hex = Number(hexStr);
        let status = "none";
        let owner = "";
        cards
            .filter((c) => c.kind === "detail" && c.hexes.includes(hex))
            .forEach((c) => {
                tableMates.forEach((p) => {
                    const s = taskStatusOf(p, c.card.number);
                    if (s !== "none" && STATUS_ORDER.indexOf(s) >= STATUS_ORDER.indexOf(status)) {
                        status = strongerStatus(status, s);
                        owner = p.name || "";
                    }
                });
            });
        return { hex, label: HEX_LABELS[hex], status, owner, mine: false };
    });

    // Пары-узлы: статус карты узла плюс готовность двух деталей.
    const pairs = HEX_PAIRS.map(([a, b], i) => {
        const nodeCards = cards.filter((c) => c.kind === "node" && c.hexes.includes(a) && c.hexes.includes(b));
        let status = "none";
        nodeCards.forEach((c) => tableMates.forEach((p) => { status = strongerStatus(status, taskStatusOf(p, c.card.number)); }));
        const detailsDone = [a, b].filter((h) => hexes.find((x) => x.hex === h)?.status === "approved").length;
        return { n: i + 1, hexes: [a, b], status, detailsDone, cardNumber: nodeCards[0]?.card?.number || null };
    });

    // Точка 0: последний текст, сданный кем-то со стола на карте point0.
    const point0Cards = new Set(cards.filter((c) => c.kind === "point0").map((c) => String(c.card.number)));
    const reviews = await readSessionReviews(sessionId);
    const point0 = reviews
        .filter((r) => Number(r.participantTableNumber) === tableNumber && point0Cards.has(String(r.taskNumber)))
        .sort((x, y) => String(y.createdAt || "").localeCompare(String(x.createdAt || "")))
        .map((r) => ({ text: r.submissionText || "", status: r.status, by: r.participantName || "" }))[0] || null;

    return {
        dayTwo: true,
        sessionActive: true,
        tableNumber,
        members: tableMates.map((p) => ({ name: p.name || "", role: p.role || "", userId: p.userId })),
        hexes,
        pairs,
        point0,
    };
}
