import { createReadStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const DEFAULT_ROOT_DIR = path.join(process.cwd(), "data", "mayak-case-photos");
const FILES_DIR = "files";
const THUMBS_DIR = "thumbs";
const INDEX_FILENAME = "index.json";
const THUMB_WIDTH = 960;
const THUMB_HEIGHT = 640;

export const MAYAK_CASE_PHOTO_DIRECTIONS = [
    { id: "education", title: "Образование", color: "#2f6df6" },
    { id: "state", title: "Государство и общество", color: "#44bd32" },
    { id: "business", title: "Бизнес", color: "#ff7a00" },
    { id: "special", title: "Специализированная колода", color: "#8260d9" },
];

const DIRECTION_IDS = new Set(MAYAK_CASE_PHOTO_DIRECTIONS.map((direction) => direction.id));

function normalizeConfiguredDir(value) {
    if (!value || typeof value !== "string") return "";
    return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

export function getMayakCasePhotosRoot() {
    return normalizeConfiguredDir(process.env.MAYAK_CASE_PHOTOS_DIR) || DEFAULT_ROOT_DIR;
}

export function isValidCasePhotoDirection(directionId) {
    return DIRECTION_IDS.has(directionId);
}

export function sanitizeCasePhotoFilename(filename) {
    if (typeof filename !== "string") return "";
    const safeName = path.basename(filename.trim());
    return safeName === "." || safeName === ".." ? "" : safeName;
}

export function getCasePhotoContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".webp") return "image/webp";
    if (ext === ".gif") return "image/gif";
    return "application/octet-stream";
}

export async function ensureCasePhotosRoot() {
    const root = getMayakCasePhotosRoot();
    await fs.mkdir(path.join(root, FILES_DIR), { recursive: true });
    await fs.mkdir(path.join(root, THUMBS_DIR), { recursive: true });
    return root;
}

async function getIndexPath() {
    const root = await ensureCasePhotosRoot();
    return path.join(root, INDEX_FILENAME);
}

async function writeJsonAtomic(filePath, value) {
    const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
    await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf-8");
    await fs.rename(tempPath, filePath);
}

function normalizePhoto(photo, index = 0) {
    if (!photo || typeof photo !== "object") return null;
    if (!isValidCasePhotoDirection(photo.directionId)) return null;
    const filename = sanitizeCasePhotoFilename(photo.filename);
    if (!filename) return null;
    const id = typeof photo.id === "string" && photo.id.trim() ? photo.id : crypto.randomUUID();
    return {
        id,
        directionId: photo.directionId,
        filename,
        originalName: typeof photo.originalName === "string" && photo.originalName.trim() ? photo.originalName.trim() : filename,
        createdAt: typeof photo.createdAt === "string" ? photo.createdAt : new Date().toISOString(),
        order: Number.isFinite(Number(photo.order)) && Number(photo.order) > 0 ? Number(photo.order) : index + 1,
    };
}

export async function readCasePhotos() {
    try {
        const data = await fs.readFile(await getIndexPath(), "utf-8");
        const parsed = JSON.parse(data);
        const photos = Array.isArray(parsed?.photos) ? parsed.photos : Array.isArray(parsed) ? parsed : [];
        return photos.map((photo, index) => normalizePhoto(photo, index)).filter(Boolean);
    } catch {
        return [];
    }
}

export async function saveCasePhotos(photos) {
    const indexPath = await getIndexPath();
    const normalized = (Array.isArray(photos) ? photos : []).map((photo, index) => normalizePhoto(photo, index)).filter(Boolean);
    await writeJsonAtomic(indexPath, { photos: normalized });
    return normalized;
}

export function serializeCasePhoto(photo) {
    const encodedFilename = encodeURIComponent(photo.filename);
    return {
        ...photo,
        url: `/api/mayak/case-photo?filename=${encodedFilename}`,
        thumbUrl: `/api/mayak/case-photo?filename=${encodedFilename}&variant=thumb`,
    };
}

export async function listCasePhotos(directionId = "") {
    const photos = await readCasePhotos();
    const filtered = directionId && isValidCasePhotoDirection(directionId) ? photos.filter((photo) => photo.directionId === directionId) : photos;
    return filtered
        .sort((a, b) => {
            if (a.directionId !== b.directionId) return a.directionId.localeCompare(b.directionId);
            if (a.order !== b.order) return a.order - b.order;
            return String(a.createdAt).localeCompare(String(b.createdAt));
        })
        .map(serializeCasePhoto);
}

