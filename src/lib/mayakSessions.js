import fs from "fs";
import path from "path";
import crypto from "crypto";

import { deleteMayakSessionFiles } from "@/lib/mayakSessionFiles";

const MAYAK_SESSIONS_FILE = path.join(process.cwd(), "data", "mayakSessions.json");
const AUTO_APPROVE_MS = 2 * 60 * 1000;
const REJECTED_CORRECTION_MS = 3 * 60 * 1000;

function ensureSessionsFile() {
    const dir = path.dirname(MAYAK_SESSIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(MAYAK_SESSIONS_FILE)) {
        fs.writeFileSync(MAYAK_SESSIONS_FILE, JSON.stringify({ sessions: [] }, null, 2));
    }
}

function writeJsonAtomic(filePath, data) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, filePath);
}

function normalizeTableNumber(value) {
    return String(value || "").trim();
}

function buildDefaultAssignments(tables) {
    if (!Array.isArray(tables) || tables.length === 0) return [];
    if (tables.length === 1) return [{ inspectorTableNumber: tables[0], targetTableNumber: tables[0] }];
    return tables.map((tableNumber, index) => ({ inspectorTableNumber: tableNumber, targetTableNumber: tables[(index + 1) % tables.length] }));
}

function normalizeAssignments(assignments, tables) {
    const normalizedTables = Array.from(new Set((Array.isArray(tables) ? tables : []).map(normalizeTableNumber).filter(Boolean)));
    const sourceAssignments = Array.isArray(assignments) && assignments.length > 0 ? assignments : buildDefaultAssignments(normalizedTables);
    const cleaned = [];

    for (const item of sourceAssignments) {
        const inspectorTableNumber = normalizeTableNumber(item?.inspectorTableNumber);
        const targetTableNumber = normalizeTableNumber(item?.targetTableNumber);
        if (!normalizedTables.includes(inspectorTableNumber) || !normalizedTables.includes(targetTableNumber)) continue;
        if (cleaned.some((entry) => entry.inspectorTableNumber === inspectorTableNumber)) continue;
        cleaned.push({ inspectorTableNumber, targetTableNumber });
    }

    for (const tableNumber of normalizedTables) {
        if (!cleaned.some((entry) => entry.inspectorTableNumber === tableNumber)) {
            cleaned.push({ inspectorTableNumber: tableNumber, targetTableNumber: normalizedTables[0] || tableNumber });
        }
    }

    return cleaned;
}

function createTaskKey({ sectionId, taskNumber }) {
    return `${sectionId || "global"}:${String(taskNumber || "").trim()}`;
}

function buildParticipantName(participant = {}) {
    const directName = String(participant.name || "").trim();
    if (directName) return directName;
    const userData = participant.userData || {};
    return [userData.lastName, userData.firstName].filter(Boolean).join(" ").trim() || "Участник";
}

function buildSessionSummary(session) {
    return {
        id: session.id,
        name: session.name,
        status: session.status,
        tokenId: session.tokenId,
        token: session.token,
        sectionId: session.sectionId || null,
        taskRange: session.taskRange || null,
        tables: session.tables || [],
        inspectorAssignments: session.inspectorAssignments || [],
        participantCount: Array.isArray(session.participants) ? session.participants.length : 0,
        completedAt: session.completedAt || null,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
    };
}

function buildAssignmentLabels(session) {
    return (session.inspectorAssignments || []).map((entry) => ({
        ...entry,
        label: `Инспектор ${entry.inspectorTableNumber} -> стол ${entry.targetTableNumber}`,
    }));
}

function sanitizeAttachments(attachments) {
    if (!Array.isArray(attachments)) return [];
    return attachments
        .filter(Boolean)
        .map((item) => ({
            id: String(item.id || "").trim(),
            originalFilename: String(item.originalFilename || "file").trim(),
            storedFilename: String(item.storedFilename || "").trim(),
            mimetype: String(item.mimetype || "application/octet-stream").trim(),
            size: Number(item.size) || 0,
            extension: String(item.extension || "").trim(),
            relativePath: String(item.relativePath || "").trim(),
            uploadedAt: item.uploadedAt || new Date().toISOString(),
        }))
        .filter((item) => item.id && item.relativePath);
}

export function readMayakSessionsStore() {
    try {
        ensureSessionsFile();
        const raw = JSON.parse(fs.readFileSync(MAYAK_SESSIONS_FILE, "utf-8"));
        return Array.isArray(raw?.sessions) ? raw : { sessions: [] };
    } catch (error) {
        console.error("Error reading MAYAK sessions:", error);
        return { sessions: [] };
    }
}

