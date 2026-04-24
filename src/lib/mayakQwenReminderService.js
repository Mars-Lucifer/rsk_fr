import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

import { normalizeQwenTokenEntries, maskSecret } from "./mayakQwen.js";
import { readMayakSettings } from "./mayakSettings.js";

const REMINDER_STATE_FILE = path.join(process.cwd(), "data", "mayak-qwen-reminder-state.json");
const BOT_ADMINS_FILE = path.join(process.cwd(), "data", "botAdmins.json");
const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_WINDOWS = [
    { key: "5d", thresholdMs: 5 * DAY_MS, label: "через 5 дней" },
    { key: "1d", thresholdMs: 1 * DAY_MS, label: "через 1 день" },
];

function normalizeChatIds(value) {
    const source = Array.isArray(value)
        ? value
        : typeof value === "string"
          ? value.split(/[,\r\n]+/)
          : value != null
            ? [value]
            : [];

    return source
        .map((entry) => String(entry || "").trim())
        .filter(Boolean);
}

async function readReminderState() {
    try {
        return JSON.parse(await fs.readFile(REMINDER_STATE_FILE, "utf-8"));
    } catch {
        return { sent: {} };
    }
}

async function writeReminderState(state) {
    const dir = path.dirname(REMINDER_STATE_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(REMINDER_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

async function getBotAdminIds() {
    try {
        const raw = JSON.parse(await fs.readFile(BOT_ADMINS_FILE, "utf-8"));
        return normalizeChatIds((raw.admins || []).map((admin) => admin.telegramId));
    } catch {
        return [];
    }
}

function decodeJwtPayload(token) {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;

    try {
        return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    } catch {
        return null;
    }
}

function buildTokenFingerprint(token) {
    return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "неизвестно";
    return new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Moscow",
    }).format(date);
}

function formatRemaining(remainingMs) {
    const totalHours = Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    if (days > 0 && hours > 0) {
        return `${days} д. ${hours} ч.`;
    }
    if (days > 0) {
        return `${days} д.`;
    }
    return `${hours} ч.`;
}

function collectExpiringQwenTokens(settings, now = Date.now()) {
    const primaryEntries = normalizeQwenTokenEntries(settings.qwenTokens).map((entry, index) => ({
        ...entry,
        source: "primary",
        fallbackName: `Qwen токен ${index + 1}`,
    }));
    const backupEntry = normalizeQwenTokenEntries(settings.qwenBackupToken)[0];
    const allEntries = backupEntry
        ? [...primaryEntries, { ...backupEntry, source: "backup", fallbackName: "Резервный Qwen токен" }]
        : primaryEntries;

    return allEntries
        .map((entry) => {
            const payload = decodeJwtPayload(entry.token);
            const exp = Number(payload?.exp);
            if (!Number.isFinite(exp)) return null;

            const expiresAt = new Date(exp * 1000).toISOString();
            const expiresTs = Date.parse(expiresAt);
            if (!Number.isFinite(expiresTs) || expiresTs <= now) return null;

            return {
                name: entry.name || entry.fallbackName,
                expiresAt,
                expiresTs,
                fingerprint: buildTokenFingerprint(entry.token),
                mask: maskSecret(entry.token),
                source: entry.source,
            };
        })
        .filter(Boolean);
}

function collectDueReminders(tokens, state, now = Date.now()) {
    const due = [];
    const sent = state?.sent && typeof state.sent === "object" ? state.sent : {};

    for (const token of tokens) {
        const remainingMs = token.expiresTs - now;
        for (const window of REMINDER_WINDOWS) {
            if (remainingMs > window.thresholdMs) {
                continue;
            }

            const sentKey = `${token.fingerprint}:${token.expiresTs}:${window.key}`;
            if (sent[sentKey]) {
                continue;
            }

            due.push({
                ...token,
                windowKey: window.key,
                windowLabel: window.label,
                remainingMs,
                sentKey,
            });
        }
    }

    return due.sort((left, right) => left.expiresTs - right.expiresTs);
}

function buildReminderMessage(reminders) {
    const grouped = new Map();
    for (const reminder of reminders) {
        if (!grouped.has(reminder.windowLabel)) {
            grouped.set(reminder.windowLabel, []);
        }
        grouped.get(reminder.windowLabel).push(reminder);
    }

    const lines = ["<b>Напоминание по Qwen-токенам</b>", ""];
    for (const [windowLabel, items] of grouped.entries()) {
        lines.push(`<b>Истекают ${windowLabel}:</b>`);
        for (const item of items) {
            lines.push(
                `• ${item.name} (${item.mask || "****"})`,
                `  До: ${formatDateTime(item.expiresAt)} МСК`,
                `  Осталось: ${formatRemaining(item.remainingMs)}`
            );
        }
        lines.push("");
    }

    lines.push("Если нужно, обновите токен заранее в настройках МАЯК.");
    return lines.join("\n");
}

function pruneReminderState(state, now = Date.now()) {
    const nextState = { sent: {} };
    const sent = state?.sent && typeof state.sent === "object" ? state.sent : {};

    for (const [key, value] of Object.entries(sent)) {
        const sentAt = Date.parse(value?.sentAt || "");
        if (!Number.isFinite(sentAt)) continue;
        if (now - sentAt > 30 * DAY_MS) continue;
        nextState.sent[key] = value;
    }

    return nextState;
}

async function getReminderRecipients(settings) {
    const explicit = normalizeChatIds(settings.qwenReminderChatIds);
    if (explicit.length > 0) {
        return explicit;
    }
    return getBotAdminIds();
}

async function sendTelegramReminderMessage(chatId, text, botToken) {
    const settings = await readMayakSettings();
    const apiBase = String(settings.telegramApiBase || process.env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/+$/, "");
    const gatewaySecret = String(settings.telegramGatewaySecret || process.env.TELEGRAM_GATEWAY_SECRET || "").trim();
    const headers = { "Content-Type": "application/json" };
    if (gatewaySecret) {
        headers["X-Telegram-Gateway-Secret"] = gatewaySecret;
    }

    const response = await fetch(`${apiBase}/bot${botToken}/sendMessage`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
        }),
    });

    const data = await response.json();
    if (!data.ok) {
        throw new Error(data.description || `HTTP ${response.status}`);
    }
}

