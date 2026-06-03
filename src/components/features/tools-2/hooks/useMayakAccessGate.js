import { useEffect, useState } from "react";

import { getKeyFromCookies, getUserFromCookies } from "../actions";

const MAYAK_GUEST_SUFFIX = "aaaaa";
const MAYAK_TEMP_GUEST_TOKEN = "aaaaa";

function normalizeMayakToken(rawToken) {
    const token = String(rawToken || "").trim();
    if (!token) {
        return "";
    }

    if (token.toLowerCase() === MAYAK_TEMP_GUEST_TOKEN) {
        return MAYAK_TEMP_GUEST_TOKEN;
    }

    if (token.toLowerCase().endsWith(MAYAK_GUEST_SUFFIX)) {
        return token.slice(0, -MAYAK_GUEST_SUFFIX.length).trim();
    }

    return token;
}

export const useMayakAccessGate = ({ getStorageKey, goTo }) => {
    const [isTokenValid, setIsTokenValid] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [tokenTaskRange, setTokenTaskRange] = useState(null);
    const [tokenSectionId, setTokenSectionId] = useState(null);
    const [sessionStartTime, setSessionStartTime] = useState(null);

    useEffect(() => {
        async function checkToken() {
            const keyInCookies = await getKeyFromCookies();
            const token = normalizeMayakToken(keyInCookies?.text);
            const activeUser = getUserFromCookies();

            if (!token || !activeUser?.id) {
                goTo("settings");
                return;
            }

            try {
                const response = await fetch(`/api/mayak/validate-token?token=${encodeURIComponent(token)}`);
                const data = await response.json();

                if (!(data.valid || (data.isExhausted && data.isActive))) {
                    goTo("settings");
                    return;
                }

                if ((data.tokenType || "legacy") === "session") {
                    const matchesSession =
                        activeUser.tokenType === "session" &&
                        String(activeUser.sessionId || "") === String(data.sessionId || "") &&
                        Boolean(String(activeUser.tableNumber || "").trim());

                    if (!matchesSession) {
                        goTo("settings");
                        return;
                    }
                }

                let isAuthenticatedAdminBypass = false;
                if (data.isBypass) {
                    const adminResponse = await fetch("/api/admin/mayak-auth");
                    const adminData = await adminResponse.json().catch(() => ({}));
                    isAuthenticatedAdminBypass = Boolean(adminResponse.ok && adminData.authenticated);
                    if (!isAuthenticatedAdminBypass) {
                        goTo("settings");
                        return;
                    }
                }

                setIsTokenValid(true);
                setIsAdmin(isAuthenticatedAdminBypass);

                const existingSessionStartTime = localStorage.getItem(getStorageKey("sessionStartTime"));
                if (!existingSessionStartTime) {
                    const nextSessionStartTime = Date.now().toString();
                    localStorage.setItem(getStorageKey("sessionStartTime"), nextSessionStartTime);
                    localStorage.removeItem(getStorageKey("session_tasks_log"));
                    setSessionStartTime(nextSessionStartTime);
                } else {
                    setSessionStartTime(existingSessionStartTime);
                }

                if (data.sectionId) {
                    setTokenSectionId(data.sectionId);
                }
                if (data.taskRange) {
                    setTokenTaskRange(data.taskRange);
                }
            } catch (error) {
                console.error("Ошибка проверки токена:", error);
                goTo("settings");
            }
        }

        checkToken();
    }, [getStorageKey, goTo]);

    return {
        isAdmin,
        isTokenValid,
        tokenTaskRange,
        tokenSectionId,
        sessionStartTime,
    };
};
