import { useState } from "react";
import { STEPS, UPLOAD_SLOTS, uploadProgress } from "@/lib/rosdk-confrencia/slots";
import { DelegateForm } from "./DelegateForm";
import { ScanExamples } from "./ScanExamples";
import { VotesForm } from "./VotesForm";

const DOCUMENT_LABELS = {
  attendanceDocx: "Список присутствовавших",
  consentDocx: "Согласие делегата",
  protocolDocx: "Протокол собрания",
};

const FINAL_SLOTS = UPLOAD_SLOTS.filter((slot) => !STEPS.some((step) => step.scan === slot.slot));

/** Рабочая страница собрания: четыре блока по ходу заседания. */
export function SubmissionPackage({ submission: initial, pageUrl }) {
  const [submission, setSubmission] = useState(initial);
  const progress = uploadProgress(submission.files);

  const done = {
    registration: Boolean(submission.files.attendanceDocx),
    delegate: Boolean(submission.files.consentDocx),
    votes: Boolean(submission.files.protocolDocx),
  };

  return (
    <div className="space-y-5">
      <section className="glass-card rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-900">{submission.region}</h1>
            <p className="text-sm text-slate-500">
              Собрание {new Date(submission.meetingDate).toLocaleDateString("ru-RU")}, протокол №{" "}
              {submission.protocolNumber}, присутствует {submission.presentMembers} из{" "}
              {submission.totalMembers}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Сканов загружено
            </p>
            <p className="text-3xl font-extrabold text-slate-900">
              {progress.done}
              <span className="text-base font-semibold text-slate-400">/{progress.total}</span>
            </p>
          </div>
        </div>

        <StepStrip done={done} progress={progress} />

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-900">
            <strong>Сохраните ссылку на эту страницу.</strong> По ней вы вернётесь в любой момент —
            и во время собрания, и через несколько дней, когда будете догружать сканы.
          </p>
          <code className="mt-2 block select-all overflow-x-auto rounded border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700">
            {pageUrl}
          </code>
        </div>
      </section>

      <Block
        number={1}
        title="Регистрация"
        subtitle="Кто присутствует на собрании"
        done
        submission={submission}
        documentKey="attendanceDocx"
        scanSlot="attendanceScan"
        onChange={setSubmission}
      >
        <AttendeesSummary submission={submission} />
      </Block>

      <Block
        number={2}
        title="Делегат"
        subtitle="Второй вопрос повестки: кого избираем"
        done={done.delegate}
        submission={submission}
        documentKey="consentDocx"
        scanSlot="consentScan"
        onChange={setSubmission}
      >
        {done.delegate ? (
          <dl className="grid gap-1 text-sm text-slate-600">
            <Row label="Делегат" value={submission.delegateName} />
            <Row label="Контакты" value={`${submission.delegatePhone} · ${submission.delegateEmail}`} />
            <Row label="Паспорт" value={submission.passportData} />
            <Row label="Адрес" value={submission.delegateAddress} />
          </dl>
        ) : (
          <DelegateForm submission={submission} onSaved={setSubmission} />
        )}
      </Block>

      <Block
        number={3}
        title="Голосование"
        subtitle="Результаты по второму вопросу"
        done={done.votes}
        locked={!done.delegate}
        lockedHint="Откроется, когда заполните блок «Делегат»: в протокол печатаются его данные."
        submission={submission}
        documentKey="protocolDocx"
        scanSlot="protocolScan"
        onChange={setSubmission}
      >
        {done.votes ? (
          <p className="text-sm text-slate-600">
            «За» — {submission.votesFor}, «против» — {submission.votesAgainst}, «воздержались» —{" "}
            {submission.votesAbstain}. Делегат избран.
          </p>
        ) : (
          <VotesForm submission={submission} onSaved={setSubmission} />
        )}
      </Block>

      <Block
        number={4}
        title="Паспорт и фото"
        subtitle="Последние два файла пакета"
        done={FINAL_SLOTS.every((slot) => submission.files[slot.slot])}
        submission={submission}
        onChange={setSubmission}
      >
        <div className="space-y-4">
          <ScanExamples />
          <div className="grid gap-4 md:grid-cols-2">
            {FINAL_SLOTS.map((slot) => (
              <ScanUpload
                key={slot.slot}
                submission={submission}
                slot={slot.slot}
                label={slot.label}
                accept={slot.accept}
                onChange={setSubmission}
              />
            ))}
          </div>
        </div>
      </Block>

      {progress.isComplete ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          Пакет собран полностью. Оргкомитет видит его в реестре — больше от отделения ничего не
          требуется.
        </p>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
          Осталось загрузить: {progress.missing.map((item) => item.short).join(", ")}.
        </p>
      )}
    </div>
  );
}

