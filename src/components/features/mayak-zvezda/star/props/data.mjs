// Предметы луча «Данные и аналитика» по шести уровням зрелости.
//
// Луч читается по одному признаку: где живёт число и кто его считает.
// −1 — число заперто в бумаге картотеки; 0 — принтер раз в месяц печатает его в лоток;
// +1 — за ним приходят: два отдельных тела, заявитель и служба, и обмен между ними;
// +2 — система сама выдаёт результат: гранёный пилон выпускает справку с печатью;
// +3 — модель считает не число, а его причину и продолжение (сфера прогноза приподнята);
// +4 — числа больше нет как предмета, есть парящая призма предикта и волны опережения.
// Силуэт идёт завал → лоток → пара тел → одиночный пилон → сфера → левитация, а палитра —
// от серо-бурого картона к чистому #0eb4ea.
//
// Отдельное правило посадки: на поле тумбы не лежит ничего плоского — ни площадок, ни
// колец, ни подкладок под предмет. Тумба сама себе основание, и любое пятно на ней читается
// с камеры как грязь на столешнице. Единственное исключение — волны proactiveWaves на +4:
// там опережающая волна и есть содержание уровня.

import * as THREE from "three";

import {
    FLOAT_BASE,
    PAPER,
    PROP_MAX_HEIGHT,
    PROP_SPAN,
    castAll,
    glassMat,
    hover,
    laserMat,
    matteMat,
    metalMat,
    orbMat,
    plasticMat,
    proactiveWaves,
    screenMat,
    spin,
} from "./shared.mjs";

const ACCENT = "#0eb4ea";

// Подгонка композиции под поле тумбы. Процедурные предметы, в отличие от GLB, снаружи не
// масштабируются (см. fitToPedestal в Props.js) — поэтому у перенесённых из testProps
// уровней −1 и +4 подгонка живёт внутри предмета. Масштаб равномерный: пропорции и вид
// сохраняются, меняется только посадка на тумбу.
function fit(group, base = 0, top = PROP_MAX_HEIGHT) {
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = Math.min(
        // Минус миллиметр: ровно в границу вписанный предмет вылезает на округлении.
        (PROP_SPAN * 2 - 0.002) / Math.max(size.x, size.z, 1e-6),
        (top - base) / Math.max(size.y, 1e-6),
        1
    );
    group.scale.setScalar(k);
    group.position.set(-center.x * k, base - box.min.y * k, -center.z * k);
    group.updateMatrixWorld(true);
    return group;
}

