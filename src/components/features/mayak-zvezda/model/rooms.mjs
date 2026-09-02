// Комната организации в шести состояниях. Уровень — это то, что стоит в комнате.
//
// Единицы — единицы набора Kenney Furniture Kit (CC0): floorFull ровно 1 × 1, стена высотой
// 1.29, столешница на 0.384. Реальный масштаб примерно вдвое меньше метрового, переводить
// незачем — от конвертации в метры появились бы только дроби.
//
// Уровни 1 и 2 перенесены из mayak-guide/roomKit.mjs без изменений: они сверены с эталонными
// кадрами public/zvezda/l1-rest.png и l2-rest.png по четырём точкам замера. Трогать их нельзя,
// не пересняв эталон. Уровни 3–6 добавлены здесь и калибруются кадром.
//
// Наборы описаны целиком, а не как «уровень N плюс правки»: так видно, что именно меняется,
// и не приходится держать в голове наслоение. Цена — повторы, и она осознанная.
//
// Замеры эталонов, по которым выставлен свет (это цвет В КАДРЕ, то есть альбедо, уже
// перемноженное со светом; в материалы такие числа подставлять нельзя):
//
//   поверхность            уровень 1   уровень 2
//   стена у окна           #775029     #7d6a5e
//   пятно света на стене   #dfaf6d     #d4c0ac
//   пол ближний            #342315     #3a2e26
//   фон вне комнаты        #0b0b0b     #0b0b0b

import { LEVELS, RAYS } from "./zvezda.mjs";

const mix = (a, b, t) => a + (b - a) * t;

export const KIT = "/zvezda-kit";

export function kitUrl(name) {
    return `${KIT}/${name}.${name === "interior" ? "hdr" : "glb"}`;
}

// Предметы, которых в наборе нет. Своя геометрия только там, где без неё нельзя: лепить
// примитивами то, что в наборе есть, — это верстать сайт, рисуя буквы полигонами.
// Серверная стойка нужна с четвёртого уровня и в наборе отсутствует (проверено: 33 модели,
// офисной техники кроме монитора и клавиатуры там нет).
export const OWN_PROPS = { rack: { size: [0.26, 0.62, 0.3], color: "#2f3338" } };

// Стена с окном темнее дальней на 12 % по альбедо. Она контражурная — ключ не попадает на неё
// никогда, — и разлёт яркостей 1.5–1.7, который есть на эталонных кадрах, набирается светом
// примерно на 1.4, остаток берётся отсюда. Без этого обе стены читаются одной плоскостью.
export const SHELL_TINT = { floor: "#8d6440", wall: "#cdbdaa", wallWindow: "#b3a290" };

export const ROOM = {
    tiles: 3, // 3 × 3 плитки пола
    windowLeft: 0, // окно в средней секции левой стены
    windowBack: null, // на дальней стене окон нет: там доска и шкаф
};

// Кресла в наборе ярко-розовые, в нашу палитру они не попадают ничем.
const SEAT = ["#4f5a4a", "#7a4b32", "#3f4a5c"];

// Одежда людей. Отдельно от SEAT, и это не косметика: пока цвет одежды брался из того же
// массива, что и обивка, сидящий человек сливался с креслом в одно пятно — на общем плане
// фигуры просто не было видно.
//
// Три правила подбора, все проверены кадром:
//   светлота разная — на мобильном фигура падает до 55 px, и различить их можно только по тону;
//   тёплый коричневый исключён — он совпадает с полом #8d6440 и фигура тонет в нём по пояс;
//   ни один не повторяет цвет своего кресла.
export const CLOTH = ["#dcd5c6", "#2f3b4c", "#3f5147"];

// Координаты — центр предмета на полу: модели центруются при загрузке.
const DESKS = [
    { at: [-0.85, 0, -0.62] },
    { at: [0.72, 0, -0.58] },
    { at: [-0.15, 0, 0.68] },
];

export const DESK_AT = DESKS.map((desk) => desk.at);

// Точка, вокруг которой собираются в такте «Сознание». Центр свободного пола, а не место у
// экрана: у стены группа перекрывается столами и читается одним пятном — проверено кадром.
export const GATHER = [0.15, 0, -0.05];

