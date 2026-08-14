import { useEffect, useMemo, useState } from "react";
import { regions } from "@/lib/rosdk-confrencia/regions";
import {
  MIN_PRESENT_MEMBERS,
  PASSPORT_NUMBER_LENGTH,
  PASSPORT_SERIES_LENGTH,
  digitsOnly,
  normalizeFio,
  phoneError,
} from "@/lib/rosdk-confrencia/validation";
import { Combobox, RegionCombobox } from "./Combobox";
import { DocumentButton } from "./DocumentButton";
import {
  fieldClass,
  formatPhone,
  inputClassWithError,
  labelClass,
  validateFio,
} from "./formFields";

const emptyAttendee = {
  fullName: "",
  passportSeries: "",
  passportNumber: "",
  phone: "",
  email: "",
};

/**
 * Блок 1 собрания: кто пришёл. Отсюда выходит явочный лист и заявка целиком.
 * Созданную заявку отдаём наверх — работа продолжается на этой же странице.
 */
export function RegistrationForm({
  submission = null,
  lockedRegion = null,
  linkToken = "",
  readOnly = false,
  onCreated,
  onCancel,
}) {
  const editing = Boolean(submission);

  const [error, setError] = useState("");
  // Правка явки может отозвать протокол — об этом надо сказать словами,
  // иначе блок «Голосование» просто молча позеленеет обратно в жёлтый.
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Субъект приходит либо из персональной ссылки, либо из уже созданной заявки.
  // В обоих случаях он не редактируется: по нему выдан номер протокола.
  const fixedRegion = submission?.region ?? lockedRegion ?? null;
  const [region, setRegion] = useState(fixedRegion ?? "");
  const [chairName, setChairName] = useState(submission?.chairName ?? "");
  const [secretaryName, setSecretaryName] = useState(submission?.secretaryName ?? "");
  const [consent, setConsent] = useState(editing);
  const [attendees, setAttendees] = useState(() =>
    submission?.attendees?.length
      ? submission.attendees.map((item) => ({ ...emptyAttendee, ...item }))
      : Array.from({ length: MIN_PRESENT_MEMBERS }, () => ({ ...emptyAttendee }))
  );

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  // Тот же запас в сутки, что и на сервере: часовой пояс отделения впереди пояса
  // сервера, и для Дальнего Востока «сегодня» иначе оказывается будущим.
  const maxMeetingDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }, []);

  const presentMembers = attendees.filter((item) => item.fullName.trim()).length;
  const regionError = region && !regions.includes(region) ? "Выберите регион из списка." : null;
  const tooFewPresent = presentMembers > 0 && presentMembers < MIN_PRESENT_MEMBERS;

  // Председателя и секретаря выбирают из тех, кто уже внесён в явочный лист.
  const attendeeNames = attendees.map((item) => item.fullName.trim()).filter(Boolean);

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

  const isDirty = Boolean(region || attendees[0]?.fullName.trim());

  // Список для поля «Участников на собрании»: до 10 кликом, больше — вписать руками.
  const COUNT_CHOICES = Array.from({ length: 16 }, (_, index) =>
    String(index + MIN_PRESENT_MEMBERS)
  );

  // В режиме правки данные уже лежат на сервере: спрашивать «изменения могут не
  // сохраниться» не за что, а всплывало это даже при скачивании бланка.
  useEffect(() => {
    if (!isDirty || busy || editing) return undefined;

    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, busy, editing]);

  const updateAttendee = (index, key, value) => {
    setAttendees((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    );
  };

  /** Длина явочного листа = выбранное число участников: лишние строки не нужны. */
  const setRowCount = (count) =>
    setAttendees((current) => {
      // Ниже минимума опускать нельзя: собрание с четырьмя участниками неправомочно.
      const size = Math.max(MIN_PRESENT_MEMBERS, Math.min(count || 0, 100));
      if (size === current.length) return current;
      if (size < current.length) return current.slice(0, size);
      return [
        ...current,
        ...Array.from({ length: size - current.length }, () => ({ ...emptyAttendee })),
      ];
    });

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    const fail = (message) => {
      setError(message);
      setBusy(false);
    };

    if (!regions.includes(region)) {
      return fail("Выберите субъект Российской Федерации из списка.");
    }

    if (tooFewPresent || presentMembers === 0) {
      return fail(
        `На собрании должно быть не меньше ${MIN_PRESENT_MEMBERS} членов отделения, сейчас в списке ${presentMembers}.`
      );
    }

    if (!consent) {
      return fail("Подтвердите согласие участников на обработку персональных данных.");
    }

    const filledAttendees = attendees.filter(
      (item) =>
        item.fullName.trim() || item.passportSeries || item.passportNumber || item.phone.trim()
    );

    const attendeeError = filledAttendees
      .map((item, index) => {
        const fioError = validateFio(item.fullName);
        if (fioError) return `Явочный лист, строка ${index + 1}: ${fioError}`;
        if (item.passportSeries.length !== PASSPORT_SERIES_LENGTH)
          return `Явочный лист, строка ${index + 1}: серия паспорта — ${PASSPORT_SERIES_LENGTH} цифры.`;
        if (item.passportNumber.length !== PASSPORT_NUMBER_LENGTH)
          return `Явочный лист, строка ${index + 1}: номер паспорта — ${PASSPORT_NUMBER_LENGTH} цифр.`;
        const phoneProblem = phoneError(item.phone);
        if (phoneProblem) return `Явочный лист, строка ${index + 1}: ${phoneProblem}`;
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
      return fail("Исправьте Ф.И.О. председателя и секретаря: два или три русских слова.");
    }

    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      payload.region = region;
      payload.attendees = filledAttendees;

      // Сервер возьмёт субъект из токена: подменить его в теле запроса нельзя.
      if (linkToken) payload.linkToken = linkToken;

      if (editing) payload.step = "registration";

      const response = await fetch(
        editing
          ? `/api/conferencia/submissions/${submission.id}/step`
          : "/api/conferencia/submissions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();

      if (!response.ok) {
        return fail(result.error || "Не удалось сохранить регистрацию.");
      }

      if (result.notice) setNotice(result.notice);
      onCreated(result.submission);
    } catch {
      fail("Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.");
    }
  }

  return (
    // Внутри блока заявки карточка уже есть — своя рамка тут только удваивала бы её.
    <div
      className={
        submission
          ? "space-y-6 text-slate-800"
          : "glass-card space-y-6 rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 sm:p-8"
      }
    >
      <form onSubmit={onSubmit} className="space-y-6">
        {/* Сохранённый блок остаётся тем же бланком, только неактивным: одно
            disabled на fieldset гасит все поля разом, включая комбобоксы. */}
        <fieldset disabled={readOnly} className="space-y-6">
          {!submission && (
            <p className="max-w-3xl text-sm leading-relaxed text-slate-500">
              Заполняйте прямо на собрании: отсюда получится список присутствовавших, который
              печатается и подписывается на месте.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Субъект Российской Федерации" className="xl:col-span-2" required>
              {fixedRegion ? (
                // Та же высота и рамка, что у соседних полей: блок стоит ровно.
                <div className={`${fieldClass} flex items-center bg-slate-100! text-slate-600!`}>
                  <span className="truncate text-sm font-semibold text-slate-900">
                    {fixedRegion}
                  </span>
                </div>
              ) : (
                <>
                  <RegionCombobox
                    name="region"
                    value={region}
                    onChange={setRegion}
                    placeholder="Например, Псковская область"
                    invalid={Boolean(regionError)}
                    inputClassName={inputClassWithError(regionError)}
                  />
                  {regionError && (
                    <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                      {regionError}
                    </span>
                  )}
                </>
              )}
            </Field>

            <Field label="Город проведения собрания" required>
              <input
                name="city"
                required
                defaultValue={submission?.city ?? ""}
                placeholder="Например, Псков"
                className={fieldClass}
              />
            </Field>

            <Field label="Дата проведения" required>
              <input
                name="meetingDate"
                required
                type="date"
                max={maxMeetingDate}
                defaultValue={submission?.meetingDate ?? today}
                className={fieldClass}
              />
            </Field>

            <Field label="Участников на собрании" required>
              <Combobox
                options={COUNT_CHOICES}
                value={String(attendees.length)}
                onChange={(raw) => setRowCount(Number(String(raw).replace(/\D/g, "")) || 0)}
                inputClassName={inputClassWithError(tooFewPresent)}
              />
              <span
                className={`mt-1.5 block text-xs font-semibold ${tooFewPresent ? "text-rose-600" : "text-slate-500"}`}
              >
                {tooFewPresent
                  ? `Заполнено ${presentMembers} — нужно не меньше ${MIN_PRESENT_MEMBERS}.`
                  : `Нужно не меньше ${MIN_PRESENT_MEMBERS}. Строки ниже появятся сами.`}
              </span>
            </Field>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Кто присутствует</h3>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Одна строка — один участник. Каждая строка попадёт в список присутствовавших, где
                участник распишется от руки.
              </p>
            </div>

            <div className="hidden gap-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 md:grid md:grid-cols-[28px_1.8fr_90px_120px_1.2fr]">
              <span />
              {/* Обязательны все четыре: без них строка не попадёт в явочный лист. */}
              <span>
                Фамилия Имя Отчество<span className="text-rose-500"> *</span>
              </span>
              <span>
                Серия<span className="text-rose-500"> *</span>
              </span>
              <span>
                Номер<span className="text-rose-500"> *</span>
              </span>
              <span>
                Телефон<span className="text-rose-500"> *</span>
              </span>
            </div>

            <div className="space-y-2">
              {attendees.map((attendee, index) => {
                const fioError =
                  Boolean(validateFio(attendee.fullName)) || duplicateRows.has(index);
                const seriesError =
                  attendee.passportSeries.length > 0 &&
                  attendee.passportSeries.length !== PASSPORT_SERIES_LENGTH;
                const numberError =
                  attendee.passportNumber.length > 0 &&
                  attendee.passportNumber.length !== PASSPORT_NUMBER_LENGTH;
                const rowPhoneProblem = attendee.phone.trim() ? phoneError(attendee.phone) : null;
                const rowPhoneError = Boolean(rowPhoneProblem);
                const rowFioProblem = attendee.fullName.trim()
                  ? validateFio(attendee.fullName)
                  : null;

                const rowProblem = duplicateRows.has(index)
                  ? "этот человек уже есть в списке выше"
                  : (rowFioProblem ??
                    (seriesError ? `серия паспорта — ${PASSPORT_SERIES_LENGTH} цифры` : null) ??
                    (numberError ? `номер паспорта — ${PASSPORT_NUMBER_LENGTH} цифр` : null) ??
                    rowPhoneProblem);
                return (
                  <div
                    key={index}
                    className="grid gap-2 md:grid-cols-[28px_1.8fr_90px_120px_1.2fr] md:items-center"
                  >
                    <span className="text-xs font-bold text-slate-500 max-md:hidden">
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
                          digitsOnly(event.target.value).slice(0, PASSPORT_SERIES_LENGTH)
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
                          digitsOnly(event.target.value).slice(0, PASSPORT_NUMBER_LENGTH)
                        )
                      }
                      className={inputClassWithError(numberError)}
                    />
                    <input
                      placeholder="+7 (999) 000-00-00"
                      aria-label={`Телефон, строка ${index + 1}`}
                      value={attendee.phone}
                      onChange={(event) =>
                        updateAttendee(index, "phone", formatPhone(event.target.value))
                      }
                      className={inputClassWithError(rowPhoneError)}
                    />
                    {/* Строки добавляются и убираются полем «Участников на собрании»:
                      крестик у каждой строки дублировал его и путал. */}
                    {rowProblem && (
                      <p className="text-xs font-semibold text-rose-600 md:col-span-4 md:col-start-2">
                        Строка {index + 1}: {rowProblem}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {duplicateRows.size > 0 && (
              <p className="text-xs font-semibold text-rose-600">
                Один человек внесён дважды. Уберите повтор: от числа участников считается порог в
                две трети голосов.
              </p>
            )}
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-base font-bold text-slate-900">Первый вопрос повестки</h3>
            <p className="mt-1 mb-4 max-w-3xl text-sm text-slate-500">
              Собрание избирает председателя и секретаря — они подпишут протокол и список
              присутствовавших. В протоколе это решение печатается как принятое единогласно.
            </p>
            {attendeeNames.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Сначала внесите тех, кто присутствует на собрании: председателя и секретаря выбирают
                из них.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Председатель собрания" required>
                  <Combobox
                    name="chairName"
                    options={attendeeNames}
                    value={chairName}
                    onChange={setChairName}
                    readOnlyInput
                    placeholder="Выберите из присутствующих"
                    inputClassName={inputClassWithError(chairFioError)}
                  />
                </Field>

                <Field label="Секретарь собрания" required>
                  <Combobox
                    name="secretaryName"
                    options={attendeeNames}
                    value={secretaryName}
                    onChange={setSecretaryName}
                    readOnlyInput
                    placeholder="Выберите из присутствующих"
                    inputClassName={inputClassWithError(secretaryFioError)}
                  />
                </Field>
              </div>
            )}
          </div>

          <label
            hidden={editing}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
            />
            <span className="text-xs leading-relaxed text-slate-600">
              Участники собрания уведомлены и согласны на обработку персональных данных Оргкомитетом
              Конференции: Ф.И.О., паспортные данные и контакты — для учёта делегатов и подготовки
              протокола.
            </span>
          </label>
        </fieldset>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            {notice}
          </div>
        )}

        {/* Сохранённый блок кнопок не показывает: правка начинается карандашом. */}
        {!readOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            {/* В режиме правки кнопка бланка уже есть ниже, в самом блоке. */}
            <div>
              {!editing && (
                <DocumentButton submission={null} documentKey="attendanceDocx" done={false} />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={busy}
                className="btn-primary inline-flex h-11 cursor-pointer items-center justify-center rounded-lg px-8 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Сохраняем…" : editing ? "Сохранить изменения" : "Сохранить и продолжить"}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

function Field({ label, className, required = false, children }) {
  return (
    <label className={className}>
      <span className={labelClass}>
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
