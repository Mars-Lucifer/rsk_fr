// In-memory кэш для тяжёлого ответа GET /api/admin/mayak-content/ranges.
// Каждый вход в список колод иначе перечитывает index.json/meta.json/TaskText.json
// и делает readdir + validateDeckStandard по КАЖДОЙ колоде — десятки ФС-операций
// на один рендер.
//
// Корректность важнее скорости, поэтому кэш сбрасывается ЯВНО на каждом пути
// записи контента (создание/правка колоды, загрузка/удаление файлов, генерация
// инструкций). TTL — лишь страховочный backstop на случай прямых правок файлов
// на диске мимо приложения: даже при пропущенной инвалидации список
// самовосстановится за TTL_MS.
//
// Процесс Next.js один на все API-роуты, поэтому module-level singleton общий.

const TTL_MS = 15000;

let cache = null; // { value, storedAt }

export function getRangesCache() {
    if (!cache) return null;
    if (Date.now() - cache.storedAt > TTL_MS) {
        cache = null;
        return null;
    }
    return cache.value;
}

export function setRangesCache(value) {
    cache = { value, storedAt: Date.now() };
}

export function invalidateRangesCache() {
    cache = null;
}