// Куда кладут привезённое, пока им никто не пользуется. В такте «Среда» новый предмет
// появляется здесь — на полу, не на столе. Это и есть смысл фазы: вещь есть, работают
// по-старому.
//
// Точки у дальней правой стены, а не у ближнего угла комнаты. Проверено кадром: ближний угол
// на изометрии приходится на нижнюю кромку экрана и закрыт подписью такта — привезённое там
// не видно вовсе, а люди, идущие за ним, уходят из кадра.
export const STAGING = [
    [-0.62, 0, -1.16],
    [0.18, 0, -1.2],
    [0.92, 0, -0.62],
];

// Привезённых вещей больше, чем точек выкладки: второй и третий ряд сдвигаются, иначе предметы
// встают друг в друга и читаются одной кучей.
export function stagingAt(index) {
    const spot = STAGING[index % STAGING.length];
    const row = Math.floor(index / STAGING.length);
    return [spot[0] + row * 0.19, 0, spot[2] + row * 0.13];
}

// Куда уносят бумагу. Урна стоит на всех уровнях, поэтому цель всегда существует.
export const DISPOSAL = [1.3, 0, 1.25];

export const PEOPLE = DESKS.map(({ at: [x, , z] }, i) => ({
    at: [x, 0, z + 0.44],
    cloth: CLOTH[i],
}));

const common = DESKS.flatMap(({ at: [x, , z] }, i) => [
    { name: "desk", at: [x, 0, z] },
    { name: "chairDesk", at: [x, 0, z + 0.44], tint: SEAT[i] },
]);

const WALL_SCREEN = [-0.1, 0.7, -1.42];
const SIDE_SCREEN = [-1.44, 0.7, -0.85];

