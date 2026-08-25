import { useMemo, useState } from "react";

/**
 * Рассылка персональных ссылок: одна строка — один субъект РФ. Ссылка готова
 * заранее и не меняется, сотруднику остаётся скопировать её, отправить ответственному
 * и отметить галочкой. Тут же контакты этого ответственного — чтобы было кому звонить,
 * когда пакет не собран.
 */

const STATUS = {
  complete: { text: "пакет собран", className: "bg-emerald-50 text-emerald-700" },
  started: { text: "заполняют", className: "bg-amber-50 text-amber-700" },
  idle: { text: "не начинали", className: "bg-slate-100 text-slate-500" },
};

/** Кнопки в панели: портальный css красит любой button чёрным, отсюда `!`. */
const BUTTON =
  "h-8 shrink-0 cursor-pointer rounded-md border !px-3 !text-xs !font-bold transition !w-auto";

// Ячейки-поля читались как текст: тонкая светлая рамка на белом не видна, и
// сотрудник не понимал, что «Ответственный» и «Телефон» можно печатать.
const cellInput =
  "h-8 w-full min-w-0 rounded-md border border-slate-300 !bg-white px-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-500 hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15";

export function RegionLinks({ links, query }) {
  const [rows, setRows] = useState(() =>
    Object.fromEntries(links.map((item) => [item.region, item]))
  );
  const [onlyPending, setOnlyPending] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  const sentCount = Object.values(rows).filter((item) => item.sentAt).length;
  const startedCount = links.filter((item) => item.started).length;
  const completeCount = links.filter((item) => item.complete).length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return links.filter((item) => {
      if (onlyPending && rows[item.region]?.sentAt) return false;
      return !needle || item.region.toLowerCase().includes(needle);
    });
  }, [links, query, onlyPending, rows]);

  async function save(region, patch) {
    setRows((current) => ({ ...current, [region]: { ...current[region], ...patch } }));
    setError("");

    try {
      const response = await fetch("/api/conferencia/admin/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, ...patch }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Не удалось сохранить.");
      }

      setRows((current) => ({ ...current, [region]: { ...current[region], ...result.link } }));
    } catch (problem) {
      setError(`${region}: ${problem.message} Изменение не сохранено.`);
    }
  }

  async function copyText(text, key) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Ссылок отправлено" value={`${sentCount} из ${links.length}`} />
        <Stat label="Отделений начали заполнять" value={startedCount} tone="text-indigo-600" />
        <Stat label="Пакетов собрано полностью" value={completeCount} tone="text-emerald-600" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(event) => setOnlyPending(event.target.checked)}
            className="h-4 w-4 cursor-pointer"
          />
          Показать только неотправленные
        </label>

        {/* Это выгрузки, а не страницы: <Link> подменил бы скачивание файла
            клиентским переходом, поэтому правило про next/link здесь не годится. */}
        <div className="flex flex-wrap gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/conferencia/admin/export"
            title="Одна таблица по всем отделениям: те же поля, что заполняют на странице"
            className={`${BUTTON} border-emerald-200 !bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100 inline-flex items-center`}
          >
            Все заявки XLSX
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/conferencia/admin/registry"
            title="Бланк Мандатной комиссии: одна строка на отделение"
            className={`${BUTTON} border-amber-200 !bg-amber-50 !text-amber-700 hover:!bg-amber-100 inline-flex items-center`}
          >
            Реестр делегатов DOCX
          </a>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-[36px_minmax(170px,1.1fr)_minmax(190px,1.3fr)_96px_minmax(140px,1fr)_120px_minmax(110px,0.9fr)_112px_minmax(150px,0.9fr)] gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 max-xl:hidden">
          <span>№</span>
          <span>Субъект РФ</span>
          <span>Персональная ссылка</span>
          <span>Отправлена</span>
          <span>Ответственный</span>
          <span>Телефон</span>
          <span>MAX</span>
          <span>Пакет</span>
          <span>Выгрузка</span>
        </div>

        <div className="divide-y divide-slate-100">
          {visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              Ничего не найдено — проверьте поиск по субъекту.
            </p>
          ) : (
            visible.map((item, index) => {
              const row = rows[item.region] ?? item;
              const status = item.complete ? "complete" : item.started ? "started" : "idle";

              return (
                <div key={item.region}>
                  <div className="grid items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-slate-50/60 xl:grid-cols-[36px_minmax(170px,1.1fr)_minmax(190px,1.3fr)_96px_minmax(140px,1fr)_120px_minmax(110px,0.9fr)_112px_minmax(150px,0.9fr)]">
                    <span className="text-xs font-bold text-slate-500 max-xl:hidden">
                      {index + 1}
                    </span>
                    <span className="font-bold text-slate-900">{item.region}</span>

                    <span className="flex min-w-0 items-center gap-2">
                      <input
                        readOnly
                        value={item.url}
                        onFocus={(event) => event.target.select()}
                        className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => copyText(item.url, item.region)}
                        className={`${BUTTON} ${
                          copied === item.region
                            ? "border-emerald-300 !bg-emerald-50 !text-emerald-700"
                            : "border-indigo-200 !bg-indigo-50 !text-indigo-700 hover:!bg-indigo-100"
                        }`}
                      >
                        {copied === item.region ? "Готово" : "Копировать"}
                      </button>
                    </span>

                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(row.sentAt)}
                        onChange={(event) => save(item.region, { sent: event.target.checked })}
                        className="h-4 w-4 shrink-0 cursor-pointer"
                      />
                      <span
                        className={`text-[11px] font-semibold ${
                          row.sentAt ? "text-emerald-700" : "text-slate-500"
                        }`}
                      >
                        {row.sentAt
                          ? new Date(row.sentAt).toLocaleDateString("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                            })
                          : "нет"}
                      </span>
                    </label>

                    <SavedInput
                      value={row.responsibleName}
                      placeholder="Ф.И.О."
                      onSave={(value) => save(item.region, { responsibleName: value })}
                    />
                    <SavedInput
                      value={row.responsiblePhone}
                      placeholder="+7 …"
                      onSave={(value) => save(item.region, { responsiblePhone: value })}
                    />
                    <SavedInput
                      value={row.responsibleMax}
                      placeholder="ссылка на MAX"
                      onSave={(value) => save(item.region, { responsibleMax: value })}
                    />

                    <span className="min-w-0">
                      <span
                        className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS[status].className}`}
                      >
                        {STATUS[status].text}
                      </span>
                      {item.submission && (
                        <span className="mt-1 block text-[11px] font-semibold text-slate-500">
                          {item.scansDone} из {item.scansTotal} сканов
                        </span>
                      )}
                    </span>

                    {/* Пакет отделения тут же: раньше за ним ходили в соседнюю вкладку. */}
                    <span className="flex flex-wrap items-center gap-1.5">
                      {item.submission ? (
                        <a
                          href={`/api/conferencia/admin/submissions/${item.submission.id}/archive`}
                          title="ZIP: таблица заявки, бланки и все загруженные файлы"
                          className={`${BUTTON} border-indigo-200 !bg-indigo-50 !text-indigo-700 hover:!bg-indigo-100 inline-flex items-center`}
                        >
                          Скачать ZIP
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500">пакета нет</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/** Поле, которое сохраняется по уходу фокуса: печатать в базу на каждый символ незачем. */
function SavedInput({ value, placeholder, onSave }) {
  const [draft, setDraft] = useState(value ?? "");
  // Прошлое значение держим в состоянии, а не в ref: сравнение идёт при рендере,
  // а ref во время рендера трогать нельзя. Значение пришло с сервера и поле не
  // правят — подхватываем. В эффекте это давало лишний проход по всем 89 строкам.
  const [lastSaved, setLastSaved] = useState(value ?? "");

  if ((value ?? "") !== lastSaved) {
    setLastSaved(value ?? "");
    setDraft(value ?? "");
  }

  const commit = () => {
    if (draft === lastSaved) return;
    setLastSaved(draft);
    onSave(draft);
  };

  return (
    <input
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
      className={cellInput}
    />
  );
}

function Stat({ label, value, tone = "text-slate-950" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}
