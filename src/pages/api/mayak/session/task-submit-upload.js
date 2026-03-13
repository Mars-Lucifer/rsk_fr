import fs from "fs";
import { IncomingForm } from "formidable";

import { getMayakSessionByToken, markMayakTaskSubmitted } from "@/lib/mayakSessions";
import { saveMayakSessionAttachment } from "@/lib/mayakSessionFiles";

export const config = {
    api: {
        bodyParser: false,
    },
};

function parseForm(req) {
    return new Promise((resolve, reject) => {
        const form = new IncomingForm({
            keepExtensions: true,
            maxFileSize: 50 * 1024 * 1024,
            multiples: false,
        });

        form.parse(req, (err, fields, files) => {
            if (err) reject(err);
            else resolve({ fields, files });
        });
    });
}

function getFieldValue(value) {
    return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { fields, files } = await parseForm(req);
        const token = String(getFieldValue(fields.token) || "").trim();
        const userId = String(getFieldValue(fields.userId) || "").trim();
        const taskNumber = String(getFieldValue(fields.taskNumber) || "").trim();
        const taskName = String(getFieldValue(fields.taskName) || "").trim();
        const sectionId = String(getFieldValue(fields.sectionId) || "").trim() || null;
        const elapsedSeconds = Number(getFieldValue(fields.elapsedSeconds) || 0) || 0;
        const file = Array.isArray(files.file) ? files.file[0] : files.file;

        if (!token || !userId || !taskNumber || !file) {
            return res.status(400).json({ success: false, error: "token, userId, taskNumber и file обязательны" });
        }

        const session = getMayakSessionByToken(token);
        if (!session) {
            return res.status(404).json({ success: false, error: "Сессия не найдена" });
        }

        const taskKey = `${sectionId || "global"}:${taskNumber}`;
        const attachment = saveMayakSessionAttachment({
            sessionId: session.id,
            userId,
            taskKey,
            sourcePath: file.filepath,
            originalFilename: file.originalFilename || file.newFilename || "file",
            mimetype: file.mimetype || "application/octet-stream",
            size: file.size || 0,
        });

        try {
            const updated = markMayakTaskSubmitted({
                token,
                userId,
                taskNumber,
                taskName,
                sectionId,
                elapsedSeconds,
                attachments: [attachment],
            });
            return res.status(200).json({ success: true, data: updated, attachment });
        } finally {
            try {
                fs.unlinkSync(file.filepath);
            } catch {}
        }
    } catch (error) {
        console.error("Error uploading MAYAK task attachment:", error);
        return res.status(500).json({ success: false, error: error.message || "Ошибка загрузки файла" });
    }
}
