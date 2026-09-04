"use client";

// Предметы на тумбах. Отдельно от Platform намеренно: платформа о предметах ничего не знает,
// они приходят к ней детьми. Так набор меняется, не трогая сцену.
//
// Смена уровня не подменяет предмет, а печатает его: линия проходит снизу вверх, под ней
// отливается новое состояние, над ней старое остаётся проекцией. См. Materialize.

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { ACCENT, PEDESTAL, pedestalAt, rayAngle } from "../model/platform.mjs";
import { RAYS } from "../model/zvezda.mjs";
import Materialize from "./Materialize";
import { TEST_PROPS } from "./testProps";

const PLASTER = new THREE.MeshStandardMaterial({ color: "#f2f3f5", roughness: 0.9, metalness: 0 });

// Граница поля — по внутреннему краю цветного кольца, а не по бортику: кольцо лежит внутри
// бортика, и предмет, вписанный в бортик, кольцо всё равно перечёркивает.
const FIELD = PEDESTAL.rimRadius - PEDESTAL.rimThickness;
const MAX_HEIGHT = PEDESTAL.radius * 1.5;

// Длительность фаз перехода:
// 1. EXIT: эстетичная уборка текущего предмета вниз в тумбу (~0.55 с).
// 2. ENTER: материализация нового предмета снизу вверх на чистой тумбе (~0.85 с).
const EXIT_SECONDS = 0.55;
const ENTER_SECONDS = 0.85;

// Предварительная загрузка всех используемых моделей: исключает паузы при смене уровней
if (typeof window !== "undefined") {
    useGLTF.preload("/zvezda-props/knowledge.glb", "/draco/");
    useGLTF.preload("/zvezda-props/cabinet.glb", "/draco/");
    useGLTF.preload("/zvezda-props/data.glb", "/draco/");
}

// Состояния лучей по уровням.
//
// У «Знаний»: бумага (уровни 1-2) -> планшет (3-6).
// У «Данных»: картотечный шкаф (1-2) -> монитор с графиком (3-6).
const STATES = {
    knowledge: { 1: "knowledgeChaos", 2: "paper", 3: "knowledge", 4: "knowledge", 5: "knowledge", 6: "knowledgeProactive" },
    interaction: { 1: "interactionChaos", 2: "interactionChaos", 3: "interactionChaos", 4: "interactionProactive", 5: "interactionProactive", 6: "interactionProactive" },
    space: { 1: "spaceChaos", 2: "spaceChaos", 3: "spaceChaos", 4: "spaceProactive", 5: "spaceProactive", 6: "spaceProactive" },
    security: { 1: "securityChaos", 2: "securityChaos", 3: "securityChaos", 4: "securityProactive", 5: "securityProactive", 6: "securityProactive" },
    data: { 1: "dataChaos", 2: "cabinet", 3: "data", 4: "data", 5: "data", 6: "dataProactive" },
    automation: { 1: "automationChaos", 2: "automationChaos", 3: "automationChaos", 4: "automationProactive", 5: "automationProactive", 6: "automationProactive" },
};

export const READY = Object.keys(STATES);

// Подгонка под тумбу. Общая для файлов и для примитивов: два независимых ограничения,
// берётся меньшее. Одним максимумом считать нельзя — у высокого предмета след тогда
// не ограничен вовсе, и подставка выезжает на кольцо.
function fitToPedestal(root) {
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const k = Math.min((FIELD * 2 * 0.72) / Math.max(size.x, size.z), MAX_HEIGHT / size.y);
    root.scale.setScalar(k);
    root.position.set(-center.x * k, -box.min.y * k, -center.z * k);
    root.updateMatrixWorld(true);
    return root;
}

