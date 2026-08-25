import { IncomingForm } from "formidable";

import { MAX_ANSWER_FILE_SIZE, MAX_ANSWER_TEXT_LENGTH, saveContestAnswer } from "@/lib/contestAnswers";
import { readLocalProfileMock, shouldUseLocalProfileMock } from "@/lib/localProfileMock";
import { fetchPortalProfileFromRequest } from "@/lib/portalProfileServer";

export const config = {
    api: {
        bodyParser: false,
    },
};

function parseForm(req) {
    return new Promise((resolve, reject) => {
        const form = new IncomingForm({
            keepExtensions: true,
            maxFileSize: MAX_ANSWER_FILE_SIZE,
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

// Личность участника берём на сервере, а не из формы: иначе ответ можно
// записать на чужой userId.
async function resolveParticipantId(req) {
    if (shouldUseLocalProfileMock(req, { fallbackWhenAuthMissing: true })) {
        const mock = await readLocalProfileMock();
        return String(mock.userId || "");
    }

    // Профиль портала приходит плоским объектом, без обёртки data.
    // Поля id в нём нет — идентифицируем по username, он уникален.
    const { payload } = await fetchPortalProfileFromRequest(req);
    return String(payload?.id || payload?.username || payload?.email || "");
}

export default async function ContestAnswerHandler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const participantId = await resolveParticipantId(req);
        if (!participantId) {
            return res.status(401).json({ success: false, error: "Нужно войти на портал" });
        }

        const { fields, files } = await parseForm(req);
        const lessonId = Number(readField(fields, "lessonId"));
        const lessonNumber = Number(readField(fields, "lessonNumber"));
        const text = String(readField(fields, "text") || "");

        if (!Number.isInteger(lessonId) || lessonId <= 0) {
            return res.status(400).json({ success: false, error: "lessonId обязателен" });
        }

        const fileField = files?.file;
        const file = Array.isArray(fileField) ? fileField[0] : fileField;

        if (!file?.filepath && !text.trim()) {
            return res.status(400).json({ success: false, error: "Приложите файл или впишите ответ текстом" });
        }

        if (text.length > MAX_ANSWER_TEXT_LENGTH) {
            return res.status(400).json({ success: false, error: "Ответ слишком длинный" });
        }

        const entry = await saveContestAnswer({ userId: participantId, lessonId, lessonNumber, text, file });

        return res.status(200).json({
            success: true,
            data: { id: entry.id, hasFile: Boolean(entry.file), fileName: entry.file?.fileName || null },
        });
    } catch (error) {
        console.error("Contest answer API:", error);
        const isTooLarge = String(error?.code || "") === "1009" || /maxFileSize/i.test(String(error?.message || ""));
        return res.status(isTooLarge ? 413 : 500).json({
            success: false,
            error: isTooLarge ? "Файл больше 20 МБ" : error.message || "Не удалось сохранить ответ",
        });
    }
}
