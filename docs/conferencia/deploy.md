# Выкладка конференции на прод

Обновлено: 14.08.2026

Прод — обычный чекаут репозитория и systemd-юнит `nextjs.service`, без Docker.
Обновление идёт так: `git pull`, `npm run build`, рестарт службы.

**Главное:** `data/rsk.sqlite` и `data/uploads/` были отслеживаемыми в `main` и
стали удалёнными (коммит `421f1ff`). При первом же `git pull` git снесёт их из
рабочего каталога — вместе со всеми заявками, что там накопились. Один раз, при
переходе на новый `main`. Дальше они в `.gitignore` и git их не трогает.

Поэтому порядок ниже обязателен, и шаг 1 пропускать нельзя.

## 0. Посмотреть, есть ли что терять

```bash
cd ~/rsk_fr && ls -l data/rsk.sqlite && ls data/uploads 2>/dev/null | wc -l
```

Если базы нет или она 12 288 байт, а в `data/uploads` две папки — конференцией
на этом сервере ещё не пользовались, терять нечего. Если размер больше и папок
много — там живые заявки, шаг 1 критичен.

Сколько заявок, если стоит `sqlite3`:

```bash
sqlite3 data/rsk.sqlite "select count(*) from submissions;"
```

## 1. Бэкап

```bash
tar czf ~/conferencia-$(date +%F-%H%M).tar.gz data/rsk.sqlite* data/uploads/
```

Проверить, что архив непустой:

```bash
tar tzf ~/conferencia-*.tar.gz | head
```

База в WAL-режиме, поэтому `-shm` и `-wal` забираются вместе с ней — маской
`data/rsk.sqlite*`.

## 2. Увести боевые данные с дороги git

```bash
mv data/rsk.sqlite ~/keep-rsk.sqlite && mv data/uploads ~/keep-uploads
```

Вернуть на их место версии из индекса, чтобы `git pull` прошёл без отказа:

```bash
git checkout -- data/rsk.sqlite data/rsk.sqlite-shm data/rsk.sqlite-wal data/uploads
```

Пути перечислены поимённо намеренно. `git checkout -- data/` откатил бы заодно
и отслеживаемые файлы МАЯКа, которые на сервере могли меняться.

## 3. Обновление

```bash
git pull origin main
```

Зависимости с прошлой выкладки не менялись, `npm install` не нужен. Если
`package.json` всё же поедет — ставить придётся, `better-sqlite3` собирается
под конкретную машину.

Кэш сборки сносить обязательно, иначе Tailwind вернёт CSS с прошлого раза:

```bash
rm -rf .next/cache && npm run build
```

14.08.2026 выкладка без этого дала страницу без половины стилей: кэш лежал
с 19 июня, классы конференции в CSS не попали, портальные стили покрасили
кнопки чёрным, а строки явочного листа рассыпались в столбик. В dev то же
самое не воспроизводится — там классы держит HMR, поэтому баг виден только
на проде. Проверить, что CSS собрался с классами конференции:

```bash
grep -lF "28px_1" .next/static/css/*.css
```

Пусто — пересобирать заново, страницу в таком виде не отдавать.

## 4. Вернуть боевые данные

```bash
mv ~/keep-rsk.sqlite data/rsk.sqlite && mv ~/keep-uploads data/uploads
```

Файлы `-shm` и `-wal` не возвращаем: SQLite создаст их заново при открытии базы.

## 5. Переменные окружения

В `~/rsk_fr/.env.local` — Next читает его сам. Задать **до** старта:

| Переменная | Зачем | Если не задать |
|---|---|---|
| `ADMIN_PASSWORD` | вход в `/conferencia/admin` | берётся `MAYAK_ADMIN_PASSWORD`; за панелью паспортные данные и сканы паспортов всех делегатов, поэтому нужен свой длинный |
| `CONFERENCIA_SESSION_SECRET` | подпись сессионной куки админки | берётся пароль, и смена пароля рвёт живые сессии |
| `CONFERENCIA_LINK_SECRET` | соль персональных ссылок отделений | хранится в базе: пересоздал базу — все 89 ссылок стали другими |
| `CONFERENCIA_DATA_DIR` | другое место под базу и загрузки | `~/rsk_fr/data` |

```bash
openssl rand -hex 32
```

`CONFERENCIA_LINK_SECRET` задать **до первой рассылки**: после неё смена соли
разом обнуляет все выданные отделениям ссылки.

## 6. Перезапуск и проверка

```bash
systemctl restart nextjs.service && systemctl status nextjs.service --no-pager
```

Дальше глазами:

1. `/conferencia` открывается, в шапке дата Конференции и срок приёма.
2. `/conferencia/admin` спрашивает пароль и пускает. «Вход отключён» означает,
   что `ADMIN_PASSWORD` не доехал — Next читает `.env.local` при старте.
3. Заявки на месте: в панели видно число отделений, которые заполняют.
4. База на месте и не пустая:

```bash
ls -l ~/rsk_fr/data/rsk.sqlite
```

## 7. Бэкап по расписанию

Заявки существуют в одном экземпляре: собрания очные, повторно их не провести.
До рассылки ссылок поставить ежедневную копию в cron:

```bash
sqlite3 ~/rsk_fr/data/rsk.sqlite ".backup '/backup/rsk-$(date +\%F).sqlite'"
```

```bash
rsync -a ~/rsk_fr/data/uploads/ /backup/uploads/
```

`.backup` вместо `cp`: копия файла базы под нагрузкой даёт битый снимок.

## Перед выкладкой — локально

```bash
node scripts/check-conferencia-package.mjs
```

```bash
node scripts/check-conferencia-flow.mjs
```

```bash
npm run build
```
