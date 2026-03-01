const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data', 'sessions');

function getSessionPath(id) {
  return path.join(DATA_DIR, `session_${id}.json`);
}

function loadSession(id) {
  const p = getSessionPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveSession(session) {
  fs.writeFileSync(getSessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');
}

function getAllSessions() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('session_') && f.endsWith('.json'))
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'));
      } catch { return null; }
    })
    .filter(Boolean);
}

function formatStatus(session) {
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
    const internet = tasks.internet?.status === 'done' ? '✅' : '❌';
    const workspace = tasks.workspace?.status === 'done' ? '✅' : '❌';
    const laptops = tasks.laptops?.status === 'done' ? '✅' : '❌';
    msg += `  ${tech.name}: Интернет ${internet} | Пространство ${workspace} | Ноутбуки ${laptops}\n`;
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

function initBot() {
  const token = process.env.BOT_TOKEN;
  if (!token || token === 'your_telegram_bot_token_here') {
    console.log('BOT_TOKEN not configured, bot disabled');
    return { sendMessage: () => {} };
  }

  const bot = new TelegramBot(token, { polling: true });
  const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
  const WEBAPP_URL = process.env.WEBAPP_URL || 'https://your-domain.com';

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
      '👋 Привет! Я бот для управления сессиями обучения.\n\n' +
      'Команды:\n' +
      '/new_session <название> — создать новую сессию\n' +
      '/sessions — список всех сессий\n' +
      '/status — сводка по последней сессии\n' +
      '/status <id> — сводка по конкретной сессии'
    );
  });

  bot.onText(/\/new_session (.+)/, (msg, match) => {
    const name = match[1].trim();
    const id = uuidv4().slice(0, 8);
    const session = {
      id,
      name,
      created: new Date().toISOString(),
      createdBy: msg.from.id,
      techSpecialists: {},
      participants: {}
    };
    saveSession(session);

    const webappLink = `${WEBAPP_URL}?session=${id}`;
    bot.sendMessage(msg.chat.id,
      `✅ Сессия "${name}" создана!\n\n` +
      `🆔 ID: ${id}\n` +
      `🔗 Ссылка на Mini App:\n${webappLink}\n\n` +
      `Отправьте эту ссылку участникам.`
    );
  });

  bot.onText(/\/sessions$/, (msg) => {
    const sessions = getAllSessions();
    if (sessions.length === 0) {
      bot.sendMessage(msg.chat.id, 'Нет активных сессий. Создайте новую: /new_session <название>');
      return;
    }
    let text = '📋 Активные сессии:\n\n';
    for (const s of sessions) {
      const techCount = Object.keys(s.techSpecialists || {}).length;
      const partCount = Object.keys(s.participants || {}).length;
      text += `• "${s.name}" (ID: ${s.id})\n  Тех: ${techCount}, Участники: ${partCount}\n\n`;
    }
    bot.sendMessage(msg.chat.id, text);
  });

  bot.onText(/\/status(?:\s+(.+))?$/, (msg, match) => {
    const sessionId = match[1]?.trim();
    let session;

    if (sessionId) {
      session = loadSession(sessionId);
    } else {
      const sessions = getAllSessions();
      session = sessions[sessions.length - 1];
    }

    if (!session) {
      bot.sendMessage(msg.chat.id, 'Сессия не найдена. Используйте /sessions для списка.');
      return;
    }

    bot.sendMessage(msg.chat.id, formatStatus(session));
  });

  console.log('Telegram bot started');
  return bot;
}

function notifyAdmin(bot, message) {
  const adminChatId = process.env.ADMIN_CHAT_ID;
  if (adminChatId && bot && bot.sendMessage) {
    bot.sendMessage(adminChatId, message).catch(() => {});
  }
}

module.exports = { initBot, notifyAdmin, loadSession, saveSession };
