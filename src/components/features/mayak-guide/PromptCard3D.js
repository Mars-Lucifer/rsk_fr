"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei/core/Texture";
import * as THREE from "three";

import { MAX_ANISOTROPY } from "./tableSpots.mjs";
import { CARD_FIELD_BY_CODE, CARD_IMG, CARD_PAGE } from "./promptCard.mjs";
import { roundedPlateGeometry } from "./roundedPlate";

// Карта задания в разборе МАЯК-ОКО: стоит справа от планшета, лицом к камере, и
// показывает, откуда взялось значение поля. Нажал кнопку у поля — на карте загорелась
// рамка вокруг того куска текста, из которого это значение вычитано.
//
// Поза взята у карты роли: тот же лёгкий завал назад под низкую камеру разбора. Сильный
// завал сплющивает текст, вертикаль без завала читается как наклейка на стекле.
const TILT = -0.3;

// Поза и размер карты в подставке, откуда она поднимается: наклон тот же, что у ряда
// (CardStands3D), а масштаб — обратный увеличению разбора, чтобы стартовать натуральной.
const STAND_LEAN = -0.26;

// Карта в разборе крупнее натуральной: её «держат у глаз», и в кадре она должна спорить
// с планшетом, а не лежать мелким прямоугольником сбоку. Масштаб — калибровочная ручка.
// Высота карты в кадре примерно равна высоте планшета — они стоят рядом и читаются как
// две страницы одного разворота, а не как крупная панель и картинка сбоку.
const ZOOM = 2.0;
const STAND_SCALE = 1 / ZOOM;

// Показывается печатная страница набора, с вылетами: проценты разбора (promptCard.mjs)
// сняты по ней, и обрезка под чистый формат увела бы все рамки на полвылета.
const W = (CARD_PAGE.w / 1000) * ZOOM;
const H = (CARD_PAGE.h / 1000) * ZOOM;
const T = 0.0006;
const CORNER = 0.005;

// Рамка висит над лицом карты, иначе тонет в её же плоскости и мерцает.
const LIFT = 0.0012;
// Толщина контура. Заливка одна, без контура, размывает границы фрагмента: непонятно,
// где он кончается, особенно на светлом куске карты.
const EDGE = 0.0016;

const HL = "#4fc3d9";

function boxRect(box) {
    return {
        cx: -W / 2 + ((box.x + box.w / 2) / 100) * W,
        cy: H / 2 - ((box.y + box.h / 2) / 100) * H,
        w: (box.w / 100) * W,
        h: (box.h / 100) * H,
    };
}

// Сколько длится подъём карты из подставки к глазам. Карта заднего ряда летит дальше и
// выше — ей и времени нужно больше: с общей длительностью она выпрыгивала из ряда рывком,
// потому что тот же путь проходила заметно быстрее.
const TAKE = 0.9;
const TAKE_PER_ARC = 3.4;

// Разгон и торможение с обоих концов, а не только торможение к концу. Прежняя кривая
// стартовала на полной скорости — карта срывалась с подставки, и чем выше была дуга, тем
// сильнее это читалось прыжком.
const easeTake = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

// Дуга подъёма скошена к началу пути: карта уходит вверх раньше, чем вперёд. Симметричная
// дуга (пик на середине) поднимала карту уже после того, как та миновала передний ряд, и
// карта заднего ряда проходила сквозь стоящие перед ней. Показатель меньше единицы двигает
// пик влево по времени; на концах пути высота по-прежнему ноль.
const ARC_SKEW = 0.7;