export async function runQwenReminderCheck({ now = Date.now() } = {}) {
    const settings = await readMayakSettings();
    const botToken = String(settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!botToken) {
        return { sentCount: 0, skipped: "missing_bot_token" };
    }

    const recipients = await getReminderRecipients(settings);
    if (recipients.length === 0) {
        return { sentCount: 0, skipped: "missing_chat_ids" };
    }

    const tokens = collectExpiringQwenTokens(settings, now);
    if (tokens.length === 0) {
        return { sentCount: 0, skipped: "no_tokens_with_exp" };
    }

    const initialState = pruneReminderState(await readReminderState(), now);
    const due = collectDueReminders(tokens, initialState, now);
    if (due.length === 0) {
        await writeReminderState(initialState);
        return { sentCount: 0, skipped: "nothing_due" };
    }

    const message = buildReminderMessage(due);
    const successfulRecipients = [];
    const failedRecipients = [];

    for (const chatId of recipients) {
        try {
            await sendTelegramReminderMessage(chatId, message, botToken);
            successfulRecipients.push(chatId);
        } catch (error) {
            failedRecipients.push({
                chatId,
                error: error.message,
            });
        }
    }

    if (successfulRecipients.length === 0) {
        return {
            sentCount: 0,
            skipped: "delivery_failed",
            failedRecipients,
        };
    }

    for (const reminder of due) {
        initialState.sent[reminder.sentKey] = {
            sentAt: new Date(now).toISOString(),
            chatIds: successfulRecipients,
            expiresAt: reminder.expiresAt,
            tokenName: reminder.name,
            windowKey: reminder.windowKey,
        };
    }

    await writeReminderState(initialState);
    return {
        sentCount: due.length,
        recipientCount: successfulRecipients.length,
        failedRecipients,
    };
}
