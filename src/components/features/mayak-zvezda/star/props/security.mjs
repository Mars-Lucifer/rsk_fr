// Предметы луча «Защита данных» по шести уровням зрелости.
//
// Шкала луча — что именно охраняет доступ и кто его сторожит:
//  −1  чугунный замок со стикером-паролем: охрана вещественная, секрет наружу;
//   0  папка политики ИБ и одна статичная табличка: правило объявлено, ответа не ждут;
//  +1  считыватель карты и токен-брелок — два отдельных тела, между ними дуга обмена с пакетами:
//      вход двухфакторный, отвечают обе стороны; композиция парная, широкая и низкая;
//  +2  одна гранёная колонна криптомодуля и отдельно от неё выданный электронный аттестат
//      с печатью: тела одно, бумаги нет, результат уже выдан в цифре;
//  +3  приподнятая вращающаяся панель прогноза с кривой атак: система предсказывает, а не фиксирует;
//  +4  стеклянный гироскоп щита в левитации: защита работает до запроса, по тумбе идут волны.
// Силуэт меняется вместе с уровнем: лежит → лежит с табличкой → низкая пара с обменом → одна
// колонна с выданным аттестатом → парящая панель → парящая скульптура. Природа силуэта на +1 и
// +2 нарочно разная: там пара и обмен, здесь монолит и отделившийся от него результат.
// Палитра идёт от чугуна и картона к акценту #90c843.
//
// Поле тумбы остаётся чистым: ни колец подсветки, ни световых пятен, ни подставок под предмет.
// Единственное исключение на всю сцену — опережающие волны на +4.

import * as THREE from "three";
import {
    PAPER,
    CARDBOARD,
    GRAPHITE,
    matteMat,
    plasticMat,
    metalMat,
    screenMat,
    glassMat,
    laserMat,
    orbMat,
    proactiveWaves,
    spin,
    castAll,
} from "./shared.mjs";

const ACCENT = "#90c843";

// −1 «Хаос»: чугунный замок, стикер с паролем прямо на корпусе, связка ключей рядом.
// Корпус собран скруглённой призмой, а не коробкой: на крупном плане голая коробка читается
// макетом, а фаска по вертикальным рёбрам — литым чугуном. Связка подтянута к центру: раньше
// ключи уходили на 0.334 по x и накрывали цветное кольцо тумбы.
export function security1() {
    const g = new THREE.Group();

    const ironMat = plasticMat("#272e38", 0.88);
    const ironEdge = plasticMat("#333d4a", 0.85);
    const shackleMat = metalMat("#64748b", 0.5);
    const holeMat = matteMat("#10151c", 1.0);
    const stickerMat = matteMat("#fef08a", 0.9);
    const inkMat = matteMat("#334155", 0.95);
    const keyMat = metalMat("#94a3b8", 0.4);

    // Замок живёт в подгруппе: разворот корпуса не должен разъезжаться с фасками и скважиной.
    const lock = new THREE.Group();
    lock.position.set(-0.05, 0, 0);
    lock.rotation.y = 0.25;

    const W = 0.30;
    const H = 0.25;
    const D = 0.13;
    const R = 0.026;

    const slabX = new THREE.Mesh(new THREE.BoxGeometry(W - R * 2, H, D), ironMat);
    slabX.position.y = H / 2;
    lock.add(slabX);

    const slabZ = new THREE.Mesh(new THREE.BoxGeometry(W, H, D - R * 2), ironMat);
    slabZ.position.y = H / 2;
    lock.add(slabZ);

    [-1, 1].forEach((sx) => {
        [-1, 1].forEach((sz) => {
            const edge = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 12), ironEdge);
            edge.position.set(sx * (W / 2 - R), H / 2, sz * (D / 2 - R));
            lock.add(edge);
        });
    });

    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.026, 14, 28, Math.PI), shackleMat);
    shackle.position.y = H;
    shackle.rotation.z = Math.PI;
    lock.add(shackle);

    // Дужка входит в корпус двумя ногами: без них полукольцо висит на срезе.
    [-0.105, 0.105].forEach((x) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 14), shackleMat);
        leg.position.set(x, H - 0.024, 0);
        lock.add(leg);
    });

    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 18), holeMat);
    hole.position.set(0, 0.09, D / 2 - 0.002);
    hole.rotation.x = Math.PI / 2;
    lock.add(hole);

    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.042, 0.01), holeMat);
    slot.position.set(0, 0.063, D / 2 - 0.002);
    lock.add(slot);

    const sticker = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.10, 0.004), stickerMat);
    sticker.position.set(0.01, 0.165, D / 2 + 0.002);
    sticker.rotation.z = 0.08;
    lock.add(sticker);

    // Пароль написан от руки прямо на стикере: две строки — вся защита наружу.
    [0.02, -0.018].forEach((dy, i) => {
        const ink = new THREE.Mesh(new THREE.BoxGeometry(0.09 - i * 0.03, 0.009, 0.003), inkMat);
        ink.position.set(0.0 - i * 0.015, 0.165 + dy, D / 2 + 0.005);
        ink.rotation.z = 0.08;
        lock.add(ink);
    });

    g.add(lock);

    const ringAt = new THREE.Vector3(0.17, 0.012, 0.07);
    const keyRing = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 12, 28), keyMat);
    keyRing.position.copy(ringAt);
    keyRing.rotation.x = Math.PI / 2;
    g.add(keyRing);

    // Три ключа веером от кольца: одинаковые бородки, разная длина хвата — связка, а не гребёнка.
    [-0.55, -0.05, 0.45].forEach((a, i) => {
        const dx = Math.sin(a);
        const dz = Math.cos(a);
        const len = 0.10 + i * 0.008;

        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.005, len), keyMat);
        shaft.position.set(ringAt.x + dx * (0.04 + len / 2), 0.0125, ringAt.z + dz * (0.04 + len / 2));
        shaft.rotation.y = a;
        g.add(shaft);

        const bit = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.022), keyMat);
        bit.position.set(ringAt.x + dx * (0.04 + len - 0.006), 0.0125, ringAt.z + dz * (0.04 + len - 0.006));
        bit.rotation.y = a;
        g.add(bit);
    });

    return castAll(g);
}

