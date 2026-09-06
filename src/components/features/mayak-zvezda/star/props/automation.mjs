// Предметы луча «Автоматизация» по шести уровням зрелости.
//
// Луч про то, кто выполняет работу. Внизу её выполняет рука: коробки, штамп, чернильная
// подушка. Дальше от уровня к уровню исполнитель уходит из кадра, а на его месте появляется
// механизм: сначала табло, которое просто светит номер, потом терминал, который отвечает,
// потом башня роботов, выдающая заверенный результат без человека, потом маршрутизатор,
// который сам решает, куда направить задачу, и наконец петля автопилота, работающая до запроса.
// Силуэт идёт «куча → плита → стойка → башня → парящий узел → парящая петля»: уровень видно
// раньше, чем читается любая деталь.

import * as THREE from "three";

import {
    CARDBOARD,
    GRAPHITE,
    PAPER,
    castAll,
    glassMat,
    laserMat,
    matteMat,
    metalMat,
    orbMat,
    plasticMat,
    proactiveWaves,
    screenMat,
    spin,
} from "./shared.mjs";

const ACCENT = "#245a94";
// Акцент луча тёмный, на белом гипсе он проваливается в пятно. Всё, что должно светиться,
// берёт светлый производный тон, а сам акцент остаётся в корпусах и стекле.
const ACCENT_LIGHT = "#60a5fa";
const ACCENT_MID = "#2563eb";

// Уровень −1 собирался до общего габарита и вылезал за поле тумбы на считанные миллиметры.
// Форма у него утверждена, поэтому правится не геометрия, а общий множитель: силуэт,
// пропорции и цвет остаются теми же. У петли +4 общего множителя больше нет — он ужимал её
// до нечитаемости; её размер задан прямо в LOOP_SCALE ниже.
const CHAOS_FIT = 0.93;

// ---------------------------------------------------------------------------
// −1 «Хаос». Перенос automationChaos из testProps.js: гора картонных коробок,
// механический штамп с деревянной ручкой, штемпельная подушка.
// ---------------------------------------------------------------------------
export function automation1() {
    const g = new THREE.Group();

    const boxMat1 = matteMat("#9e815c", 0.92);
    const boxMat2 = matteMat("#b0936f", 0.9);
    const tapeMat = plasticMat("#785532", 0.6);
    const stampBaseMat = metalMat(GRAPHITE, 0.4);
    const stampWoodMat = matteMat("#78350f", 0.7);
    const padCaseMat = plasticMat("#1e293b", 0.8);
    const inkMat = matteMat("#1e3a8a", 0.95);

    // Коробка 1 (большая внизу)
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 0.38), boxMat1);
    b1.position.set(-0.06, 0.14, -0.06);
    b1.rotation.y = 0.12;
    g.add(b1);

    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.282, 0.382), tapeMat);
    tape.position.set(-0.06, 0.14, -0.06);
    tape.rotation.y = 0.12;
    g.add(tape);

    // Коробка 2 (сверху со сдвигом)
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.28), boxMat2);
    b2.position.set(-0.04, 0.39, -0.04);
    b2.rotation.y = -0.22;
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
    stampGroup.add(stampBase);

    const stampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.12, 16), stampWoodMat);
    stampStem.position.set(0, 0.085, 0);
    stampGroup.add(stampStem);

    const stampKnob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), stampWoodMat);
    stampKnob.position.set(0, 0.15, 0);
    stampGroup.add(stampKnob);

    g.add(stampGroup);

    // Штемпельная чернильная подушечка
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.13), padCaseMat);
    pad.position.set(-0.2, 0.012, 0.22);
    pad.rotation.y = 0.32;
    g.add(pad);

    const ink = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.026, 0.1), inkMat);
    ink.position.set(-0.2, 0.014, 0.22);
    ink.rotation.y = 0.32;
    g.add(ink);

    g.scale.setScalar(CHAOS_FIT);
    return castAll(g);
}

