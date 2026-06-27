import { createReadStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { getSectionFilePath, getSourceFilePath, sanitizeSectionId } from "../../../lib/mayakContentStorage.js";

// Роут стримит файлы контента (PDF/изображения/аудио/видео), которые штатно
// превышают дефолтный 4MB-лимит ответа API-роутов Next.js. Без этого Next
// сыпет предупреждениями "API response exceeds 4MB" на каждый крупный файл.
export const config = {
    api: {
        responseLimit: false,
    },
};

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".pdf") return "application/pdf";
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".webp") return "image/webp";
    if (ext === ".gif") return "image/gif";
    if (ext === ".svg") return "image/svg+xml";
    if (ext === ".mp4") return "video/mp4";
    if (ext === ".webm") return "video/webm";
    if (ext === ".mov") return "video/quicktime";
    if (ext === ".mp3") return "audio/mpeg";
    if (ext === ".wav") return "audio/wav";
    if (ext === ".m4a") return "audio/mp4";
    if (ext === ".ogg") return "audio/ogg";
    if (ext === ".csv") return "text/csv; charset=utf-8";
    if (ext === ".txt") return "text/plain; charset=utf-8";
    if (ext === ".json") return "application/json; charset=utf-8";
    if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (ext === ".doc") return "application/msword";
    if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return "application/octet-stream";
}

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { scope = "section", sectionId = "", type = "files", filename = "", download = "" } = req.query;
        let filePath;

        if (scope === "source") {
            filePath = await getSourceFilePath(filename);
        } else {
            const safeSectionId = sanitizeSectionId(sectionId);
            if (!safeSectionId) {
                return res.status(400).json({ error: "Недопустимый sectionId" });
            }
            filePath = await getSectionFilePath(safeSectionId, type, filename);
        }

        const stat = await fs.stat(filePath);
        const fileName = path.basename(filePath);
        const shouldDownload = download === "1" || download === "true";
        res.setHeader("Content-Type", getContentType(filePath));
        res.setHeader("Content-Length", stat.size);
        res.setHeader("Content-Disposition", `${shouldDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
        createReadStream(filePath).pipe(res);
    } catch (error) {
        if (error.code === "ENOENT") {
            return res.status(404).json({ error: "Файл не найден" });
        }
        return res.status(500).json({ error: error.message });
    }
}
