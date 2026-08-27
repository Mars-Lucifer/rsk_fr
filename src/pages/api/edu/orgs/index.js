import { countEduOrgs, listEduOrgs, EduRegistryMissingError } from "@/lib/eduRegistry";

/**
 * Список организаций справочника с поиском и фильтрами.
 *
 * Без авторизации намеренно: данные публичные, из открытых государственных
 * реестров. Гейт на соседних /api/org/* защищает не данные, а вызов чужого
 * сервиса с токеном пользователя — здесь ни того, ни другого нет.
 *
 * Форма ответа выбрана такой, какой её будет отдавать orgs_service после
 * переноса: {success, data} — как в src/pages/api/org/all.js.
 */
export default function eduOrgsIndex(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, error: "method_not_allowed" });
  }

  const {
    q = "",
    region = "",
    kind = "",
    accreditation = "",
    sort = "",
    limit,
    offset,
    include_inactive: includeInactive,
  } = req.query;

  try {
    // Неизвестные значения фильтров и сортировки отбрасывает сам фасад — второй
    // список допустимых значений здесь неминуемо разъехался бы с первым.
    const filters = {
      q,
      region,
      kind,
      accreditation,
      sort,
      includeInactive: includeInactive === "1" || includeInactive === "true",
    };

    return res.status(200).json({
      success: true,
      data: {
        total: countEduOrgs(filters),
        items: listEduOrgs({ ...filters, limit, offset }),
      },
    });
  } catch (error) {
    if (error instanceof EduRegistryMissingError) {
      // Отдельный код: «справочник не собран» — состояние развёртывания,
      // а не сбой запроса, и чинится оно другой командой.
      return res.status(503).json({ success: false, error: "registry_missing", message: error.message });
    }

    return res.status(500).json({ success: false, error: error.message });
  }
}
