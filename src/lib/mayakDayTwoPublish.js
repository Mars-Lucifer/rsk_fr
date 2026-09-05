// День 2: выпуск дня в платформу — запись раздела, создание сессии, выгрузка
// результатов. Всё через существующие хранилища; ничего из общего кода не
// меняется. Раскладка index.json повторяет day2-tools/gen_deck.py.

import { renderDayTwoCardSvg } from "@/lib/mayakDayTwoCard";
import { ensureSectionDir, readManifest, readSectionJson, writeManifest, writeSectionFile, writeSectionJson } from "@/lib/mayakContentStorage";
import { createDelegatedMayakSessionForAccess, grantMayakAdminRight, listMayakAdminRights } from "@/lib/mayakAdminRights";
import { getMayakSessionById, updateMayakSession } from "@/lib/mayakSessions";
import { readSessionReviews, readSessionRuntimeParticipants } from "@/lib/mayakSessionRuntime";
import { getDayTwoTableState } from "@/lib/mayakDayTwo";
import { DAY_TWO_HEX_LABELS, DAY_TWO_KIND_NAMES } from "@/lib/mayakDayTwoModel";

const REVIEW_TIMEOUT_SECONDS = 900;
const REWORK_TIMEOUT_SECONDS = 1200;
const RIGHT_TOTAL_QUOTA = 20;
const RIGHT_PARTICIPANT_LIMIT = 200;
const RIGHT_TITLE_PREFIX = "День 2 · ";
const HINT_LETTERS = { m: "М", a: "А", ya: "Я", k: "К", o1: "О", k2: "К", o2: "О" };
const ACCEPTED = new Set(["approved", "expired"]);

export function parseSectionRange(sectionId) {
    const match = /^(\d+)-(\d+)$/.exec(String(sectionId || "").trim());
    if (!match) return null;
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return { start, end };
}

// Первый свободный диапазон x101–x200, x201–x300 … в тысяче категории.
// categoryHundred — 8000, "8000" или любой sectionId категории («8101-8200»).
export async function nextFreeSectionId(categoryHundred) {
    const raw = String(categoryHundred || "").trim();
    const range = parseSectionRange(raw);
    const base = range ? Math.floor((range.start - 1) / 1000) * 1000 : Math.floor(Number(raw) / 1000) * 1000;
    if (!Number.isFinite(base) || base < 0) {
        throw new Error("Не удалось определить категорию раздела");
    }
    const manifest = new Set(await readManifest());
    for (let k = 1; k <= 9; k += 1) {
        const candidate = `${base + 100 * k + 1}-${base + 100 * (k + 1)}`;
        if (!manifest.has(candidate)) return candidate;
    }
    throw new Error(`В категории ${base} нет свободного диапазона`);
}

function hintText(card) {
    const hint = card.hint || {};
    const parts = Object.keys(HINT_LETTERS)
        .filter((key) => hint[key])
        .map((key) => `${HINT_LETTERS[key]} — ${hint[key]}`);
    const text = parts.join(" · ");
    if (text && card.notes) return `${text}. ${card.notes}`;
    return text || card.notes || "";
}

function contentTypeOf(card) {
    if (card.pill === "СТАРТ" || card.kind === "intro" || card.kind === "point0") return "Старт";
    if (card.kind === "detail" && card.hexes[0] && DAY_TWO_HEX_LABELS[card.hexes[0]]) return DAY_TWO_HEX_LABELS[card.hexes[0]];
    return card.pill;
}

// Запись index.json для карточки; base — прежняя запись того же номера, чтобы
// не потерять поля, которых у дня нет (как gen_deck.py делал через setdefault).
export function buildIndexCard(card, number, day, base = {}) {
    const num = String(number);
    return {
        ...base,
        number: num,
        title: card.title,
        file: card.file || "",
        instruction: "",
        instructionText: hintText(card),
        materialText: "",
        sourceLink: "",
        toolLink1: day.folder_url || "",
        toolName1: day.folder_url ? "Папка стола на ctr5" : "",
        toolLink2: card.tool?.url || "",
        toolName2: card.tool?.name || "",
        contentType: contentTypeOf(card),
        map: `${num}.svg`,
        mapText: "Карта",
        hasMap: true,
        hasInstruction: false,
        hasFile: Boolean(card.file),
        hasSource: false,
        day2: {
            kind: card.kind,
            hexes: card.hexes,
            mins: card.mins,
            pill: card.pill,
            why: card.why,
            task: card.task,
            submit: card.submit,
            done: card.done,
        },
    };
}

export function buildTaskText(card, number) {
    return {
        number: String(number),
        description: `${card.why} Сдать: ${card.submit} Готово, когда: ${card.done}`,
        task: card.task,
    };
}

