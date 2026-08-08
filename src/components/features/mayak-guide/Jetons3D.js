"use client";

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei/core/Texture";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

import { DIRS, JETON_MM, TACTS, jetonSlots, pxToMeters } from "./fieldLayout.mjs";
import { JETON_BOX, MAX_ANISOTROPY } from "./tableSpots.mjs";
import { roundedPlateLying } from "./roundedPlate";

// Жетоны направлений — второй элемент набора в 3D. В отличие от поля, у жетона своя
// жёсткость: это твёрдый диск, который лежит, скользит, стукается о соседа и переворачивается.
// Поэтому здесь не самописная симуляция, как у ткани, а обычная физика твёрдых тел (Rapier):
// 36 отдельных динамических тел, а не 36 картинок на одной плоскости.
//
// Файл отдаёт только встраиваемый предмет: тела жетонов внутри своей группы, без Canvas,
// света, стола и физики. Стенд для отдельной страницы /mayak-3d/jetons живёт в stands.js.
//
// Единицы сцены — метры, габариты жетона взяты из обмеров набора (40 × 3 мм).

// Жетон в наборе — квадрат со скруглёнными углами, а не круг: сторона равна прежнему
// «диаметру», скругление примерно в пятую часть стороны.
const SIDE = JETON_MM.diameter / 1000;
const R = SIDE / 2;
const T = JETON_MM.thickness / 1000;
const CORNER = SIDE * 0.22;

// Полмиллиметра зазора: тело, стартующее вплотную к столу, солвер первым же шагом выталкивает.
const REST_Y = T / 2 + 0.0005;

// Плотность пластика. Задаём явно, потому что по умолчанию Rapier берёт 1 кг/м³ —
// жетон весил бы микрограммы, и любой контакт разбрасывал бы стопку.
const DENSITY = 1300;

const FLIP_SECONDS = 0.7;
const LAY_SECONDS = 0.45; // перелёт одного жетона из коробки на клетку
const LAY_STAGGER = 0.13; // и пауза между соседними: девятка выкладывается по одному
const LAY_ARC = 0.05;
const LIFT = 0.06; // на середине жеста жетон стоит на ребре: подъём должен быть больше радиуса

const AXIS_X = new THREE.Vector3(1, 0, 0);
const ZERO = { x: 0, y: 0, z: 0 };

// Поворот на π вокруг X: жетоны выкладывают рубашкой вверх.
const FACE_DOWN = { x: 1, y: 0, z: 0, w: 0 };
// В коробке жетон лежит лицом вверх: пока он в лотке, скрывать нечего, а по цветной
// стороне видно, какое направление где стоит. Рубашкой вверх его кладут только на поле —
// там это часть правила, план такта не показывают до разбора.
const FACE_UP = { x: 0, y: 0, z: 0, w: 1 };

// Черновик под кватернион текущего кадра: в кадре он используется синхронно, копить их незачем.
const turn = new THREE.Quaternion();

// Пары «лицо/рубашка» по направлениям: номера файлов живут в fieldLayout, а не здесь.
const MAPS = DIRS.flatMap((dir) => [`/mayak-guide/jeton_${dir.jeton}.png`, `/mayak-guide/jeton_${dir.jeton + 1}.png`]);

// На общем столе жетоны появляются только на стороне «МЫ», то есть их текстуры впервые
// нужны в момент переворота полотна. Без предзагрузки монтирование группы уводит общий
// Suspense сцены в fallback, и на время загрузки со стола пропадает вообще всё.
useTexture.preload(MAPS);

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const spread = (amount) => (Math.random() * 2 - 1) * amount;

// Что предмет умеет — списком, чтобы общая сцена рисовала кнопки, не зная про жетоны.
export const JETONS_ACTIONS = [
    { id: "reset", label: "Выложить на поле" },
    { id: "flip", label: "Перевернуть такт" },
    { id: "shuffle", label: "Смешать" },
    { id: "stash", label: "Убрать в коробку" },
];

// Коробка набора: слева от поля, шесть ячеек по направлениям, в каждой стопка из шести
// жетонов. До раскладки жетоны лежат здесь, а не на поле — партия начинается с пустого поля.
// Координаты общие со сценой: где что лежит, решает tableSpots, а не каждая группа сама.
const BOX = JETON_BOX;

// Место каждого жетона в коробке: ячейка по направлению, высота — по порядку в стопке.
function boxPlaces(slots) {
    const levels = DIRS.map(() => 0);
    return slots.map((slot) => {
        const level = levels[slot.dir];
        levels[slot.dir] += 1;
        return {
            x: BOX.x + (slot.dir % 3) * BOX.dx,
            y: REST_Y + level * T * 1.05,
            z: BOX.z + Math.floor(slot.dir / 3) * BOX.dz,
        };
    });
}

