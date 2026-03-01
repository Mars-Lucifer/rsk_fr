import React, { useState } from 'react';
import TaskList from './TaskList.jsx';
import DeviceCheck from './DeviceCheck.jsx';

const PARTICIPANT_TASKS = [
  { id: 'laptop', title: 'Ноутбук', icon: '💻' },
  { id: 'chrome', title: 'Google Chrome', icon: '🌐' },
  { id: 'services', title: 'Сервисы', icon: '🔗' }
];

export default function ParticipantPanel({ session, user, sessionId, onUpdate, onRefresh }) {
  const [selectedTask, setSelectedTask] = useState('laptop');
  const partData = session?.participants?.[user.id];
  const tasks = partData?.tasks || {};

  function renderTaskContent(taskId) {
    const task = tasks[taskId] || {};

    if (taskId === 'laptop') {
      return (
        <div className="task-content">
          <h3>Подготовка ноутбука</h3>
          <div className="instruction">
            <p>Какой ноутбук вы будете использовать?</p>
          </div>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${partData?.laptopType === 'personal' ? 'active' : ''}`}
              onClick={async () => {
                await fetch(`/api/session/${sessionId}/progress`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    role: 'participant', userId: user.id, userName: user.name,
                    laptopType: 'personal', taskId: 'laptop', taskData: { status: 'in_progress' }
                  })
                });
                onRefresh();
              }}
            >Свой личный</button>
            <button
              className={`toggle-btn ${partData?.laptopType === 'corporate' ? 'active' : ''}`}
              onClick={async () => {
                await fetch(`/api/session/${sessionId}/progress`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    role: 'participant', userId: user.id, userName: user.name,
                    laptopType: 'corporate', taskId: 'laptop', taskData: { status: 'done' }
                  })
                });
                onRefresh();
              }}
            >Корпоративный</button>
          </div>

          {partData?.laptopType === 'personal' && (
            <div className="info-box">
              <DeviceCheck onComplete={(specs) => {
                if (specs.isValid) {
                  onUpdate('laptop', { status: 'done', specs });
                } else {
                  onUpdate('laptop', { status: 'in_progress', specs });
                }
              }} />
              <h4>Рекомендуемые характеристики:</h4>
              <ul>
                <li>Оперативная память: ≥ 8 GB</li>
                <li>Накопитель: SSD</li>
                <li>Размер экрана: ≥ 13"</li>
                <li>Актуальная версия ОС</li>
              </ul>
              <button className="btn btn-done" onClick={() => onUpdate('laptop', { status: 'done' })}>
                Мой ноутбук соответствует
              </button>
            </div>
          )}

          {task.status === 'done' && <div className="status-badge done">Выполнено ✅</div>}
        </div>
      );
    }

    if (taskId === 'chrome') {
      return (
        <div className="task-content">
          <h3>Google Chrome</h3>
          <div className="instruction">
            <p>Для работы с сервисами необходим браузер Google Chrome.</p>
            <p>Если он ещё не установлен, скачайте его:</p>
            <a
              href="https://www.google.com/chrome/"
              target="_blank"
              rel="noopener"
              className="btn btn-link"
            >
              Скачать Google Chrome
            </a>
          </div>
          {task.status !== 'done' ? (
            <button className="btn btn-done" onClick={() => onUpdate('chrome', { status: 'done' })}>
              Chrome установлен ✓
            </button>
          ) : (
            <div className="status-badge done">Выполнено ✅</div>
          )}
        </div>
      );
    }

    if (taskId === 'services') {
      const completed = task.completed || [];
      const allServices = ['suno', 'perplexity'];
      const allDone = allServices.every(s => completed.includes(s));

      function toggleService(service) {
        const newCompleted = completed.includes(service)
          ? completed.filter(s => s !== service)
          : [...completed, service];
        const newPending = allServices.filter(s => !newCompleted.includes(s));
        const status = newPending.length === 0 ? 'done' : 'in_progress';
        onUpdate('services', { status, completed: newCompleted, pending: newPending });
      }

      const servicesConfig = {
        suno: { url: 'https://suno.com/' },
        perplexity: { url: 'https://www.perplexity.ai/' }
      };

      return (
        <div className="task-content">
          <h3>Проверка сервисов</h3>
          <div className="instruction">
            <p>Ознакомьтесь с инструкциями и подтвердите доступ к сервисам:</p>
          </div>
          <div className="services-list">
            {allServices.map(service => (
              <div key={service} style={{ marginBottom: '15px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, textTransform: 'capitalize' }}>{service}</h4>
                  <a 
                    href={servicesConfig[service].url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      padding: '6px 12px',
                      background: '#e3f2fd',
                      color: '#0d47a1',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 'bold'
                    }}
                  >
                    Перейти на сайт ↗
                  </a>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                  Здесь будет инструкция для доступа к {service}. Например, логин/пароль или шаги регистрации.
                </div>
                <label className="check-item service-item" style={{ margin: 0, padding: '10px', background: completed.includes(service) ? '#e6f4ea' : '#fff', border: '1px solid #ddd', borderRadius: '6px', display: 'block', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={completed.includes(service)}
                    onChange={() => toggleService(service)}
                    style={{ marginRight: '10px', transform: 'scale(1.2)' }}
                  />
                  <span className="service-name" style={{ fontWeight: completed.includes(service) ? 'bold' : 'normal', color: completed.includes(service) ? '#1e8e3e' : '#333' }}>
                    Доступ проверил, работает корректно
                  </span>
                </label>
              </div>
            ))}
          </div>
          {allDone && (
            <div style={{ marginTop: '25px' }}>
              <div className="status-badge done" style={{ marginBottom: '15px', padding: '15px', fontSize: '1rem', textAlign: 'center' }}>
                ✅ Все сервисы подтверждены!
              </div>
              <a 
                href="https://t.me/your_bot_name" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '14px',
                  background: '#0088cc',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                  boxShadow: '0 4px 6px rgba(0, 136, 204, 0.2)'
                }}
              >
                Вернуться в бота к заданиям 🚀
              </a>
            </div>
          )}
        </div>
      );
    }

    return null;
  }

  const taskListItems = PARTICIPANT_TASKS.map(t => ({
    ...t,
    status: tasks[t.id]?.status || 'pending'
  }));

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Участник</h2>
        <span className="user-name">{user.name}</span>
      </div>
      <div className="panel-body">
        <TaskList
          tasks={taskListItems}
          selected={selectedTask}
          onSelect={setSelectedTask}
        />
        <div className="task-detail-area">
          {renderTaskContent(selectedTask)}
        </div>
      </div>
    </div>
  );
}
