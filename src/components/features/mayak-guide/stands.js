"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";

import { ClothFieldGroup } from "./FieldCloth3D";
import { JETONS_ACTIONS, JetonsGroup } from "./Jetons3D";
import { ROLES_ACTIONS, RoleCardsGroup } from "./RoleCards3D";

// Стенды отдельных предметов для страниц /mayak-3d/*: предмет крупно и со свободной
// камерой, чтобы калибровать его отдельно от общего стола.
//
// Раньше каждый такой стенд жил внутри своего же компонента предмета: файл отдавал и
// встраиваемую группу для общего стола, и целую страницу с Canvas, светом и OrbitControls.
// Из-за этого общая сцена тянула за собой орбитальную камеру, которая ей не нужна и
// вредна — стол снимается с постоянных точек, — а сами файлы несли двойную ответственность.
//
// Теперь наоборот: компоненты предметов знают только про себя, а всё окружение стенда
// живёт здесь. На общий стол ничего из этого файла не импортируется.

// Свет у всех стендов одинаковый, разъезжается только охват теневой камеры: у поля и
// жетонов сцена метровая, у карт ролей — полуметровая.
function Stand({ camera, orbit, shadowSpan = 1, onMissed, children, hud }) {
    return (
        <div className="stand">
            <Canvas shadows dpr={[1, 2]} camera={camera} onPointerMissed={onMissed}>
                <color attach="background" args={["#15110e"]} />
                <ambientLight intensity={0.55} />
                <directionalLight
                    position={[0.8, 1.5, 0.7]}
                    intensity={2.2}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                    shadow-camera-left={-shadowSpan}
                    shadow-camera-right={shadowSpan}
                    shadow-camera-top={shadowSpan}
                    shadow-camera-bottom={-shadowSpan}
                    shadow-bias={-0.0004}
                />
                <directionalLight position={[-1, 0.8, -0.6]} intensity={0.45} />
                {children}
                <OrbitControls enablePan={false} maxPolarAngle={1.45} {...orbit} />
            </Canvas>

            <div className="hud">{hud}</div>

            <style jsx>{`
                .stand {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }
                .hud {
                    position: absolute;
                    left: 24px;
                    bottom: 24px;
                    max-width: calc(100% - 48px);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                    color: rgba(244, 239, 230, 0.62);
                    font-size: 13px;
                }
                .hud :global(button) {
                    flex: 0 0 auto;
                    width: auto; /* в globals.css кнопки тянутся на всю строку */
                    padding: 10px 18px;
                    border: 1px solid rgba(255, 255, 255, 0.22);
                    border-radius: 999px;
                    background: rgba(20, 16, 13, 0.72);
                    color: #f4efe6;
                    font-size: 14px;
                    cursor: pointer;
                    backdrop-filter: blur(6px);
                }
                .hud :global(button:hover:not(:disabled)) {
                    border-color: rgba(255, 255, 255, 0.5);
                }
                .hud :global(button:disabled) {
                    opacity: 0.4;
                    cursor: default;
                }
            `}</style>
        </div>
    );
}

// Простая столешница стенда: предмету нужно на чём-то лежать и куда-то ронять тень.
function Board({ size = [3, 2] }) {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={size} />
            <meshStandardMaterial color="#2f2823" roughness={0.9} />
        </mesh>
    );
}

export function FieldStand() {
    const field = useRef(null);
    const [status, setStatus] = useState({ face: "ya", busy: false });

    return (
        <Stand
            camera={{ position: [0.1, 0.75, 0.95], fov: 42 }}
            orbit={{ target: [0, 0.03, 0], minDistance: 0.4, maxDistance: 2.2 }}
            hud={
                <>
                    <button type="button" onClick={() => field.current?.run("flip")} disabled={status.busy}>
                        {status.face === "ya" ? "Перевернуть на «МЫ»" : "Перевернуть на «Я»"}
                    </button>
                    <button type="button" onClick={() => field.current?.run("reset")}>
                        Расстелить заново
                    </button>
                    <span>
                        Вверх смотрит сторона «{status.face === "ya" ? "Я" : "МЫ"}». Мышь — камера, колесо — приближение.
                    </span>
                </>
            }>
            <Board />
            <ClothFieldGroup ref={field} onStatus={setStatus} />
        </Stand>
    );
}

