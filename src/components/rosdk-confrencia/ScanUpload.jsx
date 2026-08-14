import { useState } from "react";

/**
 * Поле загрузки одного скана. Заявки может ещё не быть — тогда файл держим
 * в черновике на странице и отправим, как только заявка появится.
 */
export function ScanUpload({
  submission,
  draftFile,
  slot,
  label,
  hint,
  accept,
  disabled = false,
  onChange,
  onDraft,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const uploaded = Boolean(submission?.files[slot]);

  async function upload(file) {
    if (!file) return;

    if (!submission) {
      onDraft(slot, file);
      return;
    }

    setBusy(true);
    setError("");

    try {
      const payload = new FormData();
      payload.append(slot, file);

      const response = await fetch(`/api/conferencia/submissions/${submission.id}/upload`, {
        method: "POST",
        body: payload,
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не удалось загрузить файл.");
        return;
      }

      onChange(result.submission);
    } catch {
      setError("Не удалось загрузить файл. Проверьте подключение.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Без подписи поле идёт внутри шага карточки — заголовок там уже есть. */}
      {label && (
        <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span
            aria-hidden="true"
            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] text-white ${
              uploaded || draftFile ? "bg-emerald-500" : "bg-slate-200"
            }`}
          >
            {uploaded || draftFile ? "✓" : ""}
          </span>
          {label}
        </p>
      )}
      {hint && <p className="mb-1.5 text-xs leading-relaxed text-slate-500">{hint}</p>}
      {/* Файл можно и перетащить: на собрании скан приходит прямо из папки со сканера. */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled && !busy) upload(event.dataTransfer.files?.[0]);
        }}
        className={`rounded-lg border border-dashed px-3 py-3 transition ${
          dragging ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50/60"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <input
          type="file"
          accept={accept}
          disabled={disabled || busy}
          onChange={(event) => upload(event.target.files?.[0])}
          className="block w-full cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p className="mt-2 text-[11px] text-slate-500">
          {disabled
            ? "Станет доступно, когда блок заполнен и сохранён: подписывать нечего, пока бланка нет."
            : "Или перетащите файл сюда. Скан или фото с телефона: PDF, JPG, PNG, до 25 МБ."}
        </p>
      </div>
      {/* Строки «Загружено · Скачать · Новый файл заменит загруженный» нет:
          о загруженном говорит зелёная карточка и галочка у названия. */}
      {busy && <span className="mt-1 block text-xs text-slate-500">Загружаем…</span>}
      {!submission && draftFile && (
        <span className="mt-1 block text-xs text-emerald-700">
          {draftFile.name} — отправится вместе с регистрацией.
        </span>
      )}
      {error && <span className="mt-1 block text-xs font-semibold text-rose-600">{error}</span>}
    </div>
  );
}
