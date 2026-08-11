import Image from "next/image";
import {
  GENERATED_SLOTS,
  STATUS_LABELS,
  UPLOAD_SLOTS,
  uploadProgress,
} from "@/lib/rosdk-confrencia/slots";

export async function getServerSideProps(context) {
  const { isAdminConfigured, isAdminSession } = require("@/lib/rosdk-confrencia/admin");
  const { listStoredSubmissionsByRegion } = require("@/lib/rosdk-confrencia/storage");

  const req = context.req;
  const query = context.query;
  const region = query.region || "";
  const error = query.error || "";

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

  const submissions = await listStoredSubmissionsByRegion(region);

  return {
    props: {
      authorized: true,
      submissions: JSON.parse(JSON.stringify(submissions)),
      region,
    },
  };
}

export default function AdminPage({ authorized, hasError, notConfigured, submissions, region }) {
  if (!authorized) {
    return <LoginPage hasError={hasError} notConfigured={notConfigured} />;
  }

  const totalRegions = submissions.length;
  const totalMembers = submissions.reduce((sum, s) => sum + s.totalMembers, 0);
  const complete = submissions.filter((s) => uploadProgress(s.files).isComplete).length;
  const scansUploaded = submissions.reduce((sum, s) => sum + uploadProgress(s.files).done, 0);
  const scansExpected = submissions.length * UPLOAD_SLOTS.length;

  return (
    <main className="min-h-screen pb-12 text-slate-800 bg-[#f4f6fa]">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <Image
              src="/rsk-logo.png"
              alt="Российское содружество колледжей"
              width={240}
              height={98}
              className="h-auto w-32 shrink-0 sm:w-40"
              priority
            />
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Панель управления</h1>
            </div>
          </div>
          <form action="/api/conferencia/admin/logout" method="post">
            <button className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer">
              Выйти
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-6 sm:px-8 space-y-6">
        {/* Statistics Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="glass-card rounded-xl p-5 bg-white border border-slate-200">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Заявок от отделений</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-950">{totalRegions}</p>
          </div>
          <div className="glass-card rounded-xl p-5 bg-white border border-slate-200">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Пакетов собрано</p>
            <p className="mt-2 text-3xl font-extrabold text-emerald-600">
              {complete}
              <span className="text-xs text-slate-400 font-normal"> из {totalRegions}</span>
            </p>
          </div>
          <div className="glass-card rounded-xl p-5 bg-white border border-slate-200">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Документов загружено</p>
            <p className="mt-2 text-3xl font-extrabold text-indigo-600">
              {scansUploaded}
              <span className="text-xs text-slate-400 font-normal"> из {scansExpected}</span>
            </p>
          </div>
          <div className="glass-card rounded-xl p-5 bg-white border border-slate-200">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Всего членов содружества</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-950">{totalMembers}</p>
          </div>
        </div>

        {/* Filter form */}
        <form className="grid gap-3 p-1.5 rounded-xl bg-white border border-slate-200 sm:grid-cols-[1fr_auto] shadow-sm">
          <input
            name="region"
            defaultValue={region}
            placeholder="Поиск по субъекту РФ или городу..."
            className="h-10 rounded-lg bg-slate-50 border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 transition"
          />
          <div className="flex gap-2">
            <button className="btn-primary h-10 rounded-lg px-6 text-sm font-semibold text-white cursor-pointer">
              Найти
            </button>
            <a
              href={`/api/conferencia/admin/export${region ? `?region=${encodeURIComponent(region)}` : ""}`}
              className="file-link h-10 px-4 text-xs font-bold border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            >
              Реестр в XLSX
            </a>
          </div>
        </form>

        {/* Submissions Container */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[56px_1.4fr_1.8fr_1.1fr_56px_260px] gap-4 border-b border-slate-200 bg-slate-50/50 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 max-lg:hidden items-center">
            <span>№</span>
            <span>Регион / Город / Дата</span>
            <span>Делегат (Контакты & Паспорт)</span>
            <span>Собрание / Голоса</span>
            <span className="text-center">Фото</span>
            <span>Бланки / Сканы / Архив</span>
          </div>
          
          {submissions.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">
              Заявок пока нет.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {submissions.map((submission, index) => (
                <SubmissionRow
                  key={submission.id}
                  index={index + 1}
                  submission={submission}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function LoginPage({ hasError, notConfigured }) {
  return (
    <main className="grid min-h-screen place-items-center px-5 text-slate-800 bg-[#f4f6fa]">
      <form
        action="/api/conferencia/admin/login"
        method="post"
        className="w-full max-w-md rounded-2xl glass-card p-8 bg-white border border-slate-200 space-y-6"
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-center">Вход для администратора</h1>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Пароль</span>
          <input
            name="password"
            type="password"
            required
            className="h-11 w-full rounded-lg modern-input px-3 text-sm"
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

        <button type="submit" className="btn-primary h-11 w-full rounded-lg text-sm font-semibold text-white cursor-pointer">
          Войти
        </button>
      </form>
    </main>
  );
}

function FileLinkGroup({ title, submission, slots, className }) {
  const available = slots.filter((item) => submission.files?.[item.slot]);

  if (available.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</span>
      {available.map((item) => (
        <a
          key={item.slot}
          title={item.label}
          className={`file-link h-7 px-2 text-[11px] font-bold ${className}`}
          href={`/api/conferencia/admin/submissions/${submission.id}/files/${item.slot}`}
        >
          {item.short}
        </a>
      ))}
    </div>
  );
}

function SubmissionRow({
  index,
  submission,
}) {
  const progress = uploadProgress(submission.files);

  return (
    <article className="grid gap-4 px-6 py-4 text-sm lg:grid-cols-[56px_1.5fr_1.8fr_1.2fr_60px_220px] lg:items-center hover:bg-slate-50/50 transition">
      {/* Index */}
      <div className="font-bold text-slate-400 max-lg:hidden">{index}</div>
      
      {/* Region & Info */}
      <div className="space-y-1">
        <div className="font-extrabold text-slate-900 text-base lg:text-sm">{submission.region}</div>
        <div className="text-xs text-slate-500 font-medium">{submission.city}</div>
        <div className="text-xs text-slate-400 font-medium">Дата: {new Date(submission.meetingDate).toLocaleDateString("ru-RU")}</div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            progress.isComplete
              ? "bg-emerald-50 text-emerald-700"
              : progress.done > 0
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {progress.done}/{progress.total} · {STATUS_LABELS[submission.status] ?? submission.status}
        </div>
        {!progress.isComplete && (
          <div className="text-[11px] text-slate-400">
            Нет: {progress.missing.map((item) => item.short).join(", ")}
          </div>
        )}
      </div>
      
      {/* Delegate details */}
      <div className="space-y-1">
        <div className="font-bold text-slate-800">{submission.delegateName}</div>
        <div className="flex flex-wrap gap-x-3 text-xs font-semibold">
          <a className="text-indigo-600 hover:text-indigo-700 transition" href={`tel:${submission.delegatePhone}`}>
            {submission.delegatePhone}
          </a>
          {submission.delegateEmail && (
            <a className="text-indigo-600 hover:text-indigo-700 transition" href={`mailto:${submission.delegateEmail}`}>
              {submission.delegateEmail}
            </a>
          )}
        </div>
        {submission.delegateAddress && (
          <div className="text-xs text-slate-500">{submission.delegateAddress}</div>
        )}
        <div className="text-xs text-slate-500 leading-relaxed font-mono select-all bg-slate-50 border border-slate-100 p-1.5 rounded">
          {submission.passportData}
        </div>
      </div>

      {/* Vote & Attendance stats */}
      <div className="space-y-1 text-xs text-slate-600">
        <div>Протокол № <span className="font-bold text-slate-900">{submission.protocolNumber}</span></div>
        <div>Присутствовало: <span className="font-bold text-slate-900">{submission.presentMembers}</span> из <span className="font-semibold text-slate-500">{submission.totalMembers}</span></div>
        <div>
          За <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{submission.votesFor}</span>
          {" / против "}<span className="font-semibold text-slate-700">{submission.votesAgainst}</span>
          {" / возд. "}<span className="font-semibold text-slate-700">{submission.votesAbstain}</span>
        </div>
        <div className="text-slate-400">
          Явочный лист: {submission.attendees?.length ?? 0} строк
        </div>
      </div>

      {/* Conference Photo Preview */}
      <div className="flex justify-center items-center">
        {submission.files?.photo ? (
          <a
            href={`/api/conferencia/admin/submissions/${submission.id}/files/photo`}
            target="_blank"
            rel="noopener noreferrer"
            title="Открыть фото в новой вкладке"
            className="group relative block overflow-hidden rounded-md border border-slate-200 w-11 h-11 bg-slate-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/conferencia/admin/submissions/${submission.id}/files/photo`}
              alt="Конференция"
              className="w-full h-full object-cover transition duration-300 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </a>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </div>

      {/* Action links */}
      <div className="space-y-2">
        <FileLinkGroup
          title="Бланки"
          submission={submission}
          slots={GENERATED_SLOTS}
          className="border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700"
        />
        <FileLinkGroup
          title="Сканы"
          submission={submission}
          slots={UPLOAD_SLOTS}
          className="border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
        />
        <a
          className="file-link h-8 px-2.5 text-xs border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold"
          href={`/api/conferencia/admin/submissions/${submission.id}/archive`}
        >
          Скачать весь пакет ZIP
        </a>
        <a
          className="file-link h-8 px-2.5 text-xs border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold"
          href={`/conferencia/${submission.id}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Ссылка, по которой отделение догружает документы — её можно переслать в РО"
        >
          Ссылка для РО
        </a>
      </div>
    </article>
  );
}
