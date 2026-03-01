import React, { useState } from 'react';
import TaskList from './TaskList.jsx';
import TaskDetail from './TaskDetail.jsx';
import PhotoUpload from './PhotoUpload.jsx';

const TECH_TASKS = [
  { id: 'internet', title: 'Сеть и VPN', icon: '🌐' },
  { id: 'workspace', title: 'Рабочие места', icon: '🏢' },
  { id: 'multimedia', title: 'Мультимедиа', icon: '📺' }
];

export default function TechPanel({ session, user, sessionId, onUpdate, onRefresh }) {
  const [selectedTask, setSelectedTask] = useState('internet');
  const techData = session?.techSpecialists?.[user.id];
  const tasks = techData?.tasks || {};

  function renderTaskContent(taskId) {
    const task = tasks[taskId] || {};

    if (taskId === 'internet') {
      return (
        <div className="task-content">
          <h3>Шаг 1: Сеть и VPN</h3>
          <div className="instruction">
            <p>1. Проверьте оборудование: <strong>Routerich AX 3000</strong>.</p>
            <p>2. Скорость интернета: <strong>50-100 Мбит/с</strong>.</p>
            <p>3. Убедитесь, что VPN активен.</p>
          </div>
          <div className="requirements">
            <h4>Требования ТЗ:</h4>
            <ul>
              <li>Загрузка/Отдача: 50-100 Мбит/с</li>
              <li>Оборудование: Routerich AX 3000</li>
            </ul>
          </div>
          <div className="warning-box">
            <span style={{ marginRight: '8px', fontSize: '1.2rem' }}>⚠️</span>
            <strong>Внимание:</strong> Подтверждение невозможно без скриншота Speedtest или фото наклейки роутера.
          </div>
          <PhotoUpload
            sessionId={sessionId}
            userId={user.id}
            taskId="internet"
            role="tech"
            currentPhoto={task.screenshot}
            onUploaded={onRefresh}
          />
          {task.status !== 'done' && (
            <button 
              className="btn btn-done" 
              disabled={!task.screenshot}
              onClick={() => onUpdate('internet', { status: 'done' })}
              style={{ opacity: task.screenshot ? 1 : 0.5 }}
            >
              Выполнить {!task.screenshot && '(загрузите фото)'}
            </button>
          )}
          {task.status === 'done' && <div className="status-badge done">Выполнено ✅</div>}
        </div>
      );
    }

    if (taskId === 'workspace') {
      return (
        <div className="task-content">
          <h3>Шаг 2: Рабочие места</h3>
          <div className="instruction">
            <p>Организуйте пространство согласно ТЗ:</p>
            <ul>
              <li><strong>3 стола</strong> для размещения 18 человек.</li>
              <li>Минимум <strong>20 розеток</strong> (по 1 шт. на участника + 1 для спикера).</li>
              <li>Форма расстановки: <strong>"полукруг"</strong>.</li>
            </ul>
          </div>
          <div className="warning-box">
            <strong>⚠️ Внимание:</strong> Подтверждение невозможно без фото зала.
          </div>
          <div style={{ margin: '15px 0', border: '1px solid #ddd', padding: '10px', borderRadius: '8px', background: 'white' }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>Пример расстановки из ТЗ:</p>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
              <img src="/images/tz_page5_img1.jpeg" alt="Схема 1" style={{ height: '150px', borderRadius: '4px' }} />
              <img src="/images/tz_page5_img2.jpeg" alt="Схема 2" style={{ height: '150px', borderRadius: '4px' }} />
            </div>
          </div>
          <PhotoUpload
            sessionId={sessionId}
            userId={user.id}
            taskId="workspace"
            role="tech"
            currentPhoto={task.photo}
            onUploaded={onRefresh}
          />
          {task.status !== 'done' && (
            <button 
              className="btn btn-done" 
              disabled={!task.photo}
              onClick={() => onUpdate('workspace', { status: 'done' })}
              style={{ opacity: task.photo ? 1 : 0.5 }}
            >
              Выполнить {!task.photo && '(загрузите фото)'}
            </button>
          )}
          {task.status === 'done' && <div className="status-badge done">Выполнено ✅</div>}
        </div>
      );
    }

    if (taskId === 'multimedia') {
      return (
        <div className="task-content">
          <h3>Шаг 3: Мультимедиа</h3>
          <div className="instruction">
            <p>Проверьте наличие и работоспособность оборудования:</p>
            <ul>
              <li><strong>Интерактивная панель</strong> (или экран с проектором).</li>
              <li><strong>2 микрофона</strong> (петличный или ручной).</li>
              <li><strong>Акустическая система</strong> (колонки).</li>
            </ul>
          </div>
          <div className="warning-box">
            <strong>⚠️ Внимание:</strong> Подтверждение невозможно без фото интерактивной панели / экрана.
          </div>
          <PhotoUpload
            sessionId={sessionId}
            userId={user.id}
            taskId="multimedia"
            role="tech"
            currentPhoto={task.photo}
            onUploaded={onRefresh}
          />
          {task.status !== 'done' && (
            <button 
              className="btn btn-done" 
              disabled={!task.photo}
              onClick={() => onUpdate('multimedia', { status: 'done' })}
              style={{ opacity: task.photo ? 1 : 0.5 }}
            >
              Выполнить {!task.photo && '(загрузите фото)'}
            </button>
          )}
          {task.status === 'done' && <div className="status-badge done">Выполнено ✅</div>}
        </div>
      );
    }

    return null;
  }

  const taskListItems = TECH_TASKS.map(t => ({
    ...t,
    status: tasks[t.id]?.status || 'pending'
  }));

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Тех. специалист</h2>
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
