/**
 * Telegram Bot Polling Script для тренажёра МАЯК
 *
 * Запуск: node scripts/telegram-bot.js
 *
 * Бот слушает команды /start SESSION_ID и отправляет
 * сертификат и лог-файл пользователю в Telegram.
 */

const fs = require('fs');
const path = require('path');

// --- Загрузка .env ---
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = val;
    }
  });
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN не задан в .env');
  process.exit(1);
}

const SESSIONS_DIR = path.join(__dirname, '..', 'data', 'telegram-sessions');
const SESSIONS_FILE = path.join(SESSIONS_DIR, 'sessions.json');
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

let lastUpdateId = 0;

// --- Утилиты ---

function getSessions() {
  if (!fs.existsSync(SESSIONS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveSessions(sessions) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

async function sendMessage(chatId, text) {
  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  return res.json();
}

async function sendDocument(chatId, fileBuffer, filename, caption) {
  const formData = new FormData();
  formData.append('chat_id', chatId.toString());
  formData.append('document', new Blob([fileBuffer]), filename);
  if (caption) formData.append('caption', caption);

  const res = await fetch(`${API_BASE}/sendDocument`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

// --- Обработка команды /start ---

async function handleStart(chatId, sessionId, firstName) {
  if (!sessionId) {
    await sendMessage(chatId,
      `Привет, ${firstName}! 👋\n\nЯ бот тренажёра МАЯК.\nЗавершите сессию в тренажёре и нажмите кнопку "Получить в Telegram" — я пришлю вам сертификат и лог.`
    );
    return;
  }

  const sessions = getSessions();
  const session = sessions[sessionId];

  if (!session) {
    await sendMessage(chatId,
      '❌ Сессия не найдена или истекла (24 часа). Пожалуйста, завершите тренажёр заново.'
    );
    return;
  }

  const certPath = path.join(SESSIONS_DIR, `${sessionId}_cert.pdf`);
  const logPath = path.join(SESSIONS_DIR, `${sessionId}_log.pdf`);

  if (!fs.existsSync(certPath) || !fs.existsSync(logPath)) {
    await sendMessage(chatId, '❌ Файлы сессии не найдены. Возможно, они были удалены.');
    return;
  }

  await sendMessage(chatId,
    `📋 Отправляю файлы для: <b>${session.userName}</b>`
  );

  // Отправляем сертификат
  const certBuffer = fs.readFileSync(certPath);
  const certResult = await sendDocument(
    chatId,
    certBuffer,
    `Сертификат_МАЯК_${session.userName.replace(/\s+/g, '_')}.pdf`,
    '🎓 Сертификат о прохождении тренажёра МАЯК'
  );

  if (!certResult.ok) {
    console.error('Ошибка отправки сертификата:', certResult);
    await sendMessage(chatId, '⚠️ Ошибка при отправке сертификата.');
  }

  // Отправляем лог
  const logBuffer = fs.readFileSync(logPath);
  const logResult = await sendDocument(
    chatId,
    logBuffer,
    `Лог_МАЯК_${session.userName.replace(/\s+/g, '_')}.pdf`,
    '📊 Протокол прохождения тренажёра МАЯК'
  );

  if (!logResult.ok) {
    console.error('Ошибка отправки лога:', logResult);
    await sendMessage(chatId, '⚠️ Ошибка при отправке лога.');
  }

  // Отмечаем как доставленное
  sessions[sessionId].delivered = true;
  sessions[sessionId].deliveredTo = chatId;
  sessions[sessionId].deliveredAt = new Date().toISOString();
  saveSessions(sessions);

  await sendMessage(chatId, '✅ Готово! Файлы отправлены.');
  console.log(`[${new Date().toISOString()}] Файлы отправлены: session=${sessionId}, chat=${chatId}, user=${session.userName}`);
}

// --- Polling ---

async function getUpdates() {
  try {
    const res = await fetch(`${API_BASE}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
    const data = await res.json();

    if (!data.ok || !data.result || data.result.length === 0) return;

    for (const update of data.result) {
      lastUpdateId = update.update_id;

      const message = update.message;
      if (!message || !message.text) continue;

      const chatId = message.chat.id;
      const text = message.text.trim();
      const firstName = message.from?.first_name || 'пользователь';

      if (text.startsWith('/start')) {
        const sessionId = text.split(' ')[1] || '';
        await handleStart(chatId, sessionId.trim(), firstName);
      }
    }
  } catch (error) {
    console.error('Ошибка polling:', error.message);
  }
}

// --- Главный цикл ---

async function main() {
  // Удаляем webhook если был (для перехода на polling)
  await fetch(`${API_BASE}/deleteWebhook`);

  console.log('🤖 Telegram-бот МАЯК запущен (polling mode)');
  console.log(`   Бот: @${process.env.TELEGRAM_BOT_USERNAME || 'unknown'}`);
  console.log(`   Сессии: ${SESSIONS_DIR}`);
  console.log('   Нажмите Ctrl+C для остановки\n');

  while (true) {
    await getUpdates();
  }
}

main().catch(err => {
  console.error('Критическая ошибка:', err);
  process.exit(1);
});
