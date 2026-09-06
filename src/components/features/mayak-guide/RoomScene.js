"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei/core/ContactShadows";
import { Environment } from "@react-three/drei/core/Environment";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { useGLTF } from "@react-three/drei/core/Gltf";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, SMAA, TiltShift2, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

import { LEVEL_PROPS, LIGHT, PEOPLE, ROOM, SHELL_TINT, kitUrl } from "./roomKit.mjs";

// Комната-диорама. Мебель — готовые модели из набора Kenney Furniture Kit (CC0), а не
// коробки, собранные руками: ручная лепка мебели примитивами — это верстать сайт,
// рисуя буквы полигонами. Корпус комнаты тоже из набора, поэтому стиль сходится
// гарантированно, без подгонки материалов.
//
// Работаем в единицах набора, не переводя в метры: у него всё на сетке, floorFull ровно
// 1 × 1, и любая конвертация только добавила бы дробей. Реальный масштаб примерно вдвое
// меньше метрового — стол высотой 0.384 это 77 см.
//
// Тени: обычная карта плюс ContactShadows. SoftShadows из drei здесь применять нельзя —
// он патчит шейдер, и на программном OpenGL патч не компилируется молча, без ошибки в
// консоли: всё, у чего включены тени, просто перестаёт рисоваться. На программный рендер
// откатываются и headless-браузер, и машины без нормального GPU.

const ISO = Math.atan(Math.sin(Math.PI / 4)); // 35.264°, настоящая изометрия

// Модель из набора. Клонируем сцену на каждый экземпляр — один и тот же Object3D нельзя
// разместить в двух местах, он просто уедет в последнее.
//
// Опорная точка у моделей набора — угол, а не центр: floorFull занимает x 0..1 и z −1..0,
// у desk пивот вообще смешанный. Поэтому каждая модель здесь центруется по горизонтали
// при загрузке, а по вертикали сажается на пол. После этого координата в раскладке
// означает «центр предмета на полу», и подгонять смещения руками не нужно.
function Kit({ name, position, rotation = 0, scale = 1, tint }) {
    const { scene } = useGLTF(kitUrl(name));
    const object = useMemo(() => {
        const clone = scene.clone(true);
        const box = new THREE.Box3().setFromObject(clone);
        clone.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
        clone.traverse((node) => {
            if (!node.isMesh) return;
            node.castShadow = true;
            node.receiveShadow = true;
            if (!tint) return;
            // Материал у клона общий с оригиналом, поэтому перекраска без копии залила бы
            // цветом все экземпляры модели разом.
            node.material = node.material.clone();
            node.material.color = new THREE.Color(tint);
        });
        const holder = new THREE.Group();
        holder.add(clone);
        return holder;
    }, [scene, tint]);
    return <primitive object={object} position={position} rotation={[0, rotation, 0]} scale={scale} />;
}

// Корпус: плитки пола по сетке, две стены по дальним кромкам. Угловой элемент набора не
// нужен — стены стоят в плоскостях кромок и стыкуются сами, а wallCorner при центровке
// садится в стык лишним объёмом.
function Shell() {
    const half = (ROOM.tiles - 1) / 2;
    const edge = ROOM.tiles / 2;
    const line = Array.from({ length: ROOM.tiles }, (_, i) => i - half);

    return (
        <group>
            {line.map((x) => line.map((z) => <Kit key={`f${x}:${z}`} name="floorFull" position={[x, 0, z]} tint={SHELL_TINT.floor} />))}
            {line.map((x) => (
                <Kit key={`b${x}`} name={x === ROOM.windowBack ? "wallWindow" : "wall"} position={[x, 0, -edge]} tint={SHELL_TINT.wall} />
            ))}
            {line.map((z) => (
                <Kit key={`l${z}`} name={z === ROOM.windowLeft ? "wallWindow" : "wall"} position={[-edge, 0, z]} rotation={Math.PI / 2} tint={SHELL_TINT.wall} />
            ))}
            {/* Светящийся проём. Пятна света на полу здесь нет намеренно: плоскость с
                аддитивным смешиванием даёт жёсткий прямоугольник и читается как оранжевый
                коврик, а не как свет. Мягкое пятно требует либо проекции текстуры, либо
                объёмного света — и то и другое дороже, чем польза от него. Без него окно — чёрный прямоугольник: снаружи комнаты
                ничего нет, и отражать свету нечего. Это же пятно даёт повод тёплому ключу. */}
            <mesh position={[-edge + 0.04, 0.63, ROOM.windowLeft]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[0.52, 0.66]} />
                <meshBasicMaterial color="#ffd9a8" toneMapped={false} />
            </mesh>
        </group>
    );
}

