import fs from 'fs';
import path from 'path';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { renderToBuffer } from '@react-pdf/renderer';

// Загрузка .env как fallback (на случай если Next.js не загрузил)
function loadEnvFallback() {
  if (process.env.OPENROUTER_API_KEY) return;
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return;
      const key = trimmed.slice(0, eqIndex).trim();
      const val = trimmed.slice(eqIndex + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    });
  } catch (e) {
    console.error('[Analytics] Ошибка загрузки .env:', e.message);
  }
}
loadEnvFallback();

// Шрифт для PDF
Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf'
});

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Roboto', fontSize: 10, color: '#333' },
  header: { marginBottom: 12, borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: '#2563eb', paddingBottom: 8 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#2563eb', marginBottom: 4 },
  subTitle: { fontSize: 10, color: '#666' },
  section: { marginTop: 10, marginBottom: 6 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', backgroundColor: '#eff6ff', padding: 6, marginBottom: 8, color: '#1e40af', borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: '#2563eb' },
  paragraph: { fontSize: 10, lineHeight: 1.5, color: '#333', marginBottom: 6 },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, fontSize: 8, color: '#999', textAlign: 'center', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: '#eee', paddingTop: 6 },
});

// Парсим ответ LLM в секции
function parseAnalysis(text) {
  const sections = [];
  const lines = text.split('\n');
  let currentTitle = '';
  let currentContent = '';

  for (const line of lines) {
    // Ищем заголовки (## или **заголовок**)
    const headerMatch = line.match(/^#{1,3}\s+(.+)/) || line.match(/^\*\*(.+)\*\*$/);
    if (headerMatch) {
      if (currentTitle || currentContent.trim()) {
        sections.push({ title: currentTitle, content: currentContent.trim() });
      }
      currentTitle = headerMatch[1].replace(/\*\*/g, '').trim();
      currentContent = '';
    } else {
      // Убираем markdown-форматирование
      const clean = line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^[-•]\s*/, '  - ');
      currentContent += clean + '\n';
    }
  }
  if (currentTitle || currentContent.trim()) {
    sections.push({ title: currentTitle, content: currentContent.trim() });
  }

  return sections.length > 0 ? sections : [{ title: 'Аналитический отчёт', content: text }];
}

// React-компонент PDF аналитики
const AnalyticsPDF = ({ userName, date, analysisText }) => {
  const sections = parseAnalysis(analysisText);

  return (
    React.createElement(Document, { title: `Аналитика_${userName}_${date}` },
      React.createElement(Page, { size: 'A4', style: styles.page },
        React.createElement(View, { style: styles.header },
          React.createElement(Text, { style: styles.title }, 'Аналитический отчёт МАЯК'),
          React.createElement(Text, { style: styles.subTitle }, `Участник: ${userName} | Дата: ${date}`),
          React.createElement(Text, { style: styles.subTitle }, 'Сформировано с помощью ИИ на основе данных прохождения тренажёра')
        ),
        ...sections.map((section, i) =>
          React.createElement(View, { key: i, style: styles.section },
            section.title
              ? React.createElement(Text, { style: styles.sectionTitle }, section.title)
              : null,
            React.createElement(Text, { style: styles.paragraph }, section.content)
          )
        ),
        React.createElement(View, { style: styles.footer, fixed: true },
          React.createElement(Text, null, 'Тренажёр МАЯК | Аналитический отчёт | Сгенерировано ИИ')
        )
      )
    )
  );
};

