import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import Block from "@/components/features/public/Block";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";
import { buildMayakAdminLoginUrl, getMayakAdminAuthStatus } from "@/lib/mayakAdminClient";

// Иконка-стрелочка для аккордеона
const ChevronIcon = ({ isOpen }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-6 w-6 transition-transform duration-300 text-gray-500 ${isOpen ? "transform rotate-180" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
);

// Иконка-крестик для удаления
const DeleteIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

const AccordionItem = ({ type, links, onLinkChange, onAddLink, onDeleteLink, onTypeLabelChange, onDeleteType, onInstructionUpload, isUploadingInstruction, isDeletable }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Список доступных иконок для выбора в админ-панели
    const iconOptions = [
        { value: "standard", label: "Стандартная (Ссылка)" },
        { value: "telegram", label: "Telegram" },
        { value: "top", label: "Звезда" },
        { value: "hot", label: "Галочка" },
    ];

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm mb-3 bg-white transition-shadow hover:shadow-md">
            <div className="flex justify-between items-center p-4 cursor-pointer bg-gray-50 hover:bg-gray-100" onClick={() => setIsOpen(!isOpen)}>
                {onTypeLabelChange ? (
                    <Input
                        value={type.label}
                        onChange={(e) => onTypeLabelChange(type.key, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-lg !border-none !bg-transparent !p-0 focus:!ring-0 w-full"
                        placeholder="Название подтипа"
                    />
                ) : (
                    <h4 className="font-semibold text-lg text-gray-800">{type.label}</h4>
                )}
                <div className="flex items-center gap-4 ml-4">
                    {isDeletable && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteType();
                            }}
                            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                            title="Удалить подтип">
                            <DeleteIcon />
                        </button>
                    )}
                    <ChevronIcon isOpen={isOpen} />
                </div>
            </div>
            {isOpen && (
                <div className="p-4 md:p-6 border-t border-gray-200 bg-white">
                    <div className="space-y-4">
                        {links && links.length > 0 ? (
                            links.map((link, index) => (
                                <div key={index} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                    <div className="grid grid-cols-[auto_1fr_2fr_1.5fr_1fr_auto] items-center gap-3">
                                        <Input type="number" value={link.order || ""} onChange={(e) => onLinkChange(type.key, index, "order", e.target.value)} placeholder="№" className="w-16 text-center" title="Порядковый номер" />
                                        <Input value={link.name} onChange={(e) => onLinkChange(type.key, index, "name", e.target.value)} placeholder="Название сервиса" />
                                        <Input value={link.url} onChange={(e) => onLinkChange(type.key, index, "url", e.target.value)} placeholder="URL-адрес" />
                                        <Input value={link.description || ""} onChange={(e) => onLinkChange(type.key, index, "description", e.target.value)} placeholder="Описание (подсказка)" />
                                        <select
                                            value={link.iconType || "standard"}
                                            onChange={(e) => onLinkChange(type.key, index, "iconType", e.target.value)}
                                            className="w-full h-11 rounded-lg border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
                                            {iconOptions.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => onDeleteLink(type.key, index)}
                                            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                                            title="Удалить сервис">
                                            <DeleteIcon />
                                        </button>
                                    </div>
                                    <div className="mt-3 grid grid-cols-[120px_1fr_auto_auto] items-center gap-3">
                                        <div className="h-16 w-28 overflow-hidden rounded-lg border border-gray-200 bg-white">
                                            {link.instructionImage ? (
                                                <img src={link.instructionImage} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">Нет фото</div>
                                            )}
                                        </div>
                                        <Input value={link.instructionImage || ""} onChange={(e) => onLinkChange(type.key, index, "instructionImage", e.target.value)} placeholder="Фото инструкции" />
                                        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
                                            {isUploadingInstruction(type.key, index) ? "Загрузка..." : link.instructionImage ? "Заменить фото" : "Добавить фото"}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                disabled={isUploadingInstruction(type.key, index)}
                                                onChange={(event) => onInstructionUpload(type.key, index, event)}
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => onLinkChange(type.key, index, "instructionImage", "")}
                                            disabled={!link.instructionImage}
                                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40">
                                            Убрать
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-center py-4">Здесь пока нет сервисов. Нажмите &quot;Добавить&quot;, чтобы создать первый.</p>
                        )}
                        <div className="pt-2">
                            <Button onClick={() => onAddLink(type.key)} className="self-start">
                                + Добавить сервис
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export default function AdminPanel({ goTo }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [constants, setConstants] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [uploadingInstructionKey, setUploadingInstructionKey] = useState("");

    useEffect(() => {
        let cancelled = false;

        getMayakAdminAuthStatus()
            .then(({ authenticated }) => {
                if (!cancelled && authenticated) {
                    setIsAuthenticated(true);
                }
            })
            .catch(() => {
                if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin/")) {
                    window.location.replace(buildMayakAdminLoginUrl(`${window.location.pathname}${window.location.search}`));
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            setLoading(true);
            fetch("/api/mayak/content-data")
                .then((res) => {
                    if (!res.ok) throw new Error("Ошибка сети при загрузке данных");
                    return res.json();
                })
                .then((data) => {
                    // --- НАЧАЛО ИЗМЕНЕНИЙ ---
                    // Пройдемся по всем ссылкам и добавим поле 'order', если его нет.
                    // Это нужно для существующих записей из JSON-файла.
                    Object.keys(data.defaultLinks).forEach((key) => {
                        if (Array.isArray(data.defaultLinks[key])) {
                            data.defaultLinks[key].forEach((link, index) => {
                                if (link.order === undefined || link.order === null) {
                                    link.order = index;
                                }
                            });
                        }
                    });
                    setConstants(data);
                })
                .catch((err) => {
                    setError(`Не удалось загрузить данные: ${err.message}`);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [isAuthenticated]);

    const handleSave = async () => {
        setStatus("Сохранение...");
        try {
            // Глубоко копируем объект, чтобы не изменять текущее состояние напрямую
            const constantsToSave = JSON.parse(JSON.stringify(constants));

            // Перед сохранением отсортируем все списки по полю 'order'
            Object.keys(constantsToSave.defaultLinks).forEach((key) => {
                if (Array.isArray(constantsToSave.defaultLinks[key])) {
                    constantsToSave.defaultLinks[key].sort((a, b) => {
                        const orderA = isNaN(Number(a.order)) ? Infinity : Number(a.order);
                        const orderB = isNaN(Number(b.order)) ? Infinity : Number(b.order);
                        return orderA - orderB;
                    });
                }
            });

            const response = await fetch("/api/mayak/content-data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // Отправляем отсортированную версию
                body: JSON.stringify(constantsToSave),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Ошибка сервера");
            }
            setStatus("✅ Успешно сохранено!");
        } catch (err) {
            setStatus(`❌ Ошибка сохранения: ${err.message}`);
        }
        setTimeout(() => setStatus(""), 4000);
    };

    const handleLinkChange = (typeKey, index, field, value) => {
        setConstants((prev) => {
            const newConstants = JSON.parse(JSON.stringify(prev));
            // Добавим проверку на случай, если поле 'order'
            const finalValue = field === "order" ? (value === "" ? "" : parseInt(value, 10)) : value;
            newConstants.defaultLinks[typeKey][index][field] = finalValue;
            return newConstants;
        });
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError("");
        try {
            const res = await fetch("/api/admin/mayak-auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            const json = await res.json();
            if (!json.success) {
                setLoginError(json.error || "Неверный пароль");
                return;
            }
            setIsAuthenticated(true);
        } catch {
            setLoginError("Ошибка входа");
        }
    };

    const handleAddLink = (typeKey) => {
        setConstants((prev) => {
            const newConstants = JSON.parse(JSON.stringify(prev));
            if (!newConstants.defaultLinks[typeKey]) {
                newConstants.defaultLinks[typeKey] = [];
            }
            newConstants.defaultLinks[typeKey].push({ name: "", url: "", description: "", iconType: "standard", order: newConstants.defaultLinks[typeKey].length });
            return newConstants;
        });
    };

    const handleInstructionUpload = async (typeKey, index, event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        const uploadKey = `${typeKey}:${index}`;
        setUploadingInstructionKey(uploadKey);
        setStatus("Загрузка фото инструкции...");

        try {
            const currentLink = constants?.defaultLinks?.[typeKey]?.[index] || {};
            const formData = new FormData();
            formData.append("file", file);
            formData.append("typeKey", typeKey);
            formData.append("serviceName", currentLink.name || `service-${index + 1}`);

            const response = await fetch("/api/admin/mayak-services/upload", {
                method: "POST",
                body: formData,
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || "Не удалось загрузить фото");
            }

            handleLinkChange(typeKey, index, "instructionImage", payload.url);
            setStatus("Фото загружено. Нажмите «Сохранить все изменения».");
        } catch (error) {
            setStatus(`Ошибка загрузки фото: ${error.message}`);
        } finally {
            setUploadingInstructionKey("");
        }
    };

    const handleDeleteLink = (typeKey, index) => {
        setConstants((prev) => {
            const newConstants = JSON.parse(JSON.stringify(prev));
            newConstants.defaultLinks[typeKey].splice(index, 1);
            return newConstants;
        });
    };

    const handleAddSubType = (parentTypeKey) => {
        setConstants((prev) => {
            const newConstants = JSON.parse(JSON.stringify(prev));
            const parentType = newConstants.defaultTypes.find((t) => t.key === parentTypeKey);

            if (parentType) {
                const newSubType = { key: `custom-${Date.now()}`, label: "Новый подтип" };
                if (!parentType.subCategories) {
                    parentType.subCategories = [];
                }
                parentType.subCategories.push(newSubType);
                newConstants.defaultLinks[newSubType.key] = [];
            }
            return newConstants;
        });
    };

    const handleDeleteSubType = (parentTypeKey, subTypeKeyToDelete) => {
        if (!window.confirm("Вы уверены? Это действие удалит подтип и ВСЕ сервисы внутри него безвозвратно.")) {
            return;
        }
        setConstants((prev) => {
            const newConstants = JSON.parse(JSON.stringify(prev));
            const parentType = newConstants.defaultTypes.find((t) => t.key === parentTypeKey);
            if (parentType && parentType.subCategories) {
                parentType.subCategories = parentType.subCategories.filter((sub) => sub.key !== subTypeKeyToDelete);
                delete newConstants.defaultLinks[subTypeKeyToDelete];
            }
            return newConstants;
        });
    };

    const handleTypeLabelChange = (typeKey, newLabel) => {
        setConstants((prev) => {
            const newConstants = JSON.parse(JSON.stringify(prev));
            for (const type of newConstants.defaultTypes) {
                if (type.subCategories) {
                    const subItem = type.subCategories.find((sub) => sub.key === typeKey);
                    if (subItem) {
                        subItem.label = newLabel;
                        break;
                    }
                }
            }
            return newConstants;
        });
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                    <h3 className="text-2xl font-bold text-center mb-6">Панель управления</h3>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                Пароль
                            </label>
                            <Input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </div>
                        {loginError && <p className="text-center text-red-500">{loginError}</p>}
                        <Button type="submit" className="w-full !py-3 !text-base blue">
                            Войти
                        </Button>
                        <Button onClick={() => goTo("trainer")} className="w-full !py-3 !text-base">
                            Вернуться на главную
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    if (loading) return <div className="text-center p-10 font-semibold text-lg">Загрузка данных...</div>;
    if (error) return <div className="text-center p-10 text-red-600 bg-red-50 rounded-lg">{error}</div>;

    return (
        <div className="bg-gray-50 min-h-screen">
            <Header>
                <div className="container mx-auto px-4">
                    <Header.Heading className="mb-4 text-center text-xl md:text-2xl">Админ-панель: Сервисы</Header.Heading>
                    <Button onClick={() => (goTo ? goTo("trainer") : window.location.assign("/admin?view=sections"))} className="w-full">
                        {goTo ? "Вернуться к тренажеру" : "Вернуться в админ-панель"}
                    </Button>
                </div>
            </Header>

            <main className="container mx-auto py-8 px-4">
                <Block className="!p-6">
                    {constants &&
                        constants.defaultTypes.map((type) => {
                            // Если у типа есть подкатегории (как у "Разное")
                            if (type.subCategories && Array.isArray(type.subCategories)) {
                                return (
                                    <div key={type.key} className="mb-10">
                                        <h3 className="text-xl font-bold text-gray-800 border-b-2 border-gray-200 pb-3 mb-4">{type.label}</h3>
                                        {type.subCategories.map((subType) => (
                                            <AccordionItem
                                                key={subType.key}
                                                type={subType}
                                                links={constants.defaultLinks[subType.key]}
                                                onLinkChange={handleLinkChange}
                                                onAddLink={handleAddLink}
                                                onDeleteLink={handleDeleteLink}
                                                onInstructionUpload={handleInstructionUpload}
                                                isUploadingInstruction={(typeKey, index) => uploadingInstructionKey === `${typeKey}:${index}`}
                                                // Разрешаем редактирование и удаление только для подтипов категории 'misc'
                                                onTypeLabelChange={handleTypeLabelChange}
                                                isDeletable={true}
                                                onDeleteType={() => handleDeleteSubType(type.key, subType.key)}
                                            />
                                        ))}
                                        {/* Кнопка добавления нового подтипа только для категории 'misc' */}
                                        {type.key === "misc" && (
                                            <Button onClick={() => handleAddSubType("misc")} className="mt-4">
                                                + Добавить новый подтип
                                            </Button>
                                        )}
                                    </div>
                                );
                            }
                            // Обычные типы без подкатегорий
                            return (
                                <AccordionItem
                                    key={type.key}
                                    type={type}
                                    links={constants.defaultLinks[type.key]}
                                    onLinkChange={handleLinkChange}
                                    onAddLink={handleAddLink}
                                    onDeleteLink={handleDeleteLink}
                                    onInstructionUpload={handleInstructionUpload}
                                    isUploadingInstruction={(typeKey, index) => uploadingInstructionKey === `${typeKey}:${index}`}
                                    onTypeLabelChange={null} // Запрещаем редактирование названия
                                    isDeletable={false} // Запрещаем удаление
                                />
                            );
                        })}
                </Block>

                <div className="mt-8">
                    <Button onClick={handleSave} className="blue w-full text-lg !py-3 shadow-lg hover:shadow-xl transition-shadow">
                        Сохранить все изменения
                    </Button>
                    {status && <p className="text-center mt-4 text-base font-semibold">{status}</p>}
                </div>
            </main>
        </div>
    );
}


