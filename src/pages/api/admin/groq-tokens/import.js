import { requireMayakAdmin } from "../../../../lib/mayakAdminAuth.js";
import { readMayakSettings, writeMayakSettings } from "../../../../lib/mayakSettings.js";
import { normalizeGroqTokenEntries } from "../../../../lib/mayakGroq.js";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "2mb",
        },
    },
};

function accountFromIndex(index) {
    return `acc${String(index + 1).padStart(2, "0")}`;
}

function extractTokenSource(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload?.groqTokens)) {
        return payload.groqTokens;
    }

    if (Array.isArray(payload?.qwenTokens)) {
        return payload.qwenTokens;
    }

    if (Array.isArray(payload?.tokens)) {
        return payload.tokens;
    }

    if (payload && typeof payload === "object") {
        const cacheEntries = Object.entries(payload)
            .filter(([, value]) => value && typeof value === "object" && typeof value.token === "string")
            .map(([account, value]) => ({
                account,
                name: value.email || account,
                email: value.email || "",
                token: value.token,
            }));

        if (cacheEntries.length > 0) {
            return cacheEntries;
        }
    }

    return [];
}

function normalizeImportedTokens(payload) {
    return normalizeGroqTokenEntries(extractTokenSource(payload)).map((entry, index) => {
        const account = entry.account || entry.sessionAccount || accountFromIndex(index);
        return {
            name: entry.name || entry.email || account,
            token: entry.token,
            email: entry.email || "",
            account,
            sessionAccount: entry.sessionAccount || "",
        };
    });
}

export default async function handler(req, res) {
    if (!requireMayakAdmin(req, res)) {
        return;
    }

    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const importedTokens = normalizeImportedTokens(req.body);
        if (importedTokens.length === 0) {
            return res.status(400).json({ success: false, error: "В файле не найдены Groq-токены" });
        }

        const settings = await readMayakSettings();
        settings.groqTokens = importedTokens;
        await writeMayakSettings(settings);

        return res.status(200).json({
            success: true,
            count: importedTokens.length,
            tokens: importedTokens.map(({ account, email, name }) => ({ account, email, name })),
        });
    } catch (error) {
        console.error("[GroqTokens] import failed:", error);
        return res.status(500).json({
            success: false,
            error: error.message || "Не удалось импортировать Groq-токены",
        });
    }
}
