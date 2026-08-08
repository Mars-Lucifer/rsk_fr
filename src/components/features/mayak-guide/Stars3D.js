"use client";

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { CARDS_PER_DECK as MY_TASKS, DIRS, pxToMeters, starPoint } from "./fieldLayout.mjs";
import { STAR_TRAY } from "./tableSpots.mjs";

// Жетоны-звёзды набора: их ровно 36 — тридцать золотых и шесть красных.
//
// Золотая встаёт на трек индекса цифровой зрелости, когда задание принято. Красная —
// Звезда-Джокер: её приносит команде участник, закрывший свою специализацию на этапе «Я»,
// и на «МЫ» она закрывает последнюю задачу направления. Шесть направлений — шесть
// Джокеров, поэтому 30 + 6 заполняют трек 6 × 6 ровно.
//
// Цвет звезды не зависит от направления: в наборе они физически одинаковые.
//
// Все звёзды живут в лотке справа от поля и видимо оттуда берутся: столбик на глазах
// убывает, а трек заполняется. Обратный путь тот же — returnAll() уносит звёзды в свои
// столбики, и по высоте стопки сразу видно, что стол расчищен.

const GOLD = 30;
const RED = 6;
const PER_COLUMN = 6; // столбик лотка: пять золотых столбиков и один красный

const OUTER = 0.0095; // клетка трека — 45 × 45 px растра, то есть 22.5 мм: звезда влезает с зазором
const INNER = 0.004;
const THICK = 0.0022;
// Над полотном: трек нарисован на ткани, звезда лежит поверх. Зазор здесь только против
// мерцания плоскостей, и больше он быть не может. Было 7.5 мм — звезда висела над клеткой,
// а камера смотрит на стол под наклоном около сорока градусов: параллакс уводил её вбок
// на 7.5 · tg 40° ≈ 6 мм, то есть на треть ячейки. Посадочные координаты при этом точны.
const LIFT = 0.0012;

const FLY_SECONDS = 0.72;
const ARC = 0.07;

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const mix = (a, b, t) => a + (b - a) * t;

// Курсор ловят хотспоты сцены, а не 36 мелких предметов.
const noRaycast = () => null;

function starGeometry() {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i += 1) {
        const radius = i % 2 ? INNER : OUTER;
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: THICK,
        bevelEnabled: true,
        bevelThickness: 0.0004,
        bevelSize: 0.0004,
        bevelSegments: 1,
    });
    geometry.rotateX(-Math.PI / 2); // кладём звезду на стол лицом вверх
    geometry.translate(0, THICK / 2, 0);
    geometry.computeVertexNormals();
    return geometry;
}

// Все звёзды одним списком: сначала тридцать золотых, затем шесть красных.
const STARS = [
    ...Array.from({ length: GOLD }, (_, order) => ({ red: false, order })),
    ...Array.from({ length: RED }, (_, order) => ({ red: true, order })),
];

// Место звезды в лотке: столбик по шесть штук, красные — в своём, шестом.
function trayAt(star) {
    const column = star.red ? GOLD / PER_COLUMN : Math.floor(star.order / PER_COLUMN);
    const level = star.red ? star.order : star.order % PER_COLUMN;
    return { x: STAR_TRAY.x + column * STAR_TRAY.dx, y: LIFT + level * THICK * 1.15, z: STAR_TRAY.z };
}

// Какую звезду берут следующей. Берут сверху столбика и слева направо, поэтому
// пустеющие столбики читаются по порядку, а не выедаются вразнобой.
const nextGold = (used) => Math.floor(used / PER_COLUMN) * PER_COLUMN + (PER_COLUMN - 1 - (used % PER_COLUMN));
const nextRed = (used) => GOLD + (RED - 1 - used);

// Клетка трека индекса в метрах сцены: направление и номер закрытой задачи.
function pointAt(dir, column) {
    const cell = pxToMeters(starPoint(dir, column));
    return { x: cell.x, y: LIFT, z: cell.z };
}

