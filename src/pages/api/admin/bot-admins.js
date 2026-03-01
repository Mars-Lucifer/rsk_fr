import { promises as fs } from "fs";
import path from "path";

const ADMIN_PASSWORD = "a12345";
const ADMINS_FILE = path.join(process.cwd(), "data", "botAdmins.json");

function checkAuth(req) {
    const password = req.query.password || req.body?.password;
    return password === ADMIN_PASSWORD;
}

async function readAdmins() {
    try {
        const data = JSON.parse(await fs.readFile(ADMINS_FILE, "utf-8"));
        return data.admins || [];
    } catch {
        return [];
    }
}

async function saveAdmins(admins) {
    const dir = path.dirname(ADMINS_FILE);
    try { await fs.mkdir(dir, { recursive: true }); } catch {}
    await fs.writeFile(ADMINS_FILE, JSON.stringify({ admins }, null, 2), "utf-8");
}

export default async function handler(req, res) {
    if (!checkAuth(req)) {
        return res.status(403).json({ success: false, error: "Неверный пароль" });
    }

    // GET — список админов + инфо о боте
    if (req.method === "GET") {
        const admins = await readAdmins();
        const botUsername = process.env.TELEGRAM_BOT_USERNAME || null;
        const botLink = botUsername ? `https://t.me/${botUsername}` : null;
        return res.status(200).json({
            success: true,
            data: admins,
            bot: { username: botUsername, link: botLink },
        });
    }

    // POST — добавить админа
    if (req.method === "POST") {
        const { telegramId, name } = req.body;
        if (!telegramId) {
            return res.status(400).json({ success: false, error: "Укажите telegramId" });
        }
        const admins = await readAdmins();
        if (admins.some((a) => String(a.telegramId) === String(telegramId))) {
            return res.status(409).json({ success: false, error: "Админ с таким ID уже существует" });
        }
        admins.push({
            telegramId: String(telegramId),
            name: name || "",
            addedAt: new Date().toISOString(),
        });
        await saveAdmins(admins);
        return res.status(200).json({ success: true, data: admins });
    }

    // DELETE — удалить админа
    if (req.method === "DELETE") {
        const { telegramId } = req.body;
        if (!telegramId) {
            return res.status(400).json({ success: false, error: "Укажите telegramId" });
        }
        let admins = await readAdmins();
        const before = admins.length;
        admins = admins.filter((a) => String(a.telegramId) !== String(telegramId));
        if (admins.length === before) {
            return res.status(404).json({ success: false, error: "Админ не найден" });
        }
        await saveAdmins(admins);
        return res.status(200).json({ success: true, data: admins });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
