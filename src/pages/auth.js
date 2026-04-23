import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import Layout from "@/components/layout/Layout";
import Header from "@/components/layout/Header";
import PortalAuthFlow from "@/components/features/auth/PortalAuthFlow";
import LocalProfileMockSwitcher from "@/components/pages/profile/LocalProfileMockSwitcher";
import { clearUserData, saveUserData } from "@/utils/auth";
import { consumePortalAuthReturnPath } from "@/lib/portalAuthReturn";
import {
    fetchPortalProfileClient,
    hasResolvedPortalProfileCache,
    isMissingPortalProfilePayload,
    primePortalProfileCache,
} from "@/lib/portalProfileClient";

export default function AuthPage() {
    const router = useRouter();
    const [isSessionChecking, setIsSessionChecking] = useState(() => !hasResolvedPortalProfileCache());
    const isLocalMockLogoutMode = router.isReady && router.query.localMock === "off";

    useEffect(() => {
        if (!router.isReady) {
            return;
        }

        if (isLocalMockLogoutMode) {
            clearUserData();
            return;
        }

        let isCancelled = false;

        const bootstrapPortalSession = async () => {
            try {
                const payload = await fetchPortalProfileClient({ force: true });
                if (!payload) {
                    clearUserData();
                    if (!isCancelled) {
                        setIsSessionChecking(false);
                    }
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
                const fallbackPath = isMissingPortalProfilePayload(payload) ? "/profile?tab=settings" : "/profile";
                if (!isCancelled) {
                    router.replace(nextPath || fallbackPath);
                }
            } catch (error) {
                console.error("Auth page session bootstrap failed:", error);
                clearUserData();
                if (!isCancelled) {
                    setIsSessionChecking(false);
                }
            }
        };

        bootstrapPortalSession();

        return () => {
            isCancelled = true;
        };
    }, [isLocalMockLogoutMode, router]);

    return (
        <Layout>
            <Header className="flex items-center w-full">
                <div className="max-[640px]:flex-1 flex-none flex justify-start" />
            </Header>

            <div className="hero" style={{ placeItems: "center" }}>
                <div className="auth_cntr col-span-4 w-full flex flex-col justify-center">
                    {isLocalMockLogoutMode ? (
                        <>
                            <PortalAuthFlow className="w-full" />
                            <LocalProfileMockSwitcher />
                        </>
                    ) : isSessionChecking ? (
                        <div className="flex flex-col gap-[0.75rem] items-center text-center">
                            <h3>Проверяем сессию</h3>
                            <p className="text-(--color-gray-black)">Если вы уже вошли на портале, сразу перенаправим дальше.</p>
                        </div>
                    ) : (
                        <>
                            <PortalAuthFlow className="w-full" />
                            <LocalProfileMockSwitcher />
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
}
