import { readLocalProfileMock, shouldUseLocalProfileMock } from "@/lib/localProfileMock";
import { fetchPortalProfileFromRequest, PortalProfileRequestError } from "@/lib/portalProfileServer";

export default async function ProfileInfoHandler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        if (shouldUseLocalProfileMock(req, { fallbackWhenAuthMissing: true })) {
            const localProfile = await readLocalProfileMock();
            return res.status(200).json({
                success: true,
                data: localProfile.data,
                userId: localProfile.userId,
                isMock: true,
            });
        }

        const { payload } = await fetchPortalProfileFromRequest(req);
        return res.status(200).json({ success: true, data: payload });
    } catch (error) {
        if (error instanceof PortalProfileRequestError) {
            const isProfileMissing =
                Number(error.status) === 404 &&
                /profile not found/i.test(String(error.message || ""));
            return res.status(error.status || 500).json({
                success: false,
                error: error.message,
                errorCode: isProfileMissing ? "PROFILE_NOT_FOUND" : undefined,
                details: error.payload || null,
            });
        }

        console.error("Profile API: Internal error:", error);
        return res.status(500).json({
            success: false,
            error: error.message || "Failed to fetch portal profile",
        });
    }
}
