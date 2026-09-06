// Предметы луча «Внешние взаимодействия» по шести уровням зрелости.
//
// Луч про то, как колледж разговаривает с внешним миром, поэтому шкала здесь читается
// как форма канала связи. −1: доска объявлений и почтовый ящик — канал есть, но он
// физический и односторонний. 0: один плоский светящийся стенд — вещание в одну сторону,
// ответить некуда. +1: две низкие приёмные тумбы и рельсы обмена между ними — канал стал
// двусторонним, и в силуэте это ДВА тела. +2: одно цельное гранёное тело — пилон без экрана,
// а результат вынесен наружу отдельной парящей карточкой. +3: приподнятая стеклянная дека с
// кривой прогноза и точкой горизонта. +4: парящая ладонь-чаша, отдающая светящийся пакет, и
// волны по полю. Соседние уровни различаются не картинкой на корпусе, а числом и природой тел:
// завал → лежащий стенд → пара низких тумб → одиночный высокий гранёный пилон → парящая
// горизонтальная дека → парящая наклонная чаша с исходящим веером.
// Высота растёт вместе с уровнем, доля акцента #ce5f44 — тоже: от нуля на −1 и 0 до
// целиком стеклянного акцентного предмета на +4.

import * as THREE from "three";
import {
    PROP_SPAN,
    PROP_MAX_HEIGHT,
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

const ACCENT = "#ce5f44";
const ACCENT_SOFT = "#e39176";
const ACCENT_DEEP = "#991b1b";

// Поле тумбы круглое, поэтому след предмета меряется радиусом √(x²+z²), а не отдельно по
// осям: угол квадратного габарита вылезает на цветное кольцо, хотя по каждой оси в норме.
const PROP_RADIUS = PROP_SPAN * Math.SQRT2;

// Посадка собранного предмета на тумбу: центрирование по горизонтали и, если след всё же
// шире поля, единый масштаб на всю сборку. Считается по настоящим вершинам, а не по Box3:
// Box3.setFromObject берёт AABB геометрии и поворачивает его целиком, и наклонённый тор
// «раздувается» с 0.30 до 0.38. Раньше на этом +4 давился масштабом 0.77 и вставал вровень
// с бумажным завалом −1 — скульптура была не мелкой, её мельчила посадка.
function fitSpan(source) {
    source.updateMatrixWorld(true);

    const v = new THREE.Vector3();
    const each = (fn) => {
        source.traverse((n) => {
            if (!n.isMesh) return;
            const pos = n.geometry.attributes.position;
            for (let i = 0; i < pos.count; i += 1) fn(v.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld));
        });
    };

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let maxY = 0;
    each((p) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
        maxY = Math.max(maxY, p.y);
    });

    const cx = (maxX + minX) / 2;
    const cz = (maxZ + minZ) / 2;
    let radius = 0;
    each((p) => {
        radius = Math.max(radius, Math.hypot(p.x - cx, p.z - cz));
    });

    source.position.x -= cx;
    source.position.z -= cz;

    const g = new THREE.Group();
    g.add(source);
    g.scale.setScalar(Math.min(1, PROP_RADIUS / radius, PROP_MAX_HEIGHT / maxY));
    return castAll(g);
}

