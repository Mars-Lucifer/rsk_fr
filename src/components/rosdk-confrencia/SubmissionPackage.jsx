import { useState } from "react";
import {
  DELEGATE_SCAN_SLOTS,
  STEPS,
  UPLOAD_SLOTS,
  uploadProgress,
} from "@/lib/rosdk-confrencia/slots";
import { DelegateForm } from "./DelegateForm";
import { DocumentButton } from "./DocumentButton";
import { RegistrationForm } from "./RegistrationForm";
import { PhotoExample } from "./PhotoExample";
import { ScanUpload } from "./ScanUpload";
import { SuccessDialog } from "./SuccessDialog";
import { PencilIcon } from "./icons";
import { VotesForm } from "./VotesForm";

const DOCUMENT_TITLES = {
  attendanceDocx: "Список присутствовавших",
  consentDocx: "Согласие делегата",
  protocolDocx: "Протокол собрания",
};

/** Паспорт делегата — в его же блоке, рядом с данными, которые с паспорта и списаны. */
export const DELEGATE_SLOTS = UPLOAD_SLOTS.filter((slot) =>
  DELEGATE_SCAN_SLOTS.includes(slot.slot)
);

/** В последнем блоке остаётся то, что не привязано ни к бланку, ни к делегату: фото. */
export const FINAL_SLOTS = UPLOAD_SLOTS.filter(
  (slot) =>
    !STEPS.some((step) => step.scan === slot.slot) && !DELEGATE_SCAN_SLOTS.includes(slot.slot)
);

/**
 * Состояние блока: данные внесены (бланк собран) и подписанный скан загружен.
 * Зелёным блок становится только когда пришёл скан — до этого работа не закончена.
 */
export function blockState(submission) {
  const state = (documentKey, scanSlot) => ({
    filled: Boolean(submission.files[documentKey]),
    signed: Boolean(submission.files[scanSlot]),
  });

  // Протокол печатает данные делегата и живёт в его блоке — вместе с согласием
  // и паспортом. В блоке голосования печатать нечего: цифры уходят в протокол.
  const delegateScans = ["consentScan", "protocolScan", ...DELEGATE_SCAN_SLOTS];

  return {
    registration: state("attendanceDocx", "attendanceScan"),
    votes: {
      filled: Boolean(submission.files.protocolDocx),
      signed: Boolean(submission.files.protocolDocx),
    },
    delegate: {
      filled: Boolean(submission.files.consentDocx),
      signed: delegateScans.every((slot) => submission.files[slot]),
    },
    final: {
      filled: FINAL_SLOTS.some((slot) => submission.files[slot.slot]),
      signed: FINAL_SLOTS.every((slot) => submission.files[slot.slot]),
    },
  };
}

/** Данные блока внесены — бланк уже можно скачать. */
export function documentsDone(submission) {
  const state = blockState(submission);
  return Object.fromEntries(Object.entries(state).map(([key, value]) => [key, value.filled]));
}

/**
 * Рабочая часть собрания: показывает документ, выбранный переключателем.
 * Переключатель и сама заявка живут на странице — она одна на весь путь.
 */
