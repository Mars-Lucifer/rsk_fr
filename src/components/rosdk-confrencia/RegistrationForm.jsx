import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { regions } from "@/lib/rosdk-confrencia/regions";
import {
  MIN_PRESENT_MEMBERS,
  PASSPORT_NUMBER_LENGTH,
  PASSPORT_SERIES_LENGTH,
  contactError,
  digitsOnly,
  normalizeFio,
  requiredQuorum,
} from "@/lib/rosdk-confrencia/validation";
import { RegionCombobox } from "./RegionCombobox";
import { fieldClass, inputClassWithError, labelClass, validateFio } from "./formFields";

const emptyAttendee = { fullName: "", passportSeries: "", passportNumber: "", contact: "" };

/** Блок 1 собрания: кто пришёл. Отсюда выходит явочный лист и заявка целиком. */
export function RegistrationForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [region, setRegion] = useState("");
  const [totalMembers, setTotalMembers] = useState(9);
  const [chairName, setChairName] = useState("");
  const [secretaryName, setSecretaryName] = useState("");
  const [attendees, setAttendees] = useState(() =>
    Array.from({ length: MIN_PRESENT_MEMBERS }, () => ({ ...emptyAttendee })),
  );

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const presentMembers = attendees.filter((item) => item.fullName.trim()).length;
  const quorum = requiredQuorum(totalMembers || 0);
  const regionError = region && !regions.includes(region) ? "Выберите регион из списка." : null;

  const tooManyPresent = presentMembers > 0 && presentMembers > totalMembers;
  const tooFewPresent =
    presentMembers > 0 && presentMembers < MIN_PRESENT_MEMBERS && !tooManyPresent;
  const noQuorum =
    presentMembers >= MIN_PRESENT_MEMBERS && totalMembers > 0 && presentMembers < quorum;

  const chairFioError = useMemo(() => validateFio(chairName), [chairName]);
  const secretaryFioError = useMemo(() => validateFio(secretaryName), [secretaryName]);

  const duplicateRows = useMemo(() => {
    const seen = new Map();
    const duplicates = new Set();

    attendees.forEach((item, index) => {
      const key = normalizeFio(item.fullName);
      if (!key) return;
      if (seen.has(key)) {
        duplicates.add(seen.get(key));
        duplicates.add(index);
      } else {
        seen.set(key, index);
      }
    });

    return duplicates;
  }, [attendees]);

  const missingInAttendance = useMemo(() => {
    const present = new Set(attendees.map((item) => normalizeFio(item.fullName)).filter(Boolean));

    return [
      ["председатель", chairName],
      ["секретарь", secretaryName],
    ]
      .filter(([, name]) => name.trim() && !present.has(normalizeFio(name)))
      .map(([role, name]) => `${role} — ${name.trim()}`);
  }, [attendees, chairName, secretaryName]);

  const isDirty = Boolean(region || attendees[0]?.fullName.trim());

  useEffect(() => {
    if (!isDirty || busy) return undefined;

    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, busy]);

  const updateAttendee = (index, key, value) => {
    setAttendees((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  };

  const addAttendee = () => setAttendees((current) => [...current, { ...emptyAttendee }]);

  const removeAttendee = (index) =>
    setAttendees((current) =>
      current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current,
    );

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const fail = (message) => {
      setError(message);
      setBusy(false);
    };

    if (!regions.includes(region)) {
      return fail("Выберите субъект Российской Федерации из списка.");
    }

    if (tooFewPresent || presentMembers === 0) {
      return fail(
        `На собрании должно быть не меньше ${MIN_PRESENT_MEMBERS} членов отделения, сейчас в списке ${presentMembers}.`,
      );
    }

    if (tooManyPresent) {
      return fail("В явочном листе больше человек, чем всего членов, состоящих на учёте.");
    }

    if (noQuorum) {
      return fail(
        `Кворума нет: нужно более половины членов отделения, минимум ${quorum} человек.`,
      );
    }

    const filledAttendees = attendees.filter(
      (item) =>
        item.fullName.trim() || item.passportSeries || item.passportNumber || item.contact.trim(),
    );

    const attendeeError = filledAttendees
      .map((item, index) => {
        const fioError = validateFio(item.fullName);
        if (fioError) return `Явочный лист, строка ${index + 1}: ${fioError}`;
        if (item.passportSeries.length !== PASSPORT_SERIES_LENGTH)
          return `Явочный лист, строка ${index + 1}: серия паспорта — ${PASSPORT_SERIES_LENGTH} цифры.`;
        if (item.passportNumber.length !== PASSPORT_NUMBER_LENGTH)
          return `Явочный лист, строка ${index + 1}: номер паспорта — ${PASSPORT_NUMBER_LENGTH} цифр.`;
        const contactProblem = contactError(item.contact);
        if (contactProblem) return `Явочный лист, строка ${index + 1}: ${contactProblem}`;
        return null;
      })
      .find(Boolean);

    if (attendeeError) {
      return fail(attendeeError);
    }

    if (duplicateRows.size > 0) {
      return fail("В явочном листе есть повторяющиеся Ф.И.О. Один человек — одна строка.");
    }

    if (chairFioError || secretaryFioError) {
      return fail("Исправьте Ф.И.О. председателя и секретаря: три русских слова.");
    }

    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      payload.region = region;
      payload.totalMembers = totalMembers;
      payload.attendees = filledAttendees;

      const response = await fetch("/api/conferencia/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        return fail(result.error || "Не удалось создать заявку.");
      }

      await router.push(`/conferencia/${result.submission.id}`);
    } catch {
      fail("Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.");
    }
  }

  return (
    <div className="glass-card space-y-6 rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 sm:p-8">
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
            Блок 1. Регистрация
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
            Заполняйте прямо на собрании. Отсюда получится список присутствовавших, а вместе с ним
            — ссылка на вашу заявку: по ней вы продолжите работу, даже если закроете вкладку.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Субъект Российской Федерации" className="xl:col-span-2">
            <RegionCombobox
              name="region"
              value={region}
              onChange={setRegion}
              placeholder="Например, Псковская область"
              invalid={Boolean(regionError)}
              inputClassName={inputClassWithError(regionError)}
            />
            <span
              className={`mt-1.5 block text-xs font-semibold ${
                regionError ? "text-rose-600" : "text-slate-400"
              }`}
            >
              {regionError ?? `Список из ${regions.length} субъектов открывается по клику.`}
            </span>
          </Field>

          <Field label="Город проведения собрания">
            <input name="city" required placeholder="Например, Псков" className={fieldClass} />
          </Field>

          <Field label="Дата проведения">
            <input
              name="meetingDate"
              required
              type="date"
              max={today}
              defaultValue={today}
              className={fieldClass}
            />
          </Field>

          <Field label="Номер протокола">
            <input name="protocolNumber" required defaultValue="1" className={fieldClass} />
          </Field>

          <Field label="Всего членов отделения на учёте">
            <input
              name="totalMembers"
              required
              inputMode="numeric"
              value={totalMembers}
              onChange={(event) => {
                const digits = digitsOnly(event.target.value).replace(/^0+(?=\d)/, "");
                setTotalMembers(digits === "" ? "" : Number(digits));
              }}
              className={inputClassWithError(tooManyPresent)}
            />
          </Field>

          <div className="md:col-span-2">
            <span className={labelClass}>Присутствует на собрании</span>
            <div
              className={`flex h-10 items-center gap-2 rounded-md border px-3 ${
                tooFewPresent || noQuorum || tooManyPresent
                  ? "border-rose-200 bg-rose-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <span className="text-base font-extrabold text-slate-900">{presentMembers}</span>
              <span className="text-xs font-medium text-slate-500">
                из {totalMembers || 0} на учёте
              </span>
              <span className="ml-auto text-xs font-medium text-slate-400">
                нужно от {Math.max(MIN_PRESENT_MEMBERS, quorum)}
              </span>
            </div>
            <span
              className={`mt-1.5 block text-xs font-semibold ${
                tooFewPresent || noQuorum || tooManyPresent ? "text-rose-600" : "text-slate-400"
              }`}
            >
              {tooManyPresent
                ? `В списке ${presentMembers} человек — больше, чем членов на учёте.`
                : tooFewPresent
                  ? `Нужно не меньше ${MIN_PRESENT_MEMBERS} человек.`
                  : noQuorum
                    ? `Кворума нет: нужно более половины членов отделения, минимум ${quorum}.`
                    : "Считается по заполненным строкам списка ниже."}
            </span>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">Кто присутствует</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Одна строка — один член отделения. Каждая строка попадёт в список присутствовавших,
              где участник распишется от руки.
            </p>
          </div>

          <div className="hidden gap-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 md:grid md:grid-cols-[28px_1.6fr_88px_112px_1.2fr_32px]">
            <span />
            <span>Фамилия Имя Отчество</span>
            <span>Серия</span>
            <span>Номер</span>
            <span>Телефон или e-mail</span>
            <span />
          </div>

          <div className="space-y-2">
            {attendees.map((attendee, index) => {
              const fioError =
                Boolean(validateFio(attendee.fullName)) || duplicateRows.has(index);
              const rowContactError =
                attendee.contact.trim().length > 0 && Boolean(contactError(attendee.contact));
              const seriesError =
                attendee.passportSeries.length > 0 &&
                attendee.passportSeries.length !== PASSPORT_SERIES_LENGTH;
              const numberError =
                attendee.passportNumber.length > 0 &&
                attendee.passportNumber.length !== PASSPORT_NUMBER_LENGTH;

              return (
                <div
                  key={index}
                  className="grid gap-2 md:grid-cols-[28px_1.6fr_88px_112px_1.2fr_32px] md:items-center"
                >
                  <span className="text-xs font-bold text-slate-400 max-md:hidden">
                    {index + 1}
                  </span>
                  <input
                    placeholder="Иванов Иван Иванович"
                    aria-label={`Ф.И.О., строка ${index + 1}`}
                    value={attendee.fullName}
                    onChange={(event) => updateAttendee(index, "fullName", event.target.value)}
                    className={inputClassWithError(fioError)}
                  />
                  <input
                    inputMode="numeric"
                    placeholder="4510"
                    aria-label={`Серия паспорта, строка ${index + 1}`}
                    value={attendee.passportSeries}
                    onChange={(event) =>
                      updateAttendee(
                        index,
                        "passportSeries",
                        digitsOnly(event.target.value).slice(0, PASSPORT_SERIES_LENGTH),
                      )
                    }
                    className={inputClassWithError(seriesError)}
                  />
                  <input
                    inputMode="numeric"
                    placeholder="123456"
                    aria-label={`Номер паспорта, строка ${index + 1}`}
                    value={attendee.passportNumber}
                    onChange={(event) =>
                      updateAttendee(
                        index,
                        "passportNumber",
                        digitsOnly(event.target.value).slice(0, PASSPORT_NUMBER_LENGTH),
                      )
                    }
                    className={inputClassWithError(numberError)}
                  />
                  <input
                    placeholder="+7 (999) 000-00-00 или e-mail"
                    aria-label={`Телефон или e-mail, строка ${index + 1}`}
                    value={attendee.contact}
                    onChange={(event) => updateAttendee(index, "contact", event.target.value)}
                    className={inputClassWithError(rowContactError)}
                  />
                  <button
                    type="button"
                    onClick={() => removeAttendee(index)}
                    disabled={attendees.length === 1}
                    title="Удалить строку"
                    className="h-10 w-8! cursor-pointer rounded-md border border-slate-200! bg-white! px-0! text-slate-400! transition hover:border-rose-300! hover:text-rose-600! disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addAttendee}
            className="h-9 w-auto! cursor-pointer rounded-lg border border-indigo-200! bg-indigo-50! px-4 text-sm font-semibold text-indigo-700! transition hover:bg-indigo-100!"
          >
            + Добавить участника
          </button>

          {duplicateRows.size > 0 && (
            <p className="text-xs font-semibold text-rose-600">
              Один человек внесён дважды. Уберите повтор: от числа присутствующих считаются кворум
              и порог в две трети голосов.
            </p>
          )}
        </div>

        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-base font-bold text-slate-900">Первый вопрос повестки</h3>
          <p className="mt-1 mb-4 max-w-3xl text-sm text-slate-500">
            Собрание избирает председателя и секретаря — они подпишут протокол и список
            присутствовавших. В протоколе это решение печатается как принятое единогласно.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Председатель собрания">
              <input
                name="chairName"
                required
                placeholder="Иванов Иван Иванович"
                value={chairName}
                onChange={(event) => setChairName(event.target.value)}
                className={inputClassWithError(chairFioError)}
              />
              {chairFioError && (
                <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                  {chairFioError}
                </span>
              )}
            </Field>

            <Field label="Секретарь собрания">
              <input
                name="secretaryName"
                required
                placeholder="Иванов Иван Иванович"
                value={secretaryName}
                onChange={(event) => setSecretaryName(event.target.value)}
                className={inputClassWithError(secretaryFioError)}
              />
              {secretaryFioError && (
                <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                  {secretaryFioError}
                </span>
              )}
            </Field>
          </div>

          {missingInAttendance.length > 0 && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Не найдены в списке присутствующих: {missingInAttendance.join("; ")}. Председателя и
              секретаря избирают из тех, кто пришёл — проверьте, нет ли опечатки.
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <p className="max-w-lg text-xs text-slate-500">
            Дальше откроется рабочая страница собрания: там блоки «Делегат», «Голосование» и
            загрузка сканов. Ссылку на неё сохраните.
          </p>
          <button
            type="submit"
            disabled={busy}
            className="btn-primary inline-flex h-11 cursor-pointer items-center justify-center rounded-lg px-8 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Сохраняем…" : "Сохранить и продолжить"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, className, children }) {
  return (
    <label className={className}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}
