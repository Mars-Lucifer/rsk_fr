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

import { ContactShadows, Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { LEVELS, RAYS } from "../model/zvezda.mjs";
import { ACCENT, OVERVIEW, PEDESTAL, STAR, TOWER, inlay, pedestalAt, rayAngle, rayCamera, starOutline, tiers } from "../model/platform.mjs";

const BG = "#eceef1";
const PLASTER = "#f2f3f5";

// Свечение маяка задаётся цветом, а не мощностью. На тёплом #ffcf8a любая интенсивность
// даёт апельсин: разница красного и синего на выходе около 78 при эталонных 21. Почти белый
// с тёплым уклоном даёт белое ядро и тёплую кайму — то, что на эталоне и есть.
const GLOW = "#fff0d8";
const LIT = "#ffcf8a";


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
            <meshStandardMaterial color={PLASTER} roughness={0.82} metalness={0} />
        </mesh>
    );
}

function Pedestal({ index, color, ray, active, dimmed, onPick }) {
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
                onPointerOver={() => (document.body.style.cursor = "pointer")}
                onPointerOut={() => (document.body.style.cursor = "")}
            >
                <cylinderGeometry args={[PEDESTAL.radius, PEDESTAL.radius, PEDESTAL.height, 48]} />
                <meshStandardMaterial color={PLASTER} roughness={0.82} metalness={0} />
            </mesh>
            {/* Кольцо цвета лежит на верхней кромке. Свечения нет намеренно: со свечением
                старший канал упирается в потолок, кольцо становится ровной полосой без
                светотени по окружности — на эталоне же она есть и заметная. */}
            <mesh position={[0, PEDESTAL.height / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <torusGeometry args={[PEDESTAL.rimRadius, PEDESTAL.rimThickness, 12, 72]} />
                <meshStandardMaterial color={color} roughness={0.5} />
            </mesh>

            {/* Подпись луча — DOM поверх сцены, а не текст в WebGL: она обязана оставаться
                читаемой при любом размере и не крутиться вместе с объектом. Она же кнопка.
                Стоит над тумбой на выносной линии, как метки на igloo. */}
            <Html position={[0, PEDESTAL.height / 2 + 0.05, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
                <button
                    type="button"
                    className={"ray-label" + (active ? " on" : "") + (dimmed ? " dim" : "")}
                    style={{ "--c": color, pointerEvents: "auto" }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onPick(ray.id);
                    }}
                >
                    <i />
                    <b>{ray.name}</b>
                </button>
            </Html>
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
function CameraRig({ ray, level }) {
    const camera = useThree((s) => s.camera);
    const invalidate = useThree((s) => s.invalidate);
    const target = useRef(new THREE.Vector3(...OVERVIEW.target));
    const goalPos = useRef(new THREE.Vector3());

    // Сменились луч или уровень — разбудить отрисовку. Уровень меняет свечение ярусов,
    // и без этого маяк переключался бы только при следующем движении камеры.
    useEffect(() => {
        invalidate();
    }, [ray, level, invalidate]);

    useFrame((_, dt) => {
        const goal = ray == null ? OVERVIEW : rayCamera(ray);
        // Кламп обязателен именно в режиме demand: dt первого кадра после простоя равен
        // длине простоя, и без ограничения камера телепортируется в конечную точку.
        const d = Math.min(dt, 1 / 30);
        const k = 3.2;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, goal.position[0], k, d);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, goal.position[1], k, d);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, goal.position[2], k, d);
        target.current.x = THREE.MathUtils.damp(target.current.x, goal.target[0], k, d);
        target.current.y = THREE.MathUtils.damp(target.current.y, goal.target[1], k, d);
        target.current.z = THREE.MathUtils.damp(target.current.z, goal.target[2], k, d);
        const fov = THREE.MathUtils.damp(camera.fov, goal.fov, k, d);
        if (Math.abs(fov - camera.fov) > 1e-4) {
            camera.fov = fov;
            camera.updateProjectionMatrix();
        }
        camera.lookAt(target.current);

        // Не доехали — просим следующий кадр. Доехали — отрисовка засыпает сама.
        //
        // Затухание подходит к цели бесконечно долго, и на строгом пороге сцена продолжала
        // рисоваться три секунды после того, как движение уже не видно глазом. Поэтому
        // порог взят видимый — половина миллиметра сцены, — и по нему камера встаёт в цель
        // точно, а не продолжает подползать.
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
            return;
        }
        invalidate();
    });
    return null;
}

