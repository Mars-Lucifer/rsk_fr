import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";
import PortalAuthFlow from "@/components/features/auth/PortalAuthFlow";
import {
    addKeyToCookies,
    addUserToCookies,
    clearUserCookie,
    getKeyFromCookies,
    getUserFromCookies,
    removeKeyCookie,
} from "./actions";
import CloseIcon from "@/assets/general/close.svg";
import {
    buildPortalUserCookiePayload,
    normalizePortalProfile,
} from "@/lib/portalProfile";
import {
    fetchPortalProfileClient,
    getCachedPortalProfilePayload,
    hasResolvedPortalProfileCache,
    primePortalProfileCache,
} from "@/lib/portalProfileClient";

const EMPTY_SESSION_INFO = {
    tokenType: "legacy",
    sessionId: null,
    sessionName: "",
    tableCount: 0,
};

const MAYAK_GUEST_SUFFIX = "aaaaa";
const MAYAK_TEMP_GUEST_TOKEN = "aaaaa";
const TEMP_GUEST_PROFILE = {
    firstName: "МАЯК",
    lastName: "Участник",
    patronymic: "",
};
const EMPTY_GUEST_FORM = {
    firstName: "",
    lastName: "",
    patronymic: "",
};

function hasPortalIdentityFields(payload) {
    const profile = normalizePortalProfile(payload);
    return Boolean(String(profile.surname || "").trim() && String(profile.name || "").trim());
}

function parseMayakGuestToken(tokenValue) {
    const normalized = String(tokenValue || "").trim();
    if (!normalized) {
        return { rawToken: "", baseToken: "", isGuestMode: false };
    }

    if (normalized.toLowerCase() === MAYAK_TEMP_GUEST_TOKEN) {
        return {
            rawToken: normalized,
            baseToken: MAYAK_TEMP_GUEST_TOKEN,
            isGuestMode: true,
            isTemporaryGuestToken: true,
        };
    }

    if (normalized.toLowerCase().endsWith(MAYAK_GUEST_SUFFIX)) {
        return {
            rawToken: normalized,
            baseToken: normalized.slice(0, -MAYAK_GUEST_SUFFIX.length).trim(),
            isGuestMode: true,
            isTemporaryGuestToken: false,
        };
    }

    return {
        rawToken: normalized,
        baseToken: normalized,
        isGuestMode: false,
        isTemporaryGuestToken: false,
    };
}

function buildMayakGuestUserId(sessionInfo = {}) {
    const sessionPart = String(sessionInfo?.sessionId || sessionInfo?.tokenType || "guest")
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, "-");
    const randomPart =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return `guest-${sessionPart || "guest"}-${randomPart}`;
}

