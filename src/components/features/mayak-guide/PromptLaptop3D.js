"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei/web/Html";

import * as THREE from "three";

import { roundedPlateGeometry, roundedPlateLying } from "./roundedPlate";

// Ноутбук места игрока: лежит закрытым в дальнем левом углу стола, а когда мастер
// подходит — открывается, и на экране включается та же форма МАЯК-ОКО, что в тренажёре.
//
// Раньше здесь лежала плашка-планшет: она поднималась с плоскости стола, исчезала, и
// форма выезжала слева экрана отдельной панелью. Два изображения одного предмета читались
// как два предмета. Ноутбук снимает этот стык: форма живёт на его крышке настоящим DOM
// (drei Html в режиме transform), а не картинкой, поэтому в неё можно писать прямо в сцене.
//
// Габарит взят с настоящего ноутбука 15", а не подобран под кадр: на столе рядом лежит
// поле 700 × 550 мм и карты 104 × 145 мм, и предмет не своего размера ломает масштаб
// всего стола.
export const LAPTOP = {
    base: { w: 0.36, d: 0.245, thickness: 0.01, corner: 0.008 },
    lid: { w: 0.36, h: 0.225, thickness: 0.005, corner: 0.008 },
    // Рамка вокруг экрана: поле по контуру крышки, на котором матрицы нет.
    // 4 мм — столько же, сколько у современного ноутбука. Было 12: на кадре крышка
    // читалась рамкой с экраном внутри, а не экраном в корпусе.
    bezel: 0.004,
};

// Пятно предмета на столе — по раскрытому ноутбуку, а не по закрытому: рамку подсветки и
// подлёт камеры считают по нему в обоих состояниях, и прыгающий габарит читался бы как
// подмена предмета.
export const LAPTOP_SPOT = { w: LAPTOP.base.w, d: LAPTOP.base.d + LAPTOP.lid.h * 0.35 };

// Раскрытие: чуть дальше прямого угла, как ставят настоящий ноутбук под взгляд сверху.
// Меньше — экран смотрит в потолок и с камеры виден с торца, больше — заваливается назад.
const OPEN_ANGLE = 1.98;

// Ноутбук стоит по осям стола, как поле и как ряды колоды: развёрнутый к камере, он
// единственный на столе стоял косо, и текст формы читался с завалом. Кадр разбора теперь
// приходит к нему в лоб, поэтому доворачивать предмет незачем — камера сама смотрит
// перпендикулярно экрану.
export const LAPTOP_YAW = 0;

// Открытие идёт по времени кадра, а не по экспоненте: форму на экране включают ровно в
// тот момент, когда крышка встала, и экспонента к цели только стремится — DOM подхватывал
// бы движение с недооткрытой крышки. Эти же секунды ждёт MayakTable3D перед показом формы.
export const OPEN_SECONDS = 0.75;
const easeOpen = (t) => 1 - (1 - t) ** 3;

// Перевод пикселей DOM в метры сцены. Константа 400 / distanceFactor — из самой drei:
// в режиме transform внутренняя матрица масштабируется на 1 / ((distanceFactor || 10) / 400),
// то есть при значении по умолчанию один метр сцены равен сорока пикселям. Своя ширина
// растра выбрана под форму: 620 px — та ширина, на которую сверстана панель МАЯК-ОКО,
// на меньшей поля начинают переноситься.
// Пропорция обязана совпадать с пропорцией матрицы (0.336 × 0.201 = 1.672), иначе
// масштаб, посчитанный по ширине, срежет форму по высоте. Сами числа выбраны по
// содержимому: на 620 × 372 семь полей не помещались и блок полей уходил в прокрутку —
// нижние три строки читались только колесом мыши, чего у предмета на столе быть не может.
const SCREEN_PX = { w: 820, h: 505 };
const DREI_PX_PER_UNIT = 40;
const screenInner = { w: LAPTOP.lid.w - LAPTOP.bezel * 2, h: LAPTOP.lid.h - LAPTOP.bezel * 2 };
const SCREEN_SCALE = screenInner.w / (SCREEN_PX.w / DREI_PX_PER_UNIT);