export function saveMayakSessionsStore(store) {
    writeJsonAtomic(MAYAK_SESSIONS_FILE, { sessions: Array.isArray(store?.sessions) ? store.sessions : [] });
}

export function getAllMayakSessions() {
    return readMayakSessionsStore().sessions || [];
}

export function getMayakSessionById(sessionId) {
    return getAllMayakSessions().find((session) => session.id === sessionId) || null;
}

export function getMayakSessionByToken(tokenValue) {
    return getAllMayakSessions().find((session) => session.token === tokenValue) || null;
}

export function createMayakSession({ name, tokenId, token, sectionId = null, taskRange = null, tables = [], inspectorAssignments = [] }) {
    const store = readMayakSessionsStore();
    const normalizedTables = Array.from(new Set((tables || []).map(normalizeTableNumber).filter(Boolean)));
    const now = new Date().toISOString();

    if (!name || !String(name).trim()) throw new Error("Название сессии обязательно");
    if (!tokenId || !token) throw new Error("Для сессии требуется связанный токен");
    if (normalizedTables.length === 0) throw new Error("Укажите хотя бы один стол");
    if (store.sessions.some((session) => session.tokenId === tokenId || session.token === token)) throw new Error("Для этого токена уже создана сессия");

    const session = {
        id: crypto.randomUUID(),
        name: String(name).trim(),
        status: "active",
        completedAt: null,
        tokenId,
        token,
        sectionId: sectionId || null,
        taskRange: taskRange || null,
        tables: normalizedTables,
        inspectorAssignments: normalizeAssignments(inspectorAssignments, normalizedTables),
        participants: [],
        taskStates: {},
        createdAt: now,
        updatedAt: now,
    };

    store.sessions.push(session);
    saveMayakSessionsStore(store);
    return session;
}

function updateSessionInStore(sessionId, updater) {
    const store = readMayakSessionsStore();
    const index = store.sessions.findIndex((session) => session.id === sessionId);
    if (index === -1) return null;
    const current = store.sessions[index];
    const next = updater(current);
    if (!next) return null;
    next.updatedAt = new Date().toISOString();
    if (next.status === "completed" && !next.completedAt) next.completedAt = new Date().toISOString();
    if (next.status !== "completed") next.completedAt = null;
    store.sessions[index] = next;
    saveMayakSessionsStore(store);
    return next;
}

export function updateMayakSession(sessionId, updates = {}) {
    const sessionBefore = getMayakSessionById(sessionId);
    const updated = updateSessionInStore(sessionId, (session) => {
        const nextTables = updates.tables ? Array.from(new Set(updates.tables.map(normalizeTableNumber).filter(Boolean))) : session.tables || [];
        return {
            ...session,
            ...updates,
            tables: nextTables,
            inspectorAssignments: normalizeAssignments(updates.inspectorAssignments || session.inspectorAssignments || [], nextTables),
        };
    });

    if (sessionBefore?.status !== "completed" && updated?.status === "completed") {
        deleteMayakSessionFiles(sessionId);
    }

    return updated;
}

function getParticipantByUserId(session, userId) {
    return (session.participants || []).find((participant) => participant.userId === userId) || null;
}

function ensureTaskStateBucket(session, userId) {
    if (!session.taskStates) session.taskStates = {};
    if (!session.taskStates[userId]) session.taskStates[userId] = {};
    return session.taskStates[userId];
}

function getInspectorAssignmentForTargetTable(session, tableNumber) {
    return (session.inspectorAssignments || []).find((entry) => entry.targetTableNumber === normalizeTableNumber(tableNumber)) || null;
}

function getTargetAssignmentForInspectorTable(session, tableNumber) {
    return (session.inspectorAssignments || []).find((entry) => entry.inspectorTableNumber === normalizeTableNumber(tableNumber)) || null;
}

function canMutateSession(session) {
    return session.status !== "completed";
}

function getTaskStateByKey(session, userId, taskKey) {
    return session?.taskStates?.[userId]?.[taskKey] || null;
}

function findTaskStateOwner(session, taskKey) {
    for (const [userId, taskBucket] of Object.entries(session.taskStates || {})) {
        if (taskBucket?.[taskKey]) {
            return { userId, taskState: taskBucket[taskKey] };
        }
    }
    return null;
}

