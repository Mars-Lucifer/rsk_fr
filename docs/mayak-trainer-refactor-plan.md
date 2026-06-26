# План рефакторинга тренажёра МАЯК (`tools-2`)

Дата составления: 2026-06-26.
Область: `src/components/features/tools-2/` (точка входа `src/pages/tools/mayak-oko.js`).

Документ — рабочий план разгрузки монолита тренажёра. Он НЕ меняет контракты
`/api/mayak/*`, формат файлов `data/mayak-*`, легаси-токены и session-режим как
домен. Принцип приоритетов проекта: стабильность > корректность > скорость >
оптимизация. Каждый этап проверяется сборкой `next build --webpack` и ручным
прогоном затронутого сценария.

## Контекст окружения

- Источник контента выбирается в `src/lib/mayakContentStorage.js`
  (`getMayakContentDir`): `MAYAK_CONTENT_DIR` → `data/mayak-content` →
  легаси `public/tasks-2/v2`.
- В текущем workspace `MAYAK_CONTENT_DIR` не задан, `data/mayak-content`
  отсутствует, поэтому активен фолбэк `public/tasks-2/v2` (есть `manifest.json`
  и секции). Для проверки рефакторинга реальный `MAYAK_CONTENT_DIR` НЕ требуется.

## Диагностика (кратко)

| Файл | Строк | Статус |
|------|------|--------|
| `trainer.js` | 2564 | god-component |
| `settings.js` | 1272 | 4 потока авторизации в одном файле |
| `addons/RankingTestPopup.js` | 950 | UI + drag&drop + таймеры вместе |
| `index.js` | 788 | standalone-страница, много локального state |
| `TrainerUiSections.js` | 434 | `TrainerControls` принимает 30+ props |

Подтверждённые находки (проверены чтением кода):

1. `hooks/useMayakGroqEvaluation.js` (285 стр.) — мёртвый фронтовый хук, нигде не
   импортируется. Дубль `useMayakQwenEvaluation` на ~95% (остаток A/B).
   Серверная часть (`api/mayak/groq-check.js`, `lib/mayakGroq.js`,
   `api/admin/groq-tokens/*`) изолирована, но имеет админский импорт — удалять
   её отдельно, после проверки админ-UI.
2. `trainer.js:2023` — `{false && currentTaskReviewComment ? (...)}`, всегда false.
3. `yaProgress` — `useMemo` на ~260 строк доменной логики прямо в компоненте.
4. Inline-обработчики сети по 40–75 строк (`handleSessionTaskUpload`,
   `handleYaDirectionConfirm`, `handleResolveInspectorReview`, `handleUseJokerStar`,
   `autoCompleteIntroTask`) с повтором паттерна `fetch → success → refresh state`
   в 4 местах.
5. Огромный inline-JSX: debug-панель (~190 стр.), `trainerFieldsBlock`,
   `trainerOutputBlock`, toast достижений.
6. Широкие хуки: `useMayakTaskExecutionActions` (29 параметров),
   `useMayakTaskManager` (400 стр.), `useMayakCompletionActions` (413 стр.).

Поправка к первичной диагностике: `guardedToggleTaskTimer` и `guardedGoToTask`
НЕ дублируются (определены по одному разу — 1820 и 1836); ранее ошибочно указанные
строки 820/836 относятся к телу `yaProgress`.

## Этапы

### Этап 0 — Безопасная зачистка (нулевой риск)
- Удалить мёртвый фронтовый хук `useMayakGroqEvaluation.js`.
- Удалить мёртвую JSX-ветку `trainer.js:2023`.
- (Опционально, осторожно) обернуть в `useMemo` производные флаги, считаемые
  каждый рендер.
- Серверный Groq (`groq-check`, `mayakGroq`, `admin/groq-tokens`) — оставить,
  пометить кандидатом на удаление после проверки админ-UI.

### Этап 1 — Вынести расчёт прогресса
`yaProgress` → чистый модуль `utils/computeYaProgress.js` + тонкий хук
`useMayakProgressCalculation`. Покрыть юнит-тестами (в коде есть следы багов
«залипания прогресса»).

### Этап 2 — Единый слой session-runtime
Цель: убрать 4-кратный повтор блока «запросить `/session-runtime/state` →
записать в стейт». Сделано через одну стабильную `refreshSessionRuntimeState`
в `trainer.js` (см. журнал). Полный вынос обработчиков (`upload`, `joker-spend`,
`review`, `ya-direction`) и polling-эффекта в отдельный хук СОЗНАТЕЛЬНО отложен:
они сильно связаны с контекстом задачи (`currentTaskData`, `finalizeTaskExecution`,
`timerState`, `activeInspectorReview`) и побочными эффектами polling (синк роли,
куки, редирект). Вынос потребовал бы прокинуть ~10 параметров в хук — это лишь
переместит связанность и повысит риск. Решается вместе с Этапом 4 (сужение хуков).

