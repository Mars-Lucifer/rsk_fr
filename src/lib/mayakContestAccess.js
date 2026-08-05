// Конкурсный доступ в тренажёр.
//
// Четвёртый тип входа рядом с legacy-токенами, сессиями и байпасом. Отличие:
// ключ никому не выдаётся и ничего не расходует — право на вход даёт
// авторизация участника на портале. Ключ вида `contest-3` лишь говорит, к
// какому уроку относится заход, и не является секретом.
//
// Существующие типы входа не затрагиваются: ветка срабатывает только на
// префикс `contest-`. См. docs/contest-core.md, §1.4.

import { getContestTrainerTask } from "@/lib/contestTrainerTasks";

export const CONTEST_TOKEN_PREFIX = "contest-";

export function parseContestToken(token) {
    const normalized = String(token || "").trim().toLowerCase();
    if (!normalized.startsWith(CONTEST_TOKEN_PREFIX)) {
        return null;
    }

    const lessonNumber = Number(normalized.slice(CONTEST_TOKEN_PREFIX.length));
    if (!Number.isInteger(lessonNumber) || lessonNumber <= 0) {
        return null;
    }

    return { lessonNumber };
}

export function buildContestToken(lessonNumber) {
    return `${CONTEST_TOKEN_PREFIX}${Number(lessonNumber)}`;
}

// Право на конкурсный вход = действующая сессия портала. Куку ставит бэкенд
// при логине, подделать её на клиенте нельзя (httpOnly + подпись JWT).
export function hasPortalSession(req) {
    return Boolean(req?.cookies?.users_access_token);
}

export function buildContestAccessContext(lessonNumber) {
    const trainerTask = getContestTrainerTask(lessonNumber);
    if (!trainerTask) {
        return null;
    }

    return {
        tokenType: "contest",
        lessonNumber,
        sectionId: trainerTask.sectionId,
        taskRange: trainerTask.taskRange,
        // Конкурс — одиночное прохождение: ни сессии, ни столов, ни инспектора.
        // Поэтому эти заходы не попадают в сессионный дашборд.
        sessionId: null,
        sessionName: "",
        tableCount: 0,
    };
}

export function buildContestValidationResponse(lessonNumber) {
    const context = buildContestAccessContext(lessonNumber);
    if (!context) {
        return {
            success: false,
            valid: false,
            error: "Задание к этому уроку не настроено",
        };
    }

    return {
        success: true,
        valid: true,
        error: null,
        // Ограничения по числу входов у конкурса нет: участник возвращается
        // к заданию столько раз, сколько нужно.
        remainingAttempts: 1,
        usageLimit: 1,
        usedCount: 0,
        taskRange: context.taskRange,
        sectionId: context.sectionId,
        isExhausted: false,
        isActive: true,
        isBypass: false,
        tokenType: "contest",
        sessionId: null,
        sessionName: null,
        tableCount: 0,
        lessonNumber,
    };
}
