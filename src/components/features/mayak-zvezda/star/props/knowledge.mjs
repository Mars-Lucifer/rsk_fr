// Предметы луча «Знания и навыки» по шести уровням зрелости.
//
// Луч про то, как в колледже учат учителей. Уровни различаются не надписью, а тем, где
// живёт знание о компетенциях: −1 — в бумажных папках на столе; 0 — на одном статичном
// экране-объявлении с утверждённой программой; +1 — в обмене между двумя приборами:
// низкая консоль личного кабинета и планшет педагога, между ними высокая дуга заявки и
// низкая дуга отклика; +2 — в раскрытой стеклянной карте-портфолио, которая заполняется
// сама, и в отдельно выданном электронном результате с печатью;
// +3 — в приподнятой стеклянной карте компетенций с восходящей кривой прогноза;
// +4 — в парящей спирали, где курс предлагается до того, как дефицит появился.
//
// Силуэт — главное различие соседей, и он меняет природу, а не размер: плоский завал →
// плоская плита → пара низких тел с дугой над ними → одна раскрытая форма-«V» →
// парящий диск → парящая спираль. Ни на одном уровне нет второй «панели на ножке»:
// +1 читается парой и обменом, +2 — раскрытым телом, и на общем плане их не спутать.
// Цвет: серо-бурый → графит → графит с янтарной строкой → янтарное стекло →
// янтарное стекло на весу → чистое свечение.

import * as THREE from "three";
import {
    PROP_SPAN,
    PROP_MAX_HEIGHT,
    FLOAT_BASE,
    PAPER,
    CARDBOARD,
    GRAPHITE,
    RUST,
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

const ACCENT = "#e8a848";

// Эталонные −1 и +4 собирались до правила PROP_SPAN и вылезали за поле тумбы.
// Равномерный масштаб сохраняет силуэт и пропорции — меняется только размер.
function fitSpan(node) {
    const b = new THREE.Box3().setFromObject(node);
    const reach = Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z);
    if (reach > PROP_SPAN) node.scale.setScalar(PROP_SPAN / reach);
    return node;
}

// То же для парящей скульптуры +4: она вдобавок низом уходит под FLOAT_BASE. Считаем
// один масштаб, при котором и след влезает в поле, и поднятая скульптура — в высоту.
// Запас 0.03 оставлен на качание hover.
function fitFloating(node) {
    const b = new THREE.Box3().setFromObject(node);
    const reach = Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z);
    const k = Math.min(1, PROP_SPAN / reach, (PROP_MAX_HEIGHT - 0.03 - FLOAT_BASE) / (b.max.y - b.min.y));
    node.scale.setScalar(k);
    node.position.y = FLOAT_BASE - b.min.y * k;
    return node;
}

// Посадить повёрнутую сборку на поле: у наклонной панели низ считается тригонометрией,
// и руками он всегда оказывается либо в воздухе, либо в тумбе.
function ground(node) {
    const b = new THREE.Box3().setFromObject(node);
    node.position.y -= b.min.y;
    return node;
}

// −1 «Хаос»: неровная стопка старых папок, раскрытая книга с закладкой, упавший лист.
// Перенос эталона из testProps.js: геометрия один в один, материалы взяты из мастерской.
export function knowledge1() {
    const g = new THREE.Group();

    const folder1Mat = matteMat(RUST, 0.9);
    const folder2Mat = matteMat(GRAPHITE, 0.88);
    const folder3Mat = matteMat(CARDBOARD, 0.92);
    const bookCoverMat = matteMat("#641e16", 0.85);
    const paperMat = matteMat(PAPER, 0.95);
    const ribbonMat = plasticMat("#dc2626", 0.6);

    const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.075, 0.4), folder1Mat);
    f1.position.set(-0.12, 0.038, -0.06);
    f1.rotation.y = 0.06;
    g.add(f1);

    const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.38), folder2Mat);
    f2.position.set(-0.1, 0.11, -0.05);
    f2.rotation.y = -0.1;
    g.add(f2);

    const f3 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.36), folder3Mat);
    f3.position.set(-0.13, 0.18, -0.07);
    f3.rotation.y = 0.14;
    g.add(f3);

    const slip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.006, 0.24), paperMat);
    slip.position.set(0.04, 0.145, 0.05);
    slip.rotation.set(-0.06, 0.25, 0.12);
    g.add(slip);

    const bookGroup = new THREE.Group();
    bookGroup.position.set(0.18, 0.04, 0.14);
    bookGroup.rotation.y = -0.35;

    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.018, 0.34), bookCoverMat);
    leftWing.position.set(-0.11, 0.03, 0);
    leftWing.rotation.z = 0.22;
    bookGroup.add(leftWing);

    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.018, 0.34), bookCoverMat);
    rightWing.position.set(0.11, 0.03, 0);
    rightWing.rotation.z = -0.22;
    bookGroup.add(rightWing);

    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.035, 0.32), paperMat);
    pages.position.set(0, 0.025, 0);
    bookGroup.add(pages);

    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.22), ribbonMat);
    ribbon.position.set(0.02, 0.05, 0.12);
    ribbon.rotation.set(0.15, -0.2, 0);
    bookGroup.add(ribbon);

    g.add(bookGroup);

    const drop = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.005, 0.18), paperMat);
    drop.position.set(-0.18, 0.004, 0.24);
    drop.rotation.set(0.01, 0.7, -0.01);
    g.add(drop);

    return castAll(ground(fitSpan(g)));
}

