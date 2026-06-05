import path from "node:path";

export const DATA_DIR =
  process.env.VERCEL === "1"
    ? path.join("/tmp", "rsk-protocol-mvp")
    : path.join(process.cwd(), "data");

export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const DB_PATH = path.join(DATA_DIR, "rsk.sqlite");
export const TEMPLATE_PATH = path.join(
  process.cwd(),
  "public",
  "templates",
  "protocol-template.docx",
);
