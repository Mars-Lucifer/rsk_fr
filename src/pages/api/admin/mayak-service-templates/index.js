import { promises as fs } from "fs";
import path from "path";
import formidable from "formidable";

import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import {
    deleteTemplateFile,
    readServiceTemplates,
    removeFormat,
    removeService,
    saveTemplateFile,
    slugify,
    upsertFormat,
    upsertService,
    validatePptxTemplate,
} from "@/lib/mayakServiceTemplates";

export const config = {
    api: {
        bodyParser: false,
    },
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function parseForm(req) {
    return new Promise((resolve, reject) => {
        const form = formidable({
            multiples: false,
            maxFiles: 1,
            maxFileSize: MAX_FILE_SIZE,
            allowEmptyFiles: false,
        });
        form.parse(req, (error, fields, files) => {
            if (error) reject(error);
            else resolve({ fields, files });
        });
    });
}

function firstValue(value) {
    return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    try {
        if (req.method === "GET") {
            const registry = await readServiceTemplates();
            return res.status(200).json({ success: true, data: registry });
        }

        if (req.method === "POST") {
            const { fields, files } = await parseForm(req);
            const serviceName = firstValue(fields.serviceName);
            const formatName = firstValue(fields.formatName);
            const serviceUrl = firstValue(fields.serviceUrl);
            const file = firstValue(files.file);

            if (!serviceName || !String(serviceName).trim()) {
                return res.status(400).json({ success: false, error: "Укажите сервис" });
            }

            // Режим «каталог»: только сервис (имя + ссылка), без формата и файла.
            const hasFormat = formatName && String(formatName).trim();
            const hasFile = !!file?.filepath;
            if (!hasFormat && !hasFile) {
                const { registry } = await upsertService({ serviceName, serviceUrl });
                return res.status(200).json({ success: true, data: registry });
            }

            // Режим «формат + шаблон».
            if (!hasFormat) {
                return res.status(400).json({ success: false, error: "Укажите формат" });
            }
            if (!hasFile) {
                return res.status(400).json({ success: false, error: "Файл шаблона не передан" });
            }

            const extension = path.extname(file.originalFilename || "").toLowerCase();
            if (extension !== ".pptx") {
                return res.status(400).json({ success: false, error: "Допускается только файл .pptx" });
            }

            const buffer = await fs.readFile(file.filepath);

            const validation = await validatePptxTemplate(buffer);
            if (!validation.valid) {
                return res.status(422).json({ success: false, error: validation.error });
            }

            const templateFile = await saveTemplateFile(buffer, {
                serviceKey: slugify(serviceName),
                formatKey: slugify(formatName),
            });

            const { registry, replacedFile } = await upsertFormat({ serviceName, formatName, templateFile, serviceUrl });
            if (replacedFile && replacedFile !== templateFile) {
                await deleteTemplateFile(replacedFile);
            }

            return res.status(200).json({ success: true, data: registry });
        }

        if (req.method === "DELETE") {
            const { fields } = await parseForm(req);
            const serviceKey = String(firstValue(fields.serviceKey) || "").trim();
            const formatKey = String(firstValue(fields.formatKey) || "").trim();

            if (!serviceKey) {
                return res.status(400).json({ success: false, error: "Не указан сервис" });
            }

            const { registry, removedFiles } = formatKey
                ? await removeFormat(serviceKey, formatKey)
                : await removeService(serviceKey);

            for (const fileName of removedFiles) {
                await deleteTemplateFile(fileName);
            }

            return res.status(200).json({ success: true, data: registry });
        }

        return res.status(405).json({ success: false, error: "Method not allowed" });
    } catch (error) {
        return res.status(400).json({ success: false, error: error?.message || "Ошибка обработки запроса" });
    }
}