// 0 «Информирование»: аккуратная папка утверждённой политики ИБ, на ней прислонённая табличка
// со статичным щитом «антивирус на всех ПК». Канал один и в одну сторону — экран ничего не спрашивает.
export function security2() {
    const g = new THREE.Group();

    const paperMat = matteMat(PAPER, 0.95);

    const folder = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.23), matteMat(CARDBOARD));
    folder.position.set(0, 0.015, 0.03);
    g.add(folder);

    // Корешок папки — цилиндр по левому ребру: картон сгибается, а не ломается под прямым углом.
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.23, 12), matteMat("#8f7452"));
    spine.position.set(-0.16, 0.015, 0.03);
    spine.rotation.x = Math.PI / 2;
    g.add(spine);

    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.004, 0.19), paperMat);
    sheet.position.set(0.015, 0.032, 0.04);
    g.add(sheet);

    // Приказ об ответственном — второй, тонкий и ровно уложенный документ со скрепкой.
    const order = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.014, 0.10), paperMat);
    order.position.set(-0.16, 0.007, -0.11);
    order.rotation.y = 0.12;
    g.add(order);

    const clip = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.003, 8, 20, Math.PI * 1.4), metalMat("#cbd5e1", 0.35));
    clip.position.set(-0.20, 0.015, -0.14);
    clip.rotation.set(Math.PI / 2, 0, 0.12);
    g.add(clip);

    const TILT = -0.42;
    const nz = [0, Math.sin(-TILT), Math.cos(TILT)];
    const at = (d) => [0.02, 0.115 + nz[1] * d, -0.07 + nz[2] * d];

    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.16, 0.008), plasticMat(GRAPHITE, 0.6));
    plate.position.set(...at(0));
    plate.rotation.x = TILT;
    g.add(plate);

    // Рамка таблички: два ребра сверху и снизу, две стойки по бокам — корпус, а не вырезанный лист.
    [-1, 1].forEach((s) => {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.23, 10), plasticMat("#2f3945", 0.55));
        const p = at(0);
        bar.position.set(p[0], p[1] + s * 0.08 * Math.cos(TILT), p[2] - s * 0.08 * Math.sin(TILT));
        bar.rotation.z = Math.PI / 2;
        g.add(bar);

        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.16, 10), plasticMat("#2f3945", 0.55));
        post.position.set(p[0] + s * 0.115, p[1], p[2]);
        post.rotation.x = TILT;
        g.add(post);
    });

    // Табличку кто-то прислонил: без подпорки она держалась бы в воздухе.
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.15), plasticMat("#2f3945", 0.6));
    prop.position.set(0.02, 0.062, -0.13);
    prop.rotation.x = 0.75;
    g.add(prop);

    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.125, 0.004), screenMat(ACCENT, 0.45));
    screen.position.set(...at(0.006));
    screen.rotation.x = TILT;
    g.add(screen);

    // Статичная иконка щита: единственное пятно акцента на этом уровне. Обод дан отдельным
    // кольцом — иконка на экране должна читаться и вплотную.
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.003, 6), screenMat(ACCENT, 1.4));
    shield.position.set(...at(0.01));
    shield.rotation.set(TILT + Math.PI / 2, 0, 0);
    g.add(shield);

    const shieldRim = new THREE.Mesh(new THREE.TorusGeometry(0.037, 0.0035, 8, 6), laserMat("#a3e635"));
    shieldRim.position.set(...at(0.011));
    shieldRim.rotation.set(TILT, 0, 0);
    g.add(shieldRim);

    // Подпись под щитом: строка объявления, на которую никто не отвечает.
    [0.045, 0.062].forEach((down, i) => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.11 - i * 0.04, 0.007, 0.003), screenMat(ACCENT, 0.8));
        const p = at(0.009);
        line.position.set(p[0], p[1] - down * Math.cos(TILT), p[2] + down * Math.sin(TILT));
        line.rotation.x = TILT;
        g.add(line);
    });

    return castAll(g);
}

