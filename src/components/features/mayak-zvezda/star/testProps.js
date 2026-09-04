"use client";

// Встроенные процедурные 3D-модели (Three.js) для 6 лучей Звезды зрелости:
// Контраст уровней:
//  - Уровень -1 (ИЦЗ -1, "Хаос"): аналоговый завал, бумага, картон, спутанные провода, навесной замок с паролем, ручной штамп.
//  - Уровень +4 (ИЦЗ +4, "Проактивность"): автопилот, свобода человека, работа на опережение.
//    Объекты парят в воздухе над тумбой (чистая левитация, y > 0.35, без ножек, экранов и офисных мониторов),
//    а по поверхности тумбы циклично расходятся опережающие волны радара.

import * as THREE from "three";

// Универсальный генератор опережающих волн радара на поверхности тумбы (уровень +4)
// Точно по эталонным рендерам: мягкое центральное пятно + концентрические световые кольца
function createProactiveWaves(color) {
    const group = new THREE.Group();

    // Мягкое светящееся пятно в центре тумбы
    const discMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(0, 0.003, 0);
    disc.userData = {
        onFrame: (node, time) => {
            node.material.opacity = 0.28 + Math.sin(time * 2.8) * 0.10;
        },
    };
    group.add(disc);

    // 3 тонких концентрических расходящихся кольца радара
    const waveRings = [0, 0.33, 0.66];
    waveRings.forEach((phaseOffset, idx) => {
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.20, 64), ringMat);
        ring.name = `waveRing_${idx}`;
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(0, 0.005, 0);
        ring.userData = {
            offset: phaseOffset,
            onFrame: (node, time) => {
                const progress = ((time * 0.65 + node.userData.offset) % 1);
                const s = 0.45 + progress * 2.0;
                node.scale.set(s, s, 1);
                node.material.opacity = Math.sin(progress * Math.PI) * 0.7;
            },
        };
        group.add(ring);
    });
    return group;
}

// Фабрика полупрозрачного цветного стекла музейного уровня (по рендерам Octane)
function createGlassMat(colorHex, emissiveHex = colorHex) {
    return new THREE.MeshPhysicalMaterial({
        color: colorHex,
        emissive: emissiveHex,
        emissiveIntensity: 0.22,
        roughness: 0.08,
        metalness: 0.05,
        transmission: 0.82,
        thickness: 0.60,
        ior: 1.52,
        transparent: true,
        opacity: 0.90,
        specularIntensity: 1.0,
    });
}

// Фабрика тонких ярких неоновых лазерных линий / траекторий
function createLaserMat(colorHex) {
    return new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: colorHex,
        emissiveIntensity: 2.3,
        roughness: 0.1,
    });
}

// Фабрика ослепительно сияющих сфер горизонта предикта / квантового ядра
function createOrbMat(colorHex) {
    return new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: colorHex,
        emissiveIntensity: 2.8,
        roughness: 0.05,
    });
}

// ----------------------------------------------------------------------------
// 1. ЛУЧ «ЗНАНИЯ И НАВЫКИ» (ACCENT: #e8a848)
// ----------------------------------------------------------------------------

// Уровень -1: Неровная стопка старых папок, раскрытая книга с закладкой, упавший лист
export function knowledgeChaos() {
    const g = new THREE.Group();

    const folder1Mat = new THREE.MeshStandardMaterial({ color: "#8c8275", roughness: 0.9, metalness: 0 });
    const folder2Mat = new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.88, metalness: 0.1 });
    const folder3Mat = new THREE.MeshStandardMaterial({ color: "#a88c68", roughness: 0.92, metalness: 0 });
    const bookCoverMat = new THREE.MeshStandardMaterial({ color: "#641e16", roughness: 0.85, metalness: 0.1 });
    const paperMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.95, metalness: 0 });
    const ribbonMat = new THREE.MeshStandardMaterial({ color: "#dc2626", roughness: 0.6, metalness: 0.2 });

    // Стопка папок
    const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.075, 0.40), folder1Mat);
    f1.position.set(-0.12, 0.038, -0.06);
    f1.rotation.y = 0.06;
    f1.castShadow = true;
    g.add(f1);

    const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.38), folder2Mat);
    f2.position.set(-0.10, 0.11, -0.05);
    f2.rotation.y = -0.10;
    f2.castShadow = true;
    g.add(f2);

    const f3 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.36), folder3Mat);
    f3.position.set(-0.13, 0.18, -0.07);
    f3.rotation.y = 0.14;
    f3.castShadow = true;
    g.add(f3);

    // Торчащий из папки лист
    const slip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.006, 0.24), paperMat);
    slip.position.set(0.04, 0.145, 0.05);
    slip.rotation.set(-0.06, 0.25, 0.12);
    slip.castShadow = true;
    g.add(slip);

    // Раскрытая старая книга рядом
    const bookGroup = new THREE.Group();
    bookGroup.position.set(0.18, 0.04, 0.14);
    bookGroup.rotation.y = -0.35;

    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.018, 0.34), bookCoverMat);
    leftWing.position.set(-0.11, 0.03, 0);
    leftWing.rotation.z = 0.22;
    leftWing.castShadow = true;
    bookGroup.add(leftWing);

    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.018, 0.34), bookCoverMat);
    rightWing.position.set(0.11, 0.03, 0);
    rightWing.rotation.z = -0.22;
    rightWing.castShadow = true;
    bookGroup.add(rightWing);

    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.035, 0.32), paperMat);
    pages.position.set(0, 0.025, 0);
    pages.castShadow = true;
    bookGroup.add(pages);

    // Красная ленточка-закладка (ляссе)
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.22), ribbonMat);
    ribbon.position.set(0.02, 0.05, 0.12);
    ribbon.rotation.set(0.15, -0.2, 0);
    bookGroup.add(ribbon);

    g.add(bookGroup);

    // Упавший на тумбу листок
    const drop = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.005, 0.18), paperMat);
    drop.position.set(-0.18, 0.004, 0.24);
    drop.rotation.set(0.01, 0.7, -0.01);
    drop.castShadow = true;
    g.add(drop);

    return g;
}

