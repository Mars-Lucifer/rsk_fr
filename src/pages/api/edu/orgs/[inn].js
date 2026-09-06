import { getEduOrg, EduRegistryMissingError } from "@/lib/eduRegistry";

/**
 * Карточка организации по ИНН: сама организация, её лицензии, программы
 * и адреса занятий.
 *
 * ИНН приходит строкой и строкой же ищется. Приводить его к числу нельзя:
 * у 298 организаций справочника ведущий ноль значим.
 */
export default function eduOrgCard(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, error: "method_not_allowed" });
  }

  try {
    const card = getEduOrg(req.query.inn);

    if (!card) {
      return res.status(404).json({ success: false, error: "not_found" });
    }

    return res.status(200).json({ success: true, data: card });
  } catch (error) {
    if (error instanceof EduRegistryMissingError) {
      return res.status(503).json({ success: false, error: "registry_missing", message: error.message });
    }

    return res.status(500).json({ success: false, error: error.message });
  }
}
