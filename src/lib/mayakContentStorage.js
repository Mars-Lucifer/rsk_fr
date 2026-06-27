import { promises as fs } from "fs";
import path from "path";

const LEGACY_PUBLIC_DIR = path.join(process.cwd(), "public", "tasks-2", "v2");
const DEFAULT_DATA_DIR = path.join(process.cwd(), "data", "mayak-content");
const MANIFEST_FILENAME = "manifest.json";

function getSectionSubdir(type) {
    if (type === "instructions") return "Instructions";
    if (type === "maps") return "Maps";
    return "Files";
}

function normalizeConfiguredDir(value) {
    if (!value || typeof value !== "string") return "";
    return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function hasValidManifest(dir) {
    try {
        const data = await fs.readFile(path.join(dir, MANIFEST_FILENAME), "utf-8");
        const parsed = JSON.parse(data);
        return Array.isArray(parsed);
    } catch {
        return false;
    }
}

async function hasSectionLikeContent(dir) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (entry.name === "Files" || entry.name === "Instructions" || entry.name === "source") continue;
            const indexPath = path.join(dir, entry.name, "index.json");
            if (await pathExists(indexPath)) return true;
        }
        return false;
    } catch {
        return false;
    }
}

async function isValidMayakContentDir(dir) {
    if (!dir) return false;
    if (!(await pathExists(dir))) return false;
    if (await hasValidManifest(dir)) return true;
    if (await hasSectionLikeContent(dir)) return true;
    return false;
}

