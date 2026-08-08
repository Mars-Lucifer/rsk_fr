// Печатный набор МАЯКа → текстуры колоды для сцены /mayak-guide-3d.
//
// Исходник — те же PDF, с которых печатался набор: страница 111.1 × 154.2 мм, текст в
// кривых, фото внутри в полном разрешении.
//
// Набор на столе смешанный, и это решение владельца, а не недосмотр: «Старт» и все шесть
// направлений «МЫ» берутся из комплекта СПО, шесть типов контента «Я» — из комплекта
// «Маяк ВУЗЫ». Причина в поле: на растре pole_ya напечатаны «Изображение» и «Видео», а в
// СПО эти разделы называются «Статика» и «Динамика» — стопки встали бы на чужие лепестки.
//
// Страницы каждого раздела перечислены руками, а не отбираются эвристикой. Так надо:
//   · первая страница PDF — рубашка раздела, дальше лица, но порядок номеров в файле не
//     совпадает с порядком карт: в «Старте» СПО страницы идут №3, №1, №5, №6, №4, №2;
//   · в каждом разделе есть «КАРТА НАСТРОЕНИЯ» — она не задание и в сцене не участвует
//     ни в раздаче, ни в обходе кольца, поэтому её страница просто не указана;
//   · последняя страница списка ложится в стопку верхней. Именно её поднимают в разборе
//     карты, поэтому там стоит карта, выбранная для показа.
// Номера карт печатаются в кривых, текстом их не достать — соответствие «номер → страница»
// снято просмотром отрисованных шапок. Меняется набор — переснимать заново.
//
// Запуск:  node scripts/mayak-guide-deck.mjs <каталог СПО> <каталог «Маяк ВУЗЫ»>
//
// Файлы кладутся прямо в public/mayak-guide/deck-ya и deck-my, поверх прежних.

import fs from "node:fs";
import path from "node:path";
import { pdf } from "pdf-to-img";
import sharp from "sharp";

// Карта набора — 104 × 145 мм, печатная страница — 111.1 × 154.2 мм: разница это вылеты
// под обрез. Их нужно срезать, иначе карта в сцене окажется с белым полем по краю и
// не совпадёт с габаритом из tableSpots.
const PAGE_MM = { w: 111.1, h: 154.2 };
const CARD_MM = { w: 104, h: 145 };

// Ширина текстуры лица. Карта в кадре не бывает шире ~450 px даже при разборе одной
// карты вплотную, так что 512 даёт запас и остаётся в разумных 1.5 МБ видеопамяти на
// карту: 64 лица это ~94 МБ, столько же порядка, сколько одна текстура поля.
const FACE_PX = 512;
// Рубашка — плоская графика без фото. Крупнее лица её делать незачем: в кадре она
// появляется в том же размере, а видеопамять занимает наравне с фотографией.
const BACK_PX = 512;
// Рендерим вдвое крупнее нужного и уменьшаем: у pdf.js нет сглаживания под целевой
// размер, а ресайз по Ланцошу даёт заметно чище мелкий шрифт.
const SUPERSAMPLE = 2;

// set — из какого комплекта берётся раздел, pages — страницы PDF в порядке укладки
// в стопку, верхняя последней. Номер карты в комментарии — для сверки при следующей
// правке; в коде он не используется.
const SECTIONS = [
    // «Старт» СПО: страницы идут №3 №1 №5 №6 №4 №2, карты настроения в разделе нет.
    { pdf: "Старт", id: "start", side: "ya", set: "spo", pages: [2, 4, 5, 6, 7, 3] }, // верхняя №1

    // Типы контента «Я» — комплект ВУЗЫ. В каждом разделе шесть лиц, последнее из них
    // «КАРТА НАСТРОЕНИЯ», поэтому заданий пять. Ровно столько раздел и отдаёт за партию:
    // одно на внешнем круге и четыре на специализации.
    { pdf: "Текст", id: "text", side: "ya", set: "vuz", pages: [2, 3, 4, 5, 6] }, // верхняя №615
    { pdf: "Аудио", id: "audio", side: "ya", set: "vuz", pages: [2, 4, 5, 6, 3] }, // верхняя №618
    { pdf: "Изображение", id: "image", side: "ya", set: "vuz", pages: [2, 3, 4, 5, 6] }, // верхняя №629
    { pdf: "Интерактив", id: "interactive", side: "ya", set: "vuz", pages: [2, 3, 4, 6, 5] }, // верхняя №634
    { pdf: "Данные", id: "data", side: "ya", set: "vuz", pages: [2, 3, 4, 6, 5] }, // верхняя №649
    { pdf: "Видео", id: "video", side: "ya", set: "vuz", pages: [2, 3, 4, 6, 5] }, // верхняя №642

    // Направления «МЫ» — комплект СПО. Семь лиц, одно из них карта настроения: остаётся
    // шесть заданий, ровно по числу задач направления за партию.
    { pdf: "Знание и навыки", id: "knowledge", side: "my", set: "spo", pages: [2, 3, 4, 6, 8, 5] }, // верхняя №54
    { pdf: "Внешние взаимодейтсвия", id: "external", side: "my", set: "spo", pages: [2, 3, 5, 7, 8, 6] }, // верхняя №58
    { pdf: "Единое цифровое пространство", id: "space", side: "my", set: "spo", pages: [2, 3, 5, 7, 8, 6] }, // верхняя №65
    { pdf: "Защита данных", id: "security", side: "my", set: "spo", pages: [3, 4, 6, 7, 8, 5] }, // верхняя №73
    { pdf: "Данные и аналитика", id: "analytics", side: "my", set: "spo", pages: [2, 3, 4, 5, 7, 6] }, // верхняя №82
    { pdf: "Автоматизация", id: "automation", side: "my", set: "spo", pages: [2, 3, 4, 5, 7, 6] }, // верхняя №89
];

