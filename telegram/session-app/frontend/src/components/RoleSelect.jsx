import React from 'react';

export default function RoleSelect({ sessionName, onSelect }) {
  return (
    <div className="role-select">
      <h1>Подготовка к сессии</h1>
      {sessionName && <p className="session-name">{sessionName}</p>}
      <p className="role-prompt">Выберите вашу роль:</p>
      <div className="role-cards">
        <button className="role-card" onClick={() => onSelect('tech')}>
          <span className="role-icon">🔧</span>
          <span className="role-title">Технический специалист</span>
          <span className="role-desc">Подготовка помещения, интернета и оборудования</span>
        </button>
        <button className="role-card" onClick={() => onSelect('participant')}>
          <span className="role-icon">👤</span>
          <span className="role-title">Участник обучения</span>
          <span className="role-desc">Подготовка ноутбука и сервисов</span>
        </button>
      </div>
    </div>
  );
}
