import fs from "node:fs/promises";
import { IncomingForm } from "formidable";
import { isAdminSession } from "@/lib/rosdk-confrencia/admin";
import {
  listTemplates,
  removeTemplate,
  saveTemplate,
  templateKind,
} from "@/lib/rosdk-confrencia/templates";
import { MAX_UPLOAD_BYTES } from "@/lib/rosdk-confrencia/rateLimit";

export const config = { api: { bodyParser: false } };

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ keepExtensions: true, maxFileSize: MAX_UPLOAD_BYTES });
    form.parse(req, (error, fields, files) =>
      error ? reject(error) : resolve({ fields, files }),
    );
  });
}

function single(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
  if (!isAdminSession(req)) {
    return res.status(401).json({ error: "Требуется вход в админ-панель." });
  }

  if (req.method === "GET") {
    return res.status(200).json({ templates: await listTemplates() });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fields, files } = await parseForm(req);
    const key = String(single(fields.key) ?? "");
    const action = String(single(fields.action) ?? "upload");

    if (!templateKind(key)) {
      return res.status(400).json({ error: "Неизвестный бланк." });
    }

    // Возврат к встроенному бланку — тем же роутом, чтобы форма была одна.
    if (action === "reset") {
      await removeTemplate(key);
      res.writeHead(303, { Location: "/conferencia/admin#templates" });
      res.end();
      return undefined;
    }

    const file = single(files.template);
    if (!file) {
      return res.status(400).json({ error: "Файл не выбран." });
    }

    const name = file.originalFilename || "";
    if (!name.toLowerCase().endsWith(".docx")) {
      return res.status(400).json({
        error: "Нужен файл .docx. Старый .doc откройте в Word и сохраните как «Документ Word».",
      });
    }

    await saveTemplate(key, await fs.readFile(file.filepath), name);

    res.writeHead(303, { Location: "/conferencia/admin#templates" });
    res.end();
    return undefined;
  } catch (error) {
    return res.status(400).json({ error: error.message || "Не удалось сохранить бланк." });
  }
}
