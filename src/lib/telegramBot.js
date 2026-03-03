import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generateAnalytics } from './analyticsGenerator.js';
import {
  createRequest,
  submitCode,
  getRequestByTelegramId,
  getApprovedRequest,
} from '../utils/tokenRequests.js';
import { getTokenById } from '../utils/mayakTokens.js';

const SESSIONS_DIR = path.join(process.cwd(), 'data', 'telegram-sessions');
const SESSIONS_FILE = path.join(SESSIONS_DIR, 'sessions.json');
const BOT_ADMINS_FILE = path.join(process.cwd(), 'data', 'botAdmins.json');

function getBotAdminIds() {
  try {
    if (!fs.existsSync(BOT_ADMINS_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(BOT_ADMINS_FILE, 'utf-8'));
    return (data.admins || []).map(a => Number(a.telegramId));
  } catch {
    return [];
  }
}

function isBotAdmin(fromId) {
  const adminIds = getBotAdminIds();
  return adminIds.includes(Number(fromId));
}

// --- Prep sessions (из session-app) ---
const PREP_DIR = path.join(process.cwd(), 'data', 'prep-sessions');

function getPrepSessionPath(id) {
  return path.join(PREP_DIR, `session_${id}.json`);
}

function loadPrepSession(id) {
  const p = getPrepSessionPath(id);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch { return null; }
}

function savePrepSession(session) {
  if (!fs.existsSync(PREP_DIR)) {
    fs.mkdirSync(PREP_DIR, { recursive: true });
  }
  fs.writeFileSync(getPrepSessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');
}

function getAllPrepSessions() {
  if (!fs.existsSync(PREP_DIR)) return [];
  return fs.readdirSync(PREP_DIR)
    .filter(f => f.startsWith('session_') && f.endsWith('.json'))
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(PREP_DIR, f), 'utf-8'));
      } catch { return null; }
    })
    .filter(Boolean);
}

function formatPrepStatus(session) {
  const techEntries = Object.entries(session.techSpecialists || {});
  const partEntries = Object.entries(session.participants || {});

  const techDone = techEntries.filter(([, t]) => {
    const tasks = Object.values(t.tasks || {});
    return tasks.length > 0 && tasks.every(task => task.status === 'done');
  }).length;

  const partDone = partEntries.filter(([, p]) => p.overallStatus === 'done').length;

  let msg = `📊 Сессия: "${session.name}"\n\n`;

  msg += `🔧 Тех. специалисты (${techDone}/${techEntries.length} готовы):\n`;
  for (const [, tech] of techEntries) {
    const tasks = tech.tasks || {};
    const workspace = tasks.workspace?.status === 'done' ? '✅' : '❌';
    const multimedia = tasks.multimedia?.status === 'done' ? '✅' : '❌';
    const devices = tasks.devices?.status === 'done' ? '✅' : '❌';
    msg += `  ${tech.name}: Пространство ${workspace} | Мультимедиа ${multimedia} | Устройства ${devices}\n`;
  }

  msg += `\n👤 Участники (${partDone}/${partEntries.length} готовы):\n`;
  for (const [, part] of partEntries) {
    let icon, label;
    if (part.overallStatus === 'done') {
      icon = '✅'; label = 'Готов';
    } else if (part.overallStatus === 'in_progress') {
      const tasks = Object.values(part.tasks || {});
      const done = tasks.filter(t => t.status === 'done').length;
      icon = '🔄'; label = `В процессе (${done}/${tasks.length})`;
    } else {
      icon = '⏳'; label = 'Не начал';
    }
    msg += `  ${part.name} — ${icon} ${label}\n`;
  }

  return msg;
}

// Состояние ожидания ссылки на канал при создании сессии { telegramId: { name, chatId } }


// Лок для защиты от параллельной обработки одной и той же сессии
const processingLocks = new Set();

function getApiBase() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  return `https://api.telegram.org/bot${token}`;
}

