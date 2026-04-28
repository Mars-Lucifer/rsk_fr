import { requireMayakAdmin } from "../../../lib/mayakAdminAuth.js";
import { addCasePhoto, deleteCasePhoto, listCasePhotos, MAYAK_CASE_PHOTO_DIRECTIONS, updateCasePhotoOrder, updateCasePhotoOrders } from "../../../lib/mayakCasePhotos.js";

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

    if (req.method === "GET") {
        try {
            const photos = await listCasePhotos(req.query.directionId || "");
            return res.status(200).json({ success: true, directions: MAYAK_CASE_PHOTO_DIRECTIONS, photos });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    if (req.method === "POST") {
        try {
            const { directionId, filename, data } = req.body || {};
            if (!directionId || !filename || !data) {
                return res.status(400).json({ success: false, error: "directionId, filename и data обязательны" });
            }
            const photo = await addCasePhoto({ directionId, filename, data });
            return res.status(200).json({ success: true, photo });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    if (req.method === "DELETE") {
        try {
            const { id } = req.body || {};
            if (!id) {
                return res.status(400).json({ success: false, error: "id обязателен" });
            }
            const photo = await deleteCasePhoto(id);
            if (!photo) {
                return res.status(404).json({ success: false, error: "Фото не найдено" });
            }
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    if (req.method === "PUT" || req.method === "PATCH") {
        try {
            const { id, order, updates } = req.body || {};
            if (Array.isArray(updates)) {
                const photos = await updateCasePhotoOrders(updates);
                return res.status(200).json({ success: true, photos });
            }
            if (!id) {
                return res.status(400).json({ success: false, error: "id обязателен" });
            }
            const photo = await updateCasePhotoOrder(id, order);
            if (!photo) {
                return res.status(404).json({ success: false, error: "Фото не найдено" });
            }
            return res.status(200).json({ success: true, photo });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
