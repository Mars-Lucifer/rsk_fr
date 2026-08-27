import { useState } from "react";
import { useRouter } from "next/router";

import Layout from "@/components/layout/Layout";
import TransitionWrapper from "@/components/layout/TransitionWrapper";
import { getCachedPortalProfilePayload, isMissingPortalProfilePayload } from "@/lib/portalProfileClient";
import { resolveProfilePayloadForRequest } from "@/lib/portalProfileServer";

import IndexPage from "@/components/pages/profile/index";
import FolderPage from "@/components/pages/profile/workfolder";

// Профиль отдаём с сервера уже заполненным: клиентский запрос занимал около
// секунды, и всё это время на месте страницы висело «Загружаем профиль...».
export async function getServerSideProps({ req }) {
    const initialProfile = await resolveProfilePayloadForRequest(req);
    return { props: { initialProfile: initialProfile || null } };
}

export default function ProfilePage({ initialProfile }) {
    const router = useRouter();
    const [currentPageKey, setCurrentPageKey] = useState(() => {
        const cachedPayload = getCachedPortalProfilePayload();
        return isMissingPortalProfilePayload(cachedPayload) ? "settings" : "profile";
    });
    const pageKey = router.isReady && router.query.tab === "settings" ? "settings" : currentPageKey;

    const goTo = (pageName) => {
        setCurrentPageKey(pageName);
    };

    // Отдельного экрана настроек больше нет: профиль и правка — одна и та же
    // форма, ключ "settings" лишь открывает её сразу разблокированной.
    return (
        <Layout>
            <TransitionWrapper currentKey={pageKey === "workfolder" ? "workfolder" : "profile"}>
                {pageKey === "workfolder" ? <FolderPage goTo={goTo} /> : <IndexPage goTo={goTo} initialEditing={pageKey === "settings"} initialProfile={initialProfile} />}
            </TransitionWrapper>
        </Layout>
    );
}