// −1 «Хаос»: доска объявлений на кривых ножках со стикерами и механический почтовый ящик.
// Геометрия перенесена из testProps.interactionChaos без изменений, локальные фабрики
// материалов заменены на общие из shared.mjs.
export function interaction1() {
    const g = new THREE.Group();

    const legMat = matteMat("#6b4f35", 0.9);
    const boardMat = matteMat("#bfa27a", 0.95);
    const frameMat = matteMat("#4a3522", 0.85);
    const mailboxMat = plasticMat("#334155", 0.8);
    const paperMat = matteMat(PAPER, 0.95);

    const stand = new THREE.Group();
    stand.position.set(-0.06, 0, -0.06);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.62, 0.03), legMat);
    legL.position.set(-0.24, 0.31, 0);
    stand.add(legL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.62, 0.03), legMat);
    legR.position.set(0.24, 0.31, 0);
    stand.add(legR);

    const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.38, 0.025), frameMat);
    boardFrame.position.set(0, 0.44, 0);
    stand.add(boardFrame);

    const cork = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.34, 0.028), boardMat);
    cork.position.set(0, 0.44, 0.002);
    stand.add(cork);

    const stickers = [
        { color: "#fef08a", x: -0.14, y: 0.49, rot: 0.09, w: 0.1, h: 0.11 },
        { color: "#fecdd3", x: 0.12, y: 0.42, rot: -0.15, w: 0.11, h: 0.09 },
        { color: "#f8fafc", x: -0.02, y: 0.45, rot: 0.05, w: 0.13, h: 0.15 },
        { color: "#bae6fd", x: 0.15, y: 0.51, rot: 0.18, w: 0.09, h: 0.08 },
    ];
    stickers.forEach((s) => {
        const sticker = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, 0.005), matteMat(s.color, 0.9));
        sticker.position.set(s.x, s.y, 0.02);
        sticker.rotation.z = s.rot;
        stand.add(sticker);
    });
    g.add(stand);

    const mailbox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.16), mailboxMat);
    mailbox.position.set(0.28, 0.14, 0.14);
    mailbox.rotation.y = -0.4;
    g.add(mailbox);

    const letter = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.006, 0.1), paperMat);
    letter.position.set(0.27, 0.24, 0.21);
    letter.rotation.set(0.35, -0.4, 0.1);
    g.add(letter);

    const droppedLetter = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.005, 0.11), paperMat);
    droppedLetter.position.set(0.1, 0.004, 0.26);
    droppedLetter.rotation.set(0.01, 0.6, -0.01);
    g.add(droppedLetter);

    // Завал собран в натуральных пропорциях доски и ящика и ужимается одним авторским
    // масштабом — так же, как раньше это делал fitSpan по правилу половины стороны. Держит
    // низ шкалы высот: верх −1 около 0.51, и +4 читается выше него с запасом.
    g.scale.setScalar(0.8);

    return fitSpan(g);
}

// 0 «Информирование»: один информационный стенд, положенный на поле почти плашмя.
// Ровно один цифровой канал и ровно в одну сторону: экран светится, но тускло и холодно,
// ответить в него нечем — ни клавиш, ни слота, ни второй стороны.
export function interaction2() {
    const g = new THREE.Group();

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.028, 0.3), matteMat("#94a3b8", 0.85));
    base.position.set(0, 0.014, 0);
    g.add(base);

    // Наклон почти горизонтальный: предмет уровня 0 лежит, а не стоит.
    const plaque = new THREE.Group();
    plaque.position.set(0, 0.075, 0.01);
    plaque.rotation.x = -1.28;

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.022), plasticMat("#64748b", 0.6));
    plaque.add(body);

    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.23, 0.006), screenMat("#8fb3c9", 0.35));
    screen.position.set(0, 0, 0.013);
    plaque.add(screen);

    // Содержимое: заголовок, лента новостей, картинка. Всё статичное и мёртвое.
    const header = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.026, 0.004), matteMat("#e2e8f0", 0.8));
    header.position.set(0, 0.085, 0.017);
    plaque.add(header);

    // Единственный акцент на уровне: тонкая полоса под заголовком.
    const rule = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.006, 0.004), plasticMat(ACCENT, 0.5));
    rule.position.set(0, 0.065, 0.017);
    plaque.add(rule);

    [
        { w: 0.26, y: 0.03 },
        { w: 0.22, y: 0.0 },
        { w: 0.28, y: -0.03 },
        { w: 0.18, y: -0.06 },
    ].forEach((row) => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(row.w, 0.013, 0.004), matteMat("#cbd5e1", 0.85));
        line.position.set(-(0.3 - row.w) / 2 + 0.02, row.y, 0.017);
        plaque.add(line);
    });

    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.055, 0.004), plasticMat("#7d8fa0", 0.7));
    thumb.position.set(0.13, -0.075, 0.017);
    plaque.add(thumb);

    g.add(plaque);

    // Значок соцсети на штырьке — второй и последний рупор вещания.
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 12), metalMat("#94a3b8", 0.5));
    post.position.set(0.17, 0.078, -0.11);
    g.add(post);

    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.01), plasticMat("#64748b", 0.55));
    badge.position.set(0.17, 0.16, -0.11);
    badge.rotation.y = 0.25;
    g.add(badge);

    return fitSpan(g);
}

