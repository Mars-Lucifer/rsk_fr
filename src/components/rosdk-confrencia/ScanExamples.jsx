// Самая частая причина возврата пакета — не ошибка в данных, а нечитаемый скан.
// Показываем на схемах, что именно считается годным: текстом это не заходит.

function Frame({ tone, title, children, caption }) {
  const good = tone === "good";

  return (
    <figure
      className={`rounded-xl border p-3 ${
        good ? "border-emerald-200 bg-emerald-50/60" : "border-rose-200 bg-rose-50/60"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${
            good ? "bg-emerald-500" : "bg-rose-500"
          }`}
        >
          {good ? "✓" : "✕"}
        </span>
        <span
          className={`text-xs font-bold ${good ? "text-emerald-900" : "text-rose-900"}`}
        >
          {title}
        </span>
      </div>
      <div className="mt-2 overflow-hidden rounded-lg border border-white bg-white">
        {children}
      </div>
      <figcaption
        className={`mt-2 text-[11px] leading-snug ${
          good ? "text-emerald-900" : "text-rose-900"
        }`}
      >
        {caption}
      </figcaption>
    </figure>
  );
}

const paper = "#f8fafc";
const ink = "#94a3b8";

function TextLines({ x, y, width, count = 6, gap = 9 }) {
  return Array.from({ length: count }, (_, index) => (
    <rect
      key={index}
      x={x}
      y={y + index * gap}
      width={index === count - 1 ? width * 0.55 : width}
      height="3"
      rx="1.5"
      fill={ink}
    />
  ));
}

function Signature({ x, y }) {
  return (
    <path
      d={`M${x} ${y} c 6 -8, 12 6, 18 -2 s 10 -6, 16 3`}
      stroke="#475569"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
  );
}

function GoodScan() {
  return (
    <svg viewBox="0 0 160 110" className="h-28 w-full" role="img" aria-label="Лист целиком в кадре, текст резкий, подпись видна">
      <rect width="160" height="110" fill="#e2e8f0" />
      <rect x="26" y="10" width="108" height="90" rx="3" fill={paper} stroke="#cbd5e1" />
      <rect x="52" y="18" width="56" height="5" rx="2.5" fill="#64748b" />
      <TextLines x={40} y={32} width={80} count={5} />
      <Signature x={44} y={88} />
      <Signature x={92} y={88} />
    </svg>
  );
}

function BadScan() {
  return (
    <svg viewBox="0 0 160 110" className="h-28 w-full" role="img" aria-label="Лист снят под углом, край обрезан, блик от лампы">
      <rect width="160" height="110" fill="#e2e8f0" />
      <g transform="rotate(-8 80 55)">
        <rect x="34" y="16" width="108" height="94" rx="3" fill={paper} stroke="#cbd5e1" />
        <rect x="60" y="24" width="56" height="5" rx="2.5" fill="#64748b" />
        <g opacity="0.55">
          <TextLines x={48} y={38} width={80} count={5} />
        </g>
      </g>
      <ellipse cx="112" cy="52" rx="30" ry="22" fill="#ffffff" opacity="0.75" />
      <rect x="0" y="86" width="160" height="24" fill="#e2e8f0" />
      <text x="80" y="103" textAnchor="middle" fontSize="9" fill="#be123c">
        край не поместился
      </text>
    </svg>
  );
}

function GoodPhoto() {
  return (
    <svg viewBox="0 0 160 110" className="h-28 w-full" role="img" aria-label="Общий план: за столом видно всех участников">
      <rect width="160" height="110" fill="#eef2ff" />
      <rect x="0" y="74" width="160" height="36" fill="#c7d2fe" />
      {[26, 56, 86, 116].map((x) => (
        <g key={x}>
          <circle cx={x} cy="48" r="9" fill="#6366f1" />
          <path d={`M${x - 14} 74 q14 -16 28 0 z`} fill="#818cf8" />
        </g>
      ))}
      <rect x="10" y="76" width="140" height="8" rx="4" fill="#a5b4fc" />
    </svg>
  );
}

function BadPhoto() {
  return (
    <svg viewBox="0 0 160 110" className="h-28 w-full" role="img" aria-label="Селфи одного человека крупным планом">
      <rect width="160" height="110" fill="#eef2ff" />
      <circle cx="80" cy="52" r="34" fill="#6366f1" />
      <path d="M28 110 q52 -46 104 0 z" fill="#818cf8" />
      <text x="80" y="104" textAnchor="middle" fontSize="9" fill="#be123c">
        видно одного
      </text>
    </svg>
  );
}

export function ScanExamples({ open = false }) {
  return (
    <details
      open={open}
      className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-slate-900">
        Как снять документы, чтобы пакет приняли с первого раза
        <span className="text-xs font-semibold text-indigo-600">показать примеры</span>
      </summary>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Frame
          tone="good"
          title="Так нужно"
          caption="Лист целиком, ровно, без бликов. Текст и подписи читаются, печать видна."
        >
          <GoodScan />
        </Frame>
        <Frame
          tone="bad"
          title="Так вернём"
          caption="Снято под углом, обрезан край, блик от лампы. Подпись и реквизиты не прочитать."
        >
          <BadScan />
        </Frame>
        <Frame
          tone="good"
          title="Фото собрания — так нужно"
          caption="Общий план, участников можно пересчитать: число на фото сходится с явочным листом."
        >
          <GoodPhoto />
        </Frame>
        <Frame
          tone="bad"
          title="Фото собрания — так вернём"
          caption="Селфи или пустая комната: подтвердить собрание по такому кадру нельзя."
        >
          <BadPhoto />
        </Frame>
      </div>

      <ul className="mt-4 grid gap-1.5 text-xs leading-relaxed text-slate-600 sm:grid-cols-2">
        <li>Снимайте при дневном свете, а не под настольной лампой — она даёт блик.</li>
        <li>Многостраничный документ — одним PDF, страницы по порядку.</li>
        <li>Паспорт: главная страница и страница регистрации, оба разворота целиком.</li>
        <li>Ничего не закрывайте пальцем и не обрезайте поля листа.</li>
        <li>Подписи — синей ручкой, от руки. Скан подписанного, а не пустого бланка.</li>
        <li>До 25 МБ на файл: если больше — снимите в JPG или уменьшите разрешение.</li>
      </ul>
    </details>
  );
}
