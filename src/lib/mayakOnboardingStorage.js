import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_MAYAK_ONBOARDING_CONFIG } from "./mayakOnboardingDefaults.js";

function normalizeConfiguredDir(value) {
    if (!value || typeof value !== "string") return "";
    return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function getDataDir() {
    return normalizeConfiguredDir(process.env.MAYAK_ONBOARDING_DATA_DIR) || path.join(process.cwd(), "data");
}

function getFilesRoot() {
    return path.join(getDataDir(), "mayak-onboarding-files");
}

function getConfigFile() {
    return path.join(getDataDir(), "mayak-onboarding-config.json");
}

function getLinksFile() {
    return path.join(getDataDir(), "mayak-onboarding-links.json");
}

function getSubmissionsFile() {
    return path.join(getDataDir(), "mayak-onboarding-submissions.json");
}

async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function writeJsonAtomic(filePath, value) {
    await ensureDir(path.dirname(filePath));
    const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
    await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf-8");
    await fs.rename(tempPath, filePath);
}

async function readJsonFile(filePath, fallbackValue) {
    try {
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data);
    } catch {
        return fallbackValue;
    }
}

export function sanitizeFilename(filename) {
    if (typeof filename !== "string") return "";
    const safeName = path.basename(filename.trim()).replace(/[^\w.\-() ]+/g, "-");
    return safeName === "." || safeName === ".." ? "" : safeName;
}

function sanitizeId(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) return "";
    return trimmed;
}

export async function ensureMayakOnboardingStorage() {
    const dataDir = getDataDir();
    const filesRoot = getFilesRoot();
    const configFile = getConfigFile();
    const linksFile = getLinksFile();
    const submissionsFile = getSubmissionsFile();

    await ensureDir(dataDir);
    await ensureDir(filesRoot);

    if (!(await pathExists(configFile))) {
        await writeJsonAtomic(configFile, DEFAULT_MAYAK_ONBOARDING_CONFIG);
    }
    if (!(await pathExists(linksFile))) {
        await writeJsonAtomic(linksFile, []);
    }
    if (!(await pathExists(submissionsFile))) {
        await writeJsonAtomic(submissionsFile, []);
    }
}

export async function readOnboardingConfig() {
    await ensureMayakOnboardingStorage();
    const config = await readJsonFile(getConfigFile(), DEFAULT_MAYAK_ONBOARDING_CONFIG);
    return config && typeof config === "object" ? config : DEFAULT_MAYAK_ONBOARDING_CONFIG;
}

export async function writeOnboardingConfig(config) {
    await ensureMayakOnboardingStorage();
    await writeJsonAtomic(getConfigFile(), config);
    return config;
}

export async function readOnboardingLinks() {
    await ensureMayakOnboardingStorage();
    const links = await readJsonFile(getLinksFile(), []);
    return Array.isArray(links) ? links : [];
}

export async function writeOnboardingLinks(links) {
    await ensureMayakOnboardingStorage();
    await writeJsonAtomic(getLinksFile(), Array.isArray(links) ? links : []);
    return links;
}

export async function readOnboardingSubmissions() {
    await ensureMayakOnboardingStorage();
    const submissions = await readJsonFile(getSubmissionsFile(), []);
    return Array.isArray(submissions) ? submissions : [];
}

export async function writeOnboardingSubmissions(submissions) {
    await ensureMayakOnboardingStorage();
    await writeJsonAtomic(getSubmissionsFile(), Array.isArray(submissions) ? submissions : []);
    return submissions;
}

function getScopeRoot(scope, parentId) {
    const safeScope = scope === "links" ? "links" : "submissions";
    const safeParentId = sanitizeId(parentId);
    if (!safeParentId) {
        throw new Error("Invalid parentId");
    }
    return path.join(getFilesRoot(), safeScope, safeParentId);
}

export async function writeOnboardingFile({ scope, parentId, folder = "", filename, buffer }) {
    const safeFilename = sanitizeFilename(filename);
    const safeFolder = sanitizeId(folder) || "";
    if (!safeFilename) {
        throw new Error("Invalid filename");
    }
    const baseDir = getScopeRoot(scope, parentId);
    const targetDir = safeFolder ? path.join(baseDir, safeFolder) : baseDir;
    await ensureDir(targetDir);
    const filePath = path.join(targetDir, safeFilename);
    await fs.writeFile(filePath, buffer);
    return {
        filePath,
        filename: safeFilename,
        folder: safeFolder,
        url: `/api/mayak/onboarding-file?scope=${encodeURIComponent(scope)}&parentId=${encodeURIComponent(parentId)}${safeFolder ? `&folder=${encodeURIComponent(safeFolder)}` : ""}&filename=${encodeURIComponent(safeFilename)}`,
    };
}

export async function getOnboardingFilePath({ scope, parentId, folder = "", filename }) {
    const safeFilename = sanitizeFilename(filename);
    const safeFolder = sanitizeId(folder) || "";
    if (!safeFilename) {
        throw new Error("Invalid filename");
    }
    const baseDir = getScopeRoot(scope, parentId);
    return path.join(safeFolder ? path.join(baseDir, safeFolder) : baseDir, safeFilename);
}

export async function removeOnboardingDir(scope, parentId) {
    const targetDir = getScopeRoot(scope, parentId);
    await fs.rm(targetDir, { recursive: true, force: true });
}
