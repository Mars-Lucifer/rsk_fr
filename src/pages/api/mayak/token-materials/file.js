import fs from "fs";
import path from "path";

import { getMayakTokenMaterialFile } from "@/lib/mayakTokenMaterials";

function sanitizeDownloadName(value) {
    return path.basename(String(value || "material").replace(/[\r\n"]/g, "_")) || "material";
}

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const resolved = await getMayakTokenMaterialFile(req.query?.id);
        if (!resolved) {
            return res.status(404).json({ success: false, error: "Material file not found" });
        }

        const downloadName = sanitizeDownloadName(resolved.downloadName);
        const fallbackName = downloadName.replace(/[^\x20-\x7E]+/g, "_");

        res.setHeader("Content-Type", resolved.contentType);
        res.setHeader("Content-Length", String(resolved.size));
        res.setHeader("Content-Disposition", `inline; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
        res.setHeader("Cache-Control", "private, max-age=60");

        fs.createReadStream(resolved.filePath).pipe(res);
    } catch (error) {
        console.error("MAYAK token material download failed:", error);
        return res.status(500).json({ success: false, error: "Failed to download material" });
    }
}
