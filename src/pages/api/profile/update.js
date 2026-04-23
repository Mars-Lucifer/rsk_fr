
import { shouldUseLocalProfileMock, updateLocalProfileMock } from "@/lib/localProfileMock";

function sanitizeProfileFieldsForUpstream(fields) {
    const out = { ...fields };
    const rawPascal = out.Organization_id;
    const rawSnake = out.organization_id;
    delete out.Organization_id;
    delete out.organization_id;

    const coerceOrgId = (v) => {
        if (v === null || v === undefined) {
            return undefined;
        }
        if (typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v >= 1) {
            return v;
        }
        if (typeof v === "string") {
            const t = v.trim();
            if (t === "") {
                return undefined;
            }
            const n = Number.parseInt(t, 10);
            return Number.isFinite(n) && n >= 1 ? n : undefined;
        }
        return undefined;
    };

    const orgId = coerceOrgId(rawPascal) ?? coerceOrgId(rawSnake);
    if (orgId !== undefined) {
        out.Organization_id = orgId;
    }
    return out;
}

export default async function ProfileUpdateHandler(req, res) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ success: false, error: "Method not allowed" });
        }

        const bodyData = { ...(req.body || {}) };
        delete bodyData.token;
        const { role, ...profileFields } = bodyData;
        const sanitizedFields = sanitizeProfileFieldsForUpstream(profileFields);

        if (shouldUseLocalProfileMock(req, { fallbackWhenAuthMissing: true })) {
            const updatedProfile = await updateLocalProfileMock({
                ...sanitizedFields,
                ...(role ? { Type: role } : {}),
            });

            return res.json({
                success: true,
                data: updatedProfile.data,
                userId: updatedProfile.userId,
                isMock: true,
            });
        }

        const response = await fetch("https://api.rosdk.ru/users/profile_interaction/update_my_profile/", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: req.headers.cookie || "",
            },
            body: JSON.stringify(sanitizedFields),
            cache: "no-store",
        });

        const textData = await response.text();
        let data;

        try {
            data = textData ? JSON.parse(textData) : {};
        } catch (error) {
            console.error("External profile API returned non-JSON:", textData);
            data = { raw_message: textData };
        }

        if (!response.ok) {
            switch (response.status) {
                case 422:
                    return res.status(422).json({ success: false, error: data });
                case 400:
                    return res.status(400).json({ success: false, error: "Неверные данные", details: data });
                case 401:
                    return res.status(401).json({ success: false, error: "Неавторизованный запрос" });
                case 403:
                    return res.status(403).json({ success: false, error: "Доступ запрещён" });
                case 404:
                    return res.status(404).json({ success: false, error: "Ресурс не найден" });
                default:
                    return res.status(response.status).json({ success: false, error: data });
            }
        }

        if (role) {
            const roleResponse = await fetch("https://api.rosdk.ru/users/profile_interaction/my-role", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: req.headers.cookie || "",
                },
                body: JSON.stringify({ role }),
                cache: "no-store",
            });

            if (!roleResponse.ok) {
                const roleErrorText = await roleResponse.text();
                console.error("Role update error:", roleResponse.status, roleErrorText);

                return res.status(roleResponse.status).json({
                    success: false,
                    error: `Профиль обновлен, но роль не сохранилась (${roleResponse.status}): ${roleErrorText}`,
                });
            }
        }

        return res.json({ success: true, data });
    } catch (err) {
        console.error("Internal API Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