async function validateTokenAPI(tokenValue) {
    try {
        const response = await fetch(`/api/mayak/validate-token?token=${encodeURIComponent(tokenValue)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();
        return {
            valid: data.valid || false,
            isActive: data.isActive || false,
            isExhausted: data.isExhausted || false,
            remainingAttempts: data.remainingAttempts || 0,
            usageLimit: data.usageLimit || 0,
            usedCount: data.usedCount || 0,
            error: data.error || null,
            isBypass: data.isBypass || false,
            tokenType: data.tokenType || "legacy",
            sessionId: data.sessionId || null,
            sessionName: data.sessionName || null,
            tableCount: data.tableCount || 0,
        };
    } catch (error) {
        console.error("РћС€РёР±РєР° РїСЂРѕРІРµСЂРєРё С‚РѕРєРµРЅР°:", error);
        return {
            valid: false,
            isActive: false,
            isExhausted: false,
            remainingAttempts: 0,
            usageLimit: 0,
            usedCount: 0,
            error: "РћС€РёР±РєР° СЃРµСЂРІРµСЂР°",
            isBypass: false,
            tokenType: "legacy",
            sessionId: null,
            sessionName: null,
            tableCount: 0,
        };
    }
}

async function consumeTokenAPI(tokenValue) {
    try {
        const response = await fetch("/api/mayak/validate-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: tokenValue }),
        });
        const data = await response.json();
        return {
            success: data.success || false,
            remainingAttempts: data.remainingAttempts || 0,
            error: data.error || null,
            isBypass: data.isBypass || false,
        };
    } catch (error) {
        console.error("РћС€РёР±РєР° РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ С‚РѕРєРµРЅР°:", error);
        return { success: false, remainingAttempts: 0, error: "РћС€РёР±РєР° СЃРµСЂРІРµСЂР°", isBypass: false };
    }
}

async function loginMayakAdmin(password) {
    try {
        const response = await fetch("/api/admin/mayak-auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });
        const data = await response.json().catch(() => ({}));
        return {
            success: response.ok && Boolean(data.success),
            error: data.error || null,
        };
    } catch (error) {
        console.error("РћС€РёР±РєР° Р°РІС‚РѕСЂРёР·Р°С†РёРё Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°:", error);
        return { success: false, error: "РћС€РёР±РєР° СЃРµСЂРІРµСЂР°" };
    }
}

export default function SettingsPage({ goTo }) {
    const router = useRouter();
    const skipNextTokenEffectRef = useRef(false);
    const portalProfilePayloadRef = useRef(getCachedPortalProfilePayload());
    const isPortalCheckedRef = useRef(hasResolvedPortalProfileCache());
    const sessionInfoRef = useRef(EMPTY_SESSION_INFO);
    const tokenRef = useRef("");
    const storedTokenRef = useRef("");

    const [token, setToken] = useState("");
    const [storedToken, setStoredToken] = useState("");
    const [isTokenValid, setIsTokenValid] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [isDevBypass, setIsDevBypass] = useState(false);
    const [bypassPassword, setBypassPassword] = useState("");
    const [bypassPasswordError, setBypassPasswordError] = useState("");

    const [portalProfilePayload, setPortalProfilePayload] = useState(() => getCachedPortalProfilePayload());
    const [isPortalChecked, setIsPortalChecked] = useState(() => hasResolvedPortalProfileCache());

    const [sessionInfo, setSessionInfo] = useState(EMPTY_SESSION_INFO);
    const [tableNumber, setTableNumber] = useState("");
    const [hasRegisteredUser, setHasRegisteredUser] = useState(false);
    const [isHydratingAccess, setIsHydratingAccess] = useState(true);
    const [isGuestMode, setIsGuestMode] = useState(false);
    const [guestForm, setGuestForm] = useState(EMPTY_GUEST_FORM);
    const [guestFormError, setGuestFormError] = useState("");
    const [portalIdentityForm, setPortalIdentityForm] = useState(EMPTY_GUEST_FORM);
    const [portalIdentityError, setPortalIdentityError] = useState("");
    const [isSavingPortalIdentity, setIsSavingPortalIdentity] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [tokenRemainingAttempts, setTokenRemainingAttempts] = useState(0);
    const [usageLimit, setUsageLimit] = useState(0);
    const [tokenError, setTokenError] = useState("");
    const [isValidating, setIsValidating] = useState(false);

    useEffect(() => {
        portalProfilePayloadRef.current = portalProfilePayload;
    }, [portalProfilePayload]);

    useEffect(() => {
        isPortalCheckedRef.current = isPortalChecked;
    }, [isPortalChecked]);

    useEffect(() => {
        sessionInfoRef.current = sessionInfo;
    }, [sessionInfo]);

    useEffect(() => {
        tokenRef.current = token;
    }, [token]);

    useEffect(() => {
        storedTokenRef.current = storedToken;
    }, [storedToken]);

    const portalProfile = portalProfilePayload ? normalizePortalProfile(portalProfilePayload) : null;
    const isStoredTokenActive = Boolean(token && storedToken && storedToken === token);
    const hasPortalIdentity = hasPortalIdentityFields(portalProfilePayload);
    const isTemporaryGuestToken = parseMayakGuestToken(token).isTemporaryGuestToken;

    useEffect(() => {
        setPortalIdentityForm({
            firstName: String(portalProfile?.name || "").trim(),
            lastName: String(portalProfile?.surname || "").trim(),
            patronymic: String(portalProfile?.patronymic || "").trim(),
        });
        setPortalIdentityError("");
    }, [portalProfile?.name, portalProfile?.surname, portalProfile?.patronymic]);

    const getRangeClass = (val) => {
        if (val < 30) return "range-low";
        if (val < 80) return "range-mid";
        return "range-high";
    };

    const syncRegisteredUserState = useCallback((nextSessionInfo, nextProfilePayload, nextTokenValue) => {
        const effectiveSessionInfo = nextSessionInfo || sessionInfoRef.current;
        const effectiveProfilePayload = nextProfilePayload === undefined ? portalProfilePayloadRef.current : nextProfilePayload;
        const effectiveTokenValue = nextTokenValue === undefined ? tokenRef.current : nextTokenValue;

        const activeUser = getUserFromCookies();
        const profile = effectiveProfilePayload ? normalizePortalProfile(effectiveProfilePayload) : null;
        const matchesStoredToken = Boolean(effectiveTokenValue) && String(storedTokenRef.current || "") === String(effectiveTokenValue || "");

        if (activeUser?.guestMode) {
            const hasGuestName = Boolean(String(activeUser.lastName || "").trim() && String(activeUser.firstName || "").trim());
            if (!activeUser?.id || !matchesStoredToken || !hasGuestName) {
                setHasRegisteredUser(false);
                return false;
            }

            if ((effectiveSessionInfo?.tokenType || "legacy") === "session") {
                const isRegistered =
                    activeUser.tokenType === "session" &&
                    String(activeUser.sessionId || "") === String(effectiveSessionInfo.sessionId || "") &&
                    Boolean(String(activeUser.tableNumber || "").trim());

                if (isRegistered) {
                    setTableNumber(String(activeUser.tableNumber || ""));
                }

                setHasRegisteredUser(isRegistered);
                return isRegistered;
            }

            const isRegistered = activeUser.tokenType !== "session";
            setHasRegisteredUser(isRegistered);
            return isRegistered;
        }

        if (!activeUser?.id || !profile?.id || !matchesStoredToken) {
            setHasRegisteredUser(false);
            return false;
        }

        if (String(activeUser.id) !== String(profile.id)) {
            clearUserCookie();
            setHasRegisteredUser(false);
            return false;
        }

        if ((effectiveSessionInfo?.tokenType || "legacy") === "session") {
            const isRegistered =
                activeUser.tokenType === "session" &&
                String(activeUser.sessionId || "") === String(effectiveSessionInfo.sessionId || "") &&
                Boolean(String(activeUser.tableNumber || "").trim());

            if (isRegistered) {
                setTableNumber(String(activeUser.tableNumber || ""));
            }

            setHasRegisteredUser(isRegistered);
            return isRegistered;
        }

        const isRegistered = activeUser.tokenType !== "session";
        setHasRegisteredUser(isRegistered);
        return isRegistered;
    }, []);

    const fetchPortalProfile = useCallback(async ({ force = false } = {}) => {
        try {
            const payload = await fetchPortalProfileClient({ force });
            if (!payload) {
                setPortalProfilePayload(null);
                setIsPortalChecked(true);
                setHasRegisteredUser(false);
                return null;
            }

            primePortalProfileCache(payload);
            setPortalProfilePayload(payload);
            setIsPortalChecked(true);
            syncRegisteredUserState(sessionInfoRef.current, payload, tokenRef.current);
            return payload;
        } catch (error) {
            console.error("РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РїСЂРѕС„РёР»СЏ РїРѕСЂС‚Р°Р»Р°:", error);
            setPortalProfilePayload(null);
            setIsPortalChecked(true);
            return null;
        }
    }, [syncRegisteredUserState]);

    const validateToken = useCallback(async (tokenToValidate) => {
        const tokenMeta = parseMayakGuestToken(tokenToValidate);
        const nextTokenValue = tokenMeta.rawToken;
        const validatedTokenValue = tokenMeta.baseToken;
        const guestModeActive = tokenMeta.isGuestMode;

        if (!nextTokenValue || !validatedTokenValue) {
            setIsTokenValid(false);
            setShowNotification(false);
            setTokenError("");
            setIsDevBypass(false);
            setBypassPassword("");
            setBypassPasswordError("");
            setSessionInfo(EMPTY_SESSION_INFO);
            setHasRegisteredUser(false);
            setIsGuestMode(false);
            setGuestForm(EMPTY_GUEST_FORM);
            setGuestFormError("");
            setTableNumber("");
            return;
        }

        setIsValidating(true);
        try {
            const result = await validateTokenAPI(validatedTokenValue);
            const isAccessible = result.valid || (result.isExhausted && result.isActive);
            const nextSessionInfo = {
                tokenType: result.tokenType || "legacy",
                sessionId: result.sessionId || null,
                sessionName: result.sessionName || "",
                tableCount: Number(result.tableCount) || 0,
            };
            const nextGuestMode = guestModeActive && !result.isBypass;

            setIsTokenValid(isAccessible);
            setTokenRemainingAttempts(result.remainingAttempts);
            setUsageLimit(result.usageLimit);
            setIsDevBypass(Boolean(result.isBypass));
            setIsGuestMode(nextGuestMode);
            setSessionInfo(nextSessionInfo);
            setShowNotification(isAccessible);
            setGuestForm(tokenMeta.isTemporaryGuestToken ? TEMP_GUEST_PROFILE : EMPTY_GUEST_FORM);

            if (!result.isBypass) {
                setBypassPassword("");
                setBypassPasswordError("");
            }

            if ((result.tokenType || "legacy") !== "session") {
                setTableNumber("");
            }

            if (isAccessible) {
                setTokenError("");
            } else {
                setTokenError(result.error || "РўРѕРєРµРЅ РЅРµРґРµР№СЃС‚РІРёС‚РµР»РµРЅ");
            }

            if (portalProfilePayloadRef.current || isPortalCheckedRef.current) {
                syncRegisteredUserState(nextSessionInfo, portalProfilePayloadRef.current, nextTokenValue);
            }
        } finally {
            setIsValidating(false);
        }
    }, [syncRegisteredUserState]);

    useEffect(() => {
        if (!router.isReady) return;
        const tokenFromUrl = String(router.query?.token || router.query?.password || "").trim();
        if (!tokenFromUrl) return;

        skipNextTokenEffectRef.current = true;
        setToken(tokenFromUrl);
        setTokenError("");
        setShowNotification(false);
        setIsTokenValid(false);
        validateToken(tokenFromUrl);
    }, [router.isReady, router.query?.password, router.query?.token, validateToken]);

    useEffect(() => {
        if (!router.isReady) return undefined;

        let isCancelled = false;

        const hydrate = async () => {
            setIsHydratingAccess(true);

            try {
                const keyInCookies = await getKeyFromCookies();
                const tokenFromCookie = keyInCookies?.text || "";
                const tokenFromUrl = String(router.query?.token || router.query?.password || "").trim();

                if (tokenFromUrl) {
                    skipNextTokenEffectRef.current = true;
                    if (tokenFromCookie && tokenFromCookie !== tokenFromUrl) {
                        await removeKeyCookie();
                        await clearUserCookie();
                    }

                    if (!isCancelled) {
                        setStoredToken(tokenFromCookie === tokenFromUrl ? tokenFromCookie : "");
                        setToken(tokenFromUrl);
                    }

                    await Promise.all([validateToken(tokenFromUrl), fetchPortalProfile({ force: true })]);
                    return;
                }

                if (tokenFromCookie === "ADMIN-BYPASS-TOKEN") {
                    await removeKeyCookie();
                    await clearUserCookie();

                    if (!isCancelled) {
                        setStoredToken("");
                        setToken("");
                        setIsTokenValid(false);
                        setShowNotification(false);
                        setSessionInfo(EMPTY_SESSION_INFO);
                        setHasRegisteredUser(false);
                        setIsGuestMode(false);
                        setGuestForm(EMPTY_GUEST_FORM);
                        setGuestFormError("");
                    }

                    await fetchPortalProfile({ force: true });
                    return;
                }

                if (tokenFromCookie) {
                    skipNextTokenEffectRef.current = true;
                    if (!isCancelled) {
                        setStoredToken(tokenFromCookie);
                        setToken(tokenFromCookie);
                    }
                    await Promise.all([validateToken(tokenFromCookie), fetchPortalProfile({ force: true })]);
                    return;
                }

                await fetchPortalProfile({ force: true });
                if (!isCancelled) {
                    setIsGuestMode(false);
                    setGuestForm(EMPTY_GUEST_FORM);
                    setGuestFormError("");
                }
            } finally {
                if (!isCancelled) {
                    setIsHydratingAccess(false);
                }
            }
        };

        hydrate();

        return () => {
            isCancelled = true;
        };
    }, [fetchPortalProfile, router.isReady, router.query?.password, router.query?.token, validateToken]);

    useEffect(() => {
        if (skipNextTokenEffectRef.current) {
            skipNextTokenEffectRef.current = false;
            return undefined;
        }

        if (isHydratingAccess || !token || token.trim() === "") {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            validateToken(token);
        }, 500);

        return () => window.clearTimeout(timeoutId);
    }, [isHydratingAccess, token, validateToken]);

    useEffect(() => {
        if (sessionInfo.tokenType === "session" && Number(sessionInfo.tableCount) > 0 && !String(tableNumber || "").trim()) {
            setTableNumber("1");
        }
    }, [sessionInfo.tableCount, sessionInfo.tokenType, tableNumber]);

    const enterWithDevBypass = useCallback(async () => {
        setBypassPasswordError("");
        if (!bypassPassword) {
            setBypassPasswordError("Р’РІРµРґРёС‚Рµ РїР°СЂРѕР»СЊ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°");
            return;
        }

        const authResult = await loginMayakAdmin(bypassPassword);
        if (!authResult.success) {
            setBypassPasswordError(authResult.error || "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРґС‚РІРµСЂРґРёС‚СЊ Р»РѕРєР°Р»СЊРЅС‹Р№ РІС…РѕРґ");
            return;
        }

        const resolvedTableNumber = String(tableNumber || "").trim();
        if (sessionInfo.tokenType === "session" && !resolvedTableNumber) {
            setBypassPasswordError("РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РІС‹Р±РµСЂРёС‚Рµ РІР°С€ СЃС‚РѕР»");
            return;
        }

        const bypassPayload = portalProfilePayload || (await fetchPortalProfile({ force: true }));
        const bypassProfile = bypassPayload ? normalizePortalProfile(bypassPayload) : null;

        const localUserId = String(bypassProfile?.id || "local-mayak-user").trim();
        const localFullName = String(bypassProfile?.fullName || "Р›РѕРєР°Р»СЊРЅС‹Р№ РІС…РѕРґ").trim() || "Р›РѕРєР°Р»СЊРЅС‹Р№ РІС…РѕРґ";
        const userRecord = {
            id: localUserId,
            portalUserId: localUserId,
            sessionId: sessionInfo.sessionId,
            tokenType: sessionInfo.tokenType || "legacy",
            userData: {
                firstName: bypassProfile?.name || "",
                lastName: bypassProfile?.surname || "",
                patronymic: bypassProfile?.patronymic || "",
                college: bypassProfile?.organizationLabel || "",
            },
            portalProfile: {
                email: bypassProfile?.email || "",
                username: bypassProfile?.username || "",
                organizationId: bypassProfile?.organizationId || null,
                fullName: localFullName,
            },
        };

        const saveResponse = await fetch("/api/mayak/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                key: token,
                userId: localUserId,
                data: userRecord,
            }),
        });

        if (!saveResponse.ok) {
            throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ Р»РѕРєР°Р»СЊРЅРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РњРђРЇРљ");
        }

        if (sessionInfo.tokenType === "session" && sessionInfo.sessionId) {
            const participantResponse = await fetch("/api/mayak/session-runtime/participant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: sessionInfo.sessionId,
                    userId: localUserId,
                    name: localFullName,
                    organization: bypassProfile?.organizationLabel || "",
                    tableNumber: resolvedTableNumber,
                }),
            });

            const participantPayload = await participantResponse.json().catch(() => ({}));
            if (!participantResponse.ok || !participantPayload.success) {
                throw new Error(participantPayload.error || "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°С‚СЊ Р»РѕРєР°Р»СЊРЅРѕРіРѕ СѓС‡Р°СЃС‚РЅРёРєР° РІ СЃРµСЃСЃРёРё");
            }
        }

        await addKeyToCookies(token);
        setStoredToken(token);
        await addUserToCookies("dev-bypass", "Р›РѕРєР°Р»СЊРЅС‹Р№ РІС…РѕРґ", {
            tokenType: "bypass",
        });
        setHasRegisteredUser(true);
        goTo("trainer");
    }, [bypassPassword, fetchPortalProfile, goTo, portalProfilePayload, sessionInfo.sessionId, sessionInfo.tokenType, tableNumber, token]);

    const activateGuestUser = useCallback(async () => {
        if (!isTokenValid) {
            setGuestFormError("Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ С‚РѕРєРµРЅ.");
            return;
        }

        const tokenMeta = parseMayakGuestToken(token);
        const firstName = String((tokenMeta.isTemporaryGuestToken ? TEMP_GUEST_PROFILE.firstName : guestForm.firstName) || "").trim();
        const lastName = String((tokenMeta.isTemporaryGuestToken ? TEMP_GUEST_PROFILE.lastName : guestForm.lastName) || "").trim();
        const patronymic = String((tokenMeta.isTemporaryGuestToken ? TEMP_GUEST_PROFILE.patronymic : guestForm.patronymic) || "").trim();

        if (!lastName || !firstName) {
            setGuestFormError("Р”Р»СЏ РІС…РѕРґР° Р·Р°РїРѕР»РЅРёС‚Рµ С„Р°РјРёР»РёСЋ Рё РёРјСЏ.");
            return;
        }

        const resolvedTableNumber =
            sessionInfo.tokenType === "session" && !String(tableNumber || "").trim() && Number(sessionInfo.tableCount) === 1 ? "1" : String(tableNumber || "").trim();

        if (sessionInfo.tokenType === "session" && !resolvedTableNumber) {
            setGuestFormError("РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РІС‹Р±РµСЂРёС‚Рµ РІР°С€ СЃС‚РѕР».");
            return;
        }

        setIsLoading(true);
        setGuestFormError("");

        try {
            if (!isStoredTokenActive) {
                const consumeResult = await consumeTokenAPI(token);
                if (!consumeResult.success) {
                    throw new Error(consumeResult.error || "РќРµ СѓРґР°Р»РѕСЃСЊ Р°РєС‚РёРІРёСЂРѕРІР°С‚СЊ С‚РѕРєРµРЅ.");
                }
                setTokenRemainingAttempts(consumeResult.remainingAttempts || 0);
                await addKeyToCookies(token);
                setStoredToken(token);
            }

            const baseToken = tokenMeta.baseToken || String(token || "").trim();
            const userId = buildMayakGuestUserId(sessionInfo);
            const fullName = [lastName, firstName, patronymic].filter(Boolean).join(" ").trim();

            const saveResponse = await fetch("/api/mayak/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    key: baseToken,
                    userId,
                    data: {
                        id: userId,
                        portalUserId: userId,
                        guestMode: true,
                        userData: {
                            firstName,
                            lastName,
                            patronymic,
                            college: "",
                        },
                        sessionId: sessionInfo.sessionId,
                        sessionName: sessionInfo.sessionName,
                        tokenType: sessionInfo.tokenType,
                        tableNumber: sessionInfo.tokenType === "session" ? resolvedTableNumber : "",
                    },
                }),
            });

            if (!saveResponse.ok) {
                throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РіРѕСЃС‚РµРІРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РњРђРЇРљ");
            }

            const savePayload = await saveResponse.json().catch(() => ({}));
            const certificateNumber = savePayload?.certificateNumber || savePayload?.data?.certificateNumber || "";

            if (sessionInfo.tokenType === "session" && sessionInfo.sessionId) {
                const participantResponse = await fetch("/api/mayak/session-runtime/participant", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sessionId: sessionInfo.sessionId,
                        userId,
                        name: fullName,
                        organization: "",
                        tableNumber: resolvedTableNumber,
                    }),
                });

                const participantPayload = await participantResponse.json().catch(() => ({}));
                if (!participantResponse.ok || !participantPayload.success) {
                    throw new Error(participantPayload.error || "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°С‚СЊ РіРѕСЃС‚РµРІРѕРіРѕ СѓС‡Р°СЃС‚РЅРёРєР° РІ СЃРµСЃСЃРёРё");
                }
            }

            await addUserToCookies(userId, fullName, {
                firstName,
                lastName,
                patronymic,
                portalUserId: userId,
                sessionId: sessionInfo.sessionId || "",
                sessionName: sessionInfo.sessionName || "",
                tableNumber: sessionInfo.tokenType === "session" ? resolvedTableNumber : "",
                tokenType: sessionInfo.tokenType || "legacy",
                certificateNumber,
                guestMode: true,
            });
            setHasRegisteredUser(true);
            if (resolvedTableNumber && resolvedTableNumber !== tableNumber) {
                setTableNumber(resolvedTableNumber);
            }
            goTo("trainer");
        } catch (error) {

            console.error("РћС€РёР±РєР° Р°РєС‚РёРІР°С†РёРё РіРѕСЃС‚РµРІРѕРіРѕ РњРђРЇРљ:", error);
            setGuestFormError(error.message || "РќРµ СѓРґР°Р»РѕСЃСЊ Р°РєС‚РёРІРёСЂРѕРІР°С‚СЊ РіРѕСЃС‚РµРІРѕР№ РІС…РѕРґ.");
        } finally {
            setIsLoading(false);
        }
    }, [goTo, guestForm.firstName, guestForm.lastName, guestForm.patronymic, isStoredTokenActive, isTokenValid, sessionInfo, tableNumber, token]);

    useEffect(() => {
        if (!showNotification || !isTokenValid || !isGuestMode || !isTemporaryGuestToken || hasRegisteredUser || isLoading || isValidating) {
            return;
        }

        activateGuestUser();
    }, [activateGuestUser, hasRegisteredUser, isGuestMode, isLoading, isTemporaryGuestToken, isTokenValid, isValidating, showNotification]);

    const savePortalIdentity = useCallback(async () => {
        const firstName = String(portalIdentityForm.firstName || "").trim();
        const lastName = String(portalIdentityForm.lastName || "").trim();
        const patronymic = String(portalIdentityForm.patronymic || "").trim();

        if (!lastName || !firstName) {
            setPortalIdentityError("Для входа заполните фамилию и имя.");
            return false;
        }

        setIsSavingPortalIdentity(true);
        setPortalIdentityError("");

        try {
            const response = await fetch("/api/profile/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    Surname: lastName,
                    NameIRL: firstName,
                    Patronymic: patronymic,
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                throw new Error(payload?.error || "Не удалось сохранить имя профиля.");
            }

            const nextPayload = payload?.data?.data ? payload.data : { success: true, data: payload.data || {} };
            primePortalProfileCache(nextPayload);
            setPortalProfilePayload(nextPayload);
            setIsPortalChecked(true);
            syncRegisteredUserState(sessionInfoRef.current, nextPayload, tokenRef.current);
            return true;
        } catch (error) {
            console.error("Ошибка сохранения имени портального профиля для MAYAK:", error);
            setPortalIdentityError(String(error?.message || "Не удалось сохранить имя профиля."));
            return false;
        } finally {
            setIsSavingPortalIdentity(false);
        }
    }, [portalIdentityForm.firstName, portalIdentityForm.lastName, portalIdentityForm.patronymic, syncRegisteredUserState]);

    const activatePortalAccess = useCallback(async () => {
        if (isDevBypass) {
            await enterWithDevBypass();
            return;
        }

        if (isGuestMode) {
            await activateGuestUser();
            return;
        }

        if (!portalProfilePayload || !hasPortalIdentityFields(portalProfilePayload)) {
            alert("Для входа в МАЯК заполните фамилию и имя профиля.");
            return;
        }

        if (sessionInfo.tokenType === "session" && !String(tableNumber || "").trim()) {
            alert("Р’С‹Р±РµСЂРёС‚Рµ СЃС‚РѕР» РґР»СЏ РІС…РѕРґР° РІ СЃРµСЃСЃРёСЋ.");
            return;
        }

        setIsLoading(true);
        try {
            if (!isStoredTokenActive) {
                const consumeResult = await consumeTokenAPI(token);
                if (!consumeResult.success) {
                    alert(consumeResult.error || "РќРµ СѓРґР°Р»РѕСЃСЊ Р°РєС‚РёРІРёСЂРѕРІР°С‚СЊ С‚РѕРєРµРЅ.");
                    return;
                }
                setTokenRemainingAttempts(consumeResult.remainingAttempts || 0);
                await addKeyToCookies(token);
                setStoredToken(token);
            }

            const nextProfile = normalizePortalProfile(portalProfilePayload);
            const nextCookiePayload = buildPortalUserCookiePayload(portalProfilePayload, {
                sessionId: sessionInfo.sessionId,
                sessionName: sessionInfo.sessionName,
                tableNumber: sessionInfo.tokenType === "session" ? String(tableNumber || "") : "",
                tokenType: sessionInfo.tokenType,
            });

            if (!nextProfile.id) {
                throw new Error("Не удалось определить идентификатор пользователя портала. Проверьте email или логин в профиле.");
            }

            const saveResponse = await fetch("/api/mayak/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    key: token,
                    userId: nextProfile.id,
                    data: {
                        id: nextProfile.id,
                        portalUserId: nextProfile.id,
                        userData: {
                            lastName: nextProfile.surname,
                            firstName: nextProfile.name,
                            patronymic: nextProfile.patronymic,
                            college: nextProfile.organizationLabel,
                        },
                        sessionId: sessionInfo.sessionId,
                        sessionName: sessionInfo.sessionName,
                        tokenType: sessionInfo.tokenType,
                        tableNumber: sessionInfo.tokenType === "session" ? String(tableNumber || "") : "",
                    },
                }),
            });

            if (!saveResponse.ok) {
                const savePayload = await saveResponse.json().catch(() => ({}));
                throw new Error(savePayload.error || "Не удалось сохранить контекст входа МАЯК");
            }

            if (sessionInfo.tokenType === "session" && sessionInfo.sessionId) {
                const participantResponse = await fetch("/api/mayak/session-runtime/participant", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sessionId: sessionInfo.sessionId,
                        userId: nextProfile.id,
                        name: nextProfile.fullName,
                        organization: nextProfile.organizationLabel,
                        tableNumber,
                    }),
                });

                const participantPayload = await participantResponse.json().catch(() => ({}));
                if (!participantResponse.ok || !participantPayload.success) {
                    throw new Error(participantPayload.error || "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°С‚СЊ СѓС‡Р°СЃС‚РЅРёРєР° РІ СЃРµСЃСЃРёРё");
                }
            }

            await addUserToCookies(nextCookiePayload.id, nextCookiePayload.name, nextCookiePayload);
            setHasRegisteredUser(true);
            syncRegisteredUserState(sessionInfo, portalProfilePayload, token);
            goTo("trainer");
        } catch (error) {
            const errorMessage = String(error?.message || "");

            if (errorMessage.includes("\u0421\u0435\u0441\u0441\u0438\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430") || errorMessage.includes("\u0443\u0436\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430")) {
                await removeKeyCookie();
                await clearUserCookie();
                setStoredToken("");
                setToken("");
                setIsTokenValid(false);
                setShowNotification(false);
                setTokenError("\u0421\u0435\u0441\u0441\u0438\u044f \u0443\u0436\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430 \u0438\u043b\u0438 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430.");
                setSessionInfo(EMPTY_SESSION_INFO);
                setHasRegisteredUser(false);
                setTableNumber("");
                alert("\u0421\u0435\u0441\u0441\u0438\u044f \u0443\u0436\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430 \u0438\u043b\u0438 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430.");
                return;
            }

            console.error("РћС€РёР±РєР° Р°РєС‚РёРІР°С†РёРё РњРђРЇРљ:", error);
            alert(error.message || "РџСЂРѕРёР·РѕС€Р»Р° РѕС€РёР±РєР° РїСЂРё Р°РєС‚РёРІР°С†РёРё С‚СЂРµРЅР°Р¶РµСЂР°.");
        } finally {
            setIsLoading(false);
        }
    }, [activateGuestUser, enterWithDevBypass, goTo, isDevBypass, isGuestMode, isStoredTokenActive, portalProfilePayload, sessionInfo, syncRegisteredUserState, tableNumber, token]);

    const renderPortalGate = () => {
        if (!showNotification || isDevBypass) {
            return null;
        }

        if (isGuestMode) {
            if (isTemporaryGuestToken) {
                return (
                    <div className="flex flex-col gap-[1rem] items-center">
                        <span className="big p-3 bg-green-100 text-green-700 rounded-md">
                            {isLoading ? "Подключаем гостевой вход..." : "Гостевой вход активирован"}
                        </span>
                    </div>
                );
            }

            if (hasRegisteredUser) {
                const activeUser = getUserFromCookies();
                return (
                    <div className="flex flex-col gap-[1rem] items-center">
                        <span className="big p-3 bg-green-100 text-green-700 rounded-md">Тренажёр активирован</span>
                        <span className="small text-(--color-gray-black)">{activeUser?.name || "Гостевой пользователь"}</span>
                        <Button onClick={() => goTo("trainer")} className="w-full">
                            Войти в тренажёр
                        </Button>
                    </div>
                );
            }

            return (
                <div className="flex flex-col gap-[1rem] w-full">
                    <span className="big p-3 bg-green-100 text-green-700 rounded-md block text-center">
                        Заполните ФИО для входа в тренажёр. После завершения сертификат и лог сохранятся автоматически.
                    </span>
                    <div className="flex flex-col gap-[0.75rem]">
                        <Input
                            name="lastName"
                            placeholder="Фамилия *"
                            value={guestForm.lastName}
                            onChange={(event) => {
                                setGuestForm((prev) => ({ ...prev, lastName: event.target.value }));
                                setGuestFormError("");
                            }}
                        />
                        <Input
                            name="firstName"
                            placeholder="Имя *"
                            value={guestForm.firstName}
                            onChange={(event) => {
                                setGuestForm((prev) => ({ ...prev, firstName: event.target.value }));
                                setGuestFormError("");
                            }}
                        />
                        <Input
                            name="patronymic"
                            placeholder="Отчество"
                            value={guestForm.patronymic}
                            onChange={(event) => {
                                setGuestForm((prev) => ({ ...prev, patronymic: event.target.value }));
                                setGuestFormError("");
                            }}
                        />
                        {guestFormError ? <span className="small text-red-600 block text-center">{guestFormError}</span> : null}
                    </div>
                    {sessionInfo.tokenType === "session" && sessionInfo.tableCount > 0 ? (
                        <div className="flex flex-col gap-[0.5rem]">
                            <label htmlFor="guestTableNumber" className="block text-sm font-medium text-gray-700">
                                Выберите ваш стол
                            </label>
                            <select
                                id="guestTableNumber"
                                name="guestTableNumber"
                                value={tableNumber}
                                onChange={(event) => setTableNumber(event.target.value)}
                                className="input-wrapper w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {sessionInfo.tableCount > 1 ? <option value="" disabled>Выберите стол</option> : null}
                                {Array.from({ length: sessionInfo.tableCount }, (_, index) => {
                                    const value = String(index + 1);
                                    return (
                                        <option key={value} value={value}>
                                            Стол {value}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    ) : null}
                    <Button onClick={activateGuestUser} disabled={isLoading}>
                        {isLoading ? "Подключаем..." : "Войти в тренажёр"}
                    </Button>
                </div>
            );
        }

        if (isHydratingAccess || !isPortalChecked) {
            return <p className="small text-(--color-gray-black) text-center">Проверяем портал...</p>;
        }

        if (!portalProfilePayload) {
            return (
                <div className="flex flex-col gap-[1rem] w-full">
                    <span className="big p-3 bg-green-100 text-green-700 rounded-md block text-center">
                        Токен подходит. Войдите в портал, чтобы продолжить.
                    </span>
                    <PortalAuthFlow
                        className="w-full"
                        initialMode="login"
                        returnPath="/tools/mayak-oko"
                        onAuthenticated={async (payload) => {
                            primePortalProfileCache(payload);
                            setPortalProfilePayload(payload);
                            setIsPortalChecked(true);
                            syncRegisteredUserState(sessionInfoRef.current, payload, tokenRef.current);
                        }}
                    />
                </div>
            );
        }

        if (!hasPortalIdentity) {
            return (
                <div className="flex flex-col gap-[1rem] w-full">
                    <span className="big p-3 bg-green-100 text-green-700 rounded-md block text-center">
                        Профиль портала найден. Для входа в МАЯК заполните фамилию и имя.
                    </span>
                    <div className="flex flex-col gap-[0.75rem] w-full">
                        <Input
                            name="portalLastName"
                            placeholder="Фамилия *"
                            value={portalIdentityForm.lastName}
                            onChange={(event) => {
                                setPortalIdentityForm((prev) => ({ ...prev, lastName: event.target.value }));
                                setPortalIdentityError("");
                            }}
                        />
                        <Input
                            name="portalFirstName"
                            placeholder="Имя *"
                            value={portalIdentityForm.firstName}
                            onChange={(event) => {
                                setPortalIdentityForm((prev) => ({ ...prev, firstName: event.target.value }));
                                setPortalIdentityError("");
                            }}
                        />
                        <Input
                            name="portalPatronymic"
                            placeholder="Отчество"
                            value={portalIdentityForm.patronymic}
                            onChange={(event) => {
                                setPortalIdentityForm((prev) => ({ ...prev, patronymic: event.target.value }));
                                setPortalIdentityError("");
                            }}
                        />
                        {portalIdentityError ? <span className="small text-red-600 block text-center">{portalIdentityError}</span> : null}
                    </div>
                    <Button onClick={savePortalIdentity} disabled={isSavingPortalIdentity}>
                        {isSavingPortalIdentity ? "Сохраняем..." : "Сохранить и продолжить"}
                    </Button>
                </div>
            );
        }

        if (hasRegisteredUser) {
            return (
                <div className="flex flex-col gap-[1rem] items-center">
                    <span className="big p-3 bg-green-100 text-green-700 rounded-md">Тренажёр активирован</span>
                    <span className="small text-(--color-gray-black)">
                        {portalProfile.fullName}
                        {portalProfile.organizationLabel ? `, ${portalProfile.organizationLabel}` : ""}
                    </span>
                    <Button onClick={() => goTo("trainer")} className="w-full">
                        Войти в тренажёр
                    </Button>
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-[1rem] w-full">
                {sessionInfo.tokenType === "session" && sessionInfo.tableCount > 0 ? (
                    <div className="flex flex-col gap-[0.5rem]">
                        <label htmlFor="tableNumber" className="block text-sm font-medium text-gray-700">
                            {"Выберите ваш стол"}
                        </label>
                        <select
                            id="tableNumber"
                            name="tableNumber"
                            value={tableNumber}
                            onChange={(event) => setTableNumber(event.target.value)}
                            className="input-wrapper w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {Array.from({ length: sessionInfo.tableCount }, (_, index) => {
                                const value = String(index + 1);
                                return (
                                    <option key={value} value={value}>
                                        {"Стол"} {value}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                ) : (
                    <div className="flex flex-col gap-[0.5rem] rounded-[24px] border border-(--color-gray-plus) p-[1rem]">
                        <span className="big">{portalProfile.fullName}</span>
                        <span className="small text-(--color-gray-black)">
                            {portalProfile.organizationLabel || "\u041e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044f \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430"}
                        </span>
                    </div>
                )}

                <Button onClick={activatePortalAccess} disabled={isLoading}>
                    {isLoading ? "\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0430\u0435\u043c..." : "\u0412\u043e\u0439\u0442\u0438 \u0432 \u0442\u0440\u0435\u043d\u0430\u0436\u0435\u0440"}
                </Button>
            </div>
        );
    };

    return (
        <>
            <Header>
                <Header.Heading>МАЯК ОКО</Header.Heading>
                <Button
                    icon
                    onClick={() => {
                        sessionStorage.setItem("currentPage", "mayakOko");
                        goTo("mayakOko");
                    }}
                >
                    <CloseIcon />
                </Button>
            </Header>

            <div className="hero" style={{ placeItems: "center" }}>
                <div className="flex flex-col gap-[1.6rem] items-center h-full col-span-4 col-start-5 col-end-9">
                    <h3>Настройки</h3>

                    <div className="flex flex-col gap-[0.75rem] w-full">
                        <div className="flex flex-col gap-[0.5rem]">
                            <span className="big">Данные токена</span>
                            <p className="small text-(--color-gray-black)">
                                Это ваш токен доступа. Он открывает сценарий МАЯК, а личные данные и история прохождений теперь берутся из аккаунта портала.
                            </p>
                            {sessionInfo.tokenType === "session" && sessionInfo.sessionName ? (
                                <p className="small text-(--color-gray-black)">
                                    Сессионный вход: <b>{sessionInfo.sessionName}</b>. После входа нужно выбрать стол.
                                </p>
                            ) : null}
                        </div>

                        <Input
                            placeholder="Введите ваш токен"
                            value={token}
                            onChange={(event) => {
                                const nextToken = event.target.value;
                                setToken(nextToken);
                                setTokenError("");
                                setShowNotification(false);
                                setIsTokenValid(false);
                                setIsDevBypass(false);
                                setIsGuestMode(false);
                                setBypassPassword("");
                                setBypassPasswordError("");
                                setGuestForm(EMPTY_GUEST_FORM);
                                setGuestFormError("");
                                setHasRegisteredUser(false);
                            }}
                        />

                        {isValidating ? <span className="small text-blue-600 block text-center">Проверка токена...</span> : null}

                        {showNotification && isDevBypass ? (
                            <div className="flex flex-col gap-[1rem] items-center">
                                <span className="big p-3 bg-green-100 text-green-700 rounded-md block text-center">
                                    Локальный вход доступен. Для входа подтвердите пароль администратора.
                                </span>
                                <Input
                                    type="password"
                                    placeholder="Пароль администратора"
                                    value={bypassPassword}
                                    onChange={(event) => {
                                        setBypassPassword(event.target.value);
                                        setBypassPasswordError("");
                                    }}
                                />
                                {bypassPasswordError ? <span className="small text-red-600 block text-center">{bypassPasswordError}</span> : null}
                                <Button onClick={enterWithDevBypass} className="w-full">
                                    Войти в тренажёр
                                </Button>
                            </div>
                        ) : null}

                        {tokenError && !showNotification && !isValidating ? (
                            <span className="big p-3 bg-red-100 text-red-700 rounded-md block text-center">{tokenError}</span>
                        ) : null}

                        {isTokenValid && !isDevBypass && usageLimit > 0 ? (
                            <div className="flex flex-col gap-[0.25rem]">
                                <span className={getRangeClass(tokenRemainingAttempts)}>
                                    {tokenRemainingAttempts}/{usageLimit}
                                </span>
                                <meter id="meter-my" min="0" max={usageLimit} low="30" high="80" optimum="100" value={tokenRemainingAttempts} className={getRangeClass(tokenRemainingAttempts)} />
                            </div>
                        ) : null}
                    </div>

                    {renderPortalGate()}
                </div>
            </div>
        </>
    );
}