// Номера карточек в разделе: rangeStart + позиция в колоде.
export function sectionNumbers(day, sectionId) {
    const range = parseSectionRange(sectionId);
    if (!range) throw new Error("Раздел должен выглядеть как 8201-8300");
    const cards = Array.isArray(day.cards) ? day.cards : [];
    if (cards.length > range.end - range.start + 1) throw new Error("Карточек больше, чем номеров в разделе");
    return cards.map((_, i) => range.start + i);
}

// Записывает раздел: index.json (только реальные карточки), TaskText.json,
// meta.json, карты SVG, манифест. Возвращает номера карточек в разделе.
export async function writeDayToSection(day, sectionId) {
    const range = parseSectionRange(sectionId);
    if (!range) throw new Error("Раздел должен выглядеть как 8201-8300");
    const numbers = sectionNumbers(day, sectionId);
    const cards = day.cards;

    const manifest = await readManifest();
    if (!manifest.includes(sectionId)) {
        await ensureSectionDir(sectionId);
        await writeManifest([...manifest, sectionId]);
    }
    await ensureSectionDir(sectionId);

    const existingIndex = await readSectionJson(sectionId, "index.json", []);
    const existingByNumber = new Map((Array.isArray(existingIndex) ? existingIndex : []).map((item) => [String(item?.number), item]));

    const index = cards.map((card, i) => buildIndexCard(card, numbers[i], day, existingByNumber.get(String(numbers[i])) || {}));
    const texts = cards.map((card, i) => buildTaskText(card, numbers[i]));

    for (const item of index) {
        await writeSectionFile(sectionId, "maps", `${item.number}.svg`, Buffer.from(renderDayTwoCardSvg(item), "utf-8"));
    }

    const existingMeta = await readSectionJson(sectionId, "meta.json", {});
    const meta = {
        ...(existingMeta && typeof existingMeta === "object" ? existingMeta : {}),
        rangeName: existingMeta?.rangeName || `День 2 · ${day.org || sectionId}`,
        rangeStart: range.start,
        rangeEnd: range.end,
        dayTwo: true,
    };

    await writeSectionJson(sectionId, "index.json", index);
    await writeSectionJson(sectionId, "TaskText.json", texts);
    await writeSectionJson(sectionId, "meta.json", meta);

    return { sectionId, numbers, cardCount: index.length };
}

async function findOrCreateDayTwoRight(day) {
    const sectionId = day.sectionId;
    const rights = await listMayakAdminRights();
    const existing = rights.find((right) => right.status === "active" && right.sectionId === sectionId && String(right.title || "").startsWith(RIGHT_TITLE_PREFIX));
    if (existing) return existing;
    return grantMayakAdminRight(null, {
        title: `${RIGHT_TITLE_PREFIX}${day.org || sectionId}`,
        fullName: `${RIGHT_TITLE_PREFIX}${day.org || sectionId}`,
        sectionId,
        taskRange: sectionId,
        totalQuota: RIGHT_TOTAL_QUOTA,
        totalParticipantLimit: RIGHT_PARTICIPANT_LIMIT,
    });
}

// Создаёт сессию через консоль доступа мастера: доступ «День 2 · <org>» на
// раздел дня (ищется или заводится), сессия с 48-часовым сроком, таймеры
// 15/20 минут, лимит участников. Пароль доступа читается из записи доступа —
// внутри сервера это допустимо, наружу он не уходит.
export async function createDayTwoSession(day, { tableCount, participantLimit } = {}) {
    if (!day?.sectionId) throw new Error("Сначала запишите раздел");
    const tables = Number.parseInt(String(tableCount ?? ""), 10);
    const limit = Number.parseInt(String(participantLimit ?? ""), 10);
    if (!Number.isFinite(tables) || tables < 1 || tables > 6) throw new Error("Столов должно быть от 1 до 6");
    if (!Number.isFinite(limit) || limit < 1 || limit > RIGHT_PARTICIPANT_LIMIT) throw new Error(`Участников должно быть от 1 до ${RIGHT_PARTICIPANT_LIMIT}`);

    const right = await findOrCreateDayTwoRight(day);
    if (!right?.accessId || !right?.accessPassword) throw new Error("Не удалось получить доступ мастера для раздела");

    const created = await createDelegatedMayakSessionForAccess({
        accessId: right.accessId,
        password: right.accessPassword,
        sessionName: `День 2 · ${day.org || day.sectionId} · ${day.date || ""}`.trim(),
        tableCount: tables,
    });

    const session = await updateMayakSession(created.session.id, {
        reviewTimeoutSeconds: REVIEW_TIMEOUT_SECONDS,
        reworkTimeoutSeconds: REWORK_TIMEOUT_SECONDS,
        tokenUsageLimit: limit,
        participantLimit: limit,
    });

    return {
        id: session.id,
        name: session.name,
        accessId: right.accessId,
        tokenValue: created.token?.token || "",
        plainToken: created.links?.plainToken || "",
        masterSecret: created.links?.masterSecret || "",
        dashboardSecret: created.links?.dashboardSecret || "",
        tableCount: session.tableCount,
        participantLimit: session.participantLimit,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
    };
}

