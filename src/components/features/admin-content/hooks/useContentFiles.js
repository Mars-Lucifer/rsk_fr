import { useState, useCallback } from "react";
import { fileToBase64 } from "../utils/fileToBase64";

// Загрузка/замена/удаление файлов раздела (инструкции, доп.материалы, карты)
// и массовая загрузка по номеру задания. Все мутации состояния делаются через
// сеттеры из useContentData, чтобы UI и диск не разъезжались.
export const useContentFiles = ({
    range, tasksRef,
    setTasks, setExistingFiles, setExistingInstructions, setExistingMaps,
    setFileSizes, setSaveMsg, isDirtyRef,
}) => {
    const [bulkUploading, setBulkUploading] = useState(false);

    const setListForType = useCallback((type, updater) => {
        if (type === "files") setExistingFiles(updater);
        else if (type === "maps") setExistingMaps(updater);
        else setExistingInstructions(updater);
    }, [setExistingFiles, setExistingMaps, setExistingInstructions]);

    // --- Загрузка файла ---
    const handleUploadFile = useCallback(async (file, type, renamedFilename, oldFilename) => {
        const finalName = renamedFilename || file.name;
        try {
            const base64 = await fileToBase64(file);
            const res = await fetch("/api/admin/mayak-content/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ range, type, filename: finalName, data: base64 }),
            });
            // HTTP-ошибка не бросает исключение — проверяем явно, иначе UI
            // покажет ложный успех (файл «добавлен», а на диске его нет).
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || `сервер вернул ${res.status}`);
            }
            // Загрузка успешна — теперь безопасно удалить старый файл
            if (oldFilename && oldFilename !== finalName) {
                try {
                    await fetch("/api/admin/mayak-content/upload", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ range, type, filename: oldFilename }),
                    });
                } catch {}
                setListForType(type, (prev) => prev.filter((f) => f !== oldFilename));
                setFileSizes((prev) => { const copy = { ...prev }; delete copy[oldFilename]; return copy; });
            }
            setListForType(type, (prev) => prev.includes(finalName) ? prev : [...prev, finalName]);
            // Обновляем размер файла в state
            setFileSizes((prev) => ({ ...prev, [finalName]: file.size }));
        } catch (err) {
            console.error(err);
            setSaveMsg({ type: "error", text: `Не удалось загрузить файл «${finalName}»: ${err.message}` });
        }
    }, [range, setListForType, setFileSizes, setSaveMsg]);

    // --- Удаление файла ---
    const handleDeleteFile = useCallback(async (type, filename) => {
        try {
            const res = await fetch("/api/admin/mayak-content/upload", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ range, type, filename }),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || `сервер вернул ${res.status}`);
            }
        } catch (err) {
            console.error(err);
            // НЕ чистим state, если файл не удалён с диска — иначе UI и диск
            // разъезжаются (оператор думает, что файл удалён, а он остался).
            setSaveMsg({ type: "error", text: `Не удалось удалить файл «${filename}»: ${err.message}. Состояние не изменено.` });
            return;
        }

        // Файл реально удалён с диска — теперь безопасно убрать из state
        setListForType(type, (prev) => prev.filter((f) => f !== filename));

        // Очистить имя файла в задании (флаги вычисляются из текстовых полей автоматически)
        const field = type === "files" ? "file" : type === "maps" ? "map" : "instruction";
        setTasks((prev) => prev.map((t) => {
            if (t[field] === filename) {
                return { ...t, [field]: "" };
            }
            return t;
        }));
        isDirtyRef.current = true;
    }, [range, setListForType, setTasks, setSaveMsg, isDirtyRef]);

    // --- Массовая загрузка ---
    const handleBulkUpload = useCallback(async (files, type) => {
        setBulkUploading(true);
        let uploaded = 0;
        let matched = 0;
        const skipped = [];
        const failed = [];
        for (const file of files) {
            const stem = file.name.replace(/\.[^.]+$/, "");
            const taskIdx = tasksRef.current.findIndex((t) => String(t.number) === stem);
            if (taskIdx < 0) { skipped.push(file.name); continue; }
            try {
                const base64 = await fileToBase64(file);
                const res = await fetch("/api/admin/mayak-content/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ range, type, filename: file.name, data: base64 }),
                });
                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    throw new Error(payload.error || `сервер вернул ${res.status}`);
                }
                uploaded++;
                setListForType(type, (prev) => prev.includes(file.name) ? prev : [...prev, file.name]);
                setFileSizes((prev) => ({ ...prev, [file.name]: file.size }));
                const field = type === "files" ? "file" : type === "maps" ? "map" : "instruction";
                setTasks((prev) => {
                    const copy = [...prev];
                    copy[taskIdx] = { ...copy[taskIdx], [field]: file.name };
                    return copy;
                });
                matched++;
            } catch (err) {
                console.error(err);
                failed.push(file.name);
            }
        }
        setBulkUploading(false);
        if (matched > 0) isDirtyRef.current = true;
        let msg = `Загружено: ${uploaded}, привязано: ${matched}`;
        if (failed.length > 0) {
            msg += `. Ошибка загрузки: ${failed.join(", ")}`;
        }
        if (skipped.length > 0) {
            msg += `. Пропущено (нет задания с таким номером): ${skipped.join(", ")}`;
        }
        setSaveMsg({ type: (failed.length > 0 || skipped.length > 0) ? "error" : "success", text: msg });
    }, [range, tasksRef, setListForType, setFileSizes, setTasks, setSaveMsg, isDirtyRef]);

    return { bulkUploading, handleUploadFile, handleDeleteFile, handleBulkUpload };
};