// +1 «Транзакция»: слева — лежачий считыватель карты со вставленным пропуском, справа —
// токен-брелок, генерирующий код. Два отдельных тела, разнесённых по столешнице, и живой обмен
// между ними: дуга с наконечниками на обоих концах и пакеты, идущие по ней. Композиция нарочно
// парная, широкая и низкая — с +2 её не спутать ни силуэтом, ни высотой.
export function security3() {
    const g = new THREE.Group();

    const caseMat = plasticMat("#48545f", 0.6);
    const caseEdge = plasticMat("#5b6874", 0.55);
    const darkMat = plasticMat("#232a33", 0.8);
    const beamMat = laserMat("#a3e635");

    // ── Считыватель: клин с наклонной верхней панелью, скруглённый по переднему и заднему ребру.
    const reader = new THREE.Group();
    reader.position.set(-0.195, 0, 0.01);
    reader.rotation.y = 0.22;

    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.055, 0.155), caseMat);
    hull.position.y = 0.0275;
    reader.add(hull);

    [-1, 1].forEach((s) => {
        const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.0275, 0.0275, 0.23, 14), caseEdge);
        edge.position.set(0, 0.0275, s * 0.0775);
        edge.rotation.z = Math.PI / 2;
        reader.add(edge);
    });

    const PANEL_TILT = -0.24;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.014, 0.15), caseEdge);
    panel.position.set(0, 0.062, 0);
    panel.rotation.x = PANEL_TILT;
    reader.add(panel);

    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.02), darkMat);
    gate.position.set(0, 0.073, -0.03);
    gate.rotation.x = PANEL_TILT;
    reader.add(gate);

    // Пропуск наполовину в щели: транзакция идёт прямо сейчас, а не «предусмотрена регламентом».
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.005, 0.075), plasticMat("#e2e8f0", 0.5));
    card.position.set(0.005, 0.086, -0.005);
    card.rotation.x = PANEL_TILT;
    reader.add(card);

    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.004, 0.018), metalMat("#d4b25a", 0.35));
    chip.position.set(-0.03, 0.091, 0.012);
    chip.rotation.x = PANEL_TILT;
    reader.add(chip);

    [-0.07, -0.045].forEach((x, i) => {
        const led = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 14), screenMat(ACCENT, i ? 0.3 : 1.6));
        led.position.set(x, 0.077, 0.05);
        led.rotation.x = PANEL_TILT;
        reader.add(led);
    });

    g.add(reader);

    // ── Токен: брелок с закруглённой макушкой, экраном кода и кнопкой запроса.
    const token = new THREE.Group();
    // Наклон брелока даёт под ним просвет: корпус приподнят ровно на этот срез, иначе угол
    // уходит в столешницу.
    token.position.set(0.205, 0.004, -0.02);
    token.rotation.set(0, -0.35, 0.07);

    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.125, 0.042), plasticMat("#7c8899", 0.5));
    shell.position.y = 0.0625;
    token.add(shell);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.042, 20), plasticMat("#7c8899", 0.5));
    crown.position.y = 0.125;
    crown.rotation.x = Math.PI / 2;
    token.add(crown);

    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.005, 8, 20), metalMat("#cbd5e1", 0.35));
    eye.position.y = 0.166;
    token.add(eye);

    const face = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.042, 0.004), screenMat(ACCENT, 1.1));
    face.position.set(0, 0.115, 0.022);
    token.add(face);

    // Код из трёх групп цифр: то, чем токен отвечает на запрос считывателя.
    [-0.02, 0.0, 0.02].forEach((x, i) => {
        const digit = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.019 - i * 0.003, 0.003), beamMat);
        digit.position.set(x, 0.115, 0.025);
        token.add(digit);
    });

    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.008, 18), plasticMat("#39424d", 0.6));
    button.position.set(0, 0.055, 0.021);
    button.rotation.x = Math.PI / 2;
    token.add(button);

    g.add(token);

    // ── Обмен: дуга от считывателя к токену, наконечники на обоих концах, два пакета в пути.
    const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.20, 0.10, 0.0),
        new THREE.Vector3(-0.10, 0.24, 0.0),
        new THREE.Vector3(0.06, 0.275, -0.01),
        new THREE.Vector3(0.20, 0.20, -0.02),
    ]);
    const link = new THREE.Mesh(new THREE.TubeGeometry(path, 48, 0.007, 8, false), beamMat);
    g.add(link);

    [0.06, 0.94].forEach((t) => {
        const p = path.getPointAt(t);
        const d = path.getTangentAt(t).multiplyScalar(t < 0.5 ? -1 : 1);
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.052, 16), beamMat);
        head.position.copy(p);
        head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
        g.add(head);
    });

    [0.34, 0.66].forEach((t) => {
        const p = path.getPointAt(t);
        const packet = new THREE.Mesh(new THREE.OctahedronGeometry(0.018, 0), orbMat("#ffffff"));
        packet.position.copy(p);
        g.add(packet);
    });

    return castAll(g);
}

