import { isAdminSession } from "@/lib/rosdk-confrencia/admin";
import { updateStoredRegionLink } from "@/lib/rosdk-confrencia/storage";
import { regions } from "@/lib/rosdk-confrencia/regions";

const TEXT_FIELDS = ["responsibleName", "responsiblePhone", "responsibleMax"];

/** Учёт рассылки: отметка «отправлено» и контакты ответственного в отделении. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAdminSession(req)) {
    return res.status(401).json({ error: "Требуется вход в панель." });
  }

  const region = String(req.body?.region ?? "");

  if (!regions.includes(region)) {
    return res.status(400).json({ error: "Неизвестный субъект РФ." });
  }

  const patch = {};

  if (req.body?.sent !== undefined) {
    patch.sent = Boolean(req.body.sent);
  }

  for (const field of TEXT_FIELDS) {
    if (req.body?.[field] !== undefined) {
      // Длину режем здесь: поле правится вручную и в базу попадает как есть.
      patch[field] = String(req.body[field]).slice(0, 200);
    }
  }

  const link = await updateStoredRegionLink(region, patch);

  return res.status(200).json({ region, link });
}
