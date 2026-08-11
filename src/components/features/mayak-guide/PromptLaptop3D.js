"use client";

import { useEffect, useMemo, useRef } from "react";
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
    base: { w: 0.36, d: 0.245, thickness: 0.012, corner: 0.012 },
    lid: { w: 0.36, h: 0.225, thickness: 0.008, corner: 0.012 },
    // Рамка вокруг экрана: чёрное поле по контуру крышки. Ниже по нему считается место
    // под DOM формы — без рамки текст упирался бы в скруглённый край крышки.
    bezel: 0.012,
};

// Пятно предмета на столе — по раскрытому ноутбуку, а не по закрытому: рамку подсветки и
// подлёт камеры считают по нему в обоих состояниях, и прыгающий габарит читался бы как
// подмена предмета.
export const LAPTOP_SPOT = { w: LAPTOP.base.w, d: LAPTOP.base.d + LAPTOP.lid.h * 0.35 };

// Раскрытие: чуть дальше прямого угла, как ставят настоящий ноутбук под взгляд сверху.
// Меньше — экран смотрит в потолок и с камеры виден с торца, больше — заваливается назад.
const OPEN_ANGLE = 1.98;

// Ноутбук развёрнут к камере: он стоит левее оси съёмки, и по осям стола экран виден под
// углом — текст формы съезжает в косую. Угол не на глаз: с места игрока до камеры 0.47 м
// при сдвиге 0.14 м влево, то есть ось предмета расходится с осью взгляда на 17°.
// Довёрнуто чуть меньше — ноутбук, повёрнутый строго в лоб, читается вклеенным в кадр.
export const LAPTOP_YAW = 0.26;

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
const SCREEN_PX = { w: 820, h: 490 };
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

// Матрица гасит события, не пуская их в сцену.
//
// R3F слушает указатель не на самом холсте, а на его контейнере, и DOM, который drei
// кладёт на крышку, оказывается потомком того же контейнера. Поэтому клик по полю формы
// всплывал в сцену, там не попадал ни в один предмет, считался промахом — и зона
// закрывалась ровно в тот момент, когда в поле собирались писать.
//
// Слушатели нативные, а не React-овские: React вешает свои на корень приложения, то есть
// выше контейнера сцены, и его stopPropagation опаздывает — событие к тому моменту уже
// прошло через R3F.
function ScreenGuard({ children }) {
    const node = useRef(null);

    useEffect(() => {
        const el = node.current;
        if (!el) return undefined;
        const stop = (event) => event.stopPropagation();
        const kinds = ["pointerdown", "pointerup", "pointermove", "click", "dblclick", "wheel", "contextmenu"];
        for (const kind of kinds) el.addEventListener(kind, stop);
        return () => {
            for (const kind of kinds) el.removeEventListener(kind, stop);
        };
    }, []);

    return (
        <div ref={node} style={{ width: "100%", height: "100%" }}>
            {children}
        </div>
    );
}

export default function PromptLaptop3D({ position, active, screenOn = false, children }) {
    const baseGeometry = useMemo(() => roundedPlateLying(LAPTOP.base.w, LAPTOP.base.d, LAPTOP.base.thickness, LAPTOP.base.corner), []);
    const lidGeometry = useMemo(() => roundedPlateGeometry(LAPTOP.lid.w, LAPTOP.lid.h, LAPTOP.lid.thickness, LAPTOP.lid.corner), []);
    const deck = useMemo(() => deckTexture(), []);

    const hinge = useRef(null);
    const glow = useRef(null);
    const opened = useRef(0);

    useFrame((_, delta) => {
        opened.current = Math.min(Math.max(opened.current + (active ? delta : -delta) / OPEN_SECONDS, 0), 1);
        const t = easeOpen(opened.current);

        // Закрытая крышка лежит на корпусе экраном вниз — это поворот на +90° вокруг петли.
        // Открытие отсчитывается от него назад: π/2 − OPEN_ANGLE. Знак не вкусовой: при
        // отрицательном крышка ложится не на корпус, а за него, к дальней кромке стола.
        const node = hinge.current;
        if (node) node.rotation.x = Math.PI / 2 - OPEN_ANGLE * t;

        // Экран разгорается вместе с раскрытием: тёмное стекло закрытой крышки и
        // включённый экран — одна и та же поверхность, и мгновенное включение читается
        // как подмена материала.
        const surface = glow.current;
        if (surface) surface.color.setScalar(0.05 + t * 0.1);
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
                    <mesh geometry={lidGeometry} castShadow>
                        {/* Лицо крышки — экран: не освещаемый материал, иначе стол подмешивает
                            в него свой тёплый свет, и цвета формы расходятся с тренажёром. */}
                        <meshBasicMaterial ref={glow} attach="material-0" color="#0d0b09" toneMapped={false} />
                        <meshStandardMaterial attach="material-1" color="#1b1613" roughness={0.45} metalness={0.3} />
                        <meshStandardMaterial attach="material-2" color="#241d19" roughness={0.5} metalness={0.25} />
                    </mesh>

                    {/* Форма включается только на раскрытой крышке: на полпути DOM едет
                        вместе с ней и на кадр-другой показывает изнанку матрицы. */}
                    {screenOn && children && (
                        <Html
                            transform
                            position={[0, 0, LAPTOP.lid.thickness / 2 + 0.0012]}
                            scale={SCREEN_SCALE}
                            style={{ width: SCREEN_PX.w, height: SCREEN_PX.h }}
                            zIndexRange={[4, 0]}>
                            <ScreenGuard>{children}</ScreenGuard>
                        </Html>
                    )}
                </group>
            </group>
        </group>
    );
}
