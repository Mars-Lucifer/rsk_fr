// Кнопка бланка. Отдельным файлом, потому что нужна и в блоках готовой заявки,
// и в формах, которые эти блоки рендерят: общий модуль снимает круговой импорт.

import { DocIcon } from "./icons";

const DOCUMENT_LABELS = {
  attendanceDocx: "Список присутствовавших",
  consentDocx: "Согласие делегата",
  protocolDocx: "Протокол собрания",
};

/**
 * Видна всегда — отделение сразу понимает, что документ здесь будет, — но до
 * сохранения блока не нажимается. Сам файл не скачивается автоматически: браузер
 * такую загрузку блокирует, и было непонятно, произошло вообще что-нибудь или нет.
 */
export function DocumentButton({ submission, documentKey, done, waitingFor }) {
  const shape = "file-link inline-flex h-10 items-center gap-2 px-4 text-xs font-bold";
  const label = `${DOCUMENT_LABELS[documentKey]} — скачать DOCX`;

  if (!done || !submission) {
    return (
      <>
        <span
          aria-disabled="true"
          className={`${shape} cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400`}
        >
          <DocIcon className="h-4 w-4" />
          {label}
        </span>
        <p className="mt-1.5 text-xs text-slate-500">
          {waitingFor ?? "Сначала заполните и сохраните поля блока — тогда бланк соберётся."}
        </p>
      </>
    );
  }

  return (
    // download отменяет навигацию: без него браузер считал скачивание уходом со
    // страницы и спрашивал «Закрыть сайт? Изменения могут не сохраниться».
    <a
      download
      className={`${shape} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white`}
      href={`/api/conferencia/submissions/${submission.id}/document?slot=${documentKey}`}
    >
      <DocIcon className="h-4 w-4" />
      {label}
    </a>
  );
}
