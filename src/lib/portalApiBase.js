// Базовый адрес портального бэкенда (`api.rosdk.ru`, репозиторий RSK_back).
//
// Зачем: адрес был захардкожен в 41 файле прокси-роутов, из-за чего локальный
// dev-сервер читал и писал боевые данные. Теперь он берётся из окружения, а
// прод-значение остаётся дефолтом — если переменную не задать, поведение
// ровно то же, что и раньше.
//
// Локальный контур (см. docs/contest-core.md):
//   RSK_API_BASE=http://localhost:8002            — для серверного кода
//   NEXT_PUBLIC_RSK_API_BASE=http://localhost:8002 — для редиректов в браузере
//
// Две константы, а не одна: в клиентский бандл Next.js подставляет только
// переменные с префиксом NEXT_PUBLIC_, поэтому серверная сюда не долетит.

const DEFAULT_PORTAL_API_BASE = "https://api.rosdk.ru";

function normalizeBase(value) {
    const normalized = String(value || "").trim();
    if (!normalized) return "";
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

// Серверный код: API-роуты `src/pages/api/*` и серверные хелперы `src/lib/*`.
export const PORTAL_API_BASE = normalizeBase(process.env.RSK_API_BASE) || DEFAULT_PORTAL_API_BASE;

// Клиентский код: ссылки и редиректы, которые открывает браузер (OAuth).
export const PUBLIC_PORTAL_API_BASE = normalizeBase(process.env.NEXT_PUBLIC_RSK_API_BASE) || DEFAULT_PORTAL_API_BASE;