// Что стоит на каждом уровне. Тег ray — принадлежность предмета лучу ЗВЕЗДЫ; он нужен только
// для подсветки зоны и ни на что в раскладке не влияет. Именно поэтому шесть уровней на шесть
// лучей не дают тридцати шести состояний: луч не меняет обстановку, он фильтрует уже стоящее.
export const LEVEL_PROPS = {
    // −1 «Хаос». Всё на бумаге: пузатые мониторы, стопки, коробки, шкаф нараспашку.
    1: [
        ...common,
        ...DESKS.map(({ at: [x, , z] }) => ({ name: "televisionVintage", at: [x, 0.384, z - 0.12], ray: "data" })),
        ...DESKS.map(({ at: [x, , z] }) => ({ name: "books", at: [x + 0.26, 0.384, z + 0.02], ray: "knowledge" })),
        { name: "bookcaseClosedDoors", at: [1.15, 0, -1.3], ray: "security" },
        { name: "cardboardBoxClosed", at: [-1.28, 0, 0.25], ray: "automation" },
        { name: "cardboardBoxOpen", at: [-1.22, 0, 0.85], spin: 0.3, ray: "automation" },
        { name: "cardboardBoxClosed", at: [0.4, 0, 1.28], spin: -0.2, ray: "automation" },
        { name: "cardboardBoxOpen", at: [1.25, 0, 0.55], spin: 0.5, ray: "automation" },
        { name: "cardboardBoxClosed", at: [0.15, 0, -1.32], ray: "automation" },
        { name: "books", at: [1.15, 0.85, -1.3], ray: "knowledge" },
        { name: "trashcan", at: DISPOSAL },
        { name: "bookcaseOpen", at: [-1.22, 0, -1.15], spin: Math.PI / 2, ray: "security" },
        { name: "rugRounded", at: [0.1, 0, 0.5] },
    ],
    // 0 «Информирование». Плоские экраны, коробки вывезли, на стене общий экран — пока
    // одностороннее вещание, сайт-визитка. Место освободилось, появилось растение.
    2: [
        ...common,
        ...DESKS.map(({ at: [x, , z] }) => ({ name: "computerScreen", at: [x, 0.384, z - 0.14], ray: "data" })),
        ...DESKS.map(({ at: [x, , z] }) => ({ name: "computerKeyboard", at: [x, 0.384, z + 0.1], ray: "data" })),
        { name: "bookcaseClosedDoors", at: [1.15, 0, -1.3], ray: "security" },
        { name: "televisionModern", at: WALL_SCREEN, ray: "space" },
        { name: "pottedPlant", at: [-1.28, 0, 1.1] },
        { name: "plantSmall2", at: [1.15, 0.85, -1.3] },
        { name: "trashcan", at: DISPOSAL },
        { name: "bookcaseOpen", at: [-1.22, 0, -1.15], spin: Math.PI / 2, ray: "security" },
        { name: "rugRounded", at: [0.1, 0, 0.5] },
        { name: "plantSmall2", at: [-1.3, 0, 0.35] },
    ],
    // +1 «Транзакция». Появился обмен в обе стороны: личные кабинеты, заявка онлайн. Ноутбук —
    // первое мобильное место. Открытый стеллаж с папками уходит: доступ теперь по правилам,
    // а не «шкаф у стены». У входа вешалка — посетитель приходит и уходит, а не сидит в очереди.
    3: [
        ...common,
        { name: "laptop", at: [DESKS[0].at[0], 0.384, DESKS[0].at[2] - 0.02], ray: "space" },
        ...DESKS.slice(1).map(({ at: [x, , z] }) => ({ name: "computerScreen", at: [x, 0.384, z - 0.14], ray: "data" })),
        ...DESKS.slice(1).map(({ at: [x, , z] }) => ({ name: "computerKeyboard", at: [x, 0.384, z + 0.1], ray: "data" })),
        { name: "bookcaseClosedDoors", at: [1.15, 0, -1.3], ray: "security" },
        { name: "televisionModern", at: WALL_SCREEN, ray: "space" },
        { name: "coatRackStanding", at: [-1.25, 0, 1.18], ray: "interaction" },
        { name: "sideTableDrawers", at: [1.28, 0, -0.35], ray: "interaction" },
        { name: "lampSquareTable", at: [1.28, 0.4, -0.35] },
        { name: "pottedPlant", at: [-1.3, 0, 0.35] },
        { name: "plantSmall2", at: [1.15, 0.85, -1.3] },
        { name: "trashcan", at: DISPOSAL },
        { name: "rugRounded", at: [0.1, 0, 0.5] },
    ],
    // +2 «Электронный результат». Процесс замкнулся в цифре: дашборд директора на боковой
    // стене, серверная стойка вместо шкафа с бумагой, второе мобильное место.
    4: [
        ...common,
        ...DESKS.slice(0, 2).map(({ at: [x, , z] }) => ({ name: "laptop", at: [x, 0.384, z - 0.02], ray: "space" })),
        { name: "computerScreen", at: [DESKS[2].at[0], 0.384, DESKS[2].at[2] - 0.14], ray: "data" },
        { name: "computerKeyboard", at: [DESKS[2].at[0], 0.384, DESKS[2].at[2] + 0.1], ray: "data" },
        { name: "rack", at: [1.15, 0, -1.3], ray: "security" },
        { name: "televisionModern", at: WALL_SCREEN, ray: "space" },
        { name: "televisionModern", at: SIDE_SCREEN, spin: Math.PI / 2, ray: "data" },
        { name: "coatRackStanding", at: [-1.25, 0, 1.18], ray: "interaction" },
        { name: "sideTableDrawers", at: [1.28, 0, -0.35], ray: "interaction" },
        { name: "lampSquareTable", at: [1.28, 0.4, -0.35] },
        { name: "pottedPlant", at: [-1.3, 0, 0.35] },
        { name: "pottedPlant", at: [1.3, 0, 0.9] },
        { name: "trashcan", at: DISPOSAL },
        { name: "rugRounded", at: [0.1, 0, 0.5] },
    ],
    // +3 «Интеллект». Все места мобильные, техника подсказывает: рядом со стойкой появляется
    // голосовой помощник, оба экрана живут. Хранение бумаги из комнаты ушло совсем.
    5: [
        ...common,
        ...DESKS.map(({ at: [x, , z] }) => ({ name: "laptop", at: [x, 0.384, z - 0.02], ray: "space" })),
        { name: "rack", at: [1.15, 0, -1.3], ray: "security" },
        { name: "speakerSmall", at: [1.28, 0.4, -0.35], ray: "automation" },
        { name: "televisionModern", at: WALL_SCREEN, ray: "space" },
        { name: "televisionModern", at: SIDE_SCREEN, spin: Math.PI / 2, ray: "data" },
        { name: "coatRackStanding", at: [-1.25, 0, 1.18], ray: "interaction" },
        { name: "sideTableDrawers", at: [1.28, 0, -0.35], ray: "interaction" },
        { name: "pottedPlant", at: [-1.3, 0, 0.35] },
        { name: "pottedPlant", at: [1.3, 0, 0.9] },
        { name: "plantSmall2", at: [-1.28, 0, 1.1] },
        { name: "trashcan", at: DISPOSAL },
        { name: "rugRounded", at: [0.1, 0, 0.5] },
    ],
    // +4 «Проактивность». Рутину система ведёт сама: одно рабочее место освободилось, комната
    // перестала быть операторской. Уровень визионерский — он и должен читаться как «здесь
    // меньше работы руками», а не как «здесь больше техники».
    6: [
        ...common,
        ...DESKS.slice(0, 2).map(({ at: [x, , z] }) => ({ name: "laptop", at: [x, 0.384, z - 0.02], ray: "space" })),
        { name: "rack", at: [1.15, 0, -1.3], ray: "security" },
        { name: "speakerSmall", at: [1.28, 0.4, -0.35], ray: "automation" },
        { name: "radio", at: [DESKS[2].at[0], 0.384, DESKS[2].at[2] - 0.05], ray: "automation" },
        { name: "televisionModern", at: WALL_SCREEN, ray: "space" },
        { name: "televisionModern", at: SIDE_SCREEN, spin: Math.PI / 2, ray: "data" },
        { name: "coatRackStanding", at: [-1.25, 0, 1.18], ray: "interaction" },
        { name: "sideTableDrawers", at: [1.28, 0, -0.35], ray: "interaction" },
        { name: "tableCoffee", at: [0.55, 0, 1.15] },
        { name: "pottedPlant", at: [-1.3, 0, 0.35] },
        { name: "pottedPlant", at: [1.3, 0, 0.9] },
        { name: "plantSmall2", at: [-1.28, 0, 1.1] },
        { name: "lampSquareFloor", at: [-1.32, 0, -0.5] },
        { name: "trashcan", at: DISPOSAL },
        { name: "rugRounded", at: [0.1, 0, 0.5] },
    ],
};