// −1 «Хаос»: архивный картотечный шкаф с выдвинутым ящиком, выпадающими папками и
// упавшим на пол документом. Перенесено из testProps.dataChaos без изменений вида.
export function data1() {
    const g = new THREE.Group();
    const inner = new THREE.Group();

    const cabinetMat = plasticMat("#2d333d", 0.88);
    const drawerMat = plasticMat("#373e4b", 0.85);
    const handleMat = metalMat("#a8b0bd", 0.4);
    const paperMat = matteMat(PAPER, 0.95);
    const folderMat = matteMat("#d8c7a5", 0.9);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.96, 0.46), cabinetMat);
    body.position.set(0, 0.48, 0);
    inner.add(body);

    [0.15, 0.37, 0.59, 0.81].forEach((y, idx) => {
        const isExtended = idx === 2;
        const dz = isExtended ? 0.16 : 0;

        const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.19, isExtended ? 0.42 : 0.03), drawerMat);
        drawer.position.set(0, y, isExtended ? 0.23 + dz / 2 : 0.235);
        inner.add(drawer);

        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.022, 0.02), handleMat);
        handle.position.set(0, y, isExtended ? 0.23 + dz + 0.015 : 0.255);
        inner.add(handle);

        const labelPlate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.005), handleMat);
        labelPlate.position.set(0, y + 0.045, isExtended ? 0.23 + dz + 0.005 : 0.252);
        inner.add(labelPlate);

        if (!isExtended) return;

        const folder = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.04), folderMat);
        folder.position.set(-0.04, y + 0.06, 0.32);
        folder.rotation.set(-0.25, 0.1, 0.05);
        inner.add(folder);

        const hangingSheet = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.008, 0.28), paperMat);
        hangingSheet.position.set(0.08, y + 0.09, 0.42);
        hangingSheet.rotation.set(0.42, -0.15, -0.1);
        inner.add(hangingSheet);
    });

    [
        { w: 0.38, h: 0.04, d: 0.32, y: 0.98, rot: 0.04, dx: -0.04, dz: 0.02 },
        { w: 0.36, h: 0.038, d: 0.3, y: 1.02, rot: -0.09, dx: -0.02, dz: 0.04 },
    ].forEach((f) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(f.w, f.h, f.d), folderMat);
        m.position.set(f.dx, f.y, f.dz);
        m.rotation.y = f.rot;
        inner.add(m);
    });

    const floorSheet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.006, 0.24), paperMat);
    floorSheet.position.set(0.34, 0.005, 0.18);
    floorSheet.rotation.set(0.01, 0.45, -0.02);
    inner.add(floorSheet);

    // Потолок 0.56, а не общий PROP_MAX_HEIGHT: шкала луча должна читаться сверху вниз, и
    // картотека −1 обязана быть заметно ниже левитации +4. Вписанный по ширине шкаф давал
    // 0.76 — верх шкалы переставал отличаться от её низа.
    g.add(fit(inner, 0, 0.56));
    return castAll(g);
}

// 0 «Информирование»: печатающий блок и лоток с ровной стопкой отчётов. Канал ровно один
// и в одну сторону — лист выходит из щели и ложится в стопку, обратно ничего не идёт.
//
// Лоток здесь с бортами, а не плитой: плоская пластина на поле тумбы читается с камеры не
// предметом, а подкладкой под предмет.
export function data2() {
    const g = new THREE.Group();

    const trayMat = plasticMat("#8f97a3", 0.6);
    const railMat = metalMat("#aeb6c2", 0.42);
    const paperMat = matteMat(PAPER, 0.95);
    const boxMat = plasticMat("#6b7280", 0.65);
    const darkMat = plasticMat("#2b323c", 0.7);
    const inkMat = matteMat(ACCENT, 0.7);

    // Лоток: дно и три борта. Открытая сторона смотрит к принтеру — туда и выезжает лист.
    const floor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.016, 0.26), trayMat);
    floor.position.set(-0.15, 0.008, 0.01);
    g.add(floor);

    [-0.135, 0.135].forEach((dz) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.034, 0.012), railMat);
        rail.position.set(-0.15, 0.017, 0.01 + dz);
        g.add(rail);
    });

    const backRail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.034, 0.26), railMat);
    backRail.position.set(-0.294, 0.017, 0.01);
    g.add(backRail);

    // Ровная стопка: тот же завал, что на −1, но выровненный по шаблону.
    [0, 1, 2, 3].forEach((i) => {
        const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.011, 0.2), paperMat);
        sheet.position.set(-0.152 + (i % 2) * 0.004, 0.022 + i * 0.012, 0.01 - (i % 2) * 0.003);
        g.add(sheet);
    });

    // Печатная гистограмма на верхнем листе: цифра здесь пока плоская, как краска.
    [0.05, 0.085, 0.062].forEach((len, i) => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.004, len), inkMat);
        bar.position.set(-0.222 + i * 0.04, 0.074, 0.05 - len / 2);
        g.add(bar);
    });

    // Печатающий блок. Верхняя плита шире корпуса — карниз даёт кромке свет и снимает
    // ощущение голой коробки.
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.115, 0.22), boxMat);
    body.position.set(0.185, 0.0575, -0.01);
    g.add(body);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.016, 0.235), railMat);
    cap.position.set(0.185, 0.123, -0.01);
    g.add(cap);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.014, 0.23), darkMat);
    plinth.position.set(0.185, 0.007, -0.01);
    g.add(plinth);

    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.17), darkMat);
    slot.position.set(0.085, 0.072, -0.01);
    g.add(slot);

    // Выходящий лист: связка «машина → бумага» видна физически, стрелку рисовать не нужно.
    const outgoing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.007, 0.19), paperMat);
    outgoing.position.set(0.015, 0.061, 0.0);
    outgoing.rotation.z = 0.1;
    g.add(outgoing);

    const guide = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.006, 0.2), railMat);
    guide.position.set(0.03, 0.042, 0.0);
    guide.rotation.z = 0.1;
    g.add(guide);

    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.06), matteMat(ACCENT, 0.5));
    lamp.position.set(0.085, 0.098, 0.06);
    g.add(lamp);

    return castAll(g);
}