// 0 «Информирование»: наклонная панель-объявление с утверждённой программой обучения
// и аккуратная стопка сертификатов. Экран горит, но не отвечает: канал в одну сторону.
export function knowledge2() {
    const g = new THREE.Group();

    const panel = new THREE.Group();
    panel.rotation.x = -0.55;
    panel.position.set(0, 0, -0.02);

    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.022, 0.26), plasticMat(GRAPHITE));
    panel.add(shell);

    // Экран холодный, почти без акцента: на этом уровне у луча ещё нет своего цвета.
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.004, 0.22), screenMat("#93a7bd", 0.4));
    screen.position.y = 0.013;
    panel.add(screen);

    [-0.075, -0.04, -0.005, 0.03].forEach((z) => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.002, 0.011), matteMat("#cbd5e1", 0.7));
        line.position.set(-0.035, 0.016, z);
        panel.add(line);
    });

    // Единственная янтарная деталь уровня — отметка «программа утверждена».
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.002, 0.016), screenMat(ACCENT, 0.9));
    mark.position.set(0.08, 0.016, 0.075);
    panel.add(mark);

    ground(panel);
    g.add(panel);

    const support = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.05), matteMat(GRAPHITE));
    support.position.set(0, 0.035, -0.14);
    g.add(support);

    // Бумага ещё есть, но она разложена стопкой, а не свалена: это и отличает 0 от −1.
    [0, 1, 2].forEach((i) => {
        const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.006, 0.11), matteMat(PAPER, 0.95));
        sheet.position.set(i * 0.006, 0.004 + i * 0.007, 0.21);
        sheet.rotation.y = i * 0.05;
        g.add(sheet);
    });

    return castAll(fitSpan(g));
}

