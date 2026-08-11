import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { regions } from "@/lib/rosdk-confrencia/regions";
import { CONFERENCE_DATE } from "@/lib/rosdk-confrencia/slots";
import {
  PASSPORT_NUMBER_LENGTH,
  PASSPORT_SERIES_LENGTH,
  contactError,
  digitsOnly,
  normalizeFio,
  requiredQuorum,
  requiredVotesFor,
} from "@/lib/rosdk-confrencia/validation";
import { RegionCombobox } from "./RegionCombobox";

const fieldClass = "h-10 w-full rounded-md modern-input px-3 text-sm outline-none";
const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700";

function validateFio(value) {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  const parts = trimmed.split(" ");
  if (parts.length !== 3) {
    return "ФИО должно состоять ровно из 3 слов (Фамилия Имя Отчество).";
  }
  const nameRegex = /^[а-яё\-]+$/i;
  for (const part of parts) {
    if (!nameRegex.test(part)) {
      return "ФИО должно содержать только русские буквы.";
    }
  }
  return null;
}

function formatPhone(value) {
  let digits = digitsOnly(value);
  if (digits.startsWith("7") || digits.startsWith("8")) {
    digits = digits.substring(1);
  }
  digits = digits.substring(0, 10);

  let formatted = "";
  if (digits.length > 0) {
    formatted = "+7 (" + digits.substring(0, 3);
  }
  if (digits.length >= 3) {
    formatted += ") " + digits.substring(3, 6);
  }
  if (digits.length >= 6) {
    formatted += "-" + digits.substring(6, 8);
  }
  if (digits.length >= 8) {
    formatted += "-" + digits.substring(8, 10);
  }
  return formatted;
}

const emptyAttendee = { fullName: "", passportSeries: "", passportNumber: "", contact: "" };

