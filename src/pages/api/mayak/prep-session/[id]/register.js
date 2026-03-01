import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'prep-sessions');

function getSessionPath(id) {
  return path.join(DATA_DIR, `session_${id}.json`);
}

function loadPrepSession(id) {
  const p = getSessionPath(id);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function savePrepSession(session) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(getSessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');
}

async function notifyTelegram(chatId, message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
  } catch {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const session = loadPrepSession(id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { role, userId, userName } = req.body;

  if (role === 'tech') {
    const isNew = !session.techSpecialists[userId];
    if (isNew) {
      session.techSpecialists[userId] = {
        name: userName || 'Без имени',
        contact: req.body.contact || '',
        tasks: {
          workspace: { status: 'pending', photo: null },
          multimedia: { status: 'pending' },
          devices: { status: 'pending' }
        }
      };
    } else {
      if (userName) session.techSpecialists[userId].name = userName;
      if (req.body.contact) session.techSpecialists[userId].contact = req.body.contact;
    }

    // Notify organizer and admin about new tech specialist
    if (isNew) {
      const contact = req.body.contact || '';
      const name = userName || 'Без имени';
      const msg = `🔧 Тех. специалист зарегистрировался\nФИО: ${name}\nTelegram: ${contact}\nСессия: "${session.name}"`;
      const adminChatId = process.env.PREP_ADMIN_CHAT_ID;
      if (adminChatId) await notifyTelegram(adminChatId, msg);
      if (session.createdBy) await notifyTelegram(session.createdBy, msg);
    }
  } else if (role === 'participant') {
    if (!session.participants[userId]) {
      session.participants[userId] = {
        name: userName || 'Без имени',
        laptopType: null,
        tasks: {
          laptop: { status: 'pending' },
          chrome: { status: 'pending' },
          services: { status: 'pending', completed: [], pending: ['suno', 'perplexity'] }
        },
        overallStatus: 'pending'
      };
    }
  }

  savePrepSession(session);
  res.json({ ok: true, session });
}
