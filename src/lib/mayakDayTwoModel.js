// День 2: модель дня без серверных зависимостей — шаблон колоды, проверки,
// расчёт этапа и «следующего шага». Файл импортируют и API (через
// mayakDayTwoStore), и страница администратора в браузере, поэтому здесь нет
// fs/path. Схема дня — КОНСТРУКТОР_ДНЯ2.md, раздел 2; этапы — АДМИН_ДЕНЬ2.md,
// раздел 3.

export const DAY_TWO_SCHEMA = "mayak-day2/1";

// Шаблон 19 карточек (СЕССИЯ_1109.json): тексты не зависят от продукта,
// меняются только организация и столы. Порядок — порядок дня.
export const DAY_TWO_TEMPLATE_CARDS = [
    {
        "num": 8101,
        "kind": "intro",
        "pill": "СТАРТ",
        "title": "Как устроен день",
        "mins": 5,
        "why": "Девятнадцать карточек за день: сначала целое, потом части, потом снова целое.",
        "task": "Прочитайте карту дня, найдите свой гекс.",
        "submit": "Ничего. Нажмите «Завершить».",
        "done": "Вы знаете номер своего гекса и своей пары.",
        "hint": null,
        "notes": "",
        "hexes": [],
        "figure": "изделие",
        "tool": null,
        "file": ""
    },
    {
        "num": 8102,
        "kind": "intro",
        "pill": "СТАРТ",
        "title": "Ваш гекс и ваша пара",
        "mins": 5,
        "why": "У каждого своё направление, у каждой пары свой узел, у стола одно изделие.",
        "task": "Положите руку на свой гекс на столе.",
        "submit": "Ничего. Нажмите «Завершить».",
        "done": "Сосед по гексу знает, что вы его пара.",
        "hint": null,
        "notes": "Роль в платформе выбирает только один человек за столом: гекс 16 нажимает «Выбрать роль» → Инспектор. Остальные роль не выбирают.",
        "hexes": [],
        "figure": "узел 11 12",
        "tool": null,
        "file": ""
    },
    {
        "num": 8103,
        "kind": "intro",
        "pill": "СТАРТ",
        "title": "Как сдавать",
        "mins": 5,
        "why": "Каждая карточка сдаётся одинаково, шесть шагов, всегда одни и те же.",
        "task": "Запомните шесть шагов: промпт, сова, нейросеть, «Завершить», окно сдачи, инспектор.",
        "submit": "Ничего. Нажмите «Завершить».",
        "done": "Вы знаете, что в окне сдачи можно написать текст, а файл — по желанию.",
        "hint": null,
        "notes": "Кнопка «Завершить» открывает окно сдачи: туда вставляют текст ответа или прикладывают файл (docx, pdf, png, jpg), потом «Отправить инспектору». Сова оценивает промпт, инспектор соседнего стола смотрит ответ. Истекло — значит принято. Если экран стал другим — откройте ссылку из мессенджера заново.",
        "hexes": [],
        "figure": "приёмка 6",
        "tool": null,
        "file": ""
    },
    {
        "num": 8104,
        "kind": "point0",
        "pill": "СТАРТ",
        "title": "Точка 0",
        "mins": 40,
        "why": "Шесть человек за столом должны одними словами сказать, кому нужен ваш продукт. Иначе шесть деталей будут про шесть разных продуктов.",
        "task": "Опишите ваш продукт: кто пользуется, что болит, что изменится.",
        "submit": "Три строки текстом в окно сдачи. Сдаёт один человек, стол выбирает кого.",
        "done": "Любой за столом повторяет три строки без бумажки.",
        "hint": {
            "m": "нарисовать первый экран продукта",
            "a": "ваш пользователь",
            "ya": "дизайнер интерфейсов",
            "k": "просто, один экран",
            "o1": "три элемента",
            "k2": "покажем на питче",
            "o2": "картинка png"
        },
        "notes": "Семь полей выше — для тех, кто успел раньше: нарисуйте первый экран нейросетью, картинка пригодится на питче. Три строки потом идут в поля «Аудитория» и «Контекст» каждого вашего промпта. Инспектору: принимай, если есть все три строки и они про одного пользователя.",
        "hexes": [],
        "figure": "точка",
        "tool": {
            "name": "GigaChat, картинки",
            "url": "https://giga.chat/"
        },
        "file": ""
    },
    {
        "num": 8105,
        "kind": "pitch",
        "pill": "ПИТЧ",
        "title": "Первый экран",
        "mins": 20,
        "why": "Три стола видят три продукта и понимают, чем отличаются.",
        "task": "Расскажите за три минуты: ваш продукт, пользователь, первый экран.",
        "submit": "Файла нет. Нажмите «Завершить», в окне напишите «сделано», отправьте инспектору.",
        "done": "Соседний стол назвал ваш продукт одной фразой.",
        "hint": null,
        "notes": "",
        "hexes": [],
        "figure": "питч",
        "tool": null,
        "file": ""
    },
    {
        "num": 8106,
        "kind": "detail",
        "pill": "ДЕТАЛЬ",
        "title": "11 Знания и навыки",
        "mins": 80,
        "why": "Пользователь должен понять ваш продукт без обучения.",
        "task": "Напишите пять вопросов пользователя и пять ответов, по строке.",
        "submit": "Ответ нейросети — текстом в окно сдачи. Если длинный — файлом 11_znaniya.docx.",
        "done": "Каждый ответ помещается в одну строку.",
        "hint": {
            "m": "вопросы и ответы",
            "a": "пользователь продукта",
            "ya": "методист",
            "k": "понятно, коротко",
            "o1": "пять пар, строка на ответ",
            "k2": "экран помощи в продукте",
            "o2": "таблица в два столбца"
        },
        "notes": "Пока проверяют — откройте карточку узла. Истекло — значит принято. Образец строки: «Как записаться? — Кнопка «Записаться» на странице занятия».",
        "hexes": [11],
        "figure": "гекс 11",
        "tool": null,
        "file": ""
    },
    {
        "num": 8107,
        "kind": "detail",
        "pill": "ДЕТАЛЬ",
        "title": "12 Внешние взаимодействия",
        "mins": 80,
        "why": "Ваш продукт живёт среди других людей и систем.",
        "task": "Назовите трёх партнёров снаружи: что даёт, что получает.",
        "submit": "Ответ нейросети — текстом в окно сдачи. Если длинный — файлом 12_vneshnie.docx.",
        "done": "У каждого партнёра есть контакт или система.",
        "hint": {
            "m": "список партнёров",
            "a": "руководитель",
            "ya": "аналитик процессов",
            "k": "конкретно, с именами систем",
            "o1": "три строки",
            "k2": "договорённости на первый месяц",
            "o2": "таблица: партнёр, даёт, получает"
        },
        "notes": "Пока проверяют — откройте карточку узла. Истекло — значит принято. Образец строки: «Бухгалтерия · даёт список взносов · получает отметку о выдаче».",
        "hexes": [12],
        "figure": "гекс 12",
        "tool": null,
        "file": ""
    },
    {
        "num": 8108,
        "kind": "detail",
        "pill": "ДЕТАЛЬ",
        "title": "13 Данные и аналитика",
        "mins": 80,
        "why": "Ваш продукт считает, а не только показывает.",
        "task": "Составьте таблицу из шести полей и четыре итоговых числа.",
        "submit": "Ответ нейросети — текстом в окно сдачи. Если длинный — файлом 13_dannye.docx.",
        "done": "Каждое число можно посчитать по таблице вручную.",
        "hint": {
            "m": "схема данных",
            "a": "сборщик",
            "ya": "проектировщик баз",
            "k": "минимально, без лишних полей",
            "o1": "шесть полей, четыре итога",
            "k2": "экран организатора",
            "o2": "таблица полей и список чисел с формулой словами"
        },
        "notes": "Пока проверяют — откройте карточку узла. Истекло — значит принято. Образец: поля билет · сегмент · регион · позиция · сумма · дата; число «получено за год, ₽».",
        "hexes": [13],
        "figure": "гекс 13",
        "tool": null,
        "file": ""
    },
    {
        "num": 8109,
        "kind": "detail",
        "pill": "ДЕТАЛЬ",
        "title": "14 Автоматизация",
        "mins": 80,
        "why": "Что ваш продукт делает сам, без человека.",
        "task": "Опишите три шага, которые продукт делает сам: когда, что, кому.",
        "submit": "Ответ нейросети — текстом в окно сдачи. Если длинный — файлом 14_avtomat.docx.",
        "done": "У каждого шага есть событие, которое его запускает.",
        "hint": {
            "m": "автоматические действия",
            "a": "сборщик",
            "ya": "инженер процессов",
            "k": "точно, по событиям",
            "o1": "три шага",
            "k2": "уведомления и напоминания",
            "o2": "таблица: событие, действие, получатель"
        },
        "notes": "Пока проверяют — откройте карточку узла. Истекло — значит принято. Образец строки: «Наступило 1-е число → продукт считает сумму за месяц → письмо председателю».",
        "hexes": [14],
        "figure": "гекс 14",
        "tool": null,
        "file": ""
    },
    {
        "num": 8110,
        "kind": "detail",
        "pill": "ДЕТАЛЬ",
        "title": "15 Единое цифровое пространство",
        "mins": 80,
        "why": "Пользователь видит экраны вашего продукта, а не таблицы.",
        "task": "Нарисуйте три экрана продукта: что на каждом, одна кнопка.",
        "submit": "Три картинки — файлом 15_ekrany.pdf (вставьте в Word, сохраните как pdf) или три png по одной.",
        "done": "С любого экрана понятно, куда нажать дальше.",
        "hint": {
            "m": "три экрана продукта",
            "a": "пользователь",
            "ya": "дизайнер интерфейсов",
            "k": "просто, одна кнопка на экран",
            "o1": "три экрана",
            "k2": "телефон",
            "o2": "три картинки с подписями"
        },
        "notes": "Пока проверяют — откройте карточку узла. Истекло — значит принято. Образец подписи экрана: «Экран 1 · Моя подписка · кнопка «Мой счёт»».",
        "hexes": [15],
        "figure": "гекс 15",
        "tool": {
            "name": "GigaChat, картинки",
            "url": "https://giga.chat/"
        },
        "file": ""
    },
    {
        "num": 8111,
        "kind": "detail",
        "pill": "ДЕТАЛЬ",
        "title": "16 Защита данных",
        "mins": 80,
        "why": "В вашем продукте каждый видит только своё.",
        "task": "Заполните таблицу: роль, что видит, что не видит.",
        "submit": "Ответ нейросети — текстом в окно сдачи. Если длинный — файлом 16_dostup.docx.",
        "done": "Есть роль «посторонний», ей видно меньше всех.",
        "hint": {
            "m": "права доступа",
            "a": "сборщик",
            "ya": "специалист по защите данных",
            "k": "строго, без исключений",
            "o1": "четыре роли",
            "k2": "вход в продукт",
            "o2": "таблица: роль, видит, не видит"
        },
        "notes": "Пока проверяют — откройте карточку узла. Истекло — значит принято. Образец строки: «Посторонний · видит список занятий · не видит работы и фамилии».",
        "hexes": [16],
        "figure": "гекс 16",
        "tool": null,
        "file": ""
    },
    {
        "num": 8112,
        "kind": "node",
        "pill": "УЗЕЛ",
        "title": "11+12 Как пользуются",
        "mins": 60,
        "why": "Знания и внешние связи вместе дают путь пользователя.",
        "task": "Соберите один файл: путь пользователя от входа до результата.",
        "submit": "Файл uzel_11_12.docx. Сдаёт человек с гекса 11.",
        "done": "В пути есть каждый вопрос из 11 и партнёр из 12.",
        "hint": {
            "m": "сценарий пользователя",
            "a": "сборщик",
            "ya": "методист",
            "k": "по шагам, без пропусков",
            "o1": "не больше семи шагов",
            "k2": "приложите файлы 11 и 12",
            "o2": "нумерованный список шагов."
        },
        "notes": "",
        "hexes": [11, 12],
        "figure": "узел 11 12",
        "tool": null,
        "file": ""
    },
    {
        "num": 8113,
        "kind": "node",
        "pill": "УЗЕЛ",
        "title": "13+14 Как считает",
        "mins": 60,
        "why": "Данные и автоматизация вместе дают логику продукта.",
        "task": "Соберите один файл: таблица данных и три автоматических шага.",
        "submit": "Файл uzel_13_14.docx. Сдаёт человек с гекса 13.",
        "done": "Каждый шаг меняет одно поле таблицы.",
        "hint": {
            "m": "логика продукта",
            "a": "сборщик",
            "ya": "системный аналитик",
            "k": "связно, поле к шагу",
            "o1": "одна таблица, три шага",
            "k2": "приложите файлы 13 и 14",
            "o2": "таблица и список."
        },
        "notes": "",
        "hexes": [13, 14],
        "figure": "узел 13 14",
        "tool": null,
        "file": ""
    },
    {
        "num": 8114,
        "kind": "node",
        "pill": "УЗЕЛ",
        "title": "15+16 Как выглядит и кому видно",
        "mins": 60,
        "why": "Экраны и доступы вместе дают интерфейс.",
        "task": "Отметьте на трёх экранах, какой роли что видно.",
        "submit": "Файл uzel_15_16.pdf. Сдаёт человек с гекса 15.",
        "done": "На каждом экране подписаны роли.",
        "hint": {
            "m": "экраны с ролями",
            "a": "сборщик",
            "ya": "дизайнер интерфейсов",
            "k": "наглядно",
            "o1": "три экрана, четыре роли",
            "k2": "приложите файлы 15 и 16",
            "o2": "три картинки с подписями ролей."
        },
        "notes": "",
        "hexes": [15, 16],
        "figure": "узел 15 16",
        "tool": null,
        "file": ""
    },
    {
        "num": 8115,
        "kind": "pitch",
        "pill": "ПИТЧ",
        "title": "Три узла",
        "mins": 30,
        "why": "Весь стол видит ваш продукт целиком до сборки.",
        "task": "Расскажите три узла за три минуты, по минуте на пару.",
        "submit": "Файла нет. Нажмите «Завершить», в окне напишите «сделано», отправьте инспектору.",
        "done": "Мастер назвал, какой узел сборщик берёт первым.",
        "hint": null,
        "notes": "",
        "hexes": [],
        "figure": "питч",
        "tool": null,
        "file": ""
    },
    {
        "num": 8116,
        "kind": "assembly",
        "pill": "СБОРКА",
        "title": "Изделие",
        "mins": 90,
        "why": "Три узла становятся вашим продуктом с адресом в интернете.",
        "task": "Соберите продукт: сборщик отдаёт три узла агенту по промпту.",
        "submit": "Адрес продукта (ссылка на папку стола) текстом в окно сдачи.",
        "done": "Продукт открывается с чужого телефона по адресу.",
        "hint": null,
        "notes": "Агент — нейросеть, которая по промпту сборщика пишет файлы и выкладывает их в папку стола. Промпт сборщику готов, менять его не нужно. Остальные пятеро в это время правят тексты и картинки в узлах и проверяют ссылки: сборщик берёт правки в сборку.",
        "hexes": [],
        "figure": "изделие",
        "tool": {
            "name": "Промпт сборщику",
            "url": "{folder}agent.html"
        },
        "file": ""
    },
    {
        "num": 8117,
        "kind": "acceptance",
        "pill": "ПРИЁМКА",
        "title": "Семь шагов",
        "mins": 30,
        "why": "Ваш продукт проверяет посторонний, а не автор.",
        "task": "Позовите человека соседнего стола пройти семь шагов, молча.",
        "submit": "Файл priemka.docx: скриншоты и места, где он споткнулся.",
        "done": "Семь шагов из семи пройдены или есть список починки.",
        "hint": null,
        "notes": "",
        "hexes": [],
        "figure": "приёмка",
        "tool": {
            "name": "Семь шагов",
            "url": "{folder}priemka.html"
        },
        "file": ""
    },
    {
        "num": 8118,
        "kind": "pitch",
        "pill": "ПИТЧ",
        "title": "Изделие",
        "mins": 30,
        "why": "Заказчик видит, что ваш продукт работает.",
        "task": "Покажите за пять минут: адрес, путь пользователя, что не успели.",
        "submit": "Файла нет. Нажмите «Завершить», в окне напишите «сделано», отправьте инспектору.",
        "done": "Заказчик записал одно замечание.",
        "hint": null,
        "notes": "",
        "hexes": [],
        "figure": "питч",
        "tool": null,
        "file": ""
    },
    {
        "num": 8119,
        "kind": "roadmap",
        "pill": "КАРТА",
        "title": "Шесть месяцев",
        "mins": 40,
        "why": "Ваш продукт живёт дальше без нас: первые треки через 2, 4 и 7 недель.",
        "task": "Заполните карту: 2, 4, 7 недель, 3, 5, 6 месяцев.",
        "submit": "karta.docx. Шаблон — в поле «Файл» карточки.",
        "done": "В каждой строке фамилия и число, например: 30 пользователей к декабрю.",
        "hint": {
            "m": "план на шесть месяцев",
            "a": "руководитель",
            "ya": "руководитель проекта",
            "k": "реалистично, одна строка на трек",
            "o1": "шесть строк: 2, 4, 7 недель, 3, 5, 6 месяцев",
            "k2": "проверка на каждом треке",
            "o2": "таблица: срок, что сделано, кто, как проверим."
        },
        "notes": "",
        "hexes": [],
        "figure": "карта",
        "tool": null,
        "file": "8119.docx"
    }
];

