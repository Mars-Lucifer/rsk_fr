import { useState } from "react";
import { useRouter } from "next/router";

import Layout from "@/components/layout/Layout";
import TransitionWrapper from "@/components/layout/TransitionWrapper";
import { getCachedPortalProfilePayload, isMissingPortalProfilePayload } from "@/lib/portalProfileClient";

import IndexPage from "@/components/pages/profile/index";
import SettingsPage from "@/components/pages/profile/settings";
import FolderPage from "@/components/pages/profile/workfolder";

export default function ProfilePage() {
    const router = useRouter();
    const [currentPageKey, setCurrentPageKey] = useState(() => {
        const cachedPayload = getCachedPortalProfilePayload();
        return isMissingPortalProfilePayload(cachedPayload) ? "settings" : "profile";
    });
    const pageKey = router.isReady && router.query.tab === "settings" ? "settings" : currentPageKey;

    const goTo = (pageName) => {
        setCurrentPageKey(pageName);
    };

    return (
        <Layout>
            <TransitionWrapper currentKey={pageKey}>
                {pageKey === "profile" && <IndexPage goTo={goTo} />}
                {pageKey === "settings" && <SettingsPage goTo={goTo} />}
                {pageKey === "workfolder" && <FolderPage goTo={goTo} />}
            </TransitionWrapper>
        </Layout>
    );
}