// Уровень +4: Восходящая спираль знаний (Ascending Knowledge Spiral)
// Точное соответствие эталонным рендерам (ChatGPT Image 14_23_45.png / 14_23_39.png):
// 5 парящих янтарных стеклянных сфер восходящего размера вдоль диагональной спирали,
// золотая неоновая лазерная нить и ослепительная вершина квантового озарения на вершине.
export function knowledgeProactive() {
    const g = new THREE.Group();
    const ACCENT = "#e8a848";

    // 1. Волны радара на тумбе
    g.add(createProactiveWaves(ACCENT));

    const amberGlassMat = new THREE.MeshPhysicalMaterial({
        color: "#f59e0b",
        emissive: "#d97706",
        emissiveIntensity: 0.40,
        roughness: 0.06,
        metalness: 0.05,
        transmission: 0.78,
        thickness: 0.65,
        ior: 1.54,
        transparent: true,
        opacity: 0.92,
        specularIntensity: 1.0,
    });
    const laserMat = createLaserMat("#fef08a");
    const beaconMat = createOrbMat("#ffffff");

    const groupSpheres = new THREE.Group();

    // 2. 5 парящих янтарных сфер восходящего размера (от малого внизу слева к крупному наверху справа)
    const sphereData = [
        { r: 0.048, x: 0.22, y: 0.26, z: 0.06 },
        { r: 0.068, x: 0.11, y: 0.35, z: 0.03 },
        { r: 0.090, x: 0.00, y: 0.45, z: 0.00 },
        { r: 0.114, x: -0.11, y: 0.56, z: -0.03 },
        { r: 0.140, x: -0.22, y: 0.68, z: -0.06 },
    ];

    sphereData.forEach((s, idx) => {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(s.r, 32, 32), amberGlassMat);
        mesh.position.set(s.x, s.y, s.z);
        mesh.userData = {
            baseY: s.y,
            index: idx,
            onFrame: (node, time) => {
                node.position.y = node.userData.baseY + Math.sin(time * 2.1 + node.userData.index * 0.55) * 0.014;
            },
        };
        groupSpheres.add(mesh);
    });

    // 3. Золотая лазерная нить-спираль, огибающая сферы
    const splinePoints = [
        new THREE.Vector3(0.28, 0.22, 0.10),
        new THREE.Vector3(0.22, 0.26, 0.06),
        new THREE.Vector3(0.11, 0.35, -0.04),
        new THREE.Vector3(0.00, 0.45, 0.05),
        new THREE.Vector3(-0.11, 0.56, -0.04),
        new THREE.Vector3(-0.18, 0.64, 0.04),
        new THREE.Vector3(-0.24, 0.74, -0.06),
    ];
    const laserCurve = new THREE.CatmullRomCurve3(splinePoints);
    const laserTube = new THREE.Mesh(new THREE.TubeGeometry(laserCurve, 64, 0.012, 12, false), laserMat);
    groupSpheres.add(laserTube);

    // 4. Ослепительно сияющая вершина озарения (Beacon of Mastery)
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.048, 24, 24), beaconMat);
    beacon.position.set(-0.24, 0.74, -0.06);
    beacon.userData = {
        onFrame: (node, time) => {
            const s = 1.0 + Math.sin(time * 4.0) * 0.12;
            node.scale.set(s, s, s);
        },
    };
    groupSpheres.add(beacon);

    // Плавное парение всей группы над тумбой
    groupSpheres.userData = {
        onFrame: (node, time) => {
            node.position.y = Math.sin(time * 1.9) * 0.022;
        },
    };
    g.add(groupSpheres);

    return g;
}

// ----------------------------------------------------------------------------
// 2. ЛУЧ «ВЗАИМОДЕЙСТВИЯ И СВЯЗИ» (ACCENT: #ce5f44)
// ----------------------------------------------------------------------------