async function writeJsonAtomic(filePath, value, indent = 2) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const tempPath = path.join(dir, `.${path.basename(filePath)}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
    const payload = JSON.stringify(value, null, indent);
    await fs.writeFile(tempPath, payload, "utf-8");
    await fs.rename(tempPath, filePath);
}

export async function getMayakContentDir() {
    const configuredDir = normalizeConfiguredDir(process.env.MAYAK_CONTENT_DIR);
    const defaultCandidates = [DEFAULT_DATA_DIR, LEGACY_PUBLIC_DIR];

    if (configuredDir) {
        if (await pathExists(configuredDir)) {
            return configuredDir;
        }
        return configuredDir;
    }

    for (const dir of defaultCandidates) {
        if (await isValidMayakContentDir(dir)) {
            return dir;
        }
    }

    for (const dir of defaultCandidates) {
        if (await pathExists(dir)) {
            return dir;
        }
    }

    return DEFAULT_DATA_DIR;
}

export async function ensureMayakContentRoot() {
    const dir = await getMayakContentDir();
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

export function sanitizeSectionId(sectionId) {
    if (typeof sectionId !== "string") return "";
    const trimmed = sectionId.trim();
    if (!trimmed) return "";
    if (trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\") || path.basename(trimmed) !== trimmed) {
        return "";
    }
    return trimmed;
}

export function sanitizeFilename(filename) {
    if (typeof filename !== "string") return "";
    const safeName = path.basename(filename.trim());
    return safeName === "." || safeName === ".." ? "" : safeName;
}

export async function getManifestPath() {
    const root = await ensureMayakContentRoot();
    return path.join(root, MANIFEST_FILENAME);
}

export async function readManifest() {
    try {
        const manifestPath = await getManifestPath();
        const data = await fs.readFile(manifestPath, "utf-8");
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export async function writeManifest(slugs) {
    const manifestPath = await getManifestPath();
    await writeJsonAtomic(manifestPath, slugs, 2);
    return slugs;
}

export async function getSectionDir(sectionId) {
    const safeSectionId = sanitizeSectionId(sectionId);
    if (!safeSectionId) {
        throw new Error("Invalid sectionId");
    }
    const root = await ensureMayakContentRoot();
    return path.join(root, safeSectionId);
}

export async function ensureSectionDir(sectionId) {
    const sectionDir = await getSectionDir(sectionId);
    await fs.mkdir(sectionDir, { recursive: true });
    await fs.mkdir(path.join(sectionDir, "Files"), { recursive: true });
    await fs.mkdir(path.join(sectionDir, "Instructions"), { recursive: true });
    await fs.mkdir(path.join(sectionDir, "Maps"), { recursive: true });
    return sectionDir;
}

// Абсолютный путь к JSON-файлу раздела. Нужен для per-section блокировки
// (withJsonFileLock) при read-modify-write, чтобы генерация инструкций и
// сохранение колоды не затирали index.json друг друга.
export async function getSectionJsonPath(sectionId, filename) {
    const sectionDir = await getSectionDir(sectionId);
    const safeName = sanitizeFilename(filename);
    if (!safeName) {
        throw new Error("Invalid filename");
    }
    return path.join(sectionDir, safeName);
}

export async function readSectionJson(sectionId, filename, fallbackValue) {
    try {
        const sectionDir = await getSectionDir(sectionId);
        const data = await fs.readFile(path.join(sectionDir, filename), "utf-8");
        return JSON.parse(data);
    } catch {
        return fallbackValue;
    }
}

export async function writeSectionJson(sectionId, filename, value) {
    const sectionDir = await ensureSectionDir(sectionId);
    const filePath = path.join(sectionDir, filename);
    await writeJsonAtomic(filePath, value, filename === "index.json" ? 4 : 2);
    return filePath;
}

export async function listSectionFiles(sectionId, type) {
    const sectionDir = await getSectionDir(sectionId);
    const subdir = getSectionSubdir(type);
    try {
        const entries = await fs.readdir(path.join(sectionDir, subdir), { withFileTypes: true });
        return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    } catch {
        return [];
    }
}

export async function getSectionFilePath(sectionId, type, filename) {
    const safeFilename = sanitizeFilename(filename);
    if (!safeFilename) {
        throw new Error("Invalid filename");
    }
    const sectionDir = await getSectionDir(sectionId);
    const subdir = getSectionSubdir(type);
    return path.join(sectionDir, subdir, safeFilename);
}

export async function writeSectionFile(sectionId, type, filename, buffer) {
    const safeFilename = sanitizeFilename(filename);
    if (!safeFilename) {
        throw new Error("Invalid filename");
    }
    const sectionDir = await ensureSectionDir(sectionId);
    const subdir = getSectionSubdir(type);
    const dirPath = path.join(sectionDir, subdir);
    await fs.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, safeFilename);
    await fs.writeFile(filePath, buffer);
    return { filePath, filename: safeFilename };
}

export async function deleteSectionFile(sectionId, type, filename) {
    const filePath = await getSectionFilePath(sectionId, type, filename);
    await fs.unlink(filePath);
    return filePath;
}

export async function getSourceFilePath(filename) {
    const safeFilename = sanitizeFilename(filename);
    if (!safeFilename) {
        throw new Error("Invalid filename");
    }
    const root = await ensureMayakContentRoot();
    return path.join(root, "source", safeFilename);
}

// Приводит ссылки задания на файлы к фактическому состоянию диска: ссылку на
// отсутствующий файл обнуляет, а пустое поле — привязывает к файлу с именем по
// номеру задания (та же логика, что в admin GET /tasks). Файловая система —
// единственный источник правды о наличии файла; index.json лишь подсказка.
// Так испорченный/устаревший index.json не заставит рантайм запрашивать
// несуществующий файл (битая ссылка → 404). Не мутирует вход.
export async function reconcileTasksToDisk(sectionId, tasks) {
    if (!Array.isArray(tasks) || tasks.length === 0) return Array.isArray(tasks) ? tasks : [];
    const [files, instructions, maps] = await Promise.all([
        listSectionFiles(sectionId, "files"),
        listSectionFiles(sectionId, "instructions"),
        listSectionFiles(sectionId, "maps"),
    ]);
    const resolve = (current, list, num) => {
        const value = String(current || "").trim();
        if (value && list.includes(value)) return value;
        const byNumber = num && list.find((f) => f.replace(/\.[^.]+$/, "") === num);
        return byNumber || "";
    };
    return tasks.map((task) => {
        const num = String(task.number || "").trim();
        return {
            ...task,
            instruction: resolve(task.instruction, instructions, num),
            file: resolve(task.file, files, num),
            map: resolve(task.map, maps, num),
        };
    });
}

export async function getSectionBundle(sectionId, { includeTexts = true, validateFiles = false } = {}) {
    const rawTasks = await readSectionJson(sectionId, "index.json", []);
    const meta = await readSectionJson(sectionId, "meta.json", {});
    const texts = includeTexts ? await readSectionJson(sectionId, "TaskText.json", []) : [];
    let tasks = Array.isArray(rawTasks) ? rawTasks : [];
    if (validateFiles) {
        tasks = await reconcileTasksToDisk(sectionId, tasks);
    }
    return {
        sectionId,
        tasks,
        texts: Array.isArray(texts) ? texts : [],
        meta: meta && typeof meta === "object" ? meta : {},
    };
}

export async function getAllSectionsIndexBundles({ validateFiles = false } = {}) {
    const sectionIds = await readManifest();
    const bundles = await Promise.all(
        sectionIds.map(async (sectionId) => {
            const bundle = await getSectionBundle(sectionId, { includeTexts: false, validateFiles });
            return {
                sectionId,
                tasks: bundle.tasks,
                meta: bundle.meta,
            };
        })
    );
    return { sectionIds, bundles };
}