import {
    LOCAL_PROFILE_MOCK_COOKIE,
    isLocalProfileMockEnabled,
    listLocalProfileMocks,
    setActiveLocalProfileMock,
} from "@/lib/localProfileMock";

function buildMockCookie(value) {
    return `${LOCAL_PROFILE_MOCK_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${value === "off" ? 86400 : 31536000}`;
}

export default async function handler(req, res) {
    if (!isLocalProfileMockEnabled()) {
        return res.status(404).json({ success: false, error: "Локальные тестовые профили отключены" });
    }

    if (req.method === "GET") {
        const profiles = await listLocalProfileMocks();
        return res.status(200).json({ success: true, data: profiles });
    }

    if (req.method === "POST") {
        try {
            if (req.body?.action === "logout") {
                res.setHeader("Set-Cookie", buildMockCookie("off"));
                return res.status(200).json({ success: true });
            }

            const profile = await setActiveLocalProfileMock(req.body?.userId || "");
            res.setHeader("Set-Cookie", buildMockCookie("on"));
            return res.status(200).json({ success: true, data: profile });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message || "Не удалось переключить тестовый профиль" });
        }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
}
