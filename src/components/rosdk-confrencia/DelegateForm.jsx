import { useMemo, useState } from "react";
import {
  PASSPORT_NUMBER_LENGTH,
  PASSPORT_SERIES_LENGTH,
  digitsOnly,
} from "@/lib/rosdk-confrencia/validation";
import { Combobox, RegionCombobox } from "./Combobox";
import {
  fieldClass,
  formatPhone,
  hintClass,
  inputClassWithError,
  labelClass,
  validateFio,
} from "./formFields";

/**
 * Блок 2 собрания: избранный делегат. Из него собирается согласие.
 * Заявки может ещё не быть — тогда данные уходят в черновик и отправятся
 * вместе с регистрацией: блоки заполняются в любом порядке.
 */
export function DelegateForm({
  submission,
  region = null,
  readOnly = false,
  onSaved,
  onCancel,
  onDraft,
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Сохранённые поля возвращаются в форму: блок остаётся тем же бланком.
  const saved = submission?.delegateFields ?? {};

  const [delegateName, setDelegateName] = useState(submission?.delegateName ?? "");
  const [phone, setPhone] = useState(formatPhone(submission?.delegatePhone ?? ""));
  const [passportSeries, setPassportSeries] = useState(saved.passportSeries ?? "");
  const [passportNumber, setPassportNumber] = useState(saved.passportNumber ?? "");
  const [deptCode, setDeptCode] = useState(saved.passportDepartmentCode ?? "");
  const [postalCode, setPostalCode] = useState(saved.addressPostalCode ?? "");
  const [addressRegion, setAddressRegion] = useState(saved.addressRegion ?? "");
  const [addressRegionEdited, setAddressRegionEdited] = useState(Boolean(saved.addressRegion));

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const fioError = useMemo(() => validateFio(delegateName), [delegateName]);

  // Делегат — из тех, кто был на собрании: паспорт и телефон уже введены в блоке 1.
  const attendees = submission?.attendees ?? [];
  const attendeeNames = attendees.map((item) => item.fullName).filter(Boolean);

  const chooseDelegate = (name) => {
    setDelegateName(name);

    const found = attendees.find((item) => item.fullName === name);
    if (!found) return;

    if (found.passportSeries) setPassportSeries(found.passportSeries);
    if (found.passportNumber) setPassportNumber(found.passportNumber);
    if (found.phone) setPhone(formatPhone(found.phone));
  };
  // Субъект отделения известен и до создания заявки — из персональной ссылки.
  // Пока его не правили руками, он и стоит в адресе регистрации делегата.
  const branchRegion = submission?.region ?? region ?? "";
  const effectiveAddressRegion = addressRegionEdited ? addressRegion : branchRegion;

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const fail = (message) => {
      setError(message);
      setBusy(false);
    };

    if (fioError) return fail("Ф.И.О. делегата: два или три русских слова.");
    if (digitsOnly(phone).length !== 11) return fail("Телефон делегата — 11 цифр.");
    if (
      passportSeries.length !== PASSPORT_SERIES_LENGTH ||
      passportNumber.length !== PASSPORT_NUMBER_LENGTH
    ) {
      return fail(
        `Паспорт: серия — ${PASSPORT_SERIES_LENGTH} цифры, номер — ${PASSPORT_NUMBER_LENGTH} цифр.`
      );
    }
    if (digitsOnly(deptCode).length !== 6) return fail("Код подразделения — 6 цифр.");
    if (postalCode.length !== 6) return fail("Почтовый индекс — 6 цифр.");

    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      payload.step = "delegate";
      payload.delegatePhone = phone;
      payload.passportSeries = passportSeries;
      payload.passportNumber = passportNumber;
      payload.passportDepartmentCode = deptCode;
      payload.addressPostalCode = postalCode;
      payload.addressRegion = effectiveAddressRegion;

      if (!submission) {
        onDraft(payload);
        setBusy(false);
        return;
      }

      const response = await fetch(`/api/conferencia/submissions/${submission.id}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) return fail(result.error || "Не удалось сохранить данные делегата.");

      onSaved(result.submission);
    } catch {
      fail("Не удалось связаться с сервером. Попробуйте ещё раз.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Сохранённый блок остаётся тем же бланком, только неактивным. */}
      <fieldset disabled={readOnly} className="space-y-5">
        <p className="max-w-3xl text-sm text-slate-500">
          Второй вопрос повестки. По этим контактам Оргкомитет пришлёт подключение к Конференции, а
          по паспорту опознает делегата при входе в эфир — проверьте данные внимательно.
        </p>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Ф.И.О. делегата" required>
            {attendeeNames.length > 0 ? (
              <Combobox
                name="delegateName"
                options={attendeeNames}
                value={delegateName}
                onChange={chooseDelegate}
                readOnlyInput
                placeholder="Выберите из присутствующих"
                inputClassName={inputClassWithError(fioError)}
              />
            ) : (
              <input
                name="delegateName"
                required
                placeholder="Иванов Иван Иванович"
                value={delegateName}
                onChange={(event) => setDelegateName(event.target.value)}
                className={inputClassWithError(fioError)}
              />
            )}
            {fioError && (
              <span className="mt-1.5 block text-xs font-semibold text-rose-600">{fioError}</span>
            )}
          </Field>

          <Field label="Телефон делегата" required>
            <input
              name="delegatePhone"
              required
              type="tel"
              placeholder="+7 (900) 000-00-00"
              value={phone}
              onChange={(event) => setPhone(formatPhone(event.target.value))}
              className={fieldClass}
            />
          </Field>

          <Field label="E-mail делегата" required>
            <input
              name="delegateEmail"
              required
              type="email"
              defaultValue={submission?.delegateEmail ?? ""}
              placeholder="delegate@example.ru"
              className={fieldClass}
            />
          </Field>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h4 className="text-sm font-bold text-slate-900">Паспорт делегата</h4>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Field label="Серия" required>
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
                  passportSeries.length > 0 && passportSeries.length !== PASSPORT_SERIES_LENGTH
                )}
              />
            </Field>
            <Field label="Номер" required>
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
                  passportNumber.length > 0 && passportNumber.length !== PASSPORT_NUMBER_LENGTH
                )}
              />
            </Field>
            <Field label="Дата выдачи" required>
              <input
                name="passportIssuedDate"
                required
                defaultValue={saved.passportIssuedDate ?? ""}
                type="date"
                max={today}
                className={fieldClass}
              />
            </Field>
            <Field label="Код подразделения" required>
              <input
                name="passportDepartmentCode"
                required
                inputMode="numeric"
                placeholder="600-014"
                value={deptCode}
                onChange={(event) => {
                  const digits = digitsOnly(event.target.value).slice(0, 6);
                  setDeptCode(
                    digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits
                  );
                }}
                className={inputClassWithError(
                  deptCode.length > 0 && digitsOnly(deptCode).length !== 6
                )}
              />
            </Field>
            <Field label="Кем выдан" required>
              <input
                name="passportIssuedBy"
                defaultValue={saved.passportIssuedBy ?? ""}
                required
                placeholder="УМВД России по Псковской области"
                className={fieldClass}
              />
            </Field>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h4 className="text-sm font-bold text-slate-900">Адрес регистрации</h4>
          <p className="mt-1 text-xs text-slate-600">Как в паспорте, по строке регистрации.</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Почтовый индекс" required>
              <input
                name="addressPostalCode"
                required
                inputMode="numeric"
                placeholder="180000"
                value={postalCode}
                onChange={(event) => setPostalCode(digitsOnly(event.target.value).slice(0, 6))}
                className={inputClassWithError(postalCode.length > 0 && postalCode.length !== 6)}
              />
            </Field>
            <Field label="Субъект РФ, край или область" className="xl:col-span-2" required>
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
              <span className={hintClass}>
                {addressRegionEdited
                  ? "Задан вручную."
                  : branchRegion
                    ? "Подставлен из субъекта отделения — измените, если делегат прописан в другом регионе."
                    : "Выберите субъект из списка — как в паспорте."}
              </span>
            </Field>
            <Field label="Район">
              <input
                name="addressDistrict"
                defaultValue={saved.addressDistrict ?? ""}
                placeholder="Печорский район, если есть"
                className={fieldClass}
              />
            </Field>
            <Field label="Город или населённый пункт" required>
              <input
                name="addressSettlement"
                defaultValue={saved.addressSettlement ?? ""}
                required
                placeholder="г. Псков"
                className={fieldClass}
              />
            </Field>
            <Field label="Улица" required>
              <input
                name="addressStreet"
                defaultValue={saved.addressStreet ?? ""}
                required
                placeholder="Советская"
                className={fieldClass}
              />
            </Field>
            <Field label="Дом" required>
              <input
                name="addressHouse"
                defaultValue={saved.addressHouse ?? ""}
                required
                placeholder="5"
                className={fieldClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Корпус">
                <input
                  name="addressBuilding"
                  defaultValue={saved.addressBuilding ?? ""}
                  placeholder="—"
                  className={fieldClass}
                />
              </Field>
              <Field label="Квартира">
                <input
                  name="addressFlat"
                  defaultValue={saved.addressFlat ?? ""}
                  placeholder="12"
                  className={fieldClass}
                />
              </Field>
            </div>
          </div>
        </div>
      </fieldset>

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
              : submission
                ? "Сохранить и получить согласие"
                : "Сохранить данные делегата"}
          </button>
        </div>
      )}
    </form>
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
