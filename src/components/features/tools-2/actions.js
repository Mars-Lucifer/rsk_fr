// app/actions.js

export async function getKeyFromCookies() {
    const cookieString = document.cookie;
    const cookies = cookieString.split(";").reduce((acc, cookie) => {
        const [name, value] = cookie.trim().split("=");
        acc[name] = decodeURIComponent(value);
        return acc;
    }, {});

    const keyCookie = cookies["activated_key"];
    if (!keyCookie) return null;

    try {
        return JSON.parse(keyCookie);
    } catch {
        return null;
    }
}

export async function addKeyToCookies(text) {
    const newItem = {
        id: Date.now().toString(),
        text,
    };
    const expires = new Date();
    expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
    document.cookie = `activated_key=${encodeURIComponent(JSON.stringify(newItem))}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

export async function addUserToCookies(userId, text, meta = {}) {
    const newItem = {
        id: userId,
        name: text,
        ...meta,
    };

    const expires = new Date();
    expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
    document.cookie = `active_user=${encodeURIComponent(JSON.stringify(newItem))}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

export function getUserFromCookies() {
    const cookieString = document.cookie;
    const cookies = cookieString.split(";").reduce((acc, cookie) => {
        const [name, value] = cookie.trim().split("=");
        acc[name] = value ? decodeURIComponent(value) : "";
        return acc;
    }, {});

    const userCookie = cookies["active_user"];
    if (!userCookie) return null;

    try {
        return JSON.parse(userCookie);
    } catch {
        return { id: "unknown", name: userCookie };
    }
}

export async function removeKeyCookie() {
    document.cookie = "activated_key=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
}

export async function clearUserCookie() {
    document.cookie = "active_user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
}
