import { pickRandomMissionForRole } from "@/lib/mayakSecretMissions";

// Выдача тайной миссии по роли вне сессионного режима.
// Сессионный режим использует /api/mayak/session-runtime/secret-mission,
// где миссия закрепляется за участником на сервере. Здесь же миссия только
// выбирается из пула по роли, а её сохранение лежит на клиенте (localStorage),
// поскольку привязки к сессии/участнику нет.
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const role = String((req.body && req.body.role) || "").trim();
        if (!role) {
            return res.status(400).json({ success: false, error: "Не указана роль" });
        }

        const mission = await pickRandomMissionForRole(role);
        if (!mission) {
            return res.status(404).json({ success: false, error: "Для этой роли тайные миссии пока не заданы" });
        }

        return res.status(200).json({ success: true, data: { ...mission, role } });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось получить тайную миссию" });
    }
}
