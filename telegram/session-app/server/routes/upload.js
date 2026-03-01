const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { loadSession, saveSession, notifyAdmin } = require('../bot');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.post('/upload/:sessionId', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { sessionId } = req.params;
  const { userId, taskId, role } = req.body;
  const filePath = `uploads/${req.file.filename}`;

  const session = loadSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Update session with photo reference
  if (role === 'tech' && session.techSpecialists[userId]) {
    const task = session.techSpecialists[userId].tasks[taskId];
    if (task) {
      if (taskId === 'internet') {
        task.screenshot = filePath;
      } else {
        task.photo = filePath;
      }
      task.status = 'done';
    }
    saveSession(session);

    const bot = req.app.get('bot');
    const techName = session.techSpecialists[userId].name;
    const taskNames = { internet: 'Сеть и VPN', workspace: 'Рабочие места', multimedia: 'Мультимедиа' };
    notifyAdmin(bot, `📸 ${techName} загрузил фото для задачи "${taskNames[taskId] || taskId}" в сессии "${session.name}"`);
  }

  res.json({ ok: true, path: filePath });
});

module.exports = router;