// +2 «Электронный результат»: одна цельная гранёная колонна криптомодуля — глухой корпус без
// экранов и лампочек, наружу выходит только щель света. Рядом, отделившись от неё, висит сам
// выданный результат: электронный аттестат с печатью и подписью. Тело здесь одно, и природа
// силуэта другая, чем на +1: там пара и обмен, здесь монолит и то, что он уже выдал.
export function security4() {
    const g = new THREE.Group();

    const shellMat = metalMat("#3a4552", 0.42);
    const shellDark = plasticMat("#2a333e", 0.7);

    // Восьмигранник разворачивается на полграни: иначе к зрителю выходит ребро и колонна
    // читается трубой.
    const oct = (rTop, rBot, h, y, mat) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 8), mat);
        m.position.set(-0.05, y, 0);
        m.rotation.y = Math.PI / 8;
        return m;
    };

    g.add(oct(0.125, 0.145, 0.035, 0.0175, shellMat));
    g.add(oct(0.125, 0.125, 0.40, 0.235, shellMat));
    g.add(oct(0.10, 0.125, 0.05, 0.46, shellMat));
    g.add(oct(0.098, 0.10, 0.024, 0.497, shellDark));

    // Две утопленные ленты по граням: корпус собран из секций, а не отлит одной палкой.
    [0.15, 0.35].forEach((y) => g.add(oct(0.129, 0.129, 0.013, y, shellDark)));

    // Грань восьмигранника ближе оси на cos(π/8) — щель кладётся именно на неё, не в воздух.
    const FACE = 0.125 * Math.cos(Math.PI / 8);

    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.24, 0.005), screenMat(ACCENT, 1.7));
    slit.position.set(-0.05, 0.25, FACE + 0.003);
    g.add(slit);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.005, 24), screenMat(ACCENT, 1.5));
    crown.position.set(-0.05, 0.511, 0);
    g.add(crown);

    // ── Выданный результат: аттестат отделился от колонны и висит рядом.
    const cert = new THREE.Group();
    cert.position.set(0.155, 0.53, 0.045);
    cert.rotation.set(-0.1, -0.5, 0.05);

    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.145, 0.007), glassMat(ACCENT, "#3f6212"));
    cert.add(sheet);

    const frameMat = laserMat("#a3e635");
    [-1, 1].forEach((s) => {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.21, 8), frameMat);
        bar.position.y = s * 0.0725;
        bar.rotation.z = Math.PI / 2;
        cert.add(bar);

        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.145, 8), frameMat);
        post.position.x = s * 0.105;
        cert.add(post);
    });

    // Строки заключения: короткие, разной длины — документ, а не пустое стекло.
    [0.042, 0.016, -0.01].forEach((y, i) => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.115 - i * 0.025, 0.007, 0.003), screenMat(ACCENT, 1.2));
        line.position.set(-0.03 - i * 0.012, y, 0.005);
        cert.add(line);
    });

    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.008, 6), glassMat("#bef264", "#4d7c0f"));
    seal.position.set(0.055, -0.035, 0.006);
    seal.rotation.x = Math.PI / 2;
    cert.add(seal);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.004, 8, 6), frameMat);
    rim.position.set(0.055, -0.035, 0.008);
    cert.add(rim);

    // Галочка внутри печати — подпись поставлена, результат выдан.
    const tickShort = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.007, 0.004), laserMat("#bef264"));
    tickShort.position.set(0.044, -0.041, 0.014);
    tickShort.rotation.z = 0.9;
    cert.add(tickShort);

    const tickLong = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.007, 0.004), laserMat("#bef264"));
    tickLong.position.set(0.062, -0.031, 0.014);
    tickLong.rotation.z = -0.75;
    cert.add(tickLong);

    g.add(cert);

    // Луч выдачи: результат вышел из колонны, а не появился сам по себе.
    const issue = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.17, 8), frameMat);
    issue.position.set(0.045, 0.505, 0.02);
    issue.rotation.set(0, 0, -1.25);
    g.add(issue);

    return castAll(g);
}