// +1 «Транзакция»: две низкие приёмные тумбы друг напротив друга и два рельса обмена в
// просвете между ними, по каждому едет свой шестигранный жетон — заявка туда, ответ обратно.
// Силуэт парный, широкий и низкий: два тела и горизонтальная перемычка. Это принципиально
// другая природа, чем у одиночного вертикального тела +2, — уровень читается по числу тел,
// а не по картинке на корпусе. Кромки столешниц скруглены цилиндрами: вблизи видна фаска,
// а не голая коробка.
export function interaction3() {
    const g = new THREE.Group();

    const plinthMat = matteMat("#5b6875", 0.85);
    const bodyMat = plasticMat("#8794a3", 0.55);
    const topMat = metalMat("#aab6c2", 0.35);
    const rimMat = metalMat("#c8d1d9", 0.28);

    // dir = −1 подающая сторона, dir = +1 принимающая. Тумбы одинаковы по телу и различаются
    // только тем, что горит на пульте: слева поля заявки, справа принятый блок.
    const counter = (dir) => {
        const c = new THREE.Group();
        c.position.set(0.195 * dir, 0, 0);

        const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.026, 0.24), plinthMat);
        plinth.position.y = 0.013;
        c.add(plinth);

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.13, 0.225), bodyMat);
        body.position.y = 0.091;
        c.add(body);

        const top = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.016, 0.25), topMat);
        top.position.y = 0.164;
        c.add(top);

        // Скруглённые кромки столешницы — та самая фаска, ради которой предмет не коробка.
        [-0.125, 0.125].forEach((z) => {
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.20, 16), rimMat);
            rim.rotation.z = Math.PI / 2;
            rim.position.set(0, 0.164, z);
            c.add(rim);
        });

        // Стойка пульта на внутреннем крае: пульты смотрят друг на друга через просвет.
        const riser = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.062, 0.13), topMat);
        riser.position.set(-0.075 * dir, 0.203, 0);
        c.add(riser);

        const console3 = new THREE.Group();
        console3.position.set(-0.075 * dir, 0.253, 0);
        console3.rotation.z = -0.45 * dir;

        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.105, 0.155), bodyMat);
        console3.add(panel);

        const face = -0.0105 * dir;
        const screen = new THREE.Mesh(
            new THREE.BoxGeometry(0.005, 0.085, 0.13),
            screenMat(dir < 0 ? ACCENT_SOFT : ACCENT, dir < 0 ? 0.65 : 1.1)
        );
        screen.position.x = face;
        console3.add(screen);

        if (dir < 0) {
            // Подающая сторона: строки заполненной формы.
            [0.024, 0.0, -0.024].forEach((dz, i) => {
                const field = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.014, 0.095 - i * 0.018), matteMat("#f1f5f9", 0.85));
                field.position.set(face * 1.35, dz, 0);
                console3.add(field);
            });
        } else {
            // Принимающая сторона: один принятый блок.
            const accepted = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.05, 0.075), laserMat(ACCENT));
            accepted.position.set(face * 1.35, 0.005, 0);
            console3.add(accepted);
        }

        c.add(console3);
        return c;
    };

    g.add(counter(-1));
    g.add(counter(1));

    // Два рельса обмена в просвете и по жетону на каждом: обмен виден предметом, а не стрелкой.
    const rail = (y, z) => {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.24, 12), rimMat);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, y, z);
        g.add(bar);
    };
    rail(0.175, 0.05);
    rail(0.115, -0.05);

    const token = (x, y, z, color) => {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.026, 6), glassMat(color, ACCENT_DEEP));
        t.position.set(x, y, z);
        t.rotation.y = 0.4;
        g.add(t);
    };
    token(-0.035, 0.195, 0.05, ACCENT_SOFT);
    token(0.045, 0.135, -0.05, ACCENT);

    return fitSpan(g);
}

