import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import Button from "@/components/ui/Button";
import Header from "@/components/layout/Header";
// import MayakDelegatedAdminPanel from "@/components/pages/profile/MayakDelegatedAdminPanel";
import PortalProfileEditor from "@/components/features/auth/PortalProfileEditor";
import LinkIcon from "@/assets/general/link.svg";

// Карандаш рисуем на месте: в наборе иконок его нет, а заводить ассет ради
// одной кнопки дороже, чем шесть строк разметки.
function PencilIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M11.3 2.7a1.7 1.7 0 0 1 2.4 2.4l-7.5 7.5-3.2.8.8-3.2 7.5-7.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
import { getPortalOrganizationId, getPortalOrganizationLabel } from "@/lib/portalProfile";
import { fetchPortalProfileClient, isMissingPortalProfilePayload, primePortalProfileCache } from "@/lib/portalProfileClient";
import { saveUserData } from "@/utils/auth";

const PROFILE_EMPTY_LABEL = "\u041D\u0435\u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043E";
const ORGANIZATION_EMPTY_LABEL = "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442";
const PROFILE_LOADING_LABEL = "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043F\u0440\u043E\u0444\u0438\u043B\u044C...";
const LOGOUT_CONFIRM_LABEL = "\u0412\u044B \u0443\u0432\u0435\u0440\u0435\u043D\u044B, \u0447\u0442\u043E \u0445\u043E\u0442\u0438\u0442\u0435 \u0432\u044B\u0439\u0442\u0438?";
const SAVE_PROFILE_LABEL = "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F";
// \u0411\u043B\u043E\u043A \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u043E\u0432 \u041C\u0410\u042F\u041A \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0441\u043D\u044F\u0442 \u0441\u043E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B, \u0441\u043C. \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u0443 \u0440\u0430\u0437\u043C\u0435\u0442\u043A\u0438.
const SHOW_MAYAK_MATERIALS = false;

const MAYAK_FILE_LABELS = {
    certificate: "Сертификат",
    log: "Лог сессии",
    analytics: "Аналитический отчёт",
};

const MAYAK_FILE_ORDER = {
    certificate: 0,
    log: 1,
    analytics: 2,
};

function clearCookies() {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.slice(0, eqPos).trim() : cookie.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
}

function formatDateTime(value) {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
        return "\u0414\u0430\u0442\u0430 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430";
    }

    return parsed.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatFileSize(byteSize) {
    const size = Number(byteSize) || 0;
    if (size < 1024) {
        return `${size} \u0411`;
    }
    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} \u041a\u0411`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} \u041c\u0411`;
}

function formatAttemptsLabel(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) {
        return `${count} \u043f\u0440\u043e\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u0435`;
    }
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
        return `${count} \u043f\u0440\u043e\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u044f`;
    }
    return `${count} \u043f\u0440\u043e\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u0439`;
}

function getSortedMayakFiles(files = []) {
    return [...files].sort((left, right) => {
        const leftOrder = MAYAK_FILE_ORDER[left?.kind] ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = MAYAK_FILE_ORDER[right?.kind] ?? Number.MAX_SAFE_INTEGER;

        if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
        }

        return String(left?.fileName || "").localeCompare(String(right?.fileName || ""), "ru");
    });
}

function sortMayakArtifactsNewestFirst(items = []) {
    return [...items].sort((left, right) => {
        const leftDate = new Date(left?.completedAt || left?.createdAt || 0).getTime();
        const rightDate = new Date(right?.completedAt || right?.createdAt || 0).getTime();
        return rightDate - leftDate;
    });
}

