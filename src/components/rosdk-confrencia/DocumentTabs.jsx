// Переключатель четырёх документов пакета. Один и тот же ряд работает и до создания
// заявки (тогда статусов нет — просто выбор, что посмотреть), и в рабочем режиме,
// где цвет показывает, собран документ или ещё нет. Порядок не навязывается.

import { CheckIcon, ClipboardIcon, DelegateIcon, PassportIcon, VoteIcon } from "./icons";

export const DOCUMENT_TABS = [
  {
    key: "registration",
    title: "Регистрация",
    text: "Кто пришёл. Отсюда список присутствовавших",
    Icon: ClipboardIcon,
  },
  {
    key: "votes",
    title: "Голосование",
    text: "«За», «против», «воздержались». Отсюда протокол",
    Icon: VoteIcon,
  },
  {
    key: "delegate",
    title: "Делегат",
    text: "Данные и паспорт делегата. Отсюда согласие",
    Icon: DelegateIcon,
  },
  {
    key: "final",
    title: "Фото собрания",
    text: "Общий план: видно всех участников",
    Icon: PassportIcon,
  },
];

/**
 * `state` — карта {filled, signed} по ключам; null, пока заявки нет.
 * Зелёным горит только полностью закрытый блок: данные внесены и скан загружен.
 */
export function DocumentTabs({ active, onSelect, state = null }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {DOCUMENT_TABS.map((tab, index) => {
        const block = state?.[tab.key];
        const ready = Boolean(block?.signed);
        const waitingScan = Boolean(block?.filled && !block?.signed);
        const current = active === tab.key;

        return (
          <li key={tab.key}>
            <button
              type="button"
              onClick={() => onSelect(tab.key)}
              aria-current={current ? "step" : undefined}
              // Портальный css красит любой button в чёрный и центрирует содержимое.
              className={`h-full w-full flex-col rounded-2xl border p-4 text-left !items-start !justify-start !gap-0 transition ${
                current
                  ? "border-indigo-600 !bg-indigo-50 ring-1 ring-indigo-600"
                  : ready
                    ? "border-emerald-200 !bg-emerald-50 hover:border-emerald-300"
                    : waitingScan
                      ? "border-amber-200 !bg-amber-50 hover:border-amber-300"
                      : "border-slate-200 !bg-white hover:border-slate-300"
              }`}
            >
              {/* Номер, название и иконка — на одной линии: так карточка читается сразу. */}
              <span className="flex w-full items-center gap-2.5">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                    ready ? "bg-emerald-500" : waitingScan ? "bg-amber-500" : "bg-indigo-600"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
                  {tab.title}
                </span>
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    ready
                      ? "bg-emerald-100 text-emerald-600"
                      : waitingScan
                        ? "bg-amber-100 text-amber-600"
                        : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  {ready ? <CheckIcon className="h-4 w-4" /> : <tab.Icon />}
                </span>
              </span>

              {/* Две строки ровно: разной высоты подписи двигали ряд при переключении. */}
              <span className="mt-2.5 line-clamp-2 block min-h-8 text-xs leading-relaxed text-slate-500">
                {tab.text}
              </span>

              {state && (
                <span
                  className={`mt-2 block text-[11px] font-bold ${
                    ready ? "text-emerald-600" : waitingScan ? "text-amber-600" : "text-slate-500"
                  }`}
                >
                  {ready ? "готово" : waitingScan ? "нужен скан или фото" : "требует заполнения"}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