function StepStrip({ done, progress }) {
  const items = [
    { title: "1. Регистрация", ready: done.registration },
    { title: "2. Делегат", ready: done.delegate },
    { title: "3. Голосование", ready: done.votes },
    { title: "4. Паспорт и фото", ready: progress.isComplete },
  ];

  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.title}
          className={`rounded-lg border px-3 py-2 text-xs font-bold ${
            item.ready
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-400"
          }`}
        >
          {item.ready ? "✓ " : ""}
          {item.title}
        </div>
      ))}
    </div>
  );
}

function Block({
  number,
  title,
  subtitle,
  done,
  locked = false,
  lockedHint,
  submission,
  documentKey,
  scanSlot,
  onChange,
  children,
}) {
  return (
    <section
      className={`glass-card rounded-2xl border bg-white p-6 sm:p-8 ${
        done ? "border-emerald-200" : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Блок {number}. {title}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            done
              ? "bg-emerald-50 text-emerald-700"
              : locked
                ? "bg-slate-100 text-slate-400"
                : "bg-indigo-50 text-indigo-700"
          }`}
        >
          {done ? "готово" : locked ? "ждёт" : "заполните"}
        </span>
      </div>

      <div className="pt-5">
        {locked ? <p className="text-sm text-slate-400">{lockedHint}</p> : children}
      </div>

      {documentKey && (
        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-700">
              1. Скачайте и подпишите
            </p>
            {done ? (
              <a
                className="file-link inline-flex h-10 px-4 text-xs font-bold border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white"
                style={{ whiteSpace: "nowrap" }}
                href={`/api/conferencia/submissions/${submission.id}/document?slot=${documentKey}`}
              >
                {DOCUMENT_LABELS[documentKey]} — DOCX
              </a>
            ) : (
              <span className="inline-flex h-10 items-center rounded-md border border-dashed border-slate-200 px-4 text-xs font-semibold text-slate-400">
                Откроется после заполнения
              </span>
            )}
          </div>

          <ScanUpload
            submission={submission}
            slot={scanSlot}
            label="2. Загрузите подписанный скан"
            accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
            disabled={!done}
            onChange={onChange}
          />
        </div>
      )}
    </section>
  );
}

function ScanUpload({ submission, slot, label, accept, disabled = false, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const uploaded = Boolean(submission.files[slot]);

  async function upload(file) {
    if (!file) return;

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
      <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <span
          aria-hidden="true"
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] text-white ${
            uploaded ? "bg-emerald-500" : "bg-slate-200"
          }`}
        >
          {uploaded ? "✓" : ""}
        </span>
        {label}
      </p>
      <input
        type="file"
        accept={accept}
        disabled={disabled || busy}
        onChange={(event) => upload(event.target.files?.[0])}
        className="block w-full cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {busy && <span className="mt-1 block text-xs text-slate-400">Загружаем…</span>}
      {uploaded && !busy && (
        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-emerald-700">
          Загружено.
          <a
            className="font-semibold text-indigo-600 hover:text-indigo-700"
            href={`/api/conferencia/submissions/${submission.id}/document?slot=${slot}`}
          >
            Скачать
          </a>
          <span className="text-slate-400">Новый файл заменит загруженный.</span>
        </span>
      )}
      {error && <span className="mt-1 block text-xs font-semibold text-rose-600">{error}</span>}
    </div>
  );
}

function AttendeesSummary({ submission }) {
  return (
    <div className="space-y-2 text-sm text-slate-600">
      <p>
        Председатель — {submission.chairName}, секретарь — {submission.secretaryName}.
      </p>
      <ol className="grid gap-1 sm:grid-cols-2">
        {submission.attendees.map((attendee, index) => (
          <li key={index} className="text-xs text-slate-500">
            {index + 1}. {attendee.fullName} — {attendee.contact}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex flex-wrap gap-2">
      <dt className="w-24 shrink-0 text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd className="flex-1">{value}</dd>
    </div>
  );
}
