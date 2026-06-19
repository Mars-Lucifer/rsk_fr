import { memo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";
import CloseIcon from "@/assets/general/close.svg";
import { copyMayakText } from "./utils/copyMayakText";

const copyToClipboard = copyMayakText;

export const RoleSelectionPopup = ({ onClose, onConfirm }) => {
    const roles = ["ИНЖЕНЕР", "МЕДИАТОР", "ХРАНИТЕЛЬ МАЯКА", "ИНСПЕКТОР", "КАПИТАН", "ЛЕТОПИСЕЦ"];
    const [currentSelection, setCurrentSelection] = useState(null);

    const handleConfirm = () => {
        if (currentSelection) {
            onConfirm(currentSelection);
        } else {
            alert("Пожалуйста, выберите роль.");
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-2xl border border-gray-200 pointer-events-auto">
                <div className="mb-4">
                    <h3 className="text-xl font-bold">Выберите роль в команде</h3>
                </div>
                <div className="space-y-3 mb-6">
                    {roles.map((role) => (
                        <label key={role} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input type="radio" name="role" value={role} checked={currentSelection === role} onChange={() => setCurrentSelection(role)} className="form-radio h-5 w-5 text-blue-600" />
                            <span className="font-medium">{role}</span>
                        </label>
                    ))}
                </div>
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose} className="!bg-gray-100 !text-gray-800 hover:!bg-gray-200">
                        Отмена
                    </Button>
                    <Button onClick={handleConfirm} className="!bg-blue-500 !text-white hover:!bg-blue-600">
                        Подтвердить
                    </Button>
                </div>
            </div>
        </div>
    );
};
export const ConfirmationPopup = memo(function ConfirmationPopup({ title, message, confirmText, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold">{title || "Подтверждение"}</h3>
                    <button onClick={onCancel} className="square text-gray-500 hover:text-gray-700">
                        ✕
                    </button>
                </div>

                <div className="big mb-6">{message}</div>

                <div className="flex justify-end gap-2">
                    <Button onClick={onCancel} className="!bg-gray-100 !text-gray-800 hover:!bg-gray-200">
                        Отмена
                    </Button>
                    <Button onClick={onConfirm} className="!bg-blue-500 !text-white hover:!bg-blue-600">
                        {confirmText || "Подтвердить"}
                    </Button>
                </div>
            </div>
        </div>
    );
});

export const FirstQuestionnairePopup = memo(function FirstQuestionnairePopup({ onClose, onSubmit }) {
    const [aiLevel, setAiLevel] = useState(5);
    const [aiUsage, setAiUsage] = useState("");
    const [aiTasks, setAiTasks] = useState("");
    const [selectedTools, setSelectedTools] = useState([]);
    const [desiredSkills, setDesiredSkills] = useState("");
    const [personalGoal, setPersonalGoal] = useState("");

    const toolsList = [
        { category: "Текст", tools: ["ChatGPT", "YandexGPT", "AiStudio", "GigaChat", "Claude", "DeepSeek"] },
        { category: "Аудио", tools: ["Suno", "ElevenLabs", "AiStudio (speech generation)"] },
        { category: "Изображение", tools: ["Midjourney", "Kandinsky", "Recraft", "Leonardo.Ai", "AiStudio (Imagen 4)"] },
        { category: "Видео", tools: ["PixelVerse", "Pictory AI", "KlingAi", "AiStudio (Veo)"] },
        { category: "Данные", tools: ["Napkin"] },
        { category: "Интерактив", tools: ["Websim", "Genspark", "Lovable"] },
    ];

    const handleToolToggle = (tool) => {
        setSelectedTools((prev) => (prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]));
    };

    const handleSubmit = () => {
        if (!aiUsage || !desiredSkills) {
            alert("Пожалуйста, заполните обязательные поля");
            return;
        }

        onSubmit({
            aiLevel,
            aiUsage,
            aiTasks: aiUsage.includes("Да") ? aiTasks : "",
            selectedTools,
            desiredSkills,
            personalGoal,
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold">Анкета №1: Входная диагностика («Точка А»)</h3>
                    <button onClick={onClose} className="square text-gray-500 hover:text-gray-700">
                        ✕
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Вопрос 1 */}
                    <div>
                        <label className="block mb-2 font-medium">
                            1. Оцените ваш текущий практический уровень владения инструментами ИИ:
                            <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-4">
                            <span className="text-sm w-16">0 (Новичок)</span>
                            <input type="range" min="0" max="10" value={aiLevel} onChange={(e) => setAiLevel(parseInt(e.target.value))} className="w-full" />
                            <span className="text-sm w-24">10 (Эксперт)</span>
                        </div>
                        <div className="text-center mt-2 font-medium">{aiLevel}</div>
                        <p className="text-sm text-gray-500 mt-1">
                            0 = Никогда не пользовался(ась), не знаю, с чего начать.
                            <br />
                            5 = Иногда использую знакомые инструменты для простых задач.
                            <br />
                            10 = Свободно и регулярно применяю разные ИИ-инструменты.
                        </p>
                    </div>

                    <div>
                        <label className="block mb-2 font-medium">
                            2. Применяете ли вы ИИ в своей текущей работе или учебе?
                            <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-2">
                            {["Да, применяю регулярно", "Да, применяю время от времени", "Пробовал(а) несколько раз, но системно не использую", "Нет, не применяю"].map((option) => (
                                <label key={option} className="flex items-center gap-2">
                                    <input type="radio" name="aiUsage" checked={aiUsage === option} onChange={() => setAiUsage(option)} />
                                    {option}
                                </label>
                            ))}
                        </div>
                    </div>

                    {aiUsage.includes("Да") && (
                        <div>
                            <label className="block mb-2 font-medium">3. Если применяете, то для решения каких задач?</label>
                            <textarea value={aiTasks} onChange={(e) => setAiTasks(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md h-24" placeholder="Опишите своими словами..." />
                            <p className="text-sm text-gray-500 mt-1">Пример: для написания постов в соцсети, для анализа данных, для создания картинок к презентациям.</p>
                        </div>
                    )}

                    <div>
                        <label className="block mb-2 font-medium">4. Какими из перечисленных ИИ-инструментов вы уже пользовались хотя бы раз?</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {toolsList.map((category) => (
                                <div key={category.category} className="border p-3 rounded-lg">
                                    <h4 className="font-medium mb-2">{category.category}:</h4>
                                    <div className="space-y-2">
                                        {category.tools.map((tool) => (
                                            <label key={tool} className="flex items-center gap-2">
                                                <input type="checkbox" checked={selectedTools.includes(tool)} onChange={() => handleToolToggle(tool)} />
                                                {tool}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block mb-2 font-medium">
                            5. Какие конкретные знания или навыки в области ИИ вы больше всего надеетесь получить на тренажере?
                            <span className="text-red-500">*</span>
                        </label>
                        <textarea value={desiredSkills} onChange={(e) => setDesiredSkills(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md h-24" placeholder="Опишите, что хотите изучить..." required />
                    </div>

                    <div>
                        <label className="block mb-2 font-medium">6. Что для вас будет наилучшим личным результатом участия в этом тренажере?</label>
                        <textarea value={personalGoal} onChange={(e) => setPersonalGoal(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md h-24" placeholder="Закончите фразу: 'В конце тренинга я хочу...'" />
                        <p className="text-sm text-gray-500 mt-1">Пример: &quot;...побороть страх перед нейросетями&quot;, &quot;...найти 2-3 инструмента для своей работы&quot;</p>
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <Button onClick={onClose} className="!bg-gray-100 !text-gray-800 hover:!bg-gray-200">
                            Пропустить
                        </Button>
                        <Button onClick={handleSubmit} className="!bg-blue-500 !text-white hover:!bg-blue-600">
                            Сохранить ответы
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
});

export const SecondQuestionnairePopup = memo(function SecondQuestionnairePopup({ onClose, onSubmit }) {
    const [confidence, setConfidence] = useState(5);
    const [understanding, setUnderstanding] = useState(5);
    const [insight, setInsight] = useState("");

    const handleSubmit = () => {
        if (!insight.trim()) {
            alert('Пожалуйста, заполните поле "Главный вывод"');
            return;
        }
        onSubmit({
            confidence,
            understanding,
            insight,
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold">Короткий привал: рефлексия после этапа «Я»</h3>
                    <button onClick={onClose} className="square text-gray-500 hover:text-gray-700">
                        ✕
                    </button>
                </div>

                <div className="space-y-6">
                    <label className="block mb-2 font-medium">Вы отлично поработали индивидуально! Давайте зафиксируем ваши ощущения.</label>

                    <div>
                        <label className="block mb-2 font-medium">1. Оцените вашу УВЕРЕННОСТЬ в работе с ИИ прямо сейчас, после этапа «Я – Цифровой Эксперт»:</label>
                        <div className="flex items-center gap-4">
                            <span className="text-sm">1 (не уверен)</span>
                            <input type="range" min="1" max="10" value={confidence} onChange={(e) => setConfidence(parseInt(e.target.value))} className="w-full" />
                            <span className="text-sm">10 (очень уверен)</span>
                        </div>
                        <div className="text-center mt-2 font-medium">{confidence}</div>
                    </div>

                    <div>
                        <label className="block mb-2 font-medium">2. Насколько вы поняли и готовы применять на практике фреймворк «МАЯК ОКО»?</label>
                        <div className="flex items-center gap-4">
                            <span className="text-sm">1 (ничего не понял)</span>
                            <input type="range" min="1" max="10" value={understanding} onChange={(e) => setUnderstanding(parseInt(e.target.value))} className="w-full" />
                            <span className="text-sm">10 (всё ясно)</span>
                        </div>
                        <div className="text-center mt-2 font-medium">{understanding}</div>
                    </div>

                    <div>
                        <label className="block mb-2 font-medium">3. Ваш главный вывод или «инсайт» о себе на данный момент?</label>
                        <textarea value={insight} onChange={(e) => setInsight(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md h-24" placeholder="Опишите ваш главный вывод..." />
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <Button onClick={onClose} className="!bg-gray-100 !text-gray-800 hover:!bg-gray-200">
                            Пропустить
                        </Button>
                        <Button onClick={handleSubmit} className="!bg-blue-500 !text-white hover:!bg-blue-600">
                            Сохранить ответы
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
});

export const ThirdQuestionnairePopup = memo(function ThirdQuestionnairePopup({ onClose, testingDone, surveyDone, onOpenTesting, onOpenSurvey, onGetCertificate, certificateLoading }) {
    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="relative bg-white p-6 rounded-lg max-w-md w-full shadow-2xl border border-gray-200 pointer-events-auto">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold">Завершение сессии</h3>
                    <Button icon onClick={onClose} className="!w-9 !h-9 !p-0 !bg-transparent !text-black hover:!bg-black/5 flex items-center justify-center">
                        <CloseIcon className="w-5 h-5" />
                    </Button>
                </div>

                <div className="flex flex-col gap-3">
                    <Button onClick={onOpenTesting} disabled={testingDone} className={testingDone ? "!bg-green-100 !text-green-600 !cursor-default flex-1" : "!bg-blue-500 !text-white hover:!bg-blue-600 flex-1"}>
                        {testingDone ? "Тестирование пройдено" : "Пройти тестирование"}
                    </Button>
                    <Button
                        onClick={onOpenSurvey}
                        disabled={!testingDone || surveyDone}
                        className={surveyDone ? "!bg-green-100 !text-green-600 !cursor-default flex-1" : testingDone ? "!bg-blue-500 !text-white hover:!bg-blue-600 flex-1" : "!bg-gray-200 !text-gray-400 !cursor-not-allowed flex-1"}>
                        {surveyDone ? "Анкета заполнена" : "Анкета обратной связи"}
                    </Button>
                    <Button onClick={onGetCertificate} disabled={!surveyDone || certificateLoading} className={surveyDone ? "!bg-[#0088cc] !text-white hover:!bg-[#006daa] flex-1" : "!bg-gray-200 !text-gray-400 !cursor-not-allowed flex-1"}>
                        {certificateLoading ? "Подготовка..." : "Получить сертификат"}
                    </Button>
                </div>
            </div>
        </div>
    );
});

export const SessionCompletionPopup = memo(function SessionCompletionPopup({ onClose, onSave }) {
    const [levels, setLevels] = useState({
        level1: "",
        level2: "",
        level3: "",
        level4: "",
        level5: "",
    });

    const handleLevelChange = (level, value) => {
        setLevels((prev) => ({
            ...prev,
            [level]: value,
        }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold">Завершение сессии</h3>
                    <button onClick={onClose} className="square text-gray-500 hover:text-gray-700">
                        ✕
                    </button>
                </div>

                <div className="space-y-4">
                    <p>Пожалуйста, заполните измерения Delta для завершения сессии:</p>

                    <div className="grid grid-cols-2 gap-2">
                        <Input type="number" placeholder="Уровень 1" value={levels.level1} onChange={(e) => handleLevelChange("level1", e.target.value)} />
                        <Input type="number" placeholder="Уровень 2" value={levels.level2} onChange={(e) => handleLevelChange("level2", e.target.value)} />
                        <Input type="number" placeholder="Уровень 3" value={levels.level3} onChange={(e) => handleLevelChange("level3", e.target.value)} />
                        <Input type="number" placeholder="Уровень 4" value={levels.level4} onChange={(e) => handleLevelChange("level4", e.target.value)} />
                        <Input type="number" placeholder="Уровень 5" value={levels.level5} onChange={(e) => handleLevelChange("level5", e.target.value)} />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <Button
                        onClick={() => {
                            if (onClose) onClose();
                            window.__openRankingTestPopup && window.__openRankingTestPopup();
                        }}
                        className="!bg-gray-100 !text-gray-800 hover:!bg-gray-200">
                        Пройти Тестирование
                    </Button>
                    <Button onClick={() => onSave(levels)} className="!bg-blue-500 !text-white hover:!bg-blue-600">
                        Сохранить и завершить
                    </Button>
                </div>
            </div>
        </div>
    );
});

export const TaskCompletionPopup = memo(function TaskCompletionPopup({ taskData, onClose, elapsedTime }) {
    // --- НАЧАЛО ДОБАВЛЕННОЙ ЛОГИКИ ---
    const [levels, setLevels] = useState({
        level1: "",
        level2: "",
        level3: "",
        level4: "",
        level5: "",
    });

    const handleLevelChange = (level, value) => {
        setLevels((prev) => ({
            ...prev,
            [level]: value,
        }));
    };

    const isSaveDisabled = !Object.values(levels).some((level) => level !== "");
    // --- КОНЕЦ ДОБАВЛЕННОЙ ЛОГИКИ ---

    const [isCopied, setIsCopied] = useState(false);

    if (!taskData) return null;

    const formatTaskTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const handleCopyClick = () => {
        const textToCopy = `Задание №${taskData.number}\n\nОписание:\n${taskData.description}\n\nЗадача:\n${taskData.task}\n\nРезультат:\n\n`;
        copyToClipboard(textToCopy)
            .then(() => {
                setIsCopied(true);
                setTimeout(() => {
                    setIsCopied(false);
                    onClose();
                }, 800);
            })
            .catch((err) => {
                console.error("Ошибка копирования:", err);
                alert("Не удалось скопировать текст.");
            });
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto shadow-lg border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-xl font-bold">Задание №{taskData.number}</h3>
                        <p className="text-sm text-gray-400 mt-1">Время выполнения: {formatTaskTime(elapsedTime)}</p>
                    </div>
                    <Button icon className="!bg-transparent !text-black hover:!bg-black/5" onClick={onClose}>
                        <CloseIcon />
                    </Button>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                    {taskData.title && (
                        <div>
                            <p className="text-gray-800 text-lg mb-1" style={{ fontWeight: 900 }}>
                                Название задания:
                            </p>
                            <p className="whitespace-pre-line text-gray-700 text-sm">{taskData.title}</p>
                        </div>
                    )}
                    {taskData.contentType && (
                        <div>
                            <p className="text-gray-800 text-lg mb-1" style={{ fontWeight: 900 }}>
                                Тип контента:
                            </p>
                            <p className="whitespace-pre-line text-gray-700 text-sm">{taskData.contentType}</p>
                        </div>
                    )}
                    <div>
                        <p className="text-gray-800 text-lg mb-1" style={{ fontWeight: 900 }}>
                            Описание ситуации:
                        </p>
                        <p className="whitespace-pre-line text-gray-700 text-sm">{taskData.description}</p>
                    </div>
                    <div>
                        <p className="text-gray-800 text-lg mb-1" style={{ fontWeight: 900 }}>
                            Вашей задачей было:
                        </p>
                        <p className="whitespace-pre-line text-gray-700 text-sm">{taskData.task}</p>
                    </div>
                </div>

                <div className="mt-4 flex justify-end relative">
                    <Button onClick={handleCopyClick} className="!bg-gray-100 !text-gray-800 hover:!bg-gray-200">
                        Скопировать задание
                    </Button>
                    {isCopied && <span className="absolute -top-8 right-0 bg-black text-white text-xs px-3 py-1.5 rounded-lg shadow-lg animate-fade-in">Скопировано!</span>}
                </div>
            </div>
        </div>
    );
});

export const YaDirectionSelectionPopup = ({ onClose, onConfirm, takenDirections = [], options = null }) => {
    // options — фактические форматы текущей колоды: [{ key, label }].
    // Если не переданы, используем канонический набор из 6 форматов как fallback.
    const directions = Array.isArray(options) && options.length > 0
        ? options
        : [
            { key: "текст", label: "Текст" },
            { key: "аудио", label: "Аудио" },
            { key: "изображение", label: "Изображение" },
            { key: "интерактив", label: "Интерактив" },
            { key: "видео", label: "Видео" },
            { key: "данные", label: "Данные" },
        ];
    const [currentSelection, setCurrentSelection] = useState(null);

    const handleConfirm = () => {
        if (currentSelection) {
            onConfirm(currentSelection);
        } else {
            alert("Пожалуйста, выберите направление.");
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-2xl border border-gray-200 pointer-events-auto">
                <div className="mb-4">
                    <h3 className="text-xl font-bold text-slate-800">Выберите направление специализации</h3>
                    <p className="text-sm text-slate-500 mt-1">Теперь выберите направление, которое за вами закрепится для части «Я».</p>
                </div>
                <div className="space-y-2.5 mb-6">
                    {directions.map((direction) => {
                        const value = direction.key;
                        const label = direction.label || direction.key;
                        const isTaken = Array.isArray(takenDirections)
                            && takenDirections.map((d) => String(d).toLowerCase()).includes(String(value).toLowerCase());
                        return (
                            <label
                                key={value}
                                className={`flex items-center gap-3 p-2.5 border rounded-lg transition-all ${
                                    isTaken
                                        ? "border-slate-100 bg-slate-50/70 opacity-50 cursor-not-allowed"
                                        : currentSelection === value
                                            ? "border-blue-500 bg-blue-50/50 cursor-pointer"
                                            : "border-slate-100 hover:bg-slate-50 cursor-pointer"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="direction"
                                    value={value}
                                    disabled={isTaken}
                                    checked={currentSelection === value}
                                    onChange={() => !isTaken && setCurrentSelection(value)}
                                    className="form-radio h-4 w-4 text-blue-600 disabled:opacity-50"
                                />
                                <span className={`font-semibold text-slate-700 capitalize text-sm ${isTaken ? "line-through text-slate-400" : ""}`}>
                                    {label} {isTaken && " (занято)"}
                                </span>
                            </label>
                        );
                    })}
                </div>
                <div className="flex justify-end gap-2">
                    {onClose && (
                        <Button onClick={onClose} className="!bg-gray-100 !text-gray-800 hover:!bg-gray-200">
                            Отмена
                        </Button>
                    )}
                    <Button onClick={handleConfirm} className="!bg-blue-500 !text-white hover:!bg-blue-600">
                        Подтвердить выбор
                    </Button>
                </div>
            </div>
        </div>
    );
};

