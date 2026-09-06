// Предметы луча «Единое цифровое пространство» по шести уровням зрелости.
//
// Луч про инфраструктуру, поэтому шкала читается по тому, что происходит с проводом:
//  −1 — провода есть, порядка нет: системный блок на боку, клубок кабелей, флешка на поле;
//   0 — провод собран в один аккуратный узел: коммутатор с рядом портов, кабели уложены веером,
//       но горит только индикатор — канал вещает в одну сторону и не отвечает;
//  +1 — сторон стало две: терминал заявителя и стойка ведомства стоят порознь, между ними
//       идёт встречный обмен — композиция парная, широкая и низкая;
//  +2 — две стороны слились в одно тело: арка единого окна, а результат вышел из неё
//       отдельной цифровой картой — бумаги нет, выдача есть;
//  +3 — плита оторвалась от поля и стала стеклянным макетом-двойником с кривой прогноза;
//  +4 — макет свернулся в парящую замкнутую магистраль-узел, которая идёт сама в себя,
//       а по тумбе расходятся опережающие волны.
// Цвет идёт тем же ходом: графит и картон снизу, бледный акцент #a0c9d4 на экранах середины,
// насыщенный родственный #38bdf8 наверху — на белом гипсе сам акцент слишком слаб.

import * as THREE from "three";
import {
    PAPER,
    matteMat,
    plasticMat,
    metalMat,
    screenMat,
    glassMat,
    laserMat,
    orbMat,
    proactiveWaves,
    hover,
    spin,
    castAll,
} from "./shared.mjs";

const ACCENT = "#a0c9d4";
// Акцент луча бледный: на верхних уровнях его держит насыщенный родственный тон.
const ACCENT_DEEP = "#38bdf8";
const ACCENT_LIGHT = "#e0f2fe";

// Уровень −1 «Хаос»: системный блок на боку со снятой крышкой, клубок кабелей, сетевой
// фильтр с кривыми вилками, забытая флешка.
//
// Блок положен поворотом ровно на π/2 и без наклона по X, кольца кабелей лежат плашмя
// с малым завалом. Это не стилистика, а посадка: габаритная коробка косо повёрнутого тора
// считается по углам его локальной коробки и раздувается вдвое — предмет уезжал под
// столешницу на 13 см, на кадре это не видно, тест ловит.
export function space1() {
    const g = new THREE.Group();

    const caseMat = plasticMat("#22272e", 0.85);
    const panelMat = plasticMat("#333b45", 0.75);
    const cableMat1 = matteMat("#111418", 0.95);
    const cableMat2 = matteMat("#374151", 0.9);
    const stripMat = plasticMat("#e2e8f0", 0.8);
    const usbMat = plasticMat("#0284c7", 0.5);

    // Поваленный на бок системный блок: боком кверху, крышка снята
    const pc = new THREE.Group();
    pc.position.set(0.07, 0.11, -0.07);
    pc.rotation.set(0, 0.22, Math.PI / 2);
    g.add(pc);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.46, 0.44), caseMat);
    pc.add(body);

    // Снятая боковая крышка лежит на корпусе внахлёст
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.4, 0.36), panelMat);
    cover.position.set(0.114, 0.02, 0.03);
    pc.add(cover);

    // Вентиляционная решётка с втулкой смотрит вверх
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.016, 20), matteMat("#1a1f26", 0.9));
    fan.position.set(0.114, 0.0, -0.14);
    fan.rotation.z = Math.PI / 2;
    pc.add(fan);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.022, 14), metalMat("#6b7480", 0.5));
    hub.position.set(0.12, 0.0, -0.14);
    hub.rotation.z = Math.PI / 2;
    pc.add(hub);

    // Передняя панель: кнопка и слот привода
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 14), plasticMat("#7f8894", 0.6));
    button.position.set(0, 0.15, 0.222);
    button.rotation.x = Math.PI / 2;
    pc.add(button);

    const bay = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.008), matteMat("#12161b", 0.9));
    bay.position.set(0, 0.05, 0.222);
    pc.add(bay);

    // Клубок кабелей: кольца лежат плашмя, но с разным завалом и внахлёст
    const cables = [
        { r: 0.14, tube: 0.02, x: -0.2, y: 0.062, z: 0.09, tilt: 0.18, turn: 0.4, mat: cableMat1 },
        { r: 0.17, tube: 0.018, x: -0.15, y: 0.102, z: 0.13, tilt: -0.26, turn: 1.1, mat: cableMat2 },
        { r: 0.12, tube: 0.022, x: 0.14, y: 0.068, z: 0.19, tilt: 0.24, turn: -0.6, mat: cableMat1 },
        { r: 0.1, tube: 0.016, x: -0.05, y: 0.12, z: 0.15, tilt: -0.3, turn: 0.8, mat: cableMat2 },
    ];
    cables.forEach((c) => {
        const tor = new THREE.Mesh(new THREE.TorusGeometry(c.r, c.tube, 10, 28), c.mat);
        tor.position.set(c.x, c.y, c.z);
        tor.rotation.set(-Math.PI / 2 + c.tilt, 0, c.turn);
        g.add(tor);
    });

    // Два конца, выпавших из клубка и никуда не воткнутых
    [
        [new THREE.Vector3(-0.28, 0.05, 0.06), new THREE.Vector3(-0.33, 0.03, -0.06), new THREE.Vector3(-0.28, 0.02, -0.16)],
        [new THREE.Vector3(0.22, 0.05, 0.21), new THREE.Vector3(0.3, 0.03, 0.14), new THREE.Vector3(0.34, 0.02, 0.02)],
    ].forEach((pts) => {
        const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.011, 6, false), cableMat1);
        g.add(tail);
    });

    // Сетевой фильтр с кривыми вилками
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.3), stripMat);
    strip.position.set(-0.27, 0.018, -0.16);
    strip.rotation.y = 0.35;
    g.add(strip);

    [-0.08, 0.06].forEach((z, i) => {
        const plug = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.05), matteMat("#e8eef2", 0.85));
        plug.position.set(-0.27 + (i ? 0.02 : -0.02), 0.06, -0.16 + z);
        plug.rotation.set(0, 0.35, i ? 0.3 : -0.22);
        g.add(plug);
    });

    // Забытая флешка со снятым колпачком
    const usb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.07), usbMat);
    usb.position.set(0.26, 0.008, 0.22);
    usb.rotation.y = -0.5;
    g.add(usb);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.014, 0.024), metalMat("#9aa4b0", 0.45));
    cap.position.set(0.32, 0.007, 0.17);
    cap.rotation.y = 0.7;
    g.add(cap);

    return castAll(g);
}

