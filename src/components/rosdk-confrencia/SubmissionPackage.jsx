import { useState } from "react";
import {
  GENERATED_SLOTS,
  UPLOAD_SLOTS,
  uploadProgress,
} from "@/lib/rosdk-confrencia/slots";
import { ScanExamples } from "./ScanExamples";

const fileInputClass =
  "block w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 transition cursor-pointer";

export function SubmissionPackage({ submission: initial, pageUrl }) {
  const [submission, setSubmission] = useState(initial);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const progress = uploadProgress(submission.files);

  async function onUpload(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    // Ссылку на форму держим отдельно: после await у события currentTarget
    // уже null, и form.reset() уронил бы обработчик в catch.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const chosen = [...form.entries()].filter(([, value]) => value?.size > 0);

    if (chosen.length === 0) {
      setError("Выберите хотя бы один файл.");
      setBusy(false);
      return;
    }

    try {
      const payload = new FormData();
      for (const [name, value] of chosen) {
        payload.append(name, value);
      }

      const response = await fetch(`/api/conferencia/submissions/${submission.id}/upload`, {
        method: "POST",
        body: payload,
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не удалось загрузить файлы.");
        return;
      }

      setSubmission(result.submission);
      formElement.reset();
      setSuccess(
        `Загружено файлов: ${chosen.length}. ` +
          (uploadProgress(result.submission.files).isComplete
            ? "Пакет собран полностью — Оргкомитет видит его в реестре."
            : "Остальные документы можно догрузить позже по этой же ссылке."),
      );
    } catch {
      setError("Не удалось загрузить файлы. Проверьте подключение и попробуйте еще раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Статус пакета */}
      <section className="glass-card rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-900">{submission.region}</h1>
            <p className="text-sm text-slate-500">
              Протокол № {submission.protocolNumber} от{" "}
              {new Date(submission.meetingDate).toLocaleDateString("ru-RU")}, делегат —{" "}
              {submission.delegateName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Загружено документов
            </p>
            <p className="text-3xl font-extrabold text-slate-900">
              {progress.done}
              <span className="text-base font-semibold text-slate-400">/{progress.total}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              progress.isComplete ? "bg-emerald-500" : "bg-indigo-500"
            }`}
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-900">
            <strong>Сохраните ссылку на эту страницу.</strong> По ней вы вернётесь в любой день и
            догрузите оставшиеся документы — заполнять форму заново не придётся. Отправьте её себе в
            мессенджер или добавьте в закладки.
          </p>
          <code className="mt-2 block overflow-x-auto rounded border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700 select-all">
            {pageUrl}
          </code>
        </div>
      </section>

      {/* Чек-лист */}
      <section className="glass-card rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5">
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Шаг 1. Распечатайте бланки и подпишите
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Данные собрания уже подставлены. Протокол и список присутствовавших подписывают
              председатель и секретарь, участники ставят подписи в списке, согласие подписывает
              делегат.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {GENERATED_SLOTS.map((item) => (
              <a
                key={item.slot}
                href={`/api/conferencia/submissions/${submission.id}/document?slot=${item.slot}`}
                className="file-link h-10 px-3 text-xs border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700"
              >
                {item.short} — DOCX
              </a>
            ))}
          </div>
          <a
            href={`/api/conferencia/submissions/${submission.id}/document`}
            className="file-link inline-flex h-10 px-4 text-xs border-indigo-600 bg-indigo-600 font-bold text-white hover:bg-indigo-700 hover:text-white"
          >
            Скачать все три бланка одним архивом
          </a>
        </div>

        <form onSubmit={onUpload} className="space-y-4 border-t border-slate-100 pt-5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Шаг 2. Загрузите сканы или фото
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Можно по одному файлу и в разные дни — прогресс сохраняется. Подойдёт PDF или снимок с
              телефона, до 25 МБ на файл.
            </p>
          </div>

          <ScanExamples />

          <div className="grid gap-4 md:grid-cols-2">
            {UPLOAD_SLOTS.map((item) => {
              const uploaded = Boolean(submission.files[item.slot]);

              return (
                <label key={item.slot} className="block">
                  <span className="mb-1.5 flex items-start gap-2 text-sm font-semibold text-slate-700">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                        uploaded ? "bg-emerald-500" : "bg-slate-200"
                      }`}
                    >
                      {uploaded && (
                        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none">
                          <path
                            d="M3.5 8.5l3 3 6-7"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-white"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="sr-only">
                      {uploaded ? "Загружено:" : "Ещё не загружено:"}
                    </span>
                    <span>{item.label}</span>
                  </span>
                  <input name={item.slot} type="file" accept={item.accept} className={fileInputClass} />
                  {uploaded && (
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-emerald-700">
                      Загружено.
                      <a
                        className="font-semibold text-indigo-600 hover:text-indigo-700"
                        href={`/api/conferencia/submissions/${submission.id}/document?slot=${item.slot}`}
                      >
                        Скачать
                      </a>
                      <span className="text-slate-400">
                        Новый файл заменит загруженный.
                      </span>
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              {progress.isComplete
                ? "Все документы на месте."
                : `Осталось: ${progress.missing.map((item) => item.short).join(", ")}.`}
            </p>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary inline-flex h-11 items-center justify-center rounded-lg px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {busy ? "Загрузка..." : "Загрузить выбранные файлы"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