// +1 «Транзакция»: два отдельных тела и видимый обмен между ними. Слева низкая консоль
// личного кабинета со скошенным экраном, справа планшет педагога на клине, между ними
// высокая дуга заявки и обратная низкая дуга отклика с пакетами на пути.
//
// Композиция намеренно широкая и невысокая: тела ниже вдвое, чем на +2, а самая высокая
// точка предмета — не корпус, а тонкая дуга. Так силуэт уровня отличается от одиночного
// тела +2 по природе, а не по цвету.
export function knowledge3() {
    const g = new THREE.Group();

    const caseMat = plasticMat(GRAPHITE);
    const trimMat = metalMat("#8b95a4");

    // ── Консоль личного кабинета. Скругления даём отдельными телами: у BoxGeometry фасок
    // нет, и голая коробка вблизи читается макетом.
    const CX = -0.155;

    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.014, 0.2), trimMat);
    lip.position.set(CX, 0.007, 0);
    g.add(lip);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.085, 0.19), caseMat);
    body.position.set(CX, 0.0565, 0);
    g.add(body);

    // Четыре вертикальных валика по углам корпуса — те самые скругления.
    [
        [-0.115, -0.08],
        [0.115, -0.08],
        [-0.115, 0.08],
        [0.115, 0.08],
    ].forEach(([dx, dz]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.085, 12), trimMat);
        post.position.set(CX + dx, 0.0565, dz);
        g.add(post);
    });

    // Задний прилив: он закрывает щель под поднятым краем наклонной панели.
    const riser = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.07), caseMat);
    riser.position.set(CX, 0.1, -0.072);
    g.add(riser);

    const face = new THREE.Group();
    face.position.set(CX, 0.099, 0.01);
    face.rotation.x = 0.45;

    const faceShell = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.022, 0.17), caseMat);
    face.add(faceShell);

    const faceScreen = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.005, 0.14), screenMat(ACCENT, 0.5));
    faceScreen.position.y = 0.0135;
    face.add(faceScreen);

    // Строки формы заявки: три заполненных поля и подсвеченное активное.
    [-0.04, -0.012, 0.016].forEach((z) => {
        const row = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.002, 0.009), matteMat("#cbd5e1", 0.7));
        row.position.set(-0.04, 0.017, z);
        face.add(row);
    });

    const field = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.003, 0.018), screenMat("#fde68a", 1.4));
    field.position.set(-0.04, 0.018, 0.048);
    face.add(field);

    const sendKey = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.006, 16), orbMat(ACCENT));
    sendKey.position.set(0.072, 0.019, 0.048);
    face.add(sendKey);

    g.add(face);

    // ── Планшет педагога: второе тело, ниже и мельче консоли, развёрнуто к ней.
    const device = new THREE.Group();
    device.position.set(0.195, 0, 0);
    device.rotation.y = -0.35;

    const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.038, 0.1), trimMat);
    wedge.position.y = 0.019;
    device.add(wedge);

    const slab = new THREE.Group();
    slab.position.y = 0.038;
    slab.rotation.x = 0.38;

    const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.014, 0.12), plasticMat("#5b6472"));
    tablet.position.y = 0.011;
    slab.add(tablet);

    const tabletScreen = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.004, 0.098), screenMat(ACCENT, 0.45));
    tabletScreen.position.y = 0.02;
    slab.add(tabletScreen);

    // Пришедший отклик: одна яркая строка и круглая отметка «принято».
    const reply = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.003, 0.012), screenMat("#fde68a", 1.4));
    reply.position.set(-0.016, 0.023, -0.022);
    slab.add(reply);

    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.004, 14), orbMat(ACCENT));
    dot.position.set(0.05, 0.023, 0.03);
    slab.add(dot);

    device.add(slab);
    g.add(device);

    // ── Обмен. Заявка уходит верхней дугой, отклик возвращается нижней: две линии на
    // разной высоте, иначе обмен читается одной перемычкой.
    const linkMat = laserMat(ACCENT);

    const up = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.1, 0.175, 0.03),
        new THREE.Vector3(-0.01, 0.29, 0.025),
        new THREE.Vector3(0.09, 0.22, 0.022),
        new THREE.Vector3(0.168, 0.115, 0.02),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(up, 40, 0.007, 8, false), linkMat));

    const arrowIn = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.04, 12), linkMat);
    arrowIn.position.set(0.176, 0.098, 0.02);
    arrowIn.rotation.z = -2.5;
    g.add(arrowIn);

    const down = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.15, 0.075, 0.062),
        new THREE.Vector3(0.05, 0.098, 0.066),
        new THREE.Vector3(-0.045, 0.152, 0.062),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(down, 32, 0.007, 8, false), linkMat));

    const arrowOut = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.04, 12), linkMat);
    arrowOut.position.set(-0.058, 0.163, 0.062);
    arrowOut.rotation.z = 0.9;
    g.add(arrowOut);

    const packetUp = new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 16), orbMat("#fff2c4"));
    packetUp.position.set(-0.01, 0.288, 0.025);
    g.add(packetUp);

    const packetDown = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 16), orbMat("#fff2c4"));
    packetDown.position.set(0.052, 0.099, 0.065);
    g.add(packetDown);

    return castAll(fitSpan(g));
}