export const DAY_TWO_KIND_NAMES = {
    intro: "Вводная",
    point0: "Точка 0",
    pitch: "Питч",
    detail: "Деталь",
    node: "Узел",
    assembly: "Сборка",
    acceptance: "Приёмка",
    roadmap: "Дорожная карта",
};

export const DAY_TWO_HEX_LABELS = {
    11: "Знания и навыки",
    12: "Внешние взаимодействия",
    13: "Данные и аналитика",
    14: "Автоматизация",
    15: "Единое цифровое пространство",
    16: "Защита данных",
};

// Состав дня: 3 вводные · точка 0 · 6 деталей · 3 узла · сборка · приёмка · карта.
export const DAY_TWO_COMPOSITION = [
    ["intro", 3],
    ["point0", 1],
    ["detail", 6],
    ["node", 3],
    ["assembly", 1],
    ["acceptance", 1],
    ["roadmap", 1],
];

const TABLE_KINDS = new Set(["point0", "assembly", "acceptance", "roadmap"]);

export const DAY_TWO_TRACKS = [
    { key: "w2", label: "2 нед", days: 14 },
    { key: "w4", label: "4 нед", days: 28 },
    { key: "w7", label: "7 нед", days: 49 },
    { key: "m3", label: "3 мес", months: 3 },
    { key: "m5", label: "5 мес", months: 5 },
    { key: "m6", label: "6 мес", months: 6 },
];

