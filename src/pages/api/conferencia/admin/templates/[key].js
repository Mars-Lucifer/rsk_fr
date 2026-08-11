import { Packer } from "docx";
import { isAdminSession } from "@/lib/rosdk-confrencia/admin";
import { buildTemplateSample } from "@/lib/rosdk-confrencia/documents";
import { loadTemplate, templateKind } from "@/lib/rosdk-confrencia/templates";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Отдаёт бланк для правки в Word:
 * - `mode=sample` — образец с плейсхолдерами (всегда встроенный);
 * - без параметра — загруженный бланк, а если его нет, тот же образец.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAdminSession(req)) {
    return res.status(401).json({ error: "Требуется вход в админ-панель." });
  }

  const kind = templateKind(String(req.query.key ?? ""));

  if (!kind) {
    return res.status(404).json({ error: "Бланк не найден." });
  }

  const custom = req.query.mode === "sample" ? null : await loadTemplate(kind.key);
  const buffer = custom ?? (await Packer.toBuffer(buildTemplateSample(kind.key)));

  const name = `бланк-${kind.key}${custom ? "" : "-образец"}.docx`;
  res.setHeader("Content-Type", DOCX_MIME);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Content-Length", String(buffer.byteLength));

  return res.status(200).send(buffer);
}
