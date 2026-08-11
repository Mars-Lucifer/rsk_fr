import Head from "next/head";
import Image from "next/image";
import { PublicSubmissionForm } from "@/components/rosdk-confrencia/PublicSubmissionForm";
import { CONFERENCE_DATE, SUBMISSION_COOKIE } from "@/lib/rosdk-confrencia/slots";

/** Ссылку на заявку легко потерять — держим последний id в кукисе как подсказку. */
export async function getServerSideProps(context) {
  return {
    props: {
      submissionId: context.req.cookies?.[SUBMISSION_COOKIE] ?? "",
    },
  };
}

function ResumeBanner({ submissionId }) {
  if (!submissionId) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
      <p className="text-sm text-amber-900">
        С этого устройства уже создавали заявку. Продолжить загрузку документов, не заполняя форму
        заново?
      </p>
      <a
        href={`/conferencia/${submissionId}`}
        className="file-link h-10 px-4 text-xs font-bold border-amber-300 bg-white text-amber-800 hover:bg-amber-100 hover:text-amber-900"
      >
        Открыть мою заявку
      </a>
    </div>
  );
}

export default function Home({ submissionId }) {
  return (
    <main className="min-h-screen text-slate-800 bg-[#f4f6fa] pb-16">
      <Head>
        <title>Пакет документов от РО — Конференция Российского содружества колледжей</title>
        <meta
          name="description"
          content="Региональное отделение проводит собрание, выбирает делегата и отправляет пакет документов в Оргкомитет Конференции: протокол, явочный лист, согласие и копию паспорта."
        />
        <meta
          property="og:title"
          content="Пакет документов от регионального отделения — Конференция РСК"
        />
        <meta
          property="og:description"
          content="Заполните данные собрания, скачайте три готовых бланка, подпишите и загрузите сканы. Пять обязательных документов по чек-листу Оргкомитета."
        />
        <meta property="og:type" content="website" />
      </Head>

      {/* Header section */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-5 sm:px-8">
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
            <p className="!text-sm !font-bold tracking-tight text-slate-900 sm:!text-lg">
              Конференция Российского содружества колледжей
            </p>
            <p className="text-xs text-slate-500 sm:text-sm">
              Приём документов от региональных отделений
            </p>
          </div>
        </div>
      </section>

      {/* Main flow */}
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 space-y-8">
        <ResumeBanner submissionId={submissionId} />

        {/* Что это, что предстоит сделать и что подготовить */}
        <section className="glass-card rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
          <div className="space-y-3">
            <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
              Отправьте документы об избрании делегата
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
              Ваше региональное отделение избирает делегата на Конференцию {CONFERENCE_DATE}.
              Оргкомитету нужен пакет из четырёх подписанных документов и фотография собрания. Три
              документа эта страница составит за вас: вы вносите данные собрания, скачиваете готовые
              бланки, распечатываете и подписываете.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-[1.15fr_1fr]">
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Как это работает</h2>
                <ol className="mt-2 space-y-2.5 text-sm leading-relaxed text-slate-600">
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                      1
                    </span>
                    <span>
                      <strong className="font-semibold text-slate-900">
                        Проводите собрание отделения
                      </strong>{" "}
                      и фиксируете на бумаге, кто присутствовал и как голосовали. Сфотографируйте
                      участников — фотография войдёт в пакет.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                      2
                    </span>
                    <span>
                      <strong className="font-semibold text-slate-900">Заполняете форму ниже</strong>{" "}
                      по итогам собрания. В ответ получаете ссылку на свою заявку и три бланка с уже
                      подставленными данными.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                      3
                    </span>
                    <span>
                      <strong className="font-semibold text-slate-900">
                        Печатаете, подписываете, загружаете
                      </strong>{" "}
                      сканы по своей ссылке. На неё можно возвращаться несколько дней и догружать
                      документы по одному.
                    </span>
                  </li>
                </ol>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h2 className="text-sm font-bold text-amber-900">Подготовьте до заполнения формы</h2>
                <p className="mt-1 text-xs text-amber-800">
                  Форма заполняется в один заход, черновик не сохраняется. Понадобятся:
                </p>
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-amber-900">
                  <li>
                    по каждому присутствовавшему — Ф.И.О., серия и номер паспорта, телефон либо
                    e-mail;
                  </li>
                  <li>число членов отделения на учёте и результаты голосования;</li>
                  <li>
                    паспорт делегата целиком: серия, номер, кем и когда выдан, код подразделения,
                    адрес регистрации;
                  </li>
                  <li>Ф.И.О. председателя и секретаря собрания, e-mail и телефон делегата.</li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-sm font-bold text-slate-900">Что войдёт в пакет</h2>
                <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600">
                  <li>
                    <span className="font-semibold text-slate-800">Протокол собрания</span> — бланк
                    составим, подписывают председатель и секретарь
                  </li>
                  <li>
                    <span className="font-semibold text-slate-800">Список присутствовавших</span> —
                    бланк составим, подписывают участники, председатель и секретарь
                  </li>
                  <li>
                    <span className="font-semibold text-slate-800">Согласие делегата</span> на
                    обработку персданных и видеозапись — бланк составим, подписывает делегат
                  </li>
                  <li>
                    <span className="font-semibold text-slate-800">Копия паспорта делегата</span> —
                    главная страница и страница регистрации
                  </li>
                  <li>
                    <span className="font-semibold text-slate-800">Фотография собрания</span>
                  </li>
                </ol>
              </div>

              <div>
                <h2 className="mb-2 text-sm font-bold text-slate-900">Пример подходящего фото</h2>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative h-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <Image
                      src="/images/conference_example_1.png"
                      alt="Общий план: за столом видно всех участников собрания"
                      fill
                      sizes="(max-width: 768px) 50vw, 20vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="relative h-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <Image
                      src="/images/conference_example_2.png"
                      alt="Общий план: участники собрания попали в кадр целиком"
                      fill
                      sizes="(max-width: 768px) 50vw, 20vw"
                      className="object-cover"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Общий план, на котором можно пересчитать присутствующих.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-900">Требования к собранию.</span> Собрание
            правомочно, если пришло более половины членов, состоящих на учёте. Делегат избран, если
            за него подано не менее двух третей голосов присутствующих. Форма посчитает оба порога
            сама и предупредит, если они не соблюдены.
          </div>
        </section>

        {/* Шаг 2. Данные собрания. Шаг 3 живёт на странице заявки /conferencia/<id> */}
        <PublicSubmissionForm />

      </div>
    </main>
  );
}
