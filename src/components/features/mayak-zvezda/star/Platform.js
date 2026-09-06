"use client";

// Звезда-платформа с маяком. Сцена собирается под эталонные кадры public/zvezda-star/,
// и числа здесь правятся по картинке, а не выводятся.
//
// Стиль — матовый белый гипс. Выбран не за красоту: это единственная стилистика, где
// отсутствие текстур не недостаток, а требование. Наш набор моделей текстур не имеет вовсе,
// и в тёмной сцене выглядел пластмассой; здесь то же свойство работает на нас.
//
// Белое на белом читается только затенением в стыках. Поэтому мягкая тень под объектами
// здесь не украшение — без неё тумбы сливаются с платформой в одно пятно.

import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { LEVELS, RAYS } from "../model/zvezda.mjs";
import {
    ACCENT,
    OVERVIEW,
    PEDESTAL,
    SECTOR_MIN_HALF,
    SECTOR_STATIONS,
    STAR,
    TOWER,
    crown,
    inlay,
    pedestalAt,
    plinth,
    rayAngle,
    rayCamera,
    sectorHalfWidth,
    starOutline,
    staveAngles,
    tiers,
} from "../model/platform.mjs";
import { lightPreset } from "../model/light.mjs";
import Props from "./Props";

const PLASTER = "#f2f3f5";

// Свечение маяка: тёплый золотистый поток линзы Френеля (~3200K).
// Вольфрамово-янтарный луч рассекает пространство, создавая благородный контраст с белым гипсом.
const GLOW = "#ffe6ba";
const LIT = "#ffd485";

// Материалы и геометрии стоек и окон — общие. Их много и они одинаковы: своя копия у каждой
// из девяноста с лишним стоек не давала ничего, кроме памяти и работы сборщику мусора.
const MAT_STAVE = new THREE.MeshStandardMaterial({ color: PLASTER, roughness: 0.8, emissive: new THREE.Color(GLOW), emissiveIntensity: 0.12 });

// Геометрия стойки — единичная, конкретный размер задаётся матрицей экземпляра.
//
// Накладных окон на ярусах больше нет: на кадре они читались не проёмами, а рядом кнопок
// на корпусе. Стенка яруса светится сама, и вертикальная штриховка стоек ей достаточна.
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

// Циклорама: мягкое световое пятно под конструкцией вместо ровной заливки. На эталоне пол
// студийный — к краям кадра он темнеет, и именно это отделяет сцену от фона, у которого тон
// тот же. Градиент рисуется в canvas один раз и растягивается на 15 единиц сцены; дальше
// текстура зажимается краевым пикселем, поэтому он обязан совпадать с цветом фона — иначе
// на стыке плиты с фоном появится видимое кольцо.
function useBackdrop(preset) {
    return useMemo(() => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        g.addColorStop(0, preset.floor[0]);
        g.addColorStop(0.45, preset.floor[1]);
        g.addColorStop(1, preset.bg);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        const spread = 240 / 15;
        tex.repeat.set(spread, spread);
        tex.offset.set(-(spread - 1) / 2, -(spread - 1) / 2);
        return tex;
    }, [preset]);
}

// Полировка. На эталоне гипс не матовый: по кромкам идёт узкий блик, а плоскости ловят
// отражение окружения. Это лаковый слой поверх матовой основы — clearcoat, и он есть только
// у MeshPhysicalMaterial. Просто занизить roughness нельзя: тогда белое станет зеркальным
// целиком и потеряет объём.
function polished(extra = {}) {
    return { roughness: 0.42, metalness: 0.02, clearcoat: 0.7, clearcoatRoughness: 0.18, ...extra };
}

// Слабая машина или нет — решается один раз при создании холста, по самой машине.
//
// Считать это по частоте кадров нельзя: сцена рисуется по запросу и в покое стоит на нуле
// кадров, так что любой счётчик fps объявит слабой даже самую быструю видеокарту. Поэтому
// смотрим, что за железо: встроенная графика, мобильный чип, программный рендер или мало
// ядер — значит облегчённый режим. Ошибка в сторону «слабая» дешевле обратной: разница
// в кадре заметна только в отражении пола, а рывки видно всем.
//
// ?quality=high и ?quality=low перекрывают решение — для проверки на конкретной машине.
function weakMachine(gl) {
    if (typeof window !== "undefined") {
        const forced = new URLSearchParams(window.location.search).get("quality");
        if (forced === "low") return true;
        if (forced === "high") return false;
    }
    if ((navigator.hardwareConcurrency ?? 8) <= 4) return true;
    if (window.devicePixelRatio >= 3) return true;
    try {
        const ext = gl.getContext().getExtension("WEBGL_debug_renderer_info");
        const name = ext ? String(gl.getContext().getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
        return /swiftshader|llvmpipe|software|mali|adreno|powervr|apple gpu|intel.*(hd|uhd|iris xe? graphics)/i.test(name);
    } catch {
        return false;
    }
}

function StarSlab() {
    const geo = useMemo(() => {
        const shape = new THREE.Shape();
        starOutline().forEach(([x, y], i) => {
            // Локальный y фигуры после укладки плашмя становится мировым −z, поэтому знак
            // здесь инвертирован: иначе звезда встаёт зеркально к расчёту лучей.
            if (i === 0) shape.moveTo(x, -y);
            else shape.lineTo(x, -y);
        });
        shape.closePath();
        return new THREE.ExtrudeGeometry(shape, {
            depth: STAR.thickness,
            bevelEnabled: true,
            bevelThickness: STAR.bevel,
            bevelSize: STAR.bevel,
            bevelSegments: 3,
            curveSegments: 2,
        });
    }, []);

    return (
        <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -(STAR.thickness + STAR.bevel), 0]} castShadow receiveShadow>
            <meshPhysicalMaterial color={PLASTER} {...polished()} />
        </mesh>
    );
}

