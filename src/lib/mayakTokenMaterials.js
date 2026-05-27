import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const MATERIALS_FILE = path.join(process.cwd(), "data", "mayak-token-materials.json");
const PUBLIC_DIR = path.join(process.cwd(), "public", "mayak-token-materials");
const PUBLIC_URL_PREFIX = "/mayak-token-materials";
const ALLOWED_EXTENSIONS = new Set([".pdf", ".pptx"]);

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function createEmptyStore() {
    return { materials: [] };
}

function safeFilename(value) {
    const parsed = path.parse(String(value || "material"));
    const base =
        parsed.name
            .trim()
            .replace(/[^\p{L}\p{N}_ -]+/gu, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 80) || "material";
    return base;
}

async function readStore() {
    try {
        const raw = await fs.readFile(MATERIALS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return {
            materials: Array.isArray(parsed?.materials) ? parsed.materials : [],
        };
    } catch {
        return createEmptyStore();
    }
}

async function writeStore(store) {
    await fs.mkdir(path.dirname(MATERIALS_FILE), { recursive: true });
    const tempFile = `${MATERIALS_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify({ materials: store.materials || [] }, null, 2), "utf-8");
    await fs.rename(tempFile, MATERIALS_FILE);
}

function toPublicMaterial(material = {}) {
    return {
        id: material.id || "",
        title: material.title || material.originalName || "Материал",
        originalName: material.originalName || "",
        fileName: material.fileName || "",
        url: material.url || "",
        size: material.size || 0,
        extension: material.extension || "",
        createdAt: material.createdAt || null,
    };
}

export async function listMayakTokenMaterials() {
    const store = await readStore();
    return store.materials
        .map(toPublicMaterial)
        .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
}

export async function uploadMayakTokenMaterial({ filePath, originalName, size, title }) {
    const normalizedOriginalName = normalizeString(originalName) || "material";
    const extension = path.extname(normalizedOriginalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
        throw new Error("Можно загружать только PDF и PPTX");
    }

    await fs.mkdir(PUBLIC_DIR, { recursive: true });

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const fileName = `${safeFilename(normalizedOriginalName)}-${Date.now()}${extension}`;
    const targetPath = path.join(PUBLIC_DIR, fileName);
    await fs.copyFile(filePath, targetPath);

    const material = {
        id,
        title: normalizeString(title) || path.parse(normalizedOriginalName).name || "Материал",
        originalName: normalizedOriginalName,
        fileName,
        url: `${PUBLIC_URL_PREFIX}/${fileName}`,
        size: Number(size) || 0,
        extension,
        createdAt: now,
    };

    const store = await readStore();
    store.materials.push(material);
    await writeStore(store);
    return toPublicMaterial(material);
}

export async function deleteMayakTokenMaterial(materialId) {
    const normalizedId = normalizeString(materialId);
    const store = await readStore();
    const index = store.materials.findIndex((item) => item.id === normalizedId);
    if (index === -1) {
        throw new Error("Материал не найден");
    }

    const [deleted] = store.materials.splice(index, 1);
    await writeStore(store);
    if (deleted?.fileName) {
        await fs.rm(path.join(PUBLIC_DIR, deleted.fileName), { force: true }).catch(() => {});
    }
    return toPublicMaterial(deleted);
}
