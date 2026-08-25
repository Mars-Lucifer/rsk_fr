// Пакет собран — единственный момент, когда отделению нужно сказать что-то важное:
// работа закончена, а делегату дальше идти в чат делегатов. Отсюда и окно: строчка
// внизу страницы этого не добивалась.

import { useState } from "react";
import { QrCard } from "./QrCard";
import { CheckIcon } from "./icons";

export function SuccessDialog({ complete, delegateName, qr, delegatesLink }) {
  // Закрыли — до перезагрузки не возвращаем: пакет собирается один раз.
  const [closed, setClosed] = useState(false);

  if (!complete || closed) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Пакет документов собран"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 px-5 py-8"
      onClick={(event) => event.target === event.currentTarget && setClosed(true)}
    >
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="!text-lg !font-extrabold text-slate-900">Пакет документов собран</h2>
            <p className="text-sm text-slate-500">Оргкомитет видит его в реестре отделений.</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Больше от отделения ничего не требуется. Передайте этот QR делегату
          {delegateName ? ` — ${delegateName}` : ""}: в чате делегатов Оргкомитет присылает
          подключение к Конференции и отвечает на вопросы.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <QrCard
            title="Чат делегатов"
            hint="Только для избранного делегата"
            svg={qr?.delegates}
            href={delegatesLink}
            logo={qr?.logo}
          />
          <p className="min-w-40 flex-1 text-xs leading-relaxed text-slate-500">
            Наведите камеру телефона на код или откройте ссылку под ним. Если делегата нет рядом —
            перешлите ему ссылку, она не меняется.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setClosed(true)}
          className="btn-primary mt-6 inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-white"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