export function PublicSubmissionForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const [region, setRegion] = useState("");
  const [addressRegion, setAddressRegion] = useState("");
  const [addressRegionEdited, setAddressRegionEdited] = useState(false);
  const [totalMembers, setTotalMembers] = useState(3);
  const [votesFor, setVotesFor] = useState(3);
  const [votesForEdited, setVotesForEdited] = useState(false);
  const [votesAgainst, setVotesAgainst] = useState(0);
  const [votesAbstain, setVotesAbstain] = useState(0);

  const [attendees, setAttendees] = useState([
    { ...emptyAttendee },
    { ...emptyAttendee },
    { ...emptyAttendee },
  ]);

  const [delegateName, setDelegateName] = useState("");
  const [delegatePhone, setDelegatePhone] = useState("");
  const [chairName, setChairName] = useState("");
  const [secretaryName, setSecretaryName] = useState("");

  const [passportSeries, setPassportSeries] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [passportDeptCode, setPassportDeptCode] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const presentMembers = attendees.filter((item) => item.fullName.trim()).length;
  const quorum = requiredQuorum(totalMembers || 0);
  const minimumVotes = requiredVotesFor(presentMembers);

  // Пока «За» не правили руками, оно идёт за явочным листом: типовой случай —
  // единогласное решение, и человеку не приходится пересчитывать сумму.
  const effectiveVotesFor = votesForEdited ? votesFor : presentMembers;
  const votesTotal = (effectiveVotesFor || 0) + (votesAgainst || 0) + (votesAbstain || 0);

  // Адрес регистрации почти всегда в том же субъекте — подставляем, но не
  // запираем: делегат может быть прописан в соседнем регионе.
  const effectiveAddressRegion = addressRegionEdited ? addressRegion : region;

  const regionError = region && !regions.includes(region) ? "Выберите регион из списка." : null;
  const hasExcessMembersWarning = presentMembers > 0 && presentMembers > totalMembers;
  const hasQuorumWarning =
    totalMembers > 0 && presentMembers > 0 && presentMembers < quorum && !hasExcessMembersWarning;
  const hasVotesSumWarning = presentMembers > 0 && votesTotal !== presentMembers;
  const hasVoteWarning =
    presentMembers > 0 && !hasVotesSumWarning && (effectiveVotesFor || 0) < minimumVotes;

  const delegateFioError = useMemo(() => validateFio(delegateName), [delegateName]);
  const chairFioError = useMemo(() => validateFio(chairName), [chairName]);
  const secretaryFioError = useMemo(() => validateFio(secretaryName), [secretaryName]);

  // Строки явочного листа, где одного человека внесли дважды.
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

  // Председатель, секретарь и делегат избираются на собрании, значит должны
  // стоять в явочном листе. Опечатка здесь разводит протокол и явочный лист.
  const missingInAttendance = useMemo(() => {
    const present = new Set(
      attendees.map((item) => normalizeFio(item.fullName)).filter(Boolean),
    );

    return [
      ["председатель", chairName],
      ["секретарь", secretaryName],
      ["делегат", delegateName],
    ]
      .filter(([, name]) => name.trim() && !present.has(normalizeFio(name)))
      .map(([role, name]) => `${role} — ${name.trim()}`);
  }, [attendees, chairName, secretaryName, delegateName]);

  // Черновик не сохраняется, а форма длинная: случайное закрытие вкладки
  // стоит отделению получаса работы. Браузер спросит подтверждение.
  const isDirty = Boolean(region || delegateName || attendees[0]?.fullName.trim());

  useEffect(() => {
    if (!isDirty || busy) return undefined;

    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, busy]);

  const handleNumericChange = (setter) => (event) => {
    const digits = digitsOnly(event.target.value).replace(/^0+(?=\d)/, "");
    setter(digits === "" ? "" : Number(digits));
  };

  const updateAttendee = (index, key, value) => {
    setAttendees((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  };

  const addAttendee = () => setAttendees((current) => [...current, { ...emptyAttendee }]);

  const removeAttendee = (index) =>
    setAttendees((current) =>
      current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current,
    );

  const inputClassWithError = (hasError) =>
    `${fieldClass} ${hasError ? "border-rose-500! focus:border-rose-500! focus:ring-rose-100!" : ""}`;

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

    if (presentMembers === 0) {
      return fail("Заполните явочный лист: нужен хотя бы один присутствующий член отделения.");
    }

    if (hasExcessMembersWarning) {
      return fail(
        "В явочном листе больше человек, чем всего членов, состоящих на учёте в отделении.",
      );
    }

    if (hasQuorumWarning) {
      return fail(
        `Собрание неправомочно: кворум — более половины членов отделения (минимум ${quorum}).`,
      );
    }

    if (hasVotesSumWarning) {
      return fail(
        `Сумма голосов должна равняться числу присутствующих (${presentMembers}), сейчас ${votesTotal}.`,
      );
    }

    if (hasVoteWarning) {
      return fail(
        `Делегат не избран: «За» должно быть не менее 2/3 присутствующих (минимум ${minimumVotes}).`,
      );
    }

    const filledAttendees = attendees.filter(
      (item) =>
        item.fullName.trim() ||
        item.passportSeries ||
        item.passportNumber ||
        item.contact.trim(),
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
      return fail(
        "В явочном листе есть повторяющиеся Ф.И.О. Один человек — одна строка, иначе кворум посчитается неверно.",
      );
    }

    if (delegateFioError || chairFioError || secretaryFioError) {
      return fail("Исправьте ошибки в ФИО (должно быть 3 русских слова).");
    }

    if (digitsOnly(delegatePhone).length !== 11) {
      return fail("Номер телефона делегата должен содержать 11 цифр.");
    }

    if (
      passportSeries.length !== PASSPORT_SERIES_LENGTH ||
      passportNumber.length !== PASSPORT_NUMBER_LENGTH
    ) {
      return fail(
        `Паспорт делегата: серия — ${PASSPORT_SERIES_LENGTH} цифры, номер — ${PASSPORT_NUMBER_LENGTH} цифр.`,
      );
    }

    if (digitsOnly(passportDeptCode).length !== 6) {
      return fail("Код подразделения должен состоять из 6 цифр.");
    }

    if (addressPostalCode.length !== 6) {
      return fail("Почтовый индекс в адресе регистрации — 6 цифр.");
    }

    try {
      const form = new FormData(event.currentTarget);
      const payload = Object.fromEntries(form.entries());

      payload.region = region;
      payload.addressRegion = effectiveAddressRegion;
      payload.totalMembers = totalMembers;
      payload.votesFor = effectiveVotesFor;
      payload.votesAgainst = votesAgainst;
      payload.votesAbstain = votesAbstain;
      payload.delegatePhone = delegatePhone;
      payload.passportSeries = passportSeries;
      payload.passportNumber = passportNumber;
      payload.passportDepartmentCode = passportDeptCode;
      payload.addressPostalCode = addressPostalCode;
      payload.attendees = filledAttendees;

      const response = await fetch("/api/conferencia/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не удалось создать документы.");
        setBusy(false);
        return;
      }

      // Дальше работа идёт на странице заявки: туда можно вернуться через дни.
      await router.push(`/conferencia/${result.submission.id}`);
    } catch {
      setError("Не удалось связаться с сервером. Проверьте подключение и попробуйте еще раз.");
      setBusy(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8 bg-white border border-slate-200 text-slate-800 space-y-6">
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Данные собрания</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
            Вносите по итогам уже проведённого собрания. Из этих данных соберутся три бланка:
            протокол, список присутствовавших и согласие делегата. Проверять и подписывать их вы
            будете на бумаге, поэтому вводите так, как должно быть в документе.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Субъект Российской Федерации" className="xl:col-span-2">
            <RegionCombobox
              name="region"
              value={region}
              onChange={setRegion}
              placeholder="Нажмите и выберите или начните вводить: Псков…"
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
            <input
              name="protocolNumber"
              required
              defaultValue="1"
              placeholder="1"
              className={fieldClass}
            />
          </Field>

          <Field label="Всего членов отделения на учёте">
            <input
              name="totalMembers"
              required
              inputMode="numeric"
              value={totalMembers}
              onChange={handleNumericChange(setTotalMembers)}
              className={inputClassWithError(hasExcessMembersWarning)}
            />
            {hasExcessMembersWarning && (
              <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                В явочном листе {presentMembers} человек — больше, чем членов на учёте.
              </span>
            )}
          </Field>

          {/* Считается из явочного листа, поэтому поле не редактируется */}
          <div className="md:col-span-2">
            <span className={labelClass}>Присутствовало на собрании</span>
            <div
              className={`flex h-10 items-center gap-2 rounded-md border px-3 ${
                hasQuorumWarning
                  ? "border-rose-200 bg-rose-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <span className="text-base font-extrabold text-slate-900">{presentMembers}</span>
              <span className="text-xs font-medium text-slate-500">
                из {totalMembers || 0} на учёте
              </span>
              <span className="ml-auto text-xs font-medium text-slate-400">
                кворум — от {quorum}
              </span>
            </div>
            <span
              className={`mt-1.5 block text-xs font-semibold ${
                hasQuorumWarning ? "text-rose-600" : "text-slate-400"
              }`}
            >
              {hasQuorumWarning
                ? `Кворума нет: нужно более половины членов отделения, минимум ${quorum}.`
                : "Считается автоматически по заполненным строкам явочного листа ниже."}
            </span>
          </div>
        </div>

        {/* Явочный лист */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Кто присутствовал на собрании</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Одна строка — один член отделения. Каждая строка попадёт в список присутствовавших,
              где участник поставит подпись от руки. Отсюда же считается кворум.
            </p>
          </div>

          <div className="hidden gap-2 px-1 md:grid md:grid-cols-[28px_1.6fr_88px_112px_1.2fr_32px] text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span />
            <span>Фамилия Имя Отчество</span>
            <span>Серия</span>
            <span>Номер</span>
            <span>Телефон или e-mail</span>
            <span />
          </div>

          <div className="space-y-2">
            {attendees.map((attendee, index) => {
              const fioError = Boolean(validateFio(attendee.fullName)) || duplicateRows.has(index);
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
                    className="h-10 w-8! rounded-md border border-slate-200! bg-white! px-0! text-slate-400! transition hover:border-rose-300! hover:text-rose-600! disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
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
            className="h-9 w-auto! rounded-lg border border-indigo-200! bg-indigo-50! px-4 text-sm font-semibold text-indigo-700! transition hover:bg-indigo-100! cursor-pointer"
          >
            + Добавить участника
          </button>

          {duplicateRows.size > 0 && (
            <p className="text-xs font-semibold text-rose-600">
              Один человек внесён дважды. Уберите повтор: от числа присутствующих считаются кворум
              и порог в две трети голосов.
            </p>
          )}

          {missingInAttendance.length > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Не найдены в явочном листе: {missingInAttendance.join("; ")}. Председатель, секретарь
              и делегат избираются из присутствующих — проверьте, нет ли опечатки в Ф.И.О.
            </p>
          )}
        </div>

        {/* Голосование */}
        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-base font-bold text-slate-900">Как голосовали по второму вопросу</h3>
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="font-semibold text-slate-700">Вопрос, поставленный на голосование:</p>
            <p className="mt-1 text-slate-600">
              «Избрать делегатом на Конференцию Общероссийской общественной организации,
              назначенную на {CONFERENCE_DATE}, —{" "}
              <span className="font-semibold text-slate-900">
                {delegateName.trim() || "Ф. И. О. делегата"}
              </span>
              ».
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Первый вопрос повестки — избрание председателя и секретаря собрания — печатается в
              протоколе как принятый единогласно.
            </p>
          </div>
          <p className="mt-3 mb-4 text-sm text-slate-500">
            Три числа в сумме должны дать число присутствующих ({presentMembers}).
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="«За»">
              <input
                name="votesFor"
                required
                inputMode="numeric"
                value={effectiveVotesFor}
                onChange={(event) => {
                  setVotesForEdited(true);
                  handleNumericChange(setVotesFor)(event);
                }}
                className={inputClassWithError(hasVoteWarning || hasVotesSumWarning)}
              />
              {!votesForEdited && presentMembers > 0 && (
                <span className="mt-1.5 block text-xs font-semibold text-slate-400">
                  Проставлено единогласно по явочному листу — исправьте, если голосовали иначе.
                </span>
              )}
            </Field>
            <Field label="«Против»">
              <input
                name="votesAgainst"
                required
                inputMode="numeric"
                value={votesAgainst}
                onChange={handleNumericChange(setVotesAgainst)}
                className={inputClassWithError(hasVotesSumWarning)}
              />
            </Field>
            <Field label="«Воздержались»">
              <input
                name="votesAbstain"
                required
                inputMode="numeric"
                value={votesAbstain}
                onChange={handleNumericChange(setVotesAbstain)}
                className={inputClassWithError(hasVotesSumWarning)}
              />
            </Field>
          </div>
          {hasVotesSumWarning && (
            <span className="mt-2 block text-xs font-semibold text-rose-600">
              Сумма голосов {votesTotal}, а присутствовало {presentMembers}.
            </span>
          )}
          {hasVoteWarning && (
            <span className="mt-2 block text-xs font-semibold text-rose-600">
              Нужно минимум {minimumVotes} голосов «За»: не менее 2/3 от присутствующих.
            </span>
          )}
        </div>

        {/* Президиум */}
        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-base font-bold text-slate-900">Кто вёл собрание</h3>
          <p className="mt-1 mb-4 text-sm text-slate-500">
            Председатель и секретарь подписывают протокол и список присутствовавших.
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
        </div>

        {/* Делегат */}
        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-base font-bold text-slate-900">Избранный делегат</h3>
          <p className="mt-1 mb-4 max-w-3xl text-sm text-slate-500">
            По этим контактам Оргкомитет пришлёт подключение к Конференции, поэтому проверьте
            e-mail внимательно.
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="ФИО делегата">
              <input
                name="delegateName"
                required
                placeholder="Иванов Иван Иванович"
                value={delegateName}
                onChange={(event) => setDelegateName(event.target.value)}
                className={inputClassWithError(delegateFioError)}
              />
              {delegateFioError && (
                <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                  {delegateFioError}
                </span>
              )}
            </Field>

            <Field label="Телефон делегата">
              <input
                name="delegatePhone"
                required
                type="tel"
                placeholder="+7 (900) 000-00-00"
                value={delegatePhone}
                onChange={(event) => setDelegatePhone(formatPhone(event.target.value))}
                className={fieldClass}
              />
            </Field>

            <Field label="E-mail делегата">
              <input
                name="delegateEmail"
                required
                type="email"
                placeholder="delegate@example.ru"
                className={fieldClass}
              />
            </Field>
          </div>
        </div>

        {/* Адрес регистрации */}
        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-base font-bold text-slate-900">Адрес регистрации делегата</h3>
          <p className="mt-1 mb-4 max-w-3xl text-sm text-slate-500">
            Как в паспорте, по строке регистрации. Адрес печатается в протоколе и в согласии на
            обработку данных.
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Почтовый индекс">
              <input
                name="addressPostalCode"
                required
                inputMode="numeric"
                placeholder="180000"
                value={addressPostalCode}
                onChange={(event) => setAddressPostalCode(digitsOnly(event.target.value).slice(0, 6))}
                className={inputClassWithError(
                  addressPostalCode.length > 0 && addressPostalCode.length !== 6,
                )}
              />
            </Field>
            <Field label="Субъект РФ, край или область" className="xl:col-span-2">
              <RegionCombobox
                name="addressRegion"
                value={effectiveAddressRegion}
                onChange={(value) => {
                  setAddressRegionEdited(true);
                  setAddressRegion(value);
                }}
                placeholder="Псковская область"
                inputClassName={fieldClass}
              />
              <span className="mt-1.5 block text-xs font-semibold text-slate-400">
                {addressRegionEdited
                  ? "Задан вручную."
                  : "Подставлен из субъекта отделения — измените, если делегат прописан в другом регионе."}
              </span>
            </Field>
            <Field label="Район">
              <input
                name="addressDistrict"
                placeholder="Печорский район, если есть"
                className={fieldClass}
              />
            </Field>
            <Field label="Город или населённый пункт">
              <input
                name="addressSettlement"
                required
                placeholder="г. Псков"
                className={fieldClass}
              />
            </Field>
            <Field label="Улица">
              <input name="addressStreet" required placeholder="Советская" className={fieldClass} />
            </Field>
            <Field label="Дом">
              <input name="addressHouse" required placeholder="5" className={fieldClass} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Корпус">
                <input name="addressBuilding" placeholder="—" className={fieldClass} />
              </Field>
              <Field label="Квартира">
                <input name="addressFlat" placeholder="12" className={fieldClass} />
              </Field>
            </div>
          </div>
        </div>

        {/* Паспорт */}
        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-base font-bold text-slate-900">Паспорт делегата</h3>
          <p className="mt-1 mb-4 max-w-3xl text-sm text-slate-500">
            Нужен для протокола и согласия на обработку данных: по нему делегата опознают при
            подключении к Конференции. Данные видны только Оргкомитету.
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Field label={`Серия — ${PASSPORT_SERIES_LENGTH} цифры`}>
              <input
                name="passportSeries"
                required
                inputMode="numeric"
                placeholder="4510"
                value={passportSeries}
                onChange={(event) =>
                  setPassportSeries(digitsOnly(event.target.value).slice(0, PASSPORT_SERIES_LENGTH))
                }
                className={inputClassWithError(
                  passportSeries.length > 0 && passportSeries.length !== PASSPORT_SERIES_LENGTH,
                )}
              />
            </Field>
            <Field label={`Номер — ${PASSPORT_NUMBER_LENGTH} цифр`}>
              <input
                name="passportNumber"
                required
                inputMode="numeric"
                placeholder="123456"
                value={passportNumber}
                onChange={(event) =>
                  setPassportNumber(digitsOnly(event.target.value).slice(0, PASSPORT_NUMBER_LENGTH))
                }
                className={inputClassWithError(
                  passportNumber.length > 0 && passportNumber.length !== PASSPORT_NUMBER_LENGTH,
                )}
              />
            </Field>
            <Field label="Дата выдачи">
              <input
                name="passportIssuedDate"
                required
                type="date"
                max={today}
                className={fieldClass}
              />
            </Field>
            <Field label="Код подразделения">
              <input
                name="passportDepartmentCode"
                required
                inputMode="numeric"
                placeholder="600-014"
                value={passportDeptCode}
                onChange={(event) => {
                  const digits = digitsOnly(event.target.value).slice(0, 6);
                  setPassportDeptCode(
                    digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits,
                  );
                }}
                className={inputClassWithError(
                  passportDeptCode.length > 0 && digitsOnly(passportDeptCode).length !== 6,
                )}
              />
            </Field>
            <Field label="Кем выдан">
              <input
                name="passportIssuedBy"
                required
                placeholder="УМВД России по Псковской области"
                className={fieldClass}
              />
            </Field>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              required
              className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-xs text-slate-500 leading-relaxed select-none">
              Подтверждаю, что данные внесены с согласия участников собрания и делегата. Согласие
              делегата на обработку персональных данных и видеозапись по № 152-ФЗ он подпишет на
              бумажном бланке из комплекта.
            </span>
          </label>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-lg text-xs text-slate-500">
              После отправки откроется страница вашей заявки с тремя бланками и ссылкой на неё.
              Сохраните ссылку — по ней вы вернётесь догружать подписанные документы.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary inline-flex h-11 items-center justify-center rounded-lg px-8 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {busy ? "Готовим бланки..." : "Составить бланки и получить ссылку"}
            </button>
          </div>
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