function getSessions() {
  if (!fs.existsSync(SESSIONS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveSessions(sessions) {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

// Атомарное обновление одной сессии — перечитывает файл перед записью
function updateSession(sessionId, updates) {
  const sessions = getSessions();
  if (!sessions[sessionId]) return;
  Object.assign(sessions[sessionId], updates);
  saveSessions(sessions);
}

async function sendMessage(apiBase, chatId, text) {
  const res = await fetch(`${apiBase}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  return res.json();
}

async function sendDocument(apiBase, chatId, fileBuffer, filename, caption) {
  const formData = new FormData();
  formData.append('chat_id', chatId.toString());
  formData.append('document', new Blob([fileBuffer]), filename);
  if (caption) formData.append('caption', caption);

  const res = await fetch(`${apiBase}/sendDocument`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

// --- Обработчики команд prep-сессий ---

async function handleNewSession(apiBase, chatId, name, fromId) {
  const id = crypto.randomBytes(4).toString('hex');
  const session = {
    id,
    name,
    created: new Date().toISOString(),
    createdBy: fromId,
    techSpecialists: {},
    participants: {},
  };
  savePrepSession(session);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://rosdk.ru';
  const webappLink = `${baseUrl}/prep-session?session=${id}`;
  await sendMessage(apiBase, chatId,
    `✅ Сессия "<b>${name}</b>" создана!\n\n🆔 ID: <code>${id}</code>\n\n🔗 Ссылка на подготовку:\n<code>${webappLink}</code>\n\nОтправьте эту ссылку тех. специалисту.`
  );
  console.log(`[TG Bot] Prep-сессия создана: id=${id}, name=${name}`);
}

async function handleSessions(apiBase, chatId) {
  const sessions = getAllPrepSessions();
  if (sessions.length === 0) {
    await sendMessage(apiBase, chatId, 'Нет активных сессий. Создайте новую: /new_session <название>');
    return;
  }
  let text = '📋 Активные сессии:\n\n';
  for (const s of sessions) {
    const techCount = Object.keys(s.techSpecialists || {}).length;
    const partCount = Object.keys(s.participants || {}).length;
    text += `• "${s.name}" (ID: ${s.id})\n  Тех: ${techCount}, Участники: ${partCount}\n\n`;
  }
  await sendMessage(apiBase, chatId, text);
}

async function handlePrepStatus(apiBase, chatId, sessionId) {
  let session;

  if (sessionId) {
    session = loadPrepSession(sessionId);
  } else {
    const sessions = getAllPrepSessions();
    session = sessions[sessions.length - 1];
  }

  if (!session) {
    await sendMessage(apiBase, chatId, 'Сессия не найдена. Используйте /sessions для списка.');
    return;
  }

  await sendMessage(apiBase, chatId, formatPrepStatus(session));
}

// --- Обработчик запроса токена ---

async function handleTokenRequest(apiBase, chatId, fromId, username, firstName) {
  // Проверяем, есть ли уже одобренный запрос (= пользователь уже получил токен)
  const approved = getApprovedRequest(fromId);
  if (approved && approved.assignedTokenId) {
    const token = getTokenById(approved.assignedTokenId);
    if (token) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://self.rosdk.ru';
      await sendMessage(apiBase, chatId,
        `🔑 Ваш токен:\n<code>${token.token}</code>\n\n` +
        `🎯 Перейти в тренажёр МАЯК:\n${baseUrl}/tools/mayak-oko`
      );
      return;
    }
  }

  // Проверяем, есть ли активный запрос
  const awaitingCode = getRequestByTelegramId(fromId, 'awaiting_code');
  if (awaitingCode) {
    await sendMessage(apiBase, chatId, '⏳ Введите секретный код для получения доступа:');
    return;
  }

  const pending = getRequestByTelegramId(fromId, 'pending');
  if (pending) {
    await sendMessage(apiBase, chatId,
      '⏳ Ваш запрос уже отправлен и ожидает рассмотрения администратором.\n\n' +
      `Секретный код: <code>${pending.secretCode}</code>`
    );
    return;
  }

  // Создаём новый запрос
  const result = createRequest(fromId, username, firstName);
  if (result.created) {
    await sendMessage(apiBase, chatId, '🔐 Введите секретный код для получения доступа:');
  } else {
    await sendMessage(apiBase, chatId, '⏳ У вас уже есть активный запрос. Ожидайте решения администратора.');
  }
}

// --- Обработчик МАЯК-сертификатов ---

async function handleStart(apiBase, chatId, sessionId, firstName) {
  if (!sessionId) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://self.rosdk.ru';
    await sendMessage(apiBase, chatId,
      `Привет, ${firstName}!\n\n` +
      `<b>🎯 Тренажёр МАЯК</b>\n` +
      `Перейти в тренажёр: ${baseUrl}/tools/mayak-oko\n\n` +
      `<b>🔑 Доступ</b>\n` +
      `/token — получить токен для входа в тренажёр`
    );
    return;
  }

  // Защита от параллельной обработки одной сессии
  if (processingLocks.has(sessionId)) {
    await sendMessage(apiBase, chatId, 'Файлы уже отправляются, подождите...');
    return;
  }

  const sessions = getSessions();
  const session = sessions[sessionId];

  if (!session) {
    await sendMessage(apiBase, chatId,
      'Сессия не найдена или истекла (24 часа). Пожалуйста, завершите тренажёр заново.'
    );
    return;
  }

  // Защита от повторной отправки
  if (session.delivered) {
    await sendMessage(apiBase, chatId, 'Файлы для этой сессии уже были отправлены ранее.');
    return;
  }

  const certPath = path.join(SESSIONS_DIR, `${sessionId}_cert.pdf`);
  const logPath = path.join(SESSIONS_DIR, `${sessionId}_log.pdf`);

  if (!fs.existsSync(certPath) || !fs.existsSync(logPath)) {
    await sendMessage(apiBase, chatId, 'Файлы сессии не найдены. Возможно, они были удалены.');
    return;
  }

  // Ставим лок
  processingLocks.add(sessionId);

  try {
    const safeName = session.userName.replace(/\s+/g, '_');

    await sendMessage(apiBase, chatId,
      `Отправляю файлы для: <b>${session.userName}</b>`
    );

    // 1. Сертификат
    const certBuffer = fs.readFileSync(certPath);
    const certResult = await sendDocument(
      apiBase, chatId, certBuffer,
      `Сертификат_МАЯК_${safeName}.pdf`,
      'Сертификат о прохождении тренажёра МАЯК'
    );
    if (!certResult.ok) {
      console.error('[TG Bot] Ошибка отправки сертификата:', certResult);
    }

    // 2. Лог
    const logBuffer = fs.readFileSync(logPath);
    const logResult = await sendDocument(
      apiBase, chatId, logBuffer,
      `Лог_МАЯК_${safeName}.pdf`,
      'Протокол прохождения тренажёра МАЯК'
    );
    if (!logResult.ok) {
      console.error('[TG Bot] Ошибка отправки лога:', logResult);
    }

    // 3. Аналитика (генерируется через LLM)
    if (session.hasLogData) {
      await sendMessage(apiBase, chatId, 'Формирую аналитический отчёт, подождите...');

      try {
        const analyticsPath = await generateAnalytics(sessionId, SESSIONS_DIR);
        const analyticsBuffer = fs.readFileSync(analyticsPath);
        const analyticsResult = await sendDocument(
          apiBase, chatId, analyticsBuffer,
          `Аналитика_МАЯК_${safeName}.pdf`,
          'Аналитический отчёт по прохождению тренажёра МАЯК'
        );
        if (!analyticsResult.ok) {
          console.error('[TG Bot] Ошибка отправки аналитики:', analyticsResult);
        }
      } catch (error) {
        console.error('[TG Bot] Ошибка генерации аналитики:', error);
        await sendMessage(apiBase, chatId, 'Не удалось сформировать аналитический отчёт. Сертификат и лог отправлены.');
      }
    }

    // Атомарно отмечаем как доставленное (перечитываем файл)
    updateSession(sessionId, {
      delivered: true,
      deliveredTo: chatId,
      deliveredAt: new Date().toISOString(),
    });

    await sendMessage(apiBase, chatId, 'Готово! Все файлы отправлены.');
    console.log(`[TG Bot] Файлы отправлены: session=${sessionId}, chat=${chatId}, user=${session.userName}`);
  } finally {
    // Снимаем лок в любом случае
    processingLocks.delete(sessionId);
  }
}

// Обработка одного update от Telegram (используется и polling, и webhook)
export async function processUpdate(update) {
  const apiBase = getApiBase();
  if (!apiBase) return;

  const message = update.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const firstName = message.from?.first_name || 'пользователь';
  const fromId = message.from?.id;

  // /new_session <название> — только админ
  const newSessionMatch = text.match(/^\/new_session\s+(.+)/);
  if (newSessionMatch) {
    if (!isBotAdmin(fromId)) {
      await sendMessage(apiBase, chatId, '🔒 У вас нет доступа к этой команде.');
      return;
    }
    await handleNewSession(apiBase, chatId, newSessionMatch[1].trim(), fromId);
    return;
  }

  // /sessions — только админ
  if (text === '/sessions') {
    if (!isBotAdmin(fromId)) {
      await sendMessage(apiBase, chatId, '🔒 У вас нет доступа к этой команде.');
      return;
    }
    await handleSessions(apiBase, chatId);
    return;
  }

  // /status [id] — только админ
  const statusMatch = text.match(/^\/status(?:\s+(.+))?$/);
  if (statusMatch) {
    if (!isBotAdmin(fromId)) {
      await sendMessage(apiBase, chatId, '🔒 У вас нет доступа к этой команде.');
      return;
    }
    await handlePrepStatus(apiBase, chatId, statusMatch[1]?.trim());
    return;
  }

  // /token — запрос токена доступа
  if (text === '/token') {
    await handleTokenRequest(apiBase, chatId, message.from?.id, message.from?.username, firstName);
    return;
  }

  // /start [sessionId]
  if (text.startsWith('/start')) {
    const sessionId = text.split(' ')[1] || '';
    await handleStart(apiBase, chatId, sessionId.trim(), firstName);
    return;
  }

  // Перехват текста от пользователей в статусе awaiting_code (ввод секретного кода)
  if (fromId) {
    const awaitingRequest = getRequestByTelegramId(fromId, 'awaiting_code');
    if (awaitingRequest) {
      const updated = submitCode(fromId, text);
      if (updated) {
        await sendMessage(apiBase, chatId,
          '✅ Секретный код принят!\n\n' +
          'Ваш запрос отправлен администратору. Ожидайте подтверждения.\n' +
          'Проверить статус: /token'
        );
        // Уведомляем всех админов бота
        const adminIds = getBotAdminIds();
        for (const adminId of adminIds) {
          await sendMessage(apiBase, adminId,
            `🔔 Новый запрос на токен!\n\n` +
            `👤 ${firstName}${message.from?.username ? ` (@${message.from.username})` : ''}\n` +
            `🔑 Код: <code>${text}</code>\n\n` +
            `Откройте админ-панель токенов для управления.`
          );
        }
      } else {
        await sendMessage(apiBase, chatId, 'Ошибка сохранения кода. Попробуйте /token заново.');
      }
      return;
    }
  }
}

// --- Polling (для локальной разработки) ---

async function pollOnce(apiBase) {
  try {
    const offset = globalThis.__tgBotLastUpdateId || 0;
    // Используем глобальный AbortController для возможности отмены при restartBot
    globalThis.__tgBotAbortController = new AbortController();
    const res = await fetch(`${apiBase}/getUpdates?offset=${offset + 1}&timeout=25`, {
      signal: globalThis.__tgBotAbortController.signal,
    });
    const data = await res.json();

    if (!data.ok || !data.result || data.result.length === 0) return;

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

async function pollingLoop(apiBase) {
  while (globalThis.__tgBotRunning) {
    await pollOnce(apiBase);
  }
}

// --- Регистрация webhook (для продакшена) ---

async function registerWebhook(apiBase, webhookUrl) {
  const res = await fetch(`${apiBase}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  });
  const data = await res.json();
  if (data.ok) {
    console.log(`[TG Bot] Webhook зарегистрирован: ${webhookUrl}`);
  } else {
    console.error('[TG Bot] Ошибка регистрации webhook:', data);
  }
  return data;
}

// --- Регистрация команд в меню Telegram ---

async function registerCommands(apiBase) {
  try {
    // Команды для всех пользователей
    await fetch(`${apiBase}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start', description: 'Начать работу с ботом' },
          { command: 'token', description: 'Запросить токен доступа' },
        ],
      }),
    });

    // Дополнительные команды для админов
    const adminIds = getBotAdminIds();
    for (const adminId of adminIds) {
      await fetch(`${apiBase}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: { type: 'chat', chat_id: adminId },
          commands: [
            { command: 'start', description: 'Начать работу с ботом' },
            { command: 'token', description: 'Запросить токен доступа' },
            { command: 'new_session', description: 'Создать prep-сессию' },
            { command: 'sessions', description: 'Список активных сессий' },
            { command: 'status', description: 'Статус последней сессии' },
          ],
        }),
      });
    }

    console.log('[TG Bot] Команды зарегистрированы');
  } catch (err) {
    console.error('[TG Bot] Ошибка регистрации команд:', err.message);
  }
}

