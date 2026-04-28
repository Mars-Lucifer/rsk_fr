import { listCasePhotos, MAYAK_CASE_PHOTO_DIRECTIONS } from "../../../lib/mayakCasePhotos.js";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const photos = await listCasePhotos(req.query.directionId || "");
        return res.status(200).json({ success: true, directions: MAYAK_CASE_PHOTO_DIRECTIONS, photos });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
