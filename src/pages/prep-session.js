import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';

const API_BASE = '/api/mayak/prep-session';

function getSessionId() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('session');
}

function getUser() {
  if (typeof window === 'undefined') return { id: 'ssr', name: '' };
  try {
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      tg.ready();
      tg.expand();
      const user = {
        id: String(tg.initDataUnsafe.user.id),
        name: [tg.initDataUnsafe.user.first_name, tg.initDataUnsafe.user.last_name].filter(Boolean).join(' ') || 'User'
      };
      localStorage.setItem('prepUser', JSON.stringify(user));
      return user;
    }
    const saved = localStorage.getItem('prepUser');
    if (saved) return JSON.parse(saved);
  } catch {}
  const fallbackId = 'test_' + Math.random().toString(36).slice(2, 8);
  return { id: fallbackId, name: 'Тестовый пользователь' };
}

// ===== PhotoUpload =====
function PhotoUpload({ sessionId, userId, taskId, role, currentPhoto, onUploaded, photoField, label }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
    setUploading(true);
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('userId', userId);
    formData.append('taskId', taskId);
    formData.append('role', role);
    if (photoField) formData.append('photoField', photoField);
    try {
      const res = await fetch(`${API_BASE}/${sessionId}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) onUploaded();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }

  const photoSrc = preview || (currentPhoto ? `/${currentPhoto}` : null);

  return (
    <div className="ps-photo-upload">
      {photoSrc && (
        <div className="ps-photo-preview">
          <img src={photoSrc} alt="Uploaded" />
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleUpload} style={{ display: 'none' }} />
      <button className="ps-btn inverted" onClick={() => fileRef.current?.click()} disabled={uploading}>
        {uploading ? 'Загрузка...' : currentPhoto ? 'Заменить фото' : (label || 'Загрузить фото')}
      </button>
    </div>
  );
}

// ===== MultiPhotoUpload (неограниченное кол-во фото + удаление) =====
function MultiPhotoUpload({ sessionId, userId, taskId, role, photos, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const fileRef = useRef();

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('userId', userId);
    formData.append('taskId', taskId);
    formData.append('role', role);
    formData.append('photoField', 'photos_array');
    try {
      const res = await fetch(`${API_BASE}/${sessionId}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) onUploaded();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(index) {
    setDeleting(index);
    try {
      const res = await fetch(`${API_BASE}/${sessionId}/upload`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId, role, photoIndex: index })
      });
      const data = await res.json();
      if (data.ok) onUploaded();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(null);
    }
  }

  const photoList = photos || [];

  return (
    <div className="ps-photo-upload">
      {photoList.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {photoList.map((p, i) => (
            <div key={i} className="ps-photo-preview" style={{ marginBottom: 0, position: 'relative' }}>
              <img src={`/${p}`} alt={`Фото ${i + 1}`} />
              <button
                className="ps-photo-delete"
                onClick={() => handleDelete(i)}
                disabled={deleting === i}
                title="Удалить фото"
              >
                {deleting === i ? '...' : '×'}
              </button>
            </div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleUpload} style={{ display: 'none' }} />
      <button className="ps-btn inverted" onClick={() => fileRef.current?.click()} disabled={uploading}>
        {uploading ? 'Загрузка...' : photoList.length > 0 ? `Добавить ещё фото (${photoList.length} загружено)` : 'Загрузить фото'}
      </button>
    </div>
  );
}

// ===== TaskList =====
function TaskList({ tasks, selected, onSelect }) {
  return (
    <div className="ps-task-list">
      {tasks.map(task => (
        <button
          key={task.id}
          className={`ps-task-list-item ${selected === task.id ? 'selected' : ''}`}
          onClick={() => onSelect(task.id)}
        >
          <span className="ps-task-icon">{task.icon}</span>
          <span className="ps-task-title">{task.title}</span>
          <span className="ps-task-status">
            {task.status === 'done' ? '✅' : task.status === 'in_progress' ? '🔄' : '⏳'}
          </span>
        </button>
      ))}
    </div>
  );
}

// ===== DeviceCheck =====
function DeviceCheck({ onComplete }) {
  const [specs, setSpecs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const checkDevice = useCallback(() => {
    const ram = navigator.deviceMemory || 0;
    const ua = navigator.userAgent;
    let os = 'Unknown';
    if (ua.indexOf('Win') !== -1) { os = 'Windows'; if (ua.indexOf('Windows NT 10.0') !== -1) os = 'Windows 10/11'; }
    if (ua.indexOf('Mac') !== -1) os = 'macOS';
    if (ua.indexOf('Linux') !== -1) os = 'Linux';
    if (ua.indexOf('Android') !== -1) os = 'Android';
    if (ua.indexOf('like Mac') !== -1) os = 'iOS';
    const isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
    const browser = isChrome ? 'Chrome' : 'Other';
    const errors = [];
    if (ram < 8) errors.push('Недостаточно оперативной памяти (нужно минимум 8 ГБ)');
    if (os !== 'Windows 10/11' && os !== 'macOS') errors.push('Требуется ОС Windows 10/11 или macOS');
    if (!isChrome) errors.push('Пожалуйста, используйте браузер Google Chrome');
    const result = { ram, os, browser, isChrome, isValid: errors.length === 0, errors };
    setSpecs(result);
    return result;
  }, []);

  const handleCheck = () => {
    setLoading(true);
    setTimeout(() => { const result = checkDevice(); setLoading(false); if (onComplete) onComplete(result); }, 1500);
  };

  return (
    <div className="ps-device-check">
      <h4>Автоматическая проверка</h4>
      {!specs ? (
        <>
          <p>Нажми кнопку, чтобы система сравнила параметры твоего ноутбука с требованиями ТЗ.</p>
          <label className="ps-consent-label">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>Разрешить проверку (ОС, RAM, Браузер)</span>
          </label>
          <button className={`ps-btn ${accepted ? 'blue' : ''}`} disabled={!accepted || loading} onClick={handleCheck}>
            {loading ? 'Идет сканирование...' : 'Сравнить характеристики'}
          </button>
        </>
      ) : (
        <div>
          <div className="ps-device-row">
            <div><div className="ps-device-row-label">Операционная система</div><div className="ps-device-row-value">{specs.os}</div></div>
            <div style={{ textAlign: 'right' }}><div className="ps-device-row-label">Требуется</div><div className="ps-device-row-value">Win 10/11, macOS {(specs.os === 'Windows 10/11' || specs.os === 'macOS') ? '✅' : '❌'}</div></div>
          </div>
          <div className="ps-device-row">
            <div><div className="ps-device-row-label">Объем памяти (RAM)</div><div className="ps-device-row-value">{specs.ram >= 8 ? '8 GB или более' : `${specs.ram} GB`}</div></div>
            <div style={{ textAlign: 'right' }}><div className="ps-device-row-label">Требуется</div><div className="ps-device-row-value">≥ 8 GB {specs.ram >= 8 ? '✅' : '❌'}</div></div>
          </div>
          <div className="ps-device-row">
            <div><div className="ps-device-row-label">Веб-браузер</div><div className="ps-device-row-value">{specs.browser}</div></div>
            <div style={{ textAlign: 'right' }}><div className="ps-device-row-label">Требуется</div><div className="ps-device-row-value">Chrome {specs.isChrome ? '✅' : '❌'}</div></div>
          </div>
          {specs.isValid ? (
            <div className="ps-device-ok">✅ Соответствует ТЗ</div>
          ) : (
            <div className="ps-device-warn">
              <strong>Есть отклонения:</strong>
              <ul>{specs.errors.map((err, i) => <li key={i}>{err}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== TechContactForm =====
function TechContactForm({ sessionName, onSubmit }) {
  const [fullName, setFullName] = useState('');
  const [telegram, setTelegram] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!fullName.trim() || !telegram.trim()) return;
    onSubmit({ fullName: fullName.trim(), telegram: telegram.trim() });
  }

  return (
    <div className="ps-contact-form">
      <h2>Подготовка к сессии</h2>
      {sessionName && <p className="ps-session-name">{sessionName}</p>}
      <p className="ps-contact-subtitle">Укажите ваши данные для связи</p>
      <form onSubmit={handleSubmit}>
        <div className="ps-form-field">
          <label>ФИО</label>
          <input
            type="text"
            placeholder="Иванов Иван Иванович"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="ps-form-field">
          <label>Telegram для связи</label>
          <input
            type="text"
            placeholder="@username"
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className={`ps-btn ${fullName.trim() && telegram.trim() ? 'blue' : ''}`}
          disabled={!fullName.trim() || !telegram.trim()}
        >
          Продолжить
        </button>
      </form>
    </div>
  );
}

// ===== TechPanel =====
const TECH_TASKS = [
  { id: 'workspace', title: 'Рабочие места', icon: '🏢' },
  { id: 'multimedia', title: 'Мультимедиа', icon: '📺' },
  { id: 'devices', title: 'Устройства', icon: '💻' }
];

function TechPanel({ session, user, sessionId, onUpdate, onRefresh, onReset }) {
  const [selectedTask, setSelectedTask] = useState('workspace');
  const [showDonePopup, setShowDonePopup] = useState(false);
  const techData = session?.techSpecialists?.[user.id];
  const tasks = techData?.tasks || {};

  function renderTaskContent(taskId) {
    const task = tasks[taskId] || {};

    if (taskId === 'workspace') {
      const photos = task.photos || [];
      const hasPhotos = photos.length > 0;

      return (
        <div className="ps-task-content">
          <h3>Рабочие места</h3>
          <div className="ps-instruction">
            <p>Организуйте пространство согласно ТЗ:</p>
            <ul>
              <li><strong>3 стола</strong> для размещения 18 человек.</li>
              <li>Минимум <strong>20 розеток</strong> (по 1 шт. на участника + 1 для спикера).</li>
              <li>Форма расстановки: <strong>&quot;полукруг&quot;</strong>.</li>
              <li><strong>Стойка для спикера</strong> — отдельное рабочее место с доступом к розетке и подключением к экрану/панели.</li>
            </ul>
          </div>
          <div className="ps-warning-box"><strong>Внимание:</strong> Подтверждение невозможно без фото зала.</div>
          <div className="ps-images-block">
            <p>Пример расстановки из ТЗ:</p>
            <div className="ps-images-row">
              <img src="/prep-images/tz_page5_img1.jpeg" alt="Схема 1" />
              <img src="/prep-images/tz_page5_img2.jpeg" alt="Схема 2" />
            </div>
          </div>
          <MultiPhotoUpload sessionId={sessionId} userId={user.id} taskId="workspace" role="tech" photos={photos} onUploaded={onRefresh} />
          {task.status !== 'done' ? (
            <button className="ps-btn approve" disabled={!hasPhotos} onClick={() => onUpdate('workspace', { status: 'done' })}>
              {hasPhotos ? 'Подтвердить выполнение' : 'Загрузите фото для подтверждения'}
            </button>
          ) : (
            <div className="ps-status-badge">Выполнено ✅</div>
          )}
        </div>
      );
    }

    if (taskId === 'multimedia') {
      const panelOk = task.panelOk || false;
      const hdmiOk = task.hdmiOk || false;
      const photos = task.photos || [];
      const allChecked = panelOk && hdmiOk;
      const hasPhotos = photos.length > 0;
      const allDone = allChecked && hasPhotos;

      function toggleCheck(field) {
        const newVal = !task[field];
        onUpdate('multimedia', { [field]: newVal, status: 'in_progress' });
      }

      return (
        <div className="ps-task-content">
          <h3>Мультимедиа</h3>
          <div className="ps-instruction">
            <p>Проверьте наличие и работоспособность оборудования:</p>
            <ul>
              <li><strong>Интерактивная панель</strong> (или экран с проектором).</li>
              <li><strong>Акустическая система</strong> (колонки).</li>
              <li>Подключите <strong>ноутбук к HDMI</strong> и проверьте звук и видео.</li>
            </ul>
          </div>

          <div className="ps-checklist">
            <label className={`ps-checklist-item ${panelOk ? 'checked' : ''}`}>
              <input type="checkbox" checked={panelOk} onChange={() => toggleCheck('panelOk')} />
              <span>Интерактивная панель (или экран с проектором) работает</span>
            </label>
            <label className={`ps-checklist-item ${hdmiOk ? 'checked' : ''}`}>
              <input type="checkbox" checked={hdmiOk} onChange={() => toggleCheck('hdmiOk')} />
              <span>Звук и видео с подключённого ноутбука работает</span>
            </label>
          </div>

          <div className="ps-warning-box"><strong>Внимание:</strong> Загрузите фото панели/экрана и HDMI-подключения (можно несколько).</div>

          <MultiPhotoUpload sessionId={sessionId} userId={user.id} taskId="multimedia" role="tech" photos={photos} onUploaded={onRefresh} />

          {task.status !== 'done' ? (
            <button className="ps-btn approve" disabled={!allChecked || !hasPhotos} onClick={() => onUpdate('multimedia', { status: 'done' })}>
              {!allChecked ? 'Отметьте все пункты' : !hasPhotos ? 'Загрузите хотя бы одно фото' : 'Подтвердить выполнение'}
            </button>
          ) : (
            <div className="ps-status-badge">Выполнено ✅</div>
          )}
        </div>
      );
    }

    if (taskId === 'devices') {
      const corporateLaptops = task.corporateLaptops;
      const workspaceDone = tasks.workspace?.status === 'done';
      const multimediaDone = tasks.multimedia?.status === 'done';
      const canFinish = workspaceDone && multimediaDone;

      function getFinishBlockMessage() {
        const missing = [];
        if (!workspaceDone) missing.push('«Рабочие места»');
        if (!multimediaDone) missing.push('«Мультимедиа»');
        return `Сначала завершите: ${missing.join(' и ')}`;
      }

      function handleFinish() {
        if (!canFinish) return;
        onUpdate('devices', { ...(corporateLaptops === true ? { servicesChecked: true } : { corporateLaptops: false }), status: 'done' });
        setShowDonePopup(true);
      }

      return (
        <div className="ps-task-content">
          <h3>Устройства</h3>
          <div className="ps-instruction">
            <p>Будут ли участники использовать корпоративные ноутбуки?</p>
          </div>

          <div className="ps-toggle-group">
            <button
              className={`ps-toggle-btn ${corporateLaptops === true ? 'active' : ''}`}
              onClick={() => onUpdate('devices', { corporateLaptops: true, status: 'in_progress' })}
            >
              Да
            </button>
            <button
              className={`ps-toggle-btn ${corporateLaptops === false ? 'active' : ''}`}
              onClick={() => onUpdate('devices', { corporateLaptops: false, status: 'in_progress' })}
            >
              Нет
            </button>
          </div>

          {corporateLaptops === true && (
            <>
              <div className="ps-instruction">
                <p>На корпоративных ноутбуках необходимо проверить доступ к сервисам.</p>
                <p><strong>1.</strong> Перейдите на платформу по ссылке:</p>
                <p style={{ marginBottom: '0.75rem' }}>
                  <a href="https://rosdk.ru/tools/mayak-oko" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue)', fontWeight: 600, textDecoration: 'underline' }}>
                    rosdk.ru/tools/mayak-oko
                  </a>
                </p>
                <p><strong>2.</strong> Откройте тренажёр <strong>«МАЯК ОКО»</strong>, затем вкладку <strong>«Разное»</strong> → <strong>«Сервисы»</strong>.</p>
                <p><strong>3.</strong> Зарегистрируйтесь и проверьте доступ ко всем сервисам (Suno, Perplexity, PixVerse, Qwen, Gamma, Z.ai).</p>
              </div>
              <div className="ps-images-block">
                <p>Как найти раздел «Разное» → «Сервисы»:</p>
                <div className="ps-images-row">
                  <img src="/prep-images/rosdk_misc_services.jpg" alt="Инструкция: Разное → Сервисы" style={{ height: 'auto', maxHeight: '300px', width: 'auto' }} />
                </div>
              </div>
              {task.status !== 'done' ? (
                <>
                  <button className={`ps-btn ${canFinish ? 'blue' : ''}`} disabled={!canFinish} onClick={handleFinish}>
                    Всё установлено и проверено — Завершить
                  </button>
                  {!canFinish && <div className="ps-warning-box" style={{ marginTop: '0.75rem' }}>{getFinishBlockMessage()}</div>}
                </>
              ) : (
                <div className="ps-status-badge">Выполнено ✅</div>
              )}
            </>
          )}

          {corporateLaptops === false && (
            <>
              {task.status !== 'done' ? (
                <>
                  <button className={`ps-btn ${canFinish ? 'blue' : ''}`} disabled={!canFinish} onClick={handleFinish}>
                    Завершить
                  </button>
                  {!canFinish && <div className="ps-warning-box" style={{ marginTop: '0.75rem' }}>{getFinishBlockMessage()}</div>}
                </>
              ) : (
                <div className="ps-status-badge">Выполнено ✅</div>
              )}
            </>
          )}
        </div>
      );
    }

    return null;
  }

  const taskListItems = TECH_TASKS.map(t => ({ ...t, status: tasks[t.id]?.status || 'pending' }));

  return (
    <div className="ps-panel">
      <div className="ps-panel-header">
        <h3>Тех. специалист</h3>
        <div className="ps-header-right">
          {techData?.contact && <span className="ps-user-contact">{techData.name}</span>}
          <button className="ps-reset-btn" onClick={onReset}>Сбросить</button>
        </div>
      </div>
      <div className="ps-panel-body">
        <div className="ps-task-sidebar">
          <TaskList tasks={taskListItems} selected={selectedTask} onSelect={setSelectedTask} />
          <div className="ps-contact-block">
            <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-black)', marginBottom: '0.375rem', fontWeight: 500 }}>Вопросы по организации пространства:</div>
            <a href="https://t.me/lebedev_core" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', background: 'var(--color-blue-noise)', borderRadius: '0.75rem', textDecoration: 'none', transition: 'all 0.3s ease-in-out' }}>
              <span style={{ fontSize: '1.25rem' }}>💬</span>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-blue)' }}>Лебедев Андрей</div>
                <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-black)' }}>@lebedev_core</div>
              </div>
            </a>
          </div>
        </div>
        <div className="ps-task-detail-area">{renderTaskContent(selectedTask)}</div>
      </div>

      {showDonePopup && (
        <div className="ps-popup-overlay" onClick={() => setShowDonePopup(false)}>
          <div className="ps-popup" onClick={(e) => e.stopPropagation()}>
            <div className="ps-popup-icon">✅</div>
            <h3>Подготовка завершена!</h3>
            <p>Все задачи выполнены. Спасибо за подготовку!</p>
            <button className="ps-btn blue" onClick={() => setShowDonePopup(false)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== ParticipantPanel =====
const SERVICES_LIST = [
  { id: 'suno', name: 'Suno', url: 'https://suno.com/', desc: 'Пройдите регистрацию через Google-аккаунт' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/', desc: 'Пройдите регистрацию через Google-аккаунт' },
  { id: 'pixverse', name: 'PixVerse', url: 'https://pixverse.ai/', desc: 'Пройдите регистрацию через Google-аккаунт' },
  { id: 'qwen', name: 'Qwen', url: 'https://chat.qwen.ai/', desc: 'Пройдите регистрацию через Google-аккаунт' },
  { id: 'gamma', name: 'Gamma', url: 'https://gamma.app/signup?r=4va8xcqw91qowwp', desc: 'Пройдите регистрацию через Google-аккаунт' },
  { id: 'zai', name: 'Z.ai', url: 'https://chat.z.ai/', desc: 'Пройдите регистрацию через Google-аккаунт' },
];

function ParticipantPanel({ session, user, sessionId, onUpdate, onRefresh, onReset }) {
  const partData = session?.participants?.[user.id];
  const tasks = partData?.tasks || {};
  const laptopTask = tasks.laptop || {};

  // Определяем текущий шаг участника
  const laptopType = partData?.laptopType; // null | 'personal' | 'corporate'
  const chromeOk = laptopTask.chromeOk || false;
  const speaklyOk = laptopTask.speaklyOk || false;
  const completedServices = laptopTask.completedServices || [];
  const allServicesDone = SERVICES_LIST.every(s => completedServices.includes(s.id));
  const allDone = laptopTask.status === 'done';

  function updateLaptopField(fields) {
    onUpdate('laptop', fields);
  }

  // Шаг 1: Выбор типа ноутбука
  if (!laptopType) {
    return (
      <div className="ps-panel">
        <div className="ps-panel-header">
          <h3>Участник</h3>
          <div className="ps-header-right">
            <button className="ps-reset-btn" onClick={onReset}>Сбросить</button>
          </div>
        </div>
        <div className="ps-task-detail-area">
          <div className="ps-task-content">
            <h3>Подготовка ноутбука</h3>
            <div className="ps-instruction"><p>Какой ноутбук вы будете использовать?</p></div>
            <div className="ps-toggle-group">
              <button className="ps-toggle-btn" onClick={async () => {
                await fetch(`${API_BASE}/${sessionId}/progress`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ role: 'participant', userId: user.id, userName: user.name, laptopType: 'personal', taskId: 'laptop', taskData: { status: 'in_progress' } })
                });
                onRefresh();
              }}>Свой личный</button>
              <button className="ps-toggle-btn" onClick={async () => {
                await fetch(`${API_BASE}/${sessionId}/progress`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ role: 'participant', userId: user.id, userName: user.name, laptopType: 'corporate', taskId: 'laptop', taskData: { status: 'in_progress' } })
                });
                onRefresh();
              }}>Корпоративный</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Для корпоративного — сразу переходим к Chrome (пропускаем DeviceCheck)
  // Для личного — тоже сразу Chrome (DeviceCheck убрали для упрощения)

  return (
    <div className="ps-panel">
      <div className="ps-panel-header">
        <h3>Участник</h3>
        <div className="ps-header-right">
          {partData?.laptopType && <span className="ps-user-contact">{partData.laptopType === 'personal' ? 'Личный' : 'Корпоративный'}</span>}
          <button className="ps-reset-btn" onClick={onReset}>Сбросить</button>
        </div>
      </div>
      <div className="ps-task-detail-area">
        {allDone ? (
          <div className="ps-task-content">
            <h3>Подготовка завершена!</h3>
            <div className="ps-status-badge" style={{ marginBottom: '1.5rem' }}>✅ Вы успешно зарегистрировались во всех сервисах</div>
          </div>
        ) : (
          <div className="ps-task-content">
            <h3>Подготовка ноутбука</h3>

            {/* Chrome */}
            <div className="ps-service-card">
              <div className="ps-service-header">
                <h4>Google Chrome</h4>
                <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer" className="ps-service-link">Скачать ↗</a>
              </div>
              <div className="ps-service-desc">Для работы с сервисами необходим браузер Google Chrome. Если он ещё не установлен, скачайте и установите его.</div>
              <label className={`ps-service-check ${chromeOk ? 'checked' : ''}`}>
                <input type="checkbox" checked={chromeOk} onChange={() => updateLaptopField({ chromeOk: !chromeOk, status: 'in_progress' })} />
                <span>Chrome установлен</span>
              </label>
            </div>

            {/* Speakly */}
            {chromeOk && (
              <div className="ps-service-card">
                <div className="ps-service-header">
                  <h4>Speakly</h4>
                  <a href="https://www.genspark.ai/speakly/invite/N2VlNGU2ZDdMNWIxM0xlZTk0TGFlZTk5N2ZjNjA0OEwxZThk" target="_blank" rel="noopener noreferrer" className="ps-service-link">Установить ↗</a>
                </div>
                <div className="ps-service-desc">Установите расширение Speakly для Google Chrome.</div>
                <label className={`ps-service-check ${speaklyOk ? 'checked' : ''}`}>
                  <input type="checkbox" checked={speaklyOk} onChange={() => updateLaptopField({ speaklyOk: !speaklyOk, status: 'in_progress' })} />
                  <span>Speakly установлен</span>
                </label>
              </div>
            )}

            {/* Сервисы */}
            {chromeOk && speaklyOk && (
              <>
                <h3 style={{ marginTop: '1.5rem' }}>Регистрация в сервисах</h3>
                <div className="ps-instruction"><p>Пройдите регистрацию в каждом сервисе через Google-аккаунт и подтвердите доступ:</p></div>
                {SERVICES_LIST.map(service => (
                  <div key={service.id} className="ps-service-card">
                    <div className="ps-service-header">
                      <h4>{service.name}</h4>
                      <a href={service.url} target="_blank" rel="noopener noreferrer" className="ps-service-link">Перейти ↗</a>
                    </div>
                    <div className="ps-service-desc">{service.desc}</div>
                    <label className={`ps-service-check ${completedServices.includes(service.id) ? 'checked' : ''}`}>
                      <input type="checkbox" checked={completedServices.includes(service.id)} onChange={() => {
                        const newCompleted = completedServices.includes(service.id)
                          ? completedServices.filter(s => s !== service.id)
                          : [...completedServices, service.id];
                        const servicesDone = SERVICES_LIST.every(s => newCompleted.includes(s.id));
                        updateLaptopField({ completedServices: newCompleted, status: servicesDone ? 'done' : 'in_progress' });
                      }} />
                      <span>Зарегистрировался, доступ есть</span>
                    </label>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== RoleSelect =====
function RoleSelect({ sessionName, onSelect }) {
  return (
    <div className="ps-role-select">
      <h2>Подготовка к сессии</h2>
      {sessionName && <p className="ps-session-name">{sessionName}</p>}
      <p className="ps-role-prompt">Выберите вашу роль:</p>
      <div className="ps-role-cards">
        <button className="ps-role-card" onClick={() => onSelect('tech')}>
          <span className="ps-role-icon">🔧</span>
          <span className="ps-role-title">Технический специалист</span>
          <span className="ps-role-desc">Подготовка помещения и оборудования</span>
        </button>
        <button className="ps-role-card" onClick={() => onSelect('participant')}>
          <span className="ps-role-icon">👤</span>
          <span className="ps-role-title">Участник обучения</span>
          <span className="ps-role-desc">Подготовка ноутбука и сервисов</span>
        </button>
      </div>
    </div>
  );
}

// ===== Main =====
export default function PrepSessionPage() {
  const [role, setRole] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => { setUser(getUser()); setSessionId(getSessionId()); }, []);
  useEffect(() => { if (user) localStorage.setItem('prepUser', JSON.stringify(user)); }, [user]);

  useEffect(() => {
    if (sessionId === null) return;
    if (!sessionId) { setError('Не указан ID сессии. Откройте приложение через ссылку из бота.'); setLoading(false); return; }
    fetchSession();
  }, [sessionId]);

  // Авто-регистрация как тех. специалист
  useEffect(() => {
    if (!session || !user?.id || !sessionId) return;
    if (role) return;

    // Если уже зарегистрирован как тех. специалист — сразу показываем панель
    if (session.techSpecialists?.[user.id]) {
      setRole('tech');
      return;
    }

    // Иначе показываем форму контактных данных (role остаётся null)
  }, [session, user?.id, sessionId, role]);

  async function fetchSession() {
    try {
      const res = await fetch(`${API_BASE}/${sessionId}`);
      if (!res.ok) throw new Error('Сессия не найдена');
      setSession(await res.json());
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleContactSubmit({ fullName, telegram }) {
    try {
      const res = await fetch(`${API_BASE}/${sessionId}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'tech', userId: user.id, userName: fullName, contact: telegram })
      });
      const data = await res.json();
      if (data.ok) { setSession(data.session); setRole('tech'); }
    } catch (e) { setError('Ошибка регистрации: ' + e.message); }
  }

  async function updateProgress(taskId, taskData) {
    try {
      const res = await fetch(`${API_BASE}/${sessionId}/progress`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'tech', userId: user.id, userName: user.name, taskId, taskData })
      });
      const data = await res.json();
      if (data.ok) setSession(data.session);
    } catch (e) { console.error('Progress update failed:', e); }
  }

  async function resetRole() {
    if (!confirm('Вы уверены? Все данные и загруженные фото будут удалены.')) return;
    try {
      const res = await fetch(`${API_BASE}/${sessionId}/progress`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'tech', userId: user.id, action: 'reset' })
      });
      const data = await res.json();
      if (data.ok) { setSession(data.session); setRole(null); }
    } catch (e) { console.error('Reset failed:', e); }
  }

  return (
    <>
      <Head>
        <title>Подготовка к сессии</title>
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </Head>
      <div className="prep-session">
        {loading ? (
          <div className="ps-loading">Загрузка...</div>
        ) : error ? (
          <div className="ps-error-screen">
            <div className="ps-error-icon">⚠️</div>
            <p>{error}</p>
          </div>
        ) : !role ? (
          <TechContactForm sessionName={session?.name} onSubmit={handleContactSubmit} />
        ) : (
          <TechPanel session={session} user={user} sessionId={sessionId} onUpdate={updateProgress} onRefresh={fetchSession} onReset={resetRole} />
        )}
      </div>
    </>
  );
}