// --- Остановка и перезапуск бота ---

export function stopBot() {
  globalThis.__tgBotRunning = false;
  // Прерываем текущий polling-запрос если он активен
  if (globalThis.__tgBotAbortController) {
    globalThis.__tgBotAbortController.abort();
    globalThis.__tgBotAbortController = null;
  }
}

export async function restartBot() {
  const wasRunning = globalThis.__tgBotRunning;
  stopBot();

  // В webhook-режиме удаляем старый webhook перед перезапуском
  if (wasRunning) {
    try {
      const oldApiBase = getApiBase();
      if (oldApiBase) {
        await fetch(`${oldApiBase}/deleteWebhook`);
      }
    } catch {}
  }

  // Даём время polling-циклу завершиться после abort
  await new Promise(r => setTimeout(r, 500));
  startBot();
}

// --- Запуск бота ---

export function startBot() {
  if (globalThis.__tgBotRunning) return;

  const apiBase = getApiBase();
  if (!apiBase) {
    console.warn('[TG Bot] TELEGRAM_BOT_TOKEN не задан, бот не запущен');
    return;
  }

  globalThis.__tgBotRunning = true;

  // Регистрируем команды в меню Telegram
  registerCommands(apiBase);

  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

  if (webhookUrl) {
    // Продакшен: регистрируем webhook, Telegram сам шлёт на /api/mayak/telegram-webhook
    registerWebhook(apiBase, webhookUrl)
      .then(() => console.log('[TG Bot] Бот работает в режиме webhook'))
      .catch(err => {
        console.error('[TG Bot] Ошибка регистрации webhook:', err.message);
        globalThis.__tgBotRunning = false;
      });
  } else {
    // Локальная разработка: polling
    // Сначала пропускаем накопившиеся старые updates, чтобы не обрабатывать их повторно
    fetch(`${apiBase}/deleteWebhook`)
      .then(() => fetch(`${apiBase}/getUpdates?offset=-1`))
      .then(res => res.json())
      .then(data => {
        // Устанавливаем offset на последний update, чтобы пропустить старые
        if (data.ok && data.result && data.result.length > 0) {
          globalThis.__tgBotLastUpdateId = data.result[data.result.length - 1].update_id;
          console.log(`[TG Bot] Пропущено старых updates, offset=${globalThis.__tgBotLastUpdateId}`);
        } else {
          globalThis.__tgBotLastUpdateId = 0;
        }
        console.log('[TG Bot] Бот работает в режиме polling (dev)');
        pollingLoop(apiBase);
      })
      .catch(err => {
        console.error('[TG Bot] Ошибка запуска polling:', err.message);
        globalThis.__tgBotRunning = false;
      });
  }
}
