import { useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";

// Поиск организации в реестре, когда её нет в нашем списке.
//
// Зачем отдельным блоком: обычный выпадающий список показывает только то, что
// уже загружено в базу портала, и требует сначала выбрать регион. Участнику из
// колледжа, которого там нет, идти некуда — он застревает и не может ни собрать
// команду, ни вступить в чужую.
//
// Здесь он вводит название или ИНН, выбирает свою организацию из реестра, и она
// заводится в базе. Название, регион и тип приходят из реестра, а не из формы.
export default function OrgRegistrySearch({ onSelected, showHint = true }) {
    const [query, setQuery] = useState("");
    const [items, setItems] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [pendingInn, setPendingInn] = useState("");
    const [error, setError] = useState("");

    const search = async () => {
        const value = query.trim();
        if (value.length < 3) {
            setError("Введите ИНН организации: 10 или 12 цифр");
            return;
        }

        setIsSearching(true);
        setError("");
        setItems(null);
        try {
            const response = await fetch(`/api/org/suggest?query=${encodeURIComponent(value)}`, { credentials: "include" });
            const payload = await response.json();

            if (!payload.success) {
                setError(payload.error || "Реестр организаций недоступен");
                return;
            }

            setItems(payload.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSearching(false);
        }
    };

    const pick = async (item) => {
        setPendingInn(item.inn);
        setError("");
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
        <div className="flex flex-col gap-[.5rem]">
            {showHint && (
                <span className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                    Не нашли свою организацию в списке? Найдите её в реестре по ИНН.
                </span>
            )}

            <div className="flex gap-[.5rem] items-center max-[640px]:flex-col max-[640px]:items-stretch">
                {/* Поле тянется, кнопка — по содержимому: иначе «Найти»
                    расползается на половину карточки. */}
                <div className="flex-1 min-w-0">
                    <Input
                        type="text"
                        id="org-registry-query"
                        name="org-registry-query"
                        placeholder="Введите ИНН организации"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                search();
                            }
                        }}
                    />
                </div>
                <Button small type="button" onClick={search} disabled={isSearching} className="w-fit! shrink-0 max-[640px]:w-full!">
                    {isSearching ? "Ищем..." : "Найти"}
                </Button>
            </div>

            {error && <p style={{ color: "var(--color-red)" }}>{error}</p>}

            {items && items.length === 0 && <p style={{ color: "var(--color-gray-black)" }}>Ничего не найдено. Проверьте ИНН — он есть в реквизитах вашей организации.</p>}

            {items && items.length > 0 && (
                <div className="flex flex-col gap-[.375rem]">
                    {items.map((item) => (
                        <button
                            key={item.inn}
                            type="button"
                            onClick={() => pick(item)}
                            disabled={Boolean(pendingInn)}
                            className="flex flex-col items-start gap-[.125rem] p-[.75rem] rounded-[.75rem] text-left transition"
                            style={{
                                // Цвета задаём явно: глобальный стиль кнопки красит
                                // подсказку в чёрное, и она выпадает из карточки.
                                background: "var(--color-white)",
                                color: "var(--color-black)",
                                border: "1.5px solid var(--color-gray-plus-50)",
                            }}>
                            <span className="link">{item.short_name || item.full_name}</span>
                            <span className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                                ИНН {item.inn}
                                {item.region ? ` · ${item.region}` : ""}
                                {item.is_main ? "" : " · филиал"}
                            </span>
                            {pendingInn === item.inn && (
                                <span className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                                    Добавляем...
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
