// Локальное состояние тренажёра живёт под одним фиксированным префиксом
// `trainer_v2` и не привязано ни к сессии, ни к участнику: в браузере всегда
// одна личность (куки `activated_key` и `active_user` — по одной штуке).
// Поэтому вход по новой ссылке должен начинаться с чистого листа, иначе
// участник видит «пройдено» и закрытые типы контента из прошлой игры.
//
// На сервере это уже так: у сессии свой бакет рантайма, у участника — свой
// userId (случайный при каждой регистрации), а завершение сессии сносит бакет
// целиком. Здесь — клиентский эквивалент того же правила.

const TRAINER_PREFIX = "trainer_v2";
const IDENTITY_KEY = `${TRAINER_PREFIX}_identity`;
// История прошлых прогонов — архив, а не состояние текущей игры: переживает сброс.
const HISTORY_KEY = `${TRAINER_PREFIX}_history`;
const LOG_KEY = `${TRAINER_PREFIX}_session_tasks_log`;
// Промпты уходят на сервер только метриками (имя, минуты, индекс), сами тексты
// полей живут лишь в логе. Перед сбросом кладём его в один слот: если прошлый
// прогон не был завершён штатно, тексты не пропадут совсем.
const PREV_LOG_KEY = `${TRAINER_PREFIX}_prev_session_tasks_log`;
const SESSION_KEYS = [`${TRAINER_PREFIX}_currentTaskIndex`, `${TRAINER_PREFIX}_taskTimer`];

function getStores() {
    return {
        local: typeof globalThis !== "undefined" ? globalThis.localStorage : null,
        session: typeof globalThis !== "undefined" ? globalThis.sessionStorage : null,
    };
}

function collectTrainerKeys(store) {
    const keys = [];
    for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key && key.startsWith(TRAINER_PREFIX) && key !== HISTORY_KEY) {
            keys.push(key);
        }
    }
    return keys;
}

// Сносит состояние текущего прогона. Серверных данных не касается: там свой
// участник со своим userId, чужие сессии не затрагиваются.
export function resetTrainerLocalState() {
    const { local, session } = getStores();

    try {
        if (local) {
            const previousLog = local.getItem(LOG_KEY);
            collectTrainerKeys(local).forEach((key) => local.removeItem(key));
            if (previousLog) {
                local.setItem(PREV_LOG_KEY, previousLog);
            }
        }
    } catch {
        // Приватный режим и переполненная квота бросают на любом обращении —
        // вход из-за этого падать не должен.
    }

    try {
        if (session) {
            SESSION_KEYS.forEach((key) => session.removeItem(key));
        }
    } catch {
        // См. выше.
    }
}

// Личность собираем из трёх полей, а не из одного `sessionId`: у упрощённой
// ссылки (legacy-токен) sessionId нет вовсе, и по нему переход «участническая →
// упрощённая» внутри одной сессии не отличить от продолжения игры.
export function buildTrainerIdentity({ userId, sessionId, token } = {}) {
    return [userId, sessionId, token].map((part) => String(part || "").trim()).join("|");
}

// Вызывать в момент регистрации, а не при открытии страницы: F5 и возврат во
// вкладку до сюда не доходят (в settings.js их отсекает hasRegisteredUser),
// поэтому текущая игра не пострадает.
export function syncTrainerLocalIdentity(identityParts) {
    const nextIdentity = buildTrainerIdentity(identityParts);
    if (!nextIdentity.replace(/\|/g, "")) {
        return false;
    }

    const { local } = getStores();
    let previousIdentity = "";
    try {
        previousIdentity = local ? local.getItem(IDENTITY_KEY) || "" : "";
    } catch {
        previousIdentity = "";
    }

    if (previousIdentity === nextIdentity) {
        return false;
    }

    resetTrainerLocalState();

    try {
        if (local) {
            local.setItem(IDENTITY_KEY, nextIdentity);
        }
    } catch {
        // Не записалась метка — в худшем случае следующий вход сбросится повторно.
    }

    return true;
}
