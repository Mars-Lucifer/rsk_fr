import { streamCasePhoto } from "../../../lib/mayakCasePhotos.js";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        await streamCasePhoto(req.query.filename || "", res, { variant: req.query.variant });
    } catch (error) {
        if (error.code === "ENOENT") {
            return res.status(404).json({ error: "Фото не найдено" });
        }
        return res.status(500).json({ error: error.message });
    }
}
