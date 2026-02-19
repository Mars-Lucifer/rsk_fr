import { promises as fs } from "fs";
import path from "path";

const ADMIN_PASSWORD = "a12345";
const V2_DIR = path.join(process.cwd(), "public", "tasks-2", "v2");

function checkAuth(req) {
    const password = req.query.password || req.body?.password;
    return password === ADMIN_PASSWORD;
}

export default async function handler(req, res) {
    if (!checkAuth(req)) {
        return res.status(403).json({ success: false, error: "Неверный пароль" });
    }

    const sectionId = req.query.sectionId || req.body?.sectionId || req.query.range || req.body?.range;
    if (!sectionId) {
        return res.status(400).json({ success: false, error: "Укажите sectionId или range" });
    }

    const rangeDir = path.join(V2_DIR, sectionId);
    const indexPath = path.join(rangeDir, "index.json");
    const textPath = path.join(rangeDir, "TaskText.json");
    const metaPath = path.join(rangeDir, "meta.json");

    // GET
    if (req.method === "GET") {
        try {
            let tasks = [];
            let texts = [];
            let existingFiles = [];
            let existingInstructions = [];
            let rangeName = "";

            try { tasks = JSON.parse(await fs.readFile(indexPath, "utf-8")); } catch {}
            try { texts = JSON.parse(await fs.readFile(textPath, "utf-8")); } catch {}
            try { existingFiles = await fs.readdir(path.join(rangeDir, "Files")); } catch {}
            try { existingInstructions = await fs.readdir(path.join(rangeDir, "Instructions")); } catch {}
            try { const meta = JSON.parse(await fs.readFile(metaPath, "utf-8")); rangeName = meta.rangeName || ""; } catch {}

            return res.status(200).json({
                success: true,
                data: { tasks, texts, existingFiles, existingInstructions, rangeName },
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // PUT — сохранить с валидацией
    if (req.method === "PUT") {
        try {
            const { tasks, texts, rangeName } = req.body;

            if (!Array.isArray(tasks)) {
                return res.status(400).json({ success: false, error: "tasks должен быть массивом" });
            }

            let existingFiles = [];
            let existingInstructions = [];
            try { existingFiles = await fs.readdir(path.join(rangeDir, "Files")); } catch {}
            try { existingInstructions = await fs.readdir(path.join(rangeDir, "Instructions")); } catch {}

            const errors = [];

            // Проверяем уникальность номеров
            const numbers = tasks.map((t) => t.number).filter(Boolean);
            const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
            if (duplicates.length > 0) {
                errors.push({ index: -1, field: "number", message: `Дублирующиеся номера: ${[...new Set(duplicates)].join(", ")}` });
            }

            tasks.forEach((task, i) => {
                // Проверяем инструкцию
                if (task.hasInstruction) {
                    if (!task.instruction || !task.instruction.trim()) {
                        errors.push({ index: i, field: "instruction", message: "Отмечено наличие инструкции, но файл не указан" });
                    } else if (!existingInstructions.includes(task.instruction.trim())) {
                        errors.push({ index: i, field: "instruction", message: `Файл "${task.instruction}" не найден в Instructions/` });
                    } else {
                        // Проверяем расширение
                        const ext = path.extname(task.instruction.trim()).toLowerCase();
                        const realFile = existingInstructions.find((f) => f === task.instruction.trim());
                        if (realFile) {
                            const realExt = path.extname(realFile).toLowerCase();
                            if (ext !== realExt) {
                                errors.push({ index: i, field: "instruction", message: `Расширение не совпадает: указано "${ext}", реально "${realExt}"` });
                            }
                        }
                    }
                }

                // Проверяем доп. материал
                if (task.hasFile) {
                    if (!task.file || !task.file.trim()) {
                        errors.push({ index: i, field: "file", message: "Отмечено наличие доп. материала, но файл не указан" });
                    } else if (!existingFiles.includes(task.file.trim())) {
                        errors.push({ index: i, field: "file", message: `Файл "${task.file}" не найден в Files/` });
                    } else {
                        const ext = path.extname(task.file.trim()).toLowerCase();
                        const realFile = existingFiles.find((f) => f === task.file.trim());
                        if (realFile) {
                            const realExt = path.extname(realFile).toLowerCase();
                            if (ext !== realExt) {
                                errors.push({ index: i, field: "file", message: `Расширение не совпадает: указано "${ext}", реально "${realExt}"` });
                            }
                        }
                    }
                }
            });

            if (errors.length > 0) {
                return res.status(422).json({ success: false, error: "Обнаружены конфликты", errors });
            }

            // Сохраняем index.json (без служебных полей hasInstruction/hasFile)
            const cleanTasks = tasks.map((t) => {
                const clean = {
                    number: String(t.number || ""),
                    title: t.title || "",
                    contentType: t.contentType || "",
                    file: t.file || "",
                    instruction: t.instruction || "",
                    hasInstruction: !!t.hasInstruction,
                    hasFile: !!t.hasFile,
                    toolLink1: t.toolLink1 || "",
                    toolName1: t.toolName1 || "",
                    toolLink2: t.toolLink2 || "",
                    toolName2: t.toolName2 || "",
                };
                return clean;
            });

            await fs.mkdir(rangeDir, { recursive: true });
            await fs.writeFile(indexPath, JSON.stringify(cleanTasks, null, 4), "utf-8");

            if (Array.isArray(texts)) {
                const cleanTexts = texts
                    .filter((t) => t.number && (t.description || t.task))
                    .map((t) => ({
                        number: String(t.number),
                        description: t.description || "",
                        task: t.task || "",
                    }));
                await fs.writeFile(textPath, JSON.stringify(cleanTexts, null, 2), "utf-8");
            }

            // Сохраняем meta.json (название раздела, сохраняя rangeStart/rangeEnd)
            if (rangeName !== undefined) {
                let existingMeta = {};
                try { existingMeta = JSON.parse(await fs.readFile(metaPath, "utf-8")); } catch {}
                existingMeta.rangeName = rangeName || "";
                await fs.writeFile(metaPath, JSON.stringify(existingMeta, null, 2), "utf-8");
            }

            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
