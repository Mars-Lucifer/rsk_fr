import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";

import { normalizeQwenTokenEntries } from "./mayakQwen.js";

const DEFAULT_REFRESH_SCRIPT = path.join(process.cwd(), "scripts", "qwen", "qwen_sessions.py");

function normalizeAccountName(value) {
    return String(value || "").trim();
}

function getRefreshScriptPath() {
    const explicitPath = normalizeAccountName(process.env.MAYAK_QWEN_REFRESH_SCRIPT);
    if (explicitPath) return explicitPath;
    return DEFAULT_REFRESH_SCRIPT;
}

function getPythonCommand() {
    return normalizeAccountName(process.env.MAYAK_QWEN_REFRESH_PYTHON) || (process.platform === "win32" ? "python" : "python3");
}

function shouldRunHeadless() {
    const value = normalizeAccountName(process.env.MAYAK_QWEN_REFRESH_HEADLESS).toLowerCase();
    if (value === "0" || value === "false" || value === "no") return false;
    return true;
}

function getRefreshTimeoutMs() {
    const value = Number.parseInt(process.env.MAYAK_QWEN_REFRESH_TIMEOUT_MS || "", 10);
    return Number.isFinite(value) && value > 0 ? value : 120000;
}

function getAccountMap() {
    const rawMap = normalizeAccountName(process.env.MAYAK_QWEN_REFRESH_ACCOUNT_MAP);
    if (!rawMap) return {};

    try {
        const parsed = JSON.parse(rawMap);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function resolveAccountForToken(token, index) {
    const accountMap = getAccountMap();
    const indexNumber = Number.parseInt(index, 10);
    const fallbackAccount = Number.isNaN(indexNumber) ? "" : `acc${String(indexNumber + 1).padStart(2, "0")}`;
    return normalizeAccountName(accountMap[String(index)] || accountMap[token?.name] || token?.sessionAccount || token?.account || fallbackAccount);
}

function buildRefreshArgs({ account, all = false }) {
    const scriptPath = getRefreshScriptPath();
    if (!existsSync(scriptPath)) {
        throw new Error("Qwen refresh-скрипт не найден. Укажите MAYAK_QWEN_REFRESH_SCRIPT на сервере платформы.");
    }

    const args = [scriptPath];
    if (all) {
        args.push("refresh-all", "--show-token");
        if (shouldRunHeadless()) args.push("--headless");
        return args;
    }

    const normalizedAccount = normalizeAccountName(account);
    if (!normalizedAccount) {
        throw new Error("Для Qwen-токена не указан аккаунт сессии. Название токена должно совпадать с профилем сессии или настройте маппинг.");
    }

    args.push("refresh", normalizedAccount, "--show-token");
    if (shouldRunHeadless()) args.push("--headless");
    return args;
}

function runRefreshCommand(args) {
    return new Promise((resolve, reject) => {
        const child = spawn(getPythonCommand(), args, {
            cwd: path.dirname(args[0]),
            windowsHide: true,
        });
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill();
            reject(new Error("Qwen refresh не завершился за отведенное время. Проверьте, что сессия сохранена и не требует ручного входа."));
        }, getRefreshTimeoutMs());

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString("utf-8");
        });

        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString("utf-8");
        });

        child.on("error", (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            reject(new Error(`Не удалось запустить Qwen refresh: ${error.message}`));
        });

        child.on("close", (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (code !== 0) {
                reject(new Error((stderr || stdout || `Qwen refresh завершился с кодом ${code}`).trim()));
                return;
            }

            resolve({ stdout, stderr });
        });
    });
}

function extractJsonObjects(output) {
    const objects = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < output.length; index += 1) {
        const char = output[index];

        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === "\\") {
                escaped = true;
                continue;
            }
            if (char === "\"") {
                inString = false;
            }
            continue;
        }

        if (char === "\"") {
            inString = true;
            continue;
        }

        if (char === "{") {
            if (depth === 0) start = index;
            depth += 1;
            continue;
        }

        if (char === "}") {
            depth -= 1;
            if (depth === 0 && start !== -1) {
                objects.push(output.slice(start, index + 1));
                start = -1;
            }
        }
    }

    return objects;
}

