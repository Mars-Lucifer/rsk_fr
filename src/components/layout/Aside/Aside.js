import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";

import { useUserData } from "@/utils/auth";
import Button from "@/components/ui/Button";
import { useNavLinks, NavItem } from "./Nav";

const AuthIcon = dynamic(() => import("@/assets/nav/auth.svg"), { ssr: false });
const Burger = dynamic(() => import("@/assets/nav/burger.svg"), { ssr: false });
const Telegram = dynamic(() => import("@/assets/general/tg.svg"), { ssr: false });

function getScreenType() {
    if (typeof window === "undefined") return null;
    const width = window.innerWidth;
    if (width < 640) return "mobile";
    if (width < 900) return "tablet";
    return "desktop";
}

export default function Aside({ isMobileOpen, closeMobile }) {
    const router = useRouter();
    const userData = useUserData();
    const { navLinks, isLoading } = useNavLinks();

    const initialCollapsed = Cookies.get("sidebarCollapsed") === "true";
    const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
    const [hovered, setHovered] = useState(null);
    const [screenType, setScreenType] = useState(getScreenType); // 'mobile', 'tablet' или 'desktop'

    useEffect(() => {
        const handleResize = () => {
            setScreenType(getScreenType());
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const toggleSidebar = () => {
        setIsCollapsed((c) => {
            const next = !c;
            Cookies.set("sidebarCollapsed", String(next), { path: "/", expires: 7 });
            return next;
        });
    };

    const springTransition = { type: "spring", stiffness: 200, damping: 30 };

    
    const asideVariants = {
        expanded: { width: Math.max(160, window.innerWidth * 0.16), x: 0 },
        collapsed: { width: 104, x: 0 }, // 6.5rem = 104px
        tabletCollapsed: { width: 80, x: 0 }, // 5rem = 80px
        mobileOpen: { x: 0, width: 280 },
        mobileClosed: { x: "-100%", width: 280 },
    };

    
    const getVariant = () => {
        if (screenType === null) return "mobileClosed";

        if (screenType === "mobile") {
            return isMobileOpen ? "mobileOpen" : "mobileClosed";
        }

        if (isCollapsed) {
            return screenType === "tablet" ? "tabletCollapsed" : "collapsed";
        }

        return "expanded";
    };

    
    if (screenType === null) {
        return (
            <aside
                className={`mayak-sidebar ${isCollapsed ? "mayak-sidebar-collapsed" : "mayak-sidebar-expanded"} overflow-hidden bg-white max-[640px]:fixed max-[640px]:z-[100] max-[640px]:h-full max-[640px]:left-0 max-[640px]:top-0 max-[640px]:-translate-x-full sm:relative`}
                style={{
                    width: isCollapsed ? (typeof window !== "undefined" && window.innerWidth < 900 ? "5rem" : "6.5rem") : "var(--aside-expanded)",
                }}
            />
        );
    }

    return (
        <>
            <AnimatePresence>{isMobileOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeMobile} className="fixed inset-0 bg-black/40 z-[90] sm:hidden" />}</AnimatePresence>

            <motion.aside
                initial={false}
                animate={getVariant()}
                variants={asideVariants}
                transition={springTransition}
                className={`mayak-sidebar ${isCollapsed && screenType === "desktop" ? "mayak-sidebar-collapsed" : "mayak-sidebar-expanded"} overflow-hidden bg-white max-[640px]:fixed max-[640px]:z-[100] max-[640px]:h-full max-[640px]:left-0 max-[640px]:top-0 sm:relative sm:translate-x-0`}>
                {/* ЛОГОТИП И БУРГЕР */}
                <div
                    className={`logo-container grid items-center gap-3 ${isCollapsed && screenType !== "mobile" ? "justify-center" : ""}`}
                    style={{ gridTemplateColumns: !isCollapsed || screenType === "mobile" ? "minmax(0, 1fr) 2rem" : "2rem" }}
                >
                    <AnimatePresence mode="wait">
                        {(!isCollapsed || screenType === "mobile") && (
                            <motion.div key="logo" initial={false} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="min-w-0 flex flex-1 justify-start">
                                <div className="relative h-[120px] w-[228px] max-[900px]:h-[72px] max-[900px]:w-[138px]">
                                    <Image src="/images/logo.png" alt="logo" fill priority sizes="(max-width: 900px) 138px, 228px" className="object-contain" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div className="z-[2] flex h-[2rem] w-[2rem] items-center justify-center justify-self-end">
                        <Burger onClick={screenType === "mobile" ? closeMobile : toggleSidebar} className="cursor-pointer flex-shrink-0 w-[1.25rem] h-[1.25rem]" />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center h-20">{(!isCollapsed || screenType === "mobile") && <span>Загрузка...</span>}</div>
                ) : (
                    <>
                        <nav className="flex-1">
                            {navLinks.map((item) => (
                                <NavItem
                                    key={item.label}
                                    {...item}
                                    screenType={screenType} 
                                    isCollapsed={screenType === "mobile" ? false : isCollapsed}
                                    onHover={setHovered}
                                    isHovered={hovered === item.label} 
                                />
                            ))}
                        </nav>

                        <div className="flex flex-col gap-1">
                            <Button inverted className={`bg-(--color-blue-noise)! text-(--color-blue)! ${isCollapsed && screenType !== "mobile" ? "!p-[1rem]" : ""}`} onClick={() => window.open("https://t.me/rskfed", "_blank")}>
                                <Telegram className="h-[1.375rem] flex-shrink-0" />
                                {(!isCollapsed || screenType === "mobile") && <span className="ml-2">Наш телеграмм</span>}
                            </Button>

                            {userData ? (
                                <div className="flex gap-[0.75rem] items-center h-[2.5rem] mt-4 cursor-pointer" onClick={() => router.push("/profile")}>
                                    <div className="h-full rounded-[0.5rem] aspect-square bg-(--color-black) flex-shrink-0" />
                                    {(!isCollapsed || screenType === "mobile") && (
                                        <motion.div initial={false} animate={{ opacity: 1, x: 0 }} className="flex flex-col truncate">
                                            <span className="text-sm font-bold truncate">{userData.username || "User"}</span>
                                            <span className="text-xs opacity-50 truncate">{userData.email}</span>
                                        </motion.div>
                                    )}
                                </div>
                            ) : (
                                <Button inverted roundeful className={`auth mt-4 ${isCollapsed && screenType !== "mobile" ? "!p-[1rem]" : ""}`} onClick={() => router.push("/auth")}>
                                    <AnimatePresence mode="wait">
                                        {!isCollapsed || screenType === "mobile" ? (
                                            <motion.span key="full" initial={false} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                                Авторизация
                                            </motion.span>
                                        ) : (
                                            <motion.span key="icon" initial={false} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                                                <AuthIcon className="w-[1.25rem] h-[1.25rem] flex-shrink-0" />
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </motion.aside>
        </>
    );
}
