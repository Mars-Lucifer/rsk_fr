import { useEffect, useState } from "react";

import { STATIC_MAYAK_DATA } from "../../../../../data/mayakDataConst";
import { getUserFromCookies } from "../actions";

function mergeMayakRuntimeData(serverData) {
    const serverDefaultTypes = Array.isArray(serverData?.defaultTypes) ? serverData.defaultTypes : [];
    const serverMisc = serverDefaultTypes.find((type) => type?.key === "misc");
    const defaultTypes = STATIC_MAYAK_DATA.defaultTypes.map((type) => {
        if (type.key !== "misc" || !Array.isArray(serverMisc?.subCategories)) {
            return type;
        }

        return {
            ...type,
            subCategories: serverMisc.subCategories,
        };
    });

    return {
        ...STATIC_MAYAK_DATA,
        defaultTypes,
        defaultLinks: serverData?.defaultLinks || {},
    };
}

export const useMayakRuntimeData = () => {
    const [mayakData, setMayakData] = useState({ ...STATIC_MAYAK_DATA, defaultLinks: {} });
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [errorData, setErrorData] = useState(null);

    useEffect(() => {
        sessionStorage.setItem("currentPage", "trainer");
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            setErrorData(null);
            try {
                const response = await fetch("/api/mayak/content-data");
                if (!response.ok) {
                    throw new Error("Не удалось загрузить ссылки для тренажера");
                }
                const serverData = await response.json();
                setMayakData(mergeMayakRuntimeData(serverData));
            } catch (err) {
                setErrorData(err.message);
                setMayakData({ ...STATIC_MAYAK_DATA, defaultLinks: {} });
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, []);

    const activeUser = getUserFromCookies();

    return {
        activeUser,
        activeUserId: activeUser?.id || "anonymous",
        activeUserName: activeUser?.name || "Участник",
        sessionId: activeUser?.sessionId || null,
        tableNumber: activeUser?.tableNumber || "",
        tokenType: activeUser?.tokenType || "legacy",
        errorData,
        isLoadingData,
        mayakData,
    };
};