export function JetonsStand() {
    const group = useRef(null);
    const [hint, setHint] = useState("");

    // Canvas рендерит своих детей в отдельном корне и не синхронно, поэтому первый hint()
    // снимаем ref-колбэком: к моменту эффекта родителя ручки предмета ещё нет.
    const attach = useCallback((instance) => {
        group.current = instance;
        setHint(instance ? instance.hint() : "");
    }, []);

    const run = useCallback((actionId) => {
        group.current?.run(actionId);
        setHint(group.current ? group.current.hint() : "");
    }, []);

    return (
        <Stand
            camera={{ position: [0, 0.82, 0.62], fov: 42 }}
            orbit={{ target: [0, 0.02, 0], minDistance: 0.25, maxDistance: 2.2 }}
            hud={
                <>
                    {JETONS_ACTIONS.map((action) => (
                        <button key={action.id} type="button" onClick={() => run(action.id)}>
                            {action.label}
                        </button>
                    ))}
                    <span>{hint} · мышь — камера, колесо — приближение.</span>
                </>
            }>
            <Physics gravity={[0, -9.81, 0]}>
                {/* Столешница как коробка под уровнем нуля: плоскость-триммеш здесь только дороже. */}
                <RigidBody type="fixed" colliders={false}>
                    <CuboidCollider args={[1.5, 0.05, 1]} position={[0, -0.05, 0]} friction={1} restitution={0.02} />
                    <Board />
                </RigidBody>
                <JetonsGroup ref={attach} />
            </Physics>
        </Stand>
    );
}

export function RolesStand() {
    const deck = useRef(null);
    const [role, setRole] = useState(null);
    const [hint, setHint] = useState("");

    // Панель роли и подпись — это уже забота хозяина сцены, группа отдаёт только данные.
    const onFocusRole = useCallback((value) => {
        setRole(value);
        setHint(deck.current?.hint() ?? "");
    }, []);

    return (
        <div className="roles">
            <Stand
                camera={{ position: [0, 0.4, 0.56], fov: 42 }}
                // Поза разбора зафиксирована по +Z группы, поэтому азимут ограничен:
                // иначе карту можно было бы объехать и увидеть её рубашку.
                orbit={{ target: [0, 0.02, 0], minDistance: 0.25, maxDistance: 1.2, minAzimuthAngle: -0.9, maxAzimuthAngle: 0.9 }}
                shadowSpan={0.45}
                onMissed={() => deck.current?.run("reset")}
                hud={<span>{hint || "Шесть ролей команды"}. Наведите на карту — она поднимется. Клик — карта встаёт лицом к вам.</span>}>
                <Board size={[1.2, 0.9]} />
                <Suspense fallback={null}>
                    <RoleCardsGroup ref={deck} onFocusRole={onFocusRole} />
                </Suspense>
            </Stand>

            {/* Текст роли — обычный HTML поверх канваса: <Html> из drei тянет за собой
                вторую копию react-dom и ломает монтирование сцены. */}
            {role ? (
                <div className="panel">
                    <h2>{role.nm}</h2>
                    <p className="vice">{role.vice}</p>
                    <p className="ln">{role.ln}</p>
                    <button type="button" onClick={() => deck.current?.run(ROLES_ACTIONS[0].id)}>
                        {ROLES_ACTIONS[0].label}
                    </button>
                </div>
            ) : null}

            <style jsx>{`
                .roles {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }
                .panel {
                    position: absolute;
                    right: 24px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: min(340px, calc(100% - 48px));
                    padding: 20px 22px;
                    border: 1px solid rgba(255, 255, 255, 0.14);
                    border-radius: 16px;
                    background: rgba(20, 16, 13, 0.78);
                    backdrop-filter: blur(8px);
                    color: #f4efe6;
                }
                h2 {
                    margin: 0;
                    font-size: 19px;
                    font-weight: 600;
                }
                .vice {
                    margin: 6px 0 0;
                    font-size: 14px;
                    color: #e0b874;
                }
                .ln {
                    margin: 12px 0 0;
                    font-size: 14px;
                    line-height: 1.5;
                    color: rgba(244, 239, 230, 0.72);
                }
                button {
                    margin-top: 16px;
                    width: auto; /* в globals.css кнопки тянутся на всю строку */
                    padding: 9px 16px;
                    border: 1px solid rgba(255, 255, 255, 0.22);
                    border-radius: 999px;
                    background: rgba(20, 16, 13, 0.72);
                    color: #f4efe6;
                    font-size: 14px;
                    cursor: pointer;
                }
                button:hover {
                    border-color: rgba(255, 255, 255, 0.5);
                }
            `}</style>
        </div>
    );
}