// Уровень 0 «Информирование»: сеть, домен и почта появились. Один аккуратный коммутатор
// лежит на поле, кабели уложены ровным веером, светится только полоса индикаторов —
// канал есть, ответить в него нельзя.
export function space2() {
    const g = new THREE.Group();

    const box = new THREE.Group();
    box.rotation.y = 0.07;
    g.add(box);

    // Корпус коммутатора
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.22), plasticMat("#8f9aa5", 0.6));
    body.position.set(0, 0.05, 0);
    box.add(body);

    // Ряд портов: канал физически есть и сосчитан
    for (let i = 0; i < 6; i++) {
        const port = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.024, 0.014), matteMat("#2b323a", 0.8));
        port.position.set(-0.15 + i * 0.06, 0.05, 0.108);
        box.add(port);
    }

    // Полоса индикаторов — единственный свет уровня, бледный акцент
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.006), screenMat(ACCENT, 0.55));
    led.position.set(0, 0.101, 0.06);
    box.add(led);

    // Патч-кабели, уложенные параллельно — противоположность клубку уровня −1
    [-0.09, 0, 0.09].forEach((x) => {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 8, 24, Math.PI), matteMat("#3f4854", 0.9));
        arc.position.set(x, 0, -0.13);
        arc.rotation.y = Math.PI / 2;
        g.add(arc);
    });

    // Папка с лицензиями: бумага ещё есть, но она уже одна и лежит ровно
    const folder = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.016, 0.12), matteMat(PAPER, 0.95));
    folder.position.set(0.19, 0.008, 0.17);
    folder.rotation.y = -0.3;
    g.add(folder);

    return castAll(g);
}

