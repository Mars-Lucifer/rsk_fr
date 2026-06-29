import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

import { requireMayakAdmin } from "@/lib/mayakAdminAuth";
import {
    getSectionDir,
    getSectionFilePath,
    getSectionJsonPath,
    listSectionFiles,
    readSectionJson,
    writeSectionFile,
    writeSectionJson,
} from "@/lib/mayakContentStorage";
import { withJsonFileLock } from "@/lib/jsonFileLock";
import { invalidateRangesCache } from "@/lib/mayakContentCache";
import { convertToPdf } from "@/lib/libreofficeConverter";
import { rasterizePdfFirstPageToPng } from "@/lib/pdfRasterize";
import { findService, getTemplatePath, readServiceTemplates, replaceMapInPptx, resolveFormat } from "@/lib/mayakServiceTemplates";
import { resolveFormatKey } from "@/lib/mayakProgressModel";

const GEN_WORK_ROOT = path.join(process.cwd(), "tmp_pdf_tools", "mayak-instruction-gen");
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);

function serviceCandidates(task) {
    const out = [];
    String(task?.services || "")
        .split(/[,;\n]/)
        .forEach((s) => {
            const v = s.trim();
            if (v) out.push(v);
        });
    [task?.toolName1, task?.toolName2].forEach((s) => {
        const v = String(s || "").trim();
        if (v) out.push(v);
    });
    return out;
}

// Находит сервис-кандидат с шаблоном. Если задан serviceKey (ручной выбор при
// нескольких сервисах) — приоритет ему, но только если он среди кандидатов задания.
// contentTypeKey — канонический тип контента задания (текст/изображение/...), по
// которому автоматически выбирается нужный формат сервиса.
function matchServiceWithTemplate(registry, task, formatKey, serviceKey, contentTypeKey) {
    const candidates = serviceCandidates(task);

    if (serviceKey) {
        for (const name of candidates) {
            const service = findService(registry, name);
            if (service && service.serviceKey === serviceKey) {
                const format = resolveFormat(service, formatKey, contentTypeKey);
                return { service, format: format || null, candidateName: service.serviceName };
            }
        }
    }

    let fallback = null; // сервис найден, но без форматов — для понятной ошибки
    for (const name of candidates) {
        const service = findService(registry, name);
        if (service) {
            const format = resolveFormat(service, formatKey, contentTypeKey);
            if (format) return { service, format, candidateName: name };
            if (!fallback) fallback = { service, format: null, candidateName: name };
        }
    }
    return fallback || { service: null, format: null, candidateName: candidates[0] || "" };
}