// Уровень -1: Доска объявлений на кривых ножках с разноцветными стикерами, почтовый ящик
export function interactionChaos() {
    const g = new THREE.Group();

    const legMat = new THREE.MeshStandardMaterial({ color: "#6b4f35", roughness: 0.9, metalness: 0 });
    const boardMat = new THREE.MeshStandardMaterial({ color: "#bfa27a", roughness: 0.95, metalness: 0 });
    const frameMat = new THREE.MeshStandardMaterial({ color: "#4a3522", roughness: 0.85, metalness: 0.05 });
    const mailboxMat = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.8, metalness: 0.2 });
    const paperMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.95, metalness: 0 });

    // Стенд / доска
    const stand = new THREE.Group();
    stand.position.set(-0.06, 0, -0.06);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.62, 0.03), legMat);
    legL.position.set(-0.24, 0.31, 0);
    legL.castShadow = true;
    stand.add(legL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.62, 0.03), legMat);
    legR.position.set(0.24, 0.31, 0);
    legR.castShadow = true;
    stand.add(legR);

    const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.38, 0.025), frameMat);
    boardFrame.position.set(0, 0.44, 0);
    boardFrame.castShadow = true;
    stand.add(boardFrame);

    const cork = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.34, 0.028), boardMat);
    cork.position.set(0, 0.44, 0.002);
    cork.receiveShadow = true;
    stand.add(cork);

    // Стикеры
    const stickers = [
        { color: "#fef08a", x: -0.14, y: 0.49, rot: 0.09, w: 0.10, h: 0.11 },
        { color: "#fecdd3", x: 0.12, y: 0.42, rot: -0.15, w: 0.11, h: 0.09 },
        { color: "#f8fafc", x: -0.02, y: 0.45, rot: 0.05, w: 0.13, h: 0.15 },
        { color: "#bae6fd", x: 0.15, y: 0.51, rot: 0.18, w: 0.09, h: 0.08 },
    ];
    stickers.forEach((s) => {
        const sm = new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.9, metalness: 0 });
        const sticker = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, 0.005), sm);
        sticker.position.set(s.x, s.y, 0.02);
        sticker.rotation.z = s.rot;
        stand.add(sticker);
    });
    g.add(stand);

    // Механический почтовый ящик
    const mailbox = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.28, 0.16), mailboxMat);
    mailbox.position.set(0.28, 0.14, 0.14);
    mailbox.rotation.y = -0.4;
    mailbox.castShadow = true;
    g.add(mailbox);

    // Торчащий конверт
    const letter = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.006, 0.10), paperMat);
    letter.position.set(0.27, 0.24, 0.21);
    letter.rotation.set(0.35, -0.4, 0.1);
    letter.castShadow = true;
    g.add(letter);

    // Упавшее письмо на тумбу
    const droppedLetter = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.005, 0.11), paperMat);
    droppedLetter.position.set(0.10, 0.004, 0.26);
    droppedLetter.rotation.set(0.01, 0.6, -0.01);
    droppedLetter.castShadow = true;
    g.add(droppedLetter);

    return g;
}

// Уровень +4: Двойные резонансные кольца связи (Dual Resonance Rings)
// Музейный стиль рендеров: два парящих переплетенных тора из кораллового стекла,
// натянутые неоновые световые струны резонанса и парящая в фокусе сфера квантового консенсуса.
export function interactionProactive() {
    const g = new THREE.Group();
    const ACCENT = "#ce5f44";

    // 1. Волны радара на тумбе
    g.add(createProactiveWaves(ACCENT));

    const coralGlassMat = createGlassMat(ACCENT, "#991b1b");
    const laserMat = createLaserMat("#fca5a5");
    const orbMat = createOrbMat("#ffffff");

    const groupRings = new THREE.Group();

    // 2. Два переплетенных парящих тора из кораллового стекла
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.032, 24, 64), coralGlassMat);
    ring1.rotation.set(0.25, 0, 0.45);
    ring1.userData = {
        onFrame: (node, time) => {
            node.rotation.y = time * 0.45;
        },
    };
    groupRings.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.032, 24, 64), coralGlassMat);
    ring2.rotation.set(-0.25, 0, -0.45);
    ring2.userData = {
        onFrame: (node, time) => {
            node.rotation.y = -time * 0.45;
        },
    };
    groupRings.add(ring2);

    // 3. Лазерные световые струны резонанса между фокусами колец
    for (let i = 0; i < 6; i++) {
        const strGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.28, 8);
        const strMesh = new THREE.Mesh(strGeo, laserMat);
        strMesh.userData = {
            idx: i,
            onFrame: (node, time) => {
                const a = (node.userData.idx * Math.PI) / 3 + time * 0.4;
                node.position.set(Math.cos(a) * 0.16, Math.sin(a * 2) * 0.04, Math.sin(a) * 0.16);
                node.rotation.z = Math.sin(a) * 0.5;
                node.rotation.y = a;
            },
        };
        groupRings.add(strMesh);
    }

    // 4. Парящая сфера квантового консенсуса (Quantum Consensus Orb)
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.050, 24, 24), orbMat);
    orb.position.set(0, 0.12, 0);
    orb.userData = {
        onFrame: (node, time) => {
            const s = 1.0 + Math.sin(time * 3.5) * 0.10;
            node.scale.set(s, s, s);
            node.position.y = 0.12 + Math.sin(time * 2.5) * 0.015;
        },
    };
    groupRings.add(orb);

    // 5. Бегущие квантовые импульсы по контурам колец
    for (let i = 0; i < 3; i++) {
        const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.020, 16, 16), orbMat);
        pulse.userData = {
            offset: (i * Math.PI * 2) / 3,
            onFrame: (node, time) => {
                const a = node.userData.offset + time * 1.8;
                node.position.set(Math.cos(a) * 0.32, Math.sin(a) * 0.12, Math.sin(a) * 0.28);
            },
        };
        groupRings.add(pulse);
    }

    // Левитация всей композиции над тумбой (y ~ 0.50)
    groupRings.position.set(0, 0.50, 0);
    groupRings.userData = {
        onFrame: (node, time) => {
            node.position.y = 0.50 + Math.sin(time * 2.0) * 0.024;
        },
    };
    g.add(groupRings);

    return g;
}

// ----------------------------------------------------------------------------
// 3. ЛУЧ «ПРОСТРАНСТВО И ОБОРУДОВАНИЕ» (ACCENT: #a0c9d4)
// ----------------------------------------------------------------------------

