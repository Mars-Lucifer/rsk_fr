// Пример годного кадра. Самая частая причина возврата пакета — не ошибка в данных,
// а фото, по которому собрание не подтвердить: селфи, пустая комната, половина зала.
//
// По умолчанию рисуем схему: она не зависит от файлов и не ломается, если картинку
// не положили. Реальный кадр подхватывается сам, стоит положить его в
// `public/conferencia/photo-example.jpg` — страница проверяет файл на сервере.

import Image from "next/image";

const RULES = [
  "Общий план: видно всех участников, их можно пересчитать",
  "Число людей на фото сходится с явочным листом",
  "Снимайте до того, как участники начнут расходиться",
];

export function PhotoExample({ photo = false }) {
  return (
    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
      <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {photo ? (
          <Image
            src="/conferencia/photo-example.jpg"
            alt="Пример: участники собрания за общим столом, в кадре все"
            width={440}
            height={294}
            className="h-32 w-full object-cover"
          />
        ) : (
          <MeetingShot />
        )}
      </figure>

      <div>
        <p className="text-sm font-bold text-slate-900">Каким должно быть фото</p>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600">
          {RULES.map((rule) => (
            <li key={rule} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Схема нужного кадра: стол, люди с двух сторон, все в рамке. */
function MeetingShot() {
  return (
    <svg
      viewBox="0 0 160 110"
      className="h-32 w-full"
      role="img"
      aria-label="Общий план: участники за столом переговоров, видно всех"
    >
      <rect width="160" height="110" fill="#eef2ff" />
      <rect x="6" y="12" width="26" height="30" rx="2" fill="#ffffff" stroke="#c7d2fe" />
      <rect x="124" y="8" width="30" height="42" rx="2" fill="#dbeafe" stroke="#bfdbfe" />
      <path d="M139 8v42M124 29h30" stroke="#bfdbfe" />

      {[52, 74, 96].map((x) => (
        <g key={`far-${x}`}>
          <circle cx={x} cy="44" r="7" fill="#6366f1" />
          <path d={`M${x - 11} 62 q11 -13 22 0 z`} fill="#818cf8" />
        </g>
      ))}

      <path d="M14 64h132l14 30H0z" fill="#e2c9a0" />
      <path d="M20 68h120l10 20H10z" fill="#eeddc0" />
      <rect x="66" y="72" width="28" height="10" rx="1" fill="#ffffff" />

      {[34, 68, 102, 132].map((x) => (
        <g key={`near-${x}`}>
          <circle cx={x} cy="96" r="9" fill="#4338ca" />
          <path d={`M${x - 15} 110 q15 -14 30 0 z`} fill="#4f46e5" />
        </g>
      ))}
    </svg>
  );
}
