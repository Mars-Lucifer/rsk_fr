"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei/core/ContactShadows";
import { Environment } from "@react-three/drei/core/Environment";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { useGLTF } from "@react-three/drei/core/Gltf";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, SMAA, TiltShift2, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

import { CLOTH, HEMI_SKY, LIGHT, OWN_PROPS, PRELOAD, ROOM, SCREEN_ON, SHELL_TINT, kitUrl, sceneProps, scenePeople } from "./model/rooms.mjs";

// Комната-диорама в шести состояниях. Мебель — готовые модели Kenney Furniture Kit (CC0):
// лепить мебель примитивами это верстать сайт, рисуя буквы полигонами.
//
// Приёмы движения взяты из соседнего направления (Meeples3D.js): цель хранится в ref, обход
// в useFrame, кламп delta. React при этом не перерисовывается ни разу за такт — меняются
// только цели, и меняются раз в несколько секунд.
//
// Чего здесь намеренно нет:
//   frameloop='demand' вместе с догоном по большому delta. В demand-режиме fiber отдаёт delta
//   равным всей длине простоя, и любой такт, запущенный после кадра покоя в 4 секунды, на
//   первом же кадре телепортировал бы людей в конечные точки. Берём обычный always и кламп:
//   после возврата из фоновой вкладки предметы доезжают, а не прыгают.
//
//   SoftShadows из drei. Он патчит шейдер, и на программном OpenGL патч не компилируется
//   молча, без ошибки в консоли: всё, у чего включены тени, просто перестаёт рисоваться.
//   На программный рендер откатываются и headless-браузер, и машины без нормального GPU.

const ISO = Math.atan(Math.sin(Math.PI / 4)); // 35.264°, настоящая изометрия

const STEP_SECONDS = 0.7; // столько едет предмет или человек до своей точки
const HOP = 0.035; // предмет несут, а не тащат по полу
// Где вещь оказывается в руках несущего. Высота подобрана кадром под рост манекена: предмет
// держат перед собой на уровне пояса, и он не закрывает голову — модель растёт вверх от своей
// опорной точки, поэтому число здесь не «центр вещи», а её низ.
const CARRY = [0, 0.33, 0.2];
const STACK = 0.06; // шаг стопки, если вещей у человека несколько

// Цвет светящегося проёма, выведенный за единицу: так окно доживает до Bloom как источник,
// а не как светлая заплатка.
const PANE = new THREE.Color("#ffd9a8").multiplyScalar(2.6);

const mix = (a, b, t) => a + (b - a) * t;
// Кадронезависимое приближение: доля, которая остаётся за секунду, возводится в степень delta.
const approach = (current, target, delta, rate = 6) => mix(current, target, 1 - Math.exp(-rate * delta));

PRELOAD.forEach((name) => useGLTF.preload(kitUrl(name)));

// Модель из набора. Клонируем сцену на каждый экземпляр — один и тот же Object3D нельзя
// разместить в двух местах, он просто уедет в последнее.
//
// Опорная точка у моделей набора — угол, а не центр: floorFull занимает x 0..1 и z −1..0.
// Поэтому каждая модель центруется по горизонтали при загрузке и сажается на пол. После этого
// координата в раскладке означает «центр предмета на полу», и смещения не нужны.
function useKitObject(name, tint) {
    const { scene } = useGLTF(kitUrl(name));
    return useMemo(() => {
        const clone = scene.clone(true);
        const box = new THREE.Box3().setFromObject(clone);
        clone.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
        clone.traverse((node) => {
            if (!node.isMesh) return;
            // Стекло тени не отбрасывает. Это не косметика: стекло в оконной раме набора писало
            // в карту глубины, и ключевой луч не проходил в комнату вообще — пятна света на полу
            // не было ни при какой позиции источника. Проверяется кадром: пятно на полу либо есть,
            // либо его нет, промежуточных состояний тут не бывает.
            node.castShadow = node.material?.name !== "glass";
            node.receiveShadow = true;
            if (!tint) return;
            // Материал у клона общий с оригиналом: перекраска без копии залила бы цветом все
            // экземпляры модели разом.
            node.material = node.material.clone();
            node.material.color = new THREE.Color(tint);
        });
        const holder = new THREE.Group();
        holder.add(clone);
        return holder;
    }, [scene, tint]);
}