export const Stars3D = forwardRef(function Stars3D({ position = [0, 0, 0] }, ref) {
    const geometry = useMemo(() => starGeometry(), []);
    const materials = useMemo(
        () => ({
            gold: new THREE.MeshStandardMaterial({ color: "#e0a92e", roughness: 0.3, metalness: 0.35 }),
            red: new THREE.MeshStandardMaterial({ color: "#c9503f", roughness: 0.28, metalness: 0.3 }),
        }),
        []
    );

    const meshes = useRef([]);
    const anim = useRef(STARS.map(() => null));
    // Сколько взято из каждого запаса и сколько закрыто по каждому направлению трека.
    const used = useRef({ gold: 0, red: 0, columns: DIRS.map(() => 0) });

    const fly = useCallback((index, to, delay = 0) => {
        const mesh = meshes.current[index];
        if (!mesh || index < 0 || index >= STARS.length) return;
        // Звезда, которая уже стоит на своём месте, никуда не летит. Без этой проверки
        // «убрать со стола» поднимало все 36 штук разом по дуге в 70 мм и опускало
        // обратно — на общем плане это читалось как дрожь лотка на каждой раскладке.
        const at = mesh.position;
        if (Math.abs(at.x - to.x) < 1e-4 && Math.abs(at.y - to.y) < 1e-4 && Math.abs(at.z - to.z) < 1e-4) return;
        anim.current[index] = { from: mesh.position.clone(), to, t: -delay };
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            // Задание принято: звезда уходит из лотка на трек индекса.
            // delay — очередь в перевороте такта: девять звёзд, стартующих одним кадром,
            // читаются как вспышка, а не как девять взятых из лотка предметов.
            // Такты закрывают пять клеток направления из шести: шестую оставляют Джокеру.
            // Раньше красную звезду ставили молча последней задачей такта — Джокеры
            // оказывались на треке задолго до того, как про них скажут, и правило
            // «Джокер закрывает направление без выполнения задания» ничем не показывалось.
            place(dir, delay = 0) {
                const column = used.current.columns[dir];
                if (column >= MY_TASKS - 1) return;
                fly(nextGold(used.current.gold), pointAt(dir, column), delay);
                used.current.gold += 1;
                used.current.columns[dir] += 1;
            },
            // Итог этапа «МЫ»: шесть Джокеров, принесённых с этапа «Я», закрывают
            // последнюю клетку каждого направления.
            jokers(delay = 0, stagger = 0.18) {
                DIRS.forEach((_, dir) => {
                    const column = used.current.columns[dir];
                    if (column >= MY_TASKS || used.current.red >= RED) return;
                    fly(nextRed(used.current.red), pointAt(dir, column), delay + dir * stagger);
                    used.current.red += 1;
                    used.current.columns[dir] += 1;
                });
            },
            // Красная Звезда-Джокер на этапе «Я»: её кладут рядом с фишкой участника,
            // закрывшего специализацию, а не на трек — трека на этой стороне нет.
            joker(to, delay = 0) {
                if (used.current.red >= RED) return;
                fly(nextRed(used.current.red), { x: to.x, y: LIFT, z: to.z }, delay);
                used.current.red += 1;
            },
            filled: () => used.current.columns.reduce((sum, value) => sum + value, 0),
            // Все звёзды обратно в свои столбики лотка.
            returnAll() {
                used.current = { gold: 0, red: 0, columns: used.current.columns.map(() => 0) };
                STARS.forEach((star, index) => fly(index, trayAt(star), index * 0.008));
            },
        }),
        [fly]
    );

    useFrame((_, delta) => {
        // Вкладка была в фоне — перелёты доигрываем разом, иначе звёзды висят в воздухе
        // над столом, пока сценарий уже закрыл такт.
        const catchUp = delta > 0.5;

        for (let index = 0; index < anim.current.length; index += 1) {
            const move = anim.current[index];
            if (!move) continue;

            if (catchUp) {
                const mesh = meshes.current[index];
                mesh.position.set(move.to.x, move.to.y, move.to.z);
                mesh.rotation.y = 0;
                anim.current[index] = null;
                continue;
            }

            move.t += Math.min(delta, 1 / 30);
            if (move.t <= 0) continue;

            const mesh = meshes.current[index];
            const p = Math.min(move.t / FLY_SECONDS, 1);
            const e = ease(p);
            mesh.position.set(
                mix(move.from.x, move.to.x, e),
                mix(move.from.y, move.to.y, e) + Math.sin(Math.PI * p) * ARC,
                mix(move.from.z, move.to.z, e)
            );
            // Звезда доворачивается в полёте — иначе перелёт читается как подмена картинки.
            mesh.rotation.y = (1 - e) * Math.PI * 0.8;
            if (p >= 1) anim.current[index] = null;
        }
    });

    return (
        <group position={position}>
            {STARS.map((star, index) => {
                const home = trayAt(star);
                return (
                    <mesh
                        key={`${star.red ? "red" : "gold"}-${star.order}`}
                        ref={(node) => {
                            meshes.current[index] = node;
                        }}
                        geometry={geometry}
                        material={star.red ? materials.red : materials.gold}
                        position={[home.x, home.y, home.z]}
                        raycast={noRaycast}
                        castShadow
                    />
                );
            })}
        </group>
    );
});

export default Stars3D;
