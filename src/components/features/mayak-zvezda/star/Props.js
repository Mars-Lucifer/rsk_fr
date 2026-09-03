"use client";

// Предметы на тумбах. Отдельно от Platform намеренно: платформа о предметах ничего не знает,
// они приходят к ней детьми. Так набор можно менять, не трогая сцену.
//
// Модель приходит от генератора с произвольным масштабом и произвольным началом координат,
// поэтому каждая сажается заново: меряется габарит, считается масштаб, подошва ставится
// на столешницу.

import { useGLTF } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import * as THREE from "three";

import { PEDESTAL, pedestalAt, rayAngle } from "../model/platform.mjs";
import { RAYS } from "../model/zvezda.mjs";

// Тот же гипс, что у платформы. Один материал на все предметы: меньше программ у рендерера
// и правится в одном месте.
const PLASTER = new THREE.MeshStandardMaterial({ color: "#f2f3f5", roughness: 0.9, metalness: 0 });

// Граница поля — по внутреннему краю цветного кольца, а не по бортику. Кольцо лежит внутри
// бортика, и предмет, вписанный в бортик, кольцо всё равно перечёркивает.
const FIELD = PEDESTAL.rimRadius - PEDESTAL.rimThickness;
const MAX_HEIGHT = PEDESTAL.radius * 1.5;

// Какие предметы уже есть в public/zvezda-props. Список явный, а не проба сети: у отсутствующего
// файла useGLTF уходит в вечное ожидание внутри Suspense, и сцена молча остаётся пустой.
export const READY = ["knowledge"];

function Prop({ rayId, selected }) {
    const index = RAYS.findIndex((r) => r.id === rayId);
    const { scene } = useGLTF(`/zvezda-props/${rayId}.glb`, "/draco/");

    const { object, y } = useMemo(() => {
        const root = scene.clone(true);
        root.traverse((n) => {
            if (!n.isMesh) return;
            n.material = PLASTER;
            n.castShadow = true;
            n.receiveShadow = true;
        });
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        // Два независимых ограничения, берётся меньшее: по следу и по высоте. Одним максимумом
        // считать нельзя — у высокого предмета след тогда не ограничен, и подставка выезжает
        // на кольцо.
        const k = Math.min((FIELD * 2 * 0.72) / Math.max(size.x, size.z), MAX_HEIGHT / size.y);
        root.position.set(-center.x * k, -box.min.y * k, -center.z * k);
        root.scale.setScalar(k);
        return { object: root, y: PEDESTAL.top };
    }, [scene]);

    // Разворот зависит от того, смотрим мы на луч или на всю звезду, и обойти это нельзя:
    // два вида требуют противоположного.
    //
    // Подлёт: камера стоит СНАРУЖИ тумбы и смотрит внутрь, значит предмет обязан быть повёрнут
    // наружу, вдоль своего луча.
    // Обзор: камера одна на всю сцену, и дальние тумбы при развороте наружу показывают спину —
    // на кадре это тёмное пятно, потому что ключевой свет туда не достаёт. На эталоне все шесть
    // предметов повёрнуты к зрителю, поэтому в обзоре разворот нулевой.
    const a = rayAngle(index);
    const [x, , z] = pedestalAt(index);
    const turn = selected ? Math.atan2(Math.cos(a), Math.sin(a)) : 0;

    return (
        <group position={[x, y, z]} rotation={[0, turn, 0]}>
            <primitive object={object} />
        </group>
    );
}

export default function Props({ only = READY, ray = null }) {
    return (
        <Suspense fallback={null}>
            {only.map((id) => (
                <Prop key={id} rayId={id} selected={ray === id} />
            ))}
        </Suspense>
    );
}
