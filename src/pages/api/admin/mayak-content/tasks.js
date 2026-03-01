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

    // Защита от path traversal
    if (sectionId.includes("..") || sectionId.includes("/") || sectionId.includes("\\") || path.basename(sectionId) !== sectionId) {
        return res.status(400).json({ success: false, error: "Недопустимый sectionId" });
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

            try {
                const parsed = JSON.parse(await fs.readFile(indexPath, "utf-8"));
                if (Array.isArray(parsed)) tasks = parsed;
            } catch {}
            try {
                const parsed = JSON.parse(await fs.readFile(textPath, "utf-8"));
                if (Array.isArray(parsed)) texts = parsed;
            } catch {}
            try { existingFiles = await fs.readdir(path.join(rangeDir, "Files")); } catch {}
            try { existingInstructions = await fs.readdir(path.join(rangeDir, "Instructions")); } catch {}
            try {
                const meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
                if (meta && typeof meta === "object") rangeName = meta.rangeName || "";
            } catch {}

            // Собираем размеры файлов
            let fileSizes = {};
            try {
                const filesDir = path.join(rangeDir, "Files");
                for (const f of existingFiles) {
                    try { const st = await fs.stat(path.join(filesDir, f)); fileSizes[f] = st.size; } catch {}
                }
            } catch {}
            try {
                const instrDir = path.join(rangeDir, "Instructions");
                for (const f of existingInstructions) {
                    try { const st = await fs.stat(path.join(instrDir, f)); fileSizes[f] = st.size; } catch {}
                }
            } catch {}

            return res.status(200).json({
                success: true,
                data: { tasks, texts, existingFiles, existingInstructions, rangeName, fileSizes },
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

            const warnings = [];

            // Проверяем уникальность номеров
            const numbers = tasks.map((t) => t.number).filter(Boolean);
            const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
            if (duplicates.length > 0) {
                return res.status(422).json({ success: false, error: `Дублирующиеся номера: ${[...new Set(duplicates)].join(", ")}` });
            }

            tasks.forEach((task, i) => {
                const instrName = (task.instruction || "").trim();
                const fileName = (task.file || "").trim();

                // Предупреждения о недостающих файлах (не блокируют сохранение)
                if (instrName && !existingInstructions.includes(instrName)) {
                    warnings.push({ index: i, field: "instruction", message: `Задание ${task.number}: файл инструкции не найден` });
                }
                if (fileName && !existingFiles.includes(fileName)) {
                    warnings.push({ index: i, field: "file", message: `Задание ${task.number}: файл доп. материала не найден` });
                }
            });

            // Сохраняем index.json
            const cleanTasks = tasks.map((t) => {
                const clean = {
                    number: String(t.number || ""),
                    title: t.title || "",
                    contentType: t.contentType || "",
                    file: (t.file && existingFiles.includes((t.file || "").trim())) ? t.file : "",
                    instruction: (t.instruction && existingInstructions.includes((t.instruction || "").trim())) ? t.instruction : "",
                    instructionText: t.instructionText || "",
                    materialText: t.materialText || "",
                    hasInstruction: !!(t.instructionText || "").trim(),
                    hasFile: !!(t.materialText || "").trim(),
                    hasSource: !!(t.sourceLink || "").trim(),
                    sourceLink: t.sourceLink || "",
                    toolLink1: t.toolLink1 || "",
                    toolName1: t.toolName1 || "",
                    toolLink2: t.toolLink2 || "",
                    toolName2: t.toolName2 || "",
                    services: t.services || "",
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

            return res.status(200).json({ success: true, warnings: warnings.length > 0 ? warnings : undefined });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