// ---------------------------------------------------------------------------
// 0 «Информирование». Стопка регламентов, на ней плашмя лежит табло электронной
// очереди: один номер светит в зал и ничего не ждёт в ответ.
// ---------------------------------------------------------------------------
export function automation2() {
    const g = new THREE.Group();

    // Регламенты: две папки одна на другой, ещё бумажные и матовые.
    const folder1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.032, 0.28), matteMat(PAPER));
    folder1.position.set(0, 0.016, 0);
    folder1.rotation.y = -0.08;
    g.add(folder1);

    const spine1 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.034, 0.282), matteMat(CARDBOARD));
    spine1.position.set(-0.176, 0.017, 0);
    spine1.rotation.y = -0.08;
    g.add(spine1);

    const folder2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.028, 0.24), matteMat("#e2e8f0"));
    folder2.position.set(0.01, 0.046, 0.01);
    folder2.rotation.y = 0.11;
    g.add(folder2);

    const spine2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.242), matteMat("#94a3b8"));
    spine2.position.set(-0.147, 0.046, 0.028);
    spine2.rotation.y = 0.11;
    g.add(spine2);

    // Табло: единственная цифровая деталь предмета — плоский корпус и мёртвый номер.
    const panel = new THREE.Group();
    panel.position.set(0.015, 0.066, 0.005);
    panel.rotation.y = 0.05;

    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.014, 0.15), plasticMat("#2b3440"));
    panel.add(shell);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.005, 0.115), screenMat(ACCENT_MID, 0.75));
    glass.position.y = 0.0095;
    panel.add(glass);

    // Номер очереди: три светящихся бруска, ровно один канал в одну сторону.
    [-0.06, 0, 0.06].forEach((x, i) => {
        const digit = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.005, 0.06 - i * 0.012), laserMat(ACCENT_LIGHT));
        digit.position.set(x, 0.013, 0);
        panel.add(digit);
    });

    g.add(panel);

    return castAll(g);
}

// ---------------------------------------------------------------------------
// +1 «Транзакция». Две стороны и обмен между ними: слева круглая тумба заявителя
// со щелью отправки, справа гранёный корпус ведомства с лотком и приёмной щелью,
// над ними две встречные световые дуги со стрелками.
//
// Силуэт нарочно парный, широкий и низкий: на кадре первым читается «их двое и
// между ними ходит», а не корпус с экраном — экрана здесь нет вовсе.
// ---------------------------------------------------------------------------
export function automation3() {
    const g = new THREE.Group();

    const light = laserMat(ACCENT_LIGHT);

    // --- Сторона заявителя: круглая тумба со скруглённым верхом.
    const footA = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.034, 28), metalMat("#8ea3b8"));
    footA.position.set(-0.28, 0.017, 0);
    g.add(footA);

    const bodyA = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.19, 28), plasticMat(ACCENT, 0.5));
    bodyA.position.set(-0.28, 0.129, 0);
    g.add(bodyA);

    // Пояс: он же скругление стыка корпуса с крышкой.
    const beltA = new THREE.Mesh(new THREE.TorusGeometry(0.101, 0.011, 10, 28), metalMat("#cbd5e1"));
    beltA.position.set(-0.28, 0.222, 0);
    beltA.rotation.x = Math.PI / 2;
    g.add(beltA);

    const capA = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), plasticMat("#dbe4ee", 0.4));
    capA.position.set(-0.28, 0.224, 0);
    capA.scale.y = 0.42;
    g.add(capA);

    // Щель отправки: обращение уходит от заявителя.
    const slotA = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.014, 0.016), light);
    slotA.position.set(-0.245, 0.175, 0.098);
    slotA.rotation.y = -0.24;
    g.add(slotA);

    // --- Сторона ведомства: гранёный корпус с лотком приёма.
    const footB = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.032, 0.22), metalMat("#7d8fa3"));
    footB.position.set(0.28, 0.016, 0);
    g.add(footB);

    const bodyB = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.19, 0.19), plasticMat("#334155", 0.5));
    bodyB.position.set(0.28, 0.127, 0);
    g.add(bodyB);

    // Фаски передних вертикальных рёбер: без них корпус читается голой коробкой.
    [-0.125, 0.125].forEach((dx) => {
        const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.19, 12), metalMat("#a9b8c8"));
        edge.position.set(0.28 + dx, 0.127, 0.095);
        g.add(edge);
    });

    const corniceB = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.024, 0.21), metalMat("#8ea3b8"));
    corniceB.position.set(0.28, 0.234, 0);
    g.add(corniceB);

    // Лоток приёма со светящейся кромкой: сюда ложится то, что пришло.
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.022, 0.075), plasticMat("#cbd5e1", 0.5));
    tray.position.set(0.28, 0.093, 0.126);
    g.add(tray);

    const trayEdge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.007, 0.009), light);
    trayEdge.position.set(0.28, 0.106, 0.161);
    g.add(trayEdge);

    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.014), plasticMat("#0f172a", 0.7));
    intake.position.set(0.28, 0.168, 0.094);
    g.add(intake);

    // --- Обмен: две дуги в разные стороны, каждая со своей стрелкой и пакетом.
    const arcOut = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.009, 10, 40, Math.PI), light);
    arcOut.position.set(0, 0.24, 0.06);
    arcOut.scale.set(1, 0.5, 1);
    g.add(arcOut);

    const tipOut = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.062, 14), light);
    tipOut.position.set(0.19, 0.286, 0.06);
    tipOut.rotation.z = -Math.PI / 2 - 0.55;
    g.add(tipOut);

    const packOut = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.032), orbMat("#ffffff"));
    packOut.position.set(-0.04, 0.348, 0.06);
    packOut.rotation.set(0.4, 0.5, 0.2);
    g.add(packOut);

    const arcBack = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.007, 10, 40, Math.PI), laserMat("#bfdbfe"));
    arcBack.position.set(0, 0.2, -0.07);
    arcBack.scale.set(1, 0.45, 1);
    g.add(arcBack);

    const tipBack = new THREE.Mesh(new THREE.ConeGeometry(0.023, 0.056, 14), laserMat("#bfdbfe"));
    tipBack.position.set(-0.173, 0.238, -0.07);
    tipBack.rotation.z = Math.PI / 2 + 0.55;
    g.add(tipBack);

    const packBack = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.026), orbMat("#ffffff"));
    packBack.position.set(0.07, 0.278, -0.07);
    packBack.rotation.set(0.3, -0.4, 0.25);
    g.add(packBack);

    return castAll(g);
}

