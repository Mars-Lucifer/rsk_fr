import { getMayakSessionById } from "@/lib/mayakSessions";
import { resolveMasterSecret } from "@/lib/mayakSessionLinks";

const MAYAK_GUEST_SUFFIX = "aaaaa";

// Редирект делаем на сервере: клиентский вариант успевал показать экран
// «Открываем тренажёр…», то есть лишнюю вспышку на пути мастера в игру.
// Здесь браузер получает 307 сразу и промежуточной страницы не видит.
export async function getServerSideProps({ params }) {
    const secret = String(params?.secret || "");
    const record = await resolveMasterSecret(secret);

    if (!record) {
        return { props: { error: "Ссылка недействительна" } };
    }

    const session = await getMayakSessionById(record.sessionId);
    if (!session || String(session.status || "") !== "active") {
        return { props: { error: "Сессия завершена или недоступна" } };
    }

    if (!record.masterToken) {
        return { props: { error: "Для этой сессии не создан мастер-доступ" } };
    }

    const token = `${record.masterToken}${MAYAK_GUEST_SUFFIX}`;
    const dashPart = record.dashboardSecret ? `&dash=${encodeURIComponent(record.dashboardSecret)}` : "";

    return {
        redirect: {
            destination: `/tools/mayak-oko?token=${encodeURIComponent(token)}${dashPart}`,
            permanent: false,
        },
    };
}

// Рендерится только когда редиректа не случилось — то есть при ошибке доступа.
export default function MayakMasterEntryPage({ error }) {
    return (
        <main style={shellStyle}>
            <div style={cardStyle}>
                <h1 style={titleStyle}>Не удалось открыть сессию</h1>
                <p style={textStyle}>{error || "Ссылка недействительна"}</p>
            </div>
        </main>
    );
}

const shellStyle = {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background: "#f5f7f8",
    color: "#101820",
};

const cardStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    textAlign: "center",
};

const titleStyle = {
    margin: 0,
    fontSize: 22,
};

const textStyle = {
    margin: 0,
    color: "#627178",
    fontSize: 15,
};
