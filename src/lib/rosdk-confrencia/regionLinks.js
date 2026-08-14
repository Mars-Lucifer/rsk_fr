import crypto from "node:crypto";
import { persistentSecret } from "./db.js";
import { regions } from "./regions.js";

/**
 * Персональная ссылка отделения: `/conferencia?k=<токен>`. Токен — подпись названия
 * субъекта, поэтому список ссылок не хранится: он всегда выводится из справочника.
 *
 * Что это даёт отделению: субъект в форме уже проставлен и не меняется, а сама
 * ссылка работает весь месяц — по ней открывается та же заявка с любого устройства.
 */

const TOKEN_LENGTH = 12;

/** Соль лежит в базе рядом с заявками: смена пароля админки ссылки не рвёт. */
function linkSecret() {
  return process.env.CONFERENCIA_LINK_SECRET || persistentSecret("region-link");
}

export function regionToken(region) {
  return crypto
    .createHmac("sha256", linkSecret())
    .update(region)
    .digest("base64url")
    .slice(0, TOKEN_LENGTH);
}

let tokenIndex = null;

/** Название субъекта по токену либо null. Справочник фиксирован — индекс строим один раз. */
export function regionByToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  if (!tokenIndex) {
    tokenIndex = new Map(regions.map((region) => [regionToken(region), region]));
  }

  return tokenIndex.get(token) ?? null;
}

/** Адрес страницы для запроса: за прокси протокол приходит заголовком. */
export function originFromRequest(req) {
  const headers = req?.headers ?? {};
  const forwarded = String(headers["x-forwarded-proto"] ?? "")
    .split(",")[0]
    .trim();
  const protocol =
    forwarded || (String(headers.host ?? "").startsWith("localhost") ? "http" : "https");

  return `${protocol}://${headers.host ?? ""}`;
}

export function regionLinkUrl(origin, region) {
  return `${origin}/conferencia?k=${regionToken(region)}`;
}
