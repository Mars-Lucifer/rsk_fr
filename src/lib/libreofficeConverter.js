import { promises as fs } from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Рабочую папку держим в системном temp (ASCII, обычно без пробелов): LibreOffice
// крашится, если в пути к UserInstallation-профилю есть пробелы/не-ASCII (напр. «Disk D»).
const LIBREOFFICE_WORK_ROOT = path.join(os.tmpdir(), "mayak-libreoffice");
const LIBREOFFICE_LOG_FILE = path.join(process.cwd(), "data", "mayak-libreoffice.log");

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

export function logLibreOffice(step, payload = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        step,
        ...payload,
    };
    console.log(`[MAYAK][LibreOffice][${step}]`, entry);
    fs.mkdir(path.dirname(LIBREOFFICE_LOG_FILE), { recursive: true })
        .then(() => fs.appendFile(LIBREOFFICE_LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8"))
        .catch(() => {});
}

async function canAccessExecutable(candidate) {
    if (!candidate) return false;

    const isPathCandidate = candidate.includes("\\") || candidate.includes("/") || candidate.endsWith(".exe");
    if (isPathCandidate) {
        try {
            await fs.access(candidate);
            return true;
        } catch {
            return false;
        }
    }

    try {
        if (process.platform === "win32") {
            await execFileAsync("where.exe", [candidate], { windowsHide: true, timeout: 5000 });
        } else {
            await execFileAsync("which", [candidate], { timeout: 5000 });
        }
        return true;
    } catch {
        return false;
    }
}

export async function resolveLibreOfficeCommand() {
    const envCandidate = normalizeString(process.env.MAYAK_LIBREOFFICE_PATH);
    if (envCandidate && (await canAccessExecutable(envCandidate))) {
        logLibreOffice("resolve-command", { source: "env", command: envCandidate });
        return envCandidate;
    }

    const candidates = [
        "soffice",
        "libreoffice",
        "C:/Program Files/LibreOffice/program/soffice.exe",
        "C:/Program Files (x86)/LibreOffice/program/soffice.exe",
    ];

    for (const candidate of candidates) {
        if (await canAccessExecutable(candidate)) {
            logLibreOffice("resolve-command", { source: "fallback", command: candidate });
            return candidate;
        }
    }

    logLibreOffice("resolve-command-missed", {});
    return null;
}

/**
 * Конвертирует файл через LibreOffice headless в указанный формат.
 * Возвращает путь к итоговому файлу в targetDir (имя = basename(sourcePath) + outExt).
 *
 * @param {string} sourcePath абсолютный путь к исходному файлу
 * @param {string} targetDir каталог, куда положить результат
 * @param {{ filter: string, outExt: string, timeout?: number }} options
 */
async function runLibreOfficeConvert(sourcePath, targetDir, { filter, outExt, timeout = 45000 }) {
    const command = await resolveLibreOfficeCommand();
    if (!command) {
        throw new Error(
            "На сервере не найден LibreOffice/soffice. Установите LibreOffice или задайте путь через MAYAK_LIBREOFFICE_PATH."
        );
    }

    const conversionId = crypto.randomUUID();
    const sourceExt = path.extname(sourcePath).toLowerCase();
    const workDir = path.join(LIBREOFFICE_WORK_ROOT, conversionId);
    const tempDir = path.join(workDir, "temp");
    const profileDir = path.join(workDir, "profile");
    const inputDir = path.join(workDir, "input");
    const outputDir = path.join(workDir, "output");
    const stagedInputPath = path.join(inputDir, "input" + sourceExt);
    const stagedOutputPath = path.join(outputDir, "input" + outExt);
    // encodeURI кодирует пробелы (%20) и прочие небезопасные символы в пути профиля.
    const profileUri = "file:///" + encodeURI(profileDir.replace(/\\/g, "/"));

    try {
        await fs.mkdir(tempDir, { recursive: true });
        await fs.mkdir(profileDir, { recursive: true });
        await fs.mkdir(inputDir, { recursive: true });
        await fs.mkdir(outputDir, { recursive: true });
        await fs.mkdir(targetDir, { recursive: true });
        await fs.copyFile(sourcePath, stagedInputPath);

        const args = [
            "--headless",
            "--nologo",
            "--nodefault",
            "--norestore",
            "--nolockcheck",
            "-env:UserInstallation=" + profileUri,
            "--convert-to",
            filter,
            "--outdir",
            outputDir,
            stagedInputPath,
        ];

        logLibreOffice("convert-start", {
            conversionId,
            command,
            filter,
            sourcePath,
            stagedInputPath,
            targetDir,
        });

        const result = await execFileAsync(command, args, {
            windowsHide: true,
            timeout,
            maxBuffer: 10 * 1024 * 1024,
            env: {
                ...process.env,
                TEMP: tempDir,
                TMP: tempDir,
            },
        });

        await fs.access(stagedOutputPath);
        const expectedPath = path.join(targetDir, path.parse(sourcePath).name + outExt);
        await fs.copyFile(stagedOutputPath, expectedPath);

        logLibreOffice("convert-success", {
            conversionId,
            filter,
            sourcePath,
            expectedPath,
            stdout: String(result?.stdout || "").trim(),
            stderr: String(result?.stderr || "").trim(),
        });

        return expectedPath;
    } catch (lastError) {
        logLibreOffice("convert-failed", {
            conversionId,
            command,
            filter,
            sourcePath,
            targetDir,
            code: lastError?.code || null,
            signal: lastError?.signal || null,
            killed: Boolean(lastError?.killed),
            stdout: String(lastError?.stdout || "").trim(),
            stderr: String(lastError?.stderr || "").trim(),
            message: lastError?.message || "Unknown LibreOffice error",
        });
        if (lastError?.code === "ENOENT") {
            throw new Error(
                "На сервере не установлен LibreOffice. Для Word и PowerPoint файлов пока загрузите PDF или установите LibreOffice."
            );
        }
        if (lastError?.killed || lastError?.signal === "SIGTERM") {
            throw new Error(
                "Конвертация файла заняла слишком много времени. Попробуйте PDF или файл меньшего размера."
            );
        }
        throw new Error("Не удалось конвертировать файл через LibreOffice.");
    } finally {
        await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
}

/**
 * Конвертирует doc/docx/ppt/pptx в PDF. Возвращает путь к PDF в targetDir.
 */
export async function convertToPdf(sourcePath, targetDir) {
    return runLibreOfficeConvert(sourcePath, targetDir, { filter: "pdf", outExt: ".pdf" });
}

/**
 * Растеризует первую страницу PDF (или любого поддерживаемого файла) в PNG.
 * Возвращает путь к PNG в targetDir.
 */
export async function convertPdfToPng(sourcePath, targetDir) {
    return runLibreOfficeConvert(sourcePath, targetDir, { filter: "png", outExt: ".png" });
}
