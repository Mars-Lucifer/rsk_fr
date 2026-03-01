import { promises as fs } from "fs";
import path from "path";

const ADMIN_PASSWORD = "a12345";
const V2_DIR = path.join(process.cwd(), "public", "tasks-2", "v2");

function checkAuth(req) {
    const password = req.query.password || req.body?.password;
    return password === ADMIN_PASSWORD;
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "50mb",
        },
    },
};

export default async function handler(req, res) {
    if (!checkAuth(req)) {
        return res.status(403).json({ success: false, error: "Неверный пароль" });
    }

    const sectionId = req.query.sectionId || req.body?.sectionId || req.query.range || req.body?.range;
    if (!sectionId) {
        return res.status(400).json({ success: false, error: "Укажите sectionId или range" });
    }

    // Защита от path traversal
    if (sectionId.includes("..") || sectionId.includes("/") || sectionId.includes("\\") || path.basename(sectionId) !== sectionId) {
        return res.status(400).json({ success: false, error: "Недопустимый sectionId" });
    }

    const rangeDir = path.join(V2_DIR, sectionId);

    // GET — список файлов по типу (files или instructions)
    if (req.method === "GET") {
        try {
            const { type } = req.query;
            const dirPath = type === "instructions"
                ? path.join(rangeDir, "Instructions")
                : path.join(rangeDir, "Files");

            let files = [];
            try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                files = entries.filter((e) => e.isFile()).map((e) => e.name);
            } catch {}

            return res.status(200).json({ success: true, data: files });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // POST — загрузка файла (base64)
    if (req.method === "POST") {
        try {
            const { type, filename, data } = req.body;

            if (!filename || !data) {
                return res.status(400).json({ success: false, error: "filename и data обязательны" });
            }

            const safeName = path.basename(filename);
            const dirPath = type === "instructions"
                ? path.join(rangeDir, "Instructions")
                : path.join(rangeDir, "Files");

            await fs.mkdir(dirPath, { recursive: true });
            const buffer = Buffer.from(data, "base64");
            await fs.writeFile(path.join(dirPath, safeName), buffer);

            return res.status(200).json({ success: true, filename: safeName });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // DELETE — удаление файла
    if (req.method === "DELETE") {
        try {
            const { type, filename } = req.body;

            if (!filename) {
                return res.status(400).json({ success: false, error: "filename обязателен" });
            }

            const safeName = path.basename(filename);
            const dirPath = type === "instructions"
                ? path.join(rangeDir, "Instructions")
                : path.join(rangeDir, "Files");

            await fs.unlink(path.join(dirPath, safeName));
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
