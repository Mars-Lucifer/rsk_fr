import { useState } from "react";
import Head from "next/head";
import Image from "next/image";
import { AdminTemplates } from "@/components/rosdk-confrencia/AdminTemplates";
import { RegionLinks } from "@/components/rosdk-confrencia/RegionLinks";
import { ClipboardIcon, DocIcon, SearchIcon } from "@/components/rosdk-confrencia/icons";
import { UPLOAD_SLOTS, uploadProgress } from "@/lib/rosdk-confrencia/slots";

export async function getServerSideProps(context) {
  const { isAdminConfigured, isAdminSession } = require("@/lib/rosdk-confrencia/admin");
  const {
    listStoredRegionLinks,
    listStoredSubmissionsByRegion,
  } = require("@/lib/rosdk-confrencia/storage");

  const req = context.req;
  const error = context.query.error || "";
  const authorized = isAdminSession(req);

  if (!authorized) {
    return {
      props: {
        authorized: false,
        hasError: error === "1",
        notConfigured: error === "config" || !isAdminConfigured(),
      },
    };
  }

  const { listTemplates } = require("@/lib/rosdk-confrencia/templates");
  const { originFromRequest, regionLinkUrl } = require("@/lib/rosdk-confrencia/regionLinks");
  const { regions } = require("@/lib/rosdk-confrencia/regions");

  // Всё грузим целиком: 89 субъектов и заявки по ним — это сотни строк,
  // а поиск и вкладки работают на странице без перезагрузок.
  const submissions = await listStoredSubmissionsByRegion("");
  const saved = await listStoredRegionLinks();
  const origin = originFromRequest(req);

  // Одна строка на субъект: ссылка, ответственный и пакет этого отделения рядом.
  // Заявка от отделения одна, поэтому её и берём — списком тут смотреть нечего.
  const links = regions.map((region) => {
    const own = submissions.find((submission) => submission.region === region) ?? null;
    const progress = own ? uploadProgress(own.files) : null;

    return {
      region,
      url: regionLinkUrl(origin, region),
      sentAt: saved[region]?.sentAt ?? null,
      responsibleName: saved[region]?.responsibleName ?? "",
      responsiblePhone: saved[region]?.responsiblePhone ?? "",
      responsibleMax: saved[region]?.responsibleMax ?? "",
      started: Boolean(own),
      complete: Boolean(progress?.isComplete),
      submission: own ? JSON.parse(JSON.stringify(own)) : null,
      scansDone: progress?.done ?? 0,
      scansTotal: progress?.total ?? UPLOAD_SLOTS.length,
    };
  });

  return {
    props: {
      authorized: true,
      submissions: JSON.parse(JSON.stringify(submissions)),
      templates: await listTemplates(),
      links,
    },
  };
}

// Ссылки и пакеты — одна таблица: раньше сотрудник искал субъект дважды, в двух
// вкладках, и сверял глазами, кому отправлено и что от него пришло.
const TABS = [
  {
    key: "links",
    title: "Отделения",
    text: "Ссылки, ответственные, пакеты и выгрузки",
    Icon: ClipboardIcon,
  },
  {
    key: "templates",
    title: "Бланки документов",
    text: "Заменить бланк или вернуть встроенный",
    Icon: DocIcon,
  },
];