// Сидящий человек. В наборе мебели фигур нет, а без людей комната мёртвая, поэтому это
// единственная геометрия, собранная руками. И собрана она нарочно обобщённо: торс да
// голова, без лиц и без рук. Как только у фигуры появляются черты, диорама превращается
// в мультфильм, а нам нужно, чтобы взгляд оставался на предметах — меняются они.
//
// Ног нет: их не видно за столом и спинкой кресла.
function Person({ position, rotation = 0, cloth }) {
    return (
        <group position={position} rotation={[0, rotation, 0]}>
            <mesh position={[0, 0.36, 0]} castShadow>
                <capsuleGeometry args={[0.088, 0.16, 6, 16]} />
                <meshStandardMaterial color={cloth} roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.58, 0]} castShadow>
                <sphereGeometry args={[0.072, 20, 16]} />
                <meshStandardMaterial color="#c08b5f" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.6, -0.008]} castShadow>
                <sphereGeometry args={[0.071, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
                <meshStandardMaterial color="#2b211a" roughness={0.9} />
            </mesh>
        </group>
    );
}

function Room({ level }) {
    return (
        <group>
            <Shell />
            {PEOPLE.map((person) => (
                <Person key={person.at.join()} position={person.at} rotation={person.spin ?? 0} cloth={person.cloth} />
            ))}
            {LEVEL_PROPS[level].map((prop, index) => (
                <Kit key={`${prop.name}${index}`} name={prop.name} position={prop.at} rotation={prop.spin ?? 0} tint={prop.tint} />
            ))}
            <ContactShadows position={[0, 0.055, 0]} scale={ROOM.tiles * 1.8} resolution={1024} blur={2.2} opacity={0.5} far={1.4} color="#1a1206" />
        </group>
    );
}

export default function RoomScene({ level = 1 }) {
    const light = LIGHT[level];

    return (
        <Canvas
            shadows
            dpr={[1, 2]}
            orthographic
            camera={{ position: [9, 9 * Math.tan(ISO) * Math.SQRT2, 9], zoom: 288, near: -40, far: 80 }}
            gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: light.exposure, antialias: false }}
            onCreated={({ camera }) => camera.lookAt(0, 0.62, 0)}>
            <color attach="background" args={["#0b0b0b"]} />

            {/* Ключ идёт со стороны окна и даёт единственную резкую тень. Всё остальное
                освещение — карта окружения: она заменяет и заполняющий свет, и отражённый
                от стен, которого в реальном времени не существует. */}
            <directionalLight
                position={[-6, 4.5, 1.2]}
                color={light.key}
                intensity={light.keyIntensity}
                castShadow
                shadow-mapSize={[4096, 4096]}
                shadow-camera-left={-3.5}
                shadow-camera-right={3.5}
                shadow-camera-top={3.5}
                shadow-camera-bottom={-3.5}
                shadow-camera-near={0.1}
                shadow-camera-far={18}
                shadow-bias={-0.0007}
                shadow-normalBias={0.02}
            />

            <Suspense fallback={null}>
                <Environment files={kitUrl("interior")} environmentIntensity={light.env} />
                <Room level={level} />
            </Suspense>

            {/* Постобработка — то, чем «прототип игры» отличается от диорамы, и геометрия
                тут почти ни при чём. Порядок важен, эффекты складываются в один проход.

                N8AO — затенение в стыках. Главный вклад: без него предметы выглядят
                приклеенными к полу, потому что в реальности у ножки стола, в углу комнаты
                и под столешницей свет не достаёт, а прямой источник этого не знает.

                TiltShift2 — размытие по краям кадра. Именно оно читается как «макет»:
                глаз принимает малую глубину резкости за близкий мелкий предмет.

                SMAA обязателен: аппаратное сглаживание с затенением не работает, поэтому
                у Canvas antialias выключен, а multisampling у композитора равен нулю. */}
            <EffectComposer multisampling={0}>
                <N8AO aoRadius={0.3} distanceFalloff={0.6} intensity={3.4} halfRes color="#140c05" />
                <Bloom intensity={light.bloom} luminanceThreshold={0.72} luminanceSmoothing={0.3} mipmapBlur />
                <TiltShift2 blur={0.13} />
                <HueSaturation saturation={light.saturation} />
                <BrightnessContrast contrast={light.contrast} />
                <Vignette offset={0.4} darkness={0.5} />
                <SMAA />
            </EffectComposer>

            <OrbitControls target={[0, 0.62, 0]} enablePan={false} minZoom={120} maxZoom={520} minPolarAngle={0.35} maxPolarAngle={1.35} />
        </Canvas>
    );
}
