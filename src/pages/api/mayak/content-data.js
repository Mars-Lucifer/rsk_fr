import fs from "fs/promises";
import path from "path";

import { requireMayakAdmin } from "@/lib/mayakAdminAuth";

const dataFilePath = path.join(process.cwd(), "data", "mayakData.json");

function normalizeKey(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function sanitizeLink(rawLink, index) {
    const order = Number(rawLink?.order);
    const nextLink = {
        name: String(rawLink?.name || "").trim(),
        url: String(rawLink?.url || "").trim(),
        description: String(rawLink?.description || "").trim(),
        iconType: String(rawLink?.iconType || "standard").trim() || "standard",
        instructionImage: String(rawLink?.instructionImage || "").trim(),
        buttonLabel: String(rawLink?.buttonLabel || "").trim(),
        order: Number.isFinite(order) ? order : index,
    };

    if (rawLink?.required === false) {
        nextLink.required = false;
    }

    return nextLink;
}

function sanitizeMiscSubCategories(incomingData, currentData) {
    const incomingMisc = Array.isArray(incomingData?.defaultTypes)
        ? incomingData.defaultTypes.find((type) => type?.key === "misc")
        : null;
    const currentMisc = Array.isArray(currentData?.defaultTypes)
        ? currentData.defaultTypes.find((type) => type?.key === "misc")
        : null;
    const sourceSubCategories = Array.isArray(incomingMisc?.subCategories) ? incomingMisc.subCategories : currentMisc?.subCategories || [];
    const usedKeys = new Set();

    return sourceSubCategories
        .map((subCategory, index) => {
            const baseKey = normalizeKey(subCategory?.key) || `custom-${Date.now()}-${index}`;
            let key = baseKey;
            let suffix = 2;
            while (usedKeys.has(key)) {
                key = `${baseKey}-${suffix}`;
                suffix += 1;
            }
            usedKeys.add(key);

            return {
                key,
                label: String(subCategory?.label || key).trim() || key,
            };
        })
        .filter((subCategory) => subCategory.key);
}

function buildEditableServicesData(incomingData, currentData) {
    const nextData = JSON.parse(JSON.stringify(currentData));
    const nextSubCategories = sanitizeMiscSubCategories(incomingData, currentData);
    const allowedLinkKeys = new Set();

    nextData.defaultTypes = (Array.isArray(nextData.defaultTypes) ? nextData.defaultTypes : []).map((type) => {
        if (type?.key === "misc") {
            allowedLinkKeys.add("misc");
            nextSubCategories.forEach((subCategory) => allowedLinkKeys.add(subCategory.key));
            return { ...type, subCategories: nextSubCategories };
        }

        if (type?.key) {
            allowedLinkKeys.add(type.key);
        }

        return type;
    });

    const incomingLinks = incomingData?.defaultLinks && typeof incomingData.defaultLinks === "object" ? incomingData.defaultLinks : {};
    const nextLinks = {};

    for (const key of allowedLinkKeys) {
        const links = Array.isArray(incomingLinks[key]) ? incomingLinks[key] : [];
        nextLinks[key] = links
            .map((link, index) => sanitizeLink(link, index))
            .filter((link) => link.name || link.url || link.description)
            .sort((a, b) => {
                const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : Infinity;
                const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : Infinity;
                return orderA - orderB;
            });
    }

    nextData.defaultLinks = nextLinks;
    return nextData;
}

export default async function handler(req, res) {
    try {
        const fileContents = await fs.readFile(dataFilePath, "utf8");
        const currentData = JSON.parse(fileContents);

        if (req.method === "GET") {
            return res.status(200).json(currentData);
        }

        if (req.method === "POST") {
            if (!requireMayakAdmin(req, res)) {
                return;
            }

            const nextData = buildEditableServicesData(req.body || {}, currentData);
            await fs.writeFile(dataFilePath, JSON.stringify(nextData, null, 2), "utf8");

            return res.status(200).json({
                success: true,
                message: "Данные успешно сохранены",
                data: nextData,
            });
        }

        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    } catch (error) {
        console.error("MAYAK content-data API error:", error);
        return res.status(500).json({ success: false, message: "Внутренняя ошибка сервера", error: error.message });
    }
}
