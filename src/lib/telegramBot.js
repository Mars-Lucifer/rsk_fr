import { maskSecret, normalizeQwenTokenEntries } from './mayakQwen.js';
import { readMayakSettings } from './mayakSettings.js';

const DEFAULT_TELEGRAM_API_BASE = 'https://api.telegram.org';
const QWEN_COMMANDS = [
  { command: 'start', description: 'Показать сроки Qwen-токенов' },
  { command: 'qwen_tokens', description: 'Показать сроки Qwen-токенов' },
];

async function getStoredMayakSettings() {
  try {
    return await readMayakSettings();
  } catch {
    return {};
  }
}

async function getTelegramConfig() {
  const settings = await getStoredMayakSettings();
  const token = String(process.env.TELEGRAM_BOT_TOKEN || settings.telegramBotToken || '').trim();
  if (!token) return null;

  const apiRoot = String(
    process.env.TELEGRAM_API_BASE ||
      settings.telegramApiBase ||
      DEFAULT_TELEGRAM_API_BASE
  ).replace(/\/+$/, '');

  return {
    apiBase: `${apiRoot}/bot${token}`,
    gatewaySecret: String(
      process.env.TELEGRAM_GATEWAY_SECRET ||
        settings.telegramGatewaySecret ||
        ''
    ).trim(),
    webhookUrl: String(
      process.env.TELEGRAM_WEBHOOK_URL ||
        settings.telegramWebhookUrl ||
        ''
    ).trim(),
  };
}

function withGatewaySecret(headers = {}, gatewaySecret = '') {
  if (!gatewaySecret) return headers;
  return { ...headers, 'X-Telegram-Gateway-Secret': gatewaySecret };
}

async function telegramFetch(config, method, init = {}) {
  return fetch(`${config.apiBase}/${method}`, {
    ...init,
    headers: withGatewaySecret(init.headers || {}, config.gatewaySecret),
  });
}

async function sendMessage(config, chatId, text) {
  const response = await telegramFetch(config, 'sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });

  return response.json();
}

function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;

  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

function formatDateTimeMsk(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'неизвестно';

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  }).format(date);
}

function formatRemainingTime(remainingMs) {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return 'истёк';
  }

  const totalMinutes = Math.ceil(remainingMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} д. ${hours} ч.`;
  if (hours > 0) return `${hours} ч. ${minutes} мин.`;
  return `${minutes} мин.`;
}

function collectQwenTokenEntries(settings) {
  const primaryTokens = normalizeQwenTokenEntries(settings.qwenTokens).map((entry, index) => ({
    ...entry,
    fallbackName: `Qwen токен ${index + 1}`,
  }));
  const backupToken = normalizeQwenTokenEntries(settings.qwenBackupToken)[0];

  return backupToken
    ? [...primaryTokens, { ...backupToken, fallbackName: 'Резервный Qwen токен' }]
    : primaryTokens;
}

function buildQwenStatusMessage(settings) {
  const tokens = collectQwenTokenEntries(settings);
  if (tokens.length === 0) {
    return 'Qwen-токены не настроены.';
  }

  const lines = ['<b>Qwen-токены</b>', ''];

  tokens.forEach((entry) => {
    const tokenName = String(entry.name || entry.fallbackName).trim();
    const payload = decodeJwtPayload(entry.token);
    const exp = Number(payload?.exp);

    lines.push(`• <b>${tokenName}</b>`);
    lines.push(`  Токен: <code>${maskSecret(entry.token) || '****'}</code>`);

    if (!Number.isFinite(exp)) {
      lines.push('  Срок: не удалось определить', '');
      return;
    }

    const expiresAt = new Date(exp * 1000).toISOString();
    const remainingMs = Date.parse(expiresAt) - Date.now();
    lines.push(`  Истекает: ${formatDateTimeMsk(expiresAt)} МСК`);
    lines.push(`  Осталось: ${formatRemainingTime(remainingMs)}`, '');
  });

  return lines.join('\n').trim();
}

async function sendQwenStatus(config, chatId) {
  const settings = await getStoredMayakSettings();
  await sendMessage(config, chatId, buildQwenStatusMessage(settings));
}

async function registerCommands(config) {
  const response = await telegramFetch(config, 'setMyCommands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands: QWEN_COMMANDS }),
  });

  const data = await response.json();
  if (!data.ok) {
    console.error('[TG Bot] Ошибка регистрации команд:', data);
  }
}

async function registerWebhook(config) {
  if (!config.webhookUrl) return null;

  const response = await telegramFetch(config, 'setWebhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: config.webhookUrl }),
  });

  const data = await response.json();
  if (!data.ok) {
    console.error('[TG Bot] Ошибка регистрации webhook:', data);
  }
  return data;
}

export async function processUpdate(update) {
  const config = await getTelegramConfig();
  if (!config) return;

  const message = update?.message;
  const chatId = message?.chat?.id;
  if (!chatId) return;

  const text = String(message.text || '').trim();
  if (text === '/start' || text === '/qwen_tokens' || text) {
    await sendQwenStatus(config, chatId);
  }
}

async function pollOnce(config) {
  try {
    const offset = globalThis.__tgBotLastUpdateId || 0;
    globalThis.__tgBotAbortController = new AbortController();

    const response = await telegramFetch(config, `getUpdates?offset=${offset + 1}&timeout=25`, {
      signal: globalThis.__tgBotAbortController.signal,
    });
    const data = await response.json();

    if (!data.ok || !Array.isArray(data.result)) {
      return;
    }

    for (const update of data.result) {
      globalThis.__tgBotLastUpdateId = update.update_id;
      await processUpdate(update);
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('[TG Bot] Ошибка polling:', error.message);
    }
  }
}

async function pollingLoop(config) {
  while (globalThis.__tgBotRunning) {
    await pollOnce(config);
  }
}

export function stopBot() {
  globalThis.__tgBotRunning = false;
  if (globalThis.__tgBotAbortController) {
    globalThis.__tgBotAbortController.abort();
    globalThis.__tgBotAbortController = null;
  }
}

export async function restartBot() {
  stopBot();
  await new Promise((resolve) => setTimeout(resolve, 500));
  startBot();
}

export async function startBot() {
  if (globalThis.__tgBotRunning) return;

  const config = await getTelegramConfig();
  if (!config) {
    console.warn('[TG Bot] TELEGRAM_BOT_TOKEN не задан, бот не запущен');
    return;
  }

  globalThis.__tgBotRunning = true;

  try {
    await registerCommands(config);

    if (config.webhookUrl) {
      await registerWebhook(config);
      console.log('[TG Bot] Бот работает в режиме webhook');
      return;
    }

    await telegramFetch(config, 'deleteWebhook');
    const response = await telegramFetch(config, 'getUpdates?offset=-1');
    const data = await response.json();

    if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
      globalThis.__tgBotLastUpdateId = data.result[data.result.length - 1].update_id;
    } else {
      globalThis.__tgBotLastUpdateId = 0;
    }

    console.log('[TG Bot] Бот работает в режиме polling');
    pollingLoop(config);
  } catch (error) {
    globalThis.__tgBotRunning = false;
    console.error('[TG Bot] Ошибка запуска:', error.message);
  }
}