// Уровень +1 «Транзакция»: два тела и обмен между ними. Слева круглый терминал заявителя
// со скошенной панелью ввода, справа стойка ведомства с опоясывающим экраном и куполом
// отклика; между ними две встречные дуги с пакетами и стрелками.
//
// Композиция парная, широкая и низкая намеренно: соседний уровень +2 — одно высокое тело.
// Пока оба уровня были «панелью с экраном», шкала на них не читалась.
export function space3() {
    const g = new THREE.Group();

    const shellL = plasticMat("#e5ebef", 0.5);
    const shellR = plasticMat("#d3dce2", 0.55);
    const trim = metalMat("#8b949c", 0.4);

    // Левое тело: терминал заявителя
    const kiosk = new THREE.Group();
    kiosk.position.set(-0.24, 0, 0);
    g.add(kiosk);

    const kioskRim = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.018, 24), trim);
    kioskRim.position.y = 0.009;
    kiosk.add(kioskRim);

    const kioskBody = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.108, 0.15, 24), shellL);
    kioskBody.position.y = 0.09;
    kiosk.add(kioskBody);

    const deck = new THREE.Group();
    deck.position.set(0, 0.168, 0);
    deck.rotation.x = -0.42;
    kiosk.add(deck);

    const deckBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.028, 0.15), shellL);
    deck.add(deckBody);

    const deckScreen = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.006, 0.1), screenMat(ACCENT, 0.85));
    deckScreen.position.set(0, 0.017, 0.012);
    deck.add(deckScreen);

    // Клавиша отправки — в неё и упирается транзакция
    const key = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 14), laserMat(ACCENT_DEEP));
    key.position.set(0, 0.018, -0.052);
    deck.add(key);

    // Правое тело: стойка ведомства
    const desk = new THREE.Group();
    desk.position.set(0.24, 0, 0);
    g.add(desk);

    const deskRim = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.02, 24), trim);
    deskRim.position.y = 0.01;
    desk.add(deskRim);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.29, 24), shellR);
    post.position.y = 0.155;
    desk.add(post);

    // Опоясывающий экран: отклик виден со всех сторон
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.089, 0.089, 0.055, 24, 1, true), screenMat(ACCENT, 0.9));
    band.position.y = 0.235;
    desk.add(band);

    // Щель приёма документа
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.02), matteMat("#2b323a", 0.8));
    slot.position.set(0, 0.12, 0.09);
    desk.add(slot);

    // Купол отклика
    const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        glassMat(ACCENT_LIGHT, ACCENT_DEEP)
    );
    dome.position.y = 0.3;
    desk.add(dome);

    // Две встречные дуги обмена: заявка туда, отклик обратно
    const exchange = laserMat(ACCENT_DEEP);
    const routes = [
        { from: [-0.16, 0.22, 0.035], mid: [0.0, 0.4, 0.045], to: [0.13, 0.27, 0.035] },
        { from: [0.16, 0.21, -0.035], mid: [0.0, 0.35, -0.045], to: [-0.14, 0.23, -0.035] },
    ];
    routes.forEach((r) => {
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(...r.from),
            new THREE.Vector3(...r.mid),
            new THREE.Vector3(...r.to),
        ]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.006, 6, false), exchange));

        // Стрелка смотрит по касательной к концу дуги, а не по осям
        const dir = curve.getTangent(1);
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.042, 10), exchange);
        arrow.position.copy(curve.getPoint(1));
        arrow.rotation.z = -Math.atan2(dir.x, dir.y);
        g.add(arrow);

        // Пакет данных в пути
        const packet = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 14), orbMat("#ffffff"));
        packet.position.copy(curve.getPoint(0.45));
        g.add(packet);
    });

    return castAll(g);
}

