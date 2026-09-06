"use client";

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

import { MEEPLE_COLORS } from "./fieldLayoutYa.mjs";
import { MEEPLE_TRAY } from "./tableSpots.mjs";

// Шесть миплов команды — этап «Я». Мипл в настольной игре и есть плоская выдавленная
// фигурка, поэтому силуэт берётся ровно тот же, что рисует 2D-плеер: один контур,
// выдавленный на толщину фанеры. Своей геометрии для него выдумывать нечего.
//
// Фишка не летает: она шагает. Между ячейками мипл идёт невысокой дугой с лёгким
// разворотом — так видно, что ходит предмет, а не переключается картинка.

const MEEPLE_D =
    "M12 2c1.9 0 3.4 1.5 3.4 3.4 0 .9-.3 1.7-.9 2.3 2.6 1 4.4 3.2 4.4 5.8 0 .7-.6 1.2-1.3 1.2-1.4 0-2.6-.5-3.4-1.3l1.2 7.4c.1.7-.4 1.2-1 1.2H9.6c-.7 0-1.2-.6-1-1.2l1.2-7.4c-.9.8-2 1.3-3.4 1.3-.7 0-1.3-.5-1.3-1.2 0-2.6 1.8-4.8 4.4-5.8-.6-.6-.9-1.4-.9-2.3C8.6 3.5 10.1 2 12 2z";

const HEIGHT = 0.024; // рост фишки, м
const DEPTH = 0.008; // толщина фанеры, м
const VB = 24; // высота viewBox исходного силуэта

const STEP_SECONDS = 0.62;
const STEP_STAGGER = 0.045;
const HOP = 0.03; // высота шага: фишку приподнимают, а не тащат по сукну

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const mix = (a, b, t) => a + (b - a) * t;

// Курсор ловят хотспоты сцены: фишка на поле иначе перекрывала бы кольцо предмета.
const noRaycast = () => null;

// Обратно к обычному лучу — для своей фишки в живом режиме. Ставится именно функция,
// а не undefined: undefined в этот проп записывается как есть, меш остаётся без метода
// пересечения и молча выпадает из raycast — фишка выглядит кликабельной и не кликается.
const meshRaycast = THREE.Mesh.prototype.raycast;

function meepleGeometry() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}"><path d="${MEEPLE_D}"/></svg>`;
    // path.toShapes(), а не SVGLoader.createShapes(): второй объявлен устаревшим и на
    // каждый путь пишет предупреждение в консоль. Результат тот же — это его же тело.
    const shapes = new SVGLoader().parse(svg).paths.flatMap((path) => path.toShapes(true));
    const geometry = new THREE.ExtrudeGeometry(shapes, {
        depth: (VB * DEPTH) / HEIGHT,
        bevelEnabled: true,
        bevelThickness: 0.3,
        bevelSize: 0.3,
        bevelSegments: 2,
        curveSegments: 10,
    });

    const scale = HEIGHT / VB;
    geometry.scale(scale, scale, scale);
    // У SVG ось Y смотрит вниз. Разворачиваем поворотом, а не отрицательным масштабом:
    // зеркальный масштаб выворачивает обход треугольников, и фигурка светится изнанкой.
    geometry.rotateX(Math.PI);

    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    // Ноль фишки — в её следе на столе: так позиция группы и есть точка на поле.
    geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    geometry.computeVertexNormals();
    return geometry;
}

// Место фишки в лотке, пока она вне игры.
function trayAt(index) {
    return { x: MEEPLE_TRAY.x + index * MEEPLE_TRAY.dx, z: MEEPLE_TRAY.z };
}

// То же место наружу: живому столу нужно вернуть в лоток одну фишку, а не все шесть.
export const meepleTray = trayAt;