// ---------------------------------------------------------------------------
// +2 «Электронный результат». Одно цельное тело: гранёная колонна-кристалл со
// светящейся жилой внутри, а над её остриём — отдельно выданная электронная
// печать, поднятая на луче. Тело одно, деталь выдачи одна, обмена нет: результат
// уже произведён.
// ---------------------------------------------------------------------------
export function automation4() {
    const g = new THREE.Group();

    const crystal = glassMat("#2f6fb5", ACCENT_MID);
    const light = laserMat(ACCENT_LIGHT);

    // Шестигранная пята с фаской: колонна вырастает из поля, а не поставлена на него.
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.2, 0.034, 6), metalMat("#8ea3b8"));
    foot.position.y = 0.017;
    g.add(foot);

    const chamfer = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.178, 0.026, 6), metalMat("#cbd5e1"));
    chamfer.position.y = 0.047;
    g.add(chamfer);

    // Ствол-призма: одно тело на всю высоту, без стыков и без экрана.
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.35, 6), crystal);
    shaft.position.y = 0.235;
    g.add(shaft);

    // Остриё: та же призма, сведённая в грань. Силуэт кристалла, а не коробки.
    const apex = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.16, 0.1, 6), crystal);
    apex.position.y = 0.46;
    g.add(apex);

    // Рёбра трёх передних граней: вблизи именно они делают тело гранёным.
    [-Math.PI / 3, 0, Math.PI / 3].forEach((a) => {
        const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.35, 8), metalMat("#dbe4ee"));
        edge.position.set(Math.sin(a) * 0.158, 0.235, Math.cos(a) * 0.158);
        g.add(edge);
    });

    // Жила внутри: процесс идёт в теле, наружу выходит только результат.
    const vein = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.33, 12), light);
    vein.position.y = 0.235;
    g.add(vein);

    // Пояса-ступени: три такта обработки по высоте ствола.
    [0.12, 0.235, 0.35].forEach((y) => {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.166, 0.166, 0.011, 6), light);
        band.position.y = y;
        g.add(band);
    });

    // Луч выдачи: печать держится им, а не подставкой.
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.09, 10), light);
    beam.position.y = 0.545;
    g.add(beam);

    // Отдельная деталь: выданная электронная печать, повёрнутая гранью к зрителю.
    const seal = new THREE.Group();
    seal.position.set(0, 0.6, 0.012);
    seal.rotation.set(Math.PI / 2, 0, 0.22);

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.02, 6), glassMat("#3f7fc4", ACCENT_LIGHT));
    seal.add(disc);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.008, 8, 6), light);
    rim.rotation.x = Math.PI / 2;
    seal.add(rim);

    const tickShort = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.013, 0.01), laserMat("#eff6ff"));
    tickShort.position.set(-0.026, 0.013, -0.011);
    tickShort.rotation.z = 0.85;
    seal.add(tickShort);

    const tickLong = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.013, 0.01), laserMat("#eff6ff"));
    tickLong.position.set(0.016, 0.013, 0.011);
    tickLong.rotation.z = -0.75;
    seal.add(tickLong);

    g.add(seal);

    return castAll(g);
}

