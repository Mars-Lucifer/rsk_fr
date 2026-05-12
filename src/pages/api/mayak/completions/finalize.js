import { fetchPortalProfileFromRequest, PortalProfileRequestError } from "@/lib/portalProfileServer";
import { isPortalProfileComplete } from "@/lib/portalProfile";
import { readLocalProfileMock, shouldUseLocalProfileMock } from "@/lib/localProfileMock";
import { parseActivatedKeyCookie, resolveMayakTokenContext } from "@/lib/mayakTokenContext";
import {
    attachAnalyticsToMayakHistoryEntry,
    createMayakHistoryEntry,
    markMayakHistoryAnalyticsFailed,
    serializeMayakHistoryEntry,
} from "@/lib/mayakUserHistory";
import { buildMayakQrDataUrl, formatMayakHumanDate, generateMayakAnalyticsBuffer, generateMayakCertificateBuffer, generateMayakLogBuffer } from "@/lib/mayakDocumentGeneration";

function parseActiveUserCookie(rawCookie) {
    if (!rawCookie) return null;
    try {
        return JSON.parse(rawCookie);
    } catch {
        return null;
    }
}

function getBaseUrl(req) {
    const protoHeader = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const hostHeader = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
    const protocol = protoHeader || "http";
    const host = hostHeader || "localhost:3000";
    return `${protocol}://${host}`;
}

async function resolveCompletionProfile(req) {
    if (shouldUseLocalProfileMock(req, { fallbackWhenAuthMissing: true })) {
        const localProfile = await readLocalProfileMock();
        const data = localProfile?.data || {};
        return {
            id: String(localProfile?.userId || data.id || "local-mayak-user").trim(),
            fullName: [data.Surname, data.NameIRL, data.Patronymic].map((value) => String(value || "").trim()).filter(Boolean).join(" ").trim() || "Локальный пользователь",
            organizationLabel: data.Organization?.short_name || data.Organization?.name || data.Organization || "",
            organizationId: String(data.Organization_id || data.Organization?.id || "local-org").trim(),
        };
    }

    const { profile } = await fetchPortalProfileFromRequest(req);
    if (!isPortalProfileComplete(profile)) {
        throw new PortalProfileRequestError("Portal profile is incomplete", 409);
    }

    return profile;
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "4mb",
        },
    },
};

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const profile = await resolveCompletionProfile(req);

        const activeUser = parseActiveUserCookie(req.cookies?.active_user || "");
        if (!activeUser?.id || String(activeUser.id) !== String(profile.id)) {
            return res.status(403).json({ success: false, error: "Active MAYAK session does not match the portal user" });
        }

        const activatedToken = parseActivatedKeyCookie(req.cookies?.activated_key || "");
        const tokenContext = await resolveMayakTokenContext(activatedToken);
        if (!tokenContext.success || !tokenContext.valid) {
            return res.status(403).json({ success: false, error: tokenContext.error || "MAYAK token is invalid" });
        }

        const { logData, selectedRole } = req.body || {};
        if (!logData || typeof logData !== "object") {
            return res.status(400).json({ success: false, error: "logData is required" });
        }

        const completedAt = new Date().toISOString();
        const safeLogData = {
            ...logData,
            userName: profile.fullName,
            userRole: String(selectedRole || logData.userRole || "").trim(),
            date: formatMayakHumanDate(completedAt),
        };

        const qrDataUrl = await buildMayakQrDataUrl({
            baseUrl: getBaseUrl(req),
            userId: profile.id,
        });

        const [certificateBuffer, logBuffer] = await Promise.all([
            generateMayakCertificateBuffer({
                userName: profile.fullName,
                qrDataUrl,
                completedAt,
            }),
            generateMayakLogBuffer({ logData: safeLogData }),
        ]);

        const entry = await createMayakHistoryEntry({
            portalProfile: profile,
            tokenContext,
            activeUser,
            selectedRole: safeLogData.userRole,
            logData: safeLogData,
            completedAt,
            certificateBuffer,
            logBuffer,
        });

        void generateMayakAnalyticsBuffer({ logData: safeLogData })
            .then((analyticsBuffer) => attachAnalyticsToMayakHistoryEntry(entry.runId, analyticsBuffer))
            .catch(async (analyticsError) => {
                console.error("MAYAK background analytics generation failed:", analyticsError);
                await markMayakHistoryAnalyticsFailed(
                    entry.runId,
                    analyticsError?.message || "Failed to generate analytics"
                ).catch((historyError) => {
                    console.error("Failed to persist MAYAK analytics error state:", historyError);
                });
            });

        return res.status(200).json({
            success: true,
            data: serializeMayakHistoryEntry(entry),
        });
    } catch (error) {
        if (error instanceof PortalProfileRequestError) {
            return res.status(error.status || 500).json({ success: false, error: error.message });
        }

        console.error("MAYAK completion finalize failed:", error);
        return res.status(500).json({ success: false, error: error.message || "Failed to finalize MAYAK completion" });
    }
}
