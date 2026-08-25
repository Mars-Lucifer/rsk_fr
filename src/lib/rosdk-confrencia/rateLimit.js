// Ограничение частоты для публичных эндпоинтов конференции: заявки и загрузка
// сканов открыты без авторизации, поэтому нужен хотя бы простой заслон от того,
// чтобы один клиент забил базу и диск.
//
// ponytail: счётчики в памяти процесса. Одного контейнера достаточно; при
// нескольких инстансах или частых рестартах переносить в redis. В dev каждый
// API-роут собирается отдельным бандлом, поэтому счётчики там не общие —
// в проде сборка одна и лимит работает на все роуты сразу.

const buckets = new Map();

/** Порции: сколько запросов и за какое окно. Числа с запасом на живое отделение. */
export const CREATE_SUBMISSION_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 };
export const UPLOAD_LIMIT = { max: 100, windowMs: 60 * 60 * 1000 };

/** Размер одного файла. Скан паспорта с телефона — единицы мегабайт. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function clientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : String(forwarded ?? "").split(",")[0].trim();

  return ip || req.socket?.remoteAddress || "unknown";
}

/**
 * Возвращает null, если запрос разрешён, иначе — через сколько секунд повторить.
 */
export function checkRateLimit(name, req, limit) {
  const key = `${name}:${clientKey(req)}`;
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((time) => now - time < limit.windowMs);

  if (hits.length >= limit.max) {
    const retryAfterMs = limit.windowMs - (now - hits[0]);
    buckets.set(key, hits);
    return Math.max(1, Math.ceil(retryAfterMs / 1000));
  }

  hits.push(now);
  buckets.set(key, hits);

  // Чистим протухшие ключи, чтобы карта не росла бесконечно.
  if (buckets.size > 5000) {
    for (const [bucketKey, times] of buckets) {
      if (times.every((time) => now - time >= limit.windowMs)) {
        buckets.delete(bucketKey);
      }
    }
  }

  return null;
}

/** Отвечает 429 и возвращает true, если лимит исчерпан. */
export function rejectIfRateLimited(res, name, req, limit) {
  const retryAfter = checkRateLimit(name, req, limit);

  if (retryAfter === null) {
    return false;
  }

  const minutes = Math.ceil(retryAfter / 60);
  res.setHeader("Retry-After", String(retryAfter));
  res.status(429).json({
    error: `Слишком много запросов с этого адреса. Повторите через ${minutes} мин. Если это ошибка, напишите в Оргкомитет.`,
  });

  return true;
}
