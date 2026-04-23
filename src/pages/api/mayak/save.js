import fs from "fs";
import path from "path";

import { ensureMayakCertificateNumberInStore } from "@/lib/mayakCertificateNumbers";

let lockPromise = Promise.resolve();

function safeReadJsonObject(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    try {
        const rawValue = fs.readFileSync(filePath, "utf-8").trim();
        if (!rawValue) {
            return {};
        }

        const parsed = JSON.parse(rawValue);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
        const backupPath = `${filePath}.corrupted-${Date.now()}.bak`;
        try {
            fs.copyFileSync(filePath, backupPath);
        } catch {}
        console.warn("Failed to parse MAYAK results store, fallback to empty object:", error);
        return {};
    }
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { key, userId, data } = req.body || {};

    if (!key || !userId || !data) {
        return res.status(400).json({ error: "Missing required fields: key, userId, data" });
    }

    let release;
    const previousLock = lockPromise;
    lockPromise = new Promise((resolve) => {
        release = resolve;
    });
    await previousLock;

    const filePath = path.join(process.cwd(), "data", "results.json");

    try {
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const allData = safeReadJsonObject(filePath);
        if (!allData[key] || typeof allData[key] !== "object") {
            allData[key] = {};
        }

        const currentEntry = allData[key]?.[userId] && typeof allData[key][userId] === "object" ? allData[key][userId] : {};
        const certificateNumber = ensureMayakCertificateNumberInStore(allData, { tokenKey: key, userId });
        const isCompletionSave = data.isFinished === true || Boolean(data.finishedAt);

        const finalData = {
            ...currentEntry,
            ...data,
            certificateNumber,
            createdAt: currentEntry.createdAt || data.createdAt || new Date().toISOString(),
            ...(isCompletionSave
                ? {
                      finishedAt: data.finishedAt || currentEntry.finishedAt || new Date().toISOString(),
                      isFinished: true,
                  }
                : {
                      finishedAt: currentEntry.finishedAt || null,
                      isFinished: currentEntry.isFinished === true,
                  }),
        };

        allData[key][userId] = finalData;

        fs.writeFileSync(filePath, JSON.stringify(allData, null, 2));
        return res.status(200).json({ success: true, certificateNumber, data: finalData });
    } catch (error) {
        console.error("MAYAK save error:", error);
        return res.status(500).json({ error: error?.message || "Server error" });
    } finally {
        release();
    }
}
