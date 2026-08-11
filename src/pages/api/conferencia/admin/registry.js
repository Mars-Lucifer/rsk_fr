import { Packer } from "docx";
import { isAdminSession } from "@/lib/rosdk-confrencia/admin";
import { listStoredSubmissionsByRegion } from "@/lib/rosdk-confrencia/storage";
import { buildRegistryDocument } from "@/lib/rosdk-confrencia/documents";

/** Реестр делегатов по бланку Оргкомитета — DOCX, который печатает Мандатная комиссия. */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAdminSession(req)) {
    return res.status(401).json({ error: "Требуется вход в админ-панель." });
  }

  const region = req.query.region || "";
  const submissions = await listStoredSubmissionsByRegion(region);
  const buffer = await Packer.toBuffer(buildRegistryDocument(submissions));

  const name = `реестр-делегатов-конференции.docx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Content-Length", String(buffer.byteLength));

  return res.status(200).send(buffer);
}