export default function AdminPage({
  authorized,
  hasError,
  notConfigured,
  submissions,
  templates,
  links,
}) {
  const [active, setActive] = useState("links");
  const [query, setQuery] = useState("");

  if (!authorized) {
    return <LoginPage hasError={hasError} notConfigured={notConfigured} />;
  }

  const sent = links.filter((item) => item.sentAt).length;
  const complete = submissions.filter((item) => uploadProgress(item.files).isComplete).length;
  const scansUploaded = submissions.reduce((sum, item) => sum + uploadProgress(item.files).done, 0);

  return (
    <main className="min-h-screen bg-[#f4f6fa] pb-16 text-slate-800">
      <Head>
        <title>Панель управления — Конференция РСК</title>
        {/* Вкладка «Бланки» короче остальных: без этого исчезала полоса прокрутки
            и вся страница прыгала вбок на её ширину. */}
        <style>{`html{scrollbar-gutter:stable}`}</style>
      </Head>

      {/* Шапка обычная, не прилипающая: панель листают длинными таблицами. */}
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
              Панель управления
            </p>
            <p className="text-xs text-slate-500 sm:text-sm">
              Конференция РСК · приём документов от региональных отделений
            </p>
          </div>
          <form action="/api/conferencia/admin/logout" method="post" className="ml-auto">
            <button className="h-9 cursor-pointer rounded-lg border border-slate-200 !bg-white !px-4 !text-sm !font-semibold !text-slate-700 transition hover:!bg-slate-50 !w-auto">
              Выйти
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] space-y-6 px-5 py-8 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Ссылок отправлено" value={`${sent} из ${links.length}`} />
          <Card label="Отделений заполняют" value={submissions.length} tone="text-indigo-600" />
          <Card label="Пакетов собрано" value={complete} tone="text-emerald-600" />
          <Card
            label="Сканов загружено"
            value={`${scansUploaded} из ${submissions.length * UPLOAD_SLOTS.length}`}
          />
        </div>

        <section className="glass-card rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <ol className="grid gap-3 lg:grid-cols-2">
            {TABS.map((tab, index) => {
              const current = active === tab.key;

              return (
                <li key={tab.key}>
                  <button
                    type="button"
                    onClick={() => setActive(tab.key)}
                    aria-current={current ? "page" : undefined}
                    className={`h-full w-full flex-col rounded-2xl border p-4 text-left !items-start !justify-start !gap-0 transition ${
                      current
                        ? "border-indigo-600 !bg-indigo-50 ring-1 ring-indigo-600"
                        : "border-slate-200 !bg-white hover:border-slate-300"
                    }`}
                  >
                    <span className="flex w-full items-center gap-2.5">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
                        {tab.title}
                      </span>
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <tab.Icon />
                      </span>
                    </span>
                    <span className="mt-2.5 line-clamp-2 block min-h-8 text-xs leading-relaxed text-slate-500">
                      {tab.text}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="glass-card space-y-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          {/* Поиск стоит на обеих вкладках: пока он появлялся и исчезал, блок под
              вкладками менял высоту, и при переключении всё уезжало. На бланках он
              фильтрует их названия — четыре строки, но место занимает то же. */}
          <SearchField
            label={active === "templates" ? "Поиск по названию бланка" : "Поиск по субъекту РФ"}
            placeholder={active === "templates" ? "Например, протокол" : "Например, ярославская"}
            value={query}
            onChange={setQuery}
          />

          {active === "links" && <RegionLinks links={links} query={query} />}
          {active === "templates" && <AdminTemplates templates={templates} query={query} />}
        </section>
      </div>
    </main>
  );
}

/**
 * Фильтр живой: без кнопки и без перезагрузки. Подпись, лупа и рамка нужны, чтобы
 * поле читалось как поле — раньше оно сливалось с карточкой. Сброс висит внутри
 * поля: снаружи он менял высоту блока и дёргал таблицу.
 */
function SearchField({ label, placeholder, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      <span className="relative block">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border-2 border-slate-300 bg-white pl-10 pr-24 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 h-8 -translate-y-1/2 rounded-md border border-slate-200 !bg-white !px-3 !text-xs !font-semibold !text-slate-600 hover:!bg-slate-50 !w-auto cursor-pointer"
          >
            Сбросить
          </button>
        )}
      </span>
    </label>
  );
}

function Card({ label, value, tone = "text-slate-950" }) {
  return (
    <div className="glass-card rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}

function LoginPage({ hasError, notConfigured }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f6fa] px-5 text-slate-800">
      <form
        action="/api/conferencia/admin/login"
        method="post"
        className="glass-card w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8"
      >
        <div className="flex flex-col items-center">
          <Image
            src="/rsk-logo.png"
            alt="Российское содружество колледжей"
            width={240}
            height={98}
            className="mb-6 h-auto w-44"
            priority
          />
          <h1 className="text-center !text-2xl !font-bold tracking-tight text-slate-900">
            Вход для администратора
          </h1>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Пароль</span>
          <input
            name="password"
            type="password"
            required
            className="modern-input h-11 w-full rounded-lg px-3 text-sm"
          />
        </label>

        {hasError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Неверный пароль.
          </div>
        )}

        {notConfigured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Вход отключён: на сервере не задана переменная <code>ADMIN_PASSWORD</code>. Пароля по
            умолчанию нет — задайте переменную и перезапустите приложение.
          </div>
        )}

        <button
          type="submit"
          className="btn-primary h-11 w-full cursor-pointer rounded-lg text-sm font-semibold text-white"
        >
          Войти
        </button>
      </form>
    </main>
  );
}