export function registerMayakSessionParticipant({ token, userId, userData }) {
    const session = getMayakSessionByToken(token);
    if (!session) throw new Error("Сессия по токену не найдена");
    if (!canMutateSession(session)) throw new Error("Сессия уже завершена");

    const tableNumber = normalizeTableNumber(userData?.tableNumber);
    if (!tableNumber) throw new Error("Номер стола обязателен");
    if (!(session.tables || []).includes(tableNumber)) throw new Error("Указанный стол не входит в сессию");

    const updatedSession = updateSessionInStore(session.id, (draft) => {
        const existingIndex = (draft.participants || []).findIndex((participant) => participant.userId === userId);
        const participantRecord = {
            userId,
            name: [userData?.lastName, userData?.firstName].filter(Boolean).join(" ").trim() || "Участник",
            userData: {
                lastName: userData?.lastName || "",
                firstName: userData?.firstName || "",
                college: userData?.college || "",
                tableNumber,
            },
            tableNumber,
            role: existingIndex >= 0 ? draft.participants[existingIndex].role || null : null,
            createdAt: existingIndex >= 0 ? draft.participants[existingIndex].createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        if (!Array.isArray(draft.participants)) draft.participants = [];
        if (existingIndex >= 0) draft.participants[existingIndex] = participantRecord;
        else draft.participants.push(participantRecord);
        return draft;
    });

    return { session: updatedSession, participant: getParticipantByUserId(updatedSession, userId) };
}

export function assignMayakParticipantRole({ token, userId, role }) {
    const session = getMayakSessionByToken(token);
    if (!session) throw new Error("Сессия по токену не найдена");
    if (!canMutateSession(session)) throw new Error("Сессия уже завершена");

    const normalizedRole = String(role || "").trim();
    if (!normalizedRole) throw new Error("Роль обязательна");

    const updatedSession = updateSessionInStore(session.id, (draft) => {
        const participant = getParticipantByUserId(draft, userId);
        if (!participant) throw new Error("Участник сессии не найден");
        if (normalizedRole === "ИНСПЕКТОР" && (draft.participants || []).some((entry) => entry.userId !== userId && entry.tableNumber === participant.tableNumber && entry.role === "ИНСПЕКТОР")) {
            throw new Error(`У стола ${participant.tableNumber} уже назначен инспектор`);
        }
        participant.role = normalizedRole;
        participant.updatedAt = new Date().toISOString();
        return draft;
    });

    return { session: updatedSession, participant: getParticipantByUserId(updatedSession, userId) };
}

export function markMayakTaskStarted({ token, userId, taskNumber, taskName, sectionId = null }) {
    const session = getMayakSessionByToken(token);
    if (!session || !canMutateSession(session)) return null;

    return updateSessionInStore(session.id, (draft) => {
        const participant = getParticipantByUserId(draft, userId);
        if (!participant) throw new Error("Участник сессии не найден");
        const taskKey = createTaskKey({ sectionId, taskNumber });
        const bucket = ensureTaskStateBucket(draft, userId);
        const assignment = getInspectorAssignmentForTargetTable(draft, participant.tableNumber);
        bucket[taskKey] = {
            ...(bucket[taskKey] || {}),
            taskKey,
            taskNumber: String(taskNumber || "").trim(),
            taskName: taskName || `Задание ${taskNumber}`,
            sectionId: sectionId || null,
            tableNumber: participant.tableNumber,
            inspectorTableNumber: assignment?.inspectorTableNumber || null,
            status: "started",
            startedAt: new Date().toISOString(),
            submittedAt: null,
            decidedAt: null,
            rejectionReason: "",
            reviewedByUserId: null,
            reviewedByName: null,
            elapsedSeconds: null,
            correctionDeadlineAt: null,
            attachments: bucket[taskKey]?.attachments || [],
            updatedAt: new Date().toISOString(),
        };
        return draft;
    });
}

export function markMayakTaskSubmitted({ token, userId, taskNumber, taskName, sectionId = null, elapsedSeconds = 0, attachments = [] }) {
    const session = getMayakSessionByToken(token);
    if (!session || !canMutateSession(session)) return null;

    const sanitizedAttachments = sanitizeAttachments(attachments);
    if (sanitizedAttachments.length === 0) {
        throw new Error("Для завершения задания нужно прикрепить файл");
    }

    return updateSessionInStore(session.id, (draft) => {
        const participant = getParticipantByUserId(draft, userId);
        if (!participant) throw new Error("Участник сессии не найден");
        const taskKey = createTaskKey({ sectionId, taskNumber });
        const bucket = ensureTaskStateBucket(draft, userId);
        const assignment = getInspectorAssignmentForTargetTable(draft, participant.tableNumber);
        bucket[taskKey] = {
            ...(bucket[taskKey] || {}),
            taskKey,
            taskNumber: String(taskNumber || "").trim(),
            taskName: taskName || `Задание ${taskNumber}`,
            sectionId: sectionId || null,
            tableNumber: participant.tableNumber,
            inspectorTableNumber: assignment?.inspectorTableNumber || null,
            status: assignment?.inspectorTableNumber ? "pending_inspection" : "auto_approved",
            submittedAt: new Date().toISOString(),
            decidedAt: assignment?.inspectorTableNumber ? null : new Date().toISOString(),
            rejectionReason: "",
            reviewedByUserId: assignment?.inspectorTableNumber ? null : "system",
            reviewedByName: assignment?.inspectorTableNumber ? null : "Система",
            elapsedSeconds: Number.isFinite(Number(elapsedSeconds)) ? Number(elapsedSeconds) : 0,
            correctionDeadlineAt: null,
            attachments: sanitizedAttachments,
            updatedAt: new Date().toISOString(),
        };
        return draft;
    });
}

function applyAutoApprovalsToSession(session) {
    let changed = false;
    const now = Date.now();

    for (const taskBucket of Object.values(session.taskStates || {})) {
        for (const taskState of Object.values(taskBucket || {})) {
            if (taskState.status === "pending_inspection" && taskState.submittedAt) {
                const submittedAtMs = new Date(taskState.submittedAt).getTime();
                if (Number.isFinite(submittedAtMs) && now - submittedAtMs >= AUTO_APPROVE_MS) {
                    taskState.status = "auto_approved";
                    taskState.decidedAt = new Date().toISOString();
                    taskState.reviewedByUserId = "system";
                    taskState.reviewedByName = "Система";
                    taskState.rejectionReason = "";
                    taskState.updatedAt = new Date().toISOString();
                    changed = true;
                }
            }
        }
    }

    return changed;
}

export function applyMayakSessionAutoApprovals(sessionId) {
    const store = readMayakSessionsStore();
    const index = store.sessions.findIndex((session) => session.id === sessionId);
    if (index === -1) return null;
    const session = store.sessions[index];
    const changed = applyAutoApprovalsToSession(session);
    if (!changed) return session;
    session.updatedAt = new Date().toISOString();
    store.sessions[index] = session;
    saveMayakSessionsStore(store);
    return session;
}

export function reviewMayakTask({ token, inspectorUserId, taskKey, action, reason = "" }) {
    const session = getMayakSessionByToken(token);
    if (!session) throw new Error("Сессия по токену не найдена");
    if (!canMutateSession(session)) throw new Error("Сессия уже завершена");

    const freshSession = applyMayakSessionAutoApprovals(session.id) || session;

    return updateSessionInStore(freshSession.id, (draft) => {
        const inspector = getParticipantByUserId(draft, inspectorUserId);
        if (!inspector) throw new Error("Инспектор не найден в сессии");
        if (inspector.role !== "ИНСПЕКТОР") throw new Error("Только инспектор может проверять задания");

        const assignment = getTargetAssignmentForInspectorTable(draft, inspector.tableNumber);
        if (!assignment) throw new Error("Для инспектора не настроен закрепленный стол");

        const targetParticipants = (draft.participants || []).filter((participant) => participant.tableNumber === assignment.targetTableNumber);
        const targetUserIds = new Set(targetParticipants.map((participant) => participant.userId));
        let targetState = null;
        for (const [userId, taskBucket] of Object.entries(draft.taskStates || {})) {
            if (!targetUserIds.has(userId)) continue;
            if (taskBucket?.[taskKey]) {
                targetState = taskBucket[taskKey];
                break;
            }
        }

        if (!targetState) throw new Error("Задание для проверки не найдено");
        if (targetState.status !== "pending_inspection") throw new Error("Это задание уже обработано");
        if (action === "reject" && !String(reason || "").trim()) throw new Error("Для отклонения укажите причину");

        targetState.status = action === "approve" ? "approved" : "rejected";
        targetState.decidedAt = new Date().toISOString();
        targetState.reviewedByUserId = inspector.userId;
        targetState.reviewedByName = buildParticipantName(inspector);
        targetState.rejectionReason = action === "reject" ? String(reason || "").trim() : "";
        targetState.correctionDeadlineAt = action === "reject" ? new Date(Date.now() + REJECTED_CORRECTION_MS).toISOString() : null;
        targetState.updatedAt = new Date().toISOString();
        return draft;
    });
}

export function getMayakTaskReviewContext({ token, inspectorUserId, taskKey }) {
    const session = getMayakSessionByToken(token);
    if (!session) return null;

    const freshSession = applyMayakSessionAutoApprovals(session.id) || session;
    const inspector = getParticipantByUserId(freshSession, inspectorUserId);
    if (!inspector || inspector.role !== "ИНСПЕКТОР") {
        throw new Error("Доступно только инспектору");
    }

    const assignment = getTargetAssignmentForInspectorTable(freshSession, inspector.tableNumber);
    if (!assignment) {
        throw new Error("Для инспектора не настроен закрепленный стол");
    }

    const owner = findTaskStateOwner(freshSession, taskKey);
    if (!owner) throw new Error("Задание не найдено");

    const participant = getParticipantByUserId(freshSession, owner.userId);
    if (!participant || normalizeTableNumber(participant.tableNumber) !== normalizeTableNumber(assignment.targetTableNumber)) {
        throw new Error("Это задание не закреплено за данным инспектором");
    }

    return {
        session: buildSessionSummary(freshSession),
        participant: {
            userId: participant.userId,
            name: buildParticipantName(participant),
            tableNumber: participant.tableNumber,
            role: participant.role || null,
        },
        inspector: {
            userId: inspector.userId,
            name: buildParticipantName(inspector),
            tableNumber: inspector.tableNumber,
        },
        taskState: owner.taskState,
    };
}

export function getMayakParticipantTaskContext({ token, userId, taskKey }) {
    const session = getMayakSessionByToken(token);
    if (!session) return null;
    const freshSession = applyMayakSessionAutoApprovals(session.id) || session;
    const participant = getParticipantByUserId(freshSession, userId);
    if (!participant) return null;
    const taskState = getTaskStateByKey(freshSession, userId, taskKey);
    if (!taskState) return null;
    return { session: buildSessionSummary(freshSession), participant, taskState };
}

export function getMayakSessionSnapshot({ token, userId }) {
    const session = getMayakSessionByToken(token);
    if (!session) return null;

    const freshSession = applyMayakSessionAutoApprovals(session.id) || session;
    const participant = getParticipantByUserId(freshSession, userId);
    if (!participant) return { session: { ...buildSessionSummary(freshSession), inspectorAssignments: buildAssignmentLabels(freshSession) }, participant: null, taskStates: [], inspectorView: null };

    const taskStates = Object.values(freshSession.taskStates?.[userId] || {})
        .sort((a, b) => new Date(b.updatedAt || b.startedAt || 0).getTime() - new Date(a.updatedAt || a.startedAt || 0).getTime())
        .map((taskState) => ({ ...taskState, attachments: sanitizeAttachments(taskState.attachments) }));

    let inspectorView = null;
    if (participant.role === "ИНСПЕКТОР") {
        const assignment = getTargetAssignmentForInspectorTable(freshSession, participant.tableNumber);
        const targetParticipants = assignment ? (freshSession.participants || []).filter((entry) => entry.tableNumber === assignment.targetTableNumber) : [];
        const targetParticipantCards = targetParticipants.map((entry) => {
            const participantTaskStates = Object.values(freshSession.taskStates?.[entry.userId] || {})
                .sort((a, b) => new Date(b.updatedAt || b.startedAt || 0).getTime() - new Date(a.updatedAt || a.startedAt || 0).getTime())
                .map((taskState) => ({ ...taskState, attachments: sanitizeAttachments(taskState.attachments) }));
            return {
                userId: entry.userId,
                name: buildParticipantName(entry),
                role: entry.role || null,
                tableNumber: entry.tableNumber,
                latestTask: participantTaskStates[0] || null,
                taskStates: participantTaskStates,
            };
        });
        inspectorView = {
            inspectorTableNumber: participant.tableNumber,
            targetTableNumber: assignment?.targetTableNumber || null,
            participants: targetParticipantCards,
            pendingTasks: targetParticipantCards
                .flatMap((entry) => entry.taskStates.filter((taskState) => taskState.status === "pending_inspection").map((taskState) => ({ ...taskState, participantName: entry.name, participantUserId: entry.userId })))
                .sort((a, b) => new Date(b.submittedAt || b.updatedAt || 0).getTime() - new Date(a.submittedAt || a.updatedAt || 0).getTime()),
        };
    }

    return {
        session: { ...buildSessionSummary(freshSession), inspectorAssignments: buildAssignmentLabels(freshSession) },
        participant: {
            userId: participant.userId,
            name: buildParticipantName(participant),
            role: participant.role || null,
            tableNumber: participant.tableNumber,
            userData: participant.userData || {},
        },
        taskStates,
        inspectorView,
    };
}