async function findMapFilename(sectionId, task) {
    const maps = await listSectionFiles(sectionId, "maps");
    const explicit = String(task.map || "").trim();
    if (explicit && maps.includes(explicit)) return explicit;
    const num = String(task.number || "").trim();
    if (num) {
        const byNumber = maps.find((f) => f.replace(/\.[^.]+$/, "") === num);
        if (byNumber) return byNumber;
    }
    return "";
}

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const sectionId = req.body?.sectionId || req.body?.range || req.query?.sectionId || req.query?.range;
    const number = String(req.body?.number ?? "").trim();
    const formatKey = String(req.body?.formatKey ?? "").trim();
    const serviceKey = String(req.body?.serviceKey ?? "").trim();

    if (!sectionId) return res.status(400).json({ success: false, error: "Укажите sectionId" });
    if (!number) return res.status(400).json({ success: false, error: "Укажите номер задания" });

    const workDir = path.join(GEN_WORK_ROOT, crypto.randomUUID());

    try {
        const sectionDir = await getSectionDir(sectionId).catch(() => null);
        if (!sectionDir) return res.status(400).json({ success: false, error: "Недопустимый sectionId" });

        const tasks = await readSectionJson(sectionId, "index.json", []);
        const taskIndex = tasks.findIndex((t) => String(t.number || "").trim() === number);
        if (taskIndex === -1) {
            return res.status(404).json({ success: false, error: `Задание ${number} не найдено` });
        }
        const task = tasks[taskIndex];

        // 1. Сервис и формат (сервис ищем в services + Инструмент 1/2)
        const candidates = serviceCandidates(task);
        if (candidates.length === 0) {
            return res.status(422).json({ success: false, error: "У задания не указан сервис (колонки «Сервисы» или «Инструмент»)" });
        }
        const registry = await readServiceTemplates();
        // Канонический тип контента задания → авто-выбор формата шаблона.
        const contentTypeKey = resolveFormatKey(task.contentType) || "";
        const { service, format, candidateName } = matchServiceWithTemplate(registry, task, formatKey, serviceKey, contentTypeKey);
        if (!service) {
            return res.status(422).json({ success: false, error: `Для сервиса «${candidateName}» не загружен шаблон` });
        }
        if (!format) {
            return res.status(422).json({ success: false, error: `Для сервиса «${service.serviceName}» не настроен формат` });
        }

        // 2. Карта задания
        const mapFilename = await findMapFilename(sectionId, task);
        if (!mapFilename) {
            return res.status(422).json({ success: false, error: "Для задания не загружена карта" });
        }
        const mapPath = await getSectionFilePath(sectionId, "maps", mapFilename);

        await fs.mkdir(workDir, { recursive: true });

        // 3. Получаем растровое изображение карты (PDF → PNG через PDF.js, иначе берём как есть)
        const mapExt = path.extname(mapFilename).toLowerCase();
        let imageBuffer;
        if (mapExt === ".pdf") {
            imageBuffer = await rasterizePdfFirstPageToPng(mapPath, { scale: 2 });
        } else if (IMAGE_EXTS.has(mapExt)) {
            imageBuffer = await fs.readFile(mapPath);
        } else {
            return res.status(422).json({ success: false, error: `Неподдерживаемый формат карты: ${mapExt}` });
        }

        // 4. Подменяем карту в шаблоне и конвертируем в PDF
        const templatePath = getTemplatePath(format.templateFile);
        const templateBuffer = await fs.readFile(templatePath).catch(() => null);
        if (!templateBuffer) {
            return res.status(422).json({ success: false, error: "Файл шаблона не найден на сервере" });
        }
        const filledPptx = await replaceMapInPptx(templateBuffer, imageBuffer);
        const tempPptxPath = path.join(workDir, `${number}.pptx`);
        await fs.writeFile(tempPptxPath, filledPptx);
        const pdfPath = await convertToPdf(tempPptxPath, workDir);
        const pdfBuffer = await fs.readFile(pdfPath);

        // 5. Сохраняем PDF-инструкцию на диск (вне лока — тяжёлая операция).
        const instructionFilename = `${number}.pdf`;
        await writeSectionFile(sectionId, "instructions", instructionFilename, pdfBuffer);

        // 6. Финальный read-modify-write index.json под per-section локом со
        // СВЕЖИМ перечитыванием: тяжёлая генерация PDF могла идти секунды, за
        // это время оператор мог сохранить колоду. Перечитываем актуальный файл
        // и правим только это задание, чтобы не затереть чужие изменения и не
        // словить гонку с PUT /tasks (он берёт тот же лок).
        const indexPath = await getSectionJsonPath(sectionId, "index.json");
        let savedInstructionText = "";
        await withJsonFileLock(indexPath, async () => {
            const freshTasks = await readSectionJson(sectionId, "index.json", []);
            const idx = freshTasks.findIndex((t) => String(t.number || "").trim() === number);
            if (idx === -1) {
                // Задание исчезло из колоды за время генерации — нечего обновлять.
                savedInstructionText = String(task.instructionText || "").trim() || "Инструкция";
                return;
            }
            savedInstructionText = String(freshTasks[idx].instructionText || "").trim() || "Инструкция";
            freshTasks[idx] = {
                ...freshTasks[idx],
                instruction: instructionFilename,
                instructionText: savedInstructionText,
                hasInstruction: true,
                instructionFormat: format.formatKey,
                instructionService: service.serviceKey,
            };
            await writeSectionJson(sectionId, "index.json", freshTasks);
        });

        invalidateRangesCache();

        return res.status(200).json({
            success: true,
            data: {
                number,
                instruction: instructionFilename,
                serviceName: service.serviceName,
                serviceKey: service.serviceKey,
                formatName: format.formatName,
                formatKey: format.formatKey,
                instructionText: savedInstructionText,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error?.message || "Ошибка генерации инструкции" });
    } finally {
        await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
}