export function SubmissionPackage({
  submission,
  onChange: setSubmission,
  active,
  tabs,
  qr,
  photoExample,
  delegatesLink,
  draftVotes,
  onDraftVotes,
}) {
  const progress = uploadProgress(submission.files);
  const done = documentsDone(submission);
  const state = blockState(submission);

  // Что сейчас правят: заполненный блок по умолчанию показан сводкой.
  const [editing, setEditing] = useState(null);
  const edit = (key) => () => setEditing(key);
  const closeEditing = (next) => {
    setEditing(null);
    setSubmission(next);
  };

  return (
    <div className="space-y-5">
      <SuccessDialog
        complete={progress.isComplete}
        delegateName={submission.delegateName}
        qr={qr}
        delegatesLink={delegatesLink}
      />

      <section className="glass-card rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-900">{submission.region}</h1>
            <p className="text-sm text-slate-500">
              Собрание {new Date(submission.meetingDate).toLocaleDateString("ru-RU")}, протокол №{" "}
              {submission.protocolNumber}, участников: {submission.presentMembers}
            </p>
          </div>
          {/* «0/6» большой цифрой читалось как ошибка — считаем словами и полосой. */}
          <div className="min-w-44 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Подписанные сканы
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {progress.done} из {progress.total} загружено
            </p>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-200">
              <span
                className={`block h-full rounded-full transition-all ${
                  progress.isComplete ? "bg-emerald-500" : "bg-indigo-500"
                }`}
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </span>
          </div>
        </div>

        {/* Переключатель приходит со страницы: он один и до создания заявки, и после.
            Ни адреса заявки, ни «начать заново» здесь нет: отделение подаёт один
            пакет и правит его на месте — карандашом в шапке блока. */}
        <div className="mt-5">{tabs}</div>
      </section>

      {active === "registration" && (
        <Block
          number={1}
          title="Регистрация"
          subtitle="Кто присутствует на собрании"
          done={state.registration.filled}
          signed={state.registration.signed}
          onEdit={edit("registration")}
          submission={submission}
          documents={[{ documentKey: "attendanceDocx", scanSlot: "attendanceScan" }]}
          onChange={setSubmission}
        >
          {/* Сохранённый блок остаётся тем же бланком, только неактивным: сводка
              выглядела как другой экран, и было непонятно, что данные приняты. */}
          <RegistrationForm
            submission={submission}
            readOnly={editing !== "registration"}
            onCreated={closeEditing}
            onCancel={() => setEditing(null)}
          />
        </Block>
      )}

      {active === "delegate" && (
        <Block
          number={3}
          title="Делегат"
          subtitle="Второй вопрос повестки: кого избираем"
          done={state.delegate.filled}
          signed={state.delegate.signed}
          onEdit={edit("delegate")}
          submission={submission}
          documents={[
            { documentKey: "consentDocx", scanSlot: "consentScan" },
            {
              documentKey: "protocolDocx",
              scanSlot: "protocolScan",
              waitingFor: "Соберётся, когда сохранены и делегат, и блок 2 «Голосование».",
            },
          ]}
          extraSlots={DELEGATE_SLOTS}
          onChange={setSubmission}
        >
          <DelegateForm
            submission={submission}
            readOnly={done.delegate && editing !== "delegate"}
            onSaved={closeEditing}
            onCancel={() => setEditing(null)}
          />
        </Block>
      )}

      {active === "votes" && (
        <Block
          number={2}
          title="Голосование"
          subtitle="Результаты по второму вопросу"
          done={state.votes.filled || Boolean(draftVotes)}
          signed={state.votes.signed}
          onEdit={edit("votes")}
          submission={submission}
          onChange={setSubmission}
        >
          <div className="space-y-3">
            <VotesForm
              submission={submission}
              readOnly={done.votes && editing !== "votes"}
              onSaved={closeEditing}
              onCancel={() => setEditing(null)}
              onDraft={onDraftVotes}
            />
            {draftVotes && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
                Голоса сохранены: «за» — {draftVotes.votesFor}, «против» — {draftVotes.votesAgainst}
                , «воздержались» — {draftVotes.votesAbstain}. Протокол соберётся вместе с блоком
                «Делегат» — его данные в него печатаются.
              </p>
            )}
          </div>
        </Block>
      )}

      {active === "final" && (
        <Block
          number={4}
          title="Фото собрания"
          subtitle="Последний файл пакета"
          done={state.final.filled}
          signed={state.final.signed}
          submission={submission}
          onChange={setSubmission}
        >
          <div className="space-y-4">
            <PhotoExample photo={photoExample} />
            {FINAL_SLOTS.map((slot) => (
              <ScanUpload
                key={slot.slot}
                submission={submission}
                slot={slot.slot}
                label={slot.label}
                hint={slot.hint}
                accept={slot.accept}
                onChange={setSubmission}
              />
            ))}
          </div>
        </Block>
      )}

      {/* Перечня недостающего внизу нет: то же самое видно по плашкам блоков,
          а о собранном пакете говорит окно с QR чата делегатов. */}
    </div>
  );
}

function Block({
  number,
  title,
  subtitle,
  done,
  signed = false,
  onEdit,
  waitingFor,
  submission,
  documents = [],
  extraSlots = [],
  onChange,
  children,
}) {
  const border = signed ? "border-emerald-200" : done ? "border-amber-200" : "border-slate-200";

  return (
    <section className={`glass-card rounded-2xl border bg-white p-6 sm:p-8 ${border}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Блок {number}. {title}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {onEdit && done && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-8 !w-auto items-center gap-1.5 rounded-lg border border-slate-200 !bg-white px-3 !text-xs !font-semibold !text-slate-600 hover:!bg-slate-50"
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Изменить
            </button>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              signed
                ? "bg-emerald-50 text-emerald-700"
                : done
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            {signed ? "готово" : done ? "нужен скан или фото" : "требует заполнения"}
          </span>
        </div>
      </div>

      <div className="pt-5">{children}</div>

      {(documents.length > 0 || extraSlots.length > 0) && (
        <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
          {/* Каждый документ — своя карточка с двумя шагами: скачать и загрузить.
              Одним списком блок читался как сплошная лента полей. */}
          {documents.map(({ documentKey, scanSlot, waitingFor: hint }) => {
            const ready = Boolean(submission.files[documentKey]);
            const signed = Boolean(submission.files[scanSlot]);

            return (
              <div
                key={documentKey}
                className={`rounded-2xl border p-4 ${
                  signed ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50/60"
                }`}
              >
                <p className="mb-3 text-sm font-bold text-slate-900">
                  {DOCUMENT_TITLES[documentKey]}
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <Step number={1} title="Скачайте и подпишите">
                    <DocumentButton
                      submission={submission}
                      documentKey={documentKey}
                      done={ready}
                      waitingFor={hint ?? waitingFor}
                    />
                  </Step>

                  <Step number={2} title="Загрузите подписанный: скан или фото">
                    <ScanUpload
                      submission={submission}
                      slot={scanSlot}
                      accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
                      disabled={!ready}
                      onChange={onChange}
                    />
                  </Step>
                </div>
              </div>
            );
          })}

          {/* Третья часть блока делегата: паспорт печатать не нужно, только снять. */}
          {extraSlots.length > 0 && (
            <div
              className={`rounded-2xl border p-4 ${
                extraSlots.every((slot) => submission.files[slot.slot])
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-slate-200 bg-slate-50/60"
              }`}
            >
              <p className="mb-3 text-sm font-bold text-slate-900">
                Паспорт делегата — два разворота
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {extraSlots.map((slot) => (
                  <ScanUpload
                    key={slot.slot}
                    submission={submission}
                    slot={slot.slot}
                    label={slot.label}
                    hint={slot.hint}
                    accept={slot.accept}
                    onChange={onChange}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Шаг внутри карточки документа: номер, подпись, содержимое. */
function Step({ number, title, children }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
          {number}
        </span>
        {title}
      </p>
      {children}
    </div>
  );
}
