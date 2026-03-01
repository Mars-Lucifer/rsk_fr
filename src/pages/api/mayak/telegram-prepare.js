import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { startBot } from '@/lib/telegramBot';

const SESSIONS_DIR = path.join(process.cwd(), 'data', 'telegram-sessions');
const SESSIONS_FILE = path.join(SESSIONS_DIR, 'sessions.json');

// Увеличиваем лимит для base64-кодированных PDF
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

function ensureDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function getSessions() {
  ensureDir();
  if (!fs.existsSync(SESSIONS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveSessions(sessions) {
  ensureDir();
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

// Удаляем сессии старше 24 часов
function cleanupOldSessions() {
  const sessions = getSessions();
  const now = Date.now();
  const MAX_AGE = 24 * 60 * 60 * 1000;
  let changed = false;

  for (const [id, session] of Object.entries(sessions)) {
    if (now - new Date(session.createdAt).getTime() > MAX_AGE) {
      const files = ['_cert.pdf', '_log.pdf', '_logdata.json', '_analytics.pdf'];
      for (const suffix of files) {
        const p = path.join(SESSIONS_DIR, `${id}${suffix}`);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      delete sessions[id];
      changed = true;
    }
  }

  if (changed) saveSessions(sessions);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Автозапуск бота при первом вызове
  startBot();

  try {
    const { userName, certificate, log, logData } = req.body;

    if (!certificate || !log) {
      return res.status(400).json({ error: 'certificate and log are required (base64)' });
    }

    cleanupOldSessions();

    const sessionId = uuidv4().slice(0, 8);

    const certBuffer = Buffer.from(certificate, 'base64');
    const logBuffer = Buffer.from(log, 'base64');

    ensureDir();
    fs.writeFileSync(path.join(SESSIONS_DIR, `${sessionId}_cert.pdf`), certBuffer);
    fs.writeFileSync(path.join(SESSIONS_DIR, `${sessionId}_log.pdf`), logBuffer);

    // Сохраняем JSON данные лога для аналитики
    if (logData) {
      fs.writeFileSync(
        path.join(SESSIONS_DIR, `${sessionId}_logdata.json`),
        JSON.stringify(logData, null, 2)
      );
    }

    const sessions = getSessions();
    sessions[sessionId] = {
      userName: userName || 'Участник',
      createdAt: new Date().toISOString(),
      delivered: false,
      hasLogData: !!logData,
    };
    saveSessions(sessions);

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'test_rsk123_bot';
    const deepLink = `https://t.me/${botUsername}?start=${sessionId}`;

    return res.status(200).json({ sessionId, deepLink });
  } catch (error) {
    console.error('Error preparing telegram session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