// +2 «Электронный результат»: одно цельное тело — гранёный сужающийся пилон с фасками,
// поясами и вершинным огнём. Экрана на корпусе нет намеренно: на +1 обмен был между двумя
// телами, здесь процесс замкнулся внутри одного, и наружу выходит только результат —
// отдельная парящая карточка с печатью, ни на что не опирающаяся. Восьмигранник, конусные
// фаски и кольца-пояса дают силуэт другой природы, чем парная низкая композиция +1.
export function interaction4() {
    const g = new THREE.Group();

    const stoneMat = plasticMat("#5f6b78", 0.45);
    const chamferMat = metalMat("#9fadba", 0.32);

    // Тело: цоколь — конусная фаска — сужающийся ствол — расширяющийся оголовок — венец.
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.205, 0.030, 8), chamferMat);
    base.position.y = 0.015;
    g.add(base);

    const chamfer = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.185, 0.026, 8), stoneMat);
    chamfer.position.y = 0.043;
    g.add(chamfer);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.155, 0.37, 8), stoneMat);
    shaft.position.y = 0.241;
    g.add(shaft);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.115, 0.022, 8), chamferMat);
    collar.position.y = 0.437;
    g.add(collar);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.138, 0.018, 8), chamferMat);
    crown.position.y = 0.457;
    g.add(crown);

    const apex = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 20), orbMat(ACCENT_SOFT));
    apex.position.y = 0.492;
    g.add(apex);

    // Пояса: тонкие светящиеся кольца по обхвату ствола на его радиусе в этой высоте.
    [
        [0.200, 0.144, 0.005],
        [0.370, 0.126, 0.004],
    ].forEach(([y, r, tube]) => {
        const band = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 32), laserMat(ACCENT));
        band.rotation.x = -Math.PI / 2;
        band.position.y = y;
        g.add(band);
    });

    // Три вкладки статуса на одной грани: процесс идёт сам, без окна и без клавиш.
    const faceAngle = Math.PI / 8;
    const faceR = (y) => (0.155 - ((y - 0.056) / 0.37) * 0.04) * Math.cos(Math.PI / 8);
    [0.220, 0.275, 0.330].forEach((y) => {
        const tab = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.016, 0.008), screenMat(ACCENT, 1.2));
        const r = faceR(y) + 0.002;
        tab.position.set(Math.sin(faceAngle) * r, y, Math.cos(faceAngle) * r);
        tab.rotation.y = faceAngle;
        g.add(tab);
    });

    // Выданный электронный результат: отдельная карточка, парящая рядом с пилоном.
    const card = new THREE.Group();
    card.position.set(0.09, 0.315, 0.20);
    card.rotation.set(-0.22, -0.38, 0.05);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.148, 0.004), plasticMat(ACCENT_DEEP, 0.4));
    card.add(frame);

    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.196, 0.130, 0.007), glassMat(ACCENT, ACCENT_DEEP));
    card.add(sheet);

    [0.034, 0.011, -0.012].forEach((dy, i) => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.10 - i * 0.018, 0.008, 0.004), matteMat("#f1f5f9", 0.8));
        line.position.set(-0.04, dy, 0.006);
        card.add(line);
    });

    const seal = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.006, 12, 28), laserMat(ACCENT));
    seal.position.set(0.052, -0.021, 0.007);
    card.add(seal);

    const tickLong = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.007, 0.006), laserMat(ACCENT));
    tickLong.position.set(0.056, -0.017, 0.008);
    tickLong.rotation.z = 0.9;
    card.add(tickLong);

    const tickShort = new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.007, 0.006), laserMat(ACCENT));
    tickShort.position.set(0.042, -0.025, 0.008);
    tickShort.rotation.z = -0.9;
    card.add(tickShort);

    g.add(card);

    return fitSpan(g);
}