// Свет. Заполняющего источника нет намеренно: его роль играет карта окружения, она же
// подменяет отражённый от стен свет, которого в реальном времени не существует.
//
// Главное наблюдение из замеров: между уровнями сдвинута не только обстановка, но и
// температура. Первый — тёплый охристый, «лампа накаливания»; дальше светлее и холоднее.
// Этот сдвиг читается сильнее, чем смена мониторов, и делается светом, а не мебелью.
//
// Строки 1 и 2 — с эталонов. Строки 3–6 продолжают тот же ход и калибруются кадром: это
// ручка, а не вывод из формулы.
// Схема на три источника, а не на один. Причина замерена, а не выбрана на вкус: при одном ключе
// со стороны окна обе видимые стены освещались только картой окружения и читались как одна
// плоскость — отношение их яркостей 1.07 против 1.60 на эталонном кадре l2-rest.png и 1.70 на
// l1-rest.png. Плоский кадр брался именно отсюда, а не от бедных материалов.
//
//   key   тёплый, единственный с тенью, идёт сквозь окно и кладёт пятно на пол;
//   fill  холодный, без тени, со стороны +Z — он и разводит стены: на дальнюю даёт N·L 0.90,
//         на стену с окном 0.27, то есть разлёт 3.4 : 1 берётся с него;
//   hemi  замена отскоку: groundColor равен цвету пола, поэтому низ мебели теплеет снизу.
//
// Ключ по уровням РАСТЁТ, а не падает. В прежней таблице он убывал, и кадр к шестому уровню
// становился площе прежнего — ровно наоборот замыслу «выше уровень, светлее и собраннее».
//
// Приёмка числами, по эталонам из public/zvezda:
//   дальняя стена / стена с окном в sRGB — 1.5…1.7;
//   пятно света на полу / пол в тени — не ниже 2.2;
//   доля пикселей ярче L=230 — не ниже 0.3 % (в старой схеме было ровно 0.00 %).
export const LIGHT = {
    1: { key: "#ffb877", keyIntensity: 3.2, fill: "#6f86c0", fillIntensity: 0.62, hemi: 0.3, env: 0.3, exposure: 1, saturation: 0.06, contrast: 0.07, bloom: 0.5 },
    2: { key: "#ffd0a0", keyIntensity: 3.2, fill: "#7f9cc8", fillIntensity: 0.74, hemi: 0.34, env: 0.34, exposure: 1.02, saturation: 0.02, contrast: 0.06, bloom: 0.6 },
    3: { key: "#ffdcb8", keyIntensity: 3.3, fill: "#8aa8d0", fillIntensity: 0.86, hemi: 0.38, env: 0.38, exposure: 1.05, saturation: 0, contrast: 0.05, bloom: 0.7 },
    4: { key: "#ffe6cc", keyIntensity: 3.4, fill: "#93b4d8", fillIntensity: 0.98, hemi: 0.42, env: 0.44, exposure: 1.08, saturation: -0.02, contrast: 0.045, bloom: 0.8 },
    5: { key: "#fff0e0", keyIntensity: 3.5, fill: "#9cbde0", fillIntensity: 1.1, hemi: 0.46, env: 0.5, exposure: 1.1, saturation: -0.03, contrast: 0.04, bloom: 0.9 },
    6: { key: "#fff8f0", keyIntensity: 3.6, fill: "#a6c6e8", fillIntensity: 1.22, hemi: 0.5, env: 0.56, exposure: 1.12, saturation: -0.04, contrast: 0.035, bloom: 1 },
};

