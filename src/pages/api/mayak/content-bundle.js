import { getAllSectionsIndexBundles, getSectionBundle, readManifest } from "../../../lib/mayakContentStorage.js";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { sectionId, includeTexts } = req.query;
        if (sectionId) {
            // validateFiles: рантайм тренажёра получает ссылки, выверенные по
            // диску — битая ссылка в index.json не доходит до клиента и не даёт 404.
            const bundle = await getSectionBundle(sectionId, { includeTexts: includeTexts !== "0", validateFiles: true });
            return res.status(200).json({ success: true, data: bundle });
        }

        const data = await getAllSectionsIndexBundles({ validateFiles: true });
        return res.status(200).json({
            success: true,
            data: {
                sectionIds: Array.isArray(data.sectionIds) ? data.sectionIds : await readManifest(),
                bundles: Array.isArray(data.bundles) ? data.bundles : [],
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