export async function addCasePhoto({ directionId, filename, data }) {
    if (!isValidCasePhotoDirection(directionId)) {
        throw new Error("Недопустимое направление");
    }

    const originalName = sanitizeCasePhotoFilename(filename);
    if (!originalName) {
        throw new Error("Недопустимое имя файла");
    }

    const ext = path.extname(originalName).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
        throw new Error("Поддерживаются только изображения jpg, png, webp или gif");
    }

    const root = await ensureCasePhotosRoot();
    const storedFilename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const buffer = Buffer.from(data, "base64");
    await fs.writeFile(path.join(root, FILES_DIR, storedFilename), buffer);

    const photos = await readCasePhotos();
    const nextOrder =
        photos
            .filter((item) => item.directionId === directionId)
            .reduce((maxOrder, item) => Math.max(maxOrder, Number(item.order) || 0), 0) + 1;
    const photo = {
        id: crypto.randomUUID(),
        directionId,
        filename: storedFilename,
        originalName,
        createdAt: new Date().toISOString(),
        order: nextOrder,
    };
    photos.unshift(photo);
    await saveCasePhotos(photos);
    return serializeCasePhoto(photo);
}

export async function updateCasePhotoOrder(id, order) {
    const nextOrder = Number(order);
    if (!Number.isFinite(nextOrder) || nextOrder < 1) {
        throw new Error("Порядок должен быть числом от 1");
    }

    const photos = await readCasePhotos();
    const index = photos.findIndex((item) => item.id === id);
    if (index === -1) return null;
    photos[index] = {
        ...photos[index],
        order: Math.floor(nextOrder),
    };
    await saveCasePhotos(photos);
    return serializeCasePhoto(photos[index]);
}

export async function updateCasePhotoOrders(updates) {
    if (!Array.isArray(updates) || !updates.length) {
        throw new Error("Нужен список фото для сортировки");
    }

    const nextOrders = new Map();
    updates.forEach((update) => {
        const nextOrder = Number(update?.order);
        if (!update?.id || !Number.isFinite(nextOrder) || nextOrder < 1) {
            throw new Error("Порядок должен быть числом от 1");
        }
        nextOrders.set(update.id, Math.floor(nextOrder));
    });

    const photos = await readCasePhotos();
    const updatedPhotos = photos.map((photo) => (nextOrders.has(photo.id) ? { ...photo, order: nextOrders.get(photo.id) } : photo));
    await saveCasePhotos(updatedPhotos);
    return listCasePhotos();
}

export async function deleteCasePhoto(id) {
    const photos = await readCasePhotos();
    const photo = photos.find((item) => item.id === id);
    if (!photo) return null;

    await saveCasePhotos(photos.filter((item) => item.id !== id));
    try {
        const root = await ensureCasePhotosRoot();
        await fs.unlink(path.join(root, FILES_DIR, photo.filename));
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
    return photo;
}

export async function getCasePhotoPath(filename) {
    const safeFilename = sanitizeCasePhotoFilename(filename);
    if (!safeFilename) {
        throw new Error("Недопустимое имя файла");
    }
    const root = await ensureCasePhotosRoot();
    return path.join(root, FILES_DIR, safeFilename);
}

function getCasePhotoThumbFilename(filename) {
    const safeFilename = sanitizeCasePhotoFilename(filename);
    const ext = path.extname(safeFilename);
    const baseName = ext ? safeFilename.slice(0, -ext.length) : safeFilename;
    return `${baseName}-${THUMB_WIDTH}x${THUMB_HEIGHT}.webp`;
}

async function getCasePhotoThumbPath(filename) {
    const originalPath = await getCasePhotoPath(filename);
    const root = await ensureCasePhotosRoot();
    const thumbPath = path.join(root, THUMBS_DIR, getCasePhotoThumbFilename(filename));

    try {
        const [originalStat, thumbStat] = await Promise.all([fs.stat(originalPath), fs.stat(thumbPath)]);
        if (thumbStat.mtimeMs >= originalStat.mtimeMs) {
            return thumbPath;
        }
    } catch {}

    await sharp(originalPath)
        .rotate()
        .resize(THUMB_WIDTH, THUMB_HEIGHT, {
            fit: "cover",
            position: "attention",
            withoutEnlargement: true,
        })
        .webp({ quality: 78, effort: 5 })
        .toFile(thumbPath);

    return thumbPath;
}

export async function streamCasePhoto(filename, res, options = {}) {
    const filePath = options.variant === "thumb" ? await getCasePhotoThumbPath(filename) : await getCasePhotoPath(filename);
    const stat = await fs.stat(filePath);
    res.setHeader("Content-Type", options.variant === "thumb" ? "image/webp" : getCasePhotoContentType(filePath));
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    createReadStream(filePath).pipe(res);
}