const dirs = { spo: process.argv[2], vuz: process.argv[3] };
if (!dirs.spo || !dirs.vuz) {
    console.error("Укажите оба каталога: node scripts/mayak-guide-deck.mjs <СПО> <Маяк ВУЗЫ>");
    process.exit(1);
}

// Имена файлов в архиве приходят с порядковой приставкой, поэтому сравниваем по имени
// без неё и без расширения. Именно по точному совпадению, а не по вхождению: «Данные»
// иначе попадает и в «Данные и аналитика», то есть в чужой раздел набора.
const stem = (file) => path.basename(file, path.extname(file)).replace(/^\d+[_\s-]*/, "");
const find = (section) => {
    const dir = dirs[section.set];
    const hit = fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".pdf") && stem(name) === section.pdf);
    if (hit.length !== 1) throw new Error(`«${section.pdf}» в ${section.set}: подходящих файлов ${hit.length}, ожидался один`);
    return path.join(dir, hit[0]);
};

// Срез вылетов в долях страницы. Считается из миллиметров, а не подбирается: поменяется
// формат печати — поменяется и срез, без правки чисел в коде.
const cut = { x: (1 - CARD_MM.w / PAGE_MM.w) / 2, y: (1 - CARD_MM.h / PAGE_MM.h) / 2 };

async function trim(buffer, width) {
    const image = sharp(buffer);
    const { width: w, height: h } = await image.metadata();
    return image
        .extract({
            left: Math.round(w * cut.x),
            top: Math.round(h * cut.y),
            width: Math.round(w * (1 - cut.x * 2)),
            height: Math.round(h * (1 - cut.y * 2)),
        })
        .resize({ width, kernel: "lanczos3" });
}

for (const section of SECTIONS) {
    const out = path.join("public", "mayak-guide", section.side === "ya" ? "deck-ya" : "deck-my");
    fs.mkdirSync(out, { recursive: true });

    // Масштаб задаём по самой крупной из двух целей, чтобы читать PDF один раз.
    const scale = ((Math.max(FACE_PX, BACK_PX) * SUPERSAMPLE) / (1 - cut.x * 2) / 315) * 1;
    const doc = await pdf(find(section), { scale });

    // Страницы приходят потоком по порядку, а укладываем мы их в своём — поэтому сначала
    // собираем нужные растры, потом пишем файлы в порядке списка.
    const need = new Set([1, ...section.pages]);
    const raw = new Map();
    let page = 0;
    for await (const raster of doc) {
        page += 1;
        if (need.has(page)) raw.set(page, raster);
        if (raw.size === need.size) break;
    }

    const missing = [...need].filter((p) => !raw.has(p));
    if (missing.length) throw new Error(`«${section.pdf}»: в PDF нет страниц ${missing.join(", ")} (всего ${page})`);

    await (await trim(raw.get(1), BACK_PX)).png({ compressionLevel: 9 }).toFile(path.join(out, `${section.id}-back.png`));
    for (const [order, source] of section.pages.entries()) {
        await (await trim(raw.get(source), FACE_PX)).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(out, `${section.id}-${order + 1}.jpg`));
    }

    console.log(`${section.id.padEnd(12)} ${section.set}  рубашка + ${section.pages.length} лиц (страницы ${section.pages.join(" ")})`);
}
