import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/router";

// Мастер входит в тренажёр по своей ссылке (?dash=<секрет дашборда>) и должен
// открывать дашборд, не выходя из игры. Секрет дублируем в sessionStorage:
// экраны тренажёра переключаются по state, но после перезагрузки страницы или
// чистки query кнопка не должна пропадать.
const MASTER_DASH_KEY = "mayak_master_dash";

function readStoredSecret() {
    try {
        return sessionStorage.getItem(MASTER_DASH_KEY) || "";
    } catch {
        return "";
    }
}

export default function MasterDashboardLink() {
    const router = useRouter();
    const fromQuery = router.isReady ? String(router.query.dash || "").trim() : "";

    useEffect(() => {
        if (!fromQuery) return;
        try {
            sessionStorage.setItem(MASTER_DASH_KEY, fromQuery);
        } catch {}
    }, [fromQuery]);

    // Через useSyncExternalStore, а не setState в эффекте: на сервере снапшот
    // пустой, поэтому разметка сходится и гидрация не ломается.
    const subscribe = useCallback(() => () => {}, []);
    const storedSecret = useSyncExternalStore(
        subscribe,
        readStoredSecret,
        () => ""
    );

    const dashSecret = fromQuery || storedSecret;

    // Кнопка ведёт на дашборд, а он с неразмеченной колодой ничего не покажет.
    // Спрашиваем готовность у того же эндпоинта, что и сам дашборд: пока ответа
    // нет — кнопки нет, чтобы она не мигала и не пропадала на глазах.
    const [deckReady, setDeckReady] = useState(false);
    useEffect(() => {
        if (!dashSecret) return undefined;
        let cancelled = false;
        fetch(`/api/mayak/master/dashboard?secret=${encodeURIComponent(dashSecret)}`)
            .then((response) => response.json())
            .then((payload) => {
                if (!cancelled) setDeckReady(payload?.data?.deck?.dashboardReady === true);
            })
            .catch(() => {
                if (!cancelled) setDeckReady(false);
            });
        return () => {
            cancelled = true;
        };
    }, [dashSecret]);

    if (!dashSecret || !deckReady) return null;

    return (
        <a
            // from=trainer — метка «пришли из тренажёра в этой же вкладке».
            // По ней дашборд решает, показывать ли «Назад»: при открытии ссылки
            // напрямую (проектор, второе устройство) возвращаться некуда.
            href={`/mayak-dashboard/${encodeURIComponent(dashSecret)}?from=trainer`}
            title="Открыть дашборд сессии"
            aria-label="Открыть дашборд сессии"
            className="inline-flex items-center justify-center gap-1.5 !rounded-full border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 !px-3 !h-8 leading-none text-sm font-semibold text-indigo-700 whitespace-nowrap no-underline transition-colors">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <rect x="7" y="11" width="3" height="6" />
                <rect x="12" y="7" width="3" height="10" />
                <rect x="17" y="13" width="3" height="4" />
            </svg>
            <span className="leading-none">Дашборд</span>
        </a>
    );
}
