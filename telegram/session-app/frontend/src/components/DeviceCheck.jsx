import React, { useState } from 'react';
import { useDeviceCheck } from '../hooks/useDeviceCheck';

const DeviceCheck = ({ onComplete }) => {
  const { specs, checkDevice } = useDeviceCheck();
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleCheck = () => {
    setLoading(true);
    setTimeout(() => {
      const result = checkDevice();
      setLoading(false);
      if (onComplete) onComplete(result);
    }, 1500);
  };

  const Row = ({ label, current, target, isValid }) => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      padding: '8px 0', 
      borderBottom: '1px solid #eee' 
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.8rem', color: '#888' }}>{label}</div>
        <div style={{ fontWeight: '500' }}>{current}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '0.8rem', color: '#888' }}>Требуется</div>
        <div style={{ fontWeight: '500' }}>{target} {isValid ? '✅' : '❌'}</div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '20px', background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', margin: '15px 0' }}>
      <h3 style={{ marginTop: 0 }}>💻 Автоматическая проверка</h3>
      
      {!specs ? (
        <>
          <p style={{ fontSize: '0.9rem', color: '#666' }}>
            Нажми кнопку, чтобы система сравнила параметры твоего ноутбука с требованиями ТЗ.
          </p>
          <label style={{ display: 'block', marginBottom: '15px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={accepted} 
              onChange={(e) => setAccepted(e.target.checked)} 
            />
            <span style={{ marginLeft: '8px', fontSize: '0.85rem' }}>
              Разрешить проверку (ОС, RAM, Браузер)
            </span>
          </label>
          <button 
            disabled={!accepted || loading}
            onClick={handleCheck}
            style={{
              width: '100%',
              padding: '12px',
              background: accepted ? '#0088cc' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: accepted ? 'pointer' : 'default'
            }}
          >
            {loading ? 'Идет сканирование...' : 'Сравнить характеристики'}
          </button>
        </>
      ) : (
        <div style={{ textAlign: 'left' }}>
          <Row 
            label="Операционная система" 
            current={specs.os} 
            target="Win 10/11, macOS" 
            isValid={specs.os === 'Windows 10/11' || specs.os === 'macOS'} 
          />
          <Row 
            label="Объем памяти (RAM)" 
            current={specs.ram >= 8 ? "8 GB или более" : `${specs.ram} GB`} 
            target="≥ 8 GB" 
            isValid={specs.ram >= 8} 
          />
          <Row 
            label="Веб-браузер" 
            current={specs.browser} 
            target="Chrome" 
            isValid={specs.isChrome} 
          />

          {specs.isValid ? (
            <div style={{ 
              background: '#e6f4ea', 
              color: '#1e8e3e', 
              padding: '10px', 
              borderRadius: '8px', 
              marginTop: '15px',
              textAlign: 'center',
              fontWeight: 'bold'
            }}>
              ✅ Соответствует ТЗ
            </div>
          ) : (
            <div style={{ 
              background: '#fce8e6', 
              color: '#d93025', 
              padding: '10px', 
              borderRadius: '8px', 
              marginTop: '15px'
            }}>
              <strong>⚠️ Есть отклонения:</strong>
              <ul style={{ paddingLeft: '18px', margin: '5px 0', fontSize: '0.9rem' }}>
                {specs.errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}
          
          <button 
            onClick={() => window.location.reload()}
            style={{ 
              marginTop: '15px', 
              background: 'none', 
              border: '1px solid #ccc', 
              padding: '5px 10px', 
              borderRadius: '4px', 
              fontSize: '0.8rem',
              color: '#666'
            }}
          >
            Обновить и проверить снова
          </button>
        </div>
      )}
    </div>
  );
};

export default DeviceCheck;