// +3 «Интеллект»: приподнятая над тумбой панель предиктивной модели. Кривая роста угрозы,
// две подсвеченные аномалии на ней и обод горизонта прогноза; вся панель медленно вращается.
export function security5() {
    const g = new THREE.Group();

    const model = new THREE.Group();
    model.position.set(0, 0.44, 0);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.20, 0.012), glassMat(ACCENT, "#3f6212"));
    model.add(panel);

    // Рамка панели со скруглёнными углами: без неё стекло обрывается голым срезом.
    const frameMat = laserMat("#a3e635");
    [-1, 1].forEach((s) => {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.34, 8), frameMat);
        bar.position.y = s * 0.10;
        bar.rotation.z = Math.PI / 2;
        model.add(bar);

        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.20, 8), frameMat);
        post.position.x = s * 0.17;
        model.add(post);

        [-1, 1].forEach((t) => {
            const corner = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 10), frameMat);
            corner.position.set(s * 0.17, t * 0.10, 0);
            model.add(corner);
        });
    });

    // Насечки шкалы времени по нижнему краю: прогноз читается с делениями, а не на глаз.
    [-0.09, 0.0, 0.09].forEach((x) => {
        const tick = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.018, 0.004), frameMat);
        tick.position.set(x, -0.086, 0.008);
        model.add(tick);
    });

    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.15, -0.055, 0),
        new THREE.Vector3(-0.07, 0.005, 0),
        new THREE.Vector3(0.0, -0.025, 0),
        new THREE.Vector3(0.07, 0.045, 0),
        new THREE.Vector3(0.15, 0.085, 0),
    ]);
    const trace = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.008, 8, false), laserMat("#a3e635"));
    trace.position.z = 0.012;
    model.add(trace);

    [0.42, 0.88].forEach((t) => {
        const p = curve.getPointAt(t);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.018, 20, 20), orbMat("#ffffff"));
        orb.position.set(p.x, p.y, 0.018);
        model.add(orb);
    });

    const horizon = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.006, 10, 48), laserMat("#bef264"));
    model.add(horizon);

    g.add(spin(model, 0.25));

    // Светового пятна под моделью нет: поле тумбы остаётся чистым, подсветка на нём есть только
    // у +4 (опережающие волны) и там означает действие, а не тень.
    return castAll(g);
}

