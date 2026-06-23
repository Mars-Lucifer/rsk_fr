import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import JSZip from "jszip";
import sharp from "sharp";

const REGISTRY_FILE = path.join(process.cwd(), "data", "mayak-service-templates.json");
const TEMPLATES_DIR = path.join(process.cwd(), "data", "mayak-service-templates");

// --------------------------------------------------------------------------
// Slug / нормализация
// --------------------------------------------------------------------------

export function slugify(value) {
    return (
        String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9а-яё_-]+/giu, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 80) || "item"
    );
}

function normalizeName(value) {
    return typeof value === "string" ? value.trim() : "";
}

// --------------------------------------------------------------------------
// Реестр шаблонов (data/mayak-service-templates.json)
// --------------------------------------------------------------------------

async function writeJsonAtomic(filePath, value) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const tempPath = path.join(dir, `.${path.basename(filePath)}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
    await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf-8");
    await fs.rename(tempPath, filePath);
}

function normalizeFormat(format, index = 0) {
    if (!format || typeof format !== "object") return null;
    const formatName = normalizeName(format.formatName);
    const templateFile = normalizeName(format.templateFile);
    if (!formatName || !templateFile) return null;
    return {
        formatKey: normalizeName(format.formatKey) || slugify(formatName),
        formatName,
        templateFile,
        order: Number.isFinite(Number(format.order)) ? Number(format.order) : index,
        uploadedAt: typeof format.uploadedAt === "string" ? format.uploadedAt : new Date().toISOString(),
    };
}

function normalizeService(service, index = 0) {
    if (!service || typeof service !== "object") return null;
    const serviceName = normalizeName(service.serviceName);
    if (!serviceName) return null;
    const formats = Array.isArray(service.formats)
        ? service.formats.map((f, i) => normalizeFormat(f, i)).filter(Boolean).sort((a, b) => a.order - b.order)
        : [];
    return {
        serviceKey: normalizeName(service.serviceKey) || slugify(serviceName),
        serviceName,
        serviceUrl: normalizeName(service.serviceUrl),
        order: Number.isFinite(Number(service.order)) ? Number(service.order) : index,
        formats,
    };
}

export async function readServiceTemplates() {
    try {
        const raw = await fs.readFile(REGISTRY_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        const services = Array.isArray(parsed?.services) ? parsed.services : [];
        return { services: services.map((s, i) => normalizeService(s, i)).filter(Boolean).sort((a, b) => a.order - b.order) };
    } catch {
        return { services: [] };
    }
}

export async function writeServiceTemplates(data) {
    const services = Array.isArray(data?.services) ? data.services.map((s, i) => normalizeService(s, i)).filter(Boolean) : [];
    await writeJsonAtomic(REGISTRY_FILE, { services });
    return { services };
}

/**
 * Находит сервис в реестре по ключу или имени (без учёта регистра).
 */
export function findService(registry, serviceKeyOrName) {
    const needle = normalizeName(serviceKeyOrName).toLowerCase();
    if (!needle) return null;
    return (
        registry.services.find((s) => s.serviceKey.toLowerCase() === needle || s.serviceName.toLowerCase() === needle) || null
    );
}

/**
 * Возвращает формат сервиса: по formatKey, либо первый по порядку (дефолт).
 */
export function resolveFormat(service, formatKey) {
    if (!service || !Array.isArray(service.formats) || service.formats.length === 0) return null;
    if (formatKey) {
        const found = service.formats.find((f) => f.formatKey === formatKey);
        if (found) return found;
    }
    return service.formats[0];
}

// --------------------------------------------------------------------------
// Мутаторы реестра
// --------------------------------------------------------------------------

/**
 * Добавляет (или заменяет) формат у сервиса. Сервис создаётся при необходимости.
 * @returns {Promise<{ registry: object, replacedFile: string|null }>}
 */
export async function upsertFormat({ serviceName, formatName, templateFile, serviceUrl }) {
    const name = normalizeName(serviceName);
    const fName = normalizeName(formatName);
    if (!name) throw new Error("Не указан сервис");
    if (!fName) throw new Error("Не указан формат");
    if (!templateFile) throw new Error("Не указан файл шаблона");

    const registry = await readServiceTemplates();
    const serviceKey = slugify(name);
    const formatKey = slugify(fName);

    let service = registry.services.find((s) => s.serviceKey === serviceKey);
    if (!service) {
        service = { serviceKey, serviceName: name, serviceUrl: normalizeName(serviceUrl), order: registry.services.length, formats: [] };
        registry.services.push(service);
    } else {
        service.serviceName = name;
        if (serviceUrl !== undefined) service.serviceUrl = normalizeName(serviceUrl);
    }

    let replacedFile = null;
    const existing = service.formats.find((f) => f.formatKey === formatKey);
    if (existing) {
        replacedFile = existing.templateFile || null;
        existing.formatName = fName;
        existing.templateFile = templateFile;
        existing.uploadedAt = new Date().toISOString();
    } else {
        service.formats.push({
            formatKey,
            formatName: fName,
            templateFile,
            order: service.formats.length,
            uploadedAt: new Date().toISOString(),
        });
    }

    const saved = await writeServiceTemplates(registry);
    return { registry: saved, replacedFile };
}

/**
 * Создаёт или обновляет сам сервис (имя + ссылка) без загрузки шаблона.
 * Используется как каталог сервисов для привязки и проверки в content.
 */
export async function upsertService({ serviceName, serviceUrl }) {
    const name = normalizeName(serviceName);
    if (!name) throw new Error("Не указан сервис");
    const registry = await readServiceTemplates();
    const serviceKey = slugify(name);
    let service = registry.services.find((s) => s.serviceKey === serviceKey);
    if (!service) {
        service = { serviceKey, serviceName: name, serviceUrl: normalizeName(serviceUrl), order: registry.services.length, formats: [] };
        registry.services.push(service);
    } else {
        service.serviceName = name;
        if (serviceUrl !== undefined) service.serviceUrl = normalizeName(serviceUrl);
    }
    const saved = await writeServiceTemplates(registry);
    return { registry: saved };
}

/**
 * Удаляет формат у сервиса.
 * @returns {Promise<{ registry: object, removedFiles: string[] }>}
 */
export async function removeFormat(serviceKey, formatKey) {
    const registry = await readServiceTemplates();
    const service = registry.services.find((s) => s.serviceKey === serviceKey);
    if (!service) return { registry, removedFiles: [] };
    const removed = service.formats.filter((f) => f.formatKey === formatKey);
    service.formats = service.formats.filter((f) => f.formatKey !== formatKey);
    const saved = await writeServiceTemplates(registry);
    return { registry: saved, removedFiles: removed.map((f) => f.templateFile).filter(Boolean) };
}

/**
 * Удаляет сервис целиком вместе со всеми форматами.
 * @returns {Promise<{ registry: object, removedFiles: string[] }>}
 */
export async function removeService(serviceKey) {
    const registry = await readServiceTemplates();
    const service = registry.services.find((s) => s.serviceKey === serviceKey);
    const removedFiles = service ? service.formats.map((f) => f.templateFile).filter(Boolean) : [];
    registry.services = registry.services.filter((s) => s.serviceKey !== serviceKey);
    const saved = await writeServiceTemplates(registry);
    return { registry: saved, removedFiles };
}

// --------------------------------------------------------------------------
// Файлы шаблонов (data/mayak-service-templates/)
// --------------------------------------------------------------------------

export function sanitizeTemplateFilename(filename) {
    const safe = path.basename(String(filename || "").trim());
    return safe === "." || safe === ".." ? "" : safe;
}

export async function ensureTemplatesDir() {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
    return TEMPLATES_DIR;
}

export async function saveTemplateFile(buffer, { serviceKey, formatKey }) {
    await ensureTemplatesDir();
    const filename = `${slugify(serviceKey)}-${slugify(formatKey)}-${Date.now()}.pptx`;
    await fs.writeFile(path.join(TEMPLATES_DIR, filename), buffer);
    return filename;
}

export function getTemplatePath(filename) {
    const safe = sanitizeTemplateFilename(filename);
    if (!safe) throw new Error("Недопустимое имя файла шаблона");
    return path.join(TEMPLATES_DIR, safe);
}

export async function deleteTemplateFile(filename) {
    const safe = sanitizeTemplateFilename(filename);
    if (!safe) return;
    await fs.unlink(path.join(TEMPLATES_DIR, safe)).catch(() => {});
}

// --------------------------------------------------------------------------
// Работа с PPTX (jszip): поиск первой картинки на первом слайде и замена карты
// --------------------------------------------------------------------------

async function readZipText(zip, zipPath) {
    const file = zip.file(zipPath);
    if (!file) return null;
    return file.async("string");
}

async function resolveFirstSlide(zip) {
    const presXml = await readZipText(zip, "ppt/presentation.xml");
    const relsXml = await readZipText(zip, "ppt/_rels/presentation.xml.rels");
    if (presXml && relsXml) {
        const sldMatch = presXml.match(/<p:sldId[^>]*r:id="([^"]+)"/);
        if (sldMatch) {
            const rid = sldMatch[1];
            const relMatch = relsXml.match(new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"`));
            if (relMatch) {
                const target = relMatch[1].replace(/^\//, "");
                return path.posix.normalize(path.posix.join("ppt", target));
            }
        }
    }
    return "ppt/slides/slide1.xml";
}