export default function PromptCard3D({ position, from, arc = 0.05, images, img = CARD_IMG, backImg, marked = true, picked, stowing = false, onStowed }) {
    const geometry = useMemo(() => roundedPlateGeometry(W, H, T, CORNER), []);
    const group = useRef(null);
    const take = useRef(0);

    // Грузятся сразу все лица разделов, а не одно текущее. Иначе смена карты роняет
    // компонент в Suspense, и на кадр-другой вместо карты пустое место — то самое
    // мигание при клике по подставке.
    const maps = useTexture(images, (loaded) => {
        for (const map of Array.isArray(loaded) ? loaded : [loaded]) {
            map.colorSpace = THREE.SRGBColorSpace;
            map.anisotropy = MAX_ANISOTROPY;
        }
    });
    const face = maps[Math.max(0, images.indexOf(img))];
    const back = backImg ? maps[images.indexOf(backImg)] : null;

    const frame = useRef(null);
    const lit = useRef(0);

    // Рамка живёт только у размеченной карты: у остальных разделов таблицы фрагментов
    // пока нет, и рисовать прямоугольник по чужим координатам значит врать.
    const box = marked && picked ? CARD_FIELD_BY_CODE[picked]?.box : null;
    const rect = useMemo(() => (box ? boxRect(box) : null), [box]);

    useFrame((_, delta) => {
        // Карту берут из подставки: она едет от своего места в ряду к камере и по дороге
        // вырастает до размера «в руках». Без этого она просто возникала в воздухе.
        const body = group.current;
        if (body && from) {
            // Один и тот же путь в обе стороны: взяли — карта поднимается из подставки,
            // отложили — тем же движением возвращается на своё место в ряду.
            const seconds = TAKE + Math.max(0, arc - 0.05) * TAKE_PER_ARC;
            take.current = stowing
                ? Math.max(take.current - delta / seconds, 0)
                : Math.min(take.current + delta / seconds, 1);
            if (stowing && take.current === 0) onStowed?.();
            const t = easeTake(take.current);
            body.position.set(
                from[0] + (position[0] - from[0]) * t,
                from[1] + (position[1] - from[1]) * t + Math.sin(Math.PI * t ** ARC_SKEW) * arc,
                from[2] + (position[2] - from[2]) * t
            );
            body.rotation.x = STAND_LEAN + (TILT - STAND_LEAN) * t;
            // Карта переворачивается по дороге: в подставке она стоит рубашкой раздела,
            // а к глазам приходит лицом задания. Обратно — тем же оборотом.
            body.rotation.y = Math.PI * (1 - t);
            const scale = STAND_SCALE + (1 - STAND_SCALE) * t;
            body.scale.setScalar(scale);
        }

        const node = frame.current;
        if (!node) return;
        lit.current += ((box ? 1 : 0) - lit.current) * (1 - Math.pow(0.002, delta));
        node.visible = lit.current > 0.01;
        for (const child of node.children) {
            child.material.opacity = lit.current * (child.userData.fill ? 0.16 : 0.85);
        }
    });

    return (
        <group ref={group} position={from || position} rotation={[from ? STAND_LEAN : TILT, from ? Math.PI : 0, 0]} scale={from ? STAND_SCALE : 1}>
            <mesh geometry={geometry}>
                {/* Порядок групп у roundedPlate: лицо, рубашка, торец. */}
                <meshStandardMaterial attach="material-0" map={face} roughness={0.82} />
                {back ? (
                    <meshStandardMaterial attach="material-1" map={back} roughness={0.85} />
                ) : (
                    <meshStandardMaterial attach="material-1" color="#1a2129" roughness={0.9} />
                )}
                <meshStandardMaterial attach="material-2" color="#e8e2d6" roughness={1} />
            </mesh>

            {rect && (
                <group ref={frame} position={[rect.cx, rect.cy, T / 2 + LIFT]}>
                    <mesh userData={{ fill: true }}>
                        <planeGeometry args={[rect.w, rect.h]} />
                        <meshBasicMaterial color={HL} transparent opacity={0} depthWrite={false} />
                    </mesh>
                    {/* Контур четырьмя планками: линия толщиной в пиксель на наклонной
                        карте рвётся, а прямоугольные планки держат толщину в метрах. */}
                    <mesh position={[0, rect.h / 2, 0.0001]}>
                        <planeGeometry args={[rect.w + EDGE, EDGE]} />
                        <meshBasicMaterial color={HL} transparent opacity={0} depthWrite={false} />
                    </mesh>
                    <mesh position={[0, -rect.h / 2, 0.0001]}>
                        <planeGeometry args={[rect.w + EDGE, EDGE]} />
                        <meshBasicMaterial color={HL} transparent opacity={0} depthWrite={false} />
                    </mesh>
                    <mesh position={[-rect.w / 2, 0, 0.0001]}>
                        <planeGeometry args={[EDGE, rect.h]} />
                        <meshBasicMaterial color={HL} transparent opacity={0} depthWrite={false} />
                    </mesh>
                    <mesh position={[rect.w / 2, 0, 0.0001]}>
                        <planeGeometry args={[EDGE, rect.h]} />
                        <meshBasicMaterial color={HL} transparent opacity={0} depthWrite={false} />
                    </mesh>
                </group>
            )}
        </group>
    );
}
