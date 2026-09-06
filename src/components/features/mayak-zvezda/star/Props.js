"use client";

// Предметы на тумбах. Отдельно от Platform намеренно: платформа о предметах ничего не знает,
// они приходят к ней детьми. Так набор меняется, не трогая сцену.
//
// Смена уровня не подменяет предмет, а печатает его: линия проходит снизу вверх, под ней
// отливается новое состояние, над ней старое остаётся проекцией. См. Materialize.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";

import { ACCENT, PEDESTAL, pedestalAt, rayAngle } from "../model/platform.mjs";
import { LEVELS, RAYS } from "../model/zvezda.mjs";
import Materialize from "./Materialize";
import { TEST_PROPS, propId } from "./props/registry.mjs";

// Длительность фаз перехода:
// 1. EXIT: уборка текущего предмета вниз в тумбу (~0.55 с).
// 2. ENTER: материализация нового предмета снизу вверх на чистой тумбе (~0.85 с).
const EXIT_SECONDS = 0.55;
const ENTER_SECONDS = 0.85;

// Предмет на каждый уровень каждого луча: тридцать шесть штук, ключ `<луч><уровень>`.
// Прежде уровни делили один предмет на троих (хаос на 1-3, проактив на 4-6), и переход между
// соседними уровнями не был виден вовсе — вся шкала читалась двумя состояниями вместо шести.
export const READY = RAYS.map((r) => r.id);

function ProceduralProp({ activeId, mode, t, color, animate = false }) {
    const { object, animated } = useMemo(() => {
        if (!activeId || !TEST_PROPS[activeId]) return { object: null, animated: [] };
        const root = TEST_PROPS[activeId]();
        const moving = [];
        root.traverse((n) => {
            if (n.userData && typeof n.userData.onFrame === "function") moving.push(n);
            if (!n.isMesh) return;
            n.castShadow = true;
            n.receiveShadow = true;
        });
        return { object: root, animated: moving };
    }, [activeId]);
    const invalidate = useThree((s) => s.invalidate);

    // Анимация идёт у выбранного луча и на верхнем уровне — там она часть образа: волны
    // радара расходятся до запроса, скульптура парит. На нижних уровнях предметы неподвижны,
    // и сцена там спит целиком.
    useFrame((state, dt) => {
        if (!animate || animated.length === 0) return;
        const elapsed = state.clock.getElapsedTime();
        for (const child of animated) child.userData.onFrame(child, elapsed, dt);
    });

    // Кадры для анимации заказывает таймер, а не сама анимация.
    //
    // Если бы каждый кадр просил следующий, сцена крутилась бы на полной частоте экрана и
    // считала весь постпроцесс по шестьдесят раз в секунду. Движения здесь медленные —
    // вращение, расходящиеся волны, — и на двадцати четырёх кадрах неотличимы, а стоят
    // в два с половиной раза дешевле.
    //
    // Таймер один на предмет, но кадр от него общий: invalidate только поднимает флаг,
    // и шесть скульптур верхнего уровня рисуются в одном кадре, а не в шести.
    //
    // На скрытой вкладке браузер сам замораживает и таймер, и отрисовку — отдельной проверки
    // document.hidden не требуется.
    useEffect(() => {
        if (!animate || animated.length === 0) return undefined;
        const id = setInterval(invalidate, 42);
        return () => clearInterval(id);
    }, [animate, animated, invalidate]);

    if (!object) return null;
    if (mode === "idle") {
        return <primitive object={object} />;
    }
    return <Materialize object={object} mode={mode} t={t} color={color} />;
}

function PropObject({ activeId, mode, t, color, animate }) {
    if (!activeId) return null;
    return <ProceduralProp activeId={activeId} mode={mode} t={t} color={color} animate={animate} />;
}

function Prop({ rayId, level, selected, freeze }) {
    const index = RAYS.findIndex((r) => r.id === rayId);
    const id = propId(rayId, level);
    const targetId = TEST_PROPS[id] ? id : null;

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
                mode={freeze != null ? "enter" : phase}
                t={freeze != null ? freeze : t}
                color={ACCENT[rayId]}
                animate={selected || level === LEVELS.length}
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
