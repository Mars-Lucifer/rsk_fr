"use client";

export const MAYAK_ADMIN_SECTIONS = [
    {
        id: "content",
        title: "Контент",
        description: "Диапазоны, задачи, файлы и общие настройки контента МАЯК.",
        href: "/admin/mayak-content",
    },
    {
        id: "tokens",
        title: "Токены",
        description: "Обычные и специальные токены, заявки и настройки выдачи доступа.",
        href: "/admin/mayak-tokens",
    },
    {
        id: "sessions",
        title: "Сессии",
        description: "Сессионные токены, состав участников, роли и управление сессиями.",
        href: "/admin/mayak-sessions",
    },
    {
        id: "admin-rights",
        title: "\u0410\u0434\u043c\u0438\u043d-\u043f\u0440\u0430\u0432\u0430",
        description:
            "\u0412\u044b\u0434\u0430\u0447\u0430 \u043f\u043e\u0434\u043f\u0440\u0430\u0432 \u043d\u0430 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0445 session-\u0442\u043e\u043a\u0435\u043d\u043e\u0432 \u0441 \u043f\u0440\u0438\u0432\u044f\u0437\u043a\u043e\u0439 \u043a \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u043d\u043e\u0439 \u043a\u043e\u043b\u043e\u0434\u0435 МАЯК.",
        href: "/admin/mayak-admin-rights",
    },
    {
        id: "onboarding",
        title: "Онбординг",
        description: "Ссылки, прогресс, конструктор и анонимная анкета подготовки.",
        href: "/admin/mayak-onboarding",
    },
];

const MAYAK_ADMIN_AUTH_URL = "/api/admin/mayak-auth";

async function parseAuthResponse(response) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "Не удалось выполнить запрос авторизации МАЯК.");
    }
    return payload;
}

export async function getMayakAdminAuthStatus() {
    const payload = await parseAuthResponse(await fetch(MAYAK_ADMIN_AUTH_URL));
    return { authenticated: Boolean(payload?.authenticated) };
}

export async function loginMayakAdmin(password) {
    await parseAuthResponse(
        await fetch(MAYAK_ADMIN_AUTH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        })
    );
}

export async function logoutMayakAdmin() {
    await parseAuthResponse(
        await fetch(MAYAK_ADMIN_AUTH_URL, {
            method: "DELETE",
        })
    );
}

export function buildMayakAdminLoginUrl(nextPath = "") {
    const normalizedNext = typeof nextPath === "string" ? nextPath.trim() : "";
    if (!normalizedNext || normalizedNext === "/admin") {
        return "/admin";
    }
    return `/admin?next=${encodeURIComponent(normalizedNext)}`;
}
