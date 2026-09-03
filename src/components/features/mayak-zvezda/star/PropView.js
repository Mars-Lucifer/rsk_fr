"use client";

// Смотрелка предмета на тумбе. Один вопрос: годится ли форма и как она садится по масштабу.
//
// Декодер Draco берётся из public/draco/, а не с гугловского CDN, куда drei ходит по
// умолчанию: сцена обязана открываться без сети, и внешняя зависимость на каждый GLB —
// лишняя точка отказа.

import { ContactShadows, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { ACCENT, PEDESTAL } from "../model/platform.mjs";

// Все размеры читаются из модели, ни одного числа тут своего. Тумба сегодня переехала:
// она прорастает сквозь платформу, её центр ушёл ниже нуля, а столешница поднята всего
// на PEDESTAL.top. Прежняя посадка «на половине высоты» подвесила бы предмет над блюдцем.
const TOP = PEDESTAL.top;
const BOTTOM = PEDESTAL.top - PEDESTAL.height;
// Внутренний край цветного кольца — вот настоящая граница поля.
//
// Бортик кончается на radius − chamfer − 2·lip = 0.602, но кольцо луча лежит ещё внутри,
// на rimRadius = 0.59. Предмет, вписанный в бортик, кольцо всё равно перечёркивает —
// проверено кадром. Считаем по кольцу.
const FIELD = PEDESTAL.rimRadius - PEDESTAL.rimThickness;
// Потолок высоты. Без него узкие и длинные предметы (серверная стойка) вымахивают в столб:
// ограничение по следу их не держит, след у них маленький.
const MAX_HEIGHT = PEDESTAL.radius * 1.5;
import { report } from "./propAnalysis.mjs";

const BG = "#eceef1";
const PLASTER = new THREE.MeshStandardMaterial({ color: "#f2f3f5", roughness: 0.92, metalness: 0 });

function Prop({ file }) {
    const { scene } = useGLTF(`/zvezda-props/${file}`, "/draco/");
    const group = useRef();

    // Модель приводится к размеру тумбы: генераторы отдают что угодно по масштабу и с
    // произвольным началом координат. Габарит меряем после перекраски, сажаем подошвой на
    // столешницу и центруем по горизонтали.
    const model = useMemo(() => {
        const root = scene.clone(true);
        root.traverse((n) => {
            if (!n.isMesh) return;
            n.material = PLASTER;
            n.castShadow = true;
            n.receiveShadow = true;
        });
        return root;
    }, [scene]);

    useLayoutEffect(() => {
        if (!group.current) return;
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        // Два независимых ограничения, берётся меньшее.
        //
        // По следу: предмет занимает 72% диаметра кольца, остальное — видимое поле вокруг него,
        // как на эталоне. Прежняя формула считала след и высоту одним максимумом, и у высокого
        // предмета след не ограничивался вовсе — подставка планшета выезжала на кольцо.
        //
        // По высоте: не выше полутора радиусов тумбы, иначе предмет спорит с маяком.
        const kFoot = (FIELD * 2 * 0.72) / Math.max(size.x, size.z);
        const kHeight = MAX_HEIGHT / size.y;
        const k = Math.min(kFoot, kHeight);
        model.scale.setScalar(k);
        model.position.set(-center.x * k, -box.min.y * k, -center.z * k);
        report(model, file, size, k);
        // eslint-disable-next-line no-console
        console.log("[посадка]", "след", +(Math.max(size.x, size.z) * k).toFixed(3), "из", +(FIELD * 2).toFixed(3), "| высота", +(size.y * k).toFixed(3), "из", MAX_HEIGHT.toFixed(3), "| держит", kFoot < kHeight ? "след" : "высота");
    }, [model, file]);

    return (
        <group ref={group} position={[0, TOP, 0]}>
            <primitive object={model} />
        </group>
    );
}

// Тумба, повторяющая сборку из Platform.js: тело, фаска кромки, бортик-тор и цветное кольцо
// луча. Голый цилиндр обманывал — на нём предмет всегда садился ровно, а на блюдце с бортиком
// видно, наехал он на кант или нет.
//
// Файл Platform.js принадлежит другой сессии, поэтому здесь именно повтор по её числам,
// а не импорт компонента: общий модуль потребовал бы правки чужого файла.
function RealPedestal({ ray }) {
    const color = ACCENT[ray] ?? "#8f6fbe";
    return (
        <group position={[0, TOP - PEDESTAL.height / 2, 0]}>
            <mesh castShadow receiveShadow>
                <cylinderGeometry args={[PEDESTAL.radius, PEDESTAL.radius, PEDESTAL.height - PEDESTAL.chamfer, 48]} />
                <primitive object={PLASTER} attach="material" />
            </mesh>
            <mesh position={[0, PEDESTAL.height / 2 - PEDESTAL.chamfer / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[PEDESTAL.radius - PEDESTAL.chamfer, PEDESTAL.radius, PEDESTAL.chamfer, 48]} />
                <primitive object={PLASTER} attach="material" />
            </mesh>
            <mesh position={[0, PEDESTAL.height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <torusGeometry args={[PEDESTAL.radius - PEDESTAL.chamfer - PEDESTAL.lip, PEDESTAL.lip, 10, 64]} />
                <primitive object={PLASTER} attach="material" />
            </mesh>
            <mesh position={[0, PEDESTAL.height / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <torusGeometry args={[PEDESTAL.rimRadius, PEDESTAL.rimThickness, 12, 72]} />
                <meshStandardMaterial color={color} roughness={0.5} />
            </mesh>
        </group>
    );
}

export default function PropView({ file, dist = 1, raw = false }) {
    // Луч определяется именем файла: knowledge.glb -> knowledge. Кольцо тумбы красится
    // в его цвет, и сразу видно, тот ли предмет положили на тот луч.
    const ray = file.replace(/.glb$/i, "");
    return (
        <Canvas
            frameloop="demand"
            dpr={[1, 1.5]}
            shadows={{ type: THREE.PCFShadowMap }}
            camera={{ position: [1.4 * dist, 1.15 * dist, 1.8 * dist], fov: 32 }}
            gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}
            onCreated={({ camera, scene }) => {
                camera.lookAt(0, TOP + 0.25, 0);
                scene.background = new THREE.Color(BG);
            }}
        >
            <ambientLight intensity={0.5} />
            <hemisphereLight args={["#ffffff", "#d5d8dd", 0.9]} />
            <directionalLight position={[-2.4, 4.2, 2.2]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
            <directionalLight position={[3, 2, 1.5]} intensity={0.35} />

            {/* Тумба ровно та же, что в сцене: без неё масштаб не с чем сравнить.
                Для моделей, которые сами являются сценой, она мешает — гасится через ?raw=1. */}
            {!raw && <RealPedestal ray={ray} />}

            <Prop file={file} />

            <ContactShadows position={[0, BOTTOM - 0.002, 0]} opacity={0.45} scale={9} blur={2.4} far={2} resolution={1024} frames={1} color="#a09890" />
        </Canvas>
    );
}