function Kit({ name, position, rotation = 0, tint }) {
    const object = useKitObject(name, tint);
    return <primitive object={object} position={position} rotation={[0, rotation, 0]} />;
}

// Предмет, которого в наборе нет. Своя геометрия только там, где без неё нельзя: офисной
// техники крупнее монитора в наборе Kenney не существует, а серверная стойка нужна с
// четвёртого уровня.
function OwnProp({ name }) {
    const spec = OWN_PROPS[name];
    return (
        <mesh position={[0, spec.size[1] / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={spec.size} />
            <meshStandardMaterial color={spec.color} roughness={0.55} metalness={0.25} />
        </mesh>
    );
}

// Светящаяся плоскость поверх экрана. Включение сделано подменой не материала модели, а
// отдельной плоскостью: материал модели общий на все экземпляры, и его правка засветила бы
// оба экрана разом. Bloom в цепочке уже стоит и сам даст свечение.
// Координаты локальные: модель внутри группы стоит основанием в нуле, а высоту предмета над
// полом задаёт сама группа. Проверено кадром: с абсолютной высотой свечение уезжало вдвое выше
// экрана. Поворот вынесен в обёртку — иначе смещение вперёд не поворачивается вместе с моделью,
// и у экрана на боковой стене плашка висит сбоку.
function ScreenGlow({ rotation }) {
    return (
        <group rotation={[0, rotation, 0]}>
            <mesh position={[0, 0.115, 0.037]}>
                <planeGeometry args={[0.3, 0.17]} />
                <meshBasicMaterial color="#cfe6ff" toneMapped={false} />
            </mesh>
        </group>
    );
}

// Предмет сцены. Едет к своей цели сам: цель приходит пропсом и меняется раз в такт, а
// движение живёт в useFrame и React не трогает.
//
// Три состояния, ради которых всё и написано:
//   обычное  — стоит на месте;
//   в руках  — цель считается от позиции несущего каждый кадр;
//   уносят   — доезжает до урны и гаснет масштабом.
function Prop({ prop, people, glow }) {
    const group = useRef();
    const shrink = useRef(1);
    const target = useMemo(() => new THREE.Vector3(), []);
    const start = prop.at;

    useFrame((_, rawDelta) => {
        const node = group.current;
        if (!node) return;
        const delta = Math.min(rawDelta, 1 / 30);

        if (prop.carrier != null && people.current[prop.carrier]) {
            const carrier = people.current[prop.carrier];
            // Стопка в руках: несколько вещей у одного человека расходятся по высоте, иначе
            // читаются одним предметом.
            target.set(carrier.x + CARRY[0], CARRY[1] + (prop.stack ?? 0) * STACK, carrier.z + CARRY[2]);
        } else {
            target.set(prop.at[0], prop.at[1], prop.at[2]);
        }

        node.position.x = approach(node.position.x, target.x, delta);
        node.position.z = approach(node.position.z, target.z, delta);
        node.position.y = approach(node.position.y, target.y, delta);

        // Дуга шага: пока предмет далеко от цели, он чуть приподнят. Так видно, что его несут,
        // а не тянут по полу.
        const away = Math.hypot(node.position.x - target.x, node.position.z - target.z);
        node.position.y += Math.min(away, 0.3) * HOP;

        const wanted = prop.fade || (prop.gone && prop.carrier == null && away < 0.12) ? 0 : 1;
        shrink.current = approach(shrink.current, wanted, delta, 5);
        node.scale.setScalar(Math.max(shrink.current, 0.0001));
    });

    return (
        <group ref={group} position={start}>
            {OWN_PROPS[prop.name] ? (
                <OwnProp name={prop.name} />
            ) : (
                <Kit name={prop.name} position={[0, 0, 0]} rotation={prop.spin ?? 0} tint={prop.tint} />
            )}
            {glow ? <ScreenGlow rotation={prop.spin ?? 0} /> : null}
        </group>
    );
}

// Кольцо под предметом выбранного луча. Подсветка сделана кольцом, а не перекраской предмета:
// перекраска требует копии материала на каждый экземпляр, а на плоской заливке набора ещё и
// вымывает цвет. Кольцо читается на изометрии лучше подсветки — оно лежит на полу.
function RayRing({ at }) {
    return (
        <mesh position={[at[0], 0.058, at[2]]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.17, 0.21, 32]} />
            <meshBasicMaterial color="#d9a441" toneMapped={false} transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
    );
}

// Человек. Ригованный манекен из Universal Animation Library Quaternius (CC0), лежит в
// public/zvezda-people. Своя геометрия из коробок отсюда убрана: у неё не было ни рук, ни кистей,
// и на общем плане это читалось как мебель, а не как люди.
//
// Манекен безликий, и это ровно то, что нужно: как только у фигуры появляется лицо, диорама
// превращается в мультфильм, а смотреть надо на предметы — меняются они.
//
// Почему именно этот набор: в нём есть клипы, которых нет ни у Kenney, ни в остальных
// бесплатных пакетах, — Sitting_Idle_Loop и PickUp_Table. Офисная сцена без сидения
// не собирается вовсе, а готовых «сидящих» персонажей CC0 в открытом доступе нет.
const PEOPLE_URL = "/zvezda-people/people.gltf";

// Модель ростом 1.83 в своих единицах, у нас единица набора примерно два метра: столешница
// 0.384 это 77 см. Отсюда множители — калибруются кадром, не выводятся.
//
// Рост у троих разный. Полоса ±7 %: дальше фигура видимо висит над сиденьем, потому что поза
// сидя рассчитана на конкретную высоту стула. Три одинаковые фигуры читаются как копии одного
// человека, и это заметнее любой нехватки полигонов.
const PERSON_SCALE = [0.44, 0.47, 0.5];

// ponytail: грузим библиотеку целиком — 46 клипов, в ходу шесть. Резать её нужно gltf-transform,
// это разовый прогон через npx без добавления зависимости. Замерено gzip -9: gltf жмётся
// 2.4 МБ → 90 КБ, bin 1.55 МБ → 934 КБ, по проводу около 1 МБ. Резка до двенадцати клипов
// снимет примерно 450 КБ. Пока загрузка не мешает — не окупает работу.
const CLIP = {
    sit: "Sitting_Idle_Loop",
    stand: "Idle_Loop",
    talk: "Idle_Talking_Loop",
    // Походка разная: у одного строевая, у двоих обычная. На общем плане именно характер
    // движения отличает людей друг от друга — не лицо и не одежда.
    walk: ["Walk_Loop", "Walk_Formal_Loop", "Walk_Loop"],
};

useGLTF.preload(PEOPLE_URL);

function Person({ seat, look, cloth, index, people, pose }) {
    const group = useRef();
    const facing = useRef(0);
    const playing = useRef(null);
    const { scene, animations } = useGLTF(PEOPLE_URL);

    // SkeletonUtils.clone, а не scene.clone: обычный клон копирует меш, но оставляет привязку
    // к скелету оригинала, и все три фигуры начинают повторять движения одной.
    const object = useMemo(() => {
        const copy = cloneSkinned(scene);
        copy.traverse((node) => {
            if (!node.isMesh && !node.isSkinnedMesh) return;
            node.castShadow = true;
            node.receiveShadow = true;
            node.frustumCulled = false; // скиннинг двигает вершины за пределы исходного габарита
            // Материал общий на все клоны, поэтому перекраска без копии одела бы всех одинаково.
            node.material = node.material.clone();
            // У манекена два материала: тело и суставы. Суставы в исходнике ярко-сиреневые —
            // это отладочный цвет автора, в кадре он читается как подсветка и тянет взгляд.
            //
            // Красим их не в отдельный тон кожи, а в затемнённый цвет одежды: на светлой фигуре
            // контрастные суставы рассыпаются в крапины и силуэт разваливается, а нужен цельный
            // силуэт — на общем плане читается он, а не детали.
            const own = new THREE.Color(cloth);
            if (node.material.name === "M_Joints") own.offsetHSL(0, -0.04, -0.13);
            node.material.color = own;
            node.material.roughness = 0.85;
        });
        return copy;
    }, [scene, cloth]);

    const mixer = useMemo(() => new THREE.AnimationMixer(object), [object]);
    const actions = useMemo(() => {
        const map = {};
        for (const clip of animations) map[clip.name] = mixer.clipAction(clip);
        return map;
    }, [animations, mixer]);

    useEffect(() => () => mixer.stopAllAction(), [mixer]);

    useFrame((_, rawDelta) => {
        const node = group.current;
        if (!node) return;
        const delta = Math.min(rawDelta, 1 / 30);

        const nextX = approach(node.position.x, seat[0], delta, 5);
        const nextZ = approach(node.position.z, seat[2], delta, 5);
        const moved = Math.hypot(nextX - node.position.x, nextZ - node.position.z);
        node.position.x = nextX;
        node.position.z = nextZ;

        // Смотрит по ходу, а стоя — на заданную точку. Доворот плавный: мгновенный разворот
        // читается как подмена фигуры.
        const goal = moved > 1e-4 ? Math.atan2(seat[0] - node.position.x, seat[2] - node.position.z) : look ? Math.atan2(look[0] - node.position.x, look[2] - node.position.z) : facing.current;
        // Кратчайшая сторона: без нормализации фигура разворачивается через всю комнату.
        let diff = ((goal - facing.current + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (diff < -Math.PI) diff += Math.PI * 2;
        facing.current += diff * (1 - Math.exp(-8 * delta));
        node.rotation.y = facing.current;

        // Идёт — шагает, дошёл — принимает позу такта. Порог по пройденному за кадр, а не по
        // расстоянию до цели: лерп подползает к точке бесконечно, и по расстоянию фигура
        // топталась бы на месте до конца такта.
        const wanted = moved > 0.0012 ? CLIP.walk[index % CLIP.walk.length] : CLIP[pose];
        if (wanted !== playing.current && actions[wanted]) {
            const next = actions[wanted];
            next.reset();
            // Сдвиг по фазе и по темпу — после reset(), он обнуляет время. Без этого трое
            // дышат, переминаются и жестикулируют синхронно, и группа читается как один
            // человек, размноженный трижды.
            next.time = (index * 0.9) % (next.getClip().duration || 1);
            next.timeScale = 0.92 + index * 0.08;
            next.fadeIn(0.3).play();
            if (actions[playing.current]) actions[playing.current].fadeOut(0.3);
            playing.current = wanted;
        }
        mixer.update(delta);

        // Позиция публикуется наружу: по ней предметы считают, где рука несущего.
        people.current[index] = { x: node.position.x, z: node.position.z };
    });

    return (
        <group ref={group} position={seat} scale={PERSON_SCALE[index % PERSON_SCALE.length]}>
            <primitive object={object} />
        </group>
    );
}

// Корпус: плитки пола по сетке, две стены по дальним кромкам. Угловой элемент набора не нужен —
// стены стоят в плоскостях кромок и стыкуются сами.
//
// Корпус смонтирован ОТДЕЛЬНО от уровневой группы и не перемонтируется никогда: если рамка
// поплывёт, зритель прочитает смену картинки, а не изменение одной комнаты.
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
                <Kit key={`l${z}`} name={z === ROOM.windowLeft ? "wallWindow" : "wall"} position={[-edge, 0, z]} rotation={Math.PI / 2} tint={SHELL_TINT.wallWindow} />
            ))}
            {/* Светящийся проём. Без него окно было бы чёрным — снаружи комнаты ничего нет,
                отражать свету нечего.

                Размер и высота взяты из самой модели рамы: подсетка проёма 0.3746 × 0.6641,
                узел смещён на 0.3927, значит проём занимает 0.393…1.057 по высоте с центром
                на 0.725. Прежние 0.52 × 0.66 на высоте 0.63 были шире и ниже настоящего.

                Цвет умножен на 2.6 и выведен за единицу намеренно: буфер композитора
                полуплавающий, значения выше 1.0 доживают до Bloom, и окно становится
                единственным настоящим источником в кадре. */}
            <mesh position={[-edge + 0.04, 0.725, ROOM.windowLeft]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[0.375, 0.664]} />
                <meshBasicMaterial color={PANE} toneMapped={false} />
            </mesh>
        </group>
    );
}

