"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";
import Input from "@/components/ui/Input/Input";

export default function AdminMayakResults() {
    const router = useRouter();
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [activeMatchIndex, setActiveMatchIndex] = useState(0);
    const [highlightedId, setHighlightedId] = useState(null);
    const highlightRef = useRef(null);
    const itemsPerPage = 30;

    const fetchResults = async () => {
        try {
            const res = await fetch("/api/admin/mayak-results", {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            });

            if (res.ok) {
                const data = await res.json();
                setResults(data);
            }
        } catch (err) {
            console.error("Ошибка:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResults();
    }, []);

    // Читаем query-параметр ?id= из URL и подсвечиваем строку по userId
    useEffect(() => {
        if (!router.isReady || results.length === 0) return;

        const idParam = router.query.id;
        if (idParam) {
            setHighlightedId(idParam);

            // Находим индекс в списке и переключаем на нужную страницу
            const targetIndex = results.findIndex(item => item.id === idParam);
            if (targetIndex !== -1) {
                const targetPage = Math.ceil((targetIndex + 1) / itemsPerPage);
                setCurrentPage(targetPage);

                // Прокручиваем к строке после рендера
                setTimeout(() => {
                    if (highlightRef.current) {
                        highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }, 200);
            }
        }
    }, [router.isReady, router.query.id, results.length]);

    // Поиск совпадений (всех подходящих элементов в полном списке)
    const matches = useMemo(() => {
        if (!searchQuery.trim() || searchQuery.length < 2) return [];
        const query = searchQuery.toLowerCase();
        return results
            .map((item, index) => {
                const fullName = `${item.lastName} ${item.firstName}`.toLowerCase();
                const college = (item.college || "").toLowerCase();
                if (fullName.includes(query) || college.includes(query)) {
                    return index;
                }
                return null;
            })
            .filter(index => index !== null);
    }, [results, searchQuery]);

    // Сброс индекса при новом поиске
    useEffect(() => {
        setActiveMatchIndex(0);
    }, [searchQuery]);

    // Переход к конкретному совпадению
    const goToMatch = (index) => {
        if (matches.length === 0) return;

        const safeIndex = (index + matches.length) % matches.length;
        setActiveMatchIndex(safeIndex);

        const targetResultIndex = matches[safeIndex];
        const targetPage = Math.ceil((targetResultIndex + 1) / itemsPerPage);

        setCurrentPage(targetPage);
    };

    // Расчет данных для текущей страницы
    const currentData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return results.slice(start, start + itemsPerPage);
    }, [results, currentPage]);

    const totalPages = Math.ceil(results.length / itemsPerPage);

    // Функция для подсветки текста (только при ручном поиске)
    const highlightText = (text, query, isCurrentMatch) => {
        if (!query || !text) return text;
        const parts = text.split(new RegExp(`(${query})`, "gi"));
        return parts.map((part, i) =>
            part.toLowerCase() === query.toLowerCase()
                ? <mark key={i} className={isCurrentMatch ? "bg-orange-400 text-black px-0.5 rounded" : "bg-yellow-200 text-black px-0.5 rounded"}>{part}</mark>
                : part
        );
    };

    const formatDate = (dateString) => {
        if (!dateString) return "—";
        const date = new Date(dateString);
        return date.toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (loading) {
        return (
            <Layout>
                <Header><Header.Heading>Протокол аттестаций</Header.Heading></Header>
                <div className="flex h-full items-center justify-center"><p>Загрузка...</p></div>
            </Layout>
        );
    }

    return (
        <Layout>
            <Header><Header.Heading>Протокол аттестаций</Header.Heading></Header>

            <div className="p-6 flex flex-col gap-4">
                {/* Умный поиск как в Google Docs */}
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm max-w-[500px]">
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Поиск по протоколу..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-1 outline-none text-sm"
                        />
                    </div>
                    {searchQuery.length >= 2 && (
                        <div className="flex items-center gap-2 border-l pl-2 border-gray-100">
                            <span className="text-xs text-gray-500 min-w-[40px]">
                                {matches.length > 0 ? `${activeMatchIndex + 1} / ${matches.length}` : "0 / 0"}
                            </span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => goToMatch(activeMatchIndex - 1)}
                                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                    disabled={matches.length === 0}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                                </button>
                                <button
                                    onClick={() => goToMatch(activeMatchIndex + 1)}
                                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                    disabled={matches.length === 0}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="p-4 font-semibold text-xs text-gray-500 uppercase w-[60px]">№</th>
                                    <th className="p-4 font-semibold text-xs text-gray-500 uppercase">ФИО</th>
                                    <th className="p-4 font-semibold text-xs text-gray-500 uppercase">Организация</th>
                                    <th className="p-4 font-semibold text-xs text-gray-500 uppercase w-[200px] text-right">Дата и время</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentData.map((item, index) => {
                                    const globalIndex = (currentPage - 1) * itemsPerPage + index;
                                    const isMatch = matches.includes(globalIndex);
                                    const isCurrentMatch = isMatch && matches[activeMatchIndex] === globalIndex;
                                    const isQrHighlighted = highlightedId && item.id === highlightedId;

                                    return (
                                        <tr
                                            key={item.id}
                                            ref={isQrHighlighted ? highlightRef : null}
                                            className={`border-b last:border-0 transition-colors ${
                                                isQrHighlighted
                                                    ? "bg-orange-50 ring-2 ring-orange-300"
                                                    : isCurrentMatch
                                                        ? "bg-orange-50"
                                                        : "hover:bg-gray-50"
                                            }`}
                                        >
                                            <td className="p-4 text-sm text-gray-500">{globalIndex + 1}</td>
                                            <td className="p-4 text-sm font-bold text-gray-900">
                                                {isQrHighlighted
                                                    ? `${item.lastName} ${item.firstName}`
                                                    : highlightText(`${item.lastName} ${item.firstName}`, searchQuery, isCurrentMatch)
                                                }
                                            </td>
                                            <td className="p-4 text-sm text-gray-700">
                                                {isQrHighlighted
                                                    ? (item.college || "—")
                                                    : highlightText(item.college || "—", searchQuery, isCurrentMatch)
                                                }
                                            </td>
                                            <td className="p-4 text-sm text-gray-500 text-right font-mono">{formatDate(item.timestamp)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Пагинация */}
                    <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                            Страница {currentPage} из {totalPages || 1}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                style={{ background: "#fff", color: "#111", border: "1px solid #e5e7eb", opacity: currentPage === 1 ? 0.3 : 1 }}
                                className="px-3 py-1 text-sm rounded"
                            >
                                Назад
                            </button>
                            <div className="flex gap-1">
                                {(() => {
                                    const pages = [];
                                    const delta = 2;

                                    pages.push(1);

                                    if (currentPage - delta > 2) {
                                        pages.push("dots-left");
                                    }

                                    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
                                        pages.push(i);
                                    }

                                    if (currentPage + delta < totalPages - 1) {
                                        pages.push("dots-right");
                                    }

                                    if (totalPages > 1) {
                                        pages.push(totalPages);
                                    }

                                    return pages.map((page) => {
                                        if (typeof page === "string") {
                                            return <span key={page} className="w-8 h-8 flex items-center justify-center text-sm text-gray-400">...</span>;
                                        }
                                        const isActive = currentPage === page;
                                        return (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                style={{
                                                    background: isActive ? "#111" : "#fff",
                                                    color: isActive ? "#fff" : "#111",
                                                    border: isActive ? "none" : "1px solid #e5e7eb",
                                                    fontWeight: isActive ? "bold" : "normal",
                                                }}
                                                className="w-8 h-8 flex items-center justify-center rounded text-sm"
                                            >
                                                {page}
                                            </button>
                                        );
                                    });
                                })()}
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                style={{ background: "#fff", color: "#111", border: "1px solid #e5e7eb", opacity: (currentPage === totalPages || totalPages === 0) ? 0.3 : 1 }}
                                className="px-3 py-1 text-sm rounded"
                            >
                                Вперед
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