// Небо полусферы. Земля берётся из SHELL_TINT.floor — это не украшение, а способ подделать
// отскок от пола там, где настоящего отражённого света в реальном времени нет.
export const HEMI_SKY = "#a8c0d8";

// Экран на стене светится не на всех уровнях. На «Информировании» он висит тёмным: канал
// односторонний, смотреть на него незачем. Живым он становится там, где появляется обмен.
export const SCREEN_ON = { 1: false, 2: false, 3: true, 4: true, 5: true, 6: true };

export const PRELOAD = [
    ...new Set([
        "floorFull",
        "wall",
        "wallWindow",
        ...Object.values(LEVEL_PROPS)
            .flatMap((list) => list.map((prop) => prop.name))
            .filter((name) => !OWN_PROPS[name]),
    ]),
];

// Ключ предмета: имя плюс точка. Два одинаковых предмета в разных местах — разные предметы,
// один и тот же предмет на одном месте между уровнями — тот же самый, его не трогают.
export function propKey(prop) {
    return `${prop.name}@${prop.at.map((v) => v.toFixed(3)).join(",")}`;
}

// Что приезжает и что уезжает при переходе. Считается из самих наборов, а не описывается
// отдельно: иначе список переезда и списки уровней однажды разойдутся, и никто не заметит.
export function diffLevels(from, to) {
    const before = LEVEL_PROPS[from] ?? [];
    const after = LEVEL_PROPS[to] ?? [];
    const beforeKeys = new Set(before.map(propKey));
    const afterKeys = new Set(after.map(propKey));
    return {
        arriving: after.filter((prop) => !beforeKeys.has(propKey(prop))),
        leaving: before.filter((prop) => !afterKeys.has(propKey(prop))),
    };
}

