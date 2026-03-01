import React, { useState, useEffect } from 'react';
import RoleSelect from './components/RoleSelect.jsx';
import TechPanel from './components/TechPanel.jsx';
import ParticipantPanel from './components/ParticipantPanel.jsx';
import DeviceCheck from './components/DeviceCheck.jsx';

const API_BASE = '';

function getSessionId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('session');
}

function getTgUser() {
  try {
    // 1. Try to get from Telegram WebApp
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      tg.ready();
      tg.expand();
      const user = {
        id: String(tg.initDataUnsafe.user.id),
        name: [tg.initDataUnsafe.user.first_name, tg.initDataUnsafe.user.last_name].filter(Boolean).join(' ') || 'User'
      };
      // Save to localStorage for persistence
      localStorage.setItem('tgUser', JSON.stringify(user));
      return user;
    }

    // 2. Try to restore from localStorage
    const savedUser = localStorage.getItem('tgUser');
    if (savedUser) {
      return JSON.parse(savedUser);
    }
  } catch (e) {
    console.error('Error in getTgUser:', e);
  }

  // 3. Fallback for testing
  const fallbackId = 'test_' + Math.random().toString(36).slice(2, 8);
  const fallbackUser = { id: fallbackId, name: 'Тестовый пользователь' };
  return fallbackUser;
}

export default function App() {
  const [role, setRole] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(() => getTgUser());
  const sessionId = getSessionId();

  useEffect(() => {
    // Сохраняем user в localStorage на случай перезагрузки, 
    // чтобы getTgUser не генерировал новый тестовый ID
    if (user) {
      localStorage.setItem('tgUser', JSON.stringify(user));
    }
  }, [user]);

  useEffect(() => {
    if (!sessionId) {
      setError('Не указан ID сессии. Откройте приложение через ссылку из бота.');
      setLoading(false);
      return;
    }
    fetchSession();
  }, [sessionId]);

  // Устанавливаем роль после загрузки сессии
  useEffect(() => {
    if (session && user?.id && !role) {
      if (session.techSpecialists?.[user.id]) {
        setRole('tech');
      } else if (session.participants?.[user.id]) {
        setRole('participant');
      }
    }
  }, [session, user?.id, role]);

  const clearTestUser = () => {
    localStorage.removeItem('tgUser');
    window.location.reload();
  };

  async function fetchSession() {
    try {
      const res = await fetch(`${API_BASE}/api/session/${sessionId}`);
      if (!res.ok) throw new Error('Сессия не найдена');
      const data = await res.json();
      setSession(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectRole(selectedRole) {
    try {
      const res = await fetch(`${API_BASE}/api/session/${sessionId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          userId: user.id,
          userName: user.name
        })
      });
      const data = await res.json();
      if (data.ok) {
        setSession(data.session);
        setRole(selectedRole);
      }
    } catch (e) {
      setError('Ошибка регистрации: ' + e.message);
    }
  }

  async function updateProgress(taskId, taskData) {
    try {
      const res = await fetch(`${API_BASE}/api/session/${sessionId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          userId: user.id,
          userName: user.name,
          taskId,
          taskData
        })
      });
      const data = await res.json();
      if (data.ok) {
        setSession(data.session);
      }
    } catch (e) {
      console.error('Progress update failed:', e);
    }
  }

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  if (error) {
    return (
      <div className="error-screen">
        <div className="error-icon">⚠️</div>
        <p>{error}</p>
      </div>
    );
  }

  if (!role) {
    return (
      <>
        <RoleSelect
          sessionName={session?.name}
          onSelect={selectRole}
        />
        {user.id.startsWith('test_') && (
          <button onClick={clearTestUser} style={{position:'absolute', bottom:10, right:10, fontSize:'0.7rem', color:'#999', background: 'transparent', border: '1px solid #ccc', padding: '4px 8px', borderRadius: '4px'}}>
            Сбросить тест. юзера
          </button>
        )}
      </>
    );
  }

  return (
    <>
      {role === 'tech' ? (
        <TechPanel
          session={session}
          user={user}
          sessionId={sessionId}
          onUpdate={updateProgress}
          onRefresh={fetchSession}
        />
      ) : (
        <ParticipantPanel
          session={session}
          user={user}
          sessionId={sessionId}
          onUpdate={updateProgress}
          onRefresh={fetchSession}
        />
      )}
      
      {/* Кнопка для сброса юзера для тестовых пользователей */}
      {user.id.startsWith('test_') && (
        <button 
          onClick={clearTestUser} 
          style={{
            display: 'block', 
            margin: '20px auto', 
            padding: '8px 16px', 
            background: '#ff4d4f', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 Сбросить роль и сессию (Dev)
        </button>
      )}
    </>
  );
}
import './styles/role-select.css';