### Этап 3 — Разбить JSX
Извлечены изолированные оверлеи в `TrainerOverlays.js`: `<TrainerDebugPanel>`
(~190 стр.) и `<AchievementToast>` — `memo`-компоненты, видимостью управляет
родитель, состояние приходит пропсами. `trainerFieldsBlock`/`trainerOutputBlock`
СОЗНАТЕЛЬНО оставлены в компоненте: вплетены в layout-сетку и ссылаются на
десятки локальных переменных — вынос потребовал бы 30+ пропсов с риском
визуальных регрессий ради малой выгоды (кандидат на Этап 4 вместе с сужением
хуков/группировкой пропсов).

### Этап 4 — Сузить широкие хуки (опционально)
- `useMayakTaskExecutionActions`: 29 параметров → сгруппированные объекты.
- `useMayakTaskManager` → `useMayakTaskLoader` + `useMayakTaskTimer`.

### Этап 5 — `settings.js` и `RankingTestPopup.js` (отдельный трек)
- `settings.js` → хуки `useTokenValidation`, `useGuestActivation`, `usePortalAuth`,
  `useAdminBypass`.
- `RankingTestPopup.js` → `useDragAndDrop` + `useLevelTimer` + презентационные
  `RankingLevel`/`RankingResults`.

## Вне области
- Контракты `/api/mayak/*`, формат `data/mayak-*`, легаси-токены, session как домен.
- Легаси `src/components/features/tools/`, `telegram/session-app/`.
- Глобальный стейт-менеджер не вводим: props drilling глубиной 1–2 уровня,
  проблема в ширине пропсов — решается группировкой и под-компонентами.

## Журнал выполнения
- [x] Этап 0 — удалён мёртвый хук `useMayakGroqEvaluation.js` и мёртвая JSX-ветка
  `trainer.js:2023`; сборка `npm run build` зелёная. Обёртку флагов в `useMemo`
  отложил из Этапа 0 как поведенчески-смежную (перенесена в Этап 3).
- [x] Этап 1 — `yaProgress` (~260 стр.) вынесен в чистую
  `mayakProgressModel.computeTrainerYaProgress`. `trainer.js`: 2564 → 2323 стр.
  useMemo стал тонкой обёрткой (сборка manualSource + вызов функции). Сборка
  зелёная, smoke-тест функции на эталонной колоде пройден. Полное слияние с
  серверной `mayakSessionDashboard.computeYaProgress` НЕ делалось (риск для
  joker-логики) — отмечено как отдельная задача.
- [x] Этап 2 — добавлена стабильная `refreshSessionRuntimeState`; устранён
  4-кратный повтор inline-refresh (intro auto-approve, upload, joker-spend,
  решение инспектора). Polling-эффект и обработчики оставлены в компоненте
  (их вынос в хук отложен — см. описание Этапа 2). Сборка зелёная.
- [x] Этап 3 — оверлеи DebugPanel и AchievementToast вынесены в
  `TrainerOverlays.js` (memo). `trainer.js`: 2319 → 2105 строк. Fields/Output
  панели оставлены (см. описание Этапа 3). Сборка зелёная.
- [~] Этап 4 — косметическая группировка пропсов `useMayakTaskExecutionActions`
  и разделение `useMayakTaskManager` ПРОПУЩЕНЫ осознанно: высокий риск (самый
  критичный путь «сдать задание», таймер) при нулевой функциональной выгоде.
- [~] Этап 5 (в работе, требует ручного QA):
  - RankingTestPopup: drag-and-drop (мышь+тач+автоскролл) вынесен в хук
    `useRankingDragAndDrop.js`. 950 → 758 строк. Сборка зелёная, drag-and-drop
    проверен вручную (мышь) — работает.
  - RankingTestPopup: таймер уровня вынесен в `useLevelTimer.js`. 758 → 748
    строк. Нужен короткий ручной тест: секундомер тикает на активном уровне,
    останавливается после «Проверить», сбрасывается при «Пройти заново».
  - RankingTestPopup: localStorage-результаты вынесены в чистый
    `rankingResultsStorage.js` (load/save/previous/clear). 748 → 717 строк.
    Сборка зелёная + smoke-тест util пройден (ручной QA не требуется).
- [x] Этап 0 (хвост) — удалён мёртвый серверный Groq-остров (~1045 строк):
  `lib/mayakGroq.js`, `api/mayak/groq-check.js`, `api/admin/groq-tokens/*`.
  Подтверждено: ни одной ссылки внутри репозитория; удаление согласовано с
  владельцем (эндпоинты наружу не используются). Оценка идёт только через Qwen.
- [ ] Этап 1
- [ ] Этап 2
- [ ] Этап 3
- [ ] Этап 4
- [ ] Этап 5