// В демонстрации фишки курсор не ловят вовсе. В живом режиме своя фишка — предмет,
// который берут в руку: она одна и становится выбираемой, чужие остаются реквизитом.
// Поэтому ловушка курсора включается вместе с onPick и только на своём мипле.
export const Meeples3D = forwardRef(function Meeples3D({ position = [0, 0, 0], mine = null, selected = false, onPick = null }, ref) {
    const geometry = useMemo(() => meepleGeometry(), []);
    const materials = useMemo(
        () => MEEPLE_COLORS.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 })),
        []
    );

    const meshes = useRef([]);
    const rings = useRef([]);
    const anim = useRef(MEEPLE_COLORS.map(() => null));
    const at = useRef(MEEPLE_COLORS.map((_, index) => trayAt(index)));

    const send = useCallback((targets, stagger = STEP_STAGGER) => {
        targets.forEach((target, index) => {
            const mesh = meshes.current[index];
            if (!mesh || !target) return;
            // Фишка, уже стоящая на нужной ячейке, шага не делает. Иначе «убрать со стола»
            // подбрасывает все шесть миплов на месте: цель совпадает с текущей точкой,
            // но дуга шага всё равно проигрывается.
            if (Math.abs(mesh.position.x - target.x) < 1e-4 && Math.abs(mesh.position.z - target.z) < 1e-4) return;
            at.current[index] = target;
            anim.current[index] = {
                from: { x: mesh.position.x, z: mesh.position.z },
                to: target,
                // Лёгкий разворот в сторону хода — фишку ставят на место рукой, а не роняют.
                spin: (Math.atan2(target.x - mesh.position.x, target.z - mesh.position.z) || 0) * 0.12,
                t: -index * stagger,
            };
        });
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            // Точки — в метрах сцены, по одной на фишку. null оставляет фишку на месте.
            moveTo: (targets) => send(targets),
            // Все шесть обратно в лоток, откуда их брали.
            home: () => send(MEEPLE_COLORS.map((_, index) => trayAt(index)), 0.03),
        }),
        [send]
    );

    useFrame((_, delta) => {
        // Вкладка была в фоне — шаги доигрываем разом: иначе фишки идут в тридцать раз
        // медленнее сценария и оказываются на ячейках позапрошлого хода.
        const catchUp = delta > 0.5;

        // Кольцо своей фишки лежит на сукне и следует за ней по горизонтали, но не
        // повторяет дугу шага: подпрыгивающая метка на столе читается как ещё один предмет.
        for (let index = 0; index < rings.current.length; index += 1) {
            const ring = rings.current[index];
            const mesh = meshes.current[index];
            if (ring && mesh) ring.position.set(mesh.position.x, 0.001, mesh.position.z);
        }

        for (let index = 0; index < anim.current.length; index += 1) {
            const move = anim.current[index];
            if (!move) continue;

            if (catchUp) {
                const mesh = meshes.current[index];
                mesh.position.set(move.to.x, 0, move.to.z);
                mesh.rotation.y = 0;
                anim.current[index] = null;
                continue;
            }

            move.t += Math.min(delta, 1 / 30);
            if (move.t <= 0) continue;

            const mesh = meshes.current[index];
            const p = Math.min(move.t / STEP_SECONDS, 1);
            const e = ease(p);
            mesh.position.set(
                mix(move.from.x, move.to.x, e),
                Math.sin(Math.PI * p) * HOP,
                mix(move.from.z, move.to.z, e)
            );
            mesh.rotation.y = Math.sin(Math.PI * p) * move.spin;
            if (p >= 1) anim.current[index] = null;
        }
    });

    return (
        <group position={position}>
            {MEEPLE_COLORS.map((color, index) => {
                const isMine = onPick && index === mine;
                return (
                    <group key={color}>
                        <mesh
                            ref={(node) => {
                                meshes.current[index] = node;
                            }}
                            geometry={geometry}
                            material={materials[index]}
                            position={[trayAt(index).x, 0, trayAt(index).z]}
                            raycast={isMine ? meshRaycast : noRaycast}
                            onPointerOver={
                                isMine
                                    ? (event) => {
                                          event.stopPropagation();
                                          document.body.style.cursor = "pointer";
                                      }
                                    : undefined
                            }
                            onPointerOut={
                                isMine
                                    ? () => {
                                          document.body.style.cursor = "";
                                      }
                                    : undefined
                            }
                            onClick={
                                isMine
                                    ? (event) => {
                                          event.stopPropagation();
                                          onPick(index);
                                      }
                                    : undefined
                            }
                            castShadow
                            receiveShadow
                        />
                        {/* Кольцо под своей фишкой: без него в шестёрке одинаковых миплов
                            свой не находится, а после выбора не видно, чей сейчас ход.
                            Кольцо ездит за фишкой тем же кадром, что и она сама. */}
                        {isMine && (
                            <mesh
                                ref={(node) => {
                                    rings.current[index] = node;
                                }}
                                rotation={[-Math.PI / 2, 0, 0]}
                                position={[trayAt(index).x, 0.001, trayAt(index).z]}
                                raycast={noRaycast}>
                                <ringGeometry args={[0.017, selected ? 0.025 : 0.021, 32]} />
                                <meshBasicMaterial
                                    color={selected ? "#ffffff" : "#f4d9a2"}
                                    transparent
                                    opacity={selected ? 0.95 : 0.6}
                                    depthWrite={false}
                                    side={THREE.DoubleSide}
                                />
                            </mesh>
                        )}
                    </group>
                );
            })}
        </group>
    );
});

export default Meeples3D;
