import { useMemo, useState } from "react";
import { regions } from "@/lib/rosdk-confrencia/regions";

const fieldClass =
  "h-10 w-full rounded-md modern-input px-3 text-sm outline-none";
const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700";

function validateFio(value) {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  const parts = trimmed.split(" ");
  if (parts.length !== 3) {
    return "ФИО должно состоять ровно из 3 слов (Фамилия Имя Отчество).";
  }
  // Check that all parts contain only Russian letters and hyphens
  const nameRegex = /^[а-яё\-]+$/i;
  for (const part of parts) {
    if (!nameRegex.test(part)) {
      return "ФИО должно содержать только русские буквы.";
    }
  }
  return null;
}

export function PublicSubmissionForm() {
  const [submission, setSubmission] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  
  // Default numeric values to 3
  const [presentMembers, setPresentMembers] = useState(3);
  const [totalMembers, setTotalMembers] = useState(3);
  const [votesFor, setVotesFor] = useState(3);

  // Focus dropdown states
  const [showPresentDropdown, setShowPresentDropdown] = useState(false);
  const [showTotalDropdown, setShowTotalDropdown] = useState(false);
  const [showVotesDropdown, setShowVotesDropdown] = useState(false);

  // Custom region search states
  const [regionSearch, setRegionSearch] = useState("");
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);

  // States for form validation and formatting
  const [delegateName, setDelegateName] = useState("");
  const [delegatePhone, setDelegatePhone] = useState("");
  const [chairName, setChairName] = useState("");
  const [secretaryName, setSecretaryName] = useState("");
  
  const [passportSeries, setPassportSeries] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [passportDeptCode, setPassportDeptCode] = useState("");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Validation warnings
  const minimumVotes = presentMembers > 0 ? Math.ceil((presentMembers * 2) / 3) : 0;
  const hasVoteWarning = presentMembers > 0 && votesFor > 0 && votesFor < minimumVotes;
  
  const requiredQuorum = Math.ceil((totalMembers * 2) / 3);
  const hasQuorumWarning = totalMembers > 0 && presentMembers > 0 && presentMembers < requiredQuorum;

  const hasExcessMembersWarning = totalMembers > 0 && presentMembers > 0 && presentMembers > totalMembers;
  const hasExcessVotesWarning = presentMembers > 0 && votesFor > 0 && votesFor > presentMembers;

  const delegateFioError = useMemo(() => validateFio(delegateName), [delegateName]);
  const chairFioError = useMemo(() => validateFio(chairName), [chairName]);
  const secretaryFioError = useMemo(() => validateFio(secretaryName), [secretaryName]);

  const filteredRegions = useMemo(() => {
    const q = regionSearch.trim().toLowerCase();
    if (!q) return regions;
    return regions.filter((r) => r.toLowerCase().includes(q));
  }, [regionSearch]);

  const numericOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Helper to handle and format number inputs: no leading zero, no lone zero
  const handleNumericChange = (setter) => (e) => {
    let val = e.target.value;
    if (val.length > 1 && val.startsWith("0")) {
      val = val.replace(/^0+/, "");
    }
    if (val === "0") {
      val = "";
    }
    setter(val === "" ? "" : Number(val));
  };

  // Phone input auto-formatter (+7 (XXX) XXX-XX-XX)
  const handlePhoneChange = (e) => {
    let val = e.target.value;

    // If user deleted character(s)
    if (val.length < delegatePhone.length) {
      let oldDigits = delegatePhone.replace(/\D/g, "");
      let newDigits = val.replace(/\D/g, "");
      // If the number of digits is the same, it means a formatting character (like '-', ')' or space) was deleted.
      // In this case, we manually delete the last digit.
      if (oldDigits.length === newDigits.length && newDigits.length > 0) {
        newDigits = newDigits.slice(0, -1);
      }
      let digits = newDigits;
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
      setDelegatePhone(formatted);
      return;
    }

    // Default formatting logic for typing
    let digits = val.replace(/\D/g, "");
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
    setDelegatePhone(formatted);
  };

  const handleSeriesChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").substring(0, 4);
    setPassportSeries(val);
  };

  const handlePassportNumberChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").substring(0, 6);
    setPassportNumber(val);
  };

  const handleDeptCodeChange = (e) => {
    let val = e.target.value.replace(/\D/g, "").substring(0, 6);
    if (val.length > 3) {
      val = val.substring(0, 3) + "-" + val.substring(3);
    }
    setPassportDeptCode(val);
  };

  const inputClassWithError = (hasError) => 
    `${fieldClass} ${hasError ? "border-rose-500! focus:border-rose-500! focus:ring-rose-100!" : ""}`;

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    // Final checks
    if (hasExcessMembersWarning) {
      setError("Присутствовало членов не может быть больше, чем всего членов отделения.");
      setBusy(false);
      return;
    }

    if (hasExcessVotesWarning) {
      setError("Голосов за не может быть больше, чем присутствовало членов.");
      setBusy(false);
      return;
    }

    if (hasQuorumWarning) {
      setError(`Собрание нелегитимно. Должно присутствовать не менее 2/3 членов (минимум ${requiredQuorum}).`);
      setBusy(false);
      return;
    }

    if (hasVoteWarning) {
      setError(`Недостаточно голосов. За делегата должно проголосовать не менее 2/3 присутствующих (минимум ${minimumVotes}).`);
      setBusy(false);
      return;
    }

    if (delegateFioError || chairFioError || secretaryFioError) {
      setError("Пожалуйста, исправьте ошибки в ФИО (должно быть 3 русских слова).");
      setBusy(false);
      return;
    }

    const phoneDigits = delegatePhone.replace(/\D/g, "");
    if (phoneDigits.length !== 11) {
      setError("Номер телефона должен содержать 11 цифр.");
      setBusy(false);
      return;
    }

    if (passportSeries.length !== 4 || passportNumber.length !== 6) {
      setError("Серия паспорта должна состоять из 4 цифр, а номер — из 6.");
      setBusy(false);
      return;
    }

    if (passportDeptCode.replace("-", "").length !== 6) {
      setError("Код подразделения должен состоять из 6 цифр.");
      setBusy(false);
      return;
    }

    try {
      const form = new FormData(event.currentTarget);
      const payload = Object.fromEntries(form.entries());
      
      // Sync numerical and validated states
      payload.presentMembers = presentMembers;
      payload.totalMembers = totalMembers;
      payload.votesFor = votesFor;
      payload.delegatePhone = delegatePhone;
      payload.passportSeries = passportSeries;
      payload.passportNumber = passportNumber;
      payload.passportDepartmentCode = passportDeptCode;

      const response = await fetch("/api/conferencia/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не удалось создать протокол.");
        return;
      }

      setSubmission(result.submission);
    } catch (err) {
      setError("Не удалось связаться с сервером. Проверьте подключение и попробуйте еще раз.");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(event) {
    event.preventDefault();
    if (!submission) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch(`/api/conferencia/submissions/${submission.id}/upload`, {
        method: "POST",
        body: form,
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Не удалось загрузить файлы.");
        return;
      }

      setSubmission(result.submission);
      setSuccess("Документы и фотография успешно загружены.");
    } catch (err) {
      setError("Не удалось загрузить файлы. Проверьте подключение и попробуйте еще раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8 bg-white border border-slate-200 text-slate-800 space-y-6">
      <form onSubmit={onSubmit} className="space-y-6">
        {/* Step 2 Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider">
              Шаг 2
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-wide">Заполните протокол собрания</h2>
          </div>
        </div>

        {/* Input fields */}
        <div className="grid gap-4 xl:grid-cols-3">
          {/* Custom Autocomplete Region Selector */}
          <div className="relative">
            <Field label="Субъект РФ">
              <input
                type="text"
                name="region"
                required
                autoComplete="off"
                placeholder="Выберите регион РФ"
                value={regionSearch}
                onChange={(e) => {
                  setRegionSearch(e.target.value);
                  setShowRegionDropdown(true);
                }}
                onFocus={() => setShowRegionDropdown(true)}
                onBlur={() => {
                  setTimeout(() => setShowRegionDropdown(false), 200);
                }}
                className={fieldClass}
              />
            </Field>
            {showRegionDropdown && filteredRegions.length > 0 && (
              <ul className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1.5 shadow-lg z-30 divide-y divide-slate-50">
                {filteredRegions.map((region) => (
                  <li
                    key={region}
                    onMouseDown={() => {
                      setRegionSearch(region);
                      setShowRegionDropdown(false);
                    }}
                    className="cursor-pointer px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors"
                  >
                    {region}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Field label="Город">
            <input name="city" required placeholder="Например, Москва" className={fieldClass} />
          </Field>
          <Field label="Дата проведения">
            <input name="meetingDate" required type="date" max={today} defaultValue={today} className={fieldClass} />
          </Field>

          {/* Autocomplete-like Number Selector for "Всего членов отделения" */}
          <div className="relative">
            <Field label="Всего членов отделения">
              <input
                name="totalMembers"
                required
                type="number"
                min="1"
                value={totalMembers}
                onChange={handleNumericChange(setTotalMembers)}
                onFocus={() => setShowTotalDropdown(true)}
                onBlur={() => {
                  setTimeout(() => setShowTotalDropdown(false), 200);
                }}
                className={inputClassWithError(hasExcessMembersWarning)}
              />
            </Field>
            {showTotalDropdown && (
              <ul className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg z-30 divide-y divide-slate-50">
                {numericOptions.map((num) => (
                  <li
                    key={num}
                    onMouseDown={() => {
                      setTotalMembers(num);
                      setShowTotalDropdown(false);
                    }}
                    className="cursor-pointer px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors"
                  >
                    {num}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Autocomplete-like Number Selector for "Присутствовало членов" */}
          <div className="relative">
            <Field label="Присутствовало членов">
              <input
                name="presentMembers"
                required
                type="number"
                min="1"
                value={presentMembers}
                onChange={handleNumericChange(setPresentMembers)}
                onFocus={() => setShowPresentDropdown(true)}
                onBlur={() => {
                  setTimeout(() => setShowPresentDropdown(false), 200);
                }}
                className={inputClassWithError(hasQuorumWarning || hasExcessMembersWarning)}
              />
            </Field>
            {showPresentDropdown && (
              <ul className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg z-30 divide-y divide-slate-50">
                {numericOptions.map((num) => (
                  <li
                    key={num}
                    onMouseDown={() => {
                      setPresentMembers(num);
                      setShowPresentDropdown(false);
                    }}
                    className="cursor-pointer px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors"
                  >
                    {num}
                  </li>
                ))}
              </ul>
            )}
            {hasQuorumWarning && !hasExcessMembersWarning && (
              <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                Кворум не достигнут (нужно минимум 2/3, т.е. {requiredQuorum}).
              </span>
            )}
            {hasExcessMembersWarning && (
              <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                Присутствовало членов не может быть больше, чем членов отделения.
              </span>
            )}
          </div>

          {/* Autocomplete-like Number Selector for "Голосов за" */}
          <div className="relative">
            <Field label="Голосов за">
              <input
                name="votesFor"
                required
                type="number"
                min="1"
                value={votesFor}
                onChange={handleNumericChange(setVotesFor)}
                onFocus={() => setShowVotesDropdown(true)}
                onBlur={() => {
                  setTimeout(() => setShowVotesDropdown(false), 200);
                }}
                className={inputClassWithError(hasVoteWarning || hasExcessVotesWarning)}
              />
            </Field>
            {showVotesDropdown && (
              <ul className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg z-30 divide-y divide-slate-50">
                {numericOptions.map((num) => (
                  <li
                    key={num}
                    onMouseDown={() => {
                      setVotesFor(num);
                      setShowVotesDropdown(false);
                    }}
                    className="cursor-pointer px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors"
                  >
                    {num}
                  </li>
                ))}
              </ul>
            )}
            {hasVoteWarning && !hasExcessVotesWarning && (
              <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                Нужно минимум {minimumVotes} голосов: не меньше 2/3 от присутствующих.
              </span>
            )}
            {hasExcessVotesWarning && (
              <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                Голосов за не может быть больше, чем присутствовало членов.
              </span>
            )}
          </div>

          <Field label="ФИО делегата">
            <input
              name="delegateName"
              required
              placeholder="Иванов Иван Иванович"
              value={delegateName}
              onChange={(e) => setDelegateName(e.target.value)}
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
              onChange={handlePhoneChange}
              className={fieldClass}
            />
          </Field>
          <div />

          <Field label="Председатель собрания">
            <input
              name="chairName"
              required
              placeholder="Иванов Иван Иванович"
              value={chairName}
              onChange={(e) => setChairName(e.target.value)}
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
              onChange={(e) => setSecretaryName(e.target.value)}
              className={inputClassWithError(secretaryFioError)}
            />
            {secretaryFioError && (
              <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                {secretaryFioError}
              </span>
            )}
          </Field>
        </div>

        {/* Passport fields */}
        <div className="border-t border-slate-100 pt-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
            Паспортные данные делегата
          </h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Field label="Серия">
              <input
                name="passportSeries"
                required
                inputMode="numeric"
                placeholder="0000"
                value={passportSeries}
                onChange={handleSeriesChange}
                className={fieldClass}
              />
            </Field>
            <Field label="Номер">
              <input
                name="passportNumber"
                required
                inputMode="numeric"
                placeholder="000000"
                value={passportNumber}
                onChange={handlePassportNumberChange}
                className={fieldClass}
              />
            </Field>
            <Field label="Дата выдачи">
              <input name="passportIssuedDate" required type="date" max={today} className={fieldClass} />
            </Field>
            <Field label="Код подразделения">
              <input
                name="passportDepartmentCode"
                required
                placeholder="000-000"
                value={passportDeptCode}
                onChange={handleDeptCodeChange}
                className={fieldClass}
              />
            </Field>
            <Field label="Кем выдан" className="md:col-span-2 xl:col-span-1">
              <input name="passportIssuedBy" required className={fieldClass} />
            </Field>
          </div>
        </div>

        {/* Legal compliance check and submit button */}
        <div className="border-t border-slate-100 pt-5 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              required
              className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-xs text-slate-500 leading-relaxed select-none">
              Согласен на обработку персональных данных (ФИО, телефон, паспортные данные) в соответствии с Федеральным законом № 152-ФЗ «О персональных данных» для целей подготовки конференции и делегирования.
            </span>
          </label>

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

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary inline-flex h-11 items-center justify-center rounded-lg px-8 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {busy ? "Обработка..." : "Сгенерировать протокол"}
            </button>
          </div>
        </div>
      </form>

      {/* Step 3 Form */}
      {submission && (
        <div className="mt-6 border-t border-slate-100 pt-6 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-900">Загрузка печатной версии</h2>
              <p className="mt-1 text-sm text-slate-500">Скачайте заполненный протокол в формате DOCX, распечатайте и подпишите его ручкой.</p>
            </div>
            <a
              href={`/api/conferencia/submissions/${submission.id}/document`}
              className="file-link px-5 py-2.5 h-11 text-white border-indigo-600 bg-indigo-600 hover:bg-indigo-700 font-bold hover:text-white"
            >
              Скачать DOCX
            </a>
          </div>

          <form onSubmit={onUpload} className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-100">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider">
                Шаг 3
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">Отправьте подписанный протокол и фото</h2>
              <p className="text-sm text-slate-500">Прикрепите подписанный протокол (скан в PDF или фото/скан в JPG/PNG) и фотографию с проведенной конференции.</p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Фото / скан подписанного протокола">
                <input
                  name="file"
                  required
                  type="file"
                  accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
                  className="block w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 transition cursor-pointer"
                />
              </Field>
              <Field label="Фото / скриншот с собрания конференции">
                <input
                  name="photo"
                  required
                  type="file"
                  accept="image/*"
                  className="block w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 transition cursor-pointer"
                />
              </Field>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={busy}
                className="btn-primary inline-flex h-11 items-center justify-center rounded-lg px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {busy ? "Загрузка файлов..." : "Отправить подписанные документы"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  className,
  children,
}) {
  return (
    <label className={className}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}
