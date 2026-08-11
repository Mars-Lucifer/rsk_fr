import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { SubmissionPackage } from "@/components/rosdk-confrencia/SubmissionPackage";

export async function getServerSideProps(context) {
  const { getStoredSubmission, toPublicSubmission } = require("@/lib/rosdk-confrencia/storage");

  const submission = await getStoredSubmission(context.params.id);

  if (!submission) {
    return { notFound: true };
  }

  // Ссылку показываем на странице, чтобы её можно было скопировать и сохранить.
  const headers = context.req.headers;
  const forwardedProto = String(headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  const protocol = forwardedProto || (headers.host?.startsWith("localhost") ? "http" : "https");

  return {
    props: {
      submission: JSON.parse(JSON.stringify(toPublicSubmission(submission))),
      pageUrl: `${protocol}://${headers.host ?? ""}/conferencia/${submission.id}`,
    },
  };
}

export default function SubmissionPage({ submission, pageUrl }) {
  return (
    <main className="min-h-screen bg-[#f4f6fa] pb-16 text-slate-800">
      <Head>
        <title>{`Заявка РО ${submission.region} — Конференция РСК`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-5 sm:px-8">
          <Link href="/conferencia">
            <Image
              src="/rsk-logo.png"
              alt="Российское содружество колледжей"
              width={240}
              height={98}
              priority
              className="h-auto w-32 shrink-0 sm:w-40"
            />
          </Link>
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

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <SubmissionPackage submission={submission} pageUrl={pageUrl} />
      </div>
    </main>
  );
}
