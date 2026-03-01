import React from 'react';

export default function TaskList({ tasks, selected, onSelect }) {
  return (
    <div className="task-list">
      {tasks.map(task => (
        <button
          key={task.id}
          className={`task-list-item ${selected === task.id ? 'selected' : ''} ${task.status}`}
          onClick={() => onSelect(task.id)}
        >
          <span className="task-icon">{task.icon}</span>
          <span className="task-title">{task.title}</span>
          <span className="task-status-icon">
            {task.status === 'done' ? '✅' : task.status === 'in_progress' ? '🔄' : '⏳'}
          </span>
        </button>
      ))}
    </div>
  );
}