// +2 «Электронный результат»: раскрытая стеклянная карта-портфолио. Две створки стоят
// на постаменте наружными рёбрами и расходятся вверх буквой «V»: левая заполняется
// записями сама, на правой — план обучения по регламенту с полосой выполнения. Перед
// картой отдельно лежит выданный электронный результат с печатью.
//
// Никакой панели на ножке: тело одно, раскрытое, и его силуэт — раствор, а не
// прямоугольник. Так уровень не спутать с парой приборов +1 и с парящим диском +3.
export function knowledge4() {
    const g = new THREE.Group();

    const frameMat = metalMat("#9aa1ab");
    const glass = glassMat(ACCENT);
    const rowMat = screenMat("#fde68a", 1.4);

    // ── Постамент: три плиты с уменьшением — так у него читается фаска.
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.014, 0.2), metalMat("#8d939d"));
    lip.position.set(0, 0.007, -0.01);
    g.add(lip);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.058, 0.17), frameMat);
    plinth.position.set(0, 0.043, -0.01);
    g.add(plinth);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.014, 0.14), metalMat("#aab1bb"));
    cap.position.set(0, 0.079, -0.01);
    g.add(cap);

    // Корешок: он держит створки вместе, иначе раскрытая форма распадается на два тела.
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.062, 0.105), plasticMat(GRAPHITE));
    spine.position.set(0, 0.117, -0.005);
    g.add(spine);

    const spineGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.1, 16), orbMat(ACCENT));
    spineGlow.rotation.x = Math.PI / 2;
    spineGlow.position.set(0, 0.15, -0.005);
    g.add(spineGlow);

    // ── Створки. Наклон подобран так, что наружное нижнее ребро садится ровно на
    // постамент, а внутреннее прячется в корешке.
    const TILT = 0.26;
    const LEAF_W = 0.15;
    const LEAF_H = 0.44;

    function leaf(side, rows, topBar) {
        const wing = new THREE.Group();
        wing.position.set(side * 0.012, 0.125, -0.005);
        wing.rotation.set(0, side * -0.16, side * -TILT);

        const plate = new THREE.Mesh(new THREE.BoxGeometry(LEAF_W, LEAF_H, 0.013), glass);
        plate.position.set((side * LEAF_W) / 2, LEAF_H / 2, 0);
        wing.add(plate);

        // Окантовка наружного ребра: тонкий валик вместо ребра коробки.
        const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, LEAF_H, 12), frameMat);
        trim.position.set(side * LEAF_W, LEAF_H / 2, 0);
        wing.add(trim);

        rows.forEach(([y, w, mat]) => {
            const row = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, 0.0035), mat);
            row.position.set((side * LEAF_W) / 2, y, 0.009);
            wing.add(row);
        });

        if (topBar) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.018, 0.004), screenMat("#fff7d6", 1.7));
            bar.position.set((side * LEAF_W) / 2 - side * 0.012, 0.355, 0.009);
            wing.add(bar);
        }

        return wing;
    }

    const dim = matteMat("#c7cdd6", 0.6);

    // Левая створка — накопленные записи: три готовых и одна ещё пустая.
    g.add(
        leaf(
            -1,
            [
                [0.08, 0.105, rowMat],
                [0.15, 0.105, rowMat],
                [0.22, 0.085, rowMat],
                [0.29, 0.105, dim],
            ],
            false
        )
    );

    // Правая створка — план обучения: две строки регламента и полоса выполнения.
    g.add(
        leaf(
            1,
            [
                [0.1, 0.105, dim],
                [0.19, 0.105, rowMat],
                [0.27, 0.075, rowMat],
            ],
            true
        )
    );

    // ── Выданный электронный результат: отдельная деталь перед картой, с печатью.
    const cardStand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.016, 0.038), metalMat("#8d939d"));
    cardStand.position.set(0, 0.008, 0.17);
    g.add(cardStand);

    const card = new THREE.Group();
    card.position.set(0, 0.016, 0.168);
    card.rotation.x = -0.2;

    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.1, 0.006), glass);
    sheet.position.y = 0.05;
    card.add(sheet);

    [0.078, 0.058].forEach((y) => {
        const row = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.006, 0.002), screenMat("#fff7d6", 1.3));
        row.position.set(-0.026, y, 0.005);
        card.add(row);
    });

    const seal = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.005, 10, 22), orbMat(ACCENT));
    seal.position.set(0.042, 0.033, 0.006);
    card.add(seal);

    g.add(card);

    return castAll(fitSpan(g));
}

