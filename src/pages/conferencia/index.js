import Image from "next/image";
import { PublicSubmissionForm } from "@/components/rosdk-confrencia/PublicSubmissionForm";

export default function Home() {
  return (
    <main className="min-h-screen text-slate-800 bg-[#f4f6fa] pb-16">
      {/* Header section */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-5 py-5 sm:px-8">
          <Image
            src="/rsk-logo.png"
            alt="Российское содружество колледжей"
            width={240}
            height={98}
            priority
            className="h-auto w-32 shrink-0 sm:w-40"
          />
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Подготовка конференции
            </p>
            <p className="!text-sm !font-bold tracking-tight text-slate-900 sm:!text-lg whitespace-nowrap">
              Сбор протоколов региональных отделений
            </p>
          </div>
        </div>
      </section>

      {/* Main flow */}
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 space-y-8">
        
        {/* Шаг 1. Проведите конференцию */}
        <section className="glass-card rounded-2xl p-6 sm:p-8 bg-white border border-slate-200">
          <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider">
                Шаг 1
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">Проведите конференцию регионального отделения</h2>
              <div className="text-sm text-slate-600 space-y-3 leading-relaxed">
                <p>
                  Для выбора делегата на конференцию Российского содружества колледжей необходимо провести собрание членов вашего регионального отделения.
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Убедитесь в наличии кворума (не менее 2/3 членов отделения).</li>
                  <li>Проведите открытое голосование по выбору делегата.</li>
                  <li>Решение принимается большинством голосов (не менее 2/3 от присутствующих).</li>
                  <li><strong>Сделайте общее отчетное фото участников собрания</strong> (оно потребуется на шаге 3).</li>
                </ul>
              </div>
            </div>
            
            {/* Пример фото */}
            <div className="space-y-3 flex flex-col justify-between">
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Примеры правильных фотографий</span>
                <div className="flex flex-col gap-3">
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 h-28">
                    <Image
                      src="/images/conference_example_1.png"
                      alt="Пример фото собрания 1"
                      fill
                      sizes="(max-width: 768px) 100vw, 30vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 h-28">
                    <Image
                      src="/images/conference_example_2.png"
                      alt="Пример фото собрания 2"
                      fill
                      sizes="(max-width: 768px) 100vw, 30vw"
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 italic">На фотографии должно быть четко видно присутствующих участников собрания.</p>
            </div>
          </div>
        </section>

        {/* Public Form (Шаг 2 и Шаг 3 внутри) */}
        <PublicSubmissionForm />

      </div>
    </main>
  );
}
