import fs from "fs";
import path from "path";
import crypto from "crypto";

import { readJsonFile, withJsonFileLock, writeJsonFileAtomic } from "@/lib/jsonFileLock";

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

// Сохранение токенов.
//
// Пишем во временный файл и переименовываем: читатели (validateToken, центр
// токенов) лок не берут, и при обычной перезаписи ловили файл недописанным —
// в логах это выглядело как `SyntaxError: Unexpected end of JSON input` и 500.
// Rename атомарен, читатель видит либо старую версию целиком, либо новую.
export function saveTokens(tokens) {
    try {
        const dir = path.dirname(TOKENS_FILE_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const tempFile = `${TOKENS_FILE_PATH}.${process.pid}.${Date.now()}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify({ tokens }, null, 2), "utf-8");
        fs.renameSync(tempFile, TOKENS_FILE_PATH);
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

// Срок жизни токена. Поле необязательное: у токенов, созданных из админки,
// его нет — они бессрочные, как и раньше. Ставится только там, где токен
// привязан к сессии и должен умереть вместе с ней.
export function isTokenExpired(token, now = Date.now()) {
    const expiresTs = Date.parse(String(token?.expiresAt || "").trim());
    return Number.isFinite(expiresTs) && expiresTs <= now;
}

// Создание нового токена
export function createToken(name, usageLimit, taskRange = null, customToken = null, sectionId = null, expiresAt = null) {
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
        expiresAt: expiresAt || null,
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

// Использование токена (увеличение счетчика).
//
// Весь read-modify-write идёт внутри одного файлового лока — как в
// mayakSessionTokens. Без лока одновременный вход группы по одной ссылке терял
// инкременты: все читают один usedCount и пишут одно и то же значение, часть
// входов проходит бесплатно. С тех пор как ссылка «Без инспектора» расходует
// оплаченный лимит доступа, это стоит денег.
export async function useToken(tokenValue) {
    return withJsonFileLock(TOKENS_FILE_PATH, async () => {
        const store = await readJsonFile(TOKENS_FILE_PATH, { tokens: [] });
        const tokens = Array.isArray(store?.tokens) ? store.tokens : [];
        const index = tokens.findIndex((t) => t.token === tokenValue);

        if (index === -1) {
            return { success: false, error: "Токен не найден" };
        }

        const token = tokens[index];

        if (!token.isActive) {
            return { success: false, error: "Токен деактивирован" };
        }

        if (isTokenExpired(token)) {
            return { success: false, error: "Срок действия ссылки истёк" };
        }

        if (token.usedCount >= token.usageLimit) {
            return { success: false, error: "Лимит использований исчерпан" };
        }

        tokens[index] = {
            ...token,
            usedCount: token.usedCount + 1,
            updatedAt: new Date().toISOString(),
        };

        await writeJsonFileAtomic(TOKENS_FILE_PATH, { tokens });

        return {
            success: true,
            token: tokens[index],
            remainingAttempts: tokens[index].usageLimit - tokens[index].usedCount,
        };
    });
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

    if (isTokenExpired(token)) {
        return { valid: false, error: "Срок действия ссылки истёк", token, remainingAttempts: 0 };
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
        isExpired: isTokenExpired(t),
    }));
}
