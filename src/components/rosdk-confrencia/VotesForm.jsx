import { useState } from "react";
import { CONFERENCE_DATE } from "@/lib/rosdk-confrencia/slots";
import { requiredVotesFor } from "@/lib/rosdk-confrencia/validation";
import { Combobox } from "./Combobox";
import { inputClassWithError, labelClass } from "./formFields";

/**
 * Блок 3 собрания: как проголосовали. Из него собирается протокол.
 * Пока заявки нет, число присутствующих неизвестно — проверяем только на сервере,
 * когда голоса уйдут вместе с регистрацией.
 */
export function VotesForm({ submission, readOnly = false, onSaved, onCancel, onDraft }) {
  const present = submission?.presentMembers ?? null;
  // Протокол печатает данные делегата: пока их нет, голоса сервер не примет —
  // держим их черновиком на странице и дошлём, когда делегат появится.
  const canSend = Boolean(submission?.delegateName);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Сохранённые голоса возвращаются в поля: блок остаётся тем же бланком.
  const stored = Boolean(submission?.files?.protocolDocx);
  const [votesFor, setVotesFor] = useState(stored ? submission.votesFor : (present ?? ""));
  const [votesAgainst, setVotesAgainst] = useState(stored ? submission.votesAgainst : 0);
  const [votesAbstain, setVotesAbstain] = useState(stored ? submission.votesAbstain : 0);

  const minimum = present === null ? null : requiredVotesFor(present);
  const total = (votesFor || 0) + (votesAgainst || 0) + (votesAbstain || 0);
  const sumWrong = present !== null && total !== present;
  const notElected = present !== null && !sumWrong && (votesFor || 0) < minimum;

  // Голосов не может быть больше, чем пришло людей: список ограничен явкой.
  // Пока регистрации нет, потолок неизвестен — даём разумный запас.
  const choices = Array.from({ length: (present ?? 30) + 1 }, (_, index) => String(index));

  const pick = (setter) => (raw) => {
    const digits = String(raw).replace(/\D/g, "");
    setter(digits === "" ? "" : Number(digits));
  };

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const fail = (message) => {
      setError(message);
      setBusy(false);
    };

    if (sumWrong) {
      return fail(
        `Сумма голосов должна равняться числу присутствующих (${present}), сейчас ${total}.`
      );
    }
    if (notElected) {
      return fail(`Делегат не избран: «За» должно быть не менее ${minimum} — это две трети.`);
    }

    if (!canSend) {
      onDraft({ step: "votes", votesFor, votesAgainst, votesAbstain });
      setBusy(false);
      return;
    }

    try {
      const response = await fetch(`/api/conferencia/submissions/${submission.id}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "votes", votesFor, votesAgainst, votesAbstain }),
      });
      const result = await response.json();

      if (!response.ok) return fail(result.error || "Не удалось сохранить голосование.");

      onSaved(result.submission);
    } catch {
      fail("Не удалось связаться с сервером. Попробуйте ещё раз.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <p className="font-semibold text-slate-700">Вопрос, поставленный на голосование:</p>
        <p className="mt-1 text-slate-600">
          «Избрать делегатом на Конференцию Общероссийской общественной организации, назначенную на{" "}
          {CONFERENCE_DATE}, —{" "}
          <span className="font-semibold text-slate-900">
            {submission?.delegateName || "Ф. И. О. делегата"}
          </span>
          ».
        </p>
      </div>

      {present === null ? (
        <p className="text-sm text-slate-500">
          Сумма трёх чисел должна равняться числу присутствующих, а «за» — не менее двух третей от
          них. Явка подтянется из блока «Регистрация», тогда и сверим.
        </p>
      ) : (
        // Колонки фиксированы: при пересчёте строка не переносится и блок не прыгает.
        <div className="grid gap-x-6 gap-y-1 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 sm:grid-cols-3">
          <span>
            Присутствует по явочному листу: <b>{present}</b>
          </span>
          <span>
            Для избрания нужно «за»: <b>{minimum}</b> и больше
          </span>
          <span className={sumWrong ? "font-bold text-rose-700" : "text-indigo-700"}>
            Распределено: {total} из {present}
          </span>
        </div>
      )}

      <fieldset disabled={readOnly} className="grid gap-4 md:grid-cols-3">
        <div>
          <span className={labelClass}>«За»</span>
          <Combobox
            name="votesFor"
            options={choices}
            value={String(votesFor)}
            onChange={pick(setVotesFor)}
            readOnlyInput
            inputClassName={inputClassWithError(sumWrong || notElected)}
          />
        </div>
        <div>
          <span className={labelClass}>«Против»</span>
          <Combobox
            name="votesAgainst"
            options={choices}
            value={String(votesAgainst)}
            onChange={pick(setVotesAgainst)}
            readOnlyInput
            inputClassName={inputClassWithError(sumWrong)}
          />
        </div>
        <div>
          <span className={labelClass}>«Воздержались»</span>
          <Combobox
            name="votesAbstain"
            options={choices}
            value={String(votesAbstain)}
            onChange={pick(setVotesAbstain)}
            readOnlyInput
            inputClassName={inputClassWithError(sumWrong)}
          />
        </div>
      </fieldset>

      {/* Строка под полями всегда на месте: иначе при каждом пересчёте форма
          подпрыгивала на её высоту. */}
      <p className="min-h-4 text-xs font-semibold text-rose-600">
        {sumWrong
          ? `Сумма голосов ${total}, а присутствует ${present}.`
          : notElected
            ? `Нужно минимум ${minimum} голосов «За»: не менее двух третей от присутствующих.`
            : ""}
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            style={{ width: "auto" }}
            className="btn-primary inline-flex h-10 cursor-pointer items-center justify-center rounded-lg px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? "Сохраняем…"
              : canSend
                ? "Сохранить и получить протокол"
                : "Сохранить результаты голосования"}
          </button>
        </div>
      )}
    </form>
  );
}
