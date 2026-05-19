import fs from "fs/promises";
import path from "path";
import formidable from "formidable";

import { requireMayakAdmin } from "@/lib/mayakAdminAuth";

export const config = {
    api: {
        bodyParser: false,
    },
};

const PUBLIC_DIR = path.join(process.cwd(), "public", "service-instructions");
const PUBLIC_URL_PREFIX = "/service-instructions";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function parseForm(req) {
    return new Promise((resolve, reject) => {
        const form = formidable({
            multiples: false,
            maxFiles: 1,
            maxFileSize: MAX_FILE_SIZE,
            allowEmptyFiles: false,
        });

        form.parse(req, (error, fields, files) => {
            if (error) {
                reject(error);
                return;
            }
            resolve({ fields, files });
        });
    });
}

function firstValue(value) {
    return Array.isArray(value) ? value[0] : value;
}

function safeSlug(value) {
    return String(value || "service")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) || "service";
}

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { fields, files } = await parseForm(req);
        const file = firstValue(files.file);

        if (!file?.filepath) {
            return res.status(400).json({ success: false, error: "Файл не передан" });
        }

        const originalName = file.originalFilename || file.newFilename || "instruction";
        const extension = path.extname(originalName).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(extension)) {
            return res.status(400).json({ success: false, error: "Допустимы только JPG, PNG, WEBP или GIF" });
        }

        await fs.mkdir(PUBLIC_DIR, { recursive: true });

        const typeKey = safeSlug(firstValue(fields.typeKey));
        const serviceName = safeSlug(firstValue(fields.serviceName));
        const filename = `${typeKey}-${serviceName}-${Date.now()}${extension}`;
        const targetPath = path.join(PUBLIC_DIR, filename);

        await fs.copyFile(file.filepath, targetPath);

        return res.status(200).json({
            success: true,
            url: `${PUBLIC_URL_PREFIX}/${filename}`,
            fileName: filename,
        });
    } catch (error) {
        return res.status(400).json({ success: false, error: error?.message || "Не удалось загрузить инструкцию" });
    }
}
