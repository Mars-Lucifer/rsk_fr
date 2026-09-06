/**
 * Бланки пакета: четыре документа, каждый — встроенный либо заменённый свой.
 * Порядок работы (скачать образец, поправить в Word, загрузить) виден по самим
 * кнопкам, поэтому текстом он здесь не повторяется.
 */

const BUTTON = "h-9 cursor-pointer rounded-lg border !px-4 !text-xs !font-bold transition !w-auto";

export function AdminTemplates({ templates, query = "" }) {
  // Счётчиков бланков нет намеренно: их четыре, и «свой/встроенный» видно в строке.
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? templates.filter((item) => item.label.toLowerCase().includes(needle))
    : templates;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-[44px_minmax(220px,1.2fr)_150px_minmax(200px,1fr)_minmax(320px,1.2fr)] gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 max-xl:hidden">
          <span>№</span>
          <span>Документ</span>
          <span>Бланк</span>
          <span>Файл</span>
          <span>Действия</span>
        </div>

        <div className="divide-y divide-slate-100">
          {visible.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              Бланк не найден — проверьте поиск.
            </p>
          )}
          {visible.map((template, index) => (
            <div
              key={template.key}
              className="grid items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-50/60 xl:grid-cols-[44px_minmax(220px,1.2fr)_150px_minmax(200px,1fr)_minmax(320px,1.2fr)]"
            >
              <span className="text-xs font-bold text-slate-500 max-xl:hidden">{index + 1}</span>
              <span className="font-bold text-slate-900">{template.label}</span>

              <span
                className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  template.custom ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {template.custom ? "свой" : "встроенный"}
              </span>

              <span className="min-w-0 text-xs text-slate-500">
                {template.custom ? (
                  <>
                    <span className="block truncate text-slate-700">{template.originalName}</span>
                    <span className="block text-slate-500">
                      загружен {new Date(template.uploadedAt).toLocaleDateString("ru-RU")}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </span>

              <span className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/conferencia/admin/templates/${template.key}?mode=sample`}
                  className={`${BUTTON} border-slate-200 !bg-white !text-slate-600 hover:!bg-slate-50 inline-flex items-center`}
                >
                  Скачать образец
                </a>
                {template.custom && (
                  <a
                    href={`/api/conferencia/admin/templates/${template.key}`}
                    className={`${BUTTON} border-indigo-200 !bg-indigo-50 !text-indigo-700 hover:!bg-indigo-100 inline-flex items-center`}
                  >
                    Текущий бланк
                  </a>
                )}

                <form
                  action="/api/conferencia/admin/templates"
                  method="post"
                  encType="multipart/form-data"
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="key" value={template.key} />
                  <input
                    type="file"
                    name="template"
                    accept=".docx"
                    required
                    className="w-40 cursor-pointer text-[11px] text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1.5 file:text-[11px] file:font-bold file:text-slate-700 hover:file:bg-slate-200"
                  />
                  <button
                    type="submit"
                    className={`${BUTTON} border-emerald-200 !bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100`}
                  >
                    Заменить
                  </button>
                </form>

                {template.custom && (
                  <form
                    action="/api/conferencia/admin/templates"
                    method="post"
                    encType="multipart/form-data"
                  >
                    <input type="hidden" name="key" value={template.key} />
                    <input type="hidden" name="action" value="reset" />
                    <button
                      type="submit"
                      className={`${BUTTON} border-slate-200 !bg-white !text-slate-500 hover:!bg-slate-50`}
                    >
                      Вернуть встроенный
                    </button>
                  </form>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
