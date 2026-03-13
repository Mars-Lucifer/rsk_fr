import { useEffect, useState } from "react";

import { STATIC_MAYAK_DATA } from "../../../../../data/mayakDataConst";
import { getUserFromCookies } from "../actions";

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
                const linksData = await response.json();
                setMayakData({ ...STATIC_MAYAK_DATA, defaultLinks: linksData.defaultLinks || {} });
            } catch (err) {
                setErrorData(err.message);
                setMayakData({ ...STATIC_MAYAK_DATA, defaultLinks: {} });
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, []);

    const activeUser = getUserFromCookies() || { id: "anonymous", name: "Участник" };

    return {
        activeUser,
        errorData,
        isLoadingData,
        mayakData,
    };
};
