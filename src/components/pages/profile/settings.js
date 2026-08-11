import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Setts from "@/assets/general/setts.svg";
import PortalProfileEditor from "@/components/features/auth/PortalProfileEditor";
import { fetchPortalProfileClient } from "@/lib/portalProfileClient";

const PROFILE_LOADING_LABEL = "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043F\u0440\u043E\u0444\u0438\u043B\u044C...";
const PROFILE_EMPTY_LABEL = "\u041D\u0435\u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043E";
const SETTINGS_LABEL = "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438";
const PROFILE_TITLE = "Профиль";
const SAVE_PROFILE_LABEL = "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F";

export default function SettingsPage({ goTo }) {
    const router = useRouter();
    const [userData, setUserData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isCancelled = false;

        const loadProfile = async () => {
            try {
                const payload = await fetchPortalProfileClient({ force: true });
                if (!payload) {
                    router.push("/auth");
                    return;
                }

                if (!isCancelled) {
                    setUserData(payload);
                }
            } catch (error) {
                console.error("Failed to load profile settings:", error);
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadProfile();
        return () => {
            isCancelled = true;
        };
    }, [router]);

    if (isLoading) {
        return <div className="hero grid-cols-1 place-items-center text-(--color-gray-black)">{PROFILE_LOADING_LABEL}</div>;
    }

    if (!userData) {
        return null;
    }

    const profileName = userData.data.NameIRL && userData.data.Surname ? `${userData.data.NameIRL} ${userData.data.Surname}` : PROFILE_EMPTY_LABEL;

    return (
        <>
            <Header>
                <Header.Heading>
                    {profileName}
                    <span className="text-(--color-gray-black)">/</span> {SETTINGS_LABEL}
                </Header.Heading>
                {/* Возврат к просмотру: раньше здесь была та же безымянная
                    шестерёнка, что и на карточке профиля, и понять, куда она
                    ведёт, было нельзя. */}
                <Button inverted className={"w-fit! shadow-none!"} onClick={() => goTo("profile")}>
                    Вернуться к профилю
                </Button>
            </Header>

            <PortalProfileEditor
                mode="full"
                profilePayload={userData}
                title={PROFILE_TITLE}
                showRole
                submitLabel={SAVE_PROFILE_LABEL}
                onSaved={(payload) => {
                    setUserData(payload);
                }}
            />
        </>
    );
}