// Уровень +2 «Электронный результат»: одно цельное тело — арка единого окна с порогом,
// двумя стойками и полукруглым навершием, залитая светом проёма. Отдельной деталью перед
// ней лежит выданная цифровая карта, к ней из щели идёт след выдачи.
//
// Тело здесь единственное и высокое, геометрия дуговая — против парных низких цилиндров
// уровня +1: два соседних уровня должны различаться силуэтом, а не подписью.
export function space4() {
    const g = new THREE.Group();

    const stone = plasticMat("#e8eef2", 0.45);
    const glow = screenMat(ACCENT_DEEP, 1.0);

    // Порог и две стойки арки
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.05, 0.07), stone);
    sill.position.set(0, 0.025, 0);
    g.add(sill);

    [-0.13, 0.13].forEach((x) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, 0.07), stone);
        leg.position.set(x, 0.18, 0);
        g.add(leg);
    });

    // Навершие: половина тора той же толщины, что стойки — тело читается цельным
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 12, 36, Math.PI), stone);
    crown.position.set(0, 0.31, 0);
    g.add(crown);

    // Проём: прямая часть и полукруг под навершием
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.26, 0.014), glow);
    pane.position.set(0, 0.18, 0);
    g.add(pane);

    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.014, 24, 1, false, 0, Math.PI), glow);
    fan.rotation.x = -Math.PI / 2;
    fan.position.set(0, 0.31, 0);
    g.add(fan);

    // Полоса единого входа и стрелка выдачи внутри проёма
    const login = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.016, 0.006), laserMat(ACCENT_LIGHT));
    login.position.set(0, 0.275, 0.009);
    g.add(login);

    const issue = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 12), laserMat(ACCENT_LIGHT));
    issue.position.set(0, 0.15, 0.009);
    issue.rotation.z = Math.PI;
    g.add(issue);

    // Щель выдачи в пороге
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.014, 0.02), matteMat("#2b323a", 0.85));
    slot.position.set(0, 0.045, 0.036);
    g.add(slot);

    // Выданная цифровая карта: вышла из щели и легла перед аркой
    const card = new THREE.Group();
    card.position.set(0.02, 0.026, 0.19);
    card.rotation.set(-Math.PI / 2 + 0.06, 0.25, 0);
    g.add(card);

    const cardBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.006), plasticMat(ACCENT, 0.4));
    card.add(cardBody);

    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.024, 0.004), metalMat("#d6b45e", 0.3));
    chip.position.set(-0.048, 0.016, 0.005);
    card.add(chip);

    // Отметка о выдаче: галочка из двух штрихов
    const markMat = laserMat("#ffffff");
    const mark1 = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.008, 0.004), markMat);
    mark1.position.set(0.032, -0.015, 0.005);
    mark1.rotation.z = 0.9;
    card.add(mark1);

    const mark2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.004), markMat);
    mark2.position.set(0.052, 0.0, 0.005);
    mark2.rotation.z = -0.7;
    card.add(mark2);

    // След выдачи от щели к карте
    const trail = new THREE.Mesh(
        new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(0, 0.045, 0.05),
                new THREE.Vector3(0.01, 0.045, 0.12),
                new THREE.Vector3(0.02, 0.035, 0.17),
            ]),
            16,
            0.005,
            6,
            false
        ),
        laserMat(ACCENT_LIGHT)
    );
    g.add(trail);

    return castAll(g);
}

// Уровень +3 «Интеллект»: стеклянный макет-двойник колледжа оторвался от поля, медленно
// вращается и держит над собой кривую прогноза со светящимся горизонтом предикта.
// Поле тумбы под ним пустое: подъём читается силуэтом и контактной тенью, а подложка под
// парящим предметом его же и сажает обратно.
export function space5() {
    const g = new THREE.Group();

    // Подъём и вращение разведены по двум узлам: hover и spin пишут в один и тот же
    // onFrame и на одной группе затирают друг друга. Корень остаётся свободным —
    // его позицию задаёт подгонка под тумбу.
    const lift = new THREE.Group();
    lift.position.set(0, 0.3, 0);

    const twin = new THREE.Group();

    // Платформа двойника
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.018, 0.2), glassMat(ACCENT, ACCENT_DEEP));
    twin.add(plate);

    const gridMat = new THREE.MeshBasicMaterial({ color: ACCENT_LIGHT, wireframe: true, transparent: true, opacity: 0.5 });
    const grid = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.019, 0.2, 4, 1, 3), gridMat);
    twin.add(grid);

    // Корпуса колледжа в модели
    const blocks = [
        { w: 0.07, h: 0.1, d: 0.07, x: -0.07, z: -0.03, mat: glassMat(ACCENT, ACCENT_DEEP) },
        { w: 0.06, h: 0.16, d: 0.06, x: 0.03, z: 0.03, mat: glassMat(ACCENT_LIGHT, ACCENT_DEEP) },
        { w: 0.09, h: 0.07, d: 0.06, x: 0.08, z: -0.05, mat: glassMat(ACCENT, ACCENT_DEEP) },
    ];
    blocks.forEach((b) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), b.mat);
        m.position.set(b.x, 0.009 + b.h / 2, b.z);
        twin.add(m);
    });

    // Кривая прогноза
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.13, 0.03, 0.06),
        new THREE.Vector3(-0.02, 0.14, 0.0),
        new THREE.Vector3(0.13, 0.26, -0.05),
    ]);
    const forecast = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.006, 6, false), laserMat(ACCENT_DEEP));
    twin.add(forecast);

    // Узлы замера и горизонт предикта на конце кривой
    [0.35, 0.68].forEach((t) => {
        const node = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 16), laserMat(ACCENT_LIGHT));
        node.position.copy(curve.getPoint(t));
        twin.add(node);
    });

    const horizon = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 24), orbMat("#ffffff"));
    horizon.position.copy(curve.getPoint(1));
    twin.add(horizon);

    spin(twin, 0.22);
    lift.add(twin);
    hover(lift, 0.018, 1.5);
    g.add(lift);

    return castAll(g);
}