// Уровень -1: Системный блок на боку, спутанный клубок черных кабелей, розетки, флешка
export function spaceChaos() {
    const g = new THREE.Group();

    const metalCaseMat = new THREE.MeshStandardMaterial({ color: "#22272e", roughness: 0.85, metalness: 0.3 });
    const cableMat1 = new THREE.MeshStandardMaterial({ color: "#111418", roughness: 0.95, metalness: 0.05 });
    const cableMat2 = new THREE.MeshStandardMaterial({ color: "#374151", roughness: 0.9, metalness: 0.05 });
    const powerStripMat = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.8, metalness: 0.1 });
    const usbMat = new THREE.MeshStandardMaterial({ color: "#0284c7", roughness: 0.5, metalness: 0.3 });

    // Поваленный на бок системный блок
    const pc = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.46, 0.44), metalCaseMat);
    pc.position.set(0.06, 0.11, -0.06);
    pc.rotation.set(0.04, 0.22, 1.54);
    pc.castShadow = true;
    g.add(pc);

    // Спутанный клубок кабелей
    const cables = [
        { r: 0.15, tube: 0.020, x: -0.20, y: 0.07, z: 0.10, rx: 1.2, ry: 0.4, rz: 0.8, mat: cableMat1 },
        { r: 0.18, tube: 0.018, x: -0.14, y: 0.09, z: 0.16, rx: 0.4, ry: 1.3, rz: -0.5, mat: cableMat2 },
        { r: 0.13, tube: 0.022, x: 0.16, y: 0.06, z: 0.20, rx: 1.5, ry: -0.6, rz: 0.2, mat: cableMat1 },
        { r: 0.11, tube: 0.016, x: -0.04, y: 0.12, z: 0.18, rx: -0.8, ry: 0.5, rz: 1.1, mat: cableMat2 },
    ];
    cables.forEach((c) => {
        const tor = new THREE.Mesh(new THREE.TorusGeometry(c.r, c.tube, 12, 32), c.mat);
        tor.position.set(c.x, c.y, c.z);
        tor.rotation.set(c.rx, c.ry, c.rz);
        tor.castShadow = true;
        g.add(tor);
    });

    // Сетевой фильтр с кривыми вилками
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.035, 0.30), powerStripMat);
    strip.position.set(-0.25, 0.018, -0.14);
    strip.rotation.y = 0.35;
    strip.castShadow = true;
    g.add(strip);

    // Забытая флешка
    const usb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.07), usbMat);
    usb.position.set(0.26, 0.008, 0.22);
    usb.rotation.y = -0.5;
    usb.castShadow = true;
    g.add(usb);

    return g;
}

// Уровень +4: Кристалл цифрового двойника и облачный маяк (Digital Twin Crystal & Cloud Beacon)
// Точное соответствие эталонным рендерам (ChatGPT Image 14_23_34.png / 14_23_35.png):
// Парящий граненый икосаэдр из аквамаринового стекла с внутренней сетью узлов,
// парящий над его вершиной сферический «облачный маяк» и наклонная лазерная спираль со спутниками.
export function spaceProactive() {
    const g = new THREE.Group();
    const ACCENT = "#a0c9d4";

    // 1. Волны радара на тумбе
    g.add(createProactiveWaves(ACCENT));

    const iceGlassMat = createGlassMat(ACCENT, "#0284c7");
    const laserMat = createLaserMat("#38bdf8");
    const orbMat = createOrbMat("#ffffff");
    const nodeMat = createLaserMat("#e0f2fe");

    const groupSpace = new THREE.Group();

    // 2. Парящий граненый кристаллический икосаэдр из стекла
    const icosahedron = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), iceGlassMat);
    icosahedron.position.set(0, 0.48, 0);
    icosahedron.userData = {
        onFrame: (node, time) => {
            node.rotation.y = time * 0.35;
            node.rotation.x = time * 0.20;
        },
    };
    groupSpace.add(icosahedron);

    // Тонкие световые ребра икосаэдра для подчеркивания кристаллических граней
    const wire = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.262, 0),
        new THREE.MeshBasicMaterial({ color: "#e0f2fe", wireframe: true, transparent: true, opacity: 0.65 })
    );
    wire.position.set(0, 0.48, 0);
    wire.userData = {
        onFrame: (node, time) => {
            node.rotation.y = time * 0.35;
            node.rotation.x = time * 0.20;
        },
    };
    groupSpace.add(wire);

    // 3. Внутренняя сеть связей и светящееся ядро цифрового двойника
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 20), laserMat);
    core.position.set(0, 0.48, 0);
    core.userData = {
        onFrame: (node, time) => {
            const s = 1.0 + Math.sin(time * 3.0) * 0.12;
            node.scale.set(s, s, s);
        },
    };
    groupSpace.add(core);

    // 4. Парящий над вершиной кристалла сферический «облачный маяк» (Cloud Beacon)
    const cloudBeaconGroup = new THREE.Group();
    cloudBeaconGroup.position.set(0, 0.80, 0);

    const beaconShell = new THREE.Mesh(
        new THREE.SphereGeometry(0.054, 24, 24),
        createGlassMat("#e0f2fe", "#38bdf8")
    );
    cloudBeaconGroup.add(beaconShell);

    // Внутреннее светящееся облачное ядро
    const cloudCore1 = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 16), orbMat);
    cloudCore1.position.set(-0.012, -0.005, 0);
    cloudBeaconGroup.add(cloudCore1);

    const cloudCore2 = new THREE.Mesh(new THREE.SphereGeometry(0.020, 16, 16), orbMat);
    cloudCore2.position.set(0.012, 0.005, 0);
    cloudBeaconGroup.add(cloudCore2);

    cloudBeaconGroup.userData = {
        onFrame: (node, time) => {
            node.position.y = 0.80 + Math.sin(time * 2.5) * 0.018;
            node.rotation.y = time * 0.5;
        },
    };
    groupSpace.add(cloudBeaconGroup);

    // 5. Наклонная неоновая спираль-орбита с микро-спутниками вокруг кристалла
    const spiralPts = [];
    for (let i = 0; i <= 36; i++) {
        const u = (i / 36) * Math.PI * 2.8;
        const rad = 0.38 - (i / 36) * 0.10;
        const x = Math.cos(u) * rad;
        const z = Math.sin(u) * rad;
        const y = 0.28 + (i / 36) * 0.52;
        spiralPts.push(new THREE.Vector3(x, y, z));
    }
    const spiralCurve = new THREE.CatmullRomCurve3(spiralPts);
    const spiralTube = new THREE.Mesh(new THREE.TubeGeometry(spiralCurve, 48, 0.006, 8, false), laserMat);
    groupSpace.add(spiralTube);

    // 3 микро-спутника инфраструктуры, обращающиеся по спирали
    for (let i = 0; i < 3; i++) {
        const sat = new THREE.Mesh(new THREE.SphereGeometry(0.020, 16, 16), orbMat);
        sat.userData = {
            offset: i / 3,
            onFrame: (node, time) => {
                const t = ((time * 0.25 + node.userData.offset) % 1);
                const pt = spiralCurve.getPoint(t);
                node.position.copy(pt);
            },
        };
        groupSpace.add(sat);
    }

    // Левитация всей композиции
    groupSpace.userData = {
        onFrame: (node, time) => {
            node.position.y = Math.sin(time * 1.8) * 0.022;
        },
    };
    g.add(groupSpace);

    return g;
}

