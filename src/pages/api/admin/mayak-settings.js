import { promises as fs } from "fs";
import path from "path";

const ADMIN_PASSWORD = "a12345";
const SETTINGS_FILE = path.join(process.cwd(), "data", "mayak-settings.json");

function checkAuth(req) {
    const password = req.query.password || req.body?.password;
    return password === ADMIN_PASSWORD;
}

async function readSettings() {
    try {
        const data = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf-8"));
        return data;
    } catch {
        return {};
    }
}

async function saveSettings(settings) {
    const dir = path.dirname(SETTINGS_FILE);
    try { await fs.mkdir(dir, { recursive: true }); } catch {}
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

function maskKey(value) {
    if (!value) return null;
    if (value.length <= 8) return "****";
    return value.substring(0, 4) + "..." + value.substring(value.length - 3);
}

export default async function handler(req, res) {
    if (!checkAuth(req)) {
        return res.status(403).json({ success: false, error: "Неверный пароль" });
    }

    // GET — текущие настройки (маскированные)
    if (req.method === "GET") {
        const settings = await readSettings();

        const telegramBotToken = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
        const openrouterApiKey = settings.openrouterApiKey || process.env.OPENROUTER_API_KEY || "";
        const telegramBotUsername = settings.telegramBotUsername || process.env.TELEGRAM_BOT_USERNAME || "";
        const telegramWebhookUrl = settings.telegramWebhookUrl || process.env.TELEGRAM_WEBHOOK_URL || "";
        const baseUrl = settings.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || "";

        return res.status(200).json({
            success: true,
            data: {
                telegramBotToken: maskKey(telegramBotToken),
                telegramBotTokenIsSet: !!telegramBotToken,
                openrouterApiKey: maskKey(openrouterApiKey),
                openrouterApiKeyIsSet: !!openrouterApiKey,
                telegramBotUsername,
                telegramBotUsernameIsSet: !!telegramBotUsername,
                telegramWebhookUrl,
                telegramWebhookUrlIsSet: !!telegramWebhookUrl,
                baseUrl,
                baseUrlIsSet: !!baseUrl,
            },
        });
    }

    // POST — сохранение настроек
    if (req.method === "POST") {
        const { telegramBotToken, openrouterApiKey, telegramBotUsername, telegramWebhookUrl, baseUrl } = req.body;

        const settings = await readSettings();
        let botRestarted = false;

        if (telegramBotToken !== undefined) {
            settings.telegramBotToken = telegramBotToken;
            process.env.TELEGRAM_BOT_TOKEN = telegramBotToken;

            // Перезапуск бота с новым токеном
            try {
                const { restartBot } = await import("../../../lib/telegramBot.js");
                await restartBot();
                botRestarted = true;
            } catch (err) {
                console.error("[Settings] Ошибка перезапуска бота:", err.message);
            }
        }

        if (openrouterApiKey !== undefined) {
            settings.openrouterApiKey = openrouterApiKey;
            process.env.OPENROUTER_API_KEY = openrouterApiKey;
        }

        if (telegramBotUsername !== undefined) {
            settings.telegramBotUsername = telegramBotUsername;
            process.env.TELEGRAM_BOT_USERNAME = telegramBotUsername;
        }

        if (telegramWebhookUrl !== undefined) {
            settings.telegramWebhookUrl = telegramWebhookUrl;
            process.env.TELEGRAM_WEBHOOK_URL = telegramWebhookUrl;
        }

        if (baseUrl !== undefined) {
            settings.baseUrl = baseUrl;
            process.env.NEXT_PUBLIC_BASE_URL = baseUrl;
        }

        await saveSettings(settings);

        return res.status(200).json({
            success: true,
            botRestarted,
        });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
