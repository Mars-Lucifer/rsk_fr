import React, { useState, createContext, useContext, useMemo, useEffect } from "react";

import Switcher from "@/components/ui/Switcher";

const CaseValueContext = createContext();

export default function Case({ value, onChange, children, tabs, pages = 5, perPage = 3, ...props }) {
    // Защита от некорректных значений perPage и pages
    const safePerPage = typeof perPage === "number" && perPage > 0 ? perPage : 1;
    const safePages = typeof pages === "number" && pages > 0 ? pages : 5;
    const [page, setPage] = useState(0);

    // Мемоизация вычислений
    const { childrenArray, hasTabs, tabContent, paginated, totalPages, contentLength } = useMemo(() => {
        const childrenArray = React.Children.toArray(children);
        const hasTabs = childrenArray.some((child) => child?.type === Case.Tab);
        let tabContent = null;
        if (hasTabs) {
            const activeTab = childrenArray.find((child) => {
                if (!child.props || child.type !== Case.Tab) return false;
                if (!child.props.tab) return true;
                return child.props.tab === value;
            });
            if (activeTab) {
                tabContent = activeTab.props.children;
            }
        } else {
            tabContent = childrenArray;
        }
        let paginated = tabContent;
        let totalPages = 1;
        let contentLength = 1;
        if (Array.isArray(tabContent)) {
            totalPages = Math.ceil(tabContent.length / safePerPage);
            paginated = tabContent.slice(page * safePerPage, (page + 1) * safePerPage);
            contentLength = tabContent.length;
        }
        return { childrenArray, hasTabs, tabContent, paginated, totalPages, contentLength };
    }, [children, value, safePerPage, page]);

    // Сброс страницы при смене таба, children или количества элементов
    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            setPage(0);
        });

        return () => {
            cancelAnimationFrame(frameId);
        };
    }, [value, children, contentLength]);

    // Пагинация-свитчер (универсальный рендер)
    const renderPagination = () => (
        <Switcher
            className="!w-full"
            value={page}
            onChange={(val) => {
                if (val === "next") return; // не меняем страницу, если выбрана стрелка
                setPage(val);
            }}
            aria-label="Пагинация по страницам"
            role="navigation">
            {(() => {
                let start = Math.max(0, Math.min(page - Math.floor(safePages / 2), totalPages - safePages));
                let end = Math.min(totalPages, start + safePages);
                if (end - start < safePages) start = Math.max(0, end - safePages);
                return Array.from({ length: end - start }).map((_, idx) => {
                    const pageNum = start + idx;
                    return (
                        <Switcher.Option key={pageNum} value={pageNum} aria-current={pageNum === page ? "page" : undefined}>
                            {pageNum + 1}
                        </Switcher.Option>
                    );
                });
            })()}
            <Switcher.Option
                key="next"
                value="next"
                disabled={page >= totalPages - 1}
                onClick={() => {
                    if (page < totalPages - 1) setPage(page + 1);
                }}
                aria-label="Следующая страница">
                {">"}
            </Switcher.Option>
        </Switcher>
    );

    return (
        <div className={`flex flex-col ${props.className}`}>
            {tabs && tabs.length > 0 && (
                <Switcher className="!w-full" value={value} onChange={onChange}>
                    {tabs.map((tab, idx) => (
                        <Switcher.Option key={idx} value={tab.name}>
                            {tab.label}
                        </Switcher.Option>
                    ))}
                </Switcher>
            )}
            {!tabs || tabs.length === 0 ? (
                <>
                    <div className={`flex flex-col gap-[.75rem] ${props.classChildren}`}>
                        {Array.isArray(paginated) && paginated.length === 0 ? <div className="text-center text-(--color-gray-black)">Нет данных</div> : Array.isArray(paginated) ? paginated : paginated}
                    </div>
                    {Array.isArray(tabContent) && totalPages > 1 && renderPagination()}
                </>
            ) : (
                <div className="flex flex-col justify-between h-full">
                    <div className={`flex flex-col gap-[.75rem] ${props.classChildren}`}>
                        <CaseValueContext.Provider value={value}>
                            {Array.isArray(paginated) && paginated.length === 0 ? <div className="text-center text-(--color-gray-black)">Нет данных</div> : Array.isArray(paginated) ? paginated : paginated}
                        </CaseValueContext.Provider>
                    </div>
                    {Array.isArray(tabContent) && totalPages > 1 && renderPagination()}
                </div>
            )}
        </div>
    );
}

Case.Tab = function Tab({ children, tab = "" }) {
    const value = useContext(CaseValueContext);

    // Если tab не указан — всегда показываем
    if (!tab) return children;
    // Если tab совпадает с value — показываем
    if (tab === value) return children;
    // В остальных случаях ничего не рендерим
    return null;
};

{
    /*

import Case from '@/components/ui/Case';

const [caseType, setCaseType] = useState('all');

<Case tabs={[ 
        { name: 'all', label: 'Отображаемое имя таба' },
        { name: 'projects', label: 'Отображаемое имя таба' },
        { name: 'cases', label: 'Отображаемое имя таба' } 
    ]} value={caseType} onChange={setCaseType} perPage={5}
>
    <Case.Tab tab="all"> Показывается только на табе 'all'</Case.Tab>
    <Case.Tab tab="projects"> Показывается только на табе 'projects' </Case.Tab>
    <Case.Tab tab="cases"> Показывается только на табе 'cases' </Case.Tab>
    <Case.Tab> Показывается на всех табах </Case.Tab>
</Case>

*/
}