// ----------------------------------------------------------------------------
// 4. ЛУЧ «БЕЗОПАСНОСТЬ И НАДЕЖНОСТЬ» (ACCENT: #90c843)
// ----------------------------------------------------------------------------

// Уровень -1: Чугунный замок на боку, стикер с паролем на замке, связка ключей
export function securityChaos() {
    const g = new THREE.Group();

    const ironMat = new THREE.MeshStandardMaterial({ color: "#272e38", roughness: 0.88, metalness: 0.3 });
    const shackleMat = new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 0.5, metalness: 0.7 });
    const stickerMat = new THREE.MeshStandardMaterial({ color: "#fef08a", roughness: 0.9, metalness: 0 });
    const keyMat = new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.4, metalness: 0.8 });

    // Корпус навесного замка
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.14), ironMat);
    body.position.set(-0.04, 0.14, 0);
    body.rotation.y = 0.25;
    body.castShadow = true;
    g.add(body);

    // Толстая металлическая дужка замка
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.034, 16, 32, Math.PI), shackleMat);
    shackle.position.set(-0.04, 0.28, 0);
    shackle.rotation.set(0, 0.25, Math.PI);
    shackle.castShadow = true;
    g.add(shackle);

    // Стикер с паролем прямо на корпусе замка
    const sticker = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.005), stickerMat);
    sticker.position.set(-0.02, 0.15, 0.075);
    sticker.rotation.set(0, 0.25, 0.08);
    g.add(sticker);

    // Связка ключей на тумбе
    const keyRing = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 12, 32), keyMat);
    keyRing.position.set(0.24, 0.012, 0.16);
    keyRing.rotation.x = Math.PI / 2;
    keyRing.castShadow = true;
    g.add(keyRing);

    for (let i = 0; i < 3; i++) {
        const key = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.006, 0.14), keyMat);
        key.position.set(0.24 + Math.cos(i * 0.7) * 0.06, 0.012, 0.16 + Math.sin(i * 0.7) * 0.06);
        key.rotation.y = i * 0.6;
        key.castShadow = true;
        g.add(key);
    }

    return g;
}

