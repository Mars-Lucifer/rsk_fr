import { promises as fs } from "fs";
import path from "path";
import { requireMayakAdmin } from "../../../../lib/mayakAdminAuth.js";
import {
    getSectionDir,
    listSectionFiles,
    readSectionJson,
    writeSectionJson,
} from "../../../../lib/mayakContentStorage.js";

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    const sectionId = req.query.sectionId || req.body?.sectionId || req.query.range || req.body?.range;
    if (!sectionId) {
        return res.status(400).json({ success: false, error: "Укажите sectionId или range" });
    }

    const rangeDir = await getSectionDir(sectionId).catch(() => null);
    if (!rangeDir) {
        return res.status(400).json({ success: false, error: "Недопустимый sectionId" });
    }

    if (req.method === "GET") {
        try {
            let tasks = await readSectionJson(sectionId, "index.json", []);
            let texts = await readSectionJson(sectionId, "TaskText.json", []);
            const existingFiles = await listSectionFiles(sectionId, "files");
            const existingInstructions = await listSectionFiles(sectionId, "instructions");
            const existingMaps = await listSectionFiles(sectionId, "maps");
            const meta = await readSectionJson(sectionId, "meta.json", {});
            const rangeName = meta && typeof meta === "object" ? meta.rangeName || "" : "";

            for (const task of tasks) {
                const num = (task.number || "").toString();
                if (!num) continue;
                if (!task.file) {
                    const match = existingFiles.find((f) => f.replace(/\.[^.]+$/, "") === num);
                    if (match) task.file = match;
                }
                if (!task.instruction) {
                    const match = existingInstructions.find((f) => f.replace(/\.[^.]+$/, "") === num);
                    if (match) task.instruction = match;
                }
                if (!task.map) {
                    const match = existingMaps.find((f) => f.replace(/\.[^.]+$/, "") === num);
                    if (match) task.map = match;
                }
            }

            const fileSizes = {};
            try {
                for (const f of existingFiles) {
                    const st = await fs.stat(path.join(rangeDir, "Files", f));
                    fileSizes[f] = st.size;
                }
            } catch {}
            try {
                for (const f of existingInstructions) {
                    const st = await fs.stat(path.join(rangeDir, "Instructions", f));
                    fileSizes[f] = st.size;
                }
            } catch {}
            try {
                for (const f of existingMaps) {
                    const st = await fs.stat(path.join(rangeDir, "Maps", f));
                    fileSizes[f] = st.size;
                }
            } catch {}

            return res.status(200).json({
                success: true,
                data: { tasks, texts, existingFiles, existingInstructions, existingMaps, rangeName, fileSizes },
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    if (req.method === "PUT") {
        try {
            const { tasks, texts, rangeName } = req.body;
            if (!Array.isArray(tasks)) {
                return res.status(400).json({ success: false, error: "tasks должен быть массивом" });
            }

            const existingFiles = await listSectionFiles(sectionId, "files");
            const existingInstructions = await listSectionFiles(sectionId, "instructions");
            const existingMaps = await listSectionFiles(sectionId, "maps");
            const warnings = [];

            const missingNumbers = tasks
                .map((t, i) => ({ index: i, number: t?.number }))
                .filter(({ number }) => !String(number || "").trim());
            if (missingNumbers.length > 0) {
                return res.status(422).json({
                    success: false,
                    error: `Пустой номер задания в строках: ${missingNumbers.slice(0, 10).map(({ index }) => index + 1).join(", ")}`,
                });
            }

            const numbers = tasks.map((t) => t.number).filter(Boolean);
            const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
            if (duplicates.length > 0) {
                return res.status(422).json({ success: false, error: `Дублирующиеся номера: ${[...new Set(duplicates)].join(", ")}` });
            }

            tasks.forEach((task, i) => {
                const instrName = (task.instruction || "").trim();
                const fileName = (task.file || "").trim();
                const mapName = (task.map || "").trim();
                if (instrName && !existingInstructions.includes(instrName)) {
                    warnings.push({ index: i, field: "instruction", message: `Задание ${task.number}: файл инструкции не найден` });
                }
                if (fileName && !existingFiles.includes(fileName)) {
                    warnings.push({ index: i, field: "file", message: `Задание ${task.number}: файл доп. материала не найден` });
                }
                if (mapName && !existingMaps.includes(mapName)) {
                    warnings.push({ index: i, field: "map", message: `Задание ${task.number}: файл карты не найден` });
                }
            });

            const cleanTasks = tasks.map((t) => ({
                number: String(t.number || ""),
                title: t.title || "",
                contentType: t.contentType || "",
                file: t.file && existingFiles.includes((t.file || "").trim()) ? t.file : "",
                instruction: t.instruction && existingInstructions.includes((t.instruction || "").trim()) ? t.instruction : "",
                map: t.map && existingMaps.includes((t.map || "").trim()) ? t.map : "",
                instructionText: t.instructionText || "",
                materialText: t.materialText || "",
                mapText: t.mapText || "",
                hasInstruction: !!(t.instructionText || "").trim(),
                hasFile: !!(t.materialText || "").trim(),
                hasMap: !!(t.mapText || "").trim(),
                hasSource: !!(t.sourceLink || "").trim(),
                sourceLink: t.sourceLink || "",
                toolLink1: t.toolLink1 || "",
                toolName1: t.toolName1 || "",
                toolLink2: t.toolLink2 || "",
                toolName2: t.toolName2 || "",
                services: t.services || "",
                instructionFormat: t.instructionFormat || "",
                instructionService: t.instructionService || "",
            }));

            await writeSectionJson(sectionId, "index.json", cleanTasks);

            if (Array.isArray(texts)) {
                const cleanTexts = texts
                    .filter((t) => t.number && (t.description || t.task))
                    .map((t) => ({
                        number: String(t.number),
                        description: t.description || "",
                        task: t.task || "",
                    }));
                await writeSectionJson(sectionId, "TaskText.json", cleanTexts);
            }

            if (rangeName !== undefined) {
                const existingMeta = await readSectionJson(sectionId, "meta.json", {});
                const nextMeta = {
                    ...(existingMeta && typeof existingMeta === "object" ? existingMeta : {}),
                    rangeName: rangeName || "",
                };
                await writeSectionJson(sectionId, "meta.json", nextMeta);
            }

            return res.status(200).json({ success: true, warnings: warnings.length > 0 ? warnings : undefined });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
