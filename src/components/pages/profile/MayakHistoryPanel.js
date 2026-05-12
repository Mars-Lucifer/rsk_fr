import { useEffect, useState } from "react";

const HISTORY_POLL_MS = 5000;

export default function MayakHistoryPanel() {
    const [historyItems, setHistoryItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const loadHistory = async () => {
            try {
                const response = await fetch("/api/mayak/my-history", {
                    method: "GET",
                    credentials: "include",
                });
                const payload = await response.json().catch(() => ({}));
                if (cancelled) {
                    return;
                }

                if (!response.ok) {
                    setHistoryItems([]);
                    return;
                }

                setHistoryItems(Array.isArray(payload.data) ? payload.data : []);
            } catch (error) {
                if (!cancelled) {
                    console.error("Failed to load MAYAK history:", error);
                    setHistoryItems([]);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadHistory();
        const intervalId = window.setInterval(() => {
            loadHistory();
        }, HISTORY_POLL_MS);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, []);

    return (
        <div className="block-wrapper col-span-12 max-[900px]:col-span-12">
            <h6>История MAYAK</h6>
            {isLoading ? (
                <p className="text-(--color-gray-black)">Загружаем завершенные прохождения...</p>
            ) : historyItems.length > 0 ? (
                <div className="flex flex-col gap-[1rem]">
                    {historyItems.map((item) => (
                        <div key={item.runId} className="flex flex-col gap-[0.5rem] rounded-[24px] border border-(--color-gray-plus) p-[1rem]">
                            <div className="flex flex-col gap-[0.15rem]">
                                <span className="big">{item.trainerName || "МАЯК ОКО"}</span>
                                <span className="text-(--color-gray-black)">{new Date(item.completedAt).toLocaleString("ru-RU")}</span>
                            </div>

                            <div className="flex flex-col gap-[0.15rem] text-(--color-gray-black)">
                                <span>{item.fullName}</span>
                                {item.organization ? <span>{item.organization}</span> : null}
                                <span>{item.tokenType === "session" ? "Сессионный проход" : "Обычный токен"}</span>
                                {item.sessionName ? <span>Сессия: {item.sessionName}</span> : null}
                                {item.tableNumber ? <span>Стол: {item.tableNumber}</span> : null}
                                {item.selectedRole ? <span>Роль: {item.selectedRole}</span> : null}
                            </div>

                            <div className="flex flex-wrap gap-[0.75rem]">
                                <a className="link" href={item.files?.certificate}>
                                    Сертификат
                                </a>
                                <a className="link" href={item.files?.log}>
                                    Лог
                                </a>
                                {item.analyticsStatus === "ready" && item.files?.analytics ? (
                                    <a className="link" href={item.files.analytics}>
                                        Аналитика
                                    </a>
                                ) : item.analyticsStatus === "failed" ? (
                                    <span className="text-(--color-gray-black)">
                                        Аналитика не сформировалась
                                    </span>
                                ) : (
                                    <span className="text-(--color-gray-black)">
                                        Аналитика готовится...
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