// Радиус и толщина замкнутой магистрали. Узел (2,3) — одна непрерывная трасса, которая
// трижды проходит сквозь саму себя: у неё нет ни начала, ни конца, и вынуть из неё нечего.
const LOOP_R = 0.3;
const LOOP_TUBE = 0.048;
// Наклон плоскости петли: плашмя она с обзорной камеры читается тонкой чертой.
const LOOP_TILT = 0.18;

// Точка на трассе узла по параметру t ∈ [0,1] — та же формула, по которой THREE строит
// TorusKnotGeometry. Нужна, чтобы пакеты шли ровно по оси трубы, а не рядом с ней.
function loopPoint(t) {
    const u = t * Math.PI * 2 * 2;
    const w = 1.5 * u;
    const rad = (LOOP_R * (2 + Math.cos(w))) / 2;
    return new THREE.Vector3(rad * Math.cos(u), rad * Math.sin(u), (LOOP_R * Math.sin(w)) / 2);
}

// Уровень +4 «Проактивность»: парящая замкнутая магистраль — поток данных, свёрнутый в
// узел на торе. Одна трасса уходит сама в себя и трижды проходит сквозь собственное тело:
// инфраструктура на этом уровне не обслуживается снаружи, она замкнута на себя, сама
// перекладывает нагрузку и сама себя чинит. По тумбе расходятся опережающие волны.
//
// Силуэт против уровня +3: там низкая горизонтальная плита-макет с башенками и кривой
// вверх, здесь — крупное плетёное кольцо в поперечнике почти во всю тумбу, с дырой в
// середине и светящейся жилой по всей длине. На обзоре, где предмет занимает ~60 пикселей,
// узнаётся именно контур кольца, а не отдельные детали.
export function space6() {
    const g = new THREE.Group();

    // Волны радара на тумбе — единственное, что лежит на поле
    g.add(proactiveWaves(ACCENT));

    const orb = orbMat("#ffffff");

    // Парящая часть. Центр поднят так, чтобы низ петли с учётом качания не опускался
    // ниже FLOAT_BASE: подойди петля ближе к полю — левитация перестанет читаться.
    const float = new THREE.Group();
    float.position.set(0, 0.63, 0);

    // Плоскость петли: узел строится в XY, кладём его в XZ и добавляем наклон.
    const plane = new THREE.Group();
    plane.rotation.x = -Math.PI / 2 + LOOP_TILT;
    float.add(plane);

    // Ход трассы вокруг собственной оси. Ось петли — локальная Z этого узла, поэтому
    // общий spin() (он крутит по Y) здесь не годится: он бы кувыркал кольцо.
    const turn = new THREE.Group();
    turn.userData = {
        onFrame: (node, time) => {
            node.rotation.z = time * 0.16;
        },
    };
    plane.add(turn);

    // Стеклянное тело магистрали и светящаяся жила внутри него: на белом гипсе стекло
    // само по себе почти не видно, контур держит именно жила насыщенным тоном.
    const conduit = new THREE.Mesh(new THREE.TorusKnotGeometry(LOOP_R, LOOP_TUBE, 128, 12, 2, 3), glassMat(ACCENT, "#0284c7"));
    turn.add(conduit);

    const vein = new THREE.Mesh(new THREE.TorusKnotGeometry(LOOP_R, 0.011, 128, 8, 2, 3), laserMat(ACCENT_DEEP));
    turn.add(vein);

    // Пакеты, бегущие по замкнутой трассе. Позиция ставится сразу при сборке: до первого
    // кадра пакет иначе лежит в начале координат, и посадка считается по нему.
    for (let i = 0; i < 3; i += 1) {
        const packet = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 16), orb);
        packet.position.copy(loopPoint(i / 3));
        packet.userData = {
            offset: i / 3,
            onFrame: (node, time) => {
                node.position.copy(loopPoint((time * 0.09 + node.userData.offset) % 1));
            },
        };
        turn.add(packet);
    }

    // Ядро в середине кольца: то, что этот замкнутый контур и держит на ходу.
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 20), glassMat(ACCENT_LIGHT, ACCENT_DEEP));
    float.add(core);

    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 16), orb);
    float.add(spark);

    // Тени берёт только парящая часть: волны на тумбе — плоские полупрозрачные диски,
    // их тень читалась бы грязью на поле.
    castAll(float);

    hover(float, 0.018, 1.6);
    g.add(float);

    return g;
}

export default { 1: space1, 2: space2, 3: space3, 4: space4, 5: space5, 6: space6 };
