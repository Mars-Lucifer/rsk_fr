import { memo } from "react";
import Block from "@/components/features/public/Block";
import Button from "@/components/ui/Button";
import LinkIcon from "@/assets/general/link.svg";
import TelegramIcon from "@/assets/general/TelegramIcon.svg";
import TopIcon from "@/assets/general/TopIcon.svg";
import HotIcon from "@/assets/general/HotIcon.svg";

const sortByOrder = (a, b) => {
    const orderA = isNaN(Number(a.order)) ? Infinity : Number(a.order);
    const orderB = isNaN(Number(b.order)) ? Infinity : Number(b.order);
    return orderA - orderB;
};

const ServiceIcon = memo(function ServiceIcon({ type }) {
    const iconProps = { className: "w-5 h-5 flex-shrink-0" };
    switch (type) {
        case "top":
            return <TopIcon {...iconProps} />;
        case "telegram":
            return <TelegramIcon {...iconProps} />;
        case "hot":
            return <HotIcon {...iconProps} />;
        default:
            return <LinkIcon {...iconProps} />;
    }
});

export default function MayakServicesPanel({
    defaultLinks,
    isMiscAccordionOpen,
    miscCategory,
    onOpenInstruction,
    openSubAccordionKey,
    setOpenSubAccordionKey,
    type,
    allowWrap = false,
}) {
    const typeLinks = (defaultLinks[type] || []).slice().sort(sortByOrder);

    const serviceContainerClass = allowWrap ? "flex flex-wrap gap-[0.5rem] transition-all duration-200 ease-out" : "flex flex-nowrap gap-[0.5rem] transition-all duration-200 ease-out";
    const serviceButtonClass = allowWrap
        ? "relative group stroke-gray-900 !flex !w-fit !flex-none !items-center !gap-2 whitespace-nowrap transition-all duration-200 ease-out"
        : "relative group stroke-gray-900 !flex !flex-1 !min-w-0 !items-center !justify-center !gap-2 transition-all duration-200 ease-out";
    const serviceLabelClass = allowWrap ? "whitespace-nowrap" : "truncate";

    return (
        <>
            <div data-tour="services" className={serviceContainerClass}>
                {!isMiscAccordionOpen &&
                    typeLinks.map((service, index) => (
                        <Button key={index} inverted className={serviceButtonClass} onClick={() => window.open(service.url, "_blank")}>
                            <ServiceIcon type={service.iconType} />
                            <span className={serviceLabelClass}>{service.name}</span>
                            {service.description && (
                                <div className="absolute bottom-full right-0 mb-2 w-max max-w-xs invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 pointer-events-none z-10">
                                    <div className="bg-white text-gray-700 text-sm rounded-lg shadow-lg px-3 py-2 text-center border border-gray-200">{service.description}</div>
                                    <div className="absolute right-4 top-full w-0 h-0 border-t-4 border-t-white border-l-4 border-l-transparent border-r-4 border-r-transparent" style={{ filter: "drop-shadow(0 -1px 1px rgb(0 0 0 / 0.05))" }}></div>
                                </div>
                            )}
                        </Button>
                    ))}
            </div>

            {miscCategory && isMiscAccordionOpen && (
                <div className="flex flex-col gap-2">
                    <Block className="flex flex-col gap-2">
                        {miscCategory.subCategories.map((subItem) => (
                            <div key={subItem.key} className="flex flex-col gap-2">
                                <Button
                                    inverted
                                    onClick={() => setOpenSubAccordionKey((prevKey) => (prevKey === subItem.key ? null : subItem.key))}
                                    className={`${openSubAccordionKey === subItem.key ? "!bg-gray-100 !text-black" : ""}`}>
                                    {subItem.label}
                                </Button>
                                {openSubAccordionKey === subItem.key &&
                                    subItem.key === "services" &&
                                    (() => {
                                        const allServices = (defaultLinks[subItem.key] || []).slice().sort(sortByOrder);
                                        const requiredServices = allServices.filter((s) => s.required !== false);
                                        const optionalServices = allServices.filter((s) => s.required === false);
                                        const renderServiceCard = (link, linkIndex) => (
                                            <div key={linkIndex} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-semibold text-sm text-gray-900">{link.name}</span>
                                                    {link.description && <span className="text-xs text-gray-500 truncate">{link.description}</span>}
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    <Button inverted className="!px-3 !py-1.5 !text-xs" disabled={!link.url} onClick={() => link.url && window.open(link.url, "_blank")}>
                                                        {link.buttonLabel || (link.url ? "Регистрация" : "Скачать")}
                                                    </Button>
                                                    {link.instructionImage && (
                                                        <Button inverted className="!px-3 !py-1.5 !text-xs" onClick={() => onOpenInstruction({ name: link.name, image: link.instructionImage })}>
                                                            Инструкция
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                        return (
                                            <div className="flex flex-col gap-4 pt-2">
                                                {requiredServices.length > 0 && (
                                                    <div className="flex flex-col gap-2">
                                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Обязательные</span>
                                                        {requiredServices.map(renderServiceCard)}
                                                    </div>
                                                )}
                                                {optionalServices.length > 0 && (
                                                    <div className="flex flex-col gap-2">
                                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Необязательные</span>
                                                        {optionalServices.map(renderServiceCard)}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                {openSubAccordionKey === subItem.key && subItem.key !== "services" && (
                                    <div className="flex flex-nowrap gap-2 pt-2 overflow-x-auto">
                                        {(defaultLinks[subItem.key] || [])
                                            .slice()
                                            .sort(sortByOrder)
                                            .map((link, linkIndex) => (
                                                <Button key={linkIndex} inverted className={serviceButtonClass} onClick={() => window.open(link.url, "_blank")}>
                                                    <ServiceIcon type={link.iconType} />
                                                    <span className={serviceLabelClass}>{link.name}</span>
                                                    {link.description && (
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 pointer-events-none z-10">
                                                            <div className="bg-white text-gray-700 text-sm rounded-lg shadow-lg px-3 py-2 text-center border border-gray-200">{link.description}</div>
                                                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-t-4 border-t-white border-l-4 border-l-transparent border-r-4 border-r-transparent" style={{ filter: "drop-shadow(0 -1px 1px rgb(0 0 0 / 0.05))" }}></div>
                                                        </div>
                                                    )}
                                                </Button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </Block>
                </div>
            )}
        </>
    );
}