// ---------------------------------------------------------------------------
// +3 «Интеллект». Узел интеллектуальной маршрутизации: ядро оторвалось от поля,
// вокруг — орбиты и маршруты задач, вся сборка медленно поворачивается.
// ---------------------------------------------------------------------------
export function automation5() {
    const g = new THREE.Group();

    const lift = new THREE.Group();
    lift.position.y = 0.42;

    const core = new THREE.Group();

    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.078, 32, 24), glassMat(ACCENT, "#1e40af"));
    core.add(shell);

    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.034, 24, 16), orbMat("#ffffff"));
    heart.userData = {
        onFrame: (node, time) => {
            const s = 1 + Math.sin(time * 3.1) * 0.13;
            node.scale.set(s, s, s);
        },
    };
    core.add(heart);

    const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.0085, 8, 48), laserMat(ACCENT_LIGHT));
    orbit.rotation.set(-1.15, 0.0, 0.0);
    core.add(orbit);

    const orbit2 = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.006, 8, 48), laserMat("#bfdbfe"));
    orbit2.rotation.set(0.9, 0.6, 0.0);
    core.add(orbit2);

    // Маршруты: четыре разнонаправленных плеча с узлами на концах. Длина разная —
    // маршрутизация не симметрична, она выбирает.
    const routes = [
        [0.0, 0.42, 0.18],
        [1.7, -0.3, 0.2],
        [3.1, 0.15, 0.15],
        [4.6, -0.55, 0.19],
    ];
    routes.forEach(([yaw, pitch, len]) => {
        const dir = new THREE.Vector3(
            Math.cos(pitch) * Math.cos(yaw),
            Math.sin(pitch),
            Math.cos(pitch) * Math.sin(yaw)
        );

        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, len, 8), laserMat(ACCENT_LIGHT));
        arm.position.copy(dir.clone().multiplyScalar(len / 2 + 0.06));
        arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        core.add(arm);

        const node = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), orbMat("#ffffff"));
        node.position.copy(dir.clone().multiplyScalar(len + 0.06));
        core.add(node);
    });

    spin(core, 0.32);
    lift.add(core);
    g.add(lift);

    return castAll(g);
}

// ---------------------------------------------------------------------------
// +4 «Проактивность». Перенос automationProactive из testProps.js: парящая петля
// бесконечности из сапфирового стекла, лазерная нить внутри, сфера AI-оркестратора
// и опережающие волны по полю тумбы.
// ---------------------------------------------------------------------------

// Параметрическая кривая 3D-петли бесконечности / ленты Мёбиуса.
//
// Ширина петли доведена до габарита тумбы (LOOP_SCALE + радиус трубки чуть меньше 0.55),
// высота собственного контура прижата множителем LOOP_RISE: лежачая «восьмёрка» пропорций
// 1:1.6 на кадре читалась парой тёмных очков, а не знаком. Подъём y задан через sin(u), а не
// cos: только он разводит две ветви в точке пересечения — при cos обе ветви приходят в центр
// на одной высоте, и узел вырождается в кляксу.
const LOOP_SCALE = 0.485;
const LOOP_RISE = 1.1;
const LOOP_TWIST = 0.05;
// Наклон плоскости петли. Камера луча стоит на 22° выше тумбы и смотрит вдоль локальной оси
// +Z (Props.js разворачивает предмет к ней), поэтому плоскость поднимается почти в вертикаль:
// нормаль ложится ровно на камеру, и петля видна собственным силуэтом, а не проекцией.
const LOOP_TILT = Math.PI / 2 - 0.384;
const LOOP_Y = 0.645;