// +4 «Проактивность»: квантовый гироскоп защиты. Два стеклянных кольца, гранёный кристалл
// с ядром щита, лазерная орбита и сфера-страж; по тумбе расходятся опережающие волны.
// Композиция перенесена из testProps.securityProactive без изменений.
export function security6() {
    const g = new THREE.Group();

    const emeraldGlassMat = glassMat(ACCENT, "#3f6212");
    const trailMat = laserMat("#a3e635");
    const shieldMat = laserMat("#bef264");
    const sentinelMat = orbMat("#ffffff");

    const groupShield = new THREE.Group();

    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.034, 24, 64), emeraldGlassMat);
    ring1.userData = {
        onFrame: (node, time) => {
            node.rotation.y = time * 0.45;
        },
    };
    groupShield.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.034, 24, 64), emeraldGlassMat);
    ring2.rotation.x = Math.PI / 2 - 0.2;
    ring2.userData = {
        onFrame: (node, time) => {
            node.rotation.z = -time * 0.4;
            node.rotation.x = Math.PI / 2 - 0.2 + Math.sin(time * 1.5) * 0.08;
        },
    };
    groupShield.add(ring2);

    const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), glassMat("#bef264", "#4d7c0f"));
    crystal.userData = {
        onFrame: (node, time) => {
            node.rotation.y = time * 0.7;
            node.rotation.x = time * 0.35;
        },
    };
    groupShield.add(crystal);

    const shield = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), shieldMat);
    shield.userData = {
        onFrame: (node, time) => {
            const s = 1.0 + Math.sin(time * 3.5) * 0.12;
            node.scale.set(s, s, s);
            node.rotation.y = time * 0.9;
        },
    };
    groupShield.add(shield);

    const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.005, 12, 64), trailMat);
    orbit.rotation.set(0.35, 0.45, 0);
    orbit.userData = {
        onFrame: (node, time) => {
            node.rotation.z = time * 0.35;
        },
    };
    groupShield.add(orbit);

    const sentinel = new THREE.Mesh(new THREE.SphereGeometry(0.036, 24, 24), sentinelMat);
    sentinel.userData = {
        onFrame: (node, time) => {
            const a = time * 2.0;
            const r = 0.44;
            node.position.set(Math.cos(a) * r, Math.sin(a) * r * Math.sin(0.45), Math.sin(a) * r * Math.cos(0.45));
            const s = 1.0 + Math.sin(time * 5.0) * 0.12;
            node.scale.set(s, s, s);
        },
    };
    groupShield.add(sentinel);

    // Высота подобрана вместе с качанием: габарит скульптуры по вертикали 0.486 в каждую
    // сторону, и на верхней точке качания она обязана остаться под потолком сцены (1.0).
    groupShield.position.set(0, 0.49, 0);
    groupShield.userData = {
        onFrame: (node, time) => {
            node.position.y = 0.49 + Math.sin(time * 2.0) * 0.016;
        },
    };

    // Тени вешаются на скульптуру, но не на волны: волна — свет по полю, а не тело.
    castAll(groupShield);

    g.add(proactiveWaves(ACCENT));
    g.add(groupShield);

    return g;
}

export default { 1: security1, 2: security2, 3: security3, 4: security4, 5: security5, 6: security6 };
