// Относительный путь, а не псевдоним @/: этот модуль вызывается и из
// проверочного скрипта обычным node, который про псевдонимы Next не знает.
import { PORTAL_API_BASE } from "./portalApiBase.js";

/**
 * Участие организации в конкурсе: индекс цифровой зрелости и его оси, число
 * участников и команд. Живёт в orgs_service, а не в справочнике — справочник
 * знает, что говорят государственные реестры, и про конкурс не знает ничего.
 *
 * Связь по ИНН. Прямого запроса по ИНН в orgs_service нет, поиск там идёт по
 * названиям, поэтому ищем по краткому имени и сверяем найденное по ИНН.
 * Имена в orgs_service залиты из этого же справочника (scripts/edu-registry-push.mjs),
 * так что совпадают посимвольно.
 *
 * ponytail: поиск по имени вместо поиска по ИНН. Потолок — организация с
 * пустым кратким именем или переименованная в обход заливки не найдётся и
 * будет показана как неучастник. Лечится строкой `| Orgs.inn.ilike(...)`
 * в orgs_crud.get_orgs, когда до того репозитория дойдут руки.
 */

const EMPTY = { participates: false };

/**
 * Метрики участия или {participates: false}.
 *
 * Никогда не бросает: справочник обязан открываться, даже когда orgs_service
 * лежит. Отсутствие метрик — обычное состояние организации, не сбой.
 */
export async function fetchEduParticipation({ inn, shortName, baseUrl = PORTAL_API_BASE }) {
    const needle = String(shortName || "").trim();
    const key = String(inn || "").trim();

    if (!needle || !key) {
        return EMPTY;
    }

    try {
        const params = new URLSearchParams({ name: needle, limit: "50" });
        const response = await fetch(`${baseUrl}/orgs/organizations/all?${params}`, {
            headers: { Accept: "application/json" },
            // Запрос идёт сервер-сервер и данных пользователя не касается:
            // это открытый список организаций, куки сюда не нужны.
            signal: AbortSignal.timeout(4000),
        });

        if (!response.ok) {
            return EMPTY;
        }

        const payload = await response.json();
        const items = Array.isArray(payload) ? payload : payload?.data || payload?.organizations || [];
        // Сверка именно по ИНН строкой: под один поисковый запрос попадает
        // несколько организаций, и взять первую попавшуюся значит соврать.
        const found = items.find((item) => String(item?.inn || "") === key);

        if (!found) {
            return EMPTY;
        }

        const axes = [
            ["Знания и навыки", found.knowledge_skills_z],
            ["Взаимодействие", found.knowledge_skills_v],
            ["Цифровая среда", found.digital_env_e],
            ["Защита данных", found.data_protection_z],
            ["Аналитика данных", found.data_analytics_d],
            ["Автоматизация", found.automation_a],
        ].map(([label, value]) => ({ label, value: Number(value) || 0 }));

        const star = Number(found.star) || 0;
        const members = Number(found.members_count) || 0;
        const teams = Number(found.teams_count) || 0;

        return {
            // Организация «участвует», когда у неё есть хоть что-то от конкурса.
            // Иначе карточка колледжа, который о конкурсе не слышал, показывала
            // бы шесть нулей — это шум, а не сведения.
            participates: star > 0 || members > 0 || teams > 0,
            portalId: found.id ?? null,
            star,
            members,
            teams,
            axes,
        };
    } catch {
        return EMPTY;
    }
}

/**
 * ИНН участников конкурса в порядке убывания индекса цифровой зрелости.
 *
 * Порядок приходит из orgs_service и здесь не пересортировывается: индекс
 * живёт там, и в справочнике его нет. Пустой список — верное состояние до
 * запуска конкурса, а не ошибка.
 *
 * ponytail: берём первую тысячу по индексу. Потолок — тысяча участников,
 * после которой хвост не попадёт в выдачу. Лечится постраничным обходом,
 * когда участников станет столько, что это будет иметь значение.
 */
export async function fetchParticipantInns({ baseUrl = PORTAL_API_BASE } = {}) {
    try {
        const params = new URLSearchParams({ sort_by: "index", order: "desc", limit: "1000" });
        const response = await fetch(`${baseUrl}/orgs/organizations/all?${params}`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(6000),
        });

        if (!response.ok) {
            return [];
        }

        const payload = await response.json();
        const items = Array.isArray(payload) ? payload : payload?.data || payload?.organizations || [];

        return items
            .filter((item) => Number(item?.star) > 0 || Number(item?.members_count) > 0 || Number(item?.teams_count) > 0)
            .map((item) => String(item?.inn || ""))
            .filter(Boolean);
    } catch {
        return [];
    }
}

/**
 * ИНН по внутреннему идентификатору orgs_service — для старых ссылок вида
 * /organizations/4 из профиля и команд. Возвращает null, если не нашлось.
 */
export async function fetchInnByPortalId(portalId, { baseUrl = PORTAL_API_BASE } = {}) {
    const id = String(portalId || "").trim();

    if (!/^\d+$/.test(id)) {
        return null;
    }

    try {
        const response = await fetch(`${baseUrl}/orgs/organizations/org/${id}`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(4000),
        });

        if (!response.ok) {
            return null;
        }

        const payload = await response.json();
        const org = payload?.data || payload;
        const inn = String(org?.inn || "").trim();

        return /^\d{10}$|^\d{12}$/.test(inn) ? inn : null;
    } catch {
        return null;
    }
}
