import fs from "fs";
import path from "path";
import crypto from "crypto";

const MAYAK_SESSION_FILES_DIR = path.join(process.cwd(), "data", "mayak-session-files");

function sanitizeSegment(value) {
    return String(value || "")
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getExtension(filename) {
    const ext = path.extname(String(filename || "")).toLowerCase();
    return ext || "";
}

export function getMayakSessionFilesRoot() {
    ensureDir(MAYAK_SESSION_FILES_DIR);
    return MAYAK_SESSION_FILES_DIR;
}

export function getMayakSessionTaskDir({ sessionId, userId, taskKey }) {
    const root = getMayakSessionFilesRoot();
    return path.join(root, sanitizeSegment(sessionId), sanitizeSegment(userId), sanitizeSegment(taskKey));
}

export function saveMayakSessionAttachment({ sessionId, userId, taskKey, sourcePath, originalFilename, mimetype, size }) {
    const taskDir = getMayakSessionTaskDir({ sessionId, userId, taskKey });
    ensureDir(taskDir);

    const safeBaseName = sanitizeSegment(path.basename(String(originalFilename || "file"), path.extname(String(originalFilename || "")))) || "file";
    const extension = getExtension(originalFilename) || getExtension(mimetype) || "";
    const attachmentId = crypto.randomUUID();
    const storedFilename = `${attachmentId}_${safeBaseName}${extension}`;
    const targetPath = path.join(taskDir, storedFilename);

    fs.copyFileSync(sourcePath, targetPath);

    return {
        id: attachmentId,
        originalFilename: path.basename(String(originalFilename || storedFilename)),
        storedFilename,
        mimetype: String(mimetype || "application/octet-stream"),
        size: Number(size) || 0,
        extension: extension || "",
        relativePath: path.relative(getMayakSessionFilesRoot(), targetPath).replace(/\\/g, "/"),
        uploadedAt: new Date().toISOString(),
    };
}

export function getMayakSessionAttachmentPath(relativePath) {
    const root = getMayakSessionFilesRoot();
    const resolved = path.resolve(root, String(relativePath || ""));
    if (!resolved.startsWith(path.resolve(root))) {
        throw new Error("Invalid attachment path");
    }
    return resolved;
}

export function deleteMayakSessionTaskFiles({ sessionId, userId, taskKey }) {
    const taskDir = getMayakSessionTaskDir({ sessionId, userId, taskKey });
    if (fs.existsSync(taskDir)) {
        fs.rmSync(taskDir, { recursive: true, force: true });
    }
}

export function deleteMayakSessionFiles(sessionId) {
    const sessionDir = path.join(getMayakSessionFilesRoot(), sanitizeSegment(sessionId));
    if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
    }
}
