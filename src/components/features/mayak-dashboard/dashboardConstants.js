// Клиентские константы дашборда (без серверных импортов с fs).

export const INSPECTOR_ROLE = "Инспектор";

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
