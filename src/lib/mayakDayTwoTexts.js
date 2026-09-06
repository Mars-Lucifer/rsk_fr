// День 2: тексты, которые день отдаёт наружу — промпт сборщику стола (H4f) и
// публичная страница итогов (H4g). Чистые функции без fs: данные берутся из
// записи дня и снимка результатов day.results. Раскладка страниц повторяет
// day2-tools/export_day2.py (itogi.html и stolN.html).

import { DAY_TWO_KIND_NAMES, trackDates } from "@/lib/mayakDayTwoModel";

const KIND_ORDER = ["point0", "detail", "node", "assembly", "acceptance", "roadmap", "pitch", "intro"];
const ACCEPTED = new Set(["approved", "expired"]);
const POINT0_PLACEHOLDER = "[вставить три строки точки 0]";

function str(value) {
    return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

export function esc(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function nl2br(value) {
    return esc(value).replace(/\n/g, "<br>");
}

export function formatDayDate(date) {
    const [year, month, day] = str(date).split("-");
    return day && month && year ? `${day}.${month}.${year}` : str(date);
}

function withSlash(url) {
    const value = str(url);
    return value && !value.endsWith("/") ? `${value}/` : value;
}

function tableOf(day, tableN) {
    return (Array.isArray(day?.tables) ? day.tables : []).find((table) => Number(table.n) === Number(tableN)) || null;
}

function snapshotTable(day, tableN) {
    return (day?.results?.tables || []).find((table) => Number(table.table) === Number(tableN)) || null;
}

// Папка стола: tables[].url, иначе папка столов + N/.
export function tableFolderUrl(day, tableN) {
    const table = tableOf(day, tableN);
    if (str(table?.url)) return str(table.url);
    const folder = withSlash(day?.folder_url);
    return folder ? `${folder}${tableN}/` : "";
}

// Точка 0 стола: правка админа в заметках дня, иначе последний снимок, иначе плейсхолдер.
export function tablePoint0(day, tableN) {
    const note = str(day?.notes?.[String(tableN)]?.point0);
    if (note) return note;
    return str(snapshotTable(day, tableN)?.point0?.text);
}

// Дорожная карта стола: правка админа, иначе снимок.
export function tableRoadmap(day, tableN) {
    const note = str(day?.notes?.[String(tableN)]?.roadmap);
    if (note) return note;
    return str(snapshotTable(day, tableN)?.roadmap?.text);
}

// Семь шагов приёмки и заготовка дорожной карты, собранные нейросетью (H7) —
// лежат в заметках стола day.notes[N].acceptance_steps / roadmap_rows.
export function tableAcceptanceSteps(day, tableN) {
    const steps = day?.notes?.[String(tableN)]?.acceptance_steps;
    return Array.isArray(steps) ? steps.map(str).filter(Boolean) : [];
}

export function tableRoadmapRows(day, tableN) {
    const rows = day?.notes?.[String(tableN)]?.roadmap_rows;
    return Array.isArray(rows) ? rows.filter((row) => row && typeof row === "object").map((row) => ({ track: str(row.track), what: str(row.what), who: str(row.who), check: str(row.check) })) : [];
}

function acceptanceStepsHtml(steps) {
    return `<h2>Семь шагов приёмки</h2><ol>${steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>`;
}

function roadmapRowsHtml(rows) {
    const body = rows.map((row) => `<tr><td>${esc(row.track)}</td><td>${esc(row.what)}</td><td>${esc(row.who)}</td><td>${esc(row.check)}</td></tr>`).join("");
    return `<h2>Дорожная карта — заготовка «что проверить»</h2><table class="tbl"><tr><th>Трек</th><th>Что сделано</th><th>Кто</th><th>Как проверим</th></tr>${body}</table>`;
}

// Промпт сборщику стола — шаблон portal/1109/agent.html (text(n)) с подстановками
// дня. Пользователя, папку и пароль сервера в текст не вставляем: их говорит ведущий.
export function buildAssemblerPrompt(day, tableN) {
    const n = Number(tableN) || 1;
    const table = tableOf(day, n);
    const org = str(day?.org) || "[организация]";
    const date = formatDayDate(day?.date) || "[дата]";
    const product = str(table?.product) || "[продукт стола]";
    const url = tableFolderUrl(day, n) || "[адрес продукта скажет ведущий]";
    const folder = withSlash(day?.folder_url) || "[папка столов]";
    const point0 = tablePoint0(day, n) || POINT0_PLACEHOLDER;

    return `Ты собираешь изделие стола ${n} стратегической сессии «${org}» ${date} (день 2). Работай в текущей пустой папке. Ничего не переписывай заново — соединяй три готовых узла, приложенных файлами.

ПРОДУКТ СТОЛА: ${product}

ТОЧКА 0 СТОЛА (кому · боль · что изменится через полгода):
${point0}

ТРИ УЗЛА (приложены файлами):
- Узел 1 · 11+12 «Как пользуются»: путь пользователя от входа до результата.
- Узел 2 · 13+14 «Как считает»: таблица данных и три автоматических шага.
- Узел 3 · 15+16 «Как выглядит и кому видно»: три экрана и таблица доступов.

ЧТО СОБРАТЬ
1. index.html в корне: первый экран отвечает на три строки точки 0; три экрана из узла 3; путь пользователя из узла 1 проходится кликами до результата.
2. api/app.py — один сервер на 127.0.0.1:<порт> (порт скажет ведущий; Python, стандартная библиотека, SQLite): таблица из узла 2, три автоматических шага из узла 2, четыре числа на экране организатора. Снаружи запросы приходят как ${url}api/... и nginx срезает префикс — обрабатывай пути и с /api/, и без.
3. Доступы по таблице узла 3: посторонний видит меньше всех. Данные только тестовые.

ДОСТУП К СЕРВЕРУ
Хост, пользователя, папку и пароль скажет ведущий — попроси его, в текст не вставляй. Заливка всей папки по scp и запуск api/app.py через nohup — команды ведущий даст вместе с доступом.
Адрес продукта: ${url} — статика из корня папки, /api/ уходит на порт сервера. Папка raboty/ видна в браузере.
Папка столов: ${folder}

ПРИЁМКА — семь шагов подряд, посторонний с чужого телефона, стол молчит: ${folder}priemka.html
Прогони все семь локально, покажи, где споткнулся, почини, повтори с шага 1.

В КОНЦЕ напиши: адрес продукта, что пришлось изменить в узлах при соединении, что осталось делать руками.`;
}

// ---------- Публичная страница итогов ----------

const CSS = `<style>body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:20px;background:#f4f5f7;color:#111;max-width:980px}h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:22px 0 8px}.lead{color:#334155;margin:0 0 14px}
.rv{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 14px;margin:8px 0}.rv .h{font-size:13px;color:#475569}.rv .t{margin-top:6px;font-size:15px}.rv.approved,.rv.expired{border-left:5px solid #7AB929}.rv.pending{border-left:5px solid #f2c777}.rv.rejected{border-left:5px solid #D9412B}
.muted{color:#94a3b8}.f{font-size:13px;margin-top:6px}.tbl{width:100%;border-collapse:collapse;background:#fff}.tbl td,.tbl th{border:1px solid #e5e7eb;padding:8px;font-size:14px;text-align:left;vertical-align:top}
.nav a{margin-right:12px}.tbl .trk{width:46px;text-align:center;background:#fafafa;font-size:12px;color:#64748b}.tbl .trk b{font-size:16px;color:#111}.tbl .trk small{display:block;font-size:10px}.p0{background:#fff7e6;border:1px solid #f2c777;border-radius:12px;padding:10px 14px;margin:8px 0}</style>`;

const STATUS_LABELS = { pending: "на проверке", approved: "принято", expired: "истекло — принято", rejected: "на доработку" };

function statusLabel(status) {
    return STATUS_LABELS[status] || status || "";
}

function page(title, body) {
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${CSS}</head><body>${body}</body></html>`;
}

function fileLink(item) {
    if (!item?.file?.url) return "";
    return `<div class="f">Файл: <a href="${esc(item.file.url)}">${esc(item.file.name || "файл")}</a></div>`;
}

function reviewBlock(item) {
    const when = String(item.resolvedAt || item.createdAt || "").slice(0, 16).replace("T", " ");
    const text = item.text ? nl2br(item.text) : '<span class="muted">без текста</span>';
    return `<div class="rv ${esc(item.status)}"><div class="h"><b>${esc(item.kindName || DAY_TWO_KIND_NAMES[item.kind] || item.kind)}</b> · карточка ${esc(item.taskNumber)} · ${esc(item.participantName)} · ${esc(when)} · <i>${esc(statusLabel(item.status))}</i></div><div class="t">${text}</div>${fileLink(item)}</div>`;
}

function cell(item, override = "") {
    const text = str(override) || str(item?.text);
    if (!item && !text) return '<span class="muted">нет</span>';
    const file = item?.file?.url ? ` <a href="${esc(item.file.url)}">файл</a>` : "";
    const status = item ? ` <i class="muted">(${esc(statusLabel(item.status))})</i>` : "";
    return `${nl2br(text)}${file}${status}`;
}

function headerLine(day) {
    const results = day.results;
    const at = String(results.at || "").slice(0, 16).replace("T", " ");
    const participants = Array.isArray(results.participants) ? results.participants.length : Number(results.participants) || 0;
    return `Снимок ${esc(at)} · участников ${participants} · заявок ${Number(results.reviews) || 0}, принято ${Number(results.accepted) || 0}. Данные скопированы из платформы: там они удаляются при завершении сессии и через 48 часов.`;
}

// Страница итогов: таблица столов (точка 0 · изделие · приёмка · дорожная карта ·
// шесть клеток треков) и пояснение к трекингу. tableHref(n) — адрес страницы стола.
export function renderItogiHtml(day, { tableHref } = {}) {
    const results = day?.results;
    if (!results) throw new Error("Снимок не сделан");
    const dates = trackDates(day.date);
    const tables = Array.isArray(results.tables) ? results.tables : [];
    const title = `${str(day.org) || "День 2"} · ${formatDayDate(day.date)}`;

    const rows = tables
        .map((table) => {
            const n = table.table;
            const brief = tableOf(day, n);
            const href = typeof tableHref === "function" ? tableHref(n) : "";
            const name = href ? `<a href="${esc(href)}">Стол ${n}</a>` : `Стол ${n}`;
            const product = str(brief?.product) ? `<div class="muted">${esc(brief.product)}</div>` : "";
            const url = str(brief?.url) ? `<div class="f"><a href="${esc(brief.url)}">${esc(brief.url)}</a></div>` : "";
            const tracks = dates
                .map((track, i) => {
                    const mark = str(day.tracks?.[String(n)]?.[i]);
                    return `<td class="trk"><b>${esc(mark)}</b><small>${esc(track.short)}</small></td>`;
                })
                .join("");
            return `<tr><td>${name}${product}</td><td>${cell(table.point0, tablePoint0(day, n))}</td><td>${cell(table.assembly)}${url}</td><td>${cell(table.acceptance)}</td><td>${cell(table.roadmap, tableRoadmap(day, n))}</td>${tracks}</tr>`;
        })
        .join("");

    const trackHeads = dates.map((track) => `<th class="trk">${esc(track.label)}</th>`).join("");
    const summary = `<h1>${esc(title)} · итоги дня 2</h1><p class="lead">${headerLine(day)}</p>`;
    const table = `<table class="tbl"><tr><th>Стол</th><th>Точка 0</th><th>Изделие (адрес)</th><th>Приёмка</th><th>Дорожная карта на 6 месяцев</th>${trackHeads}</tr>${rows}</table>`;
    const tracking = `<h2>Трекинг после сессии</h2><p class="lead">Треки: 2 недели · 4 недели · 7 недель · 3 месяца · 5 месяцев · 6 месяцев — даты от даты дня. На каждом треке ведущий сравнивает строку дорожной карты с фактом и ставит отметку в клетку трека (✓ сделано · ~ частично · × нет); отметки на этой странице — из трекера дня.</p>`;
    return page(`Итоги дня 2 · ${title}`, `${summary}${table}${tracking}`);
}

// Страница стола: участники, точка 0, все заявки по видам с текстами и ссылками
// на файлы платформы (как в снимке). backHref — адрес страницы итогов.
export function renderTableHtml(day, tableN, { backHref } = {}) {
    const results = day?.results;
    if (!results) throw new Error("Снимок не сделан");
    const table = snapshotTable(day, tableN);
    if (!table) return null;
    const n = table.table;
    const brief = tableOf(day, n);
    const title = `${str(day.org) || "День 2"} · ${formatDayDate(day.date)}`;
    const members = (table.members || []).map((m) => `${str(m.name)}${str(m.role) ? ` (${str(m.role)})` : ""}`).filter(Boolean).join(" · ") || "нет";
    const all = (Array.isArray(table.all) ? table.all : []).slice().sort((a, b) => {
        const ka = KIND_ORDER.indexOf(a.kind);
        const kb = KIND_ORDER.indexOf(b.kind);
        return (ka === -1 ? 99 : ka) - (kb === -1 ? 99 : kb) || String(a.taskNumber).localeCompare(String(b.taskNumber)) || String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });

    const body = [`<h1>Стол ${n} · ${esc(title)}</h1>`];
    body.push(`<p class="lead">${str(brief?.product) ? `Продукт: ${esc(brief.product)} · ` : ""}участники: ${esc(members)}</p>`);
    if (backHref) body.push(`<div class="nav"><a href="${esc(backHref)}">← Все столы и дорожные карты</a></div>`);
    const point0 = tablePoint0(day, n);
    if (point0) body.push(`<div class="p0"><b>Точка 0</b><br>${nl2br(point0)}</div>`);
    const steps = tableAcceptanceSteps(day, n);
    if (steps.length) body.push(acceptanceStepsHtml(steps));
    // Заготовка карты (H7) — под заявками «Дорожная карта»; если их нет — в конце.
    const rows = tableRoadmapRows(day, n);
    let rowsHtml = rows.length ? roadmapRowsHtml(rows) : "";
    const flushRows = () => {
        if (rowsHtml) body.push(rowsHtml);
        rowsHtml = "";
    };
    let current = null;
    all.forEach((item) => {
        if (item.kind !== current) {
            if (current === "roadmap") flushRows();
            body.push(`<h2>${esc(DAY_TWO_KIND_NAMES[item.kind] || item.kind)}</h2>`);
            current = item.kind;
        }
        body.push(reviewBlock(item));
    });
    if (!all.length) body.push('<p class="muted">Заявок нет.</p>');
    flushRows();
    const accepted = all.filter((item) => ACCEPTED.has(item.status)).length;
    body.push(`<p class="lead">Заявок ${all.length}, принято ${accepted}.</p>`);
    return page(`Стол ${n} · итоги`, body.join(""));
}
