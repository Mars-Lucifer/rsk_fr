import { isAdminSession } from "@/lib/rosdk-confrencia/admin";
import { listStoredSignedSubmissionsByRegion } from "@/lib/rosdk-confrencia/storage";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAdminSession(req)) {
    return res.status(401).json({ error: "Требуется вход в админ-панель." });
  }

  const region = req.query.region || "";
  const submissions = await listStoredSignedSubmissionsByRegion(region);

  return res.status(200).json({ submissions });
}