function Pedestal({ index, color, ray, onPick, onHover }) {
    const at = pedestalAt(index);
    return (
        <group position={at}>
            <mesh
                castShadow
                receiveShadow
                onClick={(e) => {
                    e.stopPropagation();
                    onPick(ray.id);
                }}
                onPointerOver={() => {
                    document.body.style.cursor = "pointer";
                    onHover(ray.id);
                }}
                onPointerOut={() => {
                    document.body.style.cursor = "";
                    onHover(null);
                }}
            >
                <cylinderGeometry args={[PEDESTAL.radius, PEDESTAL.radius, PEDESTAL.height - PEDESTAL.chamfer, 48]} />
                <meshPhysicalMaterial color={PLASTER} {...polished()} />
            </mesh>
            {/* Фаска кромки. Отдельным конусом, а не скруглением геометрии: цилиндр в three
                фасок не умеет, а усечённый конус в 0.022 высотой даёт ровно ту светлую линию,
                которой на эталоне столешница отделена от боковой стенки. */}
            <mesh position={[0, PEDESTAL.height / 2 - PEDESTAL.chamfer / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[PEDESTAL.radius - PEDESTAL.chamfer, PEDESTAL.radius, PEDESTAL.chamfer, 48]} />
                <meshPhysicalMaterial color={PLASTER} {...polished()} />
            </mesh>
            {/* Бортик по краю столешницы: тор, выступающий над крышкой цилиндра ровно на свой
                малый радиус. Поле от этого оказывается утопленным, тумба читается блюдцем.
                Тором, а не открытым цилиндром: у открытого цилиндра нет верхней грани, и на
                просвет видно его изнанку. */}
            <mesh position={[0, PEDESTAL.height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <torusGeometry args={[PEDESTAL.radius - PEDESTAL.chamfer - PEDESTAL.lip, PEDESTAL.lip, 10, 64]} />
                <meshPhysicalMaterial color={PLASTER} {...polished()} />
            </mesh>

            {/* Кольцо цвета лежит на верхней кромке. Свечения нет намеренно: со свечением
                старший канал упирается в потолок, кольцо становится ровной полосой без
                светотени по окружности — на эталоне же она есть и заметная. */}
            <mesh position={[0, PEDESTAL.height / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <torusGeometry args={[PEDESTAL.rimRadius, PEDESTAL.rimThickness, 12, 72]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.35} />
            </mesh>

        </group>
    );
}

// Камера. Едет к цели плавно, с затуханием, а не по таймеру: если пользователь кликнул на
// полпути, она разворачивается из текущей точки, а не доигрывает старую анимацию. Поле зрения
// тоже едет — обзор снят длинным объективом, подлёт коротким.
//
// Он же водитель отрисовки. Сцена стоит в режиме demand и по умолчанию не рисуется вовсе;
// кадр запрашивается, только пока камера едет. Это главная экономия: сцена статична, и
// прежний режим always жёг полный кадр каждые 26 мс круглосуточно.
// Кратчайшая угловая разница на окружности в диапазоне [-PI, PI]
function shortestAngle(from, to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function CameraRig({ ray, level }) {
    const camera = useThree((s) => s.camera);
    const invalidate = useThree((s) => s.invalidate);
    const target = useRef(new THREE.Vector3(...OVERVIEW.target));
    const goalPos = useRef(new THREE.Vector3());
    const isFirstMount = useRef(true);

    const warmupFrames = useRef(0);

    // Сменились луч или уровень — разбудить отрисовку. Уровень меняет свечение ярусов,
    // и без этого маяк переключался бы только при следующем движении камеры.
    useEffect(() => {
        warmupFrames.current = 0;
        invalidate();
        const t1 = setTimeout(invalidate, 80);
        const t2 = setTimeout(invalidate, 300);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [ray, level, invalidate]);

    useFrame((_, dt) => {
        const goal = ray == null ? OVERVIEW : rayCamera(ray);

        if (isFirstMount.current) {
            isFirstMount.current = false;
            if (ray != null) {
                camera.position.set(goal.position[0], goal.position[1], goal.position[2]);
                camera.fov = goal.fov;
                camera.updateProjectionMatrix();
                target.current.set(goal.target[0], goal.target[1], goal.target[2]);
                camera.lookAt(target.current);
                invalidate();
                return;
            }
        }
        // Кламп обязателен именно в режиме demand: dt первого кадра после простоя равен
        // длине простоя, и без ограничения камера телепортируется в конечную точку.
        const d = Math.min(dt, 1 / 30);
        const k = 3.4;

        // Цилиндрическая/дуговая интерполяция позиции камеры:
        // при переходе между соседними лучами камера скользит по круговой орбите вокруг маяка,
        // сохраняя комфортную дистанцию и не проваливаясь внутрь башни.
        const curX = camera.position.x;
        const curZ = camera.position.z;
        const curR = Math.hypot(curX, curZ);
        const goalX = goal.position[0];
        const goalZ = goal.position[2];
        const goalR = Math.hypot(goalX, goalZ);
        const goalA = Math.atan2(goalZ, goalX);
        const curA = curR > 0.1 ? Math.atan2(curZ, curX) : goalA;

        const diffA = shortestAngle(curA, goalA);
        const nextA = THREE.MathUtils.damp(curA, curA + diffA, k, d);
        const nextR = THREE.MathUtils.damp(curR, goalR, k, d);
        const nextY = THREE.MathUtils.damp(camera.position.y, goal.position[1], k, d);

        camera.position.x = nextR * Math.cos(nextA);
        camera.position.y = nextY;
        camera.position.z = nextR * Math.sin(nextA);

        // Цилиндрическая интерполяция точки взгляда (target):
        // между тумбами фокус скользит по круговой дуге расположения тумб,
        // не прорезая ствол маяка по прямой хорде.
        const curTx = target.current.x;
        const curTz = target.current.z;
        const curTR = Math.hypot(curTx, curTz);
        const goalTx = goal.target[0];
        const goalTz = goal.target[2];
        const goalTR = Math.hypot(goalTx, goalTz);
        const goalTA = Math.atan2(goalTz, goalTx);

        if (goalTR < 0.08) {
            // Возврат к центру (обзор)
            const nextTR = THREE.MathUtils.damp(curTR, goalTR, k, d);
            const nextTY = THREE.MathUtils.damp(target.current.y, goal.target[1], k, d);
            target.current.x = curTR > 0.01 ? nextTR * (curTx / curTR) : 0;
            target.current.y = nextTY;
            target.current.z = curTR > 0.01 ? nextTR * (curTz / curTR) : 0;
        } else if (curTR < 0.08) {
            // Выезд от центра к выбранному лучу
            const nextTR = THREE.MathUtils.damp(curTR, goalTR, k, d);
            const nextTY = THREE.MathUtils.damp(target.current.y, goal.target[1], k, d);
            target.current.x = nextTR * Math.cos(goalTA);
            target.current.y = nextTY;
            target.current.z = nextTR * Math.sin(goalTA);
        } else {
            // Переход между соседними тумбами по круговой дуге
            const curTA = Math.atan2(curTz, curTx);
            const diffTA = shortestAngle(curTA, goalTA);
            const nextTA = THREE.MathUtils.damp(curTA, curTA + diffTA, k, d);
            const nextTR = THREE.MathUtils.damp(curTR, goalTR, k, d);
            const nextTY = THREE.MathUtils.damp(target.current.y, goal.target[1], k, d);
            target.current.x = nextTR * Math.cos(nextTA);
            target.current.y = nextTY;
            target.current.z = nextTR * Math.sin(nextTA);
        }

        const fov = THREE.MathUtils.damp(camera.fov, goal.fov, k, d);
        if (Math.abs(fov - camera.fov) > 1e-4) {
            camera.fov = fov;
            camera.updateProjectionMatrix();
        }
        camera.lookAt(target.current);

        // Не доехали — просим следующий кадр. Доехали — отрисовка засыпает сама.
        goalPos.current.set(goal.position[0], goal.position[1], goal.position[2]);
        const closePos = camera.position.distanceToSquared(goalPos.current) < 2.5e-5;
        const closeFov = Math.abs(camera.fov - goal.fov) < 0.02;
        const closeTarget =
            Math.abs(target.current.x - goal.target[0]) < 5e-3 &&
            Math.abs(target.current.y - goal.target[1]) < 5e-3 &&
            Math.abs(target.current.z - goal.target[2]) < 5e-3;
        if (closePos && closeFov && closeTarget) {
            camera.position.copy(goalPos.current);
            target.current.set(goal.target[0], goal.target[1], goal.target[2]);
            if (camera.fov !== goal.fov) {
                camera.fov = goal.fov;
                camera.updateProjectionMatrix();
            }
            camera.lookAt(target.current);
            if (warmupFrames.current < 25) {
                warmupFrames.current += 1;
                invalidate();
            }
            return;
        }
        invalidate();
    });
    return null;
}

// Прогрессия закрашивания луча: на уровне -1 (level 1) — тонкая линия жилы,
// к уровню +4 (level 6) — сектор полностью заполняется акцентным цветом.
//
// Сечения и полуширина берутся из модели: то же самое считает raySector, который проверяется
// тестом без сцены. Две копии одной формулы уже разъезжались — заливка обрывалась у тумбы,
// потому что здесь не было станции на кончике луча.
function Inlay({ index, color, level = 1 }) {
    const line = useMemo(() => inlay(index), [index]);
    const a = line.angle;
    const targetU = Math.max(0, Math.min(1, (level - 1) / 5));
    const currentU = useRef(targetU);
    const invalidate = useThree((s) => s.invalidate);

    const { geo, posAttr } = useMemo(() => {
        const g = new THREE.BufferGeometry();
        const n = SECTOR_STATIONS.length;
        const pos = new Float32Array(n * 2 * 3);
        const normals = new Float32Array(n * 2 * 3);
        for (let i = 0; i < n * 2; i += 1) {
            normals[i * 3 + 1] = 1;
        }
        // Лента из четырёхугольников между соседними сечениями.
        const indices = [];
        for (let i = 0; i < n - 1; i += 1) {
            const l = i * 2;
            indices.push(l, l + 1, l + 2, l + 2, l + 1, l + 3);
        }
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
        g.setIndex(indices);
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(1.5, 0, 0), 3.0);
        return { geo: g, posAttr: g.attributes.position };
    }, []);

    useEffect(() => {
        return () => geo.dispose();
    }, [geo]);

    const updateVerts = (u) => {
        const h0 = SECTOR_MIN_HALF;
        for (let i = 0; i < SECTOR_STATIONS.length; i += 1) {
            const x = SECTOR_STATIONS[i];
            const hw = h0 + (sectorHalfWidth(x) - h0) * u;
            posAttr.setXYZ(i * 2, x, 0.0025, -hw);
            posAttr.setXYZ(i * 2 + 1, x, 0.0025, hw);
        }
        posAttr.needsUpdate = true;
    };

    useLayoutEffect(() => {
        updateVerts(currentU.current);
    }, [geo]);

    useEffect(() => {
        invalidate();
    }, [level, invalidate]);

    useFrame((_, dt) => {
        const diff = targetU - currentU.current;
        if (Math.abs(diff) < 1e-4) {
            if (currentU.current !== targetU) {
                currentU.current = targetU;
                updateVerts(targetU);
                invalidate();
            }
            return;
        }
        currentU.current = THREE.MathUtils.damp(currentU.current, targetU, 5.0, Math.min(dt, 1 / 30));
        updateVerts(currentU.current);
        invalidate();
    });

    return (
        <group rotation={[0, -a, 0]}>
            {/* Расширяющийся сектор маркетри на платформе. Отдельной яркой жилы по оси луча
                больше нет: она оставалась видимой полосой поверх заливки на всех уровнях
                выше −1, и сектор читался не сплошным, а с рубцом посередине. */}
            <mesh geometry={geo}>
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    // Свечение сдержанное, шероховатость выше: на глянце широкий белый блик
                    // ложился поверх цвета и съедал насыщенность — лента выходила пастельной
                    // при насыщенном цвете в палитре.
                    emissiveIntensity={0.22 + targetU * 0.2}
                    roughness={0.55}
                    metalness={0}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </group>
    );
}

// Направленный свет маяка на выбранный объект:
// когда выбран луч (ray != null), прожектор из фонаря маяка поворачивается к тумбе,
// и между маяком и тумбой возникает мягкий световой луч.
// Докуда доводится видимый конус: доля расстояния от фонаря до тумбы.
const BEAM_REACH = 0.62;

function LighthouseBeam({ rayIndex }) {
    const spotRef = useRef();
    const beamRef = useRef();
    const beamMatRef = useRef();
    const targetObj = useMemo(() => new THREE.Object3D(), []);
    const invalidate = useThree((s) => s.invalidate);

    const c = useMemo(crown, []);
    const lanternY = c.lanternY;

    const currIntensity = useRef(0);
    const currOpacity = useRef(0);
    const currTarget = useRef(new THREE.Vector3(0, 0, 0));
    const goalVec = useRef(new THREE.Vector3(0, 0, 0));
    const vStart = useRef(new THREE.Vector3(0, 0, 0));
    const vEnd = useRef(new THREE.Vector3(0, 0, 0));
    const vDir = useRef(new THREE.Vector3(0, 0, 0));
    const vUp = new THREE.Vector3(0, 1, 0);

    useEffect(() => {
        invalidate();
    }, [rayIndex, invalidate]);

    useFrame((_, dt) => {
        const active = rayIndex != null;
        const goalIntensity = active ? 3.4 : 0;
        const goalOpacity = active ? 0.2 : 0;

        let goalPos = [0, 0, 0];
        const d = Math.min(dt, 1 / 30);
        const k = 4.0;

        if (active) {
            const [px, py, pz] = pedestalAt(rayIndex);
            goalPos = [px, py + 0.22, pz];
            const goalR = Math.hypot(px, pz);
            const goalA = Math.atan2(pz, px);
            const curR = Math.hypot(currTarget.current.x, currTarget.current.z);
            const curA = curR > 0.05 ? Math.atan2(currTarget.current.z, currTarget.current.x) : goalA;
            const diffA = shortestAngle(curA, goalA);
            const nextA = THREE.MathUtils.damp(curA, curA + diffA, k, d);
            const nextR = THREE.MathUtils.damp(curR > 0.05 ? curR : goalR, goalR, k, d);
            const nextY = THREE.MathUtils.damp(currTarget.current.y, py + 0.22, k, d);
            currTarget.current.set(nextR * Math.cos(nextA), nextY, nextR * Math.sin(nextA));
        } else {
            goalPos = [currTarget.current.x, currTarget.current.y, currTarget.current.z];
        }
        goalVec.current.set(goalPos[0], goalPos[1], goalPos[2]);

        currIntensity.current = THREE.MathUtils.damp(currIntensity.current, goalIntensity, k, d);
        currOpacity.current = THREE.MathUtils.damp(currOpacity.current, goalOpacity, k, d);

        if (spotRef.current) {
            spotRef.current.intensity = currIntensity.current;
            targetObj.position.copy(currTarget.current);
            targetObj.updateMatrixWorld();
        }

        if (beamRef.current && beamMatRef.current) {
            beamMatRef.current.opacity = currOpacity.current;
            if (currOpacity.current > 1e-4) {
                beamRef.current.visible = true;
                const tx = currTarget.current.x;
                const ty = currTarget.current.y;
                const tz = currTarget.current.z;

                vStart.current.set(0, lanternY, 0);
                vEnd.current.set(tx, ty, tz);
                vDir.current.subVectors(vEnd.current, vStart.current);
                // Луч обрывается, не доходя до тумбы.
                //
                // Раньше конус доводился до самой столешницы и проходил сквозь предмет:
                // полупрозрачная стенка резала коробку пополам и читалась гранью, а не светом.
                // Свет на предмет по-прежнему падает — его даёт прожектор, а видимый конус
                // теперь только показывает направление и гаснет на подлёте.
                const full = vDir.current.length();
                const len = full * BEAM_REACH;

                beamRef.current.position.set((tx * BEAM_REACH) / 2, lanternY + ((ty - lanternY) * BEAM_REACH) / 2, (tz * BEAM_REACH) / 2);
                beamRef.current.scale.set(1, len, 1);
                vDir.current.negate().normalize();
                beamRef.current.quaternion.setFromUnitVectors(vUp, vDir.current);
            } else {
                beamRef.current.visible = false;
            }
        }

        const moving =
            Math.abs(currIntensity.current - goalIntensity) > 1e-3 ||
            Math.abs(currOpacity.current - goalOpacity) > 1e-3 ||
            (active && currTarget.current.distanceToSquared(goalVec.current) > 1e-4);

        if (moving) {
            invalidate();
        }
    });

    const beamGeo = useMemo(() => {
        // Усечённый конус единичной высоты от фонаря в сторону тумбы. Раструб сужен: широкий
        // конус накрывал предмет целиком, и вместо луча получался полупрозрачный колпак.
        return new THREE.CylinderGeometry(0.07, 0.26, 1, 32, 1, true);
    }, []);

    useEffect(() => {
        return () => beamGeo.dispose();
    }, [beamGeo]);

    return (
        <>
            <primitive object={targetObj} />
            {/* Прожектор маяка теней не бросает. Он светит вдоль луча на тумбу, где всё,
                что могло бы отбросить тень, — сам предмет; зато собственная карта теней
                пересчитывалась на каждом кадре подлёта и стоила второго прохода по сцене. */}
            <spotLight
                ref={spotRef}
                position={[0, lanternY, 0]}
                target={targetObj}
                angle={Math.PI / 8}
                penumbra={0.85}
                distance={7.5}
                color="#fff4dc"
                intensity={0}
            />
            <mesh ref={beamRef} geometry={beamGeo} visible={false}>
                <meshBasicMaterial
                    ref={beamMatRef}
                    color="#ffe3aa"
                    transparent
                    opacity={0}
                    blending={THREE.AdditiveBlending}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
        </>
    );
}


// Маяк. Ярус светится, если уровень достигнут: сколько горит — там организация и стоит.
// Легенды не требует, и это главное, ради чего он в центре.
// Кольцо вертикальных стоек вокруг яруса. Ставится и на ярусы, и на фонарь, поэтому вынесено
// отдельно. Шесть ярусов по четырнадцать стоек — 84 меша, но сцена рисуется по запросу
// и стоит неподвижно, так что платит за них только подлёт камеры.
function Staves({ y, radius, height }) {
    const angles = useMemo(staveAngles, []);
    const ref = useRef();
    useLayoutEffect(() => {
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const e = new THREE.Euler();
        const p = new THREE.Vector3();
        const s = new THREE.Vector3(TOWER.staveOut * 2, height, TOWER.staveWidth);
        angles.forEach((a, i) => {
            p.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
            q.setFromEuler(e.set(0, -a, 0));
            m.compose(p, q, s);
            ref.current.setMatrixAt(i, m);
        });
        ref.current.instanceMatrix.needsUpdate = true;
        ref.current.computeBoundingSphere();
    }, [angles, radius, height]);
    // Один вызов отрисовки на кольцо вместо двенадцати. Стойки одинаковы во всём, кроме
    // положения, а это ровно тот случай, ради которого существует instancedMesh.
    return <instancedMesh ref={ref} args={[UNIT_BOX, MAT_STAVE, angles.length]} position={[0, y, 0]} castShadow receiveShadow />;
}

function Tower({ level, glow = 1 }) {
    const stack = useMemo(tiers, []);
    const foot = useMemo(plinth, []);
    const c = useMemo(crown, []);
    const lanternOn = level >= LEVELS.length;
    return (
        <group>
            {/* Цоколь с округлым основанием и светящейся щелью */}
            <mesh position={[0, foot.bottom.y, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[foot.bottom.radius, foot.bottom.radius, foot.bottom.height, 48]} />
                <meshStandardMaterial color={PLASTER} roughness={0.35} metalness={0.04} />
            </mesh>
            <mesh position={[0, foot.bottom.y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <torusGeometry args={[foot.bottom.radius, foot.bottom.height * 0.36, 16, 48]} />
                <meshStandardMaterial color={PLASTER} roughness={0.35} metalness={0.04} />
            </mesh>
            <mesh position={[0, foot.glow.y, 0]}>
                <cylinderGeometry args={[foot.glow.radius, foot.glow.radius, foot.glow.height, 48]} />
                <meshStandardMaterial color={PLASTER} emissive={GLOW} emissiveIntensity={(1.8 + level * 0.15) * glow} roughness={0.5} />
            </mesh>
            <mesh position={[0, foot.top.y, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[foot.top.radius, foot.top.radius, foot.top.height, 48]} />
                <meshStandardMaterial color={PLASTER} roughness={0.35} metalness={0.04} />
            </mesh>

            {stack.map((t) => {
                const on = t.level <= level;
                const wallHeight = t.height - TOWER.corniceHeight;
                const wallY = t.y - TOWER.corniceHeight / 2;
                return (
                    <group key={t.level}>
                        <mesh position={[0, wallY, 0]} castShadow receiveShadow>
                            <cylinderGeometry args={[t.rTop, t.rBottom, wallHeight, 40]} />
                            <meshStandardMaterial color={PLASTER} emissive={on ? GLOW : "#000000"} emissiveIntensity={on ? 2.3 * glow : 0} roughness={0.55} />
                        </mesh>
                        {/* Вертикальные стойки по окружности. Стенка светится, стойки белые —
                            на этом контрасте ярус читается строением, а не лампой. */}
                        <Staves y={wallY} radius={(t.rTop + t.rBottom) / 2} height={wallHeight} />
                        {/* Округлый карниз-обод на стыке ярусов (по эталонному 3D-рендеру) */}
                        <mesh position={[0, t.y + t.height / 2 - TOWER.corniceHeight / 2, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                            <torusGeometry args={[t.rTop * TOWER.corniceOut, TOWER.corniceHeight * 0.38, 16, 48]} />
                            <meshStandardMaterial color={PLASTER} roughness={0.32} metalness={0.04} />
                        </mesh>
                        <mesh position={[0, t.y + t.height / 2 - TOWER.corniceHeight / 2, 0]} castShadow receiveShadow>
                            <cylinderGeometry args={[t.rTop * TOWER.corniceOut, t.rTop * TOWER.corniceOut, TOWER.corniceHeight * 0.8, 40]} />
                            <meshStandardMaterial color={PLASTER} roughness={0.32} metalness={0.04} />
                        </mesh>
                    </group>
                );
            })}

            {/* Округлая площадка галереи под фонарём */}
            <mesh position={[0, c.galleryY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <torusGeometry args={[TOWER.galleryRadius, TOWER.galleryHeight * 0.42, 16, 48]} />
                <meshStandardMaterial color={PLASTER} roughness={0.32} metalness={0.04} />
            </mesh>
            <mesh position={[0, c.galleryY, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[TOWER.galleryRadius, TOWER.galleryRadius, TOWER.galleryHeight * 0.85, 32]} />
                <meshStandardMaterial color={PLASTER} roughness={0.32} metalness={0.04} />
            </mesh>

            {/* Фонарь горит только на верхнем уровне: маяк заработал целиком. */}
            <mesh position={[0, c.lanternY, 0]} castShadow>
                <cylinderGeometry args={[TOWER.lanternRadius * 0.92, TOWER.lanternRadius, TOWER.lanternHeight, 24]} />
                <meshStandardMaterial
                    color={PLASTER}
                    emissive={lanternOn ? GLOW : "#000000"}
                    emissiveIntensity={lanternOn ? 2.8 * glow : 0}
                    roughness={0.5}
                />
            </mesh>
            <Staves y={c.lanternY} radius={TOWER.lanternRadius * 0.96} height={TOWER.lanternHeight} />

            {/* Округлый ободок под куполом */}
            <mesh position={[0, c.rimY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <torusGeometry args={[TOWER.lanternRadius * 1.16, TOWER.domeRim * 0.45, 16, 48]} />
                <meshStandardMaterial color={PLASTER} roughness={0.32} metalness={0.04} />
            </mesh>
            <mesh position={[0, c.rimY, 0]} castShadow>
                <cylinderGeometry args={[TOWER.lanternRadius * 1.16, TOWER.lanternRadius * 1.16, TOWER.domeRim * 0.85, 32]} />
                <meshStandardMaterial color={PLASTER} roughness={0.32} metalness={0.04} />
            </mesh>

            {/* Гладкий чистый полусферический купол БЕЗ верхней пимпочки (шпиль удален по запросу) */}
            <mesh position={[0, c.domeBase, 0]} scale={[1, TOWER.domeSquash, 1]} castShadow>
                <sphereGeometry args={[c.domeRadius, 36, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color={PLASTER} roughness={0.26} metalness={0.05} />
            </mesh>

            {/* Тёплая лужа света на платформе вокруг основания — она и делает «горит»
                событием сцены, а не покраской цилиндра. */}
            {/* После среза заливки та же мощность залила середину звезды тёплым пятном:
                лужа должна лежать у подножия, а не выбеливать половину платформы. */}
            <pointLight position={[0, 0.34 + level * 0.06, 0]} intensity={(0.5 + level * 0.2) * glow} distance={2.1} decay={2.2} color={LIT} />
            {/* Второй тёплый источник — на середине горящей части ствола. Стойки и карнизы
                стоят снаружи стенки, свет изнутри до них не доходит, и при одном источнике
                у подножия верхние ярусы выходили серыми: конструкция темнее того, что она
                подсвечивает. Источник едет вверх вместе с уровнем — он и есть «свет из окон». */}
            <pointLight position={[0, TOWER.baseHeight + level * TOWER.tierHeight * 0.55, 0]} intensity={(0.35 + level * 0.08) * glow} distance={1.5} decay={2} color={LIT} />
        </group>
    );
}

// children — точка вставки для того, что ставится НА платформу: предметы на тумбах.
// Сама платформа о них ничего не знает и знать не должна, поэтому они приходят снаружи,
// а не заводятся здесь. Добавка чисто аддитивная: без детей файл ведёт себя как прежде.
export default function Platform({ level = 1, ray = null, light = 1, onPickRay = () => {}, onHoverRay = () => {}, freeze = null, children }) {
    const rayIndex = ray ? RAYS.findIndex((r) => r.id === ray) : null;
    const preset = lightPreset(light);
    const backdrop = useBackdrop(preset);
    // Облегчённый режим. Включается сам, когда машина не тянет: без отражений, без
    // сглаживания в композере и с дешёвым затенением. Всё остальное — свет, предметы,
    // геометрия — остаётся тем же: пользователь должен видеть ту же сцену, просто грубее.
    const [lightMode, setLightMode] = useState(false);
    return (
        <Canvas
            // Отрисовка по запросу. Сцена статична: она обязана считать кадр, только пока
            // что-то движется — едет камера, растёт заливка луча, печатается предмет. В режиме
            // always тот же кадр со всем постпроцессом считался шестьдесят раз в секунду
            // круглосуточно, и это была не «одна из причин» тяжести, а вся она: 24 кадра/с
            // на обзоре при неподвижной картинке.
            frameloop="demand"
            // Плотность срезана до 1.5. При demand кадр редкий, но когда он считается — он
            // считается целиком, вместе с AO и блумом, а их цена растёт квадратом плотности.
            // Разница между 1.5 и 2 на кромках карнизов видна только при сравнении вплотную,
            // разница в цене кадра — почти двукратная.
            dpr={[1, 1.5]}
            shadows={{ type: THREE.PCFShadowMap }}
            camera={{ position: OVERVIEW.position, fov: OVERVIEW.fov }}
            // Клик по пустому месту возвращает к обзору — но только если это действительно
            // холст. Подписи лучей живут в DOM-портале поверх канваса, для fiber их клик
            // «мимо сцены», и без этой проверки выбор луча гасился в тот же кадр, в котором
            // происходил: подпись выставляла луч, обработчик тут же его снимал.
            onPointerMissed={(e) => {
                if (e.target instanceof HTMLCanvasElement) onPickRay(null);
            }}
            onCreated={({ camera, scene, gl }) => {
                camera.lookAt(...OVERVIEW.target);
                scene.background = new THREE.Color(preset.bg);
                setLightMode(weakMachine(gl));
            }}
            gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: preset.exposure }}
        >
            {/* Свет студийный, но заливки заметно меньше, чем кажется правильным на слух.
                При прежней заливке гипс выходил светлее фона, а на эталоне он темнее фона —
                то есть объект тонул, а не стоял. Ключ поднят почти в зенит: шесть серых
                клякс, отъезжавших от тумб вбок, шли именно от низкого угла, на эталоне их
                нет ни у одной тумбы. Перепад «верх против боковой стенки» при этом растёт
                с 11 уровней до полусотни ещё до всякого AO. */}
            {/* Студийное окружение вместо голых источников. Эталон — продуктовый рендер:
                гипс там освещён со всех сторон отражённым светом, и потому остаётся белым
                даже в тени. У нас стоял один направленный ключ, и всё, что он не доставал —
                стойки, карнизы, изнанка тумб — уходило в серое; затенение эту серость ещё и
                удваивало, отчего сцена читалась пыльной.
                Окружение собрано из Lightformer прямо в сцене, а не взято пресетом: пресеты
                drei тянут HDRI из сети, а сцена обязана работать без неё. Считается один раз
                (frames по умолчанию), потом только читается. */}
            <Environment key={preset.id} resolution={256}>
                {/* Софтбокс сверху — основной свет студии. */}
                <Lightformer form="rect" intensity={1.7 * preset.fill} position={[0, 6, 1]} rotation={[-Math.PI / 2, 0, 0]} scale={[12, 12, 1]} />
                {/* Боковые заполняющие: они и делают белое белым в тенях. */}
                <Lightformer form="rect" intensity={0.7 * preset.fill} position={[-7, 3, 3]} rotation={[0, -Math.PI / 3, 0]} scale={[8, 6, 1]} />
                <Lightformer form="rect" intensity={0.55 * preset.fill} position={[7, 2.5, 2]} rotation={[0, Math.PI / 3, 0]} scale={[8, 6, 1]} />
                {/* Контровой сзади: отделяет силуэт от фона того же тона. */}
                <Lightformer form="rect" intensity={0.9 * preset.fill} position={[0, 3, -8]} rotation={[0, Math.PI, 0]} scale={[10, 5, 1]} />
            </Environment>

            {/* Направленный оставлен только ради отбрасываемой тени: окружение теней не даёт.
                Мощность срезана втрое против прежней — теперь он рисует тень, а не освещает. */}
            <ambientLight intensity={preset.ambient} />
            <directionalLight
                position={[-3.4, 15.5, 3.1]}
                intensity={preset.key}
                castShadow
                // Карта 1024, а не 2048. Тень здесь мягкая (radius 20) и лежит на белом гипсе:
                // на таком размытии вчетверо большая карта в кадре не различима, а считается
                // она заново при каждом кадре, где что-то движется.
                shadow-mapSize={[1024, 1024]}
                shadow-radius={20}
                shadow-intensity={0.8}
                shadow-camera-left={-6}
                shadow-camera-right={6}
                shadow-camera-top={6}
                shadow-camera-bottom={-6}
                shadow-bias={-0.0002}
                // Смещение по нормали вместо большого общего bias: большой bias отрывает тень
                // от предмета, и она начинает висеть рядом, а не лежать под ним.
                shadow-normalBias={0.02}
            />

            {/* Контровой сзади-сверху. Студийная тройка света на эталонных продуктовых
                рендерах: ключ, заполняющий и контровой в отношении 1 : 0.5 : 0.3. Первые два
                у нас даёт окружение, третьего не было — и силуэт конструкции сливался с фоном
                того же тона, из-за чего сцена читалась плоской. Тень он не бросает: его дело
                обвести кромку. */}
            <directionalLight position={[2.6, 6.5, -7.5]} intensity={preset.key * 0.3} color="#fff1dc" />

            <StarSlab />
            {RAYS.map((ray, i) => (
                <Inlay key={`in-${ray.id}`} index={i} color={ACCENT[ray.id]} level={level} />
            ))}
            {RAYS.map((r, i) => (
                <Pedestal key={r.id} index={i} ray={r} color={ACCENT[r.id]} onPick={onPickRay} onHover={onHoverRay} />
            ))}
            <Tower level={level} glow={preset.glow} />
            <LighthouseBeam rayIndex={rayIndex} />
            <Props ray={ray} level={level} freeze={freeze} />
            {children}
            <CameraRig ray={rayIndex} level={level} />

            {/* Мягкая тень под всей конструкцией: она отрывает звезду от фона. Без неё
                платформа висит в молоке. */}
            {/* Тень тёплая, а не серая. Холод у нас шёл от самого фона, и класть поверх
                холодную тень значило его удваивать: на эталоне тени тёплые. */}
            {/* Площадка тени вынесена далеко за кадр. При scale 11 её собственная кромка
                попадала в кадр и читалась светлым трапециевидным швом поперёк плиты —
                тот самый шов, который я сперва списал на карту теней и на плиту. */}
            {/* Тень двухслойная. Один мягкий слой давал ровное серое пятно: на эталоне у самой
                кромки тень заметно плотнее, а дальше растворяется. Плотный слой снят коротким
                far — он ловит только касание платформы и тумб, длинный отвечает за ореол.
                Оба стоят чуть на разной высоте: на одной прозрачные плоскости мерцают. */}
            {/* Разрешение снижено вдвое: обе карты считаются по одному разу (frames={1}) и
                размываются, различить 1024 от 2048 на них нельзя, а память и первый кадр
                они занимают вчетверо. */}
            <ContactShadows position={[0, -(STAR.thickness + STAR.bevel) - 0.02, 0]} opacity={0.34} scale={34} blur={5} far={3} resolution={1024} frames={1} color="#a09890" />
            <ContactShadows position={[0, -(STAR.thickness + STAR.bevel) - 0.015, 0]} opacity={0.62} scale={16} blur={0.9} far={0.55} resolution={1024} frames={1} color="#8d857b" />

            {/* Плита уходит далеко за кадр — при длинном объективе её кромка иначе попадает
                в верх кадра и читается горизонтом.
                Тень от направленного света она не принимает намеренно: карта теней покрывает
                лишь ±6 единиц, и её граница проступала на плите отчётливым диагональным швом.
                Мягкую тень под конструкцией даёт ContactShadows, и по характеру она ближе
                к эталонной, чем длинная отбрасываемая. */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -(STAR.thickness + STAR.bevel) - 0.05, 0]}>
                <planeGeometry args={[240, 240]} />
                {/* Пол отражающий. Отражение сильно размыто и взято в треть силы: на эталоне
                    оно читается глянцем под конструкцией, а не второй сценой вверх ногами.
                    Разрешение 512 — карта всё равно уходит в блюр, а считается она заново
                    в каждом кадре, где что-то движется. */}
                {lightMode ? (
                    <meshBasicMaterial map={backdrop} />
                ) : (
                <MeshReflectorMaterial
                    // Числа подобраны замером, а не на глаз: на blur [400,100] и разрешении
                    // 512 отражение съедало по 600 мс на кадр — сцена шла полтора кадра
                    // в секунду. Размытие всё равно съедает детали, поэтому дешёвая карта
                    // выглядит так же, а стоит на порядок меньше.
                    resolution={256}
                    mixBlur={0.8}
                    blur={[120, 40]}
                    mixStrength={0.45}
                    depthScale={1.1}
                    minDepthThreshold={0.4}
                    maxDepthThreshold={1.25}
                    roughness={0.85}
                    metalness={0.1}
                    color={preset.floor[1]}
                    map={backdrop}
                />
                )}
            </mesh>

            {/* Затенение в стыках. Белое на белом читается только им: без AO верхние грани
                выходили ровной заливкой, а место посадки тумбы на луч не читалось вовсе.
                Порядок важен — тонмаппинг последним, иначе блум работает по уже сжатому
                сигналу и порог не срабатывает. */}
            {/* Сглаживание срезано с 4 проб до 2: MSAA считается по всей площади кадра и стоит
                ровно столько, сколько проб, а на белом гипсе без контрастных кромок разница
                между 4 и 2 не читается. */}
            <EffectComposer disableNormalPass multisampling={lightMode ? 0 : 2}>
                {/* Радиус срезан после появления стоек на маяке. Затенение экранное: оно не
                    различает, что под ним — стык или светящаяся стенка, и на широком радиусе
                    каждая стойка гасила свечение вокруг себя, из-за чего горящий ярус выходил
                    бледно-кремовым вместо тёплого. На узком радиусе AO остаётся там, ради чего
                    он и стоит, — в стыках тумб с платформой.
                    Качество поднято по той же причине: на дефолтном числе сэмплов частокол
                    стоек давал видимую зернистость по карнизам. */}
                {/* Качество опущено с high до medium, зато включён halfRes: затенение
                    считается в половинном разрешении и размывается. Это самый дорогой эффект
                    в кадре, и на мягком AO по стыкам разницы в кадре нет. */}
                <N8AO halfRes aoRadius={0.28} distanceFalloff={0.7} intensity={preset.ao} quality={lightMode ? "performance" : "medium"} color="#7a736a" />
                <Bloom intensity={preset.bloom} luminanceThreshold={preset.bloomAt} luminanceSmoothing={0.25} mipmapBlur />
                <ToneMapping mode={ToneMappingMode.NEUTRAL} />
            </EffectComposer>
        </Canvas>
    );
}

export { rayAngle };
