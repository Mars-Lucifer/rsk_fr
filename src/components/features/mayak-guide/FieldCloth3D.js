"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei/core/Texture";
import * as THREE from "three";

import { BOARD_MM } from "./fieldLayout.mjs";
import { MAX_ANISOTROPY } from "./tableSpots.mjs";

// Поле МАЯКа — двусторонняя ткань, а не планшет: своей жёсткости нет, лежит на столе,
// при переносе провисает и складывается. Поэтому здесь не кубоид с картинкой, а настоящая
// симуляция полотна: сетка точек, связи между ними и Верле-интегрирование.
//
// Один элемент, всё остальное (жетоны, колода, лоток) — следующим шагом.
//
// Единицы сцены — метры. Габариты полотна взяты из вектора набора: 700×550 мм.

const W = BOARD_MM.w / 1000;
const D = BOARD_MM.h / 1000;

// Шаг сетки ~16 мм: мельче — мягче складки, но дороже каждый кадр.
const SEG_X = 44;
const SEG_Z = 34;
const COLS = SEG_X + 1;
const ROWS = SEG_Z + 1;
const COUNT = COLS * ROWS;

const GRAVITY = -9.81;
const DT = 1 / 60;
const DAMPING = 0.985; // трение о воздух
const GROUND = 0.0008; // полотно не проваливается в стол
const GROUND_FRICTION = 0.55; // ткань не скользит по столу, как шайба
const ITERATIONS = 12; // решатель связей: больше — стабильнее мягкая ткань

// Габардин/сатин: нить держит длину, но изгиб почти не сопротивляется. Поэтому
// структурные и диагональные связи решаются в полную силу, а связи «через одну»
// (они и отвечают за жёсткость на излом) — слабо. Это главная ручка «мягкости»:
// 1.0 даст ковролин, 0.05 — тряпку.
const BEND_STIFFNESS = 0.22;

const THICKNESS = 0.0022; // 2.2 мм: изнанка отодвинута от лица, у кромки видна толщина
const RELIEF = 0.0022; // ткань не бывает идеально плоской — лёгкая рябь в покое

// По краю растров поля идёт белая линия толщиной в пиксель. Обрезать её сдвигом UV
// нельзя: мипмапы считаются по всему растру, и на дальних уровнях белое всё равно
// подмешивается в кромку. Поэтому режем сами пиксели и строим текстуру заново.
const TRIM = 3;

const FLIP_SECONDS = 2.6;
const SETTLE_SECONDS = 1.6;
const RELEASE_SECONDS = 0.45; // сколько длится отпускание кромки в конце жеста
const CLEARANCE = 0.05; // зазор между нижней кромкой поднятого полотна и столом
const SMOOTHING = 0.14; // с какой силой рука разглаживает полотно в конце укладки
const IDLE_SMOOTHING = 0.02; // и с какой оно само расправляется, пока лежит

// Полотно, которое просто лежит, незачем пересчитывать каждый кадр: решатель связей
// стоит около 3.5 мс — треть кадрового бюджета при 60 Гц, — а картинка от него уже не
// меняется. Поэтому ткань засыпает, когда она никуда не едет, и просыпается от команды.
// Порог — за кадр точка сдвигается меньше сотой доли миллиметра; выдержка нужна, чтобы
// не уснуть в момент, когда складка ещё расправляется.
const SLEEP_EPS = 1e-5;
const SLEEP_FRAMES = 30;

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// Связи сетки: структурные держат размер, диагональные — форму, через одну — изгиб.
// Без диагональных ткань складывается в гармошку, без «через одну» — мнётся в комок.
function buildConstraints() {
    const links = [];
    const add = (a, b, stiffness) => links.push([a, b, 0, stiffness]);
    const at = (col, row) => row * COLS + col;

    for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
            if (col + 1 < COLS) add(at(col, row), at(col + 1, row), 1);
            if (row + 1 < ROWS) add(at(col, row), at(col, row + 1), 1);
            if (col + 1 < COLS && row + 1 < ROWS) {
                add(at(col, row), at(col + 1, row + 1), 1);
                add(at(col + 1, row), at(col, row + 1), 1);
            }
            if (col + 2 < COLS) add(at(col, row), at(col + 2, row), BEND_STIFFNESS);
            if (row + 2 < ROWS) add(at(col, row), at(col, row + 2), BEND_STIFFNESS);
        }
    }
    return links;
}

