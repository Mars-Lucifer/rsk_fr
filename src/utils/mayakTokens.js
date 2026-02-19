import fs from "fs";
import path from "path";
import crypto from "crypto";

const TOKENS_FILE_PATH = path.join(process.cwd(), "data", "mayakTokens.json");

// Чтение всех токенов
export function readTokens() {
    try {
        if (!fs.existsSync(TOKENS_FILE_PATH)) {
            fs.writeFileSync(TOKENS_FILE_PATH, JSON.stringify({ tokens: [] }, null, 2));
            return [];
        }
        const data = JSON.parse(fs.readFileSync(TOKENS_FILE_PATH, "utf-8"));
        return data.tokens || [];
    } catch (error) {
        console.error("Error reading tokens:", error);
        return [];
    }
}

// Сохранение токенов
export function saveTokens(tokens) {
    try {
        const dir = path.dirname(TOKENS_FILE_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(TOKENS_FILE_PATH, JSON.stringify({ tokens }, null, 2));
        return true;
    } catch (error) {
        console.error("Error saving tokens:", error);
        return false;
    }
}

// Генерация криптографически стойкого токена
export function generateToken() {
    return crypto.randomBytes(32).toString("hex");
}

// Генерация уникального ID
export function generateId() {
    return crypto.randomUUID();
}

// Создание нового токена
export function createToken(name, usageLimit, taskRange = null, customToken = null, sectionId = null) {
    const tokens = readTokens();
    const now = new Date().toISOString();

    if (customToken) {
        if (tokens.some((t) => t.token === customToken)) {
            throw new Error("Токен с таким значением уже существует");
        }
    }

    const newToken = {
        id: generateId(),
        name: name,
        token: customToken || generateToken(),
        usageLimit: parseInt(usageLimit, 10),
        usedCount: 0,
        sectionId: sectionId || null, // Slug папки (например, "101-200-2")
        taskRange: taskRange, // Диапазон заданий (например, "101-200")
        createdAt: now,
        updatedAt: now,
        isActive: true,
    };

    tokens.push(newToken);
    saveTokens(tokens);

    return newToken;
}

// Получение токена по ID
export function getTokenById(id) {
    const tokens = readTokens();
    return tokens.find((t) => t.id === id) || null;
}

// Получение токена по значению token
export function getTokenByValue(tokenValue) {
    const tokens = readTokens();
    return tokens.find((t) => t.token === tokenValue) || null;
}

// Обновление токена
export function updateToken(id, updates) {
    const tokens = readTokens();
    const index = tokens.findIndex((t) => t.id === id);

    if (index === -1) return null;

    tokens[index] = {
        ...tokens[index],
        ...updates,
        updatedAt: new Date().toISOString(),
    };

    saveTokens(tokens);
    return tokens[index];
}

// Добавление попыток к токену
export function addAttemptsToToken(id, attempts) {
    const tokens = readTokens();
    const index = tokens.findIndex((t) => t.id === id);

    if (index === -1) return null;

    tokens[index].usageLimit += parseInt(attempts, 10);
    tokens[index].updatedAt = new Date().toISOString();

    saveTokens(tokens);
    return tokens[index];
}

// Деактивация токена (УДАЛЕНО - теперь удаляем полностью)
// export function deactivateToken(id) {
//     return updateToken(id, { isActive: false });
// }

// Полное удаление токена
export function deleteToken(id) {
    const tokens = readTokens();
    const index = tokens.findIndex((t) => t.id === id);

    if (index === -1) return null;

    const deletedToken = tokens[index];
    tokens.splice(index, 1); // Удаляем элемент из массива

    saveTokens(tokens);
    return deletedToken;
}

// Использование токена (увеличение счетчика)
export function useToken(tokenValue) {
    const tokens = readTokens();
    const index = tokens.findIndex((t) => t.token === tokenValue);

    if (index === -1) {
        return { success: false, error: "Токен не найден" };
    }

    const token = tokens[index];

    if (!token.isActive) {
        return { success: false, error: "Токен деактивирован" };
    }

    if (token.usedCount >= token.usageLimit) {
        return { success: false, error: "Лимит использований исчерпан" };
    }

    tokens[index].usedCount += 1;
    tokens[index].updatedAt = new Date().toISOString();

    saveTokens(tokens);

    return {
        success: true,
        token: tokens[index],
        remainingAttempts: tokens[index].usageLimit - tokens[index].usedCount
    };
}

// Проверка валидности токена (без использования)
export function validateToken(tokenValue) {
    const token = getTokenByValue(tokenValue);

    if (!token) {
        return { valid: false, error: "Токен не найден" };
    }

    if (!token.isActive) {
        return { valid: false, error: "Токен деактивирован" };
    }

    if (token.usedCount >= token.usageLimit) {
        return {
            valid: false,
            error: "Лимит использований исчерпан",
            token, // Возвращаем токен, чтобы API мог видеть его статус
            remainingAttempts: 0
        };
    }

    return {
        valid: true,
        token,
        remainingAttempts: token.usageLimit - token.usedCount
    };
}

// Получение всех токенов со статистикой
export function getAllTokensWithStats() {
    const tokens = readTokens();
    return tokens.map((t) => ({
        ...t,
        remainingAttempts: t.usageLimit - t.usedCount,
        isExhausted: t.usedCount >= t.usageLimit,
    }));
}
