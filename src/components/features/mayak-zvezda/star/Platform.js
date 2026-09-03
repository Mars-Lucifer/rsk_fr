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

import { ContactShadows, Environment, Html, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { LEVELS, RAYS } from "../model/zvezda.mjs";
import { ACCENT, OVERVIEW, PEDESTAL, STAR, TOWER, crown, inlay, pedestalAt, plinth, rayAngle, rayCamera, starOutline, staveAngles, tiers } from "../model/platform.mjs";

const BG = "#eceef1";
const PLASTER = "#f2f3f5";

// Свечение маяка. Промер эталона по стенке яруса: 220,190,168 в середине и 242,207,173
// у верха, то есть разница красного и синего 52-69 — свечение там насыщенно-тёплое, а не
// белое. Прежняя пара «почти белый цвет плюс мощность 4.2» давала обратное: каналы упирались
// в потолок, нейтральный тонмаппинг досаживал остаток насыщенности, и на кадре выходило
// 237,227,215 при разнице 22 — вдвое бледнее эталона.
//
// Отсюда правило: тёплый цвет и мощность около единицы. Мощность выше вымывает цвет в белый
// независимо от того, какой он был.
const GLOW = "#ffd49b";
const LIT = "#ffcf8a";


// Циклорама: мягкое световое пятно под конструкцией вместо ровной заливки. На эталоне пол
// студийный — к краям кадра он темнеет, и именно это отделяет сцену от фона, у которого тон
// тот же. Градиент рисуется в canvas один раз и растягивается на 15 единиц сцены; дальше
// текстура зажимается краевым пикселем, поэтому он обязан совпадать с цветом фона — иначе
// на стыке плиты с фоном появится видимое кольцо.
function useBackdrop() {
    return useMemo(() => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        g.addColorStop(0, "#fafbfc");
        g.addColorStop(0.45, "#f3f4f6");
        g.addColorStop(1, BG);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        const spread = 240 / 15;
        tex.repeat.set(spread, spread);
        tex.offset.set(-(spread - 1) / 2, -(spread - 1) / 2);
        return tex;
    }, []);
}

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
                <cylinderGeometry args={[PEDESTAL.radius, PEDESTAL.radius, PEDESTAL.height - PEDESTAL.chamfer, 48]} />
                <meshStandardMaterial color={PLASTER} roughness={0.82} metalness={0} />
            </mesh>
            {/* Фаска кромки. Отдельным конусом, а не скруглением геометрии: цилиндр в three
                фасок не умеет, а усечённый конус в 0.022 высотой даёт ровно ту светлую линию,
                которой на эталоне столешница отделена от боковой стенки. */}
            <mesh position={[0, PEDESTAL.height / 2 - PEDESTAL.chamfer / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[PEDESTAL.radius - PEDESTAL.chamfer, PEDESTAL.radius, PEDESTAL.chamfer, 48]} />
                <meshStandardMaterial color={PLASTER} roughness={0.82} metalness={0} />
            </mesh>
            {/* Бортик по краю столешницы: тор, выступающий над крышкой цилиндра ровно на свой
                малый радиус. Поле от этого оказывается утопленным, тумба читается блюдцем.
                Тором, а не открытым цилиндром: у открытого цилиндра нет верхней грани, и на
                просвет видно его изнанку. */}
            <mesh position={[0, PEDESTAL.height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <torusGeometry args={[PEDESTAL.radius - PEDESTAL.chamfer - PEDESTAL.lip, PEDESTAL.lip, 10, 64]} />
                <meshStandardMaterial color={PLASTER} roughness={0.82} />
            </mesh>

            {/* Кольцо цвета лежит на верхней кромке. Свечения нет намеренно: со свечением
                старший канал упирается в потолок, кольцо становится ровной полосой без
                светотени по окружности — на эталоне же она есть и заметная. */}
            <mesh position={[0, PEDESTAL.height / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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
            {/* Жила слегка светится — ровно настолько, чтобы блум дал вокруг неё цветную дымку,
                как на эталоне. Больше нельзя: на 1.0 канал упирается в потолок, цвет вымывается
                в белый, и вместо цветной линии выходит светлая царапина. Кольца на тумбах
                оставлены матовыми намеренно — там свечение съедало светотень по окружности. */}
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.5} />
        </mesh>
    );
}

// Маяк. Ярус светится, если уровень достигнут: сколько горит — там организация и стоит.
// Легенды не требует, и это главное, ради чего он в центре.
// Кольцо вертикальных стоек вокруг яруса. Ставится и на ярусы, и на фонарь, поэтому вынесено
// отдельно. Шесть ярусов по четырнадцать стоек — 84 меша, но сцена рисуется по запросу
// и стоит неподвижно, так что платит за них только подлёт камеры.
function Staves({ y, radius, height }) {
    const angles = useMemo(staveAngles, []);
    return angles.map((a) => (
        <mesh key={a} position={[Math.cos(a) * radius, y, Math.sin(a) * radius]} rotation={[0, -a, 0]}>
            <boxGeometry args={[TOWER.staveOut * 2, height, TOWER.staveWidth]} />
            <meshStandardMaterial color={PLASTER} emissive={GLOW} emissiveIntensity={0.12} roughness={0.8} />
        </mesh>
    ));
}

// Окна яруса. Две штуки на противоположных сторонах: одно всегда смотрит на камеру обзора,
// второе появляется при подлёте к дальнему лучу. Больше не нужно — на четырёх окнах ярус
// начинает выглядеть дырявым.
function Windows({ y, radius }) {
    return [Math.PI / 4, Math.PI * 1.25].map((a) => (
        <mesh key={a} position={[Math.cos(a) * radius, y, Math.sin(a) * radius]} rotation={[0, -a, 0]}>
            <boxGeometry args={[TOWER.windowDepth, TOWER.windowSize, TOWER.windowSize]} />
            <meshStandardMaterial color={PLASTER} roughness={0.8} />
        </mesh>
    ));
}

function Tower({ level }) {
    const stack = useMemo(tiers, []);
    const foot = useMemo(plinth, []);
    const c = useMemo(crown, []);
    const lanternOn = level >= LEVELS.length;
    return (
        <group>
            {/* Цоколь. Между двумя ступенями светящаяся щель: на эталоне свет у подножия
                выходит из-под маяка щелью, а сам цоколь остаётся белым. Щель горит всегда —
                нижний уровень шкалы это «маяк зажжён на один ярус», а не потухший маяк. */}
            <mesh position={[0, foot.bottom.y, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[foot.bottom.radius, foot.bottom.radius, foot.bottom.height, 48]} />
                <meshStandardMaterial color={PLASTER} roughness={0.82} />
            </mesh>
            <mesh position={[0, foot.glow.y, 0]}>
                <cylinderGeometry args={[foot.glow.radius, foot.glow.radius, foot.glow.height, 48]} />
                <meshStandardMaterial color={PLASTER} emissive={GLOW} emissiveIntensity={1.5 + level * 0.12} roughness={0.6} />
            </mesh>
            <mesh position={[0, foot.top.y, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[foot.top.radius, foot.top.radius, foot.top.height, 48]} />
                <meshStandardMaterial color={PLASTER} roughness={0.82} />
            </mesh>

            {stack.map((t) => {
                const on = t.level <= level;
                const wallHeight = t.height - TOWER.corniceHeight;
                const wallY = t.y - TOWER.corniceHeight / 2;
                return (
                    <group key={t.level}>
                        <mesh position={[0, wallY, 0]} castShadow receiveShadow>
                            <cylinderGeometry args={[t.rTop, t.rBottom, wallHeight, 40]} />
                            <meshStandardMaterial color={PLASTER} emissive={on ? GLOW : "#000000"} emissiveIntensity={on ? 2.1 : 0} roughness={0.72} />
                        </mesh>
                        {/* Вертикальные стойки по окружности. Стенка светится, стойки белые —
                            на этом контрасте ярус читается строением, а не лампой. */}
                        <Staves y={wallY} radius={(t.rTop + t.rBottom) / 2} height={wallHeight} />
                        <Windows y={wallY} radius={(t.rTop + t.rBottom) / 2} />
                        {/* Карниз на стыке ярусов. Без него шесть цилиндров сливаются в один
                            конус, и «шесть ярусов» перестаёт читаться. Стоит поверх стенки, а не
                            у нижней кромки: на эталоне обод венчает ярус и служит опорой
                            следующему, более узкому. */}
                        <mesh position={[0, t.y + t.height / 2 - TOWER.corniceHeight / 2, 0]} castShadow receiveShadow>
                            <cylinderGeometry args={[t.rTop * TOWER.corniceOut, t.rTop * TOWER.corniceOut, TOWER.corniceHeight, 40]} />
                            <meshStandardMaterial color={PLASTER} roughness={0.78} />
                        </mesh>
                    </group>
                );
            })}

            {/* Площадка галереи под фонарём. Радиус обязан превышать rTop, иначе диск
                прячется внутрь силуэта яруса и ступени не видно. */}
            <mesh position={[0, c.galleryY, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[TOWER.galleryRadius, TOWER.galleryRadius, TOWER.galleryHeight, 32]} />
                <meshStandardMaterial color={PLASTER} roughness={0.8} />
            </mesh>

            {/* Фонарь горит только на верхнем уровне: маяк заработал целиком. */}
            <mesh position={[0, c.lanternY, 0]} castShadow>
                <cylinderGeometry args={[TOWER.lanternRadius * 0.92, TOWER.lanternRadius, TOWER.lanternHeight, 24]} />
                <meshStandardMaterial
                    color={PLASTER}
                    emissive={lanternOn ? GLOW : "#000000"}
                    emissiveIntensity={lanternOn ? 2.8 : 0}
                    roughness={0.6}
                />
            </mesh>
            <Staves y={c.lanternY} radius={TOWER.lanternRadius * 0.96} height={TOWER.lanternHeight} />

            {/* Купол полусферический, не конус: конус на этом месте превращает маяк в ракету.
                Ободок под ним прячет стык купола с фонарём. */}
            <mesh position={[0, c.rimY, 0]} castShadow>
                <cylinderGeometry args={[TOWER.lanternRadius * 1.2, TOWER.lanternRadius * 1.2, TOWER.domeRim, 32]} />
                <meshStandardMaterial color={PLASTER} roughness={0.8} />
            </mesh>
            <mesh position={[0, c.domeBase, 0]} scale={[1, TOWER.domeSquash, 1]} castShadow>
                <sphereGeometry args={[c.domeRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color={PLASTER} roughness={0.78} />
            </mesh>

            {/* Шпиль: ножка, шар, остриё. На общем плане различим только силуэт, но без него
                купол выглядит срезанным. */}
            <mesh position={[0, c.stemY, 0]} castShadow>
                <cylinderGeometry args={[0.011, 0.013, TOWER.finialStem, 12]} />
                <meshStandardMaterial color={PLASTER} roughness={0.8} />
            </mesh>
            <mesh position={[0, c.ballY, 0]} castShadow>
                <sphereGeometry args={[TOWER.finialBall, 16, 12]} />
                <meshStandardMaterial color={PLASTER} roughness={0.78} />
            </mesh>
            <mesh position={[0, c.tipY, 0]} castShadow>
                <coneGeometry args={[0.014, TOWER.finialTip, 12]} />
                <meshStandardMaterial color={PLASTER} roughness={0.8} />
            </mesh>

            {/* Тёплая лужа света на платформе вокруг основания — она и делает «горит»
                событием сцены, а не покраской цилиндра. */}
            {/* После среза заливки та же мощность залила середину звезды тёплым пятном:
                лужа должна лежать у подножия, а не выбеливать половину платформы. */}
            <pointLight position={[0, 0.34 + level * 0.06, 0]} intensity={0.5 + level * 0.2} distance={2.1} decay={2.2} color={LIT} />
            {/* Второй тёплый источник — на середине горящей части ствола. Стойки и карнизы
                стоят снаружи стенки, свет изнутри до них не доходит, и при одном источнике
                у подножия верхние ярусы выходили серыми: конструкция темнее того, что она
                подсвечивает. Источник едет вверх вместе с уровнем — он и есть «свет из окон». */}
            <pointLight position={[0, TOWER.baseHeight + level * TOWER.tierHeight * 0.55, 0]} intensity={0.35 + level * 0.08} distance={1.5} decay={2} color={LIT} />
        </group>
    );
}

// children — точка вставки для того, что ставится НА платформу: предметы на тумбах.
// Сама платформа о них ничего не знает и знать не должна, поэтому они приходят снаружи,
// а не заводятся здесь. Добавка чисто аддитивная: без детей файл ведёт себя как прежде.
export default function Platform({ level = 1, ray = null, onPickRay = () => {}, children }) {
    const rayIndex = ray ? RAYS.findIndex((r) => r.id === ray) : null;
    const backdrop = useBackdrop();
    return (
        <Canvas
            // Сцена статична: кадр рисуется только по запросу от рига камеры.
            frameloop="demand"
            // Плотность вернулась к двум. Полтора ставили, когда сцена рисовалась в режиме
            // always и платила за плотность непрерывно; в demand кадр считается только пока
            // едет камера, а стоит гладкость кромок дорого: на 1.5 карнизы и стойки маяка
            // шли лесенкой, и вся аккуратность рендера уходила в неё.
            dpr={[1, 2]}
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
            gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 0.95 }}
        >
            {/* Свет студийный, но заливки заметно меньше, чем кажется правильным на слух.
                При прежней заливке гипс выходил светлее фона, а на эталоне он темнее фона —
                то есть объект тонул, а не стоял. Ключ поднят почти в зенит: шесть серых
                клякс, отъезжавших от тумб вбок, шли именно от низкого угла, на эталоне их
                нет ни у одной тумбы. Перепад «верх против боковой стенки» при этом растёт
                с 11 уровней до полусотни ещё до всякого AO. */}
            {/* Студийное окружение вместо голых источников. Эталон — продуктовый рендер:
                гипс там освещён со всех сторон отражённым светом, и потому остаётся белым
                даже в тени. У нас стоял один направленный ключ, и всё, что он не доставал —
                стойки, карнизы, изнанка тумб — уходило в серое; затенение эту серость ещё и
                удваивало, отчего сцена читалась пыльной.
                Окружение собрано из Lightformer прямо в сцене, а не взято пресетом: пресеты
                drei тянут HDRI из сети, а сцена обязана работать без неё. Считается один раз
                (frames по умолчанию), потом только читается. */}
            <Environment resolution={256}>
                {/* Софтбокс сверху — основной свет студии. */}
                <Lightformer form="rect" intensity={1.7} position={[0, 6, 1]} rotation={[-Math.PI / 2, 0, 0]} scale={[12, 12, 1]} />
                {/* Боковые заполняющие: они и делают белое белым в тенях. */}
                <Lightformer form="rect" intensity={0.7} position={[-7, 3, 3]} rotation={[0, -Math.PI / 3, 0]} scale={[8, 6, 1]} />
                <Lightformer form="rect" intensity={0.55} position={[7, 2.5, 2]} rotation={[0, Math.PI / 3, 0]} scale={[8, 6, 1]} />
                {/* Контровой сзади: отделяет силуэт от фона того же тона. */}
                <Lightformer form="rect" intensity={0.9} position={[0, 3, -8]} rotation={[0, Math.PI, 0]} scale={[10, 5, 1]} />
            </Environment>

            {/* Направленный оставлен только ради отбрасываемой тени: окружение теней не даёт.
                Мощность срезана втрое против прежней — теперь он рисует тень, а не освещает. */}
            <ambientLight intensity={0.12} />
            <directionalLight
                position={[-3.4, 15.5, 3.1]}
                intensity={1.35}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-radius={20}
                shadow-intensity={0.8}
                shadow-camera-left={-6}
                shadow-camera-right={6}
                shadow-camera-top={6}
                shadow-camera-bottom={-6}
                shadow-bias={-0.0004}
            />

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
            {children}
            <CameraRig ray={rayIndex} level={level} />

            {/* Мягкая тень под всей конструкцией: она отрывает звезду от фона. Без неё
                платформа висит в молоке. */}
            {/* Тень тёплая, а не серая. Холод у нас шёл от самого фона, и класть поверх
                холодную тень значило его удваивать: на эталоне тени тёплые. */}
            {/* Площадка тени вынесена далеко за кадр. При scale 11 её собственная кромка
                попадала в кадр и читалась светлым трапециевидным швом поперёк плиты —
                тот самый шов, который я сперва списал на карту теней и на плиту. */}
            {/* Тень двухслойная. Один мягкий слой давал ровное серое пятно: на эталоне у самой
                кромки тень заметно плотнее, а дальше растворяется. Плотный слой снят коротким
                far — он ловит только касание платформы и тумб, длинный отвечает за ореол.
                Оба стоят чуть на разной высоте: на одной прозрачные плоскости мерцают. */}
            <ContactShadows position={[0, -(STAR.thickness + STAR.bevel) - 0.02, 0]} opacity={0.34} scale={34} blur={5} far={3} resolution={2048} frames={1} color="#a09890" />
            <ContactShadows position={[0, -(STAR.thickness + STAR.bevel) - 0.015, 0]} opacity={0.5} scale={16} blur={1.1} far={0.55} resolution={2048} frames={1} color="#8d857b" />

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
                    Неосвещаемая заливка шва дать не может в принципе. */}
                <meshBasicMaterial map={backdrop} />
            </mesh>

            {/* Затенение в стыках. Белое на белом читается только им: без AO верхние грани
                выходили ровной заливкой, а место посадки тумбы на луч не читалось вовсе.
                Порядок важен — тонмаппинг последним, иначе блум работает по уже сжатому
                сигналу и порог не срабатывает. */}
            <EffectComposer disableNormalPass multisampling={4}>
                {/* Радиус срезан после появления стоек на маяке. Затенение экранное: оно не
                    различает, что под ним — стык или светящаяся стенка, и на широком радиусе
                    каждая стойка гасила свечение вокруг себя, из-за чего горящий ярус выходил
                    бледно-кремовым вместо тёплого. На узком радиусе AO остаётся там, ради чего
                    он и стоит, — в стыках тумб с платформой.
                    Качество поднято по той же причине: на дефолтном числе сэмплов частокол
                    стоек давал видимую зернистость по карнизам. */}
                <N8AO aoRadius={0.28} distanceFalloff={0.7} intensity={3} quality="high" color="#7a736a" />
                <Bloom intensity={0.55} luminanceThreshold={0.82} luminanceSmoothing={0.25} mipmapBlur />
                <ToneMapping mode={ToneMappingMode.NEUTRAL} />
            </EffectComposer>
        </Canvas>
    );
}

export { rayAngle };