export function buildSessionLinks(session, origin = "") {
    if (!session) return null;
    return {
        participant: session.tokenValue ? `${origin}/tools/mayak-oko?token=${session.tokenValue}aaaaa` : "",
        master: session.masterSecret ? `${origin}/mayak-master/${session.masterSecret}` : "",
        dashboard: session.dashboardSecret ? `${origin}/mayak-dashboard/${session.dashboardSecret}` : "",
    };
}

function fileLinks(sessionId, review) {
    const file = review?.file;
    if (!file?.storedName) return null;
    const base = `/api/mayak/session-runtime/file?sessionId=${encodeURIComponent(sessionId)}&reviewId=${encodeURIComponent(review.id)}`;
    return {
        name: file.originalName || file.storedName,
        url: `${base}&type=original&filename=${encodeURIComponent(file.storedName)}`,
        downloadUrl: `${base}&type=original&download=1&filename=${encodeURIComponent(file.storedName)}`,
    };
}

function latest(items) {
    return items.slice().sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))[items.length - 1] || null;
}

// Результаты сессии по столам: точка 0, детали, узлы, сборка, приёмка,
// дорожная карта — по виду карточки дня (day.cards[].kind по номеру).
export async function exportDayResults(day) {
    const sessionId = day?.session?.id;
    if (!sessionId) throw new Error("Сессия ещё не создана");
    const session = await getMayakSessionById(sessionId);
    if (!session) throw new Error("Сессии нет в платформе: истёк срок или она завершена. Откройте снимок результатов, если он есть");
    if (session.status !== "active") throw new Error("Сессия завершена в платформе: результаты удалены. Откройте снимок, если он есть");

    const cardsByNumber = new Map((day.cards || []).map((card) => [String(card.num), card]));
    const kindOf = (number) => cardsByNumber.get(String(number))?.kind || "other";
    const titleOf = (number) => cardsByNumber.get(String(number))?.title || "";

    const [participants, reviews] = await Promise.all([readSessionRuntimeParticipants(sessionId), readSessionReviews(sessionId)]);
    const items = reviews.map((review) => ({
        id: review.id,
        taskNumber: String(review.taskNumber || ""),
        kind: kindOf(review.taskNumber),
        kindName: DAY_TWO_KIND_NAMES[kindOf(review.taskNumber)] || kindOf(review.taskNumber),
        title: titleOf(review.taskNumber),
        table: Number(review.participantTableNumber) || 0,
        participantName: review.participantName || "",
        status: review.status,
        accepted: ACCEPTED.has(review.status),
        createdAt: review.createdAt || "",
        resolvedAt: review.resolvedAt || null,
        text: review.submissionText || "",
        file: fileLinks(sessionId, review),
    }));

    const tableNumbers = Array.from({ length: Number(session.tableCount) || 0 }, (_, i) => i + 1);
    const tables = [];
    for (const table of tableNumbers) {
        const members = participants.filter((p) => Number(p.tableNumber) === table);
        const all = items.filter((item) => item.table === table).sort((a, b) => a.taskNumber.localeCompare(b.taskNumber) || a.createdAt.localeCompare(b.createdAt));
        const byKind = (kind) => all.filter((item) => item.kind === kind);
        let state = null;
        if (members[0]?.userId) {
            state = await getDayTwoTableState({ sessionId, userId: members[0].userId }).catch(() => null);
        }
        tables.push({
            table,
            members: members.map((p) => ({ name: p.name || "", role: p.role || "", userId: p.userId })),
            point0: latest(byKind("point0")),
            details: byKind("detail"),
            nodes: byKind("node"),
            assembly: latest(byKind("assembly")),
            acceptance: latest(byKind("acceptance")),
            roadmap: latest(byKind("roadmap")),
            all,
            state: state?.dayTwo ? { hexes: state.hexes, pairs: state.pairs, tableCards: state.tableCards } : null,
        });
    }

    return {
        at: new Date().toISOString(),
        session: { id: session.id, name: session.name, status: session.status, tableCount: session.tableCount, expiresAt: session.expiresAt },
        participants: participants.length,
        reviews: items.length,
        accepted: items.filter((item) => item.accepted).length,
        roadmapAccepted: tables.filter((t) => t.roadmap?.accepted).length,
        tables,
    };
}