// Промпт для LLM
function buildPrompt(logData) {
  const { userName, userRole, date, totalTime, rankingData, tasks } = logData;

  const rankingStr = rankingData && rankingData.length > 0
    ? rankingData.map((r, i) =>
      `Уровень ${i + 1}: вход=${r.in ?? '—'}, выход=${r.out ?? '—'}, время входа=${r.inTime || 0}с, время выхода=${r.outTime || 0}с`
    ).join('\n')
    : 'Данные ранжирования отсутствуют';

  // Фильтруем вводные задания — они не несут данных для анализа
  const realTasks = (tasks || []).filter(t =>
    t.finalPrompt && t.finalPrompt !== '' && t.finalPrompt !== '(вводное задание)'
  );

  // Парсим "MM:SS" в секунды для расчёта КПЗ
  const parseTimeToSec = (timeStr) => {
    if (!timeStr || timeStr === '—') return 0;
    const parts = timeStr.split(':');
    if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    return 0;
  };

  const tasksStr = realTasks.length > 0
    ? realTasks.map(t => {
      const mayak = t.mayak || {};
      const timeSec = parseTimeToSec(t.time);
      return [
        `--- Задание №${t.number} ---`,
        t.taskTitle ? `Название: ${t.taskTitle}` : '',
        t.contentType ? `Тип контента: ${t.contentType}` : '',
        `Время выполнения: ${t.time || '—'} (${timeSec} сек)`,
        t.avgTime ? `Среднее время других участников: ${Math.floor(t.avgTime / 60)}:${(t.avgTime % 60).toString().padStart(2, '0')} (${t.avgTime} сек)` : 'Среднее время: нет данных',
        t.description ? `Описание: ${t.description}` : '',
        t.taskText ? `Задание: ${t.taskText}` : '',
        `МАЯК-ОКО:`,
        `  М (Миссия): ${mayak.m || '—'}`,
        `  А (Аудитория): ${mayak.a || '—'}`,
        `  Я (Роль): ${mayak.y || '—'}`,
        `  К (Критерии): ${mayak.k || '—'}`,
        `  О (Ограничения): ${mayak.o1 || '—'}`,
        `  К (Контекст): ${mayak.k2 || '—'}`,
        `  О (Оформление): ${mayak.o2 || '—'}`,
        `Итоговый промпт: ${t.finalPrompt || '—'}`,
      ].filter(Boolean).join('\n');
    }).join('\n\n')
    : 'Данные по заданиям отсутствуют';

  return `# РОЛЬ

Ты — эксперт-аналитик тренажёра «МАЯК» (практикум по промпт-инжинирингу).
Участник уже получил протокол прохождения (сырые данные). Твоя задача —
дать то, чего в протоколе нет: объективную оценку уровня, понятную обратную
связь и конкретный план роста. Пиши так, чтобы человек, прочитав отчёт,
чётко понял: «Вот где я сейчас, вот что у меня получается, вот что подтянуть,
и вот конкретные шаги».

---

# МЕТОДОЛОГИЯ МАЯК-ОКО

Качественный промпт состоит из 7 компонентов:

| Поле | Компонент       | Что должно быть                                  |
|------|-----------------|--------------------------------------------------|
| m    | М — Миссия      | Чёткая цель: что именно должен сделать ИИ        |
| a    | А — Аудитория   | Для кого предназначен результат                  |
| y    | Я — Роль        | Какую роль/персону принимает ИИ                  |
| k    | К — Критерии    | По каким критериям оценивать качество результата |
| o1   | О — Ограничения | Обязательные условия и запреты                   |
| k2   | К — Контекст    | В каком контексте будет использован результат    |
| o2   | О — Оформление  | Требования к формату и структуре                 |

---

# РАСЧЁТ ПОКАЗАТЕЛЕЙ

## S_intellectual (Методологическая грамотность)

Для КАЖДОГО задания с непустым finalPrompt:
1. Сравни каждое из 7 полей МАЯК-ОКО с description и taskText задания.
2. Оцени релевантность каждого поля:
   - [+] = поле релевантно и содержательно = 1 балл
   - [~] = частично релевантно или поверхностно = 0.5 балла
   - [-] = нерелевантно, пустое, или содержит «чужой» текст = 0 баллов
3. S_задания = (сумма баллов / 7) x 100%

ВАЖНО: красиво написанное поле с содержимым, не относящимся к ЭТОМУ заданию —
это [-], не [+]. Называй такие случаи прямо, но без осуждения.

S_intellectual = среднее S_задания по всем оценённым заданиям.

## КПЗ (Коэффициент Поведенческих Затрат)

Оценивает, какой «ценой» достигнут результат — сколько времени и усилий
потрачено относительно нормы.

Для каждого задания с avgTime:
  КПЗ_задания = фактическое_время_сек / avgTime_сек
  (если avgTime отсутствует — пропускай задание в расчёте КПЗ)

Парсинг поля time: формат «MM:SS» — переведи в секунды.

КПЗ_общий = среднее КПЗ_задания по всем заданиям, где есть avgTime.

Дополнительные штрафы к КПЗ (прибавляются к среднему):
- Если время ранжирования (inTime + outTime) по 3+ уровням < 2 сек
  на уровень — это механическое кликание, +0.3 к КПЗ
- Если 50%+ заданий выполнены быстрее 1 минуты — поспешность, +0.2 к КПЗ

Если avgTime нет ни у одного задания — оцени КПЗ качественно:
  < 1 мин на задание в среднем = высокий КПЗ (поспешность)
  1-5 мин = нормальный КПЗ (около 1.0)
  > 10 мин = высокий КПЗ (перфекционизм/затруднения)

Интерпретация:
  КПЗ около 1.0 = нормальный темп
  КПЗ < 0.5 = подозрительно быстро, формальный подход
  КПЗ 0.5-0.8 = быстрый, но может быть эффективным
  КПЗ 1.5-2.0 = затруднения или тщательная работа
  КПЗ > 2.0 = серьёзные затруднения

## Когнитивная эффективность (E)

E = S_intellectual / КПЗ_общий

Интерпретация:
  E > 70 = Высокая эффективность (хороший результат при разумных затратах)
  E 40-70 = Средняя эффективность
  E < 40 = Низкая эффективность (слабый результат, или результат достигнут
           слишком большой ценой)

## Матрица когнитивных архетипов

Архетип определяется по двум осям:
  X = S_intellectual (Методологическая грамотность)
  Y = E (Когнитивная эффективность)

| S_intellectual | E       | Архетип                            |
|----------------|---------|------------------------------------|
| >= 70%         | >= 50   | МАСТЕР — знает и делает эффективно |
| >= 70%         | < 50    | ТРУДОГОЛИК — знает, но с трудом    |
| < 50%          | < 50    | НОВИЧОК — учится и набирается опыта|
| < 50%          | >= 50   | ТАЛАНТЛИВЫЙ — быстрый, но хаотичный|
| 50-70%         | любая   | ПЕРЕХОДНЫЙ — укажи ближайшие два   |

---

# АЛГОРИТМ АНАЛИЗА

**Шаг 1. Базовые параметры**
Имя, роль, дата, общее время сессии.

**Шаг 2. Анализ заданий**
Только задания с непустым finalPrompt (не «(вводное задание)»).

Для каждого задания:
  а) Полнота: сколько из 7 полей заполнено (не пусто и не «—»)?
  б) Релевантность: оцени каждое поле [+]/[~]/[-] относительно
     description и taskText.
  в) Итоговый промпт: finalPrompt решает задачу из taskText?
     Содержит ли он суть полей МАЯК-ОКО или написан «с нуля» мимо них?
  г) Время: сравни time с avgTime (если есть).
  д) Рассчитай S_задания и КПЗ_задания.

**Шаг 3. Ранжирование**
Для каждого из 5 уровней: дельта = in - out.
  Положительная дельта = участник улучшил позицию промпта (хорошо).
  Отрицательная = ухудшил (значит, ещё не понимает критерии качества).
  Время <= 1 сек = выбор без раздумий.

**Шаг 4. Расчёт итоговых показателей**
S_intellectual, КПЗ, E — по формулам выше.
Определи архетип по матрице.

---

# ДАННЫЕ УЧАСТНИКА

Участник: ${userName}
Роль: ${userRole || 'не указана'}
Дата: ${date}
Общее время сессии: ${totalTime}

=== Результаты ранжирования (МАЯК-ОКО) ===
${rankingStr}

=== Детализация по заданиям ===
${tasksStr}

---

# ФОРМАТ ОТЧЁТА

Составь аналитический отчёт строго по следующей структуре.
Обращайся к участнику на «вы».

**1. Ваш результат**
2-3 предложения: суть прохождения, честно и поддерживающе.
Укажи количество выполненных заданий и общее время.

**2. Ваш профиль: расчёт показателей**
Покажи прозрачный расчёт — участник должен понять, откуда взялись цифры:
  - S_intellectual = ...% (с пояснением)
  - КПЗ = ... (с пояснением, что означает: быстро/нормально/медленно)
  - E = S_intellectual / КПЗ = ...
  - Архетип: НАЗВАНИЕ
  - 2-3 предложения: что этот архетип означает для участника простым языком,
    без оценочности. Не «вы плохой», а «вот ваш текущий стиль работы и вот
    что из этого следует».

**3. Разбор заданий**
Для каждого значимого задания (пропускай однотипные, если их много —
разбери 3-4 самых показательных):
  - Задание №X: краткое описание (1 строка)
  - Таблица 7 полей МАЯК-ОКО: поле | что написал участник (кратко) | оценка [+]/[~]/[-]
  - S_задания = ...%
  - Вывод: решает ли итоговый промпт задачу? Что конкретно упущено?
Если участник системно пропускает одни и те же поля — укажи паттерн.

**4. Динамика ранжирования**
Таблица 5 уровней: вход -> выход, дельта, время.
Вывод: улучшилось ли понимание критериев качества промпта?
Были ли уровни, пройденные «вслепую» (< 2 сек)?

**5. Ваши сильные стороны**
3 пункта. Только конкретные, подтверждённые данными.
Формат: «Что вы делаете хорошо» + «Почему это важно».
Примеры привязки: «В задании №X вы отлично сформулировали Миссию —
это говорит о понимании целеполагания при работе с ИИ».

**6. Зоны роста**
3 пункта. С отсылкой к конкретным данным.
Формат: «Что можно улучшить» + «Как это проявилось в ваших данных».
Фокусируйся на паттернах, а не на единичных ошибках.
Например: «Поле "Аудитория" было пустым или нерелевантным в 4 из 5 заданий —
это самая частая зона роста. Без указания аудитории ИИ не может
адаптировать стиль и глубину ответа».

**7. Персональные рекомендации**
3-5 конкретных действий, привязанных к архетипу и данным участника:

Для МАСТЕРА (S >= 70%, E >= 50):
  - Усложняйте задачи: цепочки промптов, мульти-шаговые сценарии
  - Попробуйте себя в роли наставника — объясняйте МАЯК-ОКО другим
  - Экспериментируйте с нестандартными ролями и контекстами в промптах

Для ТРУДОГОЛИКА (S >= 70%, E < 50):
  - Доверяйте первой формулировке — не нужно переписывать каждое поле
  - Ставьте таймер: 3-4 минуты на задание достаточно
  - Фокусируйтесь на Миссии и Критериях — остальные поля можно заполнять
    короче

Для НОВИЧКА (S < 50%, E < 50):
  - Начинайте с заполнения только 3 полей: Миссия, Роль, Критерии
  - Перед заполнением перечитайте описание задания и выделите ключевые слова
  - Практикуйтесь на простых заданиях: «напиши текст», «составь список»

Для ТАЛАНТЛИВОГО (S < 50%, E >= 50):
  - Ваша скорость — преимущество, но проверяйте релевантность каждого поля
  - Используйте чек-лист: перед отправкой промпта пройдитесь по 7 полям
  - Обратите внимание на поля, которые вы чаще всего пропускаете

**8. Что делать прямо сейчас**
1-2 предложения: одно конкретное действие, с которого стоит начать.
Например: «Возьмите любое задание и потренируйтесь заполнять поле
"Аудитория" — опишите, кто именно будет читать результат ИИ и какой
у этого человека уровень подготовки».

---

# ТРЕБОВАНИЯ К ТОНУ И СТИЛЮ

- Обращайся к участнику на «вы» — это персональный отчёт для него
- Тон: профессиональный коуч, не судья. Уважительно, но честно
- Каждый вывод подтверждай данными: номер задания, конкретное поле, цифра
- Честность важнее комплиментов: формальный подход называй прямо,
  но объясняй, почему это важно и как исправить
- Не пиши «всё хорошо» если S_intellectual < 50% — это не помощь участнику
- Не пиши «всё плохо» если S_intellectual > 70% — ищи точки роста
- Избегай абстрактных советов типа «улучшайте качество промптов» —
  всегда указывай конкретное поле, конкретное задание, конкретное действие

ВАЖНО: Не используй эмодзи в ответе — отчёт рендерится в PDF, где эмодзи
не поддерживаются. Вместо эмодзи используй текстовые маркеры: [+], [~], [-].`;
}