// Уровень +4: Квантовый гироскоп защиты (Quantum Gyroscope Shield)
// Точное соответствие эталонному рендеру (ChatGPT Image ... 14_23_30.png):
// Два массивных стеклянных кольца-гироскопа с изумрудными гранями (вертикальное и наклонное),
// парящий внутри граненый кристалл с сияющим контуром щита и внешняя неоновая орбита с бегущей сферой-стражем.
export function securityProactive() {
    const g = new THREE.Group();
    const ACCENT = "#90c843";

    // 1. Волны радара на тумбе
    g.add(createProactiveWaves(ACCENT));

    const emeraldGlassMat = createGlassMat(ACCENT, "#3f6212");
    const laserMat = createLaserMat("#a3e635");
    const shieldMat = createLaserMat("#bef264");
    const sentinelMat = createOrbMat("#ffffff");

    const groupShield = new THREE.Group();

    // 2. Первое массивное вертикальное стеклянное кольцо
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.034, 24, 64), emeraldGlassMat);
    ring1.userData = {
        onFrame: (node, time) => {
            node.rotation.y = time * 0.45;
        },
    };
    groupShield.add(ring1);

    // Второе массивное наклонное стеклянное кольцо
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.034, 24, 64), emeraldGlassMat);
    ring2.rotation.x = Math.PI / 2 - 0.20;
    ring2.userData = {
        onFrame: (node, time) => {
            node.rotation.z = -time * 0.40;
            node.rotation.x = Math.PI / 2 - 0.20 + Math.sin(time * 1.5) * 0.08;
        },
    };
    groupShield.add(ring2);

    // 3. Центральный граненый прозрачный кристалл
    const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), createGlassMat("#bef264", "#4d7c0f"));
    crystal.userData = {
        onFrame: (node, time) => {
            node.rotation.y = time * 0.7;
            node.rotation.x = time * 0.35;
        },
    };
    groupShield.add(crystal);

    // Внутренний сияющий неоновый щит (Shield Core)
    const shield = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), shieldMat);
    shield.userData = {
        onFrame: (node, time) => {
            const s = 1.0 + Math.sin(time * 3.5) * 0.12;
            node.scale.set(s, s, s);
            node.rotation.y = time * 0.9;
        },
    };
    groupShield.add(shield);

    // 4. Тонкая внешняя неоновая лазерная орбита стража
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.005, 12, 64), laserMat);
    orbit.rotation.set(0.35, 0.45, 0);
    orbit.userData = {
        onFrame: (node, time) => {
            node.rotation.z = time * 0.35;
        },
    };
    groupShield.add(orbit);

    // 5. Автономная сфера-страж (Sentinel Orb), непрерывно обращающаяся по орбите
    const sentinel = new THREE.Mesh(new THREE.SphereGeometry(0.036, 24, 24), sentinelMat);
    sentinel.userData = {
        onFrame: (node, time) => {
            const a = time * 2.0;
            const r = 0.44;
            const px = Math.cos(a) * r;
            const py = Math.sin(a) * r * Math.sin(0.45);
            const pz = Math.sin(a) * r * Math.cos(0.45);
            node.position.set(px, py, pz);
            const s = 1.0 + Math.sin(time * 5.0) * 0.12;
            node.scale.set(s, s, s);
        },
    };
    groupShield.add(sentinel);

    // Левитация всей композиции
    groupShield.position.set(0, 0.50, 0);
    groupShield.userData = {
        onFrame: (node, time) => {
            node.position.y = 0.50 + Math.sin(time * 2.0) * 0.024;
        },
    };
    g.add(groupShield);

    return g;
}

// ----------------------------------------------------------------------------
// 5. ЛУЧ «ДАННЫЕ И АНАЛИТИКА» (ACCENT: #0eb4ea)
// ----------------------------------------------------------------------------

// Уровень -1: Архивный картотечный шкаф с выдвинутым ящиком, выпадающими папками, упавшим документом
export function dataChaos() {
    const g = new THREE.Group();

    const cabinetMat = new THREE.MeshStandardMaterial({ color: "#2d333d", roughness: 0.88, metalness: 0.2 });
    const drawerMat = new THREE.MeshStandardMaterial({ color: "#373e4b", roughness: 0.85, metalness: 0.25 });
    const handleMat = new THREE.MeshStandardMaterial({ color: "#a8b0bd", roughness: 0.4, metalness: 0.8 });
    const paperMat = new THREE.MeshStandardMaterial({ color: "#f8f9fa", roughness: 0.95, metalness: 0 });
    const folderMat = new THREE.MeshStandardMaterial({ color: "#d8c7a5", roughness: 0.9, metalness: 0 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.96, 0.46), cabinetMat);
    body.position.set(0, 0.48, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const drawerYs = [0.15, 0.37, 0.59, 0.81];
    drawerYs.forEach((y, idx) => {
        const isExtended = idx === 2;
        const dz = isExtended ? 0.16 : 0;

        const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.19, isExtended ? 0.42 : 0.03), drawerMat);
        drawer.position.set(0, y, isExtended ? 0.23 + dz / 2 : 0.235);
        drawer.castShadow = true;
        drawer.receiveShadow = true;
        g.add(drawer);

        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.022, 0.02), handleMat);
        handle.position.set(0, y, isExtended ? 0.23 + dz + 0.015 : 0.255);
        handle.castShadow = true;
        g.add(handle);

        const labelPlate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.005), handleMat);
        labelPlate.position.set(0, y + 0.045, isExtended ? 0.23 + dz + 0.005 : 0.252);
        g.add(labelPlate);

        if (isExtended) {
            const folder = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.04), folderMat);
            folder.position.set(-0.04, y + 0.06, 0.32);
            folder.rotation.set(-0.25, 0.1, 0.05);
            folder.castShadow = true;
            g.add(folder);

            const hangingSheet = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.008, 0.28), paperMat);
            hangingSheet.position.set(0.08, y + 0.09, 0.42);
            hangingSheet.rotation.set(0.42, -0.15, -0.1);
            hangingSheet.castShadow = true;
            g.add(hangingSheet);
        }
    });

    const topStack = [
        { w: 0.38, h: 0.04, d: 0.32, y: 0.98, rot: 0.04, dx: -0.04, dz: 0.02 },
        { w: 0.36, h: 0.038, d: 0.3, y: 1.02, rot: -0.09, dx: -0.02, dz: 0.04 },
    ];
    for (const f of topStack) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(f.w, f.h, f.d), folderMat);
        m.position.set(f.dx, f.y, f.dz);
        m.rotation.y = f.rot;
        m.castShadow = true;
        g.add(m);
    }

    const floorSheet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.006, 0.24), paperMat);
    floorSheet.position.set(0.34, 0.005, 0.18);
    floorSheet.rotation.set(0.01, 0.45, -0.02);
    floorSheet.castShadow = true;
    floorSheet.receiveShadow = true;
    g.add(floorSheet);

    return g;
}

