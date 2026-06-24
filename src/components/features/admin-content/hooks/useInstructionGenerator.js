import { useState, useEffect, useCallback, useMemo } from "react";
import { classifyTask } from "@/lib/mayakProgressModel";

// Автогенерация PDF-инструкций из шаблонов сервисов: реестр шаблонов, выбор
// сервиса/формата для задания, генерация по строке и для всей колоды, а также
// проверка «сервис вне каталога» для баннера.
export const useInstructionGenerator = ({
    range, tasksRef, tasks, existingMaps,
    setTasks, setExistingInstructions, setSaveMsg, isDirtyRef,
}) => {
    const [serviceTemplates, setServiceTemplates] = useState([]);
    const [genBusyRow, setGenBusyRow] = useState(null);
    const [genAllBusy, setGenAllBusy] = useState(false);
    const [genProgress, setGenProgress] = useState(null); // { done, total }

    // Реестр шаблонов инструкций (сервис → форматы) для автогенерации
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/admin/mayak-service-templates");
                const json = await res.json();
                if (!cancelled && Array.isArray(json?.data?.services)) setServiceTemplates(json.data.services);
            } catch { /* нет шаблонов — кнопка будет неактивна */ }
        })();
        return () => { cancelled = true; };
    }, []);

    // Сервис задания и его форматы из реестра шаблонов.
    // Сервис ищем в колонке «Сервисы», затем в «Инструмент 1/2» (toolName1/2),
    // где в текущих колодах обычно и указан сервис (например, Suno).
    // Возвращает:
    //   candidates    — все названия сервисов, упомянутые в задании;
    //   matchedServices — сервисы из реестра, у которых ЕСТЬ шаблон (форматы), без дублей;
    //   service/formats — выбранный сервис (по instructionService) или первый с шаблоном;
    //   svcName        — отображаемое имя выбранного/первого кандидата.
    const getTaskTemplate = useCallback((task) => {
        const candidates = [];
        String(task?.services || "")
            .split(/[,;\n]/)
            .forEach((s) => { const v = s.trim(); if (v) candidates.push(v); });
        [task?.toolName1, task?.toolName2].forEach((s) => { const v = String(s || "").trim(); if (v) candidates.push(v); });

        const matchedServices = [];
        let serviceNoFmt = null;
        for (const name of candidates) {
            const needle = name.toLowerCase();
            const service = serviceTemplates.find((s) => s.serviceName.toLowerCase() === needle || s.serviceKey === needle);
            if (!service) continue;
            if (service.formats.length) {
                if (!matchedServices.some((s) => s.serviceKey === service.serviceKey)) matchedServices.push(service);
            } else if (!serviceNoFmt) {
                serviceNoFmt = service;
            }
        }

        // Ручной выбор сервиса (если в задании несколько с шаблонами).
        const chosenKey = String(task?.instructionService || "").trim();
        let service = null;
        if (matchedServices.length) {
            service = (chosenKey && matchedServices.find((s) => s.serviceKey === chosenKey)) || matchedServices[0];
        }

        if (service) return { svcName: service.serviceName, service, formats: service.formats, matchedServices };
        if (serviceNoFmt) return { svcName: serviceNoFmt.serviceName, service: serviceNoFmt, formats: [], matchedServices };
        return { svcName: candidates[0] || "", service: null, formats: [], matchedServices };
    }, [serviceTemplates]);

    const handleServiceChange = useCallback((rowIdx, serviceKey) => {
        // Смена сервиса сбрасывает выбранный формат (форматы у сервисов разные).
        setTasks((prev) => prev.map((t, i) => (i === rowIdx ? { ...t, instructionService: serviceKey, instructionFormat: "" } : t)));
        isDirtyRef.current = true;
    }, [setTasks, isDirtyRef]);

    // Автогенерация инструкций возможна только для 6 контентных форматов «Я»
    // (Текст, Аудио, Изображение/Статика, Интерактив, Видео/Динамика, Данные).
    // Старт, карты настроения и направления «Мы» (Знания и навыки и т.п.) — исключаются.
    const isGeneratableContent = useCallback((contentType) => classifyTask(contentType).kind === "ya-format", []);

    const taskHasMap = useCallback((task) => {
        const explicit = String(task?.map || "").trim();
        if (explicit && existingMaps.includes(explicit)) return true;
        const num = String(task?.number || "").trim();
        return !!num && existingMaps.some((f) => f.replace(/\.[^.]+$/, "") === num);
    }, [existingMaps]);

    const handleFormatChange = useCallback((rowIdx, formatKey) => {
        setTasks((prev) => prev.map((t, i) => (i === rowIdx ? { ...t, instructionFormat: formatKey } : t)));
        isDirtyRef.current = true;
    }, [setTasks, isDirtyRef]);

    const generateInstructionFor = useCallback(async (task) => {
        const res = await fetch("/api/admin/mayak-content/generate-instruction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ range, number: task.number, formatKey: task.instructionFormat || "", serviceKey: task.instructionService || "" }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.success === false) {
            throw new Error(json?.error || "Не удалось сгенерировать инструкцию");
        }
        return json.data;
    }, [range]);

    const applyGeneratedInstruction = useCallback((data) => {
        setTasks((prev) => prev.map((t) => (String(t.number) === String(data.number)
            ? { ...t, instruction: data.instruction, instructionText: data.instructionText || t.instructionText, hasInstruction: true, instructionFormat: data.formatKey || t.instructionFormat || "", instructionService: data.serviceKey || t.instructionService || "" }
            : t)));
        setExistingInstructions((prev) => (prev.includes(data.instruction) ? prev : [...prev, data.instruction]));
    }, [setTasks, setExistingInstructions]);

    const handleGenerateInstruction = useCallback(async (rowIdx) => {
        const task = tasksRef.current[rowIdx];
        if (!task) return;
        setGenBusyRow(rowIdx);
        setSaveMsg(null);
        try {
            const data = await generateInstructionFor(task);
            applyGeneratedInstruction(data);
            setSaveMsg({ type: "success", text: `Инструкция для задания ${data.number} обновлена (${data.serviceName} · ${data.formatName})` });
        } catch (err) {
            setSaveMsg({ type: "error", text: `Задание ${task.number}: ${err.message}` });
        } finally {
            setGenBusyRow(null);
        }
    }, [tasksRef, generateInstructionFor, applyGeneratedInstruction, setSaveMsg]);

    const handleGenerateAll = useCallback(async () => {
        // Только контентные форматы «Я», у которых есть шаблон сервиса и загруженная карта.
        const targets = tasksRef.current.filter((t) => {
            if (!isGeneratableContent(t.contentType)) return false;
            const { formats } = getTaskTemplate(t);
            return formats.length > 0 && taskHasMap(t);
        });
        if (targets.length === 0) {
            setSaveMsg({ type: "error", text: "Нет подходящих заданий: нужен контентный тип (Текст/Аудио/Изображение/Интерактив/Видео/Данные) + шаблон сервиса + карта" });
            return;
        }
        setGenAllBusy(true);
        setGenProgress({ done: 0, total: targets.length });
        setSaveMsg({ type: "success", text: `Генерация 0/${targets.length}...` });
        let ok = 0;
        const errors = [];
        for (let i = 0; i < targets.length; i++) {
            const task = targets[i];
            try {
                const data = await generateInstructionFor(task);
                applyGeneratedInstruction(data);
                ok += 1;
            } catch (err) {
                errors.push(`№${task.number}: ${err.message}`);
            }
            setGenProgress({ done: i + 1, total: targets.length });
            setSaveMsg({ type: "success", text: `Генерация ${i + 1}/${targets.length}... (готово ${ok}, ошибок ${errors.length})` });
        }
        setGenAllBusy(false);
        setGenProgress(null);
        setSaveMsg({
            type: errors.length ? "error" : "success",
            text: `Готово: ${ok}/${targets.length} инструкций обновлено${errors.length ? `. Ошибки: ${errors.slice(0, 5).join("; ")}` : ""}`,
        });
    }, [tasksRef, getTaskTemplate, isGeneratableContent, taskHasMap, generateInstructionFor, applyGeneratedInstruction, setSaveMsg]);

    // Проверка сервисов: для контентных заданий сервис (из «Сервисы»/«Инструмент»)
    // должен присутствовать в каталоге «Шаблоны инструкций». Иначе — проблема с подсказкой.
    const serviceIssues = useMemo(() => {
        if (!serviceTemplates.length) return [];
        const known = new Set();
        serviceTemplates.forEach((s) => { known.add(s.serviceName.toLowerCase()); known.add(s.serviceKey); });
        const issues = [];
        for (const t of tasks) {
            if (classifyTask(t.contentType).kind !== "ya-format") continue;
            const candidates = [];
            String(t.services || "").split(/[,;\n]/).forEach((s) => { const v = s.trim(); if (v) candidates.push(v); });
            [t.toolName1, t.toolName2].forEach((s) => { const v = String(s || "").trim(); if (v) candidates.push(v); });
            if (candidates.length === 0) {
                issues.push({ number: t.number, kind: "no-service" });
                continue;
            }
            if (candidates.some((c) => known.has(c.toLowerCase()))) continue;
            // Подсказка: сервис из каталога, чьё имя похоже (вхождение подстроки).
            const first = candidates[0];
            const low = first.toLowerCase();
            const near = serviceTemplates.find((s) => {
                const n = s.serviceName.toLowerCase();
                return n.includes(low) || low.includes(n);
            });
            issues.push({ number: t.number, kind: "unknown", name: first, suggestion: near?.serviceName || "" });
        }
        return issues;
    }, [tasks, serviceTemplates]);

    return {
        genBusyRow, genAllBusy, genProgress,
        getTaskTemplate, handleServiceChange, handleFormatChange,
        isGeneratableContent, handleGenerateInstruction, handleGenerateAll,
        serviceIssues,
    };
};