// Вызов OpenRouter API
async function callLLM(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не задан');
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8000,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter API error: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'Не удалось получить анализ';
}

// Основная функция: генерация аналитического PDF
export async function generateAnalytics(sessionId, sessionsDir) {
  const logDataPath = path.join(sessionsDir, `${sessionId}_logdata.json`);

  if (!fs.existsSync(logDataPath)) {
    throw new Error('Данные лога не найдены');
  }

  const logData = JSON.parse(fs.readFileSync(logDataPath, 'utf-8'));

  // Вызываем LLM
  const prompt = buildPrompt(logData);
  console.log(`[Analytics] Запрос к LLM для сессии ${sessionId}...`);
  const analysisText = await callLLM(prompt);
  console.log(`[Analytics] Ответ получен (${analysisText.length} символов)`);

  // Генерируем PDF
  const pdfBuffer = await renderToBuffer(
    React.createElement(AnalyticsPDF, {
      userName: logData.userName,
      date: logData.date,
      analysisText,
    })
  );

  // Сохраняем
  const analyticsPath = path.join(sessionsDir, `${sessionId}_analytics.pdf`);
  fs.writeFileSync(analyticsPath, pdfBuffer);
  console.log(`[Analytics] PDF сохранён: ${analyticsPath}`);

  return analyticsPath;
}
