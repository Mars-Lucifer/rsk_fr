import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";
import { useState, useEffect, useMemo } from "react";
import { getCookie, setCookie, clearCookies } from "@/utils/cookies";
import { useProfile } from "@/hooks/fetchProfile";

const DownIcon = dynamic(() => import("@/assets/general/down.svg"));

const BASE_NAV_LINKS = [
    { label: "Главная", disable: false, login: false, learn: false, href: "/", icon: dynamic(() => import("@/assets/nav/home.svg")) },
    // Конкурс — главный раздел участника, поэтому идёт сразу после «Главной».
    // Это тот же /cours: отдельного раздела под конкурс не заводим.
    { label: "Конкурс", disable: false, login: true, learn: false, href: "/cours", icon: dynamic(() => import("@/assets/nav/cours.svg")) },
    {
        label: "Команды",
        disable: false,
        login: true,
        learn: true,
        href: "#",
        icon: dynamic(() => import("@/assets/nav/team.svg")),
        submenu: [
            { label: "Список команд", href: "/teams" },
            { label: "Моя команда", href: "/teams/my" },
        ],
    },
    { label: "Организации", disable: false, login: true, learn: false, href: "/organizations", icon: dynamic(() => import("@/assets/nav/organ.svg")) },
    { label: "Проекты", disable: false, login: true, learn: true, href: "/projects", icon: dynamic(() => import("@/assets/nav/projects.svg")) },
    { label: "Маяк Око", href: "/tools/mayak-oko", login: false, learn: false, icon: dynamic(() => import("@/assets/nav/inst.svg")) },
    { label: "Тренажер МАЯК", href: "/tools/mayak-trainer#overview", login: false, learn: false, icon: dynamic(() => import("@/assets/nav/mayak-trainer.svg")) },
    {
        label: "Админ панель",
        disable: true,
        login: false,
        learn: false,
        href: "#",
        icon: dynamic(() => import("@/assets/nav/king.svg")),
        submenu: [
            { label: "Проекты", href: "/admin/projects" },
            { label: "Обучение", href: "/admin/cours" },
            { label: "Роли", href: "/admin/roleswitch" },
            { label: "MAYAK Онбординг", href: "/admin/mayak-onboarding" },
        ],
    },
];

export function useNavLinks() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const { data: profileData, fetchProfile } = useProfile();

    const role = profileData?.Type || getCookie("role");
    const navLinks = useMemo(
        () =>
            BASE_NAV_LINKS.map((link) => {
                const updatedLink = { ...link };
                if (link.label === "Админ панель") {
                    updatedLink.disable = role !== "moder" && role !== "admin";
                }
                return updatedLink;
            }),
        [role]
    );

    useEffect(() => {
        const checkAuthAndRole = async () => {
            const userData = getCookie("userData");
            const existingRole = getCookie("role");
            const existingLearn = getCookie("learn");

            if (!userData) {
                setIsLoading(false);
                return;
            }

            if (existingRole && existingLearn !== null) {
                setIsLoading(false);
                return;
            }

            await fetchProfile();
        };

        checkAuthAndRole();
    }, [fetchProfile]);

    useEffect(() => {
        if (!profileData) return;

        const role = profileData?.Type;
        const learn = profileData?.is_learned === true;
        const organization = profileData?.Organization?.id;

        if (!role) {
            clearCookies();
            router.push("/auth");
            return;
        }

        setCookie("role", role);
        setCookie("learn", learn);
        if (organization) {
            setCookie("organization", organization);
        }

        queueMicrotask(() => setIsLoading(false));
    }, [profileData, router]);

    return { navLinks, isLoading };
}

export function NavItem({ label, href, icon: Icon, submenu, isCollapsed, isHovered, onHover, disable, login, learn, inactive, screenType }) {
    const router = useRouter();
    const isSubmenuActive = submenu?.some(
        (item) => router.pathname === item.href || router.asPath?.split("?")[0] === item.href
    );
    const isMainActive =
        router.pathname === href || (href !== "#" && href !== "/" && router.pathname?.startsWith(href + "/"));
    const userData = getCookie("userData");
    const userLearn = getCookie("learn") === "true";

    const isInactive = inactive || (login && !userData) || (learn && !userLearn);

    if (disable) return null;

    const currentSubmenu = isInactive ? null : submenu;

    const shouldShowSubmenu = (isHovered || isSubmenuActive || (screenType && screenType !== "desktop")) && !isCollapsed;

    const handleNavClick = () => {
        if (href === "/tools/mayak-oko" && typeof window !== "undefined") {
            sessionStorage.setItem("currentPage", "mayakOko");
            sessionStorage.removeItem("previousPage");
        }
    };

    return (
        <div className={`group flex flex-col gap-[0.75rem] cursor-pointer`} onMouseEnter={() => onHover(label)} onMouseLeave={() => onHover(null)}>
            <Link
                className={`${isMainActive || isSubmenuActive ? "active" : ""} items-center ${isInactive ? "inactive pointer-events-none" : isSubmenuActive ? "opacity-100" : "opacity-30 group-hover:opacity-100"}`}
                href={isInactive ? "#" : href}
                onClick={handleNavClick}>
                <Icon className="w-[1.375rem] h-[1.375rem] max-[900px]:w-[1.25rem] max-[900px]:h-[1.25rem]" />
                <AnimatePresence>
                    {!isCollapsed && (
                        <motion.span initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="whitespace-nowrap">
                            {label}
                        </motion.span>
                    )}
                </AnimatePresence>
                {currentSubmenu && shouldShowSubmenu && <DownIcon className={`ml-auto ${shouldShowSubmenu ? "rotate-180" : ""} transition-transform`} />}
            </Link>

            <AnimatePresence mode="wait">
                {currentSubmenu && shouldShowSubmenu && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ type: "spring", stiffness: 200, damping: 30 }} className="submenu overflow-hidden">
                        <div className="w-[1.5px] h-full bg-(--color-gray-plus)"></div>
                        <div className="submenu-items w-full">
                            {currentSubmenu.map((item) => (
                                <Link key={item.label} href={item.href} className={`${router.pathname === item.href ? "active" : ""} opacity-30 hover:opacity-100`}>
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export const NAV_LINKS = BASE_NAV_LINKS;
