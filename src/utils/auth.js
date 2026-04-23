import Cookies from "js-cookie";
import { useEffect, useState } from "react";

import { invalidatePortalProfileCache } from "@/lib/portalProfileClient";

const USER_DATA_UPDATED_EVENT = "mayak:user-data-updated";

function emitUserDataUpdated() {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(USER_DATA_UPDATED_EVENT));
    }
}

export function getUserData() {
    const cookie = Cookies.get("userData");
    if (!cookie) return null;

    try {
        return JSON.parse(cookie);
    } catch {
        return null;
    }
}

export function isAuthorized() {
    const user = getUserData();
    return !!user?.token;
}

export function saveUserData(data) {
    const current = getUserData() || {};
    const updated = { ...current, ...data, token: true };

    Cookies.set("userData", JSON.stringify(updated), {
        path: "/",
        sameSite: "strict",
        expires: 7,
    });

    emitUserDataUpdated();
    return updated;
}

export function clearUserData() {
    Cookies.remove("userData");
    invalidatePortalProfileCache();
    emitUserDataUpdated();
}

export function useUserData() {
    const [userData, setUserData] = useState(() => getUserData());

    useEffect(() => {
        const syncUserData = () => {
            setUserData(getUserData());
        };

        if (typeof window !== "undefined") {
            window.addEventListener(USER_DATA_UPDATED_EVENT, syncUserData);
            window.addEventListener("focus", syncUserData);
        }

        return () => {
            if (typeof window !== "undefined") {
                window.removeEventListener(USER_DATA_UPDATED_EVENT, syncUserData);
                window.removeEventListener("focus", syncUserData);
            }
        };
    }, []);

    return userData;
}