// +1 «Транзакция»: два отдельных тела и обмен между ними. Слева — терминал заявителя
// с формой на наклонной панели, справа — приёмный блок службы с щелью и лампами.
// Между ними идут две встречные стрелки: яркая вправо (запрос) и бледная влево (ответ).
//
// Композиция намеренно парная, широкая и невысокая: уровень +1 отличается от +2 не
// количеством экранов, а тем, что сторон здесь две и они разговаривают. Одиночная стойка
// с экраном на этом месте была неотличима от следующего уровня.
export function data3() {
    const g = new THREE.Group();

    const caseMat = plasticMat("#7c8794", 0.55);
    const edgeMat = metalMat("#aeb6c2", 0.4);
    const darkMat = plasticMat("#262c35", 0.7);
    const face = screenMat(ACCENT, 0.75);
    const rowMat = matteMat("#bfe9f8", 0.6);
    const bright = laserMat("#5cf1ff");
    const pale = plasticMat("#9fd8ee", 0.4);

    // Сторона заявителя.
    const leftX = -0.235;

    const leftPlinth = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.022, 0.195), darkMat);
    leftPlinth.position.set(leftX, 0.011, 0);
    g.add(leftPlinth);

    const leftBody = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.15, 0.17), caseMat);
    leftBody.position.set(leftX, 0.097, 0);
    g.add(leftBody);

    // Скругление вертикальных рёбер: без него корпус читается плашкой даже вблизи.
    [-1, 1].forEach((sx) =>
        [-1, 1].forEach((sz) => {
            const round = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.15, 12), edgeMat);
            round.position.set(leftX + sx * 0.105, 0.097, sz * 0.085);
            g.add(round);
        })
    );

    const leftCap = new THREE.Mesh(new THREE.BoxGeometry(0.228, 0.014, 0.188), edgeMat);
    leftCap.position.set(leftX, 0.179, 0);
    g.add(leftCap);

    const panel = new THREE.Group();
    panel.position.set(leftX, 0.265, 0.028);
    panel.rotation.x = -0.5;

    panel.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.022), caseMat));

    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.006), face);
    screen.position.set(0, 0, 0.014);
    panel.add(screen);

    // Строки формы: три поля ввода и кнопка отправки.
    [0.04, 0.005, -0.03].forEach((y) => {
        const row = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.004), rowMat);
        row.position.set(-0.015, y, 0.019);
        panel.add(row);
    });

    const submit = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.006), matteMat(ACCENT, 0.45));
    submit.position.set(0.05, -0.058, 0.019);
    panel.add(submit);

    g.add(panel);

    // Сторона службы: тело выше и уже, с круглой головой — силуэты пары не близнецы.
    const rightX = 0.235;

    const rightPlinth = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.022, 0.195), darkMat);
    rightPlinth.position.set(rightX, 0.011, 0);
    g.add(rightPlinth);

    const rightBody = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.26, 0.17), caseMat);
    rightBody.position.set(rightX, 0.152, 0);
    g.add(rightBody);

    [-1, 1].forEach((sx) =>
        [-1, 1].forEach((sz) => {
            const round = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.26, 12), edgeMat);
            round.position.set(rightX + sx * 0.095, 0.152, sz * 0.085);
            g.add(round);
        })
    );

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.105, 0.03, 24), edgeMat);
    head.position.set(rightX, 0.297, 0);
    g.add(head);

    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.016, 0.012), darkMat);
    slot.position.set(rightX, 0.2, 0.087);
    g.add(slot);

    [-0.045, 0.045].forEach((dx) => {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.006), matteMat(ACCENT, 0.45));
        lamp.position.set(rightX + dx, 0.25, 0.087);
        g.add(lamp);
    });

    // Обмен: две встречные стрелки на разной высоте. Запрос яркий, ответ бледный.
    const request = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.014, 0.014), bright);
    request.position.set(-0.02, 0.245, 0);
    g.add(request);

    const requestHead = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.05, 14), bright);
    requestHead.position.set(0.09, 0.245, 0);
    requestHead.rotation.z = -Math.PI / 2;
    g.add(requestHead);

    const answer = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.011, 0.011), pale);
    answer.position.set(0.02, 0.14, 0);
    g.add(answer);

    const answerHead = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.045, 14), pale);
    answerHead.position.set(-0.088, 0.14, 0);
    answerHead.rotation.z = Math.PI / 2;
    g.add(answerHead);

    return castAll(g);
}

