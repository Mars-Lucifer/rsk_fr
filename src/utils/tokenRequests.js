import fs from "fs";
import path from "path";
import crypto from "crypto";

const REQUESTS_FILE_PATH = path.join(process.cwd(), "data", "tokenRequests.json");

// Чтение всех запросов
export function readRequests() {
    try {
        if (!fs.existsSync(REQUESTS_FILE_PATH)) {
            const dir = path.dirname(REQUESTS_FILE_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(REQUESTS_FILE_PATH, JSON.stringify({ requests: [] }, null, 2));
            return [];
        }
        const data = JSON.parse(fs.readFileSync(REQUESTS_FILE_PATH, "utf-8"));
        return data.requests || [];
    } catch (error) {
        console.error("Error reading token requests:", error);
        return [];
    }
}

// Сохранение запросов
export function saveRequests(requests) {
    try {
        const dir = path.dirname(REQUESTS_FILE_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(REQUESTS_FILE_PATH, JSON.stringify({ requests }, null, 2));
        return true;
    } catch (error) {
        console.error("Error saving token requests:", error);
        return false;
    }
}

// Статусы:
// awaiting_code — бот ждёт секретный код от пользователя
// pending       — код получен, ждём решения админа
// approved      — админ одобрил и привязал токен
// rejected      — админ отклонил запрос

// Создать новый запрос (пользователь отправил /token)
export function createRequest(telegramId, username, firstName) {
    const requests = readRequests();

    // Если уже есть активный запрос (awaiting_code или pending) — не создаём дубль
    const existing = requests.find(
        (r) => r.telegramId === String(telegramId) && (r.status === "awaiting_code" || r.status === "pending")
    );
    if (existing) {
        return { created: false, request: existing, reason: "active_request_exists" };
    }

    const newRequest = {
        id: crypto.randomUUID(),
        telegramId: String(telegramId),
        username: username || null,
        firstName: firstName || null,
        chatId: String(telegramId),
        status: "awaiting_code",
        secretCode: null,
        assignedTokenId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    requests.push(newRequest);
    saveRequests(requests);
    return { created: true, request: newRequest };
}

// Сохранить секретный код (пользователь ввёл код после /token)
export function submitCode(telegramId, code) {
    const requests = readRequests();
    const index = requests.findIndex(
        (r) => r.telegramId === String(telegramId) && r.status === "awaiting_code"
    );
    if (index === -1) return null;

    requests[index].secretCode = code;
    requests[index].status = "pending";
    requests[index].updatedAt = new Date().toISOString();

    saveRequests(requests);
    return requests[index];
}

// Найти запрос по telegramId в определённом статусе
export function getRequestByTelegramId(telegramId, status = null) {
    const requests = readRequests();
    return requests.find((r) => {
        if (r.telegramId !== String(telegramId)) return false;
        if (status) return r.status === status;
        return true;
    }) || null;
}

// Найти одобренный запрос (у пользователя есть токен)
export function getApprovedRequest(telegramId) {
    const requests = readRequests();
    return requests.find(
        (r) => r.telegramId === String(telegramId) && r.status === "approved"
    ) || null;
}

// Обновить запрос (для админ-панели)
export function updateRequest(requestId, updates) {
    const requests = readRequests();
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) return null;

    requests[index] = {
        ...requests[index],
        ...updates,
        updatedAt: new Date().toISOString(),
    };

    saveRequests(requests);
    return requests[index];
}

// Получить все запросы (для админ-панели)
export function getAllRequests() {
    return readRequests();
}

// Удалить запрос
export function deleteRequest(requestId) {
    const requests = readRequests();
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) return null;

    const deleted = requests[index];
    requests.splice(index, 1);
    saveRequests(requests);
    return deleted;
}