function createDataMonitorMaterial() {
    const mat = new THREE.MeshStandardMaterial({
        color: "#1e242c",
        roughness: 0.35,
        metalness: 0.25,
    });
    mat.customProgramCacheKey = () => "data_monitor_shader";
    mat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
            "#include <common>",
            `#include <common>
             varying vec3 vModelPos;
             varying vec3 vModelNorm;
            `
        ).replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
             vModelPos = position;
             vModelNorm = normal;
            `
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <common>",
            `#include <common>
             varying vec3 vModelPos;
             varying vec3 vModelNorm;
            `
        ).replace(
            "#include <color_fragment>",
            `#include <color_fragment>
             bool isFace = vModelNorm.z > 0.35 && vModelPos.y > -0.25;
             bool isBar = vModelPos.z > 0.08 && vModelPos.y > -0.2;
             if (isBar) {
                 float chartGrad = clamp((vModelPos.y + 0.1) / 0.7, 0.0, 1.0);
                 diffuseColor.rgb = mix(vec3(0.05, 0.7, 0.92), vec3(0.4, 0.95, 1.0), chartGrad);
             } else if (isFace) {
                 diffuseColor.rgb = vec3(0.04, 0.12, 0.22);
             } else {
                 diffuseColor.rgb = vec3(0.15, 0.18, 0.22);
             }
            `
        );
    };
    return mat;
}

const DATA_MONITOR_MAT = typeof window !== "undefined" ? createDataMonitorMaterial() : PLASTER;

function ProceduralProp({ activeId, mode, t, color }) {
    const object = useMemo(() => {
        if (!activeId || !TEST_PROPS[activeId]) return null;
        const root = TEST_PROPS[activeId]();
        root.traverse((n) => {
            if (!n.isMesh) return;
            n.castShadow = true;
            n.receiveShadow = true;
        });
        return root;
    }, [activeId]);

    useFrame((state, dt) => {
        if (!object) return;
        const elapsed = state.clock.getElapsedTime();
        object.traverse((child) => {
            if (child.userData && typeof child.userData.onFrame === "function") {
                child.userData.onFrame(child, elapsed, dt);
            }
        });
    });

    if (!object) return null;
    if (mode === "idle") {
        return <primitive object={object} />;
    }
    return <Materialize object={object} mode={mode} t={t} color={color} />;
}

function GLTFProp({ activeId, rayId, mode, t, color }) {
    const { scene } = useGLTF(`/zvezda-props/${activeId}.glb`, "/draco/");
    const object = useMemo(() => {
        if (!scene) return null;
        const root = scene.clone(true);
        root.traverse((n) => {
            if (!n.isMesh) return;
            if (rayId === "data" && activeId === "data") {
                n.material = DATA_MONITOR_MAT;
            } else {
                n.material = PLASTER;
            }
            n.castShadow = true;
            n.receiveShadow = true;
        });
        return fitToPedestal(root);
    }, [scene, activeId, rayId]);

    if (!object) return null;
    return <Materialize object={object} mode={mode} t={t} color={color} />;
}

function PropObject({ activeId, rayId, mode, t, color }) {
    if (!activeId) return null;
    const isTest = Boolean(TEST_PROPS[activeId]);
    if (isTest) {
        return <ProceduralProp activeId={activeId} mode={mode} t={t} color={color} />;
    }
    return (
        <Suspense fallback={null}>
            <GLTFProp activeId={activeId} rayId={rayId} mode={mode} t={t} color={color} />
        </Suspense>
    );
}

function Prop({ rayId, level, selected, freeze }) {
    const index = RAYS.findIndex((r) => r.id === rayId);
    const map = STATES[rayId];
    const targetId = map ? map[level] : null;

    // Двухфазная машина состояний:
    // "idle"  — предмет неподвижно стоит на тумбе
    // "exit"  — старый предмет убирается (дематериализуется вниз)
    // "enter" — новый предмет материализуется на чистой тумбе снизу вверх
    const [phase, setPhase] = useState(freeze != null ? "enter" : "idle");
    const [activeId, setActiveId] = useState(targetId);
    const [t, setT] = useState(freeze != null ? freeze : 1);

    const targetRef = useRef(targetId);
    const phaseRef = useRef(freeze != null ? "enter" : "idle");
    const progressRef = useRef(freeze != null ? freeze : 1);
    const invalidate = useThree((s) => s.invalidate);

    // При смене уровня: если предмет меняется, сначала запускаем фазу уборки (exit)
    useEffect(() => {
        if (freeze != null) return;
        targetRef.current = targetId;

        if (targetId === activeId && phaseRef.current === "idle") return;

        if (!activeId) {
            // Тумба была пустой — сразу запускаем появление нового предмета
            if (targetId) {
                setActiveId(targetId);
                phaseRef.current = "enter";
                progressRef.current = 0;
                setPhase("enter");
                setT(0);
                invalidate();
            }
        } else if (targetId !== activeId) {
            // На тумбе уже стоит другой предмет — сначала убираем его с платформы
            phaseRef.current = "exit";
            progressRef.current = 0;
            setPhase("exit");
            setT(0);
            invalidate();
        }
    }, [targetId, activeId, freeze, invalidate]);

    useFrame((_, dt) => {
        if (freeze != null) return;
        if (phaseRef.current === "idle") return;

        const d = Math.min(dt, 1 / 30);

        if (phaseRef.current === "exit") {
            progressRef.current += d / EXIT_SECONDS;
            if (progressRef.current >= 1) {
                // Фаза уборки завершена: старый предмет полностью ушёл с платформы
                const nextTarget = targetRef.current;
                if (nextTarget) {
                    // Переключаем модель на новую и запускаем фазу появления
                    phaseRef.current = "enter";
                    progressRef.current = 0;
                    setActiveId(nextTarget);
                    setPhase("enter");
                    setT(0);
                } else {
                    phaseRef.current = "idle";
                    progressRef.current = 1;
                    setActiveId(null);
                    setPhase("idle");
                    setT(1);
                }
            } else {
                setT(progressRef.current);
            }
            invalidate();
        } else if (phaseRef.current === "enter") {
            progressRef.current += d / ENTER_SECONDS;
            if (progressRef.current >= 1) {
                // Фаза появления завершена: предмет готов и монументален
                phaseRef.current = "idle";
                progressRef.current = 1;
                setPhase("idle");
                setT(1);
            } else {
                setT(progressRef.current);
            }
            invalidate();
        }
    });

    const a = rayAngle(index);
    const [x, , z] = pedestalAt(index);
    const turn = selected ? Math.atan2(Math.cos(a), Math.sin(a)) : 0;

    if (!activeId && phase === "idle") return null;

    return (
        <group position={[x, PEDESTAL.top, z]} rotation={[0, turn, 0]}>
            <PropObject
                activeId={activeId}
                rayId={rayId}
                mode={freeze != null ? "enter" : phase}
                t={freeze != null ? freeze : t}
                color={ACCENT[rayId]}
            />
        </group>
    );
}

// freeze — момент печати, заданный снаружи. Нужен для проверки кадром: при живом таймере
// снимок всегда запаздывает, и поймать середину такта нечем.
export default function Props({ only = READY, ray = null, level = 1, freeze = null }) {
    return (
        <group>
            {only.map((id) => (
                <Prop key={id} rayId={id} level={level} selected={ray === id} freeze={freeze} />
            ))}
        </group>
    );
}
