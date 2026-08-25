// Заявка живёт на /conferencia?id=..., отдельной страницы у неё больше нет.
// Адрес /conferencia/<id> остаётся рабочим: по нему уже могли разослать ссылки.

export async function getServerSideProps(context) {
  return {
    redirect: {
      destination: `/conferencia?id=${encodeURIComponent(context.params.id)}`,
      permanent: false,
    },
  };
}

export default function LegacySubmissionPage() {
  return null;
}