class LemniscateCurve extends THREE.Curve {
    constructor(scale = LOOP_SCALE, rise = LOOP_RISE, twist = LOOP_TWIST) {
        super();
        this.scale = scale;
        this.rise = rise;
        this.twist = twist;
    }

    getPoint(t, opt = new THREE.Vector3()) {
        const u = t * Math.PI * 2;
        const denom = 1 + Math.sin(u) * Math.sin(u);
        const x = (this.scale * Math.cos(u)) / denom;
        const z = (this.scale * Math.sin(u) * Math.cos(u) * this.rise) / denom;
        const y = Math.sin(u) * this.twist;
        return opt.set(x, y, z);
    }
}

export function automation6() {
    const g = new THREE.Group();

    // 1. Волны радара на тумбе — единственное плоское пятно на всей сцене и признак только
    // этого уровня: система действует до запроса.
    g.add(proactiveWaves(ACCENT));

    // Стекло взято светлее акцента: тёмно-синяя трубка на белом гипсе тонет, и петля
    // пропадает раньше, чем её успевают прочитать.
    const sapphire = glassMat("#3f7fc4", ACCENT_LIGHT);
    const neon = laserMat(ACCENT_LIGHT);
    const glow = orbMat("#ffffff");

    const groupLoop = new THREE.Group();

    const loopCurve = new LemniscateCurve();

    // 2. Светлая окантовка: оболочка на полсантиметра толще трубки, видимая изнутри.
    // Она рисует контур петли ореолом и держит знак читаемым на белом фоне.
    const halo = new THREE.Mesh(
        new THREE.TubeGeometry(loopCurve, 96, 0.056, 16, true),
        new THREE.MeshBasicMaterial({
            color: ACCENT_LIGHT,
            transparent: true,
            opacity: 0.24,
            side: THREE.BackSide,
            depthWrite: false,
        })
    );
    groupLoop.add(halo);

    // 3. Объёмная трубка петли бесконечности из сапфирового стекла
    const glassTube = new THREE.Mesh(new THREE.TubeGeometry(loopCurve, 96, 0.042, 24, true), sapphire);
    groupLoop.add(glassTube);

    // 4. Лазерная нить по всей петле: сквозь стекло она и есть линия знака.
    const laserTube = new THREE.Mesh(new THREE.TubeGeometry(loopCurve, 96, 0.017, 12, true), neon);
    groupLoop.add(laserTube);

    // 5. Сфера AI-оркестратора в точке пересечения ветвей: узел петли она же и закрывает.
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.058, 24, 24), glow);
    orb.userData = {
        onFrame: (node, time) => {
            const s = 1.0 + Math.sin(time * 3.8) * 0.12;
            node.scale.set(s, s, s);
        },
    };
    groupLoop.add(orb);

    // 6. Бегущие световые фотоны задач вдоль бесконечного контура
    for (let i = 0; i < 3; i += 1) {
        const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 16), glow);
        pulse.userData = {
            offset: i / 3,
            onFrame: (node, time) => {
                const t = (time * 0.35 + node.userData.offset) % 1;
                loopCurve.getPoint(t, node.position);
            },
        };
        groupLoop.add(pulse);
    }

    // Левитация и разворот петли плоскостью к камере луча.
    groupLoop.name = "loop";
    groupLoop.position.set(0, LOOP_Y, 0);
    groupLoop.rotation.set(LOOP_TILT, 0.1, 0);
    groupLoop.userData = {
        onFrame: (node, time) => {
            node.position.y = LOOP_Y + Math.sin(time * 2.0) * 0.02;
            node.rotation.z = Math.sin(time * 1.5) * 0.05;
        },
    };
    g.add(groupLoop);

    return castAll(g);
}

export default {
    1: automation1,
    2: automation2,
    3: automation3,
    4: automation4,
    5: automation5,
    6: automation6,
};
