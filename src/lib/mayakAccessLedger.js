import crypto from "crypto";
import path from "path";

import { readJsonFile, withJsonFileLock, writeJsonFileAtomic } from "@/lib/jsonFileLock";

// Журнал израсходованных входов доступа.
//
// Зачем он нужен. Раньше «сколько входов потрачено» считалось на лету суммой
// usedCount по живым session-токенам доступа. Токены живут ограниченный срок
// (сейчас 48 часов): истёкшие отбрасываются при подсчёте, а свип их вообще
// удаляет. Значит по истечении срока расход исчезал и купленный лимит
// возвращался к исходному — заказчик платил за то, что и так восстанавливалось.
//
// Здесь факт списания записывается отдельно и переживает удаление токена.
// Журнал только дописывается: записи не редактируются и не удаляются, поэтому
// он же отвечает на вопрос «кому и когда выдавали входы».
const LEDGER_FILE = path.join(process.cwd(), "data", "mayak-access-ledger.json");

function createEmptyStore() {
    return { entries: [] };
}

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

async function readEntries() {
    const parsed = await readJsonFile(LEDGER_FILE, createEmptyStore());
    return Array.isArray(parsed?.entries) ? parsed.entries : [];
}

function buildEntry({ accessId, tokenId, sessionId, reason }) {
    return {
        id: crypto.randomUUID(),
        accessId: normalizeString(accessId),
        tokenId: normalizeString(tokenId),
        sessionId: normalizeString(sessionId),
        reason: normalizeString(reason) || "entry",
        at: new Date().toISOString(),
    };
}

// Счётчики по всем доступам разом: читать журнал по одному ключу на каждый
// доступ в списке — лишние чтения одного и того же файла.
export async function readAccessLedgerCounts() {
    const entries = await readEntries();
    const counts = new Map();
    for (const entry of entries) {
        const key = normalizeString(entry?.accessId);
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
}

export async function countAccessLedgerEntries(accessId) {
    const key = normalizeString(accessId);
    if (!key) return 0;
    const counts = await readAccessLedgerCounts();
    return counts.get(key) || 0;
}

// Вызывается в момент успешного списания входа — внутри лока файла токенов.
// Лок здесь берётся на другой файл, порядок захвата везде один и тот же
// (токены → журнал), поэтому дедлока не возникает.
export async function recordAccessLedgerEntry({ accessId, tokenId, sessionId, reason } = {}) {
    const key = normalizeString(accessId);
    if (!key) return null;

    const entry = buildEntry({ accessId: key, tokenId, sessionId, reason });
    await withJsonFileLock(LEDGER_FILE, async () => {
        const store = await readJsonFile(LEDGER_FILE, createEmptyStore());
        const entries = Array.isArray(store?.entries) ? store.entries : [];
        entries.push(entry);
        await writeJsonFileAtomic(LEDGER_FILE, { entries });
    });
    return entry;
}

// Досыпка до фактического расхода по живым токенам.
//
// Журнал появился позже самих доступов: на момент внедрения часть входов уже
// потрачена и видна только в usedCount живых токенов. Пока эти токены живы,
// разницу дописываем в журнал записями reason: "baseline" — иначе при их
// истечении расход обнулился бы ровно один раз, уже после фикса.
//
// Идемпотентно: разница считается под локом от актуального содержимого файла,
// параллельные вызовы не задваивают записи.
export async function syncAccessLedgerBaseline(accessId, liveUsedCount) {
    const key = normalizeString(accessId);
    const live = Number.isFinite(liveUsedCount) ? Math.max(0, Math.trunc(liveUsedCount)) : 0;
    if (!key || live < 1) return 0;

    return withJsonFileLock(LEDGER_FILE, async () => {
        const store = await readJsonFile(LEDGER_FILE, createEmptyStore());
        const entries = Array.isArray(store?.entries) ? store.entries : [];
        const current = entries.filter((entry) => normalizeString(entry?.accessId) === key).length;
        const missing = live - current;
        if (missing < 1) return current;

        for (let index = 0; index < missing; index += 1) {
            entries.push(buildEntry({ accessId: key, reason: "baseline" }));
        }
        await writeJsonFileAtomic(LEDGER_FILE, { entries });
        return live;
    });
}
