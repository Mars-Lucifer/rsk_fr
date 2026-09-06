"use client";

// Купол ЗВЕЗДЫ: один блок — один артефакт, сектор — луч, ярус — уровень.
//
// Картинка держится не на моделях, а на обводке. Приём снят с jordan-breton.com: там вся
// сцена — контурный проход, и геометрия под ним может быть какой угодно. Нам это подходит
// буквально: набор Kenney не имеет ни одной текстуры, и на обычном материале он выглядит
// пластмассой. Рёбра эту слабость превращают в приём, а стоят они ноль — ни ассетов,
// ни постобработки, ни новых пакетов.
//
// Второй источник — igloo.inc: объект в центре пустоты, собранный из блоков, часть которых
// отсутствует. Недостроенные ярусы здесь стоят каркасом без заливки.

import { Edges } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { blocks } from "../model/dome.mjs";
import { RAY_COLOR } from "../proba/sketchGeometry.mjs";

const BG = "#05070d";

// Ориентация блока: смотреть в центр сферы. Углы Эйлера здесь считать не нужно — `lookAt`
// даёт ту же касательную посадку короче и без вырождения на верхнем ярусе.
function orient() {
    const dummy = new THREE.Object3D();
    return blocks().map((b) => {
        dummy.position.set(...b.position);
        dummy.lookAt(0, 0, 0);
        // Нижний ярус — «Хаос». Он определяется тем, чего нет, поэтому его блоки посажены
        // криво. Наклон детерминированный (от номера блока), а не случайный: иначе кадр
        // не воспроизводится и проверять его нечем.
        if (b.level === 1) {
            const skew = ((b.index * 37) % 11) / 11 - 0.5;
            dummy.rotateZ(skew * 0.28);
            dummy.rotateX(skew * 0.16);
        }
        return { ...b, quaternion: dummy.quaternion.clone() };
    });
}

function Blocks({ level, ray }) {
    const all = useMemo(orient, []);
    const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
    // Камень светлее фона ровно настолько, чтобы грань блока читалась заливкой, а не дырой:
    // на #10151f блоки сливались с пустотой и купол выглядел одной проволокой.
    const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1b2233", roughness: 0.92, metalness: 0 }), []);

    return (
        <group>
            {all.map((b) => {
                const built = b.level <= level;
                const dim = ray && ray !== b.ray;
                const color = RAY_COLOR[b.ray];
                return (
                    <mesh key={b.key} geometry={geo} material={stone} position={b.position} quaternion={b.quaternion} scale={b.size} visible={built}>
                        <Edges
                            threshold={15}
                            // Каркас будущих ярусов виден слабо: он обещание, а не факт.
                            color={built ? color : "#39496b"}
                            transparent
                            opacity={built ? (dim ? 0.28 : 1) : 0.22}
                        />
                    </mesh>
                );
            })}
            {/* Каркас недостроенного: те же блоки без заливки. Отдельным проходом, потому что
                у невидимого меша не рисуются и рёбра. */}
            {all
                .filter((b) => b.level > level)
                .map((b) => (
                    <lineSegments key={`cage-${b.key}`} position={b.position} quaternion={b.quaternion} scale={b.size}>
                        <edgesGeometry args={[geo]} />
                        <lineBasicMaterial color="#2f3d5c" transparent opacity={0.5} />
                    </lineSegments>
                ))}
        </group>
    );
}

// Основание: плита под куполом и несколько колец разметки. Кольца дают масштаб и читаются
// как измерительная сетка, а не как декор.
function Ground() {
    const rings = [2.1, 2.9, 3.9, 5.2];
    return (
        <group position={[0, -0.004, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[7, 96]} />
                <meshStandardMaterial color="#080c14" roughness={1} metalness={0} />
            </mesh>
            {rings.map((r) => (
                <lineLoop key={r} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[r, r, 96]} />
                    <lineBasicMaterial color="#1b2437" transparent opacity={0.6} />
                </lineLoop>
            ))}
        </group>
    );
}

// Оборот примерно за минуту: быстрее — мешает читать и через полминуты укачивает.
function Spinner({ spin, children }) {
    const group = useRef();
    useFrame((_, delta) => {
        if (group.current && spin) group.current.rotation.y += delta * 0.1;
    });
    return <group ref={group}>{children}</group>;
}

export default function Dome({ level, ray, spin = true }) {
    return (
        <Canvas
            dpr={[1, 2]}
            // Купол занимает меньше половины кадра. Пустота вокруг — не щедрость к полям,
            // а то, чем держатся все четыре референса: объект должен стоять в пространстве,
            // а не упираться в кромку.
            camera={{ position: [0, 3.2, 11.5], fov: 30 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
            style={{ background: BG }}
        >
            {/* Туман — единственный источник глубины в такой сцене: детализации, которая
                читалась бы вдали, у нас нет. Все четыре референса держатся на нём. */}
            <fog attach="fog" args={[BG, 9, 24]} />
            <ambientLight intensity={0.6} />
            <hemisphereLight args={["#8fb0ff", "#0a0f18", 0.9]} />
            <directionalLight position={[-4, 6, 3]} intensity={2.2} />
            {/* Свет внутри купола: у igloo блоки светятся изнутри, и именно это отличает
                «строение» от «кучи камней». */}
            <pointLight position={[0, 0.5, 0]} intensity={6} distance={4.2} color="#cfe0ff" />

            <Spinner spin={spin}>
                <Blocks level={level} ray={ray} />
            </Spinner>
            <Ground />

            {/* Блум по рёбрам. Порог высокий: светиться должны только линии лучей, а не
                заливка блоков — иначе купол расплывается в туманное пятно. */}
            <EffectComposer>
                <Bloom intensity={0.9} luminanceThreshold={0.35} luminanceSmoothing={0.3} mipmapBlur />
            </EffectComposer>
        </Canvas>
    );
}
