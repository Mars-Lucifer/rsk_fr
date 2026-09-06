// Варианты освещения сцены.
//
// Живут отдельно от Platform.js намеренно: пресет нужен и сцене, и переключателю в интерфейсе,
// а тянуть three в страницу ради четырёх чисел незачем. Здесь нет ни three, ни React.
//
// bg — фон и цвет циклорамы, floor — центр и середина градиента пола, exposure — экспозиция
// тонмаппинга, ambient и key — заливка и направленный (он же рисует тень), fill — множитель
// студийного окружения, glow — во сколько раз ярче горит сам маяк, bloom/bloomAt — сила и
// порог ореола, ao — сила затенения в стыках.

export const LIGHT_PRESETS = [
    { id: 1, name: "студия", bg: "#eceef1", floor: ["#fafbfc", "#f3f4f6"], exposure: 0.95, ambient: 0.12, key: 1.35, fill: 1, glow: 1, bloom: 0.55, bloomAt: 0.82, ao: 3 },
    { id: 2, name: "яркий день", bg: "#f2f4f7", floor: ["#ffffff", "#f7f8fa"], exposure: 1.15, ambient: 0.2, key: 1.9, fill: 1.35, glow: 1.1, bloom: 0.5, bloomAt: 0.85, ao: 2.2 },
    { id: 3, name: "контраст", bg: "#e3e6ea", floor: ["#fbfcfd", "#eceef1"], exposure: 1, ambient: 0.06, key: 2.6, fill: 0.7, glow: 1.35, bloom: 0.9, bloomAt: 0.72, ao: 4 },
    // Сумерки — выбранный вариант. Заливка поднята против первой редакции: там она была
    // срезана до 0.45, и вместе с фоном в тень уходили сами предметы — тумбы читались, а что
    // на них стоит, нет. Фон и пол оставлены тёмными, свечение маяка тоже: контраст «тёмная
    // сцена, горящий маяк» держится на них, а не на том, чтобы не досветить предмет.
    { id: 4, name: "сумерки", bg: "#cfd5dd", floor: ["#e7ebf0", "#d8dee6"], exposure: 0.88, ambient: 0.1, key: 1.15, fill: 0.78, glow: 2.0, bloom: 0.8, bloomAt: 0.76, ao: 3.2 },
];

export function lightPreset(n) {
    return LIGHT_PRESETS.find((p) => p.id === Number(n)) ?? LIGHT_PRESETS[0];
}
