// День 2: проверка внутри команды (режим «пара»). Деталь принимает партнёр по паре
// (11↔12, 13↔14, 15↔16), узел — соседняя пара своего стола (11+12 → 13+14 → 15+16 → 11+12),
// карты стола и питчи — любой другой человек стола. Кольцо столов дня 1 не трогается:
// для обычных колод модуль отвечает null, и рантайм идёт прежним путём.
// Зачем отдельный файл: рантайм не может импортировать mayakDayTwo.js (тот импортирует рантайм).
import { getSectionBundle } from "@/lib/mayakContentStorage";
import { detectDeckLayout, resolveDirectionKey } from "@/lib/mayakProgressModel";

const HEX_BY_DIRECTION = { KNOWLEDGE: 11, INTERACTION: 12, DATA: 13, AUTOMATION: 14, ENVIRONMENT: 15, PROTECTION: 16 };
const HEX_PAIRS = [
    [11, 12],
    [13, 14],
    [15, 16],
];
const CACHE_MS = 60 * 1000;
const cache = new Map();

// Колода раздела: день 2 или нет, и по каждой карточке вид и гексы (из day2-полей index.json).
export async function getDayTwoDeckInfo(sectionId) {
    const key = String(sectionId || "").trim();
    if (!key) return null;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.info;
    let info = null;
    try {
        const bundle = await getSectionBundle(key, { includeTexts: false });
        const tasks = Array.isArray(bundle?.tasks) ? bundle.tasks : [];
        const byNumber = new Map();
        tasks.forEach((card) => {
            const num = String(card?.number ?? "").trim();
            if (num) byNumber.set(num, card);
        });
        const layout = detectDeckLayout(byNumber, 1);
        const cards = new Map();
        if (layout?.key === "day2") {
            tasks.forEach((card) => {
                const num = String(card?.number ?? "").trim();
                const d2 = card?.day2 || {};
                if (num) cards.set(num, { kind: String(d2.kind || ""), hexes: Array.isArray(d2.hexes) ? d2.hexes.map(Number) : [] });
            });
        }
        info = { dayTwo: layout?.key === "day2", cards };
    } catch {
        info = null;
    }
    cache.set(key, { at: Date.now(), info });
    return info;
}

// Гекс участника: направление из «Я» дня 1, иначе гекс той детали, которую он открыл или сдал.
export function hexOfParticipant(participant, deck) {
    const dir = resolveDirectionKey(participant?.yaDirection || "");
    if (dir && HEX_BY_DIRECTION[dir]) return HEX_BY_DIRECTION[dir];
    for (const task of Object.values(participant?.tasks || {})) {
        const card = deck?.cards?.get(String(task?.taskNumber || ""));
        if (card && card.kind === "detail" && card.hexes[0]) return card.hexes[0];
    }
    return null;
}

// Кто принимает заявку участника по карточке taskNumber. null — правило дня 2 не применимо (не день 2 или человек один за столом).
export function dayTwoReviewers({ deck, bucket, participant, taskNumber }) {
    if (!deck?.dayTwo || !participant) return null;
    const mates = Object.values(bucket?.participants || {}).filter(
        (p) => p && p.userId !== participant.userId && Number(p.tableNumber) === Number(participant.tableNumber)
    );
    if (!mates.length) return null;
    const card = deck.cards.get(String(taskNumber || "")) || { kind: "", hexes: [] };
    const withHex = (hexes) => mates.filter((p) => hexes.includes(hexOfParticipant(p, deck)));
    const ids = (list) => list.map((p) => p.userId);

    if (card.kind === "detail" && card.hexes[0]) {
        const pair = HEX_PAIRS.find((pr) => pr.includes(card.hexes[0])) || [];
        const partnerHex = pair.find((h) => h !== card.hexes[0]);
        const partners = partnerHex ? withHex([partnerHex]) : [];
        if (partners.length) return { rule: "partner", userIds: ids(partners) };
        return { rule: "table", userIds: ids(mates) };
    }
    if (card.kind === "node" && card.hexes.length === 2) {
        const i = HEX_PAIRS.findIndex((pr) => pr.includes(card.hexes[0]));
        const next = i >= 0 ? HEX_PAIRS[(i + 1) % HEX_PAIRS.length] : [];
        const nextPair = withHex(next);
        if (nextPair.length) return { rule: "next_pair", userIds: ids(nextPair) };
        const others = mates.filter((p) => !card.hexes.includes(hexOfParticipant(p, deck)));
        return { rule: "table", userIds: ids(others.length ? others : mates) };
    }
    return { rule: "table", userIds: ids(mates) };
}