// +2 «Электронный результат»: одно цельное тело — гранёный пилон выдачи, увенчанный
// печатью системы, — и выехавшая из его щели электронная справка с печатью и кодом.
//
// Здесь намеренно нет ни экрана, ни второй стойки: на +1 сторон две и они обмениваются,
// на +2 сторона одна и она выдаёт. Восьмигранник против прямоугольных корпусов соседнего
// уровня даёт разницу силуэта даже на общем плане.
export function data4() {
    const g = new THREE.Group();

    const metal = metalMat("#8a93a0", 0.4);
    const shellMat = plasticMat("#39424f", 0.5);
    const darkMat = plasticMat("#20262e", 0.7);
    const glow = laserMat(ACCENT);

    // Грань, а не ребро, смотрит на камеру: thetaStart разворачивает восьмигранник так,
    // чтобы фронтальная плоскость была плоской — на неё садятся щель и табло.
    const FACET = Math.PI / 8;
    const octa = (rTop, rBottom, h) => new THREE.CylinderGeometry(rTop, rBottom, h, 8, 1, false, FACET);

    const foot = new THREE.Mesh(octa(0.2, 0.215, 0.03), metal);
    foot.position.set(0, 0.015, 0);
    g.add(foot);

    const body = new THREE.Mesh(octa(0.185, 0.185, 0.4), shellMat);
    body.position.set(0, 0.23, 0);
    g.add(body);

    // Светящиеся швы по корпусу: цифра здесь уже внутри тела, а не напечатана снаружи.
    [0.13, 0.4].forEach((y) => {
        const seam = new THREE.Mesh(octa(0.192, 0.192, 0.009), glow);
        seam.position.set(0, y, 0);
        g.add(seam);
    });

    // Вертикальные накладки на боковых гранях — фактура, различимая при подлёте камеры.
    [-1, 1].forEach((sx) => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.34, 0.07), metal);
        strip.position.set(sx * 0.175, 0.24, 0);
        g.add(strip);
    });

    const collar = new THREE.Mesh(octa(0.16, 0.196, 0.035), metal);
    collar.position.set(0, 0.4475, 0);
    g.add(collar);

    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 24), metal);
    deck.position.set(0, 0.471, 0);
    g.add(deck);

    // Печать системы на макушке: результат заверен машиной, а не подписью на бумаге.
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 12), metal);
    stem.position.set(0, 0.502, 0);
    g.add(stem);

    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.014, 24), glow);
    emblem.position.set(0, 0.534, 0);
    g.add(emblem);

    const emblemRing = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 8, 28), metal);
    emblemRing.position.set(0, 0.545, 0);
    emblemRing.rotation.x = Math.PI / 2;
    g.add(emblemRing);

    // Табло выдачи: не дашборд, а короткая строка номера — на нём ничего не анализируют.
    const readout = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.012), screenMat(ACCENT, 0.55));
    readout.position.set(0, 0.2, 0.174);
    g.add(readout);

    [0.012, -0.006].forEach((y) => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.008, 0.004), matteMat("#bfe9f8", 0.6));
        line.position.set(-0.01, 0.2 + y, 0.182);
        g.add(line);
    });

    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.016, 0.014), darkMat);
    slot.position.set(0, 0.33, 0.174);
    g.add(slot);

    // Выданный электронный результат: справка выехала из щели и стоит в ней.
    const card = new THREE.Group();
    card.position.set(0, 0.422, 0.224);
    card.rotation.x = 0.4;

    card.add(new THREE.Mesh(new THREE.BoxGeometry(0.162, 0.212, 0.004), plasticMat(ACCENT, 0.45)));

    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.007), matteMat("#eef6fb", 0.85));
    sheet.position.set(0, 0, 0.003);
    card.add(sheet);

    [0.06, 0.035, 0.01].forEach((y) => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.009, 0.003), matteMat("#94a3b8", 0.8));
        line.position.set(-0.02, y, 0.008);
        card.add(line);
    });

    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.005, 24), glow);
    seal.position.set(0.04, -0.055, 0.009);
    seal.rotation.x = Math.PI / 2;
    card.add(seal);

    const sealRing = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.004, 8, 24), matteMat("#eef6fb", 0.8));
    sealRing.position.set(0.04, -0.055, 0.012);
    card.add(sealRing);

    const code = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.003), plasticMat("#28313d", 0.6));
    code.position.set(-0.045, -0.055, 0.008);
    card.add(code);

    g.add(card);

    return castAll(g);
}

