// QR рисует сервер (пакет `qrcode` уже стоит), сюда приходит готовый SVG: в
// клиентский бандл генератор тянуть незачем, ссылки известны заранее.
//
// В центре кода — белое окно под логотип MAX. Уровень коррекции H держит до 30%
// потерь, так что перекрытие безопасно. Файл логотипа кладётся в
// `public/conferencia/max-logo.png`; пока его нет, окно просто не рисуется.

export function QrCard({ title, hint, svg, href, logo = false }) {
  return (
    <figure className="flex w-44 shrink-0 flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-center">
      <span className="relative block h-24 w-24">
        {svg ? (
          <>
            <span
              className="block h-24 w-24 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            {logo && (
              <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg bg-white p-0.5 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/conferencia/max-logo.png" alt="" className="h-full w-full rounded-md" />
              </span>
            )}
          </>
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 text-[11px] font-semibold leading-snug text-slate-500">
            появится позже
          </span>
        )}
      </span>

      <figcaption className="space-y-0.5">
        <span className="block whitespace-nowrap text-xs font-bold text-slate-900">{title}</span>
        {hint && <span className="block whitespace-nowrap text-[11px] text-slate-500">{hint}</span>}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
          >
            открыть ссылкой
          </a>
        )}
      </figcaption>
    </figure>
  );
}