export default function ProfileIndexPage({ goTo, initialEditing = false, initialProfile = null }) {
    // Профиль приезжает с сервера: первый кадр уже с данными, дальше клиент
    // только освежает их. Заодно кладём в кэш, чтобы соседние экраны не ходили
    // за тем же ответом заново.
    const [userData, setUserData] = useState(() => {
        if (initialProfile) {
            primePortalProfileCache(initialProfile);
        }
        return initialProfile;
    });
    const [hydrated, setHydrated] = useState(Boolean(initialProfile));
    const [isEditing, setIsEditing] = useState(initialEditing || isMissingPortalProfilePayload(initialProfile));

    // ?tab=settings приходит после router.isReady, то есть уже вторым рендером —
    // начальное значение useState его не увидит.
    useEffect(() => {
        if (initialEditing) {
            setIsEditing(true);
        }
    }, [initialEditing]);
    const [mayakArtifacts, setMayakArtifacts] = useState([]);
    const [artifactsLoading, setArtifactsLoading] = useState(true);
    const [artifactsError, setArtifactsError] = useState("");
    const router = useRouter();

    useEffect(() => {
        const fetchMayakArtifacts = async () => {
            try {
                setArtifactsLoading(true);
                setArtifactsError("");

                const response = await fetch("/api/profile/mayak-artifacts", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    cache: "no-store",
                });

                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload.error || "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b \u041c\u0410\u042f\u041a");
                }

                setMayakArtifacts(sortMayakArtifactsNewestFirst(Array.isArray(payload.artifacts) ? payload.artifacts : []));
            } catch (error) {
                console.error("Mayak artifacts fetch error:", error);
                setArtifactsError(error.message || "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b \u041c\u0410\u042f\u041a");
            } finally {
                setArtifactsLoading(false);
            }
        };

        const fetchProfile = async () => {
            try {
                // Профиль уже приехал с сервера — второй запрос не нужен и
                // вреден: его ответ приходит через секунду и перезаписывает
                // форму, стирая то, что человек успел выбрать (регион слетал
                // обратно на сохранённый). Догружаем только материалы.
                if (initialProfile && !isMissingPortalProfilePayload(initialProfile)) {
                    saveUserData({
                        email: initialProfile?.data?.email || "",
                        username: initialProfile?.data?.NameIRL || initialProfile?.data?.username || "",
                        firstName: initialProfile?.data?.NameIRL || "",
                        lastName: initialProfile?.data?.Surname || "",
                        patronymic: initialProfile?.data?.Patronymic || "",
                    });
                    await fetchMayakArtifacts();
                    setHydrated(true);
                    return;
                }

                const data = await fetchPortalProfileClient({ force: true });
                if (!data) {
                    clearCookies();
                    router.push("/auth");
                    return;
                }

                if (isMissingPortalProfilePayload(data)) {
                    // Профиль без ФИО/организации сразу открываем в правке:
                    // без этих полей МАЯК не пускает дальше.
                    setUserData(data);
                    setIsEditing(true);
                    setHydrated(true);
                    return;
                }


                setUserData(data);
                saveUserData({
                    email: data?.data?.email || "",
                    username: data?.data?.NameIRL || data?.data?.username || "",
                    firstName: data?.data?.NameIRL || "",
                    lastName: data?.data?.Surname || "",
                    patronymic: data?.data?.Patronymic || "",
                });
                await fetchMayakArtifacts();
                setHydrated(true);
            } catch (error) {
                console.error("Request error:", error);
                setArtifactsLoading(false);
                setHydrated(true);
            }
        };

        fetchProfile();
    }, [goTo, router, initialProfile]);

    const handleLogout = async () => {
        const confirmed = window.confirm(LOGOUT_CONFIRM_LABEL);
        if (!confirmed) {
            return;
        }

        try {
            await fetch("/api/auth/logout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                cache: "no-store",
            });
        } catch (error) {
            console.error("Logout API error:", error);
        }

        clearCookies();
        router.push("/auth");
    };

    const handleArtifactDownload = (downloadUrl) => {
        if (!downloadUrl) {
            return;
        }

        window.open(downloadUrl, "_blank", "noopener,noreferrer");
    };

    if (!hydrated) {
        return (
            <div className="hero" style={{ placeItems: "center" }}>
                <p className="text-(--color-gray-black)">{PROFILE_LOADING_LABEL}</p>
            </div>
        );
    }

    if (!userData) {
        return null;
    }

    const profileName = userData.data.NameIRL && userData.data.Surname ? `${userData.data.NameIRL} ${userData.data.Surname}` : PROFILE_EMPTY_LABEL;
    const organizationLinkId = getPortalOrganizationId(userData);
    const organizationDisplayName = getPortalOrganizationLabel(userData);

    return (
        <>
            <Header>
                <Header.Heading>{profileName}</Header.Heading>
                <Button red className={"w-fit! shadow-none!"} onClick={handleLogout}>
                    {"\u0412\u044B\u0439\u0442\u0438"}
                </Button>
            </Header>

            {/* Предел ширины — только для профиля, .hero общий на весь портал.
                На широком мониторе форма растягивалась во всю ширину: поля по
                полметра, а глазу не за что зацепиться. */}
            <div className="w-full mx-auto" style={{ maxWidth: "80rem" }}>
            {/* Просмотр и правка — одна форма: раньше профиль показывал карточку
                с тегами, а поля жили на отдельном экране, и человек видел два
                разных представления одних и тех же данных. */}
            <PortalProfileEditor
                mode="full"
                profilePayload={userData}
                readOnly={!isEditing}
                showRole
                submitLabel={SAVE_PROFILE_LABEL}
                headerSlot={
                    <button
                        type="button"
                        onClick={() => setIsEditing((prev) => !prev)}
                        title={isEditing ? "Отменить правку" : "Редактировать профиль"}
                        className="flex items-center gap-[0.5rem] px-[0.75rem]! py-[0.5rem]! rounded-[0.5rem] shrink-0 w-fit!"
                        style={{ border: "1.5px solid var(--color-gray-plus-50)", background: "transparent", color: "var(--color-gray-black)", cursor: "pointer" }}>
                        {isEditing ? null : <PencilIcon />}
                        <span className="text-sm">{isEditing ? "Отменить" : "Редактировать"}</span>
                    </button>
                }
                onSaved={(payload) => {
                    setUserData(payload);
                    setIsEditing(false);
                }}
            />

            <div className="hero" style={{ gridTemplateRows: "repeat(3, auto)" }}>
                {/* Организация уехала в форму выше; здесь остались только ссылки
                    на карточку организации и команды. */}
                {organizationLinkId || userData.data.team_id ? (
                    <div className="block-wrapper col-span-12">
                        <h6>{"\u041F\u0435\u0440\u0435\u0445\u043E\u0434\u044B"}</h6>
                        <div className="flex flex-col gap-[0.75rem]">
                            {organizationLinkId ? (
                                <Link href={`/organizations/${organizationLinkId}`}>
                                    <div className="group cursor-pointer flex items-center justify-between gap-[1rem] w-full">
                                        {/* \u041F\u043E\u0434\u043F\u0438\u0441\u044C \u0441\u043B\u0435\u0432\u0430 \u043E\u0431\u044A\u044F\u0441\u043D\u044F\u0435\u0442, \u043A\u0443\u0434\u0430 \u0432\u0435\u0434\u0451\u0442 \u0441\u0442\u0440\u043E\u043A\u0430:
                                            \u0433\u043E\u043B\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0447\u0438\u0442\u0430\u043B\u043E\u0441\u044C \u043A\u0430\u043A \u043F\u043E\u043B\u0435 \u043F\u0440\u043E\u0444\u0438\u043B\u044F,
                                            \u0430 \u043D\u0435 \u043A\u0430\u043A \u0441\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443. */}
                                        <span className="small text-(--color-gray-black) shrink-0">{"\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438"}</span>
                                        <p className="link truncate">{organizationDisplayName || ORGANIZATION_EMPTY_LABEL}</p>
                                        <LinkIcon className="stroke-(--color-gray-white) group-hover:stroke-black shrink-0" style={{ transition: "stroke .3s ease-in-out" }} />
                                    </div>
                                </Link>
                            ) : null}

                            {userData.data.team_id ? (
                                <>
                                    {organizationLinkId ? <hr className="w-full border-solid border-[1.5px] border-(--color-gray-plus)" /> : null}

                                    <Link href={`/teams/${userData.data.team_id}`}>
                                        <div className="group cursor-pointer flex items-center justify-between gap-[1rem] w-full">
                                            <span className="small text-(--color-gray-black) shrink-0">{"\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u043A\u043E\u043C\u0430\u043D\u0434\u044B"}</span>
                                            <p className="link truncate">{userData.data.team || ORGANIZATION_EMPTY_LABEL}</p>
                                            <LinkIcon className="stroke-(--color-gray-white) group-hover:stroke-black shrink-0" style={{ transition: "stroke .3s ease-in-out" }} />
                                        </div>
                                    </Link>
                                </>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {/* Админ-права МАЯК скрыты: у обычного участника блок висит на
                    «Загружаем доступы МАЯК...» и ничем не заканчивается —
                    доступов у него нет и не будет. Разметка и сам компонент
                    оставлены целиком, включать обратно снятием комментария. */}
                {/* <MayakDelegatedAdminPanel /> */}

                {/* Материалы МАЯК скрыты до возврата к этой части: блок висел
                    пустым, потому что артефакты копятся в двух разных местах
                    (data/results.json и mayak-user-history.json), и что из них
                    показывать в профиле — ещё не решено. Разметка оставлена
                    целиком, включать обратно сменой флага выше. */}
                {SHOW_MAYAK_MATERIALS ? (
                <div className="block-wrapper col-span-12 max-[900px]:col-span-12 flex flex-col gap-[1rem]">
                    <div className="flex items-center justify-between gap-[1rem] flex-wrap">
                        <h6>{"Материалы МАЯК"}</h6>
                        {!artifactsLoading && !artifactsError && mayakArtifacts.length > 0 ? (
                            <span className="small text-(--color-gray-black)">{formatAttemptsLabel(mayakArtifacts.length)}</span>
                        ) : null}
                    </div>

                    {artifactsLoading ? <p className="text-(--color-gray-black)">{"Загружаем материалы..."}</p> : null}
                    {!artifactsLoading && artifactsError ? <p className="text-[var(--color-red)]">{artifactsError}</p> : null}

                    {!artifactsLoading && !artifactsError && mayakArtifacts.length > 0 ? (
                        <div className="flex flex-col gap-[0.75rem]">
                            {mayakArtifacts.map((artifact) => (
                                <div key={artifact.id} className="rounded-[8px] border border-(--color-gray-plus) bg-white px-4 py-4">
                                    <div className="flex flex-col gap-[0.25rem]">
                                        <span className="big">{formatDateTime(artifact.completedAt || artifact.createdAt)}</span>
                                        {artifact.role ? <span className="small text-(--color-gray-black)">{`\u0420\u043e\u043b\u044c: ${artifact.role}`}</span> : null}
                                    </div>

                                    <div className="mt-[1rem] flex flex-col gap-[0.5rem]">
                                        {getSortedMayakFiles(artifact.files || []).map((file) => (
                                            <Button
                                                key={file.id}
                                                small
                                                inverted
                                                roundeful
                                                className="w-full! border border-(--color-gray-plus) shadow-none!"
                                                onClick={() => handleArtifactDownload(file.downloadUrl)}
                                                title={
                                                    file.byteSize
                                                        ? `${MAYAK_FILE_LABELS[file.kind] || file.fileName} В· ${formatFileSize(file.byteSize)}`
                                                        : MAYAK_FILE_LABELS[file.kind] || file.fileName
                                                }
                                            >
                                                <span className="flex w-full items-center justify-between gap-[0.75rem]">
                                                    <span className="truncate">{MAYAK_FILE_LABELS[file.kind] || file.fileName}</span>
                                                    <span className="small text-(--color-gray-black) whitespace-nowrap">{file.byteSize ? formatFileSize(file.byteSize) : "\u041e\u0442\u043a\u0440\u044b\u0442\u044c"}</span>
                                                </span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
                ) : null}
            </div>
            </div>
        </>
    );
}
