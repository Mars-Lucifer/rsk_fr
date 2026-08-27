import { useCallback, useEffect, useRef, useState } from "react";

import Input from "@/components/ui/Input/Input";

const MIN_QUERY_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 350;

// Поиск организации одним полем: человек набирает «Калужский колледж» и видит
// варианты, не выбирая заранее, где искать.
//
// Ищем сразу в двух местах и показываем одним списком:
//   1) организации портала — те, что уже завели, их можно выбрать сразу;
//   2) реестр ФНС через ДаData — для тех, кого в базе ещё нет.
// Регион, выбранный выше, сужает обе выдачи; без него ищем по всей стране.
//
// Раньше это были два разных поля — выпадающий список и «найдите по ИНН», —
// и участник должен был сам догадаться, что его колледжа нет в первом и надо
// лезть во второе.
export default function OrganizationPicker({ region = "", valueLabel = "", onSelected, disabled = false }) {
    const [query, setQuery] = useState("");
    const [items, setItems] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [pendingInn, setPendingInn] = useState("");
    const [error, setError] = useState("");
    const containerRef = useRef(null);
    const requestIdRef = useRef(0);

    const search = useCallback(
        async (rawQuery) => {
            const value = String(rawQuery || "").trim();
            if (value.length < MIN_QUERY_LENGTH) {
                setItems(null);
                return;
            }

            const requestId = requestIdRef.current + 1;
            requestIdRef.current = requestId;

            setIsSearching(true);
            setError("");

            const params = new URLSearchParams({ query: value });
            const portalParams = new URLSearchParams({ name: value, limit: "10" });
            if (region) {
                params.append("region", region);
                portalParams.append("region", region);
            }

            const [portalResult, registryResult] = await Promise.allSettled([
                fetch(`/api/org/all?${portalParams.toString()}`, { credentials: "include" }).then((response) => response.json()),
                fetch(`/api/org/suggest?${params.toString()}`, { credentials: "include" }).then((response) => response.json()),
            ]);

            // Ответ устаревшего запроса не должен затирать свежий: пользователь
            // печатает быстрее, чем отвечает реестр.
            if (requestIdRef.current !== requestId) {
                return;
            }

            const portalOk = portalResult.status === "fulfilled" && portalResult.value?.success;
            const registryOk = registryResult.status === "fulfilled" && registryResult.value?.success;
            const portalItems = portalOk ? portalResult.value.data || [] : [];
            const registryItems = registryOk ? registryResult.value.data || [] : [];

            const knownInns = new Set(portalItems.map((item) => String(item.inn || "")).filter(Boolean));
            const merged = [
                ...portalItems.map((item) => ({ ...item, source: "portal" })),
                ...registryItems.filter((item) => !knownInns.has(String(item.inn || ""))).map((item) => ({ ...item, source: "registry" })),
            ];

            // Оба источника молчат — это поломка, а не «такой организации нет».
            // Раньше недоступный бэкенд выглядел как пустая выдача, и человек
            // шёл заполнять форму вместо того, чтобы повторить поиск.
            if (!portalOk && !registryOk) {
                setError("Поиск сейчас недоступен. Повторите через минуту.");
                setItems(null);
                setIsSearching(false);
                return;
            }

            setItems(merged);
            setIsSearching(false);
        },
        [region]
    );

    useEffect(() => {
        if (!query.trim()) {
            setItems(null);
            return undefined;
        }

        const timerId = setTimeout(() => search(query), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timerId);
    }, [query, search]);

    useEffect(() => {
        const close = (event) => {
            if (!containerRef.current?.contains(event.target)) {
                setItems(null);
            }
        };
        document.addEventListener("click", close);
        return () => document.removeEventListener("click", close);
    }, []);

    const pick = async (item) => {
        setError("");

        // Организация портала выбирается сразу; запись из реестра сначала
        // заводится в базе — название и регион берутся оттуда, не из формы.
        if (item.source === "portal") {
            onSelected?.(item);
            setItems(null);
            setQuery("");
            return;
        }

        setPendingInn(item.inn);
        try {
            const response = await fetch("/api/org/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ inn: item.inn }),
            });
            const payload = await response.json();

            if (!payload.success) {
                setError(payload.error || "Не удалось добавить организацию");
                return;
            }

            onSelected?.(payload.data);
            setItems(null);
            setQuery("");
        } catch (err) {
            setError(err.message);
        } finally {
            setPendingInn("");
        }
    };

    return (
        <div className="relative flex flex-col gap-[.5rem]" ref={containerRef}>
            <Input
                type="text"
                id="org-search"
                name="org-search"
                placeholder={region ? "Начните вводить название или ИНН" : "Сначала выберите регион"}
                value={query}
                disabled={disabled}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => query.trim().length >= MIN_QUERY_LENGTH && search(query)}
            />

            {valueLabel && !query ? (
                <span className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                    {`Выбрано: ${valueLabel}`}
                </span>
            ) : null}

            {isSearching ? (
                <span className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                    Ищем...
                </span>
            ) : null}

            {error ? <p style={{ color: "var(--color-red)" }}>{error}</p> : null}

            {items && items.length === 0 && !isSearching ? (
                <p className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                    Ничего не найдено. Проверьте название или введите ИНН — он есть в реквизитах организации.
                </p>
            ) : null}

            {items && items.length > 0 ? (
                <div className="flex flex-col gap-[.375rem] max-h-[18rem] overflow-y-auto">
                    {items.map((item) => (
                        <button
                            key={`${item.source}-${item.inn || item.id}`}
                            type="button"
                            onClick={() => pick(item)}
                            disabled={Boolean(pendingInn)}
                            className="flex flex-col items-start justify-start! gap-[.125rem] p-[.75rem]! rounded-[.75rem] text-left transition"
                            style={{
                                // Цвета задаём явно: глобальный стиль кнопки красит
                                // подсказку в чёрное, и она выпадает из карточки.
                                background: "var(--color-white)",
                                color: "var(--color-black)",
                                border: "1.5px solid var(--color-gray-plus-50)",
                            }}>
                            <span className="link">{item.short_name || item.full_name}</span>
                            <span className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                                {item.inn ? `ИНН ${item.inn}` : ""}
                                {item.region ? ` · ${item.region}` : ""}
                                {item.source === "portal" ? " · уже в базе" : " · из реестра"}
                                {item.is_main === false ? " · филиал" : ""}
                            </span>
                            {pendingInn === item.inn ? (
                                <span className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                                    Добавляем...
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