// Уровень +4: Предиктивная призма данных (Predictive Data Sculpture)
// Точное соответствие эталонному рендеру (ChatGPT Image 14_18_17.png):
// 5 парящих вертикальных призм из полупрозрачного цианового стекла, расположенных по восходящей дуге,
// плавно изгибающаяся над ними неоновая лазерная линия и ослепительно сияющая сфера горизонта событий будущего.
export function dataProactive() {
    const g = new THREE.Group();
    const ACCENT = "#0eb4ea";

    // 1. Волны радара на тумбе
    g.add(createProactiveWaves(ACCENT));

    const cyanGlassMat = createGlassMat(ACCENT, "#0284c7");
    const laserMat = createLaserMat("#5cf1ff");
    const orbMat = createOrbMat("#ffffff");

    const groupData = new THREE.Group();

    // 2. 5 парящих полупрозрачных призм данных по восходящей изогнутой кривой
    const barConfigs = [
        { h: 0.14, x: -0.26, z: 0.05 },
        { h: 0.24, x: -0.13, z: 0.01 },
        { h: 0.36, x:  0.00, z: -0.01 },
        { h: 0.50, x:  0.13, z: 0.01 },
        { h: 0.65, x:  0.25, z: 0.05 },
    ];

    barConfigs.forEach((cfg, idx) => {
        const barGeo = new THREE.BoxGeometry(0.068, cfg.h, 0.068);
        const barMesh = new THREE.Mesh(barGeo, cyanGlassMat);
        barMesh.position.set(cfg.x, 0.40 + cfg.h / 2, cfg.z);
        barMesh.userData = {
            baseH: cfg.h,
            baseX: cfg.x,
            baseZ: cfg.z,
            idx,
            onFrame: (node, time) => {
                const pulse = Math.sin(time * 2.5 + node.userData.idx * 0.7) * 0.015;
                node.position.y = 0.40 + node.userData.baseH / 2 + pulse;
            },
        };
        groupData.add(barMesh);
    });

    // 3. Плавная неоновая лазерная дуга предикта, проходящая над призмами ввысь
    const arcPoints = [
        new THREE.Vector3(-0.31, 0.44, 0.07),
        new THREE.Vector3(-0.26, 0.40 + 0.14 + 0.04, 0.05),
        new THREE.Vector3(-0.13, 0.40 + 0.24 + 0.04, 0.01),
        new THREE.Vector3( 0.00, 0.40 + 0.36 + 0.04, -0.01),
        new THREE.Vector3( 0.13, 0.40 + 0.50 + 0.04, 0.01),
        new THREE.Vector3( 0.25, 0.40 + 0.65 + 0.04, 0.05),
        new THREE.Vector3( 0.34, 0.40 + 0.79, 0.08),
    ];
    const arcCurve = new THREE.CatmullRomCurve3(arcPoints);
    const arcTube = new THREE.Mesh(new THREE.TubeGeometry(arcCurve, 64, 0.007, 12, false), laserMat);
    groupData.add(arcTube);

    // 4. Ослепительно сияющая сфера горизонта будущего (Future Prediction Orb)
    const futureOrb = new THREE.Mesh(new THREE.SphereGeometry(0.048, 24, 24), orbMat);
    futureOrb.position.set(0.34, 0.40 + 0.79, 0.08);
    futureOrb.userData = {
        onFrame: (node, time) => {
            const s = 1.0 + Math.sin(time * 4.2) * 0.14;
            node.scale.set(s, s, s);
            node.position.y = 0.40 + 0.79 + Math.sin(time * 2.8) * 0.012;
        },
    };
    groupData.add(futureOrb);

    // Левитация всей композиции
    groupData.userData = {
        onFrame: (node, time) => {
            node.position.y = Math.sin(time * 2.0) * 0.022;
        },
    };
    g.add(groupData);

    return g;
}

// ----------------------------------------------------------------------------
// 6. ЛУЧ «АВТОМАТИЗАЦИЯ И ПРОЦЕССЫ» (ACCENT: #245a94)
// ----------------------------------------------------------------------------

// Уровень -1: Гора картонных коробок, механический канцелярский штамп с деревянной ручкой, штемпельная подушка
export function automationChaos() {
    const g = new THREE.Group();

    const boxMat1 = new THREE.MeshStandardMaterial({ color: "#9e815c", roughness: 0.92, metalness: 0 });
    const boxMat2 = new THREE.MeshStandardMaterial({ color: "#b0936f", roughness: 0.90, metalness: 0 });
    const tapeMat = new THREE.MeshStandardMaterial({ color: "#785532", roughness: 0.6, metalness: 0.1 });
    const stampBaseMat = new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.4, metalness: 0.8 });
    const stampWoodMat = new THREE.MeshStandardMaterial({ color: "#78350f", roughness: 0.7, metalness: 0.1 });
    const padCaseMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.8, metalness: 0.2 });
    const inkMat = new THREE.MeshStandardMaterial({ color: "#1e3a8a", roughness: 0.95, metalness: 0 });

    // Коробка 1 (большая внизу)
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 0.38), boxMat1);
    b1.position.set(-0.06, 0.14, -0.06);
    b1.rotation.y = 0.12;
    b1.castShadow = true;
    g.add(b1);

    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.282, 0.382), tapeMat);
    tape.position.set(-0.06, 0.14, -0.06);
    tape.rotation.y = 0.12;
    g.add(tape);

    // Коробка 2 (сверху со сдвигом)
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.28), boxMat2);
    b2.position.set(-0.04, 0.39, -0.04);
    b2.rotation.y = -0.22;
    b2.castShadow = true;
    g.add(b2);

    // Приоткрытый клапан коробки
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.008, 0.26), boxMat2);
    flap.position.set(0.11, 0.52, -0.06);
    flap.rotation.set(0.1, -0.22, 0.45);
    g.add(flap);

    // Механический ручной штамп
    const stampGroup = new THREE.Group();
    stampGroup.position.set(0.24, 0, 0.16);

    const stampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 24), stampBaseMat);
    stampBase.position.set(0, 0.015, 0);
    stampBase.castShadow = true;
    stampGroup.add(stampBase);

    const stampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.12, 16), stampWoodMat);
    stampStem.position.set(0, 0.085, 0);
    stampStem.castShadow = true;
    stampGroup.add(stampStem);

    const stampKnob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), stampWoodMat);
    stampKnob.position.set(0, 0.15, 0);
    stampKnob.castShadow = true;
    stampGroup.add(stampKnob);

    g.add(stampGroup);

    // Штемпельная чернильная подушечка
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.13), padCaseMat);
    pad.position.set(-0.20, 0.012, 0.22);
    pad.rotation.y = 0.32;
    pad.castShadow = true;
    g.add(pad);

    const ink = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.026, 0.10), inkMat);
    ink.position.set(-0.20, 0.014, 0.22);
    ink.rotation.y = 0.32;
    g.add(ink);

    return g;
}