function Inlay({ index, color }) {
    const line = inlay(index);
    const a = line.angle;
    return (
        <mesh position={[Math.cos(a) * line.mid, 0.004, Math.sin(a) * line.mid]} rotation={[0, -a, 0]}>
            <boxGeometry args={[line.length, 0.008, 0.026]} />
            <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
    );
}

// Маяк. Ярус светится, если уровень достигнут: сколько горит — там организация и стоит.
// Легенды не требует, и это главное, ради чего он в центре.
function Tower({ level }) {
    const stack = useMemo(tiers, []);
    const top = TOWER.baseHeight + LEVELS.length * TOWER.tierHeight;
    return (
        <group>
            <mesh position={[0, TOWER.baseHeight / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[TOWER.baseRadius * 0.82, TOWER.baseRadius, TOWER.baseHeight, 48]} />
                <meshStandardMaterial color={PLASTER} roughness={0.82} />
            </mesh>

            {stack.map((t) => {
                const on = t.level <= level;
                return (
                    <group key={t.level}>
                        <mesh position={[0, t.y, 0]} castShadow receiveShadow>
                            <cylinderGeometry args={[t.rTop, t.rBottom, t.height, 40]} />
                            <meshStandardMaterial color={on ? LIT : PLASTER} emissive={on ? GLOW : "#000000"} emissiveIntensity={on ? 2.2 : 0} roughness={0.72} />
                        </mesh>
                        {/* Карниз на стыке ярусов. Без него шесть цилиндров сливаются в один
                            конус, и «шесть ярусов» перестаёт читаться. После утоньшения ствола
                            прежний вынос стал вровень со стволом, и башня превратилась в стопку
                            бубликов — вынос срезан вдвое. */}
                        <mesh position={[0, t.y - t.height / 2 + 0.008, 0]} castShadow receiveShadow>
                            <cylinderGeometry args={[t.rBottom * 1.04, t.rBottom * 1.04, 0.014, 40]} />
                            <meshStandardMaterial color={PLASTER} roughness={0.78} />
                        </mesh>
                    </group>
                );
            })}

            {/* Площадка галереи под фонарём. Радиус обязан превышать rTop, иначе диск
                прячется внутрь силуэта яруса и ступени не видно: карниз в коде стоит
                у нижней кромки яруса, у верхней ничего нет. */}
            <mesh position={[0, top + 0.015, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[TOWER.galleryRadius, TOWER.galleryRadius, 0.03, 32]} />
                <meshStandardMaterial color={PLASTER} roughness={0.8} />
            </mesh>

            {/* Фонарь горит только на верхнем уровне: маяк заработал целиком. */}
            <mesh position={[0, top + TOWER.lanternHeight / 2 + 0.03, 0]} castShadow>
                <cylinderGeometry args={[TOWER.lanternRadius * 0.85, TOWER.lanternRadius, TOWER.lanternHeight, 24]} />
                <meshStandardMaterial
                    color={level >= LEVELS.length ? LIT : PLASTER}
                    emissive={level >= LEVELS.length ? GLOW : "#000000"}
                    emissiveIntensity={level >= LEVELS.length ? 3.5 : 0}
                    roughness={0.6}
                />
            </mesh>
            <mesh position={[0, top + TOWER.lanternHeight + 0.075, 0]} castShadow>
                <coneGeometry args={[TOWER.lanternRadius * 1.15, 0.11, 24]} />
                <meshStandardMaterial color={PLASTER} roughness={0.8} />
            </mesh>

            {/* Тёплая лужа света на платформе вокруг основания — она и делает «горит»
                событием сцены, а не покраской цилиндра. */}
            {/* После среза заливки та же мощность залила середину звезды тёплым пятном:
                лужа должна лежать у подножия, а не выбеливать половину платформы. */}
            <pointLight position={[0, 0.34 + level * 0.06, 0]} intensity={0.5 + level * 0.2} distance={2.1} decay={2.2} color={LIT} />
        </group>
    );
}

export default function Platform({ level = 1, ray = null, onPickRay = () => {} }) {
    const rayIndex = ray ? RAYS.findIndex((r) => r.id === ray) : null;
    return (
        <Canvas
            // Сцена статична: кадр рисуется только по запросу от рига камеры.
            frameloop="demand"
            // Потолок плотности снижен: при 2 холст выходил на 3.6 мегапикселя, и всю эту
            // площадь каждый кадр прогоняли затенение и блум.
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
            onCreated={({ camera, gl, scene }) => {
                camera.lookAt(...OVERVIEW.target);
                scene.background = new THREE.Color(BG);
            }}
            gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.05 }}
        >
            {/* Свет студийный, но заливки заметно меньше, чем кажется правильным на слух.
                При прежней заливке гипс выходил светлее фона, а на эталоне он темнее фона —
                то есть объект тонул, а не стоял. Ключ поднят почти в зенит: шесть серых
                клякс, отъезжавших от тумб вбок, шли именно от низкого угла, на эталоне их
                нет ни у одной тумбы. Перепад «верх против боковой стенки» при этом растёт
                с 11 уровней до полусотни ещё до всякого AO. */}
            <ambientLight intensity={0.3} />
            <hemisphereLight args={["#ffffff", "#d5d8dd", 0.55]} />
            <directionalLight
                position={[-3.4, 15.5, 3.1]}
                intensity={2.2}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-radius={20}
                // Заливку срезали, и тень стала проваливаться глубже эталонной: освещённый
                // пол против затенённого давал 68% перепада против эталонных 46%.
                shadow-intensity={0.8}
                shadow-camera-left={-6}
                shadow-camera-right={6}
                shadow-camera-top={6}
                shadow-camera-bottom={-6}
                shadow-bias={-0.0004}
            />
            <directionalLight position={[6, 4.5, 3]} intensity={0.25} />

            <StarSlab />
            {RAYS.map((ray, i) => (
                <Inlay key={`in-${ray.id}`} index={i} color={ACCENT[ray.id]} />
            ))}
            {RAYS.map((r, i) => (
                <Pedestal
                    key={r.id}
                    index={i}
                    ray={r}
                    color={ACCENT[r.id]}
                    active={ray === r.id}
                    dimmed={ray != null && ray !== r.id}
                    onPick={onPickRay}
                />
            ))}
            <Tower level={level} />
            <CameraRig ray={rayIndex} level={level} />

            {/* Мягкая тень под всей конструкцией: она отрывает звезду от фона. Без неё
                платформа висит в молоке. */}
            {/* Тень тёплая, а не серая. Холод у нас шёл от самого фона, и класть поверх
                холодную тень значило его удваивать: на эталоне тени тёплые. */}
            {/* Площадка тени вынесена далеко за кадр. При scale 11 её собственная кромка
                попадала в кадр и читалась светлым трапециевидным швом поперёк плиты —
                тот самый шов, который я сперва списал на карту теней и на плиту. */}
            <ContactShadows position={[0, -(STAR.thickness + STAR.bevel) - 0.02, 0]} opacity={0.42} scale={34} blur={5} far={3} resolution={2048} frames={1} color="#a09890" />

            {/* Плита уходит далеко за кадр — при длинном объективе её кромка иначе попадает
                в верх кадра и читается горизонтом.
                Тень от направленного света она не принимает намеренно: карта теней покрывает
                лишь ±6 единиц, и её граница проступала на плите отчётливым диагональным швом.
                Мягкую тень под конструкцией даёт ContactShadows, и по характеру она ближе
                к эталонной, чем длинная отбрасываемая. */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -(STAR.thickness + STAR.bevel) - 0.05, 0]}>
                <planeGeometry args={[240, 240]} />
                {/* Материал без освещения. Освещаемая плита реагировала и на карту теней,
                    и на экранное затенение, и обе давали на ней видимый шов по своей границе.
                    Неосвещаемая заливка цветом фона шва дать не может в принципе. */}
                <meshBasicMaterial color={BG} />
            </mesh>

            {/* Затенение в стыках. Белое на белом читается только им: без AO верхние грани
                выходили ровной заливкой, а место посадки тумбы на луч не читалось вовсе.
                Порядок важен — тонмаппинг последним, иначе блум работает по уже сжатому
                сигналу и порог не срабатывает. */}
            <EffectComposer disableNormalPass multisampling={4}>
                <N8AO aoRadius={0.55} distanceFalloff={0.75} intensity={3.4} color="#7a736a" />
                <Bloom intensity={0.55} luminanceThreshold={0.82} luminanceSmoothing={0.25} mipmapBlur />
                <ToneMapping mode={ToneMappingMode.NEUTRAL} />
            </EffectComposer>
        </Canvas>
    );
}

export { rayAngle };
