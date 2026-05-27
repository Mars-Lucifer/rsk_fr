import formidable from "formidable";

import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import { deleteMayakTokenMaterial, listMayakTokenMaterials, uploadMayakTokenMaterial } from "@/lib/mayakTokenMaterials";

export const config = {
    api: {
        bodyParser: false,
    },
};

const MAX_FILE_SIZE = 500 * 1024 * 1024;

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

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    try {
        if (req.method === "GET") {
            const materials = await listMayakTokenMaterials();
            return res.status(200).json({ success: true, data: materials });
        }

        if (req.method === "POST") {
            const { fields, files } = await parseForm(req);
            const file = firstValue(files.file);
            if (!file?.filepath) {
                return res.status(400).json({ success: false, error: "Файл не передан" });
            }

            const material = await uploadMayakTokenMaterial({
                filePath: file.filepath,
                originalName: file.originalFilename || file.newFilename || "material",
                size: file.size,
                title: firstValue(fields.title),
            });
            return res.status(200).json({ success: true, data: material });
        }

        if (req.method === "DELETE") {
            const { fields } = await parseForm(req);
            const material = await deleteMayakTokenMaterial(firstValue(fields.id));
            return res.status(200).json({ success: true, data: material });
        }

        return res.status(405).json({ success: false, error: "Method not allowed" });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось обработать материалы" });
    }
}