// +3 «Интеллект»: приподнятая стеклянная дека прогноза. Кривая набора уходит вверх и
// заканчивается сияющей точкой горизонта, под ней столбики модели. Предмет уже оторван
// от поля (опоры нет, только светящийся круг под ним) и медленно вращается.
export function interaction5() {
    const g = new THREE.Group();

    // След на поле: подсветка вместо ножек.
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.006, 8, 48), laserMat(ACCENT_SOFT));
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(0, 0.006, 0);
    g.add(halo);

    const deck = new THREE.Group();
    deck.position.set(0, 0.3, 0);

    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.018, 32), glassMat(ACCENT, ACCENT_DEEP));
    deck.add(plate);

    // Столбики модели: факт растёт слева направо.
    [0.035, 0.055, 0.085, 0.115, 0.15].forEach((h, i) => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.032, h, 0.032), screenMat(ACCENT_SOFT, 0.75));
        bar.position.set(-0.14 + i * 0.07, 0.009 + h / 2, -0.085);
        deck.add(bar);
    });

    // Кривая прогноза.
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.185, 0.03, 0.03),
        new THREE.Vector3(-0.09, 0.055, 0.015),
        new THREE.Vector3(0.0, 0.105, 0.0),
        new THREE.Vector3(0.09, 0.175, 0.01),
        new THREE.Vector3(0.165, 0.235, 0.02),
    ]);
    const trace = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.008, 8, false), laserMat(ACCENT));
    deck.add(trace);

    // Точка горизонта прогноза.
    const horizon = new THREE.Mesh(new THREE.SphereGeometry(0.034, 24, 24), orbMat(ACCENT_SOFT));
    horizon.position.set(0.165, 0.235, 0.02);
    deck.add(horizon);

    // Две рекомендации — мелкие узлы у кривой.
    [
        [-0.09, 0.055, 0.015],
        [0.0, 0.105, 0.0],
    ].forEach((p) => {
        const node = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 16), orbMat(ACCENT));
        node.position.set(p[0], p[1], p[2]);
        deck.add(node);
    });

    spin(deck, 0.25);
    g.add(deck);

    return fitSpan(g);
}

