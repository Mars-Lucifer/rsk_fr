import crypto from "node:crypto";

// Через эту админку доступны паспортные данные делегатов и сканы паспортов,
// поэтому в кукисе лежит не пароль, а подписанный токен с сроком жизни:
// утечка кукиса не раскрывает пароль и истекает сама.

export const ADMIN_COOKIE = "rsk_admin";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Пароль только из окружения. Значения по умолчанию нет — иначе оно уедет в прод. */
export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || process.env.MAYAK_ADMIN_PASSWORD || "";
}

export function isAdminConfigured() {
  return getAdminPassword().length > 0;
}

function sessionSecret() {
  // Отдельный секрет предпочтителен: смена пароля тогда не рвёт сессии, и наоборот.
  return process.env.CONFERENCIA_SESSION_SECRET || getAdminPassword();
}

function equals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));

  // timingSafeEqual требует одинаковой длины, поэтому сравниваем хэши.
  return crypto.timingSafeEqual(
    crypto.createHash("sha256").update(left).digest(),
    crypto.createHash("sha256").update(right).digest(),
  );
}

export function isPasswordValid(password) {
  const expected = getAdminPassword();
  if (!expected) {
    return false;
  }

  return equals(password, expected);
}

function sign(payload) {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

export function createSessionToken(now = Date.now()) {
  const expiresAt = String(now + SESSION_TTL_MS);
  return `${expiresAt}.${sign(expiresAt)}`;
}

export function isSessionTokenValid(token, now = Date.now()) {
  if (!token || typeof token !== "string" || !isAdminConfigured()) {
    return false;
  }

  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature || !/^\d+$/.test(expiresAt)) {
    return false;
  }

  if (Number(expiresAt) <= now) {
    return false;
  }

  return equals(signature, sign(expiresAt));
}

export function sessionCookie(token) {
  const parts = [
    `${ADMIN_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function clearedSessionCookie() {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function isAdminSession(req) {
  return isSessionTokenValid(req?.cookies?.[ADMIN_COOKIE]);
}