/**
 * Возвращает путь к медиа-файлу первой картинки первого слайда (или null).
 */
async function findFirstSlideImageMediaPath(zip) {
    const slidePath = await resolveFirstSlide(zip);
    const slideXml = await readZipText(zip, slidePath);
    if (!slideXml) return null;

    // Первый <p:pic> на слайде
    const picIdx = slideXml.search(/<p:pic[\s>]/);
    if (picIdx === -1) return null;
    const afterPic = slideXml.slice(picIdx);
    const embedMatch = afterPic.match(/r:embed="([^"]+)"/);
    if (!embedMatch) return null;
    const embedId = embedMatch[1];

    // Резолвим rId через _rels слайда
    const slideDir = path.posix.dirname(slidePath);
    const slideName = path.posix.basename(slidePath);
    const relsPath = path.posix.join(slideDir, "_rels", `${slideName}.rels`);
    const relsXml = await readZipText(zip, relsPath);
    if (!relsXml) return null;
    const relMatch = relsXml.match(new RegExp(`<Relationship[^>]*Id="${embedId}"[^>]*Target="([^"]+)"`));
    if (!relMatch) return null;
    const target = relMatch[1].replace(/^\//, "");
    return path.posix.normalize(path.posix.join(slideDir, target));
}

/**
 * Валидация шаблона: на первом слайде должна быть хотя бы одна картинка-плейсхолдер.
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
export async function validatePptxTemplate(buffer) {
    let zip;
    try {
        zip = await JSZip.loadAsync(buffer);
    } catch {
        return { valid: false, error: "Файл не является корректным .pptx (не удалось распаковать)" };
    }
    if (!zip.file("ppt/presentation.xml")) {
        return { valid: false, error: "Это не презентация PowerPoint (.pptx)" };
    }
    const mediaPath = await findFirstSlideImageMediaPath(zip);
    if (!mediaPath || !zip.file(mediaPath)) {
        return {
            valid: false,
            error: "На первом слайде шаблона не найдена картинка-плейсхолдер под карту. Добавьте на 1-й слайд изображение-заглушку.",
        };
    }
    return { valid: true };
}

/**
 * Подменяет первую картинку первого слайда новым изображением (картой задания).
 * Изображение конвертируется в формат существующего плейсхолдера. Геометрия фигуры сохраняется.
 * @param {Buffer} pptxBuffer исходный шаблон
 * @param {Buffer} imageBuffer растровая картинка карты (любой поддерживаемый sharp формат)
 * @returns {Promise<Buffer>} новый .pptx
 */
export async function replaceMapInPptx(pptxBuffer, imageBuffer) {
    const zip = await JSZip.loadAsync(pptxBuffer);
    const mediaPath = await findFirstSlideImageMediaPath(zip);
    if (!mediaPath || !zip.file(mediaPath)) {
        throw new Error("В шаблоне не найдена картинка-плейсхолдер на первом слайде");
    }

    const ext = path.posix.extname(mediaPath).toLowerCase();
    let outBuffer;
    if (ext === ".jpg" || ext === ".jpeg") {
        outBuffer = await sharp(imageBuffer).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
    } else {
        // png и любые прочие растровые плейсхолдеры приводим к png
        outBuffer = await sharp(imageBuffer).png().toBuffer();
    }

    zip.file(mediaPath, outBuffer);
    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