export const TRACK_MARKS = ["", "✓", "~", "×"];

export const DAY_TWO_STAGE_TITLES = ["Бриф", "Колода", "Раздел", "Сессия", "Рассылка", "День", "Выгрузка", "Завершение", "Треки"];

// День заканчивается в 20:00 по Москве; сессия живёт 48 часов от создания,
// поэтому создавать её можно не раньше чем за 47 часов до конца дня.
export const DAY_END_SUFFIX = "T20:00:00+03:00";
export const SESSION_LEAD_HOURS = 47;
export const DEFAULT_TABLE_COUNT = 3;
export const DEFAULT_PARTICIPANT_LIMIT = 60;

function str(value) {
    return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function int(value, fallback = 0) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function countTaskWords(task) {
    return (String(task || "").match(/[А-Яа-яA-Za-z0-9ёЁ«»\-]+/g) || []).length;
}

export function emptyTables(count = DEFAULT_TABLE_COUNT) {
    return Array.from({ length: count }, (_, i) => ({ n: i + 1, product: "", user: "", pain: "", after6m: "", url: "" }));
}

export function emptyTracks(tables = []) {
    const tracks = {};
    (tables || []).forEach((table) => {
        tracks[String(table.n)] = DAY_TWO_TRACKS.map(() => "");
    });
    return tracks;
}

export function normalizeTable(input = {}, index = 0) {
    return {
        n: int(input.n, index + 1) || index + 1,
        product: str(input.product),
        user: str(input.user),
        pain: str(input.pain),
        after6m: str(input.after6m),
        url: str(input.url),
    };
}

export function normalizeHint(input) {
    if (!input || typeof input !== "object") return null;
    const hint = {};
    ["m", "a", "ya", "k", "o1", "k2", "o2"].forEach((key) => {
        hint[key] = str(input[key]);
    });
    return Object.values(hint).some(Boolean) ? hint : null;
}

export function normalizeCard(input = {}) {
    const tool = input.tool && typeof input.tool === "object" && (str(input.tool.name) || str(input.tool.url)) ? { name: str(input.tool.name), url: str(input.tool.url) } : null;
    return {
        num: int(input.num, 0),
        kind: str(input.kind) || "other",
        pill: str(input.pill),
        title: str(input.title),
        mins: int(input.mins, 0),
        why: str(input.why),
        task: str(input.task),
        submit: str(input.submit),
        done: str(input.done),
        hint: normalizeHint(input.hint),
        notes: str(input.notes),
        hexes: Array.isArray(input.hexes) ? input.hexes.map((h) => int(h, 0)).filter(Boolean) : [],
        figure: str(input.figure),
        tool,
        file: str(input.file),
    };
}

export function cloneTemplateCards() {
    return DAY_TWO_TEMPLATE_CARDS.map((card) => normalizeCard(JSON.parse(JSON.stringify(card))));
}

// День из брифа: карточки шаблона, столы по умолчанию три.
export function buildDayFromTemplate(brief = {}) {
    const tables = Array.isArray(brief.tables) && brief.tables.length ? brief.tables.map(normalizeTable) : emptyTables();
    return {
        schema: DAY_TWO_SCHEMA,
        org: str(brief.org),
        date: str(brief.date),
        tables,
        folder_url: str(brief.folder_url),
        logo: str(brief.logo),
        allowed_files: str(brief.allowed_files) || "docx, pdf, png, jpg",
        cards: brief.fromTemplate === false ? [] : cloneTemplateCards(),
        sectionId: "",
        session: null,
        published: null,
        mailed: false,
        completed: false,
        dayState: null,
        results: null,
        tracks: emptyTracks(tables),
        notes: {},
    };
}

// Те же проверки, что в day2-tools/md2json.py.
export function validateDay(day) {
    const problems = [];
    const cards = Array.isArray(day?.cards) ? day.cards : [];
    if (cards.length === 0) {
        return { ok: false, problems: ["колода пуста: соберите день из шаблона или загрузите JSON"] };
    }
    const seen = new Set();
    cards.forEach((card) => {
        const num = card?.num || "?";
        const kind = card?.kind || "other";
        const hexes = Array.isArray(card?.hexes) ? card.hexes : [];
        if (!card?.num) problems.push(`${num}: нет номера карточки`);
        if (seen.has(num)) problems.push(`${num}: номер повторяется`);
        seen.add(num);
        if (!str(card?.title)) problems.push(`${num}: нет заголовка`);
        const words = countTaskWords(card?.task);
        if (words > 10 && kind !== "intro") problems.push(`${num}: задание ${words} слов`);
        if (String(card?.why || "").includes("\n")) problems.push(`${num}: «зачем» не одна строка`);
        if (kind === "detail" && hexes.length !== 1) problems.push(`${num}: у детали должен быть один гекс`);
        if (kind === "node" && hexes.length !== 2) problems.push(`${num}: у узла должно быть два гекса`);
        if (TABLE_KINDS.has(kind) && hexes.length) problems.push(`${num}: у карты стола нет гексов`);
        if (kind !== "intro" && !str(card?.submit)) problems.push(`${num}: нет «сдать»`);
        if (kind !== "intro" && !str(card?.done)) problems.push(`${num}: нет «готово»`);
    });
    const kinds = cards.map((card) => card?.kind || "other");
    DAY_TWO_COMPOSITION.forEach(([kind, count]) => {
        const have = kinds.filter((k) => k === kind).length;
        if (have !== count) problems.push(`вид ${kind}: ${have} карт вместо ${count}`);
    });
    return { ok: problems.length === 0, problems };
}

export function dayEndAt(date) {
    const ts = Date.parse(`${str(date)}${DAY_END_SUFFIX}`);
    return Number.isFinite(ts) ? ts : NaN;
}

export function sessionEarliestAt(date) {
    const end = dayEndAt(date);
    return Number.isFinite(end) ? end - SESSION_LEAD_HOURS * 60 * 60 * 1000 : NaN;
}

export function formatMsk(ms, { withTime = true } = {}) {
    if (!Number.isFinite(ms)) return "";
    const options = { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit" };
    if (withTime) {
        options.hour = "2-digit";
        options.minute = "2-digit";
    }
    return new Date(ms).toLocaleString("ru-RU", options).replace(",", "");
}

function pad(value) {
    return String(value).padStart(2, "0");
}

// Даты треков от даты дня: 14, 28, 49 дней; 3, 5, 6 месяцев.
export function trackDates(date) {
    const base = new Date(`${str(date)}T12:00:00Z`);
    if (!str(date) || Number.isNaN(base.getTime())) {
        return DAY_TWO_TRACKS.map((track) => ({ ...track, date: "", short: "" }));
    }
    return DAY_TWO_TRACKS.map((track) => {
        const d = new Date(base.getTime());
        if (track.days) d.setUTCDate(d.getUTCDate() + track.days);
        if (track.months) d.setUTCMonth(d.getUTCMonth() + track.months);
        return {
            ...track,
            date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
            short: `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}`,
        };
    });
}

export function briefProblems(day) {
    const problems = [];
    if (!str(day?.org)) problems.push("нет организации");
    if (!str(day?.date) || !Number.isFinite(dayEndAt(day.date))) problems.push("нет даты дня");
    const tables = Array.isArray(day?.tables) ? day.tables : [];
    if (tables.length < 1) problems.push("нет столов");
    tables.forEach((table) => {
        const missing = [];
        if (!str(table?.product)) missing.push("продукт");
        if (!str(table?.user)) missing.push("кому");
        if (!str(table?.pain)) missing.push("боль");
        if (!str(table?.after6m)) missing.push("через полгода");
        if (missing.length) problems.push(`стол ${table?.n}: ${missing.join(", ")}`);
    });
    return problems;
}

// H4e: предупреждения брифа — не блокируют этап, но подсказывают, что участники
// не поймут формулировку из одного-двух слов.
export const BRIEF_MIN_WORDS = 3;
// Реплики заказчика для сборки столов нейросетью (H5): предел длины текста.
export const BRIEF_TEXT_MAX = 10000;

export function briefWarnings(day) {
    const warnings = [];
    const tables = Array.isArray(day?.tables) ? day.tables : [];
    tables.forEach((table) => {
        [
            ["user", "кому"],
            ["pain", "боль"],
            ["after6m", "через полгода"],
        ].forEach(([key, label]) => {
            const text = str(table?.[key]);
            if (text && countTaskWords(text) < BRIEF_MIN_WORDS) warnings.push(`стол ${table?.n}, «${label}»: слишком коротко, участники не поймут`);
        });
    });
    return warnings;
}

function isPublishedFresh(day) {
    const published = day?.published;
    if (!published?.sectionId || !day?.sectionId || published.sectionId !== day.sectionId) return false;
    if (day.cardsUpdatedAt && published.at && String(day.cardsUpdatedAt) > String(published.at)) return false;
    return true;
}

function tracksAllMarked(day) {
    const tables = Array.isArray(day?.tables) ? day.tables : [];
    if (!tables.length) return false;
    return tables.every((table) => {
        const row = day?.tracks?.[String(table.n)];
        return Array.isArray(row) && row.length === DAY_TWO_TRACKS.length && row.every((cell) => Boolean(cell));
    });
}

function nextUnmarkedTrack(day) {
    const dates = trackDates(day?.date);
    const tables = Array.isArray(day?.tables) ? day.tables : [];
    for (let i = 0; i < DAY_TWO_TRACKS.length; i += 1) {
        const open = tables.some((table) => !day?.tracks?.[String(table.n)]?.[i]);
        if (open) return dates[i];
    }
    return null;
}

// Номер первого незакрытого этапа 1..9 и «следующий шаг»: текст и одна кнопка.
// action — что делает кнопка на странице: open:<n> (раскрыть этап), template,
// publish, session, snapshot, complete.
export function computeStage(day, now = Date.now()) {
    const checks = validateDay(day);
    const brief = briefProblems(day);
    const tables = Array.isArray(day?.tables) ? day.tables : [];
    const dayEnd = dayEndAt(day?.date);
    const dayPassed = Number.isFinite(dayEnd) && now > dayEnd;
    const roadmapAllAccepted = Boolean(day?.dayState) && tables.length > 0 && Number(day.dayState.roadmapAccepted || 0) >= tables.length;

    const done = [
        brief.length === 0,
        checks.ok,
        checks.ok && isPublishedFresh(day),
        Boolean(day?.session?.id),
        Boolean(day?.mailed),
        roadmapAllAccepted || dayPassed,
        Boolean(day?.results?.at),
        Boolean(day?.completed),
        tracksAllMarked(day),
    ];

    let stage = done.findIndex((flag) => !flag) + 1;
    if (stage === 0) stage = 9;

    let next = { text: "", label: "", action: "", disabled: false };
    switch (stage) {
        case 1:
            next = { text: `Заполните бриф: ${brief.join("; ")}`, label: "Открыть бриф", action: "open:1" };
            break;
        case 2:
            next = (day?.cards || []).length === 0
                ? { text: "Соберите колоду из шаблона: 19 карточек под ваши столы", label: "Собрать день из шаблона", action: "template" }
                : { text: `Исправьте в колоде: ${checks.problems.length} ${plural(checks.problems.length, "проблема", "проблемы", "проблем")}`, label: "Открыть колоду", action: "open:2" };
            break;
        case 3:
            next = {
                text: day?.published && !isPublishedFresh(day) ? "Колода изменилась после записи — запишите раздел заново" : "Запишите раздел: карточки, тексты и карты уйдут в хранилище платформы",
                label: "Записать раздел",
                action: "publish",
            };
            break;
        case 4: {
            const earliest = sessionEarliestAt(day?.date);
            const tooEarly = Number.isFinite(earliest) && now < earliest;
            next = tooEarly
                ? { text: `Сессия живёт 48 часов — создавать можно с ${formatMsk(earliest)} (МСК)`, label: "Создать сессию", action: "session", disabled: true }
                : { text: "Создайте сессию: столы, участники, таймеры 15/20 минут", label: "Создать сессию", action: "session" };
            break;
        }
        case 5:
            next = { text: "Разошлите ссылку участника, откройте дашборд на проекторе и отметьте «разослано»", label: "Открыть рассылку", action: "open:5" };
            break;
        case 6:
            next = { text: "Ведите день: дашборд мастера и состояние столов по гексам", label: "Открыть день", action: "open:6" };
            break;
        case 7:
            next = { text: "Сделайте снимок результатов до завершения сессии — платформа удаляет их вместе с сессией", label: "Сделать снимок результатов", action: "snapshot" };
            break;
        case 8:
            next = { text: "Снимок есть — отметьте, что сессия завершена", label: "Сессия завершена", action: "complete" };
            break;
        default: {
            const track = nextUnmarkedTrack(day);
            next = track
                ? { text: `Ближайший трек: ${track.label} · ${track.short} — отметьте, что сделано по столам`, label: "Открыть треки", action: "open:9" }
                : { text: "День закрыт: все треки отмечены", label: "", action: "" };
        }
    }

    return {
        stage,
        next,
        stages: DAY_TWO_STAGE_TITLES.map((title, i) => ({ n: i + 1, title, done: done[i] })),
        checks,
        briefProblems: brief,
        briefWarnings: briefWarnings(day),
    };
}

export function plural(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
}
