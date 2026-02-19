import { promises as fs } from "fs";
import path from "path";

const ADMIN_PASSWORD = "a12345";
const V2_DIR = path.join(process.cwd(), "public", "tasks-2", "v2");
const MANIFEST_PATH = path.join(V2_DIR, "manifest.json");

function checkAuth(req) {
    const password = req.query.password || req.body?.password;
    return password === ADMIN_PASSWORD;
}

async function getManifest() {
    try {
        const data = await fs.readFile(MANIFEST_PATH, "utf-8");
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function saveManifest(slugs) {
    const sorted = [...slugs].sort((a, b) => {
        const aNum = parseInt(a.split("-")[0], 10);
        const bNum = parseInt(b.split("-")[0], 10);
        if (aNum !== bNum) return aNum - bNum;
        // Same base range — sort by suffix (101-200 before 101-200-2)
        const aSuffix = a.replace(/^\d+-\d+/, "");
        const bSuffix = b.replace(/^\d+-\d+/, "");
        if (!aSuffix && bSuffix) return -1;
        if (aSuffix && !bSuffix) return 1;
        const aIdx = aSuffix ? parseInt(aSuffix.replace("-", ""), 10) : 0;
        const bIdx = bSuffix ? parseInt(bSuffix.replace("-", ""), 10) : 0;
        return aIdx - bIdx;
    });
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(sorted, null, 2), "utf-8");
    return sorted;
}

// Generate unique slug for a range: 101-200, 101-200-2, 101-200-3, etc.
function generateSlug(range, existingSlugs) {
    if (!existingSlugs.includes(range)) return range;
    let idx = 2;
    while (existingSlugs.includes(`${range}-${idx}`)) idx++;
    return `${range}-${idx}`;
}

export default async function handler(req, res) {
    if (!checkAuth(req)) {
        return res.status(403).json({ success: false, error: "Неверный пароль" });
    }

    if (req.method === "GET") {
        try {
            const slugs = await getManifest();

            // Для каждого раздела собираем краткую статистику
            const rangesInfo = await Promise.all(
                slugs.map(async (sectionId) => {
                    const rangeDir = path.join(V2_DIR, sectionId);
                    let tasksCount = 0;
                    let filesCount = 0;
                    let hasTaskText = false;
                    let rangeName = "";
                    let rangeStart = null;
                    let rangeEnd = null;

                    try {
                        const indexData = JSON.parse(await fs.readFile(path.join(rangeDir, "index.json"), "utf-8"));
                        tasksCount = indexData.filter((t) => t.file || t.instruction || t.toolLink1 || t.toolName1).length;
                    } catch {}

                    try {
                        const files = await fs.readdir(path.join(rangeDir, "Files"));
                        filesCount = files.length;
                    } catch {}

                    try {
                        await fs.access(path.join(rangeDir, "TaskText.json"));
                        hasTaskText = true;
                    } catch {}

                    try {
                        const meta = JSON.parse(await fs.readFile(path.join(rangeDir, "meta.json"), "utf-8"));
                        rangeName = meta.rangeName || "";
                        rangeStart = meta.rangeStart || null;
                        rangeEnd = meta.rangeEnd || null;
                    } catch {}

                    // Backward compat: derive range from slug if meta doesn't have rangeStart/rangeEnd
                    const baseRange = sectionId.match(/^(\d+-\d+)/)?.[1] || sectionId;

                    return {
                        sectionId,
                        range: baseRange,
                        tasksCount,
                        filesCount,
                        hasTaskText,
                        rangeName,
                        rangeStart: rangeStart || parseInt(baseRange.split("-")[0], 10),
                        rangeEnd: rangeEnd || parseInt(baseRange.split("-")[1], 10),
                    };
                })
            );

            return res.status(200).json({ success: true, data: rangesInfo });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    if (req.method === "POST") {
        try {
            const { range, rangeName } = req.body;

            // Валидация формата диапазона: "101-200"
            const trimmedRange = range?.trim().replace(/\s+/g, "");
            const match = trimmedRange?.match(/^(\d+)-(\d+)$/);
            if (!match) {
                return res.status(400).json({ success: false, error: "Неверный формат диапазона. Пример: 101-200 (без пробелов)" });
            }

            const start = parseInt(match[1], 10);
            const end = parseInt(match[2], 10);
            if (end - start !== 99) {
                return res.status(400).json({ success: false, error: `Диапазон должен содержать ровно 100 заданий (разница 99). Вы указали ${start}-${end} (разница ${end - start})` });
            }
            if (start % 100 !== 1) {
                return res.status(400).json({ success: false, error: `Начало диапазона должно заканчиваться на 01. Попробуйте: ${start - (start % 100) + 1}-${start - (start % 100) + 100}` });
            }

            const slugs = await getManifest();

            // Generate unique slug (101-200, 101-200-2, 101-200-3, etc.)
            const slug = generateSlug(trimmedRange, slugs);

            // Создаём папку с пустыми файлами
            const rangeDir = path.join(V2_DIR, slug);
            await fs.mkdir(path.join(rangeDir, "Files"), { recursive: true });
            await fs.mkdir(path.join(rangeDir, "Instructions"), { recursive: true });

            // Создаём пустой index.json (100 записей с правильными номерами)
            const emptyTasks = new Array(end - start + 1).fill(null).map((_, i) => ({
                number: String(start + i),
                title: "",
                file: "",
                instruction: "",
                instructionText: "",
                materialText: "",
                sourceLink: "",
                toolLink1: "",
                toolName1: "",
                toolLink2: "",
                toolName2: "",
            }));
            await fs.writeFile(path.join(rangeDir, "index.json"), JSON.stringify(emptyTasks, null, 4), "utf-8");

            // Создаём пустой TaskText.json
            await fs.writeFile(path.join(rangeDir, "TaskText.json"), JSON.stringify([], null, 2), "utf-8");

            // Сохраняем meta.json (название раздела + числовой диапазон)
            await fs.writeFile(path.join(rangeDir, "meta.json"), JSON.stringify({
                rangeName: rangeName || "",
                rangeStart: start,
                rangeEnd: end,
            }, null, 2), "utf-8");

            // Обновляем manifest (slug)
            slugs.push(slug);
            const sorted = await saveManifest(slugs);

            return res.status(201).json({ success: true, data: sorted, sectionId: slug });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
