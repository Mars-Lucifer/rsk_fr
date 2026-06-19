import { requireMayakAdmin } from "../../../../lib/mayakAdminAuth.js";
import { readSectionJson, readManifest, writeManifest, writeSectionJson, listSectionFiles, getSectionBundle, ensureSectionDir } from "../../../../lib/mayakContentStorage.js";
import { validateDeckStandard } from "../../../../lib/mayakProgressModel.js";

async function saveSortedManifest(slugs) {
    const sorted = [...slugs].sort((a, b) => {
        const aNum = parseInt(a.split("-")[0], 10);
        const bNum = parseInt(b.split("-")[0], 10);
        if (aNum !== bNum) return aNum - bNum;
        const aSuffix = a.replace(/^\d+-\d+/, "");
        const bSuffix = b.replace(/^\d+-\d+/, "");
        if (!aSuffix && bSuffix) return -1;
        if (aSuffix && !bSuffix) return 1;
        const aIdx = aSuffix ? parseInt(aSuffix.replace("-", ""), 10) : 0;
        const bIdx = bSuffix ? parseInt(bSuffix.replace("-", ""), 10) : 0;
        return aIdx - bIdx;
    });
    await writeManifest(sorted);
    return sorted;
}

function generateSlug(range, existingSlugs) {
    if (!existingSlugs.includes(range)) return range;
    let idx = 2;
    while (existingSlugs.includes(`${range}-${idx}`)) idx++;
    return `${range}-${idx}`;
}

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method === "GET") {
        try {
            const sectionIds = await readManifest();
            const rangesInfo = await Promise.all(
                sectionIds.map(async (sectionId) => {
                    const bundle = await getSectionBundle(sectionId, { includeTexts: false });
                    const existingFiles = await listSectionFiles(sectionId, "files");
                    const texts = await readSectionJson(sectionId, "TaskText.json", []);
                    const tasksCount = bundle.tasks.filter((t) => t.file || t.instruction || t.toolLink1 || t.toolName1).length;
                    const baseRange = sectionId.match(/^(\d+-\d+)/)?.[1] || sectionId;
                    // Валидация по стандарту: распознаны ли типы части «Я»/«Мы».
                    // dashboardReady=false → колода не передаётся в дашборд (помечается в селекторе).
                    const standard = validateDeckStandard(bundle.tasks || []);
                    return {
                        sectionId,
                        range: baseRange,
                        tasksCount,
                        filesCount: existingFiles.length,
                        hasTaskText: Array.isArray(texts) && texts.length > 0,
                        rangeName: bundle.meta?.rangeName || "",
                        rangeStart: bundle.meta?.rangeStart || parseInt(baseRange.split("-")[0], 10),
                        rangeEnd: bundle.meta?.rangeEnd || parseInt(baseRange.split("-")[1], 10),
                        standard: {
                            dashboardReady: standard.dashboardReady,
                            issues: standard.issues,
                            warnings: standard.warnings,
                            formats: standard.formats,
                            directions: standard.directions,
                        },
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

            const slugs = await readManifest();
            const slug = generateSlug(trimmedRange, slugs);
            await ensureSectionDir(slug);

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
            await writeSectionJson(slug, "index.json", emptyTasks);
            await writeSectionJson(slug, "TaskText.json", []);
            await writeSectionJson(slug, "meta.json", {
                rangeName: rangeName || "",
                rangeStart: start,
                rangeEnd: end,
            });

            slugs.push(slug);
            const sorted = await saveSortedManifest(slugs);
            return res.status(201).json({ success: true, data: sorted, sectionId: slug });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
