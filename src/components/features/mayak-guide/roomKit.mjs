// Раскладка комнаты из набора Kenney Furniture Kit (CC0) и свет по уровням.
//
// Единицы — единицы набора. У него всё на сетке: floorFull ровно 1 × 1, стена высотой
// 1.29, столешница на 0.384. Реальный масштаб примерно вдвое меньше метрового, но
// переводить незачем — от конвертации в метры появились бы только дроби.
//
// Замеры эталонных кадров (public/zvezda), по которым выставляется свет. Это цвет
// В КАДРЕ, то есть альбедо, уже перемноженное со светом, — в материалы такие числа
// подставлять нельзя, они годятся только как ориентир для источников:
//
//   поверхность            уровень 1   уровень 2
//   стена у окна           #775029     #7d6a5e
//   пятно света на стене   #dfaf6d     #d4c0ac
//   пол ближний            #342315     #3a2e26
//   фон вне комнаты        #0b0b0b     #0b0b0b
//
// Главное наблюдение из замеров: между уровнями сдвинута не только обстановка, но и
// температура. Уровень 1 — тёплый охристый, «лампа накаливания»; уровень 2 светлее и
// холоднее. Этот сдвиг читается сильнее, чем смена мониторов, и делается светом.

export const KIT = "/zvezda-kit";

export function kitUrl(name) {
    return `${KIT}/${name}.${name === "interior" ? "hdr" : "glb"}`;
}

export const SHELL_TINT = { floor: "#8d6440", wall: "#cdbdaa" };

export const ROOM = {
    tiles: 3, // 3 × 3 плитки пола
    windowLeft: 0, // окно в средней секции левой стены
    windowBack: null, // на дальней стене окон нет: там доска и шкаф
};

// Свет. Заполняющего источника нет намеренно: его роль играет карта окружения, она же
// подменяет отражённый от стен свет, которого в реальном времени не существует.
export const LIGHT = {
    1: { key: "#ffb877", keyIntensity: 3.1, env: 0.5, exposure: 1, saturation: 0.06, contrast: 0.07, bloom: 0.5 },
    2: { key: "#ffe0c4", keyIntensity: 2.5, env: 0.95, exposure: 1.1, saturation: -0.04, contrast: 0.04, bloom: 0.7 },
};

// Кресла в наборе ярко-розовые, в нашу палитру они не попадают ничем.
const SEAT = ["#4f5a4a", "#7a4b32", "#3f4a5c"];

// Координаты — центр предмета на полу: модели центруются при загрузке.
const DESKS = [
    { at: [-0.85, 0, -0.62] },
    { at: [0.72, 0, -0.58] },
    { at: [-0.15, 0, 0.68] },
];

// Что стоит на каждом уровне. Разница между уровнями — это и есть содержание истории,
// поэтому наборы описаны целиком, а не как «уровень 2 = уровень 1 плюс правки»: так
// видно, что именно меняется, и не приходится держать в голове наслоение.
const common = DESKS.flatMap(({ at: [x, , z] }, i) => [
    { name: "desk", at: [x, 0, z] },
    { name: "chairDesk", at: [x, 0, z + 0.44], tint: SEAT[i] },
]);

// Люди сидят в креслах. Собираются не из набора — фигур в нём нет.
export const PEOPLE = DESKS.map(({ at: [x, , z] }, i) => ({
    at: [x, 0, z + 0.44],
    cloth: SEAT[i],
}));

export const LEVEL_PROPS = {
    // Уровень 1 «Осознание»: пузатые мониторы, бумаги и коробки повсюду, шкаф забит.
    1: [
        ...common,
        ...DESKS.map(({ at: [x, , z] }) => ({ name: "televisionVintage", at: [x, 0.384, z - 0.12] })),
        ...DESKS.map(({ at: [x, , z] }) => ({ name: "books", at: [x + 0.26, 0.384, z + 0.02] })),
        { name: "bookcaseClosedDoors", at: [1.15, 0, -1.3] },
        { name: "cardboardBoxClosed", at: [-1.28, 0, 0.25] },
        { name: "cardboardBoxOpen", at: [-1.22, 0, 0.85], spin: 0.3 },
        { name: "cardboardBoxClosed", at: [0.4, 0, 1.28], spin: -0.2 },
        { name: "cardboardBoxOpen", at: [1.25, 0, 0.55], spin: 0.5 },
        { name: "cardboardBoxClosed", at: [0.15, 0, -1.32] },
        { name: "books", at: [1.15, 0.85, -1.3] },
        { name: "trashcan", at: [1.3, 0, 1.25] },
        { name: "bookcaseOpen", at: [-1.22, 0, -1.15], spin: Math.PI / 2 },
        { name: "rugRounded", at: [0.1, 0, 0.5] },
    ],
    // Уровень 2 «Фундамент»: плоские экраны с клавиатурами, коробки вывезли, на стене
    // общий экран, на подоконном углу появилось растение — место освободилось.
    2: [
        ...common,
        ...DESKS.map(({ at: [x, , z] }) => ({ name: "computerScreen", at: [x, 0.384, z - 0.14] })),
        ...DESKS.map(({ at: [x, , z] }) => ({ name: "computerKeyboard", at: [x, 0.384, z + 0.1] })),
        { name: "bookcaseClosedDoors", at: [1.15, 0, -1.3] },
        { name: "televisionModern", at: [-0.1, 0.7, -1.42] },
        { name: "pottedPlant", at: [-1.28, 0, 1.1] },
        { name: "plantSmall2", at: [1.15, 0.85, -1.3] },
        { name: "trashcan", at: [1.3, 0, 1.25] },
        { name: "bookcaseOpen", at: [-1.22, 0, -1.15], spin: Math.PI / 2 },
        { name: "rugRounded", at: [0.1, 0, 0.5] },
        { name: "plantSmall2", at: [-1.3, 0, 0.35] },
    ],
};

export const PRELOAD = [
    ...new Set([
        "floorFull",
        "wall",
        "wallWindow",
        "wallCorner",
        ...Object.values(LEVEL_PROPS).flatMap((list) => list.map((prop) => prop.name)),
    ]),
];
