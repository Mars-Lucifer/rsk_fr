import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import { clearUserData, saveUserData } from "@/utils/auth";

export default function LocalProfileMockSwitcher() {
    const [profiles, setProfiles] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState("");
    const [loading, setLoading] = useState(true);
    const [switching, setSwitching] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadProfiles() {
            try {
                const response = await fetch("/api/profile/mock-users", {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                });

                if (!response.ok) {
                    if (!cancelled) {
                        setProfiles([]);
                        setLoading(false);
                    }
                    return;
                }

                const payload = await response.json().catch(() => ({}));
                const nextProfiles = Array.isArray(payload?.data) ? payload.data : [];

                if (!cancelled) {
                    setProfiles(nextProfiles);
                    setSelectedUserId(nextProfiles.find((profile) => profile.active)?.userId || nextProfiles[0]?.userId || "");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadProfiles();

        return () => {
            cancelled = true;
        };
    }, []);

    if (!loading && profiles.length === 0) {
        return null;
    }

    const activeProfile = profiles.find((profile) => profile.active) || null;

    const handleSwitch = async () => {
        if (!selectedUserId || selectedUserId === activeProfile?.userId) {
            return;
        }

        setSwitching(true);
        try {
            const response = await fetch("/api/profile/mock-users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ userId: selectedUserId }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || "Не удалось переключить тестовый профиль");
            }

            const nextProfile = payload?.data?.data || {};
            saveUserData({
                email: nextProfile.email || "",
                username: nextProfile.NameIRL || nextProfile.username || "",
                firstName: nextProfile.NameIRL || "",
                lastName: nextProfile.Surname || "",
                patronymic: nextProfile.Patronymic || "",
            });
            window.location.reload();
        } catch (error) {
            alert(error.message || "Не удалось переключить тестовый профиль");
        } finally {
            setSwitching(false);
        }
    };

    const handleLocalLogout = async () => {
        setLoggingOut(true);
        try {
            const response = await fetch("/api/profile/mock-users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ action: "logout" }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || "Не удалось выйти из локального профиля");
            }

            clearUserData();
            window.location.href = "/auth?localMock=off";
        } catch (error) {
            alert(error.message || "Не удалось выйти из локального профиля");
            setLoggingOut(false);
        }
    };

    return (
        <div className="block-wrapper col-span-12 max-[900px]:col-span-12">
            <div className="flex items-center justify-between gap-[0.75rem] flex-wrap">
                <div className="flex flex-col gap-[0.25rem]">
                    <h6>Локальные тестовые профили</h6>
                    <p className="small text-(--color-gray-black)">
                        Переключение активного тестового пользователя для полной проверки сценария. Работает только в
                        локальной среде разработки.
                    </p>
                </div>
                {activeProfile ? <span className="small text-(--color-gray-black)">Активен: {activeProfile.fullName || activeProfile.userId}</span> : null}
            </div>

            <div className="mt-[1rem] flex gap-[0.75rem] flex-wrap items-center">
                <select
                    value={selectedUserId}
                    onChange={(event) => setSelectedUserId(event.target.value)}
                    className="input-wrapper min-w-[260px] px-4 py-2">
                    {profiles.map((profile) => (
                        <option key={profile.userId} value={profile.userId}>
                            {`${profile.fullName || profile.userId} (${profile.userId})`}
                        </option>
                    ))}
                </select>

                <Button
                    small
                    onClick={handleSwitch}
                    disabled={switching || !selectedUserId || selectedUserId === activeProfile?.userId}>
                    {switching ? "Переключаем..." : "Переключить профиль"}
                </Button>

                <Button
                    small
                    inverted
                    roundeful
                    className="w-fit! border border-(--color-gray-plus) shadow-none!"
                    onClick={handleLocalLogout}
                    disabled={loggingOut}>
                    {loggingOut ? "Выходим..." : "Выйти из локального профиля"}
                </Button>
            </div>
        </div>
    );
}
