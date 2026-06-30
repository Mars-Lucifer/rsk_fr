"use client";

export const MAYAK_ADMIN_SECTIONS = [
    {
        id: "content",
        title: "Контент",
        description: "Диапазоны, задачи, файлы и общие настройки контента МАЯК.",
        href: "/admin/mayak-content",
    },
    {
        id: "services",
        title: "Сервисы",
        description: "Списки сервисов для типов контента и подразделов блока «Разное».",
        href: "/admin/mayak-services",
    },
    {
        id: "tokens",
        title: "Токены",
        description: "Обычные токены, сессионные токены и внешние ссылки для организаторов в одном разделе.",
        href: "/admin/mayak-tokens",
    },
    {
        id: "token-materials",
        title: "Материалы для токенов",
        description: "PDF и PPTX файлы, которые будут доступны для скачивания во внешних ссылках токенов.",
        href: "/admin/mayak-token-materials",
    },
    {
        id: "ai-tokens",
        title: "AI токены",
        description: "Ключ OpenRouter и промпты для СОВА и итоговой аналитики.",
        href: "/admin/mayak-ai-tokens",
    },
    {
        id: "case-photos",
        title: "Фотки",
        description: "Фото для 4 направлений блока кейсов на странице тренажёра МАЯК.",
        href: "/admin/mayak-case-photos",
    },
    {
        id: "onboarding",
        title: "Онбординг",
        description: "Ссылки, прогресс, конструктор и анонимная анкета подготовки.",
        href: "/admin/mayak-onboarding",
    },
    {
        id: "secret-missions",
        title: "Тайные миссии",
        description: "Пул секретных заданий по ролям для сессионного режима тренажёра.",
        href: "/admin/mayak-secret-missions",
    },
    {
        id: "service-templates",
        title: "Шаблоны инструкций",
        description: "PPTX-шаблоны инструкций по сервисам и форматам для автогенерации инструкций заданий.",
        href: "/admin/mayak-service-templates",
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
