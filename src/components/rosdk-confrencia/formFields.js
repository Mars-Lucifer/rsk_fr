// Общие поля форм собрания: одинаковые классы и проверка Ф.И.О. на всех трёх
// блоках, чтобы правило «три русских слова» не разъезжалось между ними.

// Плейсхолдер и рамку задаёт портальный .modern-input без слоя, поэтому утилиты
// Tailwind перебиваются только через `!`: слой utilities слабее неслоёного css.
// Сохранённый блок показывается тем же бланком, но неактивным: серый фон и
// курсор — единственный признак, по которому это видно.
export const fieldClass =
  "h-10 w-full rounded-md modern-input px-3 text-sm outline-none placeholder:text-slate-500! disabled:bg-slate-100! disabled:text-slate-600! disabled:cursor-default";
export const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700";

/** Подпись под полем: серая, но читаемая — slate-400 на белом почти не виден. */
export const hintClass = "mt-1.5 block text-xs font-medium text-slate-500";

export function inputClassWithError(hasError) {
  return `${fieldClass} ${
    hasError ? "border-rose-500! focus:border-rose-500! focus:ring-rose-100!" : ""
  }`;
}

export function validateFio(value) {
  if (!value) return null;

  const trimmed = value.trim().replace(/\s+/g, " ");
  const parts = trimmed.split(" ");

  // Отчества может не быть — правило совпадает с серверным validateFioServer.
  if (parts.length < 2 || parts.length > 3) {
    return "ФИО должно состоять из 2 или 3 слов (Фамилия Имя Отчество).";
  }

  const nameRegex = /^[а-яё\-]+$/i;
  for (const part of parts) {
    if (!nameRegex.test(part)) {
      return "ФИО должно содержать только русские буквы.";
    }
  }

  return null;
}

export function formatPhone(value) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("7") || digits.startsWith("8")) {
    digits = digits.substring(1);
  }
  digits = digits.substring(0, 10);

  let formatted = "";
  if (digits.length > 0) formatted = `+7 (${digits.substring(0, 3)}`;
  if (digits.length >= 3) formatted += `) ${digits.substring(3, 6)}`;
  if (digits.length >= 6) formatted += `-${digits.substring(6, 8)}`;
  if (digits.length >= 8) formatted += `-${digits.substring(8, 10)}`;

  return formatted;
}