// Встраиваемый предмет: только тела жетонов внутри своей группы.
// Стол, свет, физику и камеру даёт сцена-хозяин.
export const JetonsGroup = forwardRef(function JetonsGroup({ position = [0, 0, 0], active = true }, ref) {
    // Rapier живёт в мировых координатах. Трансформ родителя он читает один раз, в момент
    // создания тела (RigidBody сам сводит мировую матрицу), а setTranslation про группу уже
    // не знает. Поэтому смещение держим отдельно и прибавляем везде, где целимся руками.
    // Поворота у группы нет — иначе FACE_DOWN пришлось бы поворачивать вместе с ней.
    const [ox, oy, oz] = position;

    const maps = useTexture(MAPS);

    // Квадрат со скруглёнными углами лежит лицом вверх; PNG набора квадратные,
    // поэтому ложатся на лицо и рубашку как есть, без альфы и без правки файлов.
    const geometry = useMemo(() => roundedPlateLying(SIDE, SIDE, T, CORNER), []);

    const materials = useMemo(() => {
        maps.forEach((map, i) => {
            map.colorSpace = THREE.SRGBColorSpace;
            map.anisotropy = MAX_ANISOTROPY;
            // Рубашки (нечётные файлы пары) доворачиваем на 180°. Причина геометрическая:
            // roundedPlate зеркалит развёртку рубашки по горизонтали — так жетон читается,
            // если перевернуть его через боковую кромку. Такт переворачивают через верхнюю,
            // то есть к зеркалу по горизонтали добавляется зеркало по вертикали. Сумма двух
            // зеркал — поворот на 180°, и без поправки иконка на рубашке стоит вверх ногами.
            if (i % 2 === 1) {
                map.center.set(0.5, 0.5);
                map.rotation = Math.PI;
            }
        });
        // Порядок групп у roundedPlate: лицо, рубашка, торец.
        // Торец нейтральный, а не по направлению: у жетона в наборе он один на обе
        // стороны, и цветной торец превращался в цветную обводку вокруг серой рубашки
        // выложенного рубашкой вверх жетона — то есть выдавал направление раньше времени.
        const rim = new THREE.MeshStandardMaterial({ color: "#9c9fa0", roughness: 0.55 });
        return DIRS.map((_, i) => [
            new THREE.MeshStandardMaterial({ map: maps[i * 2], roughness: 0.42 }),
            new THREE.MeshStandardMaterial({ map: maps[i * 2 + 1], roughness: 0.42 }),
            rim,
        ]);
    }, [maps]);

    // Раскладка партии: пиксели растра поля переводим в метры один раз.
    // Координаты локальные — относительно центра группы.
    const slots = useMemo(() => jetonSlots().map((slot) => ({ ...slot, ...pxToMeters(slot.point) })), []);
    const box = useMemo(() => boxPlaces(slots), [slots]);

    const bodies = useRef([]);
    const flips = useRef([]);
    const moves = useRef([]);
    const tact = useRef(0);

    // Поставить жетон в очередь на перелёт, вытеснив его прошлую запись. Без вытеснения
    // за одно тело спорят две записи, а кадровый цикл идёт по списку с конца — значит
    // побеждает самая старая, её setTranslation пишется последним. Отсюда были жетоны,
    // которые «расчищают стол» и при этом продолжают выкладываться на поле.
    const queue = useCallback((body, to, t, face = FACE_DOWN) => {
        const busy = moves.current.findIndex((item) => item.body === body);
        if (busy >= 0) moves.current.splice(busy, 1);
        const at = body.translation();
        moves.current.push({ body, from: { x: at.x, y: at.y, z: at.z }, to, t, face });
    }, []);

    const layOut = useCallback(() => {
        flips.current.length = 0;
        // Телепорт отменяет все перелёты: недоигранная запись увела бы жетон из точки,
        // куда его только что поставили.
        moves.current.length = 0;
        tact.current = 0;
        slots.forEach((slot, i) => {
            const body = bodies.current[i];
            if (!body) return;
            body.setTranslation({ x: ox + slot.x, y: oy + REST_Y, z: oz + slot.z }, true);
            body.setRotation(FACE_DOWN, true);
            body.setLinvel(ZERO, true);
            body.setAngvel(ZERO, true);
        });
    }, [slots, ox, oy, oz]);

    // Убрать в коробку: партия закончилась или ещё не начиналась — поле должно быть пустым.
    const stash = useCallback(() => {
        flips.current.length = 0;
        moves.current.length = 0;
        tact.current = 0;
        slots.forEach((slot, i) => {
            const body = bodies.current[i];
            if (!body) return;
            const place = box[i];
            body.setTranslation({ x: ox + place.x, y: oy + place.y, z: oz + place.z }, true);
            body.setRotation(FACE_UP, true);
            body.setLinvel(ZERO, true);
            body.setAngvel(ZERO, true);
        });
    }, [slots, box, ox, oy, oz]);

    // То же самое, но жестом, а не телепортом: жетоны по одному уезжают в свои ячейки.
    // Нужно перед переворотом полотна — стол расчищают на глазах, иначе кажется, что
    // жетоны просто исчезли, а ткань перевернулась сама по себе.
    const pack = useCallback(() => {
        flips.current.length = 0;
        tact.current = 0;
        let order = 0;
        slots.forEach((slot, i) => {
            const body = bodies.current[i];
            if (!body) return;
            const at = body.translation();
            const place = box[i];
            const to = { x: ox + place.x, y: oy + place.y, z: oz + place.z };
            // «Уже дома» — это попадание в свою ячейку, а не совпадение точки в пространстве.
            // По высоте жетон никогда не совпадёт с расчётной: коробка стоит на столе, вне
            // плиты полотна, и гравитация роняет стопку на несколько миллиметров ниже.
            // Со старым допуском в 0.1 мм ни один жетон домом свою ячейку не признавал, и
            // любая расчистка стола гоняла все 36 штук по дуге внутри коробки — они
            // сталкивались и ложились лицом вверх на стороне «Я», где не участвуют вовсе.
            if (Math.hypot(at.x - to.x, at.z - to.z) < JETON_BOX.dx / 2) return;
            queue(body, to, -order * 0.012, FACE_UP);
            order += 1;
        });
    }, [slots, box, ox, oy, oz, queue]);

    // Импульсы считаем от массы и момента инерции тела, а не подбираем числом:
    // поменяется плотность или размер жетона — бросок останется тем же по высоте и закрутке.
    const shuffle = useCallback(() => {
        flips.current.length = 0;
        for (const body of bodies.current) {
            if (!body) continue;
            const mass = body.mass();
            const inertia = (mass * (3 * R * R + T * T)) / 12;
            body.applyImpulse({ x: mass * spread(0.25), y: mass * (0.9 + Math.random() * 0.5), z: mass * spread(0.25) }, true);
            body.applyTorqueImpulse({ x: inertia * spread(28), y: inertia * spread(10), z: inertia * spread(28) }, true);
        }
    }, []);

    // Переворот такта — жест рукой, а не подброс: девять жетонов снимают со стола, проводят
    // через ребро и кладут на то же место другой стороной. Подброс тем и плох, что сторона
    // приземления случайна, а такт переворачивают целиком и предсказуемо.
    //
    // На время жеста тело ведём вручную поверх солвера (setTranslation/setRotation каждый кадр),
    // скорости обнуляем, чтобы после отпускания жетон не улетел накопленной гравитацией.
    // Жетон, который ещё летит из коробки, доводим до места и снимаем с перелёта, а не
    // пропускаем. Пропуск стоил такту трёх неперевёрнутых жетонов: при быстром темпе
    // выкладка последних штук не успевает закончиться до переворота, а второй раз такт
    // не переворачивают — жетоны так и остаются рубашкой вверх до конца партии.
    const landNow = useCallback((body) => {
        const index = moves.current.findIndex((item) => item.body === body);
        if (index < 0) return;
        const item = moves.current[index];
        moves.current.splice(index, 1);
        body.setTranslation(item.to, true);
        body.setRotation(item.face, true);
        body.setLinvel(ZERO, true);
        body.setAngvel(ZERO, true);
    }, []);

    const flipTakt = useCallback(
        (target) => {
            slots.forEach((slot, i) => {
                if (slot.tact !== target) return;
                const body = bodies.current[i];
                if (!body || flips.current.some((item) => item.body === body)) return;
                landNow(body);
                // Берём фактические координаты, а не слот: после «Смешать» жетон лежит где придётся.
                const at = body.translation();
                flips.current.push({ body, x: at.x, y: oy + REST_Y, z: at.z, from: new THREE.Quaternion().copy(body.rotation()), t: 0 });
            });
        },
        [slots, oy, landNow]
    );

    const flip = useCallback(() => {
        flipTakt(tact.current);
        tact.current = (tact.current + 1) % TACTS.length;
    }, [flipTakt]);

    // Автоплееру нужен поштучный переворот: задание принимают по одному, а не тактом.
    const flipCell = useCallback(
        (takt, cell) => {
            const index = slots.findIndex((slot) => slot.tact === takt && slot.cell === cell);
            const body = bodies.current[index];
            if (!body || flips.current.some((item) => item.body === body)) return;
            landNow(body);
            const at = body.translation();
            flips.current.push({ body, x: at.x, y: oy + REST_Y, z: at.z, from: new THREE.Quaternion().copy(body.rotation()), t: 0 });
        },
        [slots, oy, landNow]
    );

    // Выкладка такта: девять жетонов уходят из коробки на свои клетки по одному,
    // с невысокой дугой — это рука мастера, а не телепорт девяти штук разом.
    const layTakt = useCallback(
        (target) => {
            let order = 0;
            slots.forEach((slot, i) => {
                if (slot.tact !== target) return;
                const body = bodies.current[i];
                if (!body) return;
                queue(body, { x: ox + slot.x, y: oy + REST_Y, z: oz + slot.z }, -order * LAY_STAGGER);
                order += 1;
            });
        },
        [slots, ox, oy, oz, queue]
    );

    // Ручка предмета для сцены-хозяина: одно действие по id и короткая строка для подписи.
    // Неактивный предмет на столе лежит, но команд не принимает.
    useImperativeHandle(
        ref,
        () => ({
            run(actionId) {
                if (!active) return;
                ({ flip, shuffle, reset: layOut, stash })[actionId]?.();
            },
            hint: () => `Такт ${tact.current + 1} из ${TACTS.length}`,
            // Ручки для автоплеера такта: он ведёт партию сам и счётчик держит у себя.
            takts: () => TACTS.length,
            layTakt,
            flipTakt,
            flipCell,
            stash,
            pack,
            setTakt: (value) => {
                tact.current = value;
            },
        }),
        [active, flip, shuffle, layOut, stash, pack, layTakt, flipTakt, flipCell]
    );

    useFrame((_, delta) => {
        // Кадр после вкладки в фоне приходит длиной в секунды — иначе жест проскочит целиком.
        const step = Math.min(delta, 0.05);

        const going = moves.current;
        for (let i = going.length - 1; i >= 0; i -= 1) {
            const item = going[i];
            item.t += step;
            if (item.t < 0) continue; // ждёт своей очереди в выкладке
            const k = Math.min(item.t / LAY_SECONDS, 1);
            const p = ease(k);
            item.body.setTranslation(
                {
                    x: item.from.x + (item.to.x - item.from.x) * p,
                    y: item.from.y + (item.to.y - item.from.y) * p + Math.sin(p * Math.PI) * LAY_ARC,
                    z: item.from.z + (item.to.z - item.from.z) * p,
                },
                true
            );
            item.body.setRotation(item.face, true);
            item.body.setLinvel(ZERO, true);
            item.body.setAngvel(ZERO, true);
            if (k >= 1) going.splice(i, 1);
        }

        const list = flips.current;
        if (!list.length) return;
        for (let i = list.length - 1; i >= 0; i -= 1) {
            const item = list[i];
            item.t = Math.min(item.t + step, FLIP_SECONDS);
            const angle = ease(item.t / FLIP_SECONDS) * Math.PI;
            // Доворот идёт поверх текущей ориентации, поэтому второй проход возвращает жетон обратно.
            turn.setFromAxisAngle(AXIS_X, angle).multiply(item.from);
            item.body.setRotation(turn, true);
            item.body.setTranslation({ x: item.x, y: item.y + Math.sin(angle) * LIFT, z: item.z }, true);
            item.body.setLinvel(ZERO, true);
            item.body.setAngvel(ZERO, true);
            if (item.t >= FLIP_SECONDS) list.splice(i, 1);
        }
    });

    // Курсор группа не слушает вовсе: обработчиков указателя здесь нет, клик по жетону
    // проходит насквозь к маркеру предмета в общей сцене. Уснувшие тела Rapier
    // выключает сам, отдельного «сна» для active={false} не нужно.
    return (
        <group position={position}>
            {slots.map((slot, i) => (
                <RigidBody
                    key={slot.id}
                    ref={(body) => {
                        bodies.current[i] = body;
                    }}
                    type="dynamic"
                    colliders={false}
                    position={[box[i].x, box[i].y, box[i].z]}
                    rotation={[0, 0, 0]}
                    linearDamping={0.4}
                    angularDamping={0.6}
                >
                    {/* Трение высокое, отскок почти нулевой: жетон не шайба, он ложится там, куда упал. */}
                    <CuboidCollider args={[R, T / 2, R]} density={DENSITY} friction={0.9} restitution={0.03} />
                    <mesh geometry={geometry} material={materials[slot.dir]} castShadow receiveShadow />
                </RigidBody>
            ))}
        </group>
    );
});