// +4 «Проактивность»: раскрытая ладонь-чаша, отдающая светящийся пакет. Чаша из кораллового
// стекла парит над тумбой, наклонена раскрытой стороной наружу (к зрителю), над её краем висит
// гранёный пакет предложения, и от пакета веером уходят три траектории с вестниками. Клетка
// именно про это: организация обращается первой — кандидат уходит работодателю до вакансии,
// приглашение абитуриенту до заявления. Поэтому чаша не замкнута и ничего не удерживает:
// движение исходящее, вестники улетают за её край. По полю тумбы расходятся опережающие волны.
// Силуэт нарочно другой природы, чем у +3: там плоская горизонтальная дека-диск, здесь крупная
// наклонная полусфера со светящимся ободом и яркой точкой над ним — читается на обзоре.
export function interaction6() {
    const g = new THREE.Group();

    g.add(proactiveWaves(ACCENT));

    // Всё парящее висит одной группой: у деталей внутри своё движение, складывать его с общим
    // качанием нельзя.
    const offering = new THREE.Group();
    offering.position.set(0, 0.46, 0);

    // Чаша: не полусфера, а пологий сегмент сферы побольше — так силуэт шире и ниже, край
    // раскрыт, а не завёрнут внутрь. Профиль строится вершинами: наружная поверхность вверх и
    // внутренняя обратно, разница по вертикали и есть толщина стенки.
    const CUP_R = 0.30;
    const SPHERE_R = 0.34;
    const WALL = 0.02;
    const STEPS = 16;
    const depth = (r) => SPHERE_R - Math.sqrt(SPHERE_R * SPHERE_R - r * r);

    const profile = [];
    for (let i = 0; i <= STEPS; i += 1) {
        const r = (CUP_R * i) / STEPS;
        profile.push(new THREE.Vector2(r, depth(r)));
    }
    for (let i = STEPS; i >= 0; i -= 1) {
        const r = (CUP_R * i) / STEPS;
        profile.push(new THREE.Vector2(r, WALL + depth(r)));
    }

    // Наклон общий для чаши и обода: край должен остаться одной окружностью, а не разъехаться.
    const TILT = 0.38;
    const palm = new THREE.Group();
    palm.rotation.x = TILT;

    const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), glassMat(ACCENT, ACCENT_DEEP));
    palm.add(cup);

    // Обод — контур скульптуры на дальнем плане: на обзоре видно светящееся кольцо, даже когда
    // стекло чаши уже сливается с фоном.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(CUP_R, 0.009, 10, 48), laserMat(ACCENT));
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = depth(CUP_R) + WALL / 2;
    palm.add(rim);

    offering.add(palm);

    // Пакет предложения: гранёное стекло с ядром внутри, вынесен от центра раскрытого края по
    // его нормали — предложение уже покинуло ладонь, но ещё связано с ней.
    const mouthY = depth(CUP_R) * Math.cos(TILT);
    const mouthZ = depth(CUP_R) * Math.sin(TILT);
    const packet = new THREE.Group();
    packet.position.set(0, mouthY + 0.0928, mouthZ + 0.0371);

    const shell = new THREE.Mesh(new THREE.OctahedronGeometry(0.095), glassMat(ACCENT_SOFT, ACCENT));
    packet.add(shell);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), orbMat(ACCENT_SOFT));
    packet.add(core);

    packet.userData = {
        onFrame: (node, time) => {
            node.rotation.y = time * 0.5;
            const s = 1 + Math.sin(time * 2.4) * 0.07;
            node.scale.set(s, s, s);
        },
    };
    offering.add(packet);

    // Три траектории веером от пакета наружу и вверх, по каждой идёт вестник. Именно они
    // задают направление «от нас к человеку»: линии не возвращаются, а уходят за край чаши.
    [-0.75, 0, 0.75].forEach((az, i) => {
        const dx = Math.sin(az);
        const dz = Math.cos(az);
        const from = packet.position;
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(from.x, from.y, from.z),
            new THREE.Vector3(from.x + dx * 0.14, from.y + 0.030, from.z + dz * 0.14),
            new THREE.Vector3(from.x + dx * 0.28, from.y + 0.035, from.z + dz * 0.28),
        ]);

        const trace = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.005, 6, false), laserMat(ACCENT_SOFT));
        offering.add(trace);

        const messenger = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 16), orbMat(ACCENT));
        messenger.position.copy(curve.getPointAt(0));
        messenger.userData = {
            curve,
            offset: i / 3,
            onFrame: (node, time) => {
                const t = (time * 0.32 + node.userData.offset) % 1;
                node.position.copy(node.userData.curve.getPointAt(t));
                const s = 0.35 + Math.sin(t * Math.PI) * 0.9;
                node.scale.set(s, s, s);
            },
        };
        offering.add(messenger);
    });

    g.add(hover(offering, 0.03, 1.6));

    return fitSpan(g);
}

export default {
    1: interaction1,
    2: interaction2,
    3: interaction3,
    4: interaction4,
    5: interaction5,
    6: interaction6,
};