// Свет едет к уровню, а не переключается. Именно сдвиг температуры читается как «поднялись»
// сильнее, чем смена мониторов, — и рывок в нём заметнее всего.
function Lighting({ level, bloomRef }) {
    const key = useRef();
    const fill = useRef();
    const hemi = useRef();
    const env = useRef();
    const { gl } = useThree();
    const colour = useMemo(() => new THREE.Color(), []);
    const start = LIGHT[level] ?? LIGHT[1];

    useFrame((_, rawDelta) => {
        const delta = Math.min(rawDelta, 1 / 30);
        const want = LIGHT[level] ?? LIGHT[1];
        const rate = 1 - Math.exp(-4 * delta);

        if (key.current) {
            // Цвет ведём в линейном пространстве целиком: покомпонентный lerp по каналам врёт
            // на тёплых оттенках и даёт грязный промежуточный цвет.
            colour.set(want.key);
            key.current.color.lerp(colour, rate);
            key.current.intensity = approach(key.current.intensity, want.keyIntensity, delta, 4);
        }
        if (fill.current) {
            colour.set(want.fill);
            fill.current.color.lerp(colour, rate);
            fill.current.intensity = approach(fill.current.intensity, want.fillIntensity, delta, 4);
        }
        // Полусфера меняется шагом: на ней рывок не виден, а лерп стоил бы третьего ref.
        if (hemi.current) hemi.current.intensity = want.hemi;
        if (env.current) env.current.environmentIntensity = approach(env.current.environmentIntensity ?? want.env, want.env, delta, 4);
        gl.toneMappingExposure = approach(gl.toneMappingExposure, want.exposure, delta, 4);
        if (bloomRef.current) bloomRef.current.intensity = approach(bloomRef.current.intensity, want.bloom, delta, 4);
    });

    return (
        <>
            {/* Ключ идёт сквозь окно и даёт единственную резкую тень. Позиция ниже прежней:
                высота 25°, чтобы луч прошёл в проём и лёг пятном на пол между столами, а не
                светил в комнату сверху. На стену с окном он не попадает никогда — она
                контражурная, и в эталонных кадрах она и есть тёмная. */}
            <directionalLight
                ref={key}
                // Высота 42°, а не 25°. Считается, а не подбирается: комната без потолка, стена
                // высотой 1.29 стоит на 1.5 от центра, поэтому луч попадает на пол только при
                // наклоне круче 1.29/1.5 = 0.86, то есть 40.7°. На 25° стена перехватывала свет
                // целиком — замер показал пол ровным на всей площади, без единого пятна.
                position={[-6.2, 5.6, 1.5]}
                color={start.key}
                intensity={start.keyIntensity}
                castShadow
                // 2048, а не 4096: карта перерисовывается каждый кадр, потому что люди ходят,
                // и на интегрированной графике вчетверо больший таргет виден сразу. Фрустум
                // сжат с ±3.5 до ±2.6 — плотность растёт с 293 до 394 текселей на единицу
                // бесплатно, комната в него укладывается целиком.
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-2.6}
                shadow-camera-right={2.6}
                shadow-camera-top={2.6}
                shadow-camera-bottom={-2.6}
                shadow-camera-near={0.1}
                shadow-camera-far={18}
                shadow-bias={-0.0009}
                shadow-normalBias={0.025}
                // radius и intensity бесплатны: ветка PCF всё равно делает пять отсчётов по
                // диску, radius лишь разводит их шире, а intensity поднимает тень от чёрного.
                shadow-radius={4}
                shadow-intensity={0.85}
            />

            {/* Заливка. Холодная, без тени, светит вдоль +Z — именно она разводит две видимые
                стены по яркости. Без неё обе освещены только картой окружения и сливаются
                в одну плоскость: замер давал 1.07 при норме 1.5–1.7. */}
            <directionalLight ref={fill} position={[2.2, 3, 7.5]} color={start.fill} intensity={start.fillIntensity} castShadow={false} />

            {/* Отскок. Настоящего отражённого света в реальном времени нет, полусфера его
                подделывает: небо холодное сверху, земля цвета пола снизу. */}
            <hemisphereLight ref={hemi} color={HEMI_SKY} groundColor={SHELL_TINT.floor} intensity={start.hemi} />

            <Environment ref={env} files={kitUrl("interior")} environmentIntensity={start.env} />
        </>
    );
}

