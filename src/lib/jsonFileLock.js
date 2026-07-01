import { promises as fs } from "fs";
import path from "path";

const DEFAULT_LOCK_TIMEOUT_MS = 5000;
const LOCK_RETRY_DELAY_MS = 25;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readJsonFile(filePath, fallbackValue) {
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallbackValue : parsed;
    } catch {
        return fallbackValue;
    }
}

export async function writeJsonFileAtomic(filePath, value) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempFile = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(value, null, 2), "utf-8");
    // На Windows fs.rename поверх существующего файла изредка падает с EPERM/
    // EEXIST/EBUSY, если файл в этот момент открыт читателем/антивирусом/
    // индексатором (читатели лок не берут). Rename атомарен, ретрай безопасен.
    // На Linux эти коды в норме не возникают, поэтому обычно с первой попытки.
    const RETRYABLE = new Set(["EPERM", "EEXIST", "EBUSY", "EACCES"]);
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; ; attempt++) {
        try {
            await fs.rename(tempFile, filePath);
            return;
        } catch (error) {
            if (!RETRYABLE.has(error?.code) || attempt >= MAX_ATTEMPTS) {
                await fs.rm(tempFile, { force: true }).catch(() => {});
                throw error;
            }
            await sleep(30 * attempt);
        }
    }
}

export async function withJsonFileLock(filePath, operation, { timeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = {}) {
    const lockPath = `${filePath}.lock`;
    const startedAt = Date.now();
    let handle = null;

    while (!handle) {
        try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            handle = await fs.open(lockPath, "wx");
        } catch (error) {
            if (error?.code !== "EEXIST" || Date.now() - startedAt > timeoutMs) {
                throw error;
            }
            await sleep(LOCK_RETRY_DELAY_MS);
        }
    }

    try {
        return await operation();
    } finally {
        await handle.close().catch(() => {});
        await fs.rm(lockPath, { force: true }).catch(() => {});
    }
}

export async function updateJsonFile(filePath, fallbackValue, updater) {
    return withJsonFileLock(filePath, async () => {
        const current = await readJsonFile(filePath, fallbackValue);
        const next = await updater(current);
        if (next !== undefined) {
            await writeJsonFileAtomic(filePath, next);
        }
        return next === undefined ? current : next;
    });
}
