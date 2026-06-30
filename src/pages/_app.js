import "@/styles/globals.css";

import { useEffect } from "react";
import { useRouter } from "next/router";

import { saveUserData } from "@/utils/auth";
import { clearPortalAuthReturnPath, consumePortalAuthReturnPath, getPortalAuthReturnPath } from "@/lib/portalAuthReturn";
import { fetchPortalProfileClient, primePortalProfileCache } from "@/lib/portalProfileClient";

export default function App({ Component, pageProps }) {
    const router = useRouter();

    useEffect(() => {
        if (!router.isReady || router.pathname === "/auth") {
            return;
        }

        const syncOAuthSession = async () => {
            const pendingReturnPath = getPortalAuthReturnPath();
            if (!pendingReturnPath) {
                return;
            }

            try {
                const payload = await fetchPortalProfileClient({ force: true });
                if (!payload) {
                    clearPortalAuthReturnPath();
                    return;
                }

                primePortalProfileCache(payload);
                const userInfo = {
                    email: payload?.data?.email,
                    username: payload?.data?.NameIRL,
                };
                if (userInfo.email || userInfo.username) {
                    await saveUserData(userInfo);
                }

                const nextPath = consumePortalAuthReturnPath();
                if (nextPath && router.asPath !== nextPath) {
                    router.replace(nextPath);
                }
            } catch (error) {
                clearPortalAuthReturnPath();
                console.error("App: Error syncing session:", error);
            }
        };

        syncOAuthSession();
    }, [router.asPath, router.isReady, router.pathname, router]);

    return <Component {...pageProps} />;
    return <Component {...pageProps} />;
}
