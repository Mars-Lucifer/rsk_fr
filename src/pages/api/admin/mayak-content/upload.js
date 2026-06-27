import { requireMayakAdmin } from "../../../../lib/mayakAdminAuth.js";
import {
    deleteSectionFile,
    listSectionFiles,
    writeSectionFile,
} from "../../../../lib/mayakContentStorage.js";
import { invalidateRangesCache } from "../../../../lib/mayakContentCache.js";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "50mb",
        },
    },
};

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    const sectionId = req.query.sectionId || req.body?.sectionId || req.query.range || req.body?.range;
    if (!sectionId) {
        return res.status(400).json({ success: false, error: "Укажите sectionId или range" });
    }

    if (req.method === "GET") {
        try {
            const { type } = req.query;
            const files = await listSectionFiles(sectionId, type);
            return res.status(200).json({ success: true, data: files });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    if (req.method === "POST") {
        try {
            const { type, filename, data } = req.body;
            if (!filename || !data) {
                return res.status(400).json({ success: false, error: "filename и data обязательны" });
            }
            const buffer = Buffer.from(data, "base64");
            const result = await writeSectionFile(sectionId, type, filename, buffer);
            invalidateRangesCache();
            return res.status(200).json({ success: true, filename: result.filename });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    if (req.method === "DELETE") {
        try {
            const { type, filename } = req.body;
            if (!filename) {
                return res.status(400).json({ success: false, error: "filename обязателен" });
            }
            await deleteSectionFile(sectionId, type, filename);
            invalidateRangesCache();
            return res.status(200).json({ success: true });
        } catch (error) {
            if (error.code === "ENOENT") {
                return res.status(404).json({ success: false, error: "Файл не найден" });
            }
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
