import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'prep-sessions');
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'prep-uploads');

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

async function notifyPrepAdmin(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.PREP_ADMIN_CHAT_ID;
  if (!token || !adminChatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: adminChatId, text: message }),
    });
  } catch {}
}

async function sendPhotoToOrganizer(chatId, photoPath, caption) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;

  try {
    const photoBuffer = fs.readFileSync(photoPath);
    const ext = path.extname(photoPath) || '.jpg';
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('photo', new Blob([photoBuffer]), `photo${ext}`);
    if (caption) formData.append('caption', caption);

    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });
  } catch (err) {
    console.error('[Progress] Failed to send photo to organizer:', err.message);
  }
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

  const { role, userId, userName, taskId, taskData, laptopType, action } = req.body;

  // Reset action — clear all tech specialist data and delete uploaded photos
  if (action === 'reset' && role === 'tech') {
    const techData = session.techSpecialists?.[userId];
    if (techData) {
      // Delete uploaded photos from filesystem
      for (const task of Object.values(techData.tasks || {})) {
        if (Array.isArray(task.photos)) {
          for (const p of task.photos) {
            try { fs.unlinkSync(path.join(process.cwd(), 'public', p)); } catch {}
          }
        }
        if (task.photo) {
          try { fs.unlinkSync(path.join(process.cwd(), 'public', task.photo)); } catch {}
        }
      }
      delete session.techSpecialists[userId];
    }
    savePrepSession(session);
    return res.json({ ok: true, session });
  }

  if (role === 'tech') {
    if (!session.techSpecialists[userId]) {
      session.techSpecialists[userId] = {
        name: userName || 'Без имени',
        contact: '',
        tasks: {
          workspace: { status: 'pending' },
          multimedia: { status: 'pending' },
          devices: { status: 'pending' }
        }
      };
    }

    if (taskId && taskData) {
      const prevStatus = session.techSpecialists[userId].tasks[taskId]?.status;
      session.techSpecialists[userId].tasks[taskId] = {
        ...session.techSpecialists[userId].tasks[taskId],
        ...taskData
      };

      // Send photos to organizer when task is confirmed (status becomes 'done')
      const newStatus = taskData.status;
      if (newStatus === 'done' && prevStatus !== 'done' && session.createdBy) {
        const task = session.techSpecialists[userId].tasks[taskId];
        const techName = session.techSpecialists[userId].name;
        const taskNames = { workspace: 'Рабочие места', multimedia: 'Мультимедиа', devices: 'Устройства' };
        const caption = `✅ ${techName}\n${taskNames[taskId] || taskId} — подтверждено\nСессия: "${session.name}"`;

        if (Array.isArray(task.photos)) {
          for (const p of task.photos) {
            const absPath = path.join(process.cwd(), 'public', p);
            if (fs.existsSync(absPath)) {
              await sendPhotoToOrganizer(session.createdBy, absPath, caption);
            }
          }
        }
      }
    }

    const tech = session.techSpecialists[userId];
    const allDone = Object.values(tech.tasks).every(t => t.status === 'done');
    if (allDone) {
      await notifyPrepAdmin(`🔧 Тех. специалист ${tech.name} завершил все задачи в сессии "${session.name}"!`);
    }

  } else if (role === 'participant') {
    if (!session.participants[userId]) {
      session.participants[userId] = {
        name: userName || 'Без имени',
        laptopType: laptopType || null,
        tasks: {
          laptop: { status: 'pending' }
        },
        overallStatus: 'pending'
      };
    }

    if (laptopType) {
      session.participants[userId].laptopType = laptopType;
    }

    if (taskId && taskData) {
      session.participants[userId].tasks[taskId] = {
        ...session.participants[userId].tasks[taskId],
        ...taskData
      };
    }

    const part = session.participants[userId];
    const laptopStatus = part.tasks.laptop?.status;
    if (laptopStatus === 'done') {
      part.overallStatus = 'done';
      await notifyPrepAdmin(`👤 Участник ${part.name} готов в сессии "${session.name}"! ✅`);
    } else if (laptopStatus === 'in_progress') {
      part.overallStatus = 'in_progress';
    }

    const allParticipantsDone = Object.values(session.participants).every(p => p.overallStatus === 'done');
    if (allParticipantsDone && Object.keys(session.participants).length > 0) {
      await notifyPrepAdmin(`🎉 Все участники готовы в сессии "${session.name}"!`);
    }
  }

  savePrepSession(session);
  res.json({ ok: true, session });
}
