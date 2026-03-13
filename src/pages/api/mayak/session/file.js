import fs from "fs";
import path from "path";

import { getMayakSessionAttachmentPath } from "@/lib/mayakSessionFiles";
import { getMayakParticipantTaskContext, getMayakTaskReviewContext } from "@/lib/mayakSessions";

function findAttachment(taskState, attachmentId) {
    return (taskState?.attachments || []).find((item) => item.id === attachmentId) || null;
}

function getFallbackMimeType(filename) {
    const ext = path.extname(String(filename || "")).toLowerCase();
    if ([".jpg", ".jpeg"].includes(ext)) return "image/jpeg";
    if (ext === ".png") return "image/png";
    if (ext === ".gif") return "image/gif";
    if (ext === ".webp") return "image/webp";
    if (ext === ".pdf") return "application/pdf";
    if (ext === ".mp4") return "video/mp4";
    if (ext === ".mov") return "video/quicktime";
    if (ext === ".webm") return "video/webm";
    if (ext === ".txt") return "text/plain; charset=utf-8";
    return "application/octet-stream";
}

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const token = String(req.query.token || "").trim();
        const userId = String(req.query.userId || "").trim();
        const taskKey = String(req.query.taskKey || "").trim();
        const attachmentId = String(req.query.attachmentId || "").trim();
        const mode = String(req.query.mode || "inspector").trim();
        const download = String(req.query.download || "false") === "true";

        if (!token || !userId || !taskKey || !attachmentId) {
            return res.status(400).json({ success: false, error: "token, userId, taskKey и attachmentId обязательны" });
        }

        const context = mode === "participant" ? getMayakParticipantTaskContext({ token, userId, taskKey }) : getMayakTaskReviewContext({ token, inspectorUserId: userId, taskKey });
        if (!context) {
            return res.status(404).json({ success: false, error: "Контекст задания не найден" });
        }

        const attachment = findAttachment(context.taskState, attachmentId);
        if (!attachment) {
            return res.status(404).json({ success: false, error: "Файл не найден" });
        }

        const filePath = getMayakSessionAttachmentPath(attachment.relativePath);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: "Файл отсутствует на диске" });
        }

        const contentType = attachment.mimetype || getFallbackMimeType(attachment.originalFilename);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", String(fs.statSync(filePath).size));
        res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(attachment.originalFilename)}`);

        return fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        console.error("Error reading MAYAK session attachment:", error);
        return res.status(500).json({ success: false, error: error.message || "Ошибка чтения файла" });
    }
}