// Клавиатура рисуется в canvas, а не собирается мешами: с рабочего ракурса нижняя половина
// корпуса уходит за нижнюю кромку кадра почти целиком, и восемьдесят отдельных клавиш —
// это восемьдесят мешей ради силуэта, который виден краем.
function deckTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 490; // 720 / 490 ≈ 1.47 — пропорция корпуса 0.36 × 0.245 м
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#1b1613";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Лёгкая засветка сверху: корпус — металл, и ровная заливка читается картонкой.
    const sheen = ctx.createLinearGradient(0, 0, canvas.width * 0.6, canvas.height);
    sheen.addColorStop(0, "rgba(255,255,255,0.06)");
    sheen.addColorStop(1, "rgba(255,255,255,0.01)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Блок клавиш: шесть рядов по четырнадцать мест. Подписей нет намеренно — на этом
    // масштабе они превращаются в грязь, а силуэт клавиатуры узнаётся и без них.
    const COLS = 14;
    const ROWS = 6;
    const pad = 46;
    const blockW = canvas.width - pad * 2;
    const blockH = 236;
    const top = 34;
    const gap = 5;
    const keyW = blockW / COLS - gap;
    const keyH = blockH / ROWS - gap;

    for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
            // Нижний ряд — пробел и модификаторы: сплошная сетка в последнем ряду сразу
            // выдаёт, что это не клавиатура, а просто клетки.
            if (row === ROWS - 1 && col > 2 && col < 10) {
                if (col > 3) continue;
                ctx.beginPath();
                ctx.roundRect(pad + col * (keyW + gap), top + row * (keyH + gap), keyW * 7 + gap * 6, keyH, 5);
            } else {
                ctx.beginPath();
                ctx.roundRect(pad + col * (keyW + gap), top + row * (keyH + gap), keyW, keyH, 5);
            }
            ctx.fillStyle = "#2b2320";
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.07)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    // Тачпад: без него нижняя треть корпуса пустая, и ноутбук читается как клавиатура.
    const padW = 210;
    ctx.beginPath();
    ctx.roundRect((canvas.width - padW) / 2, top + blockH + 26, padW, 132, 8);
    ctx.fillStyle = "#221c19";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export default function PromptLaptop3D({ position, active, screenOn = false, children }) {
    const baseGeometry = useMemo(() => roundedPlateLying(LAPTOP.base.w, LAPTOP.base.d, LAPTOP.base.thickness, LAPTOP.base.corner), []);
    const lidGeometry = useMemo(() => roundedPlateGeometry(LAPTOP.lid.w, LAPTOP.lid.h, LAPTOP.lid.thickness, LAPTOP.lid.corner), []);
    const deck = useMemo(() => deckTexture(), []);

    const hinge = useRef(null);
    const opened = useRef(0);

    useFrame((_, delta) => {
        opened.current = Math.min(Math.max(opened.current + (active ? delta : -delta) / OPEN_SECONDS, 0), 1);
        const t = easeOpen(opened.current);

        // Закрытая крышка лежит на корпусе экраном вниз — это поворот на +90° вокруг петли.
        // Открытие отсчитывается от него назад: π/2 − OPEN_ANGLE. Знак не вкусовой: при
        // отрицательном крышка ложится не на корпус, а за него, к дальней кромке стола.
        const node = hinge.current;
        if (node) node.rotation.x = Math.PI / 2 - OPEN_ANGLE * t;

        // Яркость матрицы не трогаем вовсе: поверх неё сразу ложится форма, и любое
        // разгорание видно только в щель между кадрами — ровно тем серым прямоугольником,
        // который читался как включённый пустой монитор.
    });

    return (
        <group position={position} rotation={[0, LAPTOP_YAW, 0]}>
            {/* Корпус: клавиатура на верхней грани. Порядок групп roundedPlate: верх, низ, торец. */}
            <mesh geometry={baseGeometry} receiveShadow castShadow>
                <meshStandardMaterial attach="material-0" map={deck} roughness={0.62} metalness={0.15} />
                <meshStandardMaterial attach="material-1" color="#1b1613" roughness={0.6} metalness={0.2} />
                <meshStandardMaterial attach="material-2" color="#241d19" roughness={0.5} metalness={0.25} />
            </mesh>

            {/* Петля стоит на дальней кромке корпуса — там, где она у настоящего ноутбука.
                Сама крышка поднята внутри петли на половину своей высоты: вращается ребро,
                а не центр, иначе закрытая крышка висит над корпусом. */}
            <group ref={hinge} position={[0, LAPTOP.base.thickness, -LAPTOP.base.d / 2 + LAPTOP.lid.thickness]}>
                <group position={[0, LAPTOP.lid.h / 2, 0]}>
                    {/* Крышка тени не бросает. Раскрытая, она стоит почти отвесно, и её
                        тень ложилась на стол за ноутбуком чёрным полотном во всю ширину
                        кадра — в разборе это половина фона. Тень корпуса остаётся: она
                        мелкая и как раз показывает, что ноутбук лежит на столе. */}
                    <mesh geometry={lidGeometry}>
                        {/* Лицо крышки — экран: не освещаемый материал, иначе стол подмешивает
                            в него свой тёплый свет, и цвета формы расходятся с тренажёром. */}
                        <meshBasicMaterial attach="material-0" color="#0d0b09" toneMapped={false} />
                        <meshStandardMaterial attach="material-1" color="#1b1613" roughness={0.45} metalness={0.3} />
                        <meshStandardMaterial attach="material-2" color="#241d19" roughness={0.5} metalness={0.25} />
                    </mesh>

                    {/* Форма живёт на крышке с первого кадра раскрытия и едет вместе с ней.
                        Ждать, пока крышка встанет, нельзя: те три четверти секунды экран
                        стоит пустым, и на тёмной сцене его матрица читается серым
                        прямоугольником — включённым, но ничего не показывающим монитором. */}
                    {screenOn && children && (
                        <Html
                            transform
                            position={[0, 0, LAPTOP.lid.thickness / 2 + 0.0012]}
                            scale={SCREEN_SCALE}
                            style={{ width: SCREEN_PX.w, height: SCREEN_PX.h }}
                            zIndexRange={[4, 0]}>
                            {children}
                        </Html>
                    )}
                </group>
            </group>
        </group>
    );
}
