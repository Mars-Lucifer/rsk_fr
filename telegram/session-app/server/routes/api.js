const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { loadSession, saveSession, notifyAdmin } = require('../bot');

const DATA_DIR = path.join(__dirname, '..', 'data', 'sessions');

// Get session data
router.get('/session/:id', (req, res) => {
  const session = loadSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

// Update user progress
router.post('/session/:id/progress', (req, res) => {
  const session = loadSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { role, userId, userName, taskId, taskData, laptopType } = req.body;

  if (role === 'tech') {
    if (!session.techSpecialists[userId]) {
      session.techSpecialists[userId] = {
        name: userName || 'Без имени',
        tasks: {
          internet: { status: 'pending', screenshot: null },
          workspace: { status: 'pending', photo: null },
          multimedia: { status: 'pending', photo: null }
        }
      };
    }

    if (taskId && taskData) {
      session.techSpecialists[userId].tasks[taskId] = {
        ...session.techSpecialists[userId].tasks[taskId],
        ...taskData
      };
    }

    // Check if all tech tasks are done
    const tech = session.techSpecialists[userId];
    const allDone = Object.values(tech.tasks).every(t => t.status === 'done');
    if (allDone) {
      const bot = req.app.get('bot');
      notifyAdmin(bot, `🔧 Тех. специалист ${tech.name} завершил все задачи в сессии "${session.name}"!`);
    }

  } else if (role === 'participant') {
    if (!session.participants[userId]) {
      session.participants[userId] = {
        name: userName || 'Без имени',
        laptopType: laptopType || null,
        tasks: {
          laptop: { status: 'pending' },
          chrome: { status: 'pending' },
          services: { status: 'pending', completed: [], pending: ['suno', 'perplexity'] }
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

    // Recalculate overall status
    const part = session.participants[userId];
    const tasks = Object.values(part.tasks);
    const doneCount = tasks.filter(t => t.status === 'done').length;
    if (doneCount === tasks.length) {
      part.overallStatus = 'done';
      const bot = req.app.get('bot');
      notifyAdmin(bot, `👤 Участник ${part.name} готов в сессии "${session.name}"! ✅`);
    } else if (doneCount > 0) {
      part.overallStatus = 'in_progress';
    }

    // Check if all participants are done
    const allParticipantsDone = Object.values(session.participants).every(p => p.overallStatus === 'done');
    if (allParticipantsDone && Object.keys(session.participants).length > 0) {
      const bot = req.app.get('bot');
      notifyAdmin(bot, `🎉 Все участники готовы в сессии "${session.name}"!`);
    }
  }

  saveSession(session);
  res.json({ ok: true, session });
});

// Register user to session
router.post('/session/:id/register', (req, res) => {
  const session = loadSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { role, userId, userName } = req.body;

  if (role === 'tech') {
    if (!session.techSpecialists[userId]) {
      session.techSpecialists[userId] = {
        name: userName || 'Без имени',
        tasks: {
          internet: { status: 'pending', screenshot: null },
          workspace: { status: 'pending', photo: null },
          multimedia: { status: 'pending', photo: null }
        }
      };
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

  saveSession(session);
  res.json({ ok: true, session });
});

module.exports = router;
