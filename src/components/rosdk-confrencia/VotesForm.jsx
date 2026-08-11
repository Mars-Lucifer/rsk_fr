import { useState } from "react";
import { CONFERENCE_DATE } from "@/lib/rosdk-confrencia/slots";
import { digitsOnly, requiredVotesFor } from "@/lib/rosdk-confrencia/validation";
import { inputClassWithError, labelClass } from "./formFields";

/** Блок 3 собрания: как проголосовали. Из него собирается протокол. */
export function VotesForm({ submission, onSaved }) {
  const present = submission.presentMembers;

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [votesFor, setVotesFor] = useState(present);
  const [votesAgainst, setVotesAgainst] = useState(0);
  const [votesAbstain, setVotesAbstain] = useState(0);

  const minimum = requiredVotesFor(present);
  const total = (votesFor || 0) + (votesAgainst || 0) + (votesAbstain || 0);
  const sumWrong = total !== present;
  const notElected = !sumWrong && (votesFor || 0) < minimum;

  const numeric = (setter) => (event) => {
    const digits = digitsOnly(event.target.value).replace(/^0+(?=\d)/, "");
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
      return fail(`Сумма голосов должна равняться числу присутствующих (${present}), сейчас ${total}.`);
    }
    if (notElected) {
      return fail(`Делегат не избран: «За» должно быть не менее ${minimum} — это две трети.`);
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
            {submission.delegateName || "Ф. И. О. делегата"}
          </span>
          ».
        </p>
      </div>

      <p className="text-sm text-slate-500">
        Три числа в сумме должны дать число присутствующих ({present}). Делегат избран при{" "}
        {minimum} голосах «за» и больше.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <label>
          <span className={labelClass}>«За»</span>
          <input
            required
            inputMode="numeric"
            value={votesFor}
            onChange={numeric(setVotesFor)}
            className={inputClassWithError(sumWrong || notElected)}
          />
        </label>
        <label>
          <span className={labelClass}>«Против»</span>
          <input
            required
            inputMode="numeric"
            value={votesAgainst}
            onChange={numeric(setVotesAgainst)}
            className={inputClassWithError(sumWrong)}
          />
        </label>
        <label>
          <span className={labelClass}>«Воздержались»</span>
          <input
            required
            inputMode="numeric"
            value={votesAbstain}
            onChange={numeric(setVotesAbstain)}
            className={inputClassWithError(sumWrong)}
          />
        </label>
      </div>

      {(sumWrong || notElected) && (
        <p className="text-xs font-semibold text-rose-600">
          {sumWrong
            ? `Сумма голосов ${total}, а присутствует ${present}.`
            : `Нужно минимум ${minimum} голосов «За»: не менее двух третей от присутствующих.`}
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        style={{ width: "auto" }}
        className="btn-primary inline-flex h-10 cursor-pointer items-center justify-center rounded-lg px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Сохраняем…" : "Сохранить и получить протокол"}
      </button>
    </form>
  );
}
