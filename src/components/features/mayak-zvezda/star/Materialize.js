"use client";

// Материализация и дематериализация предмета на тумбе:
// mode="enter" — печать голограммой снизу вверх (новое состояние наливается в гипсе).
// mode="exit"  — дематериализация сверху вниз в тумбу (старое состояние убирается с платформы).
// mode="solid" — готовый монолитный предмет без секущих плоскостей.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const EDGE_ANGLE = 55;
const OVERSHOOT = 0.03;
const OLD_FADE = 0.42;

export function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function usePrintCycle({ play, seconds = 1.6, hold = 1.1 }) {
    const invalidate = useThree((s) => s.invalidate);
    const [t, setT] = useState(0);
    const clock = useRef(0);
    useFrame((_, dt) => {
        if (!play) return;
        clock.current = (clock.current + Math.min(dt, 1 / 30)) % (seconds + hold);
        setT(Math.min(1, clock.current / seconds));
        invalidate();
    });
    return play ? t : null;
}

export default function Materialize({ object, mode = "enter", t = 1, from = null, color = "#e8a848" }) {
    const gl = useThree((s) => s.gl);
    const invalidate = useThree((s) => s.invalidate);
    const root = useRef();
    const ring = useRef();
    const ringMat = useRef();
    const span = useRef({ y0: 0, h: 1, radius: 0.3, localOffset: 0 });

    const isExit = mode === "exit";
    const isSolid = mode === "solid" || (!isExit && !from && t >= 1);

    const layers = useMemo(() => {
        if (!object) return null;

        const solidPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1000);
        const ghostPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1000);

        const solidMat = new THREE.MeshStandardMaterial({
            color: "#f2f3f5",
            roughness: 0.9,
            metalness: 0,
            clippingPlanes: isSolid ? [] : [solidPlane],
            clipShadows: true,
        });

        const ghostMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
            side: THREE.DoubleSide,
            clippingPlanes: [ghostPlane],
            toneMapped: false,
        });

        const wireMat = new THREE.LineBasicMaterial({
            color: new THREE.Color(color).multiplyScalar(1.8),
            transparent: true,
            opacity: 0.9,
            clippingPlanes: [ghostPlane],
            toneMapped: false,
        });

        const solid = new THREE.Group();
        const ghost = new THREE.Group();
        const wire = new THREE.Group();

        for (const g of [solid, ghost, wire]) {
            g.position.copy(object.position);
            g.quaternion.copy(object.quaternion);
            g.scale.copy(object.scale);
        }

        const cast = (src, target, build) => {
            src.updateWorldMatrix(true, true);
            const toLocal = new THREE.Matrix4().copy(src.matrixWorld).invert();
            src.traverse((node) => {
                if (!node.isMesh) return;
                const m = new THREE.Matrix4().copy(node.matrixWorld).premultiply(toLocal);
                const obj = build(node.geometry, node.material);
                obj.applyMatrix4(m);
                obj.name = node.name;
                obj.userData = { ...node.userData };
                target.add(obj);
            });
        };

        cast(object, solid, (geo, origMat) => {
            let m = solidMat;
            const isCustom = origMat && (origMat.onBeforeCompile || (origMat.color && origMat.color.getHexString() !== "f2f3f5"));
            if (isCustom) {
                m = origMat.clone();
                if (origMat.onBeforeCompile) {
                    m.onBeforeCompile = origMat.onBeforeCompile;
                    m.customProgramCacheKey = origMat.customProgramCacheKey;
                }
                m.clippingPlanes = isSolid ? [] : [solidPlane];
                m.clipShadows = true;
            }
            const s = new THREE.Mesh(geo, m);
            s.castShadow = true;
            s.receiveShadow = true;
            return s;
        });

        cast(object, ghost, (geo) => new THREE.Mesh(geo, ghostMat));
        cast(object, wire, (geo) => new THREE.LineSegments(new THREE.EdgesGeometry(geo, EDGE_ANGLE), wireMat));

        let old = null;
        let oldMat = null;
        if (from) {
            oldMat = new THREE.MeshStandardMaterial({ color: "#f2f3f5", roughness: 0.9, metalness: 0, transparent: true, opacity: 1 });
            old = new THREE.Group();
            old.position.copy(from.position);
            old.quaternion.copy(from.quaternion);
            old.scale.copy(from.scale);
            cast(from, old, (geo) => {
                const m = new THREE.Mesh(geo, oldMat);
                m.castShadow = true;
                return m;
            });
        }

        const local = new THREE.Box3().setFromObject(object);
        if (from) local.union(new THREE.Box3().setFromObject(from));
        const size = new THREE.Vector3();
        local.getSize(size);
        const radius = Math.max(size.x, size.z) * 0.62;

        return { solid, ghost, wire, old, oldMat, solidPlane, ghostPlane, radius, ghostMat, wireMat, solidMat, materials: [solidMat, ghostMat, wireMat, oldMat].filter(Boolean) };
    }, [object, from, color]);

    useEffect(() => {
        if (!layers) return;
        layers.solidMat.clippingPlanes = isSolid ? [] : [layers.solidPlane];
        layers.solidMat.needsUpdate = true;
        layers.solid.traverse((n) => {
            if (n.isMesh && n.material) {
                n.material.clippingPlanes = isSolid ? [] : [layers.solidPlane];
                n.material.needsUpdate = true;
            }
        });
    }, [layers, isSolid]);

    useEffect(() => {
        if (isSolid) return;
        const was = gl.localClippingEnabled;
        gl.localClippingEnabled = true;
        invalidate();
        return () => {
            gl.localClippingEnabled = was;
        };
    }, [gl, invalidate, isSolid]);

    useEffect(() => {
        invalidate();
    }, [t, layers, invalidate]);

    useEffect(
        () => () => {
            if (layers) {
                layers.materials.forEach((m) => m.dispose());
                layers.wire.traverse((n) => n.geometry && n.geometry.dispose());
            }
        },
        [layers]
    );

    useLayoutEffect(() => {
        if (!root.current || !layers) return;
        root.current.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(layers.solid);
        box.union(new THREE.Box3().setFromObject(layers.ghost));
        const size = new THREE.Vector3();
        box.getSize(size);
        span.current = {
            y0: box.min.y - OVERSHOOT,
            h: size.y + OVERSHOOT * 2,
            localOffset: root.current.getWorldPosition(new THREE.Vector3()).y,
        };
    }, [layers]);

    const clamped = THREE.MathUtils.clamp(t, 0, 1);

    useFrame((state, dt) => {
        if (!layers) return;

        if (layers.solid) {
            const elapsed = state.clock.getElapsedTime();
            layers.solid.traverse((child) => {
                if (child.userData && typeof child.userData.onFrame === "function") {
                    child.userData.onFrame(child, elapsed, dt);
                }
            });
        }

        if (isSolid) {
            layers.solidPlane.constant = 1000;
            layers.ghostPlane.constant = -1000;
            return;
        }

        const { y0, h, localOffset } = span.current;

        if (isExit) {
            // Линия сканирования опускается сверху вниз (уборка предмета в тумбу)
            const easeT = easeInOutCubic(clamped);
            const y = y0 + h * (1 - easeT);

            layers.solidPlane.constant = y;
            layers.ghostPlane.constant = -y;

            const dissolve = Math.max(0, 1 - clamped);
            if (layers.ghostMat) layers.ghostMat.opacity = 0.2 * dissolve;
            if (layers.wireMat) layers.wireMat.opacity = 0.85 * dissolve;

            if (ring.current) {
                ring.current.position.y = y - localOffset;
                if (ringMat.current) {
                    ringMat.current.opacity = 0.95 * dissolve;
                }
            }
        } else {
            // Линия сканирования поднимается снизу вверх (печать нового предмета)
            const easeT = easeInOutCubic(clamped);
            const y = y0 + h * easeT;

            layers.solidPlane.constant = y;
            layers.ghostPlane.constant = -y;

            if (layers.oldMat) {
                const fadeRatio = Math.min(1, clamped / OLD_FADE);
                layers.oldMat.opacity = Math.max(0, 0.5 * (1 + Math.cos(fadeRatio * Math.PI)));
            }

            const finishFade = clamped > 0.82 ? Math.max(0, (1 - clamped) / 0.18) : 1;
            const startFade = clamped < 0.08 ? Math.max(0, clamped / 0.08) : 1;

            if (layers.ghostMat) layers.ghostMat.opacity = 0.16 * finishFade;
            if (layers.wireMat) layers.wireMat.opacity = 0.9 * finishFade;

            if (ring.current) {
                ring.current.position.y = y - localOffset;
                if (ringMat.current) {
                    ringMat.current.opacity = 0.9 * finishFade * startFade;
                }
            }
        }
    });

    if (!object) return null;
    if (isExit && clamped >= 1) return null;
    if (!layers) return null;

    return (
        <group ref={root}>
            <primitive object={layers.solid} />
            {layers.old && clamped < OLD_FADE && <primitive object={layers.old} />}
            {!isSolid && <primitive object={layers.ghost} />}
            {!isSolid && <primitive object={layers.wire} />}
            {!isSolid && (
                <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[layers.radius, layers.radius + 0.008, 64]} />
                    <meshBasicMaterial
                        ref={ringMat}
                        color={new THREE.Color(color).multiplyScalar(2.4)}
                        transparent
                        opacity={0.9}
                        side={THREE.DoubleSide}
                        toneMapped={false}
                        depthWrite={false}
                    />
                </mesh>
            )}
        </group>
    );
}