// Параметрическая кривая 3D-петли бесконечности / ленты Мёбиуса
class LemniscateCurve extends THREE.Curve {
    constructor(scale = 0.40, h1 = 0.06, h2 = 0.08) {
        super();
        this.scale = scale;
        this.h1 = h1;
        this.h2 = h2;
    }
    getPoint(t, opt = new THREE.Vector3()) {
        const u = t * Math.PI * 2;
        const denom = 1 + Math.sin(u) * Math.sin(u);
        const x = (this.scale * Math.cos(u)) / denom;
        const z = (this.scale * Math.sin(u) * Math.cos(u) * 1.5) / denom;
        const y = Math.cos(u) * this.h1 + Math.sin(2 * u) * this.h2;
        return opt.set(x, y, z);
    }
}

// Уровень +4: Петля бесконечности процессов (Infinite Autopilot Loop)
// Точное соответствие эталонному рендеру (ChatGPT Image ... 14_23_51.png):
// Парящая объемная лента Мёбиуса / петля бесконечности из сапфирового стекла (символ вечного автопилота),
// яркая неоновая лазерная световая линия внутри желоба и ослепительно сияющая сфера AI-оркестратора на верхнем пике.
export function automationProactive() {
    const g = new THREE.Group();
    const ACCENT = "#245a94";

    // 1. Волны радара на тумбе
    g.add(createProactiveWaves(ACCENT));

    const sapphireGlassMat = createGlassMat(ACCENT, "#1e40af");
    const laserMat = createLaserMat("#60a5fa");
    const orbMat = createOrbMat("#ffffff");

    const groupLoop = new THREE.Group();

    const loopCurve = new LemniscateCurve(0.40, 0.06, 0.08);

    // 2. Объемная трубка петли бесконечности из сапфирового стекла
    const glassTube = new THREE.Mesh(
        new THREE.TubeGeometry(loopCurve, 80, 0.044, 24, true),
        sapphireGlassMat
    );
    groupLoop.add(glassTube);

    // 3. Неоновая лазерная световая нить, бегущая внутри стеклянной петли
    const laserTube = new THREE.Mesh(
        new THREE.TubeGeometry(loopCurve, 80, 0.008, 12, true),
        laserMat
    );
    groupLoop.add(laserTube);

    // 4. Ослепительно сияющая сфера AI-оркестратора (Predictive AI Orchestrator Orb)
    // Размещена на верхнем правом пике петли (t ~ 0.125)
    const peakPos = loopCurve.getPoint(0.125);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.052, 24, 24), orbMat);
    orb.position.set(peakPos.x, peakPos.y + 0.045, peakPos.z);
    orb.userData = {
        baseY: peakPos.y + 0.045,
        onFrame: (node, time) => {
            const s = 1.0 + Math.sin(time * 3.8) * 0.12;
            node.scale.set(s, s, s);
            node.position.y = node.userData.baseY + Math.sin(time * 2.5) * 0.012;
        },
    };
    groupLoop.add(orb);

    // 5. Бегущие световые фотоны задач вдоль бесконечного контура
    for (let i = 0; i < 3; i++) {
        const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.020, 16, 16), orbMat);
        pulse.userData = {
            offset: i / 3,
            onFrame: (node, time) => {
                const t = ((time * 0.35 + node.userData.offset) % 1);
                const pt = loopCurve.getPoint(t);
                node.position.copy(pt);
            },
        };
        groupLoop.add(pulse);
    }

    // Левитация и наклон петли к зрителю (для наилучшей видимости двойного кольца)
    groupLoop.position.set(0, 0.48, 0);
    groupLoop.rotation.set(-0.35, 0.15, 0);
    groupLoop.userData = {
        onFrame: (node, time) => {
            node.position.y = 0.48 + Math.sin(time * 2.0) * 0.024;
            node.rotation.z = Math.sin(time * 1.5) * 0.06;
        },
    };
    g.add(groupLoop);

    return g;
}

// ----------------------------------------------------------------------------
// СОВМЕСТИМОСТЬ
// ----------------------------------------------------------------------------
export function paperStack() {
    return knowledgeChaos();
}

export const TEST_PROPS = {
    paper: paperStack,
    knowledgeChaos,
    knowledgeProactive,
    interactionChaos,
    interactionProactive,
    spaceChaos,
    spaceProactive,
    securityChaos,
    securityProactive,
    dataChaos,
    dataProactive,
    automationChaos,
    automationProactive,
};