// +3 «Интеллект»: карта компетенций колледжа приподнята над полем и медленно
// поворачивается, над ней — кривая прогноза дефицитов с растущим горизонтом.
// Стекло и свечение вместо крашеного металла, опоры под предметом уже нет.
export function knowledge5() {
    const g = new THREE.Group();

    // След подъёма на поле: без него парящий диск читается как стоящий.
    const glow = new THREE.Mesh(
        new THREE.CircleGeometry(0.15, 32),
        new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.004;
    g.add(glow);

    const model = new THREE.Group();
    model.position.y = 0.17;

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.018, 32), glassMat(ACCENT));
    model.add(disc);

    [0.115, 0.172].forEach((r) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0035, 8, 40), laserMat(ACCENT));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.012;
        model.add(ring);
    });

    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.15, 0.03, 0.06),
        new THREE.Vector3(-0.06, 0.08, 0.01),
        new THREE.Vector3(0.04, 0.13, -0.04),
        new THREE.Vector3(0.14, 0.23, -0.02),
    ]);
    model.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.009, 10, false), laserMat("#fde68a")));

    [
        [-0.15, 0.03, 0.06, 0.015],
        [-0.06, 0.08, 0.01, 0.017],
        [0.04, 0.13, -0.04, 0.019],
    ].forEach(([x, y, z, r]) => {
        const node = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), orbMat(ACCENT));
        node.position.set(x, y, z);
        model.add(node);
    });

    // Горизонт прогноза — самая яркая и самая высокая точка предмета.
    const horizon = new THREE.Mesh(new THREE.SphereGeometry(0.032, 24, 24), orbMat("#fff2c4"));
    horizon.position.set(0.14, 0.23, -0.02);
    model.add(horizon);

    spin(model, 0.3);
    g.add(model);

    return castAll(fitSpan(g));
}

// +4 «Проактивность»: восходящая спираль знаний — пять янтарных стеклянных сфер
// растущего размера, золотая нить и вершина озарения. Опоры нет вовсе, по полю тумбы
// расходятся опережающие волны. Перенос эталона из testProps.js.
export function knowledge6() {
    const g = new THREE.Group();

    g.add(proactiveWaves(ACCENT));

    const amberGlassMat = glassMat("#f59e0b", "#d97706");
    amberGlassMat.emissiveIntensity = 0.4;
    const threadMat = laserMat("#fef08a");
    const beaconMat = orbMat("#ffffff");

    const spiral = new THREE.Group();

    [
        { r: 0.048, x: 0.22, y: 0.26, z: 0.06 },
        { r: 0.068, x: 0.11, y: 0.35, z: 0.03 },
        { r: 0.09, x: 0.0, y: 0.45, z: 0.0 },
        { r: 0.114, x: -0.11, y: 0.56, z: -0.03 },
        { r: 0.14, x: -0.22, y: 0.68, z: -0.06 },
    ].forEach((s, idx) => {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(s.r, 32, 32), amberGlassMat);
        mesh.position.set(s.x, s.y, s.z);
        mesh.userData = {
            baseY: s.y,
            index: idx,
            onFrame: (node, time) => {
                node.position.y = node.userData.baseY + Math.sin(time * 2.1 + node.userData.index * 0.55) * 0.014;
            },
        };
        spiral.add(mesh);
    });

    const thread = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.28, 0.22, 0.1),
        new THREE.Vector3(0.22, 0.26, 0.06),
        new THREE.Vector3(0.11, 0.35, -0.04),
        new THREE.Vector3(0.0, 0.45, 0.05),
        new THREE.Vector3(-0.11, 0.56, -0.04),
        new THREE.Vector3(-0.18, 0.64, 0.04),
        new THREE.Vector3(-0.24, 0.74, -0.06),
    ]);
    spiral.add(new THREE.Mesh(new THREE.TubeGeometry(thread, 64, 0.012, 12, false), threadMat));

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.048, 24, 24), beaconMat);
    beacon.position.set(-0.24, 0.74, -0.06);
    beacon.userData = {
        onFrame: (node, time) => {
            const s = 1.0 + Math.sin(time * 4.0) * 0.12;
            node.scale.set(s, s, s);
        },
    };
    spiral.add(beacon);

    hover(fitFloating(spiral));
    g.add(spiral);

    return castAll(g);
}

export default { 1: knowledge1, 2: knowledge2, 3: knowledge3, 4: knowledge4, 5: knowledge5, 6: knowledge6 };
