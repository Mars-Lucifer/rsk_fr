// Растры карт ролей для 3D-стола: public/mayak-guide/role_*.jpg → public/mayak-guide/roles-3d/.
//
// Зачем отдельная папка. На столе карта лежит целиком, и широкое белое поле печатного
// макета сливает шесть карт в одно белое пятно, а сложенные стопкой — в белый прямоугольник.
// Поэтому в сцену идёт кроп по самой карте, без полей.
//
// Зачем скрипт, а не разовая ручная операция. Прошлая папка roles-3d была собрана руками
// и содержала апскейл: кроп 455 × 665 растянули до 512 × 758 и пережали в прогрессивный
// JPEG. Пикселей стало больше, деталей — меньше (высокочастотная энергия упала на 44 %),
// и в фокусе камеры карта читается мыльной. Здесь кроп берётся один в один, без resize,
// и кодируется один раз с высоким качеством.
//
// Потолок резкости задан исходником: в public/mayak-guide/role_*.jpg всего 520 × 721,
// из них на саму карту приходится около 455 × 665. При подлёте камеры (ROLE_VIEW) карта
// занимает ~800 device px по ширине на экране 1600 × 900 при dpr 2 — то есть текстуру
// всё равно растягивают примерно вдвое. Чтобы карта стала по-настоящему резкой, нужен
// исходник от 1024 px по ширине: печатный PDF набора или оригинал макета. В репозитории
// их нет — это ограничение материала, а не кода.
//
// Запуск: node scripts/mayak-guide-roles.mjs

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "public/mayak-guide";
const OUT = "public/mayak-guide/roles-3d";

const FILES = [
    "role_kapitan.jpg",
    "role_mediator.jpg",
    "role_inspector.jpg",
    "role_hranitel.jpg",
    "role_engineer.jpg",
    "role_letopisec.jpg",
];

// Поле макета белое, карта — тёмная. Строка/столбец считаются полем, если почти все
// пиксели в них светлее порога: так граница находится сама и не зависит от того,
// одинаково ли обрезаны исходники.
const WHITE = 245;
const SHARE = 0.97;

// Порог ловит границу с точностью до сглаженных пикселей, и по краю кропа остаётся
// светлая нитка в два-три пикселя. На тёмной карте она читается как белая обводка,
// ради избавления от которой кроп и делается. Срезаем её вместе с краем.
//
// Отступ считается не от нитки, а от скруглённых углов печатной карты: белый фон
// страницы остаётся в самих углах кропа, и на дальнем плане мип-уровни размазывают его
// вдоль кромки — карта получает светлый кант, тот самый «белый торец». Радиус угла на
// растре около 7 px, поэтому 10 срезает его целиком. Потеря — 2 % ширины.
const INSET = 10;

async function contentBox(file) {
    const image = sharp(file);
    const { width, height } = await image.metadata();
    const grey = await image.clone().greyscale().raw().toBuffer();

    const light = (index) => grey[index] >= WHITE;
    const rowIsMargin = (y) => {
        let count = 0;
        for (let x = 0; x < width; x += 1) if (light(y * width + x)) count += 1;
        return count >= width * SHARE;
    };
    const colIsMargin = (x) => {
        let count = 0;
        for (let y = 0; y < height; y += 1) if (light(y * width + x)) count += 1;
        return count >= height * SHARE;
    };

    let top = 0;
    let bottom = height - 1;
    let left = 0;
    let right = width - 1;
    while (top < bottom && rowIsMargin(top)) top += 1;
    while (bottom > top && rowIsMargin(bottom)) bottom -= 1;
    while (left < right && colIsMargin(left)) left += 1;
    while (right > left && colIsMargin(right)) right -= 1;

    return {
        left: left + INSET,
        top: top + INSET,
        width: right - left + 1 - INSET * 2,
        height: bottom - top + 1 - INSET * 2,
    };
}

// Мера резкости: дисперсия горизонтального лапласиана по яркости. Нужна не ради числа,
// а ради проверки, что пересборка не ухудшила картинку — сравнивать с прошлой папкой.
async function sharpness(buffer) {
    const image = sharp(buffer).greyscale();
    const { width, height } = await image.metadata();
    const grey = await image.raw().toBuffer();
    let sum = 0;
    let sumSquares = 0;
    let count = 0;
    for (let y = 0; y < height; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
            const i = y * width + x;
            const value = grey[i - 1] - 2 * grey[i] + grey[i + 1];
            sum += value;
            sumSquares += value * value;
            count += 1;
        }
    }
    return sumSquares / count - (sum / count) ** 2;
}

await mkdir(OUT, { recursive: true });

for (const name of FILES) {
    const src = path.join(SRC, name);
    const box = await contentBox(src);
    const out = await sharp(src)
        .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
        // Никакого resize: любой пересчёт здесь только теряет детали, апскейл — вдвойне.
        .jpeg({ quality: 95, progressive: false, mozjpeg: true })
        .toBuffer();

    await writeFile(path.join(OUT, name), out);
    console.log(
        `${name}: ${box.width}×${box.height} @ ${box.left},${box.top} — ${(out.length / 1024) | 0} КБ, резкость ${(await sharpness(out)).toFixed(0)}`
    );
}

// Отдельной строкой — во что упираемся, чтобы это не пришлось выяснять заново.
const first = await readFile(path.join(SRC, FILES[0]));
console.log(`исходник ${FILES[0]}: ${(first.length / 1024) | 0} КБ, резкость ${(await sharpness(first)).toFixed(0)}`);
