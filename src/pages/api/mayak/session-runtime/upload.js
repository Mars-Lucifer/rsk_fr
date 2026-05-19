import crypto from "crypto";
import { IncomingForm } from "formidable";

import { createMayakSessionReview, saveMayakSessionUploadFile, startMayakSessionBackgroundPreviewConversion } from "@/lib/mayakSessionRuntime";

const MAX_SESSION_UPLOAD_FILE_SIZE = 30 * 1024 * 1024;
const MAX_SESSION_SUBMISSION_TEXT_LENGTH = 3000;

export const config = {
    api: {
        bodyParser: false,
    },
};

function parseForm(req) {
    return new Promise((resolve, reject) => {
        const form = new IncomingForm({
            keepExtensions: true,
            maxFileSize: MAX_SESSION_UPLOAD_FILE_SIZE,
            multiples: false,
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

function readField(fields, key) {
    const value = fields?.[key];
    return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { fields, files } = await parseForm(req);
        const fileField = files?.file;
        const file = Array.isArray(fileField) ? fileField[0] : fileField;
        const submissionText = String(readField(fields, "submissionText") || "").trim();
        if (!file && !submissionText) {
            return res.status(400).json({ success: false, error: "\u041d\u0443\u0436\u043d\u043e \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0444\u0430\u0439\u043b \u0438\u043b\u0438 \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0442\u0435\u043a\u0441\u0442 \u043e\u0442\u0432\u0435\u0442\u0430" });
        }
        if (submissionText.length > MAX_SESSION_SUBMISSION_TEXT_LENGTH) {
            return res.status(400).json({ success: false, error: `\u0422\u0435\u043a\u0441\u0442 \u043e\u0442\u0432\u0435\u0442\u0430 \u043d\u0435 \u0434\u043e\u043b\u0436\u0435\u043d \u043f\u0440\u0435\u0432\u044b\u0448\u0430\u0442\u044c ${MAX_SESSION_SUBMISSION_TEXT_LENGTH} \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432` });
        }

        const sessionId = String(readField(fields, "sessionId") || "");
        const userId = String(readField(fields, "userId") || "");
        const taskNumber = String(readField(fields, "taskNumber") || "");
        const taskName = String(readField(fields, "taskName") || "");
        const taskTitle = String(readField(fields, "taskTitle") || "");
        const contentType = String(readField(fields, "contentType") || "");
        const description = String(readField(fields, "description") || "");
        const taskText = String(readField(fields, "taskText") || "");
        const taskIndex = parseInt(String(readField(fields, "taskIndex") || "0"), 10);
        const secondsSpent = parseInt(String(readField(fields, "secondsSpent") || "0"), 10);

        const reviewId = crypto.randomUUID();
        const storedFile = file
            ? await saveMayakSessionUploadFile({
                  sessionId,
                  userId,
                  reviewId,
                  file,
              })
            : null;

        const review = await createMayakSessionReview({
            sessionId,
            userId,
            reviewId,
            taskNumber,
            taskIndex,
            taskName,
            taskTitle,
            contentType,
            description,
            taskText,
            secondsSpent,
            storedFile,
            submissionText,
        });

        if (
            storedFile?.extension === ".doc" ||
            storedFile?.extension === ".docx" ||
            storedFile?.extension === ".ppt" ||
            storedFile?.extension === ".pptx"
        ) {
            void startMayakSessionBackgroundPreviewConversion({ sessionId, reviewId }).catch(() => {});
        }

        return res.status(200).json({ success: true, data: review });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось загрузить файл проверки" });
    }
}
