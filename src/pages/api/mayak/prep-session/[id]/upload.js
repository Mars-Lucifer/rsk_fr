import fs from 'fs';
import path from 'path';
import { IncomingForm } from 'formidable';
import { randomUUID } from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
    console.error('[Upload] Failed to send photo to organizer:', err.message);
  }
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const form = new IncomingForm({
      uploadDir: UPLOAD_DIR,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024,
      filter: ({ mimetype }) => {
        return /^image\/(jpeg|jpg|png|gif|webp)$/.test(mimetype || '');
      },
    });

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
  });
}

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    const { id: sessionId } = req.query;
    const body = await parseJsonBody(req);
    const { userId, taskId, role, photoIndex } = body;
    const session = loadPrepSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (role === 'tech' && session.techSpecialists?.[userId]) {
      const task = session.techSpecialists[userId].tasks?.[taskId];
      if (task && Array.isArray(task.photos) && photoIndex >= 0 && photoIndex < task.photos.length) {
        const photoPath = path.join(process.cwd(), 'public', task.photos[photoIndex]);
        try { fs.unlinkSync(photoPath); } catch {}
        task.photos.splice(photoIndex, 1);
        if (task.status === 'done' && task.photos.length === 0) {
          task.status = 'in_progress';
        }
        savePrepSession(session);
      }
    }
    return res.json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id: sessionId } = req.query;

  try {
    const { fields, files } = await parseForm(req);

    const photo = files.photo;
    const file = Array.isArray(photo) ? photo[0] : photo;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const session = loadPrepSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Rename file to unique name
    const ext = path.extname(file.originalFilename || file.newFilename || '.jpg');
    const newName = `${randomUUID()}${ext}`;
    const newPath = path.join(UPLOAD_DIR, newName);
    fs.renameSync(file.filepath, newPath);

    const filePath = `prep-uploads/${newName}`;

    const userId = Array.isArray(fields.userId) ? fields.userId[0] : fields.userId;
    const taskId = Array.isArray(fields.taskId) ? fields.taskId[0] : fields.taskId;
    const role = Array.isArray(fields.role) ? fields.role[0] : fields.role;
    const photoField = Array.isArray(fields.photoField) ? fields.photoField[0] : fields.photoField;

    if (role === 'tech' && session.techSpecialists[userId]) {
      const task = session.techSpecialists[userId].tasks[taskId];
      if (task) {
        if (taskId === 'internet') {
          task.screenshot = filePath;
        } else if (photoField === 'photos_array') {
          // Append to photos array (unlimited photos)
          if (!Array.isArray(task.photos)) task.photos = [];
          task.photos.push(filePath);
        } else if (photoField) {
          task[photoField] = filePath;
        } else {
          task.photo = filePath;
        }
        // workspace and multimedia status is set manually via "Подтвердить выполнение" button
        if (taskId !== 'workspace' && taskId !== 'multimedia') {
          task.status = 'done';
        }
      }
      savePrepSession(session);

      const techName = session.techSpecialists[userId].name;
      const taskNames = { internet: 'Сеть и VPN', workspace: 'Рабочие места', multimedia: 'Мультимедиа' };
      const caption = `📸 ${techName}\n${taskNames[taskId] || taskId}\nСессия: "${session.name}"`;
      await notifyPrepAdmin(caption);

      // Отправляем фото организатору сразу только для НЕ-массивных полей
      // Для photos_array фото отправляются при подтверждении задачи (через progress API)
      if (photoField !== 'photos_array' && session.createdBy) {
        await sendPhotoToOrganizer(session.createdBy, newPath, caption);
      }
    } else if (role === 'participant' && session.participants[userId]) {
      const task = session.participants[userId].tasks[taskId];
      if (task) {
        task.photo = filePath;
        task.status = 'done';
      }
      savePrepSession(session);

      const partName = session.participants[userId].name;
      await notifyPrepAdmin(`📸 Участник ${partName} загрузил фото для задачи "${taskId}" в сессии "${session.name}"`);
    }

    res.json({ ok: true, path: filePath });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
}