// Зум считается от размера вьюпорта, а не зашит числом: на телефоне фиксированный зум обрезает
// комнату до одного стола, и это не видно, пока не снимешь кадр в мобильном размере.
function Framing() {
    const { camera, size } = useThree();
    useEffect(() => {
        // Делитель подобран кадром: при /5 нижний угол комнаты уходит под подпись такта.
        const fit = Math.min(size.width, size.height * 1.6) / 5.4;
        camera.zoom = THREE.MathUtils.clamp(fit, 110, 320);
        camera.updateProjectionMatrix();
    }, [camera, size.width, size.height]);
    return null;
}

function Room({ level, phase, ray, waypoint }) {
    const people = useRef([{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }]);
    const props = useMemo(() => sceneProps(level, phase, waypoint), [level, phase, waypoint]);
    const crowd = useMemo(() => scenePeople(level, phase), [level, phase]);
    const screenOn = SCREEN_ON[phase === "mind" ? level + 1 : level] ?? false;
    // Поза такта. В «Среде» люди сидят как сидели — в этом весь смысл фазы: вещь привезли,
    // работают по-старому. В «Сознании» стоят и разговаривают: норма вырабатывается вместе.
    const pose = phase === "activity" ? "stand" : phase === "mind" ? "talk" : "sit";

    return (
        <group>
            {crowd.map((person, index) => (
                <Person
                    key={index}
                    index={index}
                    people={people}
                    cloth={CLOTH[index]}
                    // В первой половине такта «Деятельность» человек идёт к привезённому, во
                    // второй возвращается на место. Две точки вместо очереди шагов: очередь
                    // здесь была бы механизмом ради одного случая.
                    seat={person.pickup && waypoint === 0 ? person.pickup : person.seat}
                    look={person.look}
                    pose={pose}
                />
            ))}
            {props.map((prop) => (
                <Prop key={prop.key} prop={prop} people={people} glow={screenOn && prop.name === "televisionModern"} />
            ))}
            {ray ? props.filter((prop) => prop.ray === ray).map((prop) => <RayRing key={`r${prop.key}`} at={prop.at} />) : null}
            <ContactShadows position={[0, 0.055, 0]} scale={ROOM.tiles * 1.8} resolution={1024} blur={2.2} opacity={0.5} far={1.4} color="#1a1206" />
        </group>
    );
}

