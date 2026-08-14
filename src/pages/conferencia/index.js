import { useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { DelegateForm } from "@/components/rosdk-confrencia/DelegateForm";
import { RegistrationForm } from "@/components/rosdk-confrencia/RegistrationForm";
import { DocumentButton } from "@/components/rosdk-confrencia/DocumentButton";
import { PhotoExample } from "@/components/rosdk-confrencia/PhotoExample";
import { ScanUpload } from "@/components/rosdk-confrencia/ScanUpload";
import {
  DELEGATE_SLOTS,
  FINAL_SLOTS,
  SubmissionPackage,
  blockState,
  documentsDone,
} from "@/components/rosdk-confrencia/SubmissionPackage";
import { VotesForm } from "@/components/rosdk-confrencia/VotesForm";
import { DOCUMENT_TABS, DocumentTabs } from "@/components/rosdk-confrencia/DocumentTabs";
import { CalendarIcon, CheckIcon } from "@/components/rosdk-confrencia/icons";
import { QrCard } from "@/components/rosdk-confrencia/QrCard";
import {
  CONFERENCE_DATE,
  DEADLINE_DATE,
  MAX_LINKS,
  SUBMISSION_COOKIE,
} from "@/lib/rosdk-confrencia/slots";
import { MIN_PRESENT_MEMBERS } from "@/lib/rosdk-confrencia/validation";

/**
 * Одна страница на весь путь отделения: пока заявки нет — регистрация, как только
 * появилась — рабочие блоки.
 *
 * Заявка ищется тремя способами, в этом порядке: `?id=` — прямая ссылка на заявку,
 * `?k=` — персональная ссылка субъекта (тогда открывается его заявка, с какого бы
 * устройства ни зашли), кукис — последняя заявка этого браузера. `?new=1` начинает
 * заявку заново, не трогая старую.
 */
export async function getServerSideProps(context) {
  const {
    findStoredSubmissionByRegion,
    getStoredSubmission,
    toPublicSubmission,
  } = require("@/lib/rosdk-confrencia/storage");
  const { regionByToken } = require("@/lib/rosdk-confrencia/regionLinks");
  const { MAX_LINKS } = require("@/lib/rosdk-confrencia/slots");
  const QRCode = require("qrcode");
  const fs = require("node:fs");
  const path = require("node:path");

  // Коррекция H: под логотипом теряется до трети модулей, код всё равно читается.
  const qr = (link) =>
    link
      ? QRCode.toString(link, {
          type: "svg",
          errorCorrectionLevel: "H",
          margin: 0,
          color: { dark: "#0f172a", light: "#ffffff" },
        })
      : Promise.resolve("");

  const requestedId = String(context.query.id ?? "");
  const linkToken = String(context.query.k ?? "");
  const lockedRegion = regionByToken(linkToken);
  const startingNew = Boolean(context.query.new);

  // При персональной ссылке кукис не спрашиваем: он мог остаться от чужой заявки,
  // открытой в этом же браузере — например у сотрудника, проверявшего рассылку.
  const rememberedId =
    startingNew || lockedRegion ? "" : (context.req.cookies?.[SUBMISSION_COOKIE] ?? "");

  let submission =
    requestedId || rememberedId ? await getStoredSubmission(requestedId || rememberedId) : null;

  if (!submission && lockedRegion && !startingNew) {
    submission = await findStoredSubmissionByRegion(lockedRegion);
  }

  return {
    props: {
      qr: {
        channel: await qr(MAX_LINKS.channel),
        chat: await qr(MAX_LINKS.chat),
        delegates: await qr(MAX_LINKS.delegates),
        logo: fs.existsSync(path.join(process.cwd(), "public/conferencia/max-logo.png")),
      },
      photoExample: fs.existsSync(path.join(process.cwd(), "public/conferencia/photo-example.jpg")),
      initialSubmission: submission
        ? JSON.parse(JSON.stringify(toPublicSubmission(submission)))
        : null,
      lockedRegion: lockedRegion ?? null,
      linkToken: lockedRegion ? linkToken : "",
      // Ссылка есть, а заявки по ней нет: молча открывать пустую форму нельзя —
      // отделение решит, что всё пропало, и заведёт дубль.
      missing: Boolean(requestedId && !submission),
    },
  };
}

/**
 * Отправляет то, что отделение заполнило до регистрации. Порядок здесь всё же есть,
 * но технический: протокол печатает данные делегата, поэтому голоса идут после него.
 * Возвращает описание первой неудачи или null.
 */
async function flushDraft(created, draft, onSubmission) {
  const steps = [
    { tab: "delegate", body: draft.delegate },
    { tab: "votes", body: draft.votes },
  ].filter((item) => item.body);

  for (const step of steps) {
    const response = await fetch(`/api/conferencia/submissions/${created.id}/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(step.body),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { tab: step.tab, message: result.error || "Не удалось сохранить данные блока." };
    }

    onSubmission(result.submission);
  }

  for (const [slot, file] of Object.entries(draft.files)) {
    const payload = new FormData();
    payload.append(slot, file);

    const response = await fetch(`/api/conferencia/submissions/${created.id}/upload`, {
      method: "POST",
      body: payload,
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { tab: "final", message: result.error || `Не удалось загрузить файл «${file.name}».` };
    }

    onSubmission(result.submission);
  }

  return null;
}

/**
 * Вся памятка — четыре шага в одну линию: зачем, что подготовить, как провести,
 * что загрузить. Раньше то же самое лежало пятью блоками (задачи, требования,
 * повестка, ход собрания, что под рукой) и повторялось само в себе.
 */
const GUIDE = [
  {
    title: "Цель",
    lead: "Избрать одного делегата и собрать пакет документов.",
    items: [
      "Собрание очное, делегат один от отделения",
      `Пакет документов принимается до ${DEADLINE_DATE}`,
      "Пакет: протокол, список присутствовавших, согласие делегата, паспорт, фото",
      `Делегат участвует в Конференции ${CONFERENCE_DATE} онлайн`,
    ],
  },
  {
    title: "Подготовка",
    lead: "До начала собрания.",
    items: [
      "Площадка для очной встречи",
      `Не менее ${MIN_PRESENT_MEMBERS} участников, у каждого паспорт и телефон`,
      "Эта страница открыта на собрании — с ноутбука вести удобнее",
      "Принтер и ручка: документы подписываются на месте",
    ],
  },
  {
    title: "Собрание",
    lead: "Два вопроса повестки.",
    items: [
      "Избрание председателя и секретаря собрания",
      "Избрание делегата: «за» не менее 2/3 присутствующих",
      "Секретарь заполняет блоки ниже прямо по ходу собрания",
    ],
  },
  {
    title: "Документы",
    lead: "Бланки страница составляет сама.",
    items: [
      "Скачайте бланк кнопкой в блоке, распечатайте и подпишите",
      "Загрузите скан подписанного документа в том же блоке",
      "Отдельно: сканы паспорта делегата и общее фото собрания",
    ],
  },
];

export default function Home({
  qr,
  photoExample,
  initialSubmission,
  missing,
  lockedRegion,
  linkToken,
}) {
  const [submission, setSubmission] = useState(initialSubmission);

  // Открыт первый несобранный документ: чаще всего работа продолжается с него.
  const [active, setActive] = useState(() => {
    if (!initialSubmission) return "registration";
    const done = documentsDone(initialSubmission);
    return (DOCUMENT_TABS.find((tab) => !done[tab.key]) ?? DOCUMENT_TABS[0]).key;
  });

  // Блоки заполняются в любом порядке, поэтому данные, введённые до регистрации,
  // ждут здесь: сервер принимает их только вместе с заявкой.
  const [draft, setDraft] = useState({ delegate: null, votes: null, files: {} });
  const [draftError, setDraftError] = useState("");

  const saveDraftStep = (step) => (payload) => {
    setDraft((current) => ({ ...current, [step]: payload }));
    setDraftError("");
  };

  const saveDraftFile = (slot, file) => {
    setDraft((current) => ({ ...current, files: { ...current.files, [slot]: file } }));
  };

  // Статусы плашек до создания заявки: что уже заполнено в черновике.
  const draftState = {
    registration: { filled: false, signed: false },
    votes: { filled: Boolean(draft.votes), signed: false },
    delegate: { filled: Boolean(draft.delegate), signed: false },
    final: {
      filled: FINAL_SLOTS.some((slot) => draft.files[slot.slot]),
      signed: FINAL_SLOTS.every((slot) => draft.files[slot.slot]),
    },
  };

  // Голоса могут ждать делегата черновиком — для плашки это уже «заполнено».
  const submissionState = submission
    ? (() => {
        const state = blockState(submission);
        return {
          ...state,
          votes: { ...state.votes, filled: state.votes.filled || Boolean(draft.votes) },
        };
      })()
    : null;

  /** Заявка создана: остаёмся на странице, кладём id в адрес и досылаем черновики. */
  async function handleCreated(created) {
    setSubmission(created);
    // По персональной ссылке адрес не подменяем: отделение сохранило именно её.
    window.history.replaceState(
      null,
      "",
      linkToken ? `/conferencia?k=${linkToken}` : `/conferencia?id=${created.id}`
    );
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Бланки больше не скачиваются сами: кнопка в блоке становится активной, и
    // отделение жмёт её, когда готово печатать.
    const failed = await flushDraft(created, draft, setSubmission);

    setDraft({ delegate: null, votes: null, files: {} });
    setDraftError(failed?.message ?? "");

    // Остаёмся в том же блоке: он просто становится неактивным, а бланк —
    // доступным для скачивания. Перебрасывать на соседнюю вкладку незачем.
    if (failed) setActive(failed.tab);
  }

  /**
   * Заявка изменилась. Голоса могли быть введены до делегата — тогда они лежали
   * черновиком, и как только делегат появился, их можно отправить.
   */
  async function handleSubmissionChange(next) {
    setSubmission(next);

    if (!draft.votes || !next.delegateName) return;

    const failed = await flushDraft(next, { votes: draft.votes, files: {} }, setSubmission);

    setDraft((current) => ({ ...current, votes: null }));
    setDraftError(failed?.message ?? "");
  }

  return (
    <main className="min-h-screen bg-[#f4f6fa] pb-16 text-slate-800">
      <Head>
        <title>
          {submission
            ? `Заявка РО ${submission.region} — Конференция РСК`
            : "Конференция РСК — документы от регионального отделения"}
        </title>
        <meta
          name="description"
          content="Региональное отделение проводит общее собрание, избирает делегата на Конференцию и присылает пакет документов. Страница составляет протокол, явочный лист и согласие делегата."
        />
        <meta
          property="og:title"
          content="Конференция РСК — документы от регионального отделения"
        />
        <meta
          property="og:description"
          content="Откройте страницу на собрании: заполняете три блока — получаете три готовых документа, подписываете и загружаете сканы."
        />
        <meta property="og:type" content="website" />
        {/* Заявка содержит персональные данные — в поиске ей делать нечего. */}
        {submission && <meta name="robots" content="noindex, nofollow" />}
      </Head>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-5 py-5 sm:px-8">
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
          {/* Ссылка персональная — субъект показываем сразу, чтобы отделение видело,
              что открыло свою страницу, а не чужую. */}
          {lockedRegion && (
            <span className="ml-auto hidden rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-bold text-indigo-700 sm:inline-flex">
              Региональное отделение · {lockedRegion}
            </span>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] space-y-6 px-5 py-8 sm:px-8">
        {missing && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
            Заявка по этой ссылке не найдена — проверьте адрес целиком. Если ссылка потеряна,
            заполните регистрацию заново: пакет соберётся с нуля.
          </div>
        )}

        {/* Черновик уехал на сервер не целиком: показываем, какой блок надо поправить. */}
        {draftError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
            Заявка создана, но часть данных сервер не принял: {draftError} Проверьте открытый блок и
            сохраните ещё раз.
          </div>
        )}

        {/* Инструкция открыта всегда: собрание идёт по ней вслух, а не по памяти.
            Прятать её после создания заявки нельзя — заполнение как раз тогда и идёт. */}
        <IntroSection qr={qr} />

        {submission ? (
          <SubmissionPackage
            submission={submission}
            onChange={handleSubmissionChange}
            active={active}
            qr={qr}
            photoExample={photoExample}
            delegatesLink={MAX_LINKS.delegates}
            draftVotes={draft.votes}
            onDraftVotes={saveDraftStep("votes")}
            tabs={<DocumentTabs active={active} onSelect={setActive} state={submissionState} />}
          />
        ) : (
          <>
            {/* До создания заявки переключатель стоит сам по себе. */}
            <section className="glass-card rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="!text-lg !font-extrabold text-slate-900 sm:!text-xl">
                Документы пакета — переключайтесь между блоками
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Заполняйте в любом порядке. Пока явочного листа нет, введённое сохраняется на
                странице и уйдёт вместе с регистрацией.
              </p>
              <div className="mt-4">
                <DocumentTabs active={active} onSelect={setActive} state={draftState} />
              </div>
            </section>

            {active === "registration" && (
              <RegistrationForm
                lockedRegion={lockedRegion}
                linkToken={linkToken}
                onCreated={handleCreated}
              />
            )}

            {active === "votes" && (
              <DraftBlock
                number={2}
                title="Голосование"
                subtitle="Результаты по второму вопросу"
                saved={Boolean(draft.votes)}
              >
                <VotesForm submission={null} onDraft={saveDraftStep("votes")} />
              </DraftBlock>
            )}

            {active === "delegate" && (
              <DraftBlock
                number={3}
                title="Делегат"
                subtitle="Второй вопрос повестки: кого избираем"
                saved={Boolean(draft.delegate)}
                documentKeys={["consentDocx", "protocolDocx"]}
                slots={DELEGATE_SLOTS}
                draftFiles={draft.files}
                onDraftFile={saveDraftFile}
              >
                <DelegateForm
                  submission={null}
                  region={lockedRegion}
                  onDraft={saveDraftStep("delegate")}
                />
              </DraftBlock>
            )}

            {active === "final" && (
              <DraftBlock
                number={4}
                title="Фото собрания"
                subtitle="Последний файл пакета"
                saved={FINAL_SLOTS.every((slot) => draft.files[slot.slot])}
                slots={FINAL_SLOTS}
                draftFiles={draft.files}
                onDraftFile={saveDraftFile}
              >
                <PhotoExample photo={photoExample} />
              </DraftBlock>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/**
 * Блок, заполняемый до создания заявки: данные ждут отправки вместе с регистрацией.
 * Кнопка бланка видна сразу, но неактивна — до явочного листа собирать нечего.
 * Сканы, которым бланк не нужен (паспорт, фото), кладутся в черновик уже сейчас.
 */
function DraftBlock({
  number,
  title,
  subtitle,
  saved,
  documentKeys = [],
  slots = [],
  draftFiles = {},
  onDraftFile,
  children,
}) {
  return (
    <section
      className={`glass-card rounded-2xl border bg-white p-6 sm:p-8 ${
        saved ? "border-emerald-200" : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="!text-lg !font-extrabold text-slate-900 sm:!text-xl">
            Блок {number}. {title}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            saved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {saved ? "заполнено" : "требует заполнения"}
        </span>
      </div>

      {children && <div className="pt-5">{children}</div>}

      {(documentKeys.length > 0 || slots.length > 0) && (
        <div className={`space-y-4 ${children ? "mt-5 border-t border-slate-100 pt-5" : "pt-5"}`}>
          {documentKeys.map((documentKey) => (
            <div key={documentKey}>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Скачайте и подпишите</p>
              <DocumentButton
                submission={null}
                documentKey={documentKey}
                done={false}
                waitingFor="Соберётся вместе с блоком 1 «Регистрация»: из него идут субъект, явка и подписанты."
              />
            </div>
          ))}

          {slots.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {slots.map((slot) => (
                <ScanUpload
                  key={slot.slot}
                  submission={null}
                  draftFile={draftFiles[slot.slot]}
                  slot={slot.slot}
                  label={slot.label}
                  hint={slot.hint}
                  accept={slot.accept}
                  onDraft={onDraftFile}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {saved && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          Данные сохранены на странице и уйдут вместе с регистрацией.
        </p>
      )}
    </section>
  );
}

/** Пункт с галочкой в кружке: один вид маркера на всю памятку. */
function Bullet({ children }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
        <CheckIcon className="h-3 w-3" />
      </span>
      <span className="text-sm leading-relaxed">{children}</span>
    </li>
  );
}

function IntroSection({ qr }) {
  return (
    <section className="glass-card space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-4">
          {/* Обе плашки в одной строке-флексе: раньше вторая шла inline-потоком
              и вставала по базовой линии текста, а не вровень с первой. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center gap-2 rounded-full bg-indigo-50 px-3 text-xs font-bold text-indigo-700">
              <CalendarIcon className="h-4 w-4" />
              Конференция {CONFERENCE_DATE}
            </span>
            <span className="inline-flex h-8 items-center rounded-full bg-amber-50 px-3 text-xs font-bold text-amber-800">
              Документы принимаются до {DEADLINE_DATE}
            </span>
          </div>
          {/* Портальные стили задают h1/h2 шорткатом font:, поэтому размеры здесь через !. */}
          <h1 className="!text-2xl !font-extrabold !leading-tight text-slate-900 sm:!text-4xl">
            Общее собрание отделения:
            <br />
            <span className="text-indigo-600">избрание делегата</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <QrCard
            title="Информационный канал"
            hint="Объявления Оргкомитета"
            svg={qr.channel}
            href={MAX_LINKS.channel || undefined}
            logo={qr.logo}
          />
          <QrCard
            title="Информационный чат"
            hint="Вопросы по пакету"
            svg={qr.chat}
            href={MAX_LINKS.chat}
            logo={qr.logo}
          />
        </div>
      </div>

      <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {GUIDE.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <h2 className="!text-base !font-extrabold !leading-snug text-slate-900">
                {step.title}
              </h2>
            </div>
            <p className="mt-2.5 text-sm font-semibold text-slate-700">{step.lead}</p>
            <ul className="mt-3 space-y-2 text-slate-600">
              {step.items.map((item) => (
                <Bullet key={item}>{item}</Bullet>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