function parseRefreshOutput(stdout) {
    const refreshed = [];

    for (const rawObject of extractJsonObjects(stdout)) {
        try {
            const parsed = JSON.parse(rawObject);
            for (const [account, info] of Object.entries(parsed || {})) {
                const token = typeof info?.token === "string" ? info.token.trim() : "";
                if (!token) continue;
                refreshed.push({
                    account,
                    token,
                    email: typeof info?.email === "string" ? info.email.trim() : "",
                    expiresAt: info.expires_at_utc || null,
                    daysLeft: info.days_left ?? null,
                });
            }
        } catch {
            // Ignore non-result JSON fragments.
        }
    }

    return refreshed;
}

function applyRefreshedTokens(currentTokens, refreshedTokens, { targetIndex = null } = {}) {
    const nextTokens = normalizeQwenTokenEntries(currentTokens);
    const refreshedByAccount = new Map(refreshedTokens.map((entry) => [String(entry.account || ""), entry]));
    const updated = [];

    if (targetIndex !== null) {
        const index = Number.parseInt(targetIndex, 10);
        if (Number.isNaN(index) || index < 0 || index >= nextTokens.length) {
            throw new Error("Qwen-токен для обновления не найден.");
        }

        const current = nextTokens[index];
        const refreshed =
            refreshedByAccount.get(current.account) ||
            refreshedByAccount.get(current.sessionAccount) ||
            refreshedByAccount.get(current.name) ||
            (refreshedTokens.length === 1 ? refreshedTokens[0] : null);
        if (!refreshed?.token) {
            throw new Error("Refresh-worker не вернул новый токен для выбранного аккаунта.");
        }

        const email = refreshed.email || current.email || "";
        nextTokens[index] = { ...current, token: refreshed.token, email, account: refreshed.account || current.account || current.sessionAccount || "" };
        updated.push({ index, name: current.name, email, account: refreshed.account, expiresAt: refreshed.expiresAt, daysLeft: refreshed.daysLeft });
        return { tokens: nextTokens, updated };
    }

    nextTokens.forEach((current, index) => {
        const refreshed =
            refreshedByAccount.get(current.account) ||
            refreshedByAccount.get(current.sessionAccount) ||
            refreshedByAccount.get(current.name) ||
            (refreshedTokens.length === nextTokens.length ? refreshedTokens[index] : null);
        if (!refreshed?.token) return;

        const email = refreshed.email || current.email || "";
        nextTokens[index] = { ...current, token: refreshed.token, email, account: refreshed.account || current.account || current.sessionAccount || "" };
        updated.push({ index, name: current.name, email, account: refreshed.account, expiresAt: refreshed.expiresAt, daysLeft: refreshed.daysLeft });
    });

    return { tokens: nextTokens, updated };
}

export async function refreshStoredQwenTokens(settings, { index = null } = {}) {
    const currentTokens = normalizeQwenTokenEntries(settings.qwenTokens);
    if (currentTokens.length === 0) {
        throw new Error("В пуле нет Qwen-токенов.");
    }

    const refreshOne = index !== null && index !== undefined;
    const account = refreshOne ? resolveAccountForToken(currentTokens[Number.parseInt(index, 10)], index) : "";
    const args = buildRefreshArgs({ account, all: !refreshOne });
    const { stdout } = await runRefreshCommand(args);
    const refreshedTokens = parseRefreshOutput(stdout);

    if (refreshedTokens.length === 0) {
        throw new Error("Refresh-worker не вернул ни одного нового Qwen-токена.");
    }

    const result = applyRefreshedTokens(currentTokens, refreshedTokens, {
        targetIndex: refreshOne ? index : null,
    });

    if (result.updated.length === 0) {
        throw new Error("Новые Qwen-токены получены, но не удалось сопоставить их со списком платформы.");
    }

    return result;
}