// Ведущие кромки — это две руки мастера. Полотно берут за левый и правый края,
// поднимают, поворачивают вокруг средней линии поля и кладут обратно: на угле π
// кромки меняются местами, след на столе тот же, наверху другая сторона.
// Тянуть за одну кромку нельзя — так ткань не переворачивается, а складывается пополам.
//
// Подъём считается от угла: пока полотно стоит вертикально, нижняя кромка должна
// висеть над столом, иначе она проходит сквозь него.
// anchor — где кромки лежали в момент, когда за них взялись. Считать от исходной
// раскладки нельзя: после первого переворота кромки уже поменялись местами, и такой
// расчёт рывком возвращал бы полотно в прежнее положение вместо второго переворота.
// grip — насколько крепко кромка ещё в руке. К концу жеста хват слабеет от 1 до 0: пальцы
// отпускают полотно, а не разжимаются мгновенно. Раньше кромка вела себя жёстко до
// последнего кадра, а потом становилась свободной разом — накопленный провис остальной
// ткани подтягивал её рывком, и заметнее всего это было на той стороне, куда кромку
// приводили.
function leadEdges(pos, anchor, grabbed, angle, grip = 1) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const lift = (W / 2 + CLEARANCE) * sin;
    for (let i = 0; i < grabbed.length; i += 1) {
        const k = grabbed[i] * 3;
        const dx = anchor[i * 2];
        pos[k] += (dx * cos - pos[k]) * grip;
        pos[k + 1] += (GROUND + lift - dx * sin - pos[k + 1]) * grip;
        pos[k + 2] += (anchor[i * 2 + 1] - pos[k + 2]) * grip;
    }
}

// Подтягивание ткани к разложенному состоянию. Решатель связей ничего не знает про
// самопересечения, поэтому сам он залипшую складку не расправит — её разглаживают.
// sign = -1 после нечётного переворота: полотно тогда зеркально исходной раскладке.
function smoothToward(pos, prev, rest, sign, rate) {
    for (let i = 0; i < COUNT; i += 1) {
        const k = i * 3;
        for (let axis = 0; axis < 3; axis += 1) {
            const target = axis === 0 ? sign * rest[k] : rest[k + axis];
            pos[k + axis] += (target - pos[k + axis]) * rate;
            prev[k + axis] += (target - prev[k + axis]) * rate;
        }
    }
}

// Детерминированная рябь: одна и та же ткань каждый раз ложится одинаково.
function relief(index) {
    const hash = Math.sin(index * 12.9898) * 43758.5453;
    return (hash - Math.floor(hash) - 0.5) * 2 * RELIEF;
}

// Перерисовываем растр без кромки в канву и отдаём как новую текстуру: у неё и мипмапы
// строятся уже без белой линии. mirror — для изнанки, её видно с другой стороны.
function trimmed(texture, mirror) {
    const image = texture.image;
    const canvas = document.createElement("canvas");
    canvas.width = image.width - TRIM * 2;
    canvas.height = image.height - TRIM * 2;
    canvas.getContext("2d").drawImage(image, TRIM, TRIM, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = MAX_ANISOTROPY;
    map.wrapS = mirror ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    if (mirror) {
        map.repeat.x = -1;
        map.offset.x = 1;
    }
    return map;
}

// Сторона «Я» существует и вектором: 2D-плеер на /mayak-guide рисует то же поле из
// field-ya.svg, и потому остаётся резким на любом масштабе. В 3D предмет можно подвести
// к камере вплотную, и растр pole_ya.png шириной 1400 px упирается в себя уже при
// обычном приближении. Поэтому вектор растеризуем сами — один раз, в текстуру заданной
// ширины. Внутри SVG три врезки-растра (861 px по ширине), их это не чинит: вектор даёт
// резкость разметке, легенде и подписям, а не центральной схеме.
//
// Размер — калибровочная ручка. 4096 px на 700 мм полотна это ~148 точек на дюйм при
// показе один к одному: столько же, сколько у печатного набора, и на полный экран поля
// хватает с запасом. Цена — ~53 МБ видеопамяти плюс мипмапы; предел текстуры у GPU
// заметно выше (16384), упрёмся скорее в память мобильных устройств, чем в него.
const YA_VECTOR = "/mayak-guide/field-ya.svg";
const YA_VECTOR_PX = 4096;

// Растеризация вектора в текстуру. Кромку снимаем ту же долю, что и у растра: иначе
// лицевая сторона окажется на 0.2% крупнее изнанки, а раскладка жетонов и стопок
// считается в пикселях именно растра.
function rasterize(image, width, edge) {
    const sx = image.width * edge;
    const sy = image.height * edge;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width);
    canvas.height = Math.round((width * (image.height - sy * 2)) / (image.width - sx * 2));
    canvas
        .getContext("2d")
        .drawImage(image, sx, sy, image.width - sx * 2, image.height - sy * 2, 0, 0, canvas.width, canvas.height);

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = MAX_ANISOTROPY;
    map.wrapS = THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    return map;
}

