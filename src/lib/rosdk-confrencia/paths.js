import path from "node:path";

// Заявки и сканы должны переживать перезапуск, поэтому только постоянный диск.
// Ветки на эфемерный /tmp здесь быть не должно: на serverless заявки исчезали бы
// между запросами. Для другого расположения — CONFERENCIA_DATA_DIR.
export const DATA_DIR =
  process.env.CONFERENCIA_DATA_DIR || path.join(process.cwd(), "data");

export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const DB_PATH = path.join(DATA_DIR, "rsk.sqlite");