export default function Scene({ level = 1, phase = "rest", ray = null, waypoint = 1 }) {
    const bloomRef = useRef();
    const [ready, setReady] = useState(false);
    const light = LIGHT[level] ?? LIGHT[1];

    return (
        <Canvas
            // Тип теней задан явно. По умолчанию fiber ставит PCFSoftShadowMap, а three его уже
            // объявил устаревшим и молча подменяет на PCFShadowMap — с предупреждением в консоль
            // на каждую пересборку карты. За минуту истории набегает три десятка строк, и на их
            // фоне не видно настоящих ошибок.
            shadows={{ type: THREE.PCFShadowMap }}
            dpr={[1, 2]}
            orthographic
            camera={{ position: [9, 9 * Math.tan(ISO) * Math.SQRT2, 9], zoom: 288, near: -40, far: 80 }}
            gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: light.exposure, antialias: false }}
            onCreated={({ camera }) => {
                camera.lookAt(0, 0.62, 0);
                setReady(true);
            }}>
            <color attach="background" args={["#0b0b0b"]} />
            <Framing />

            <Suspense fallback={null}>
                <Lighting level={level} bloomRef={bloomRef} />
                <Shell />
                <Room level={level} phase={phase} ray={ray} waypoint={waypoint} />
            </Suspense>

            {/* Постобработка — то, чем «прототип игры» отличается от диорамы, и геометрия тут
                почти ни при чём. Порядок важен, эффекты складываются в один проход.

                N8AO — затенение в стыках: без него предметы выглядят приклеенными к полу.
                TiltShift2 — размытие по краям, именно оно читается как «макет».
                SMAA обязателен: аппаратное сглаживание с затенением не работает, поэтому у
                Canvas antialias выключен, а multisampling композитора равен нулю.

                Насыщенность и контраст меняются шагом, а не лерпом: рывок в них на смене
                уровня незаметен, а тянуть их через ref означало бы лезть в устройство эффекта. */}
            {ready ? (
                <EffectComposer multisampling={0}>
                    <N8AO aoRadius={0.3} distanceFalloff={0.6} intensity={3.4} halfRes color="#140c05" />
                    <Bloom ref={bloomRef} intensity={light.bloom} luminanceThreshold={0.72} luminanceSmoothing={0.3} mipmapBlur />
                    <TiltShift2 blur={0.13} />
                    <HueSaturation saturation={light.saturation} />
                    <BrightnessContrast contrast={light.contrast} />
                    <Vignette offset={0.4} darkness={0.5} />
                    <SMAA />
                </EffectComposer>
            ) : null}

            <OrbitControls target={[0, 0.62, 0]} enablePan={false} minZoom={110} maxZoom={520} minPolarAngle={0.35} maxPolarAngle={1.35} />
        </Canvas>
    );
}