function Cloth({ run }) {
    const [rawMy, rawYa] = useTexture(["/mayak-guide/pole_my.png", "/mayak-guide/pole_ya.png"]);
    // Вектор приезжает асинхронно и подменяет растр, когда готов. Через Suspense его вести
    // нельзя: пока грузится текстура, вся сцена уходит в fallback, то есть со стола
    // пропадает всё разом ради одной стороны полотна.
    const [vectorYa, setVectorYa] = useState(null);

    useEffect(() => {
        let alive = true;
        let made = null;
        const image = new Image();
        image.onload = () => {
            made = rasterize(image, YA_VECTOR_PX, TRIM / rawYa.image.width);
            if (alive) setVectorYa(made);
            else made.dispose();
        };
        // Не загрузился вектор — на столе остаётся растр, это рабочее состояние.
        image.onerror = () => {};
        image.src = YA_VECTOR;
        return () => {
            alive = false;
            made?.dispose();
        };
    }, [rawYa]);

    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(W, D, SEG_X, SEG_Z);
        geo.rotateX(-Math.PI / 2); // кладём полотно на стол
        return geo;
    }, []);

    // Изнанку смотрим с другой стороны, поэтому её зеркалим по X:
    // иначе сторона «МЫ» после переворота читалась бы в зеркале.
    const rasterYa = useMemo(() => trimmed(rawYa, false), [rawYa]);
    const faceYa = vectorYa ?? rasterYa;
    const faceMy = useMemo(() => trimmed(rawMy, true), [rawMy]);

    const sim = useMemo(() => {
        const base = geometry.attributes.position.array;
        const rest = new Float32Array(base);
        for (let i = 0; i < COUNT; i += 1) rest[i * 3 + 1] += GROUND + relief(i);
        const pos = new Float32Array(rest);
        const prev = new Float32Array(rest);
        const links = buildConstraints();
        for (const link of links) {
            const [a, b] = link;
            link[2] = Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]);
        }
        // Обе боковые кромки: за них поле берут двумя руками при перевороте.
        const grabbed = [];
        for (let row = 0; row < ROWS; row += 1) {
            grabbed.push(row * COLS);
            grabbed.push(row * COLS + COLS - 1);
        }
        return { pos, prev, links, grabbed, rest };
    }, [geometry]);

    const reset = useCallback(() => {
        sim.pos.set(sim.rest);
        sim.prev.set(sim.rest);
    }, [sim]);

    run.current.reset = reset;

    useFrame(() => {
        const state = run.current;
        if (state.asleep) return;

        const { pos, prev, links, grabbed, rest } = sim;

        // Верле: скорость живёт в разнице между текущей и прошлой позицией.
        // Заодно смотрим, кто в этом кадре двигался быстрее всех — по этому и решаем,
        // пора ли ткани спать.
        let fastest = 0;
        for (let i = 0; i < COUNT; i += 1) {
            const k = i * 3;
            for (let axis = 0; axis < 3; axis += 1) {
                const current = pos[k + axis];
                const velocity = (current - prev[k + axis]) * DAMPING;
                const speed = velocity < 0 ? -velocity : velocity;
                if (speed > fastest) fastest = speed;
                prev[k + axis] = current;
                pos[k + axis] = current + velocity + (axis === 1 ? GRAVITY * DT * DT : 0);
            }
        }

        // Переворот на месте: мастер берёт левую кромку и ведёт её по дуге через середину
        // поля на место правой. Полотно при этом снимается со стола, повисает и ложится
        // на тот же след другой стороной. Остальная ткань никем не ведётся — она просто
        // тянется за кромкой, отсюда провис и складка.
        let hold = null;
        if (state.playing) {
            if (!state.anchor) {
                state.anchor = new Float32Array(grabbed.length * 2);
                for (let i = 0; i < grabbed.length; i += 1) {
                    state.anchor[i * 2] = pos[grabbed[i] * 3];
                    state.anchor[i * 2 + 1] = pos[grabbed[i] * 3 + 2];
                }
            }
            state.t = Math.min(state.t + DT, FLIP_SECONDS + SETTLE_SECONDS);
            if (state.t <= FLIP_SECONDS) {
                // Жест один и тот же в обе стороны, зеркалить его не нужно.
                // К концу хват слабеет: последние RELEASE_SECONDS кромку уже не ведут,
                // а отпускают, и полотно доезжает само, без рывка на последнем кадре.
                const left = FLIP_SECONDS - state.t;
                hold = {
                    angle: ease(state.t / FLIP_SECONDS) * Math.PI,
                    grip: left >= RELEASE_SECONDS ? 1 : Math.max(0, left / RELEASE_SECONDS) ** 2,
                };
            } else {
                // Полотно легло — мастер проводит по нему рукой. Разглаживание начинается
                // не с нуля: к этому моменту хват уже отпущен, и ткань идёт ровно.
                const progress = (state.t - FLIP_SECONDS) / SETTLE_SECONDS;
                smoothToward(pos, prev, rest, state.sign, (0.2 + 0.8 * ease(progress)) * SMOOTHING);
                if (state.t >= FLIP_SECONDS + SETTLE_SECONDS) {
                    state.playing = false;
                    state.anchor = null;
                    state.onDone?.();
                }
            }
        }

        if (hold) leadEdges(pos, state.anchor, grabbed, hold.angle, hold.grip);
        // Пока полотно просто лежит, оно медленно расправляется само: складки от
        // предыдущего переворота расходятся за секунду-полторы, а не остаются навсегда.
        if (!state.playing) smoothToward(pos, prev, rest, state.sign, IDLE_SMOOTHING);

        for (let pass = 0; pass < ITERATIONS; pass += 1) {
            for (let i = 0; i < links.length; i += 1) {
                const [a, b, restLength, stiffness] = links[i];
                const ka = a * 3;
                const kb = b * 3;
                const dx = pos[kb] - pos[ka];
                const dy = pos[kb + 1] - pos[ka + 1];
                const dz = pos[kb + 2] - pos[ka + 2];
                const distance = Math.hypot(dx, dy, dz) || 1e-6;
                const shift = ((distance - restLength) / distance) * 0.5 * stiffness;
                const sx = dx * shift;
                const sy = dy * shift;
                const sz = dz * shift;
                pos[ka] += sx;
                pos[ka + 1] += sy;
                pos[ka + 2] += sz;
                pos[kb] -= sx;
                pos[kb + 1] -= sy;
                pos[kb + 2] -= sz;
            }

            // Решатель только что подвинул и захваченные кромки — возвращаем их в руки.
            if (hold) leadEdges(pos, state.anchor, grabbed, hold.angle, hold.grip);

            // Стол. Ткань в него не проваливается и по нему не скользит.
            for (let i = 0; i < COUNT; i += 1) {
                const k = i * 3;
                if (pos[k + 1] < GROUND) {
                    pos[k + 1] = GROUND;
                    prev[k] += (pos[k] - prev[k]) * GROUND_FRICTION;
                    prev[k + 2] += (pos[k + 2] - prev[k + 2]) * GROUND_FRICTION;
                }
            }
        }

        geometry.attributes.position.array.set(pos);
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();

        // Пока идёт жест — не спим ни при каких скоростях: в верхней точке переворота
        // кромки на мгновение замирают, и по одной скорости это неотличимо от покоя.
        if (state.playing || fastest > SLEEP_EPS) state.still = 0;
        else if ((state.still += 1) > SLEEP_FRAMES) state.asleep = true;
    });

    // Изнанка — это тот же лист, отодвинутый на толщину ткани по нормали.
    // Без этого полотно выглядит нарисованным на столе: у кромки нет высоты.
    const backThickness = useCallback((material) => {
        // React зовёт ref-колбэк и на размонтировании, с null: полотно уходит вместе со
        // всей группой, когда общий Suspense сцены уводит детей в fallback.
        if (!material) return;
        material.onBeforeCompile = (shader) => {
            shader.vertexShader = shader.vertexShader.replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>\n transformed -= objectNormal * ${THICKNESS.toFixed(5)};`
            );
        };
        material.needsUpdate = true;
    }, []);

    // Габардин/сатин: матовая основа плюс мягкий направленный отблеск по всей поверхности.
    return (
        <group>
            <mesh geometry={geometry} castShadow receiveShadow>
                <meshPhysicalMaterial map={faceYa} side={THREE.FrontSide} roughness={0.68} sheen={1} sheenRoughness={0.32} sheenColor="#fbf7ef" />
            </mesh>
            <mesh geometry={geometry} castShadow receiveShadow>
                <meshPhysicalMaterial ref={backThickness} map={faceMy} side={THREE.BackSide} roughness={0.68} sheen={1} sheenRoughness={0.32} sheenColor="#fbf7ef" />
            </mesh>
        </group>
    );
}

export const FIELD_ACTIONS = [
    { id: "flip", label: "Перевернуть" },
    { id: "reset", label: "Расстелить заново" },
];

// Встраиваемая часть: только полотно, без сцены вокруг. Так поле кладётся и на общий
// стол рядом с колодой и жетонами, и на стенд отдельной страницы (stands.js).
export const ClothFieldGroup = forwardRef(function ClothFieldGroup({ position = [0, 0, 0], onStatus }, ref) {
    // sign — куда смотрит полотно относительно исходной раскладки: переворот зеркалит его
    // по X, поэтому цель разглаживания после нечётного переворота тоже зеркальная.
    const run = useRef({ playing: false, t: 0, sign: 1, anchor: null, reset: null, onDone: null, asleep: false, still: 0 });
    // Базовая сторона — «Я»: с неё начинается партия, её и стелют первой.
    const [face, setFace] = useState("ya");
    const [busy, setBusy] = useState(false);

    const flip = useCallback(() => {
        if (run.current.playing) return;
        run.current.asleep = false; // начинается жест — будим ткань
        run.current.t = 0;
        run.current.anchor = null;
        run.current.sign = -run.current.sign;
        run.current.onDone = () => {
            setFace((current) => (current === "ya" ? "my" : "ya"));
            setBusy(false);
        };
        run.current.playing = true;
        setBusy(true);
    }, []);

    const reset = useCallback(() => {
        run.current.asleep = false;
        run.current.playing = false;
        run.current.t = 0;
        run.current.anchor = null;
        run.current.sign = 1;
        run.current.reset?.();
        setFace("ya");
        setBusy(false);
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            run: (action) => (action === "flip" ? flip() : action === "reset" ? reset() : undefined),
            hint: () => `Вверх смотрит сторона «${face === "ya" ? "Я" : "МЫ"}»`,
            // Кому-то снаружи важно, какой стороной лежит поле: раскладка такта живёт
            // на стороне «МЫ», и общий стол сам поворачивает полотно перед процессом.
            face: () => face,
        }),
        [flip, reset, face]
    );

    // Наружу отдаём состояние отдельно от ref: по ref интерфейс не перерисуется.
    useEffect(() => {
        onStatus?.({ face, busy });
    }, [face, busy, onStatus]);

    return (
        <group position={position}>
            <Cloth run={run} />
        </group>
    );
});