// +3 «Интеллект»: модель прогноза. Стеклянное ядро висит над тумбой без всякой опоры,
// медленно вращается, вокруг идут орбиты факторов со связями к ядру, а наружу уходит кривая
// прогноза с точкой горизонта — предмет впервые отвечает не «сколько», а «что будет и почему».
//
// Контактной площадки под ядром больше нет: круглая плита на поле тумбы читалась с камеры
// тёмным пятном на столешнице и вдобавок отменяла главный признак уровня — предмет уже
// оторвался от опоры.
export function data5() {
    const g = new THREE.Group();

    const float = new THREE.Group();
    float.position.set(0, 0.0, 0);

    const model = new THREE.Group();

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 24), glassMat(ACCENT, "#0284c7"));
    core.position.set(0, 0.44, 0);
    model.add(core);

    const ringGeo = new THREE.TorusGeometry(0.185, 0.006, 8, 40);
    [
        [Math.PI / 2 - 0.35, 0.4],
        [Math.PI / 2 + 0.5, -0.7],
    ].forEach(([rx, rz]) => {
        const ring = new THREE.Mesh(ringGeo, laserMat("#5cf1ff"));
        ring.position.set(0, 0.44, 0);
        ring.rotation.set(rx, 0, rz);
        model.add(ring);
    });

    // Три фактора на орбитах: модель объясняет причину, а не только считает риск. Каждый
    // связан с ядром нитью — без неё узлы читаются случайными бусинами рядом со сферой.
    const CORE = new THREE.Vector3(0, 0.44, 0);
    [
        [0.17, 0.5, 0.05],
        [-0.13, 0.36, 0.11],
        [0.03, 0.6, -0.15],
    ].forEach(([x, y, z]) => {
        const node = new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 16), orbMat("#ffffff"));
        node.position.set(x, y, z);
        model.add(node);

        const dir = new THREE.Vector3(x, y, z).sub(CORE);
        const link = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, dir.length(), 8), laserMat("#5cf1ff"));
        link.position.copy(CORE).addScaledVector(dir, 0.5);
        link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        model.add(link);
    });

    // Кривая прогноза выходит из ядра вверх и заканчивается точкой горизонта.
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.16, 0.36, 0.06),
        new THREE.Vector3(-0.05, 0.45, 0.02),
        new THREE.Vector3(0.06, 0.56, -0.02),
        new THREE.Vector3(0.15, 0.69, -0.04),
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.007, 10, false), laserMat("#5cf1ff"));
    model.add(tube);

    const horizon = new THREE.Mesh(new THREE.SphereGeometry(0.032, 24, 20), orbMat("#ffffff"));
    horizon.position.set(0.15, 0.69, -0.04);
    model.add(horizon);

    // Вращение внутри, качание снаружи: hover и spin оба пишут onFrame и на одной группе
    // затирают друг друга.
    spin(model, 0.28);
    float.add(model);
    hover(float, 0.014, 1.4);
    g.add(float);

    return castAll(g);
}

