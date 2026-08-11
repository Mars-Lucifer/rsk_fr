const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

function parseIsoDate(value) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** «05» июня 2026 — форма даты, принятая в бланках протоколов. */
export function formatLongDate(value) {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return value;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  return `«${day}» ${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

/** 05.06.2026 — форма даты для реквизитов и реестра. */
export function formatShortDate(value) {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return value;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${parsed.getFullYear()}`;
}