// Раскладка сцены для конкретного шага истории. Возвращает список предметов, у каждого —
// куда он должен ехать сейчас (`at`), несёт ли его человек (`carrier`) и виден ли он вообще.
//
// Правило фаз (канон Среда → Деятельность → Сознание):
//   rest        — уровень как он есть;
//   environment — то же плюс привезённое, но привезённое стоит на полу и им не пользуются;
//   activity    — люди разносят привезённое по местам и уносят старое;
//   mind        — комната уже нового уровня: то, что освоено, стало нормой.
// `waypoint` делит такт «Деятельность» пополам: 0 — люди идут к стене, вынося старое;
// 1 — возвращаются на места с новым. Из-за этого деления предметы не ездят сами: у всего, что
// движется, есть несущий. Вещь, едущая по полу без человека, читается как поехавшая мебель.
export function sceneProps(level, phase, waypoint = 1) {
    const next = level + 1;
    const hasNext = Boolean(LEVEL_PROPS[next]);
    if (phase === "rest" || !hasNext) return LEVEL_PROPS[level].map((prop) => ({ ...prop, key: propKey(prop) }));

    const { arriving, leaving } = diffLevels(level, next);
    const leavingKeys = new Set(leaving.map(propKey));

    if (phase === "mind") return LEVEL_PROPS[next].map((prop) => ({ ...prop, key: propKey(prop) }));

    const carried = phase === "activity" && waypoint === 1;

    const staged = arriving.map((prop, index) => ({
        ...prop,
        key: propKey(prop),
        // В «Среде» и в первой половине «Деятельности» вещь лежит на полу у стены: за ней ещё
        // не пришли. На место она едет только в руках.
        at: carried ? prop.at : stagingAt(index),
        carrier: carried ? index % PEOPLE.length : null,
        // Номер в стопке: у одного человека в руках может оказаться несколько вещей, и без
        // сдвига по высоте они сливаются в один предмет.
        stack: Math.floor(index / PEOPLE.length),
        arriving: true,
    }));

    let leavingIndex = -1;
    const kept = LEVEL_PROPS[level].map((prop) => {
        const key = propKey(prop);
        if (!leavingKeys.has(key)) return { ...prop, key };
        // Уносят в такте «Деятельность», не раньше: пока работают по-старому, бумага на месте.
        if (phase !== "activity") return { ...prop, key };
        leavingIndex += 1;
        // Первая половина такта: старое у человека в руках, он идёт с ним от стола.
        if (!carried) {
            return { ...prop, key, carrier: leavingIndex % PEOPLE.length, stack: Math.floor(leavingIndex / PEOPLE.length), gone: true };
        }
        // Вторая половина: вынесли. Гаснет там, где было, а не улетает к урне само.
        return { ...prop, key, gone: true, fade: true, carrier: null };
    });

    return [...kept, ...staged];
}

// Где стоят люди на шаге истории. Возвращает по человеку: точка, куда идти, и точка, на
// которую смотреть. Направление взгляда считается из движения, поэтому здесь только цели.
export function scenePeople(level, phase) {
    const seats = PEOPLE.map((person) => person.at);
    if (phase === "activity") {
        // Пикап и возврат: первую половину такта человек идёт к привезённому, вторую — к столу.
        // Встаёт не в саму точку выкладки, а перед ней: иначе фигура въезжает в предмет.
        return seats.map((seat, index) => {
            const spot = STAGING[index % STAGING.length];
            return { seat, pickup: [spot[0] - 0.05, 0, spot[2] + 0.34] };
        });
    }
    if (phase === "mind") {
        // Сошлись у общего экрана: корпус развёрнут в одну точку — это и есть «стало общим».
        //
        // Дугой, а не шеренгой, и на открытом полу: проверено кадром, что при постановке в ряд
        // возле стола двое из троих оказываются за мебелью и группа читается одним пятном.
        // Не кольцо вокруг точки, а полшага от своего места к центру. Комната на девять плиток
        // с тремя столами: кольцо любого радиуса упирается в мебель, две фигуры из трёх
        // оказываются за монитором — проверено кадром дважды. Сдвиг от собственного места
        // сохраняет расстановку, и группа всё равно читается: все повёрнуты в одну точку.
        return seats.map((seat) => ({
            seat: [mix(seat[0], GATHER[0], 0.5), 0, mix(seat[2], GATHER[2], 0.5)],
            look: WALL_SCREEN,
        }));
    }
    return seats.map((seat) => ({ seat }));
}

export const RAY_IDS = RAYS.map((ray) => ray.id);
export const LEVEL_NS = LEVELS.map((level) => level.n);
