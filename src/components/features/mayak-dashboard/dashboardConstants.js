// Клиентские константы дашборда (без серверных импортов с fs).

export const INSPECTOR_ROLE = "Инспектор";

// Подписи фаз части «Я». Счётчик в строке участника показывает прогресс ТОЛЬКО
// текущей фазы (у каждой своя цель: 4 старта, 6 форматов, 4 задания
// специализации), поэтому без названия фазы «4/4» читается как «сделано 4
// задания» и не сходится с общим счётчиком стола.
export const YA_PHASE_LABELS = {
    START: "Старт",
    CONTENT_TYPES: "Форматы",
    CHOOSING_DIRECTION: "Выбор направления",
    SPECIALIZATION: "Специализация",
};

export const ROLE_OPTIONS = [
    { value: "Участник", label: "Участник" },
    { value: INSPECTOR_ROLE, label: "Инспектор" },
    { value: "Капитан", label: "Капитан" },
    { value: "Инженер", label: "Инженер" },
    { value: "Медиатор", label: "Медиатор" },
    { value: "Хранитель Маяка", label: "Хранитель Маяка" },
    { value: "Летописец", label: "Летописец" },
];

export function roleLabel(role) {
    const found = ROLE_OPTIONS.find((option) => option.value === role);
    return found ? found.label : (role || "Участник");
}

export function isReviewerRole(role) {
    return role === INSPECTOR_ROLE;
}
