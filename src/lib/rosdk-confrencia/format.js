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

// Справочник хранит субъекты в именительном падеже, а в бланке нужен
// предложный: «Регионального отделения в Псковской области». Все 89 названий
// закрываются четырьмя типами окончаний, поэтому обходимся правилами, а не
// вторым справочником, который придётся держать в синхроне.
const REGION_NOUNS = {
  область: "области",
  Республика: "Республике",
  край: "крае",
  округ: "округе",
};

/** Прилагательное перед типом субъекта: «Псковская» -> «Псковской». */
function adjectiveInPrepositional(word) {
  if (/ая$/.test(word)) return word.replace(/ая$/, "ой");
  if (/(ий|ый)$/.test(word)) return word.replace(/(ий|ый)$/, "ом");
  return word;
}

/** «Псковская область» -> «Псковской области». Для строки «в <субъекте>». */
export function regionInPrepositional(region) {
  const value = String(region ?? "").trim();

  if (value.startsWith("город федерального значения ")) {
    return value.replace("город федерального значения ", "городе федерального значения ");
  }

  // «Кемеровская область — Кузбасс»: склоняем до тире, второе имя не трогаем.
  const dash = value.indexOf(" — ");
  if (dash > 0) {
    return `${regionInPrepositional(value.slice(0, dash))}${value.slice(dash)}`;
  }

  // «Республика Калмыкия»: склоняется только тип, само название остаётся.
  if (value.startsWith("Республика ")) {
    return value.replace("Республика ", "Республике ");
  }

  const words = value.split(" ");
  const noun = REGION_NOUNS[words[words.length - 1]];

  if (!noun) {
    // Ненайденный тип названия лучше напечатать как есть, чем исказить.
    return value;
  }

  return [...words.slice(0, -1).map(adjectiveInPrepositional), noun].join(" ");
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