// +4 «Проактивность»: предиктивная призма данных. Пять парящих стеклянных призм по
// восходящей дуге, неоновая траектория предикта и сфера горизонта событий; по тумбе
// расходятся опережающие волны. Перенесено из testProps.dataProactive без изменений вида.
export function data6() {
    const g = new THREE.Group();

    g.add(proactiveWaves(ACCENT));

    const glass = glassMat(ACCENT, "#0284c7");
    const laser = laserMat("#5cf1ff");
    const orb = orbMat("#ffffff");

    const groupData = new THREE.Group();

    [
        { h: 0.14, x: -0.26, z: 0.05 },
        { h: 0.24, x: -0.13, z: 0.01 },
        { h: 0.36, x: 0.0, z: -0.01 },
        { h: 0.5, x: 0.13, z: 0.01 },
        { h: 0.65, x: 0.25, z: 0.05 },
    ].forEach((cfg, idx) => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.068, cfg.h, 0.068), glass);
        bar.position.set(cfg.x, 0.4 + cfg.h / 2, cfg.z);
        bar.userData = {
            baseH: cfg.h,
            idx,
            onFrame: (node, time) => {
                node.position.y = 0.4 + node.userData.baseH / 2 + Math.sin(time * 2.5 + node.userData.idx * 0.7) * 0.015;
            },
        };
        groupData.add(bar);
    });

    const arc = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.31, 0.44, 0.07),
        new THREE.Vector3(-0.26, 0.58, 0.05),
        new THREE.Vector3(-0.13, 0.68, 0.01),
        new THREE.Vector3(0.0, 0.8, -0.01),
        new THREE.Vector3(0.13, 0.94, 0.01),
        new THREE.Vector3(0.25, 1.09, 0.05),
        new THREE.Vector3(0.34, 1.19, 0.08),
    ]);
    groupData.add(new THREE.Mesh(new THREE.TubeGeometry(arc, 64, 0.007, 12, false), laser));

    const futureOrb = new THREE.Mesh(new THREE.SphereGeometry(0.048, 24, 24), orb);
    futureOrb.position.set(0.34, 1.19, 0.08);
    futureOrb.userData = {
        onFrame: (node, time) => {
            const s = 1.0 + Math.sin(time * 4.2) * 0.14;
            node.scale.set(s, s, s);
            node.position.y = 1.19 + Math.sin(time * 2.8) * 0.012;
        },
    };
    groupData.add(futureOrb);

    // Скульптура собрана в исходном масштабе эталона и вписывается в тумбу целиком,
    // с запасом на качание левитации сверху и снизу.
    fit(groupData, FLOAT_BASE + 0.03, PROP_MAX_HEIGHT - 0.03);
    hover(groupData);
    g.add(groupData);

    return castAll(g);
}

export default { 1: data1, 2: data2, 3: data3, 4: data4, 5: data5, 6: data6 };
