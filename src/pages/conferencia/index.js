import Head from "next/head";
import Image from "next/image";
import { RegistrationForm } from "@/components/rosdk-confrencia/RegistrationForm";
import { ScanExamples } from "@/components/rosdk-confrencia/ScanExamples";
import { CONFERENCE_DATE, SUBMISSION_COOKIE } from "@/lib/rosdk-confrencia/slots";
import { MIN_PRESENT_MEMBERS } from "@/lib/rosdk-confrencia/validation";

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
        С этого устройства уже начинали собрание. Продолжить с того же места?
      </p>
      <a
        href={`/conferencia/${submissionId}`}
        className="file-link h-10 border-amber-300 bg-white px-4 text-xs font-bold text-amber-800 hover:bg-amber-100 hover:text-amber-900"
      >
        Открыть мою заявку
      </a>
    </div>
  );
}

const STEP_CARDS = [
  {
    title: "Блок 1. Регистрация",
    text: "Вносите тех, кто пришёл. Получаете список присутствовавших и ссылку на заявку.",
  },
  {
    title: "Блок 2. Делегат",
    text: "Данные избранного делегата и его паспорт. Получаете согласие на обработку данных.",
  },
  {
    title: "Блок 3. Голосование",
    text: "Результаты по второму вопросу. Получаете протокол собрания.",
  },
  {
    title: "Блок 4. Паспорт и фото",
    text: "Копия паспорта делегата и фотография собрания — последние два файла пакета.",
  },
];

export default function Home({ submissionId }) {
  return (
    <main className="min-h-screen bg-[#f4f6fa] pb-16 text-slate-800">
      <Head>
        <title>Конференция РСК — документы от регионального отделения</title>
        <meta
          name="description"
          content="Региональное отделение проводит общее собрание, избирает делегата на Конференцию и присылает пакет документов. Страница составляет протокол, явочный лист и согласие делегата."
        />
        <meta property="og:title" content="Конференция РСК — документы от регионального отделения" />
        <meta
          property="og:description"
          content="Откройте страницу на собрании: заполняете три блока — получаете три готовых документа, подписываете и загружаете сканы."
        />
        <meta property="og:type" content="website" />
      </Head>

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

      <div className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-8">
        <ResumeBanner submissionId={submissionId} />

        <section className="glass-card space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="space-y-3">
            <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
              Общее собрание отделения: избрание делегата
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
              {CONFERENCE_DATE} проходит Конференция Российского содружества колледжей — дистанционно.
              Отделению нужно провести общее собрание, избрать одного делегата и прислать пакет
              документов. Делегата опознают по паспорту и включённой камере, заседание записывается
              на видео — поэтому в пакете есть согласие на обработку данных.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-sm font-bold text-slate-900">Требования к собранию</h2>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-600">
                <li>
                  присутствует не меньше{" "}
                  <span className="font-semibold text-slate-900">
                    {MIN_PRESENT_MEMBERS} членов отделения
                  </span>{" "}
                  и больше половины состоящих на учёте;
                </li>
                <li>делегат избран, если «за» — не менее двух третей присутствующих;</li>
                <li>
                  председатель, секретарь и делегат избираются из тех, кто пришёл на собрание.
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-sm font-bold text-slate-900">Повестка дня — два вопроса</h2>
              <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-600">
                <li>1. Избрание председателя и секретаря собрания.</li>
                <li>2. Избрание делегата на Конференцию {CONFERENCE_DATE}.</li>
              </ol>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <h2 className="text-sm font-bold text-indigo-900">
              Как работать с этой страницей: откройте её прямо на собрании
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-indigo-900">
              Заполняете блок — сразу получаете готовый документ: печатаете, подписываете и
              загружаете скан в тот же блок. Ничего переписывать от руки не нужно.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {STEP_CARDS.map((card) => (
                <div key={card.title} className="rounded-lg border border-indigo-200 bg-white p-3">
                  <p className="text-xs font-bold text-slate-900">{card.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{card.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-bold text-amber-900">Что держать под рукой</h2>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-amber-900">
              <li>
                по каждому присутствующему — Ф.И.О. полностью, серия и номер паспорта, телефон или
                e-mail;
              </li>
              <li>сколько членов состоит на учёте в отделении;</li>
              <li>
                паспорт делегата целиком: серия, номер, кем и когда выдан, код подразделения, адрес
                регистрации;
              </li>
              <li>фотография собрания общим планом — участников должно быть видно и можно пересчитать.</li>
            </ul>
          </div>

          <ScanExamples />
        </section>

        <RegistrationForm />
      </div>
    </main>
  );
}
