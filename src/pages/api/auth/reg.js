import { PORTAL_API_BASE } from "@/lib/portalApiBase";

function toSafeString(value, fallback = "") {
    if (value === undefined || value === null) {
        return fallback;
    }
    return String(value);
}

function parseBackendErrorPayload(rawText) {
    if (!rawText) {
        return {};
    }

    try {
        return JSON.parse(rawText);
    } catch {
        return { detail: rawText };
    }
}

function extractErrorMessage(payload, fallback = "Неизвестная ошибка") {
    if (typeof payload?.detail === "string" && payload.detail.trim()) {
        return payload.detail.trim();
    }
    if (typeof payload?.message === "string" && payload.message.trim()) {
        return payload.message.trim();
    }
    if (typeof payload?.error === "string" && payload.error.trim()) {
        return payload.error.trim();
    }
    return fallback;
}

export default async function RegHandler(req, res) {
    try {
        const firstName = toSafeString(req.body?.first_name || req.body?.name).trim();
        const lastName = toSafeString(req.body?.last_name).trim();
        const payload = {
            password: toSafeString(req.body?.password),
            email: toSafeString(req.body?.email).trim(),
            role: toSafeString(req.body?.role, "student"),
            name: toSafeString(req.body?.name || [firstName, lastName].filter(Boolean).join(" ")).trim(),
            first_name: firstName,
            last_name: lastName,
        };

        const response = await fetch(`${PORTAL_API_BASE}/auth/users_interaction/register/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            cache: "no-store",
        });

        const setCookie = response.headers.get("set-cookie");
        if (setCookie) {
            res.setHeader("Set-Cookie", setCookie);
        }

        const rawText = await response.text();
        const data = parseBackendErrorPayload(rawText);

        if (!response.ok) {
            const errorMessage = extractErrorMessage(data);
            const normalizedMessage = errorMessage.toLowerCase();

            switch (response.status) {
                case 422:
                    return res.status(422).json({
                        success: false,
                        error: errorMessage,
                        details: data,
                        errorCode: "VALIDATION_ERROR",
                    });
                case 400:
                    if (
                        data.error_code === "EMAIL_NOT_CONFIRMED" ||
                        normalizedMessage.includes("email not confirmed")
                    ) {
                        return res.status(400).json({
                            success: false,
                            error: "Вы не подтвердили почту. Проверьте письмо и перейдите по ссылке из него",
                            errorCode: "EMAIL_NOT_CONFIRMED",
                        });
                    }

                    if (
                        data.error_code === "USER_EXISTS" ||
                        normalizedMessage.includes("already exists") ||
                        normalizedMessage.includes("already registered")
                    ) {
                        return res.status(400).json({
                            success: false,
                            error: "Пользователь с такой почтой уже существует",
                            errorCode: "USER_EXISTS",
                        });
                    }

                    return res.status(400).json({
                        success: false,
                        error: errorMessage,
                        errorCode: "BAD_REQUEST",
                    });
                case 401:
                    return res.status(401).json({
                        success: false,
                        error: errorMessage || "Пользователь не найден",
                        errorCode: "UNAUTHORIZED",
                    });
                case 403:
                    return res.status(403).json({
                        success: false,
                        error: errorMessage || "Доступ запрещён",
                        errorCode: "FORBIDDEN",
                    });
                case 404:
                    return res.status(404).json({
                        success: false,
                        error: errorMessage || "Ресурс не найден",
                        errorCode: "NOT_FOUND",
                    });
                default:
                    return res.status(response.status).json({
                        success: false,
                        error: errorMessage,
                        details: data,
                        errorCode: response.status >= 500 ? "SERVER_ERROR" : "UNKNOWN_ERROR",
                    });
            }
        }

        return res.json({ success: true, data });
    } catch (err) {
        console.error("Registration error:", err);
        return res.status(500).json({
            success: false,
            error: "Ошибка сервера. Попробуйте позже",
            errorCode: "SERVER_ERROR",
        });
    }
}
