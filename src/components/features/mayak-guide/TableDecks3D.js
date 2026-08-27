"use client";

import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei/core/Texture";
import * as THREE from "three";

import { myStacks, pxToMeters as pxMy } from "./fieldLayout.mjs";
import { CENTRE_M as YA_CENTRE, yaStacks, pxToMeters as pxYa } from "./fieldLayoutYa.mjs";

// Какой набор заданий лежит на столе: «ВУЗЫ» (№6xx) или «ФЕДЕРАЦИЯ» (№4xx). Выбирается
// адресом страницы (?deck=fed) и читается один раз при загрузке модуля.
//
// Именно так, а не пропом: списки текстур, индексы карт и гнёзда стопок собираются
// модульными константами, и смена набора на лету означала бы пересборку половины файла
// ради того, что в жизни меняют между партиями, а не посреди неё. Переключатель в сцене
// меняет адрес и перезагружает страницу — тот же жест, что убрать со стола одну колоду
// и выложить другую.
export const DECK_ID =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("deck") === "fed" ? "fed" : "vuz";
import { CARD_MM, DECK_BOX, HAND_PILE, MAX_ANISOTROPY } from "./tableSpots.mjs";
import { roundedPlateGeometry } from "./roundedPlate";

// Колода заданий обеих сторон набора: семь стопок этапа «Я» и шесть этапа «МЫ».
//
// Карта здесь — отдельный предмет с лицом, рубашкой и бумажным торцом, а не картинка на
// плоскости: только так стопка читается стопкой, а её убыль — убылью. Физики нет намеренно:
// рука мастера кладёт карту точно, поэтому здесь анимация по ключевым положениям.
//
// Жизнь карты: коробка набора → стопка на поле → выданное задание → рука команды.
// Обратный путь один и тот же для всех: returnAll() возвращает карты в коробку, откуда
// их брали. Это не украшение — стол перед переворотом полотна расчищают целиком.

// Габарит карты живёт в tableSpots: его знает не только колода, но и сценарий,
// который считает, сколько заданий поместится в ряду разбора.
const W = CARD_MM.w / 1000;
const H = CARD_MM.h / 1000;
const T = CARD_MM.thickness / 1000;
const CORNER = CARD_MM.corner / 1000;

const GROUND = 0.0006; // карта лежит чуть выше стола, иначе плоскости мерцают
const GAP = 1.6; // зазор между листами: без него шесть карт по 0.3 мм сливаются в брусок

const MOVE_SECONDS = 0.95;
const STEP_DELAY = 0.05; // карты стопки трогаются с места по очереди, а не хором

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const mix = (a, b, t) => a + (b - a) * t;

// Курсор ловят хотспоты сцены, а не 64 карты: иначе по столу не попасть.
const noRaycast = () => null;

// Детерминированный «разброс руки»: одна и та же стопка каждый раз ложится одинаково.
function jitter(seed) {
    const hash = Math.sin(seed * 12.9898) * 43758.5453;
    return hash - Math.floor(hash) - 0.5;
}

// Ориентация лежащей карты. Кватернион, а не эйлеры: у эйлера XYZ поворот в плоскости
// самой карты меняет знак вместе со стороной, и код на этом стабильно ошибается.
// Сначала карту кладут (лицо в +Z уходит вверх или вниз), потом разворачивают вокруг
// вертикали. spin = 0 — верх карты смотрит от игрока, вглубь стола.
//
// Лишние 180° у рубашки — не украшение. Rx(+90°) кладёт карту рубашкой вверх, но верх
// рубашки при этом смотрит НА игрока: название раздела стоит вверх ногами. Раньше это
// лечили доворотом самой текстуры (см. tuneBacks), и на лежащей карте подмены не видно.
// Видно её в раздаче: поворот из «рубашкой вверх» в «лицом вверх» шёл тогда вокруг одной
// оси X, то есть карту опрокидывали через горизонтальную кромку, а так в жизни лицо
// получаешь вверх ногами. Разворот стопки на 180° делает позу честной: карта ложится
// той же стороной и тем же текстом вверх, а раздача становится поворотом вокруг
// собственной вертикали карты — тем самым движением, которым её берут рукой.
function lying(faceUp, spin) {
    return new THREE.Quaternion()
        .setFromAxisAngle(AXIS_Y, spin + (faceUp ? 0 : Math.PI))
        .multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_X, faceUp ? -Math.PI / 2 : Math.PI / 2));
}

// Разворот стопки на поле: верх карты смотрит от центра фигуры наружу — к тому,
// кто сидит с этой стороны стола. Вывод: Ry(s) переводит «верх карты» (−Z) в (−sin s, −cos s),
// значит s = atan2(−dx, −dz), где (dx, dz) — направление от центра к пазу.
//
// Центр берётся отдельным аргументом, а не считается нулём сцены: на стороне «Я» фигура
// сдвинута вправо на 68 мм от центра полотна, и отсчёт от нуля давал ошибку до 15°.
function outwardSpin(at, centre) {
    return Math.atan2(-(at.x - centre.x), -(at.z - centre.z));
}

// Стопки обеих сторон в одном списке: slot — гнездо в коробке набора, at — паз на поле.
// Гнёзда нумеруются внутри своей стороны: в коробке одновременно лежит только одна.
const STACKS = [
    ...yaStacks(DECK_ID).map((stack, slot) => {
        const at = pxYa(stack.at);
        return { ...stack, side: "ya", slot, at, spin: stack.spin ?? outwardSpin(at, YA_CENTRE) };
    }),
    // Панели направлений на поле «МЫ» стоят ровной сеткой 3 × 2 и не развёрнуты.
    ...myStacks(DECK_ID).map((stack, slot) => ({ ...stack, side: "my", slot, at: pxMy(stack.at), spin: 0 })),
];

const CARDS = STACKS.flatMap((stack, si) => stack.faces.map((_, idx) => ({ stack: si, idx })));

const BACK_URLS = STACKS.map((stack) => stack.back);
const FACE_URLS = STACKS.flatMap((stack) => stack.faces);

// Индекс первой карты стопки в общем списке — чтобы попадать в свою текстуру лица.
const FIRST_CARD = STACKS.reduce((acc, stack, si) => {
    acc[si] = si === 0 ? 0 : acc[si - 1] + STACKS[si - 1].faces.length;
    return acc;
}, []);

const STACK_INDEX = STACKS.reduce((acc, stack, si) => ({ ...acc, [`${stack.side}:${stack.id}`]: si }), {});

function tuneTextures(textures) {
    for (const map of textures) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = MAX_ANISOTROPY;
    }
}

// Гнездо стопки в коробке набора: два ряда за полем, поперёк стола. В ряду «МЫ» шесть
// мест, в ряду «Я» семь — «Старт» идёт первым, левее типов контента. Шаг по ряду один и
// тот же, без выделенного зазора у «Старта»: ряд с одной раздвинутой парой читается как
// сбитая раскладка, а не как отдельный раздел. Оба ряда центрированы по нулю.
function boxAt(stack) {
    const half = (DECK_BOX.perRow - 1) / 2;
    const extra = stack.id === "start";
    // В YA_STACKS «Старт» идёт первым, поэтому у типов контента slot смещён на единицу.
    const place = extra ? 0 : stack.side === "ya" ? stack.slot - 1 : stack.slot;
    const step = DECK_BOX.dx + DECK_BOX.gap;
    const centre = stack.side === "ya" ? step / 2 : 0;
    return {
        x: centre + (extra ? -(half * DECK_BOX.dx + step) : (place - half) * DECK_BOX.dx),
        z: DECK_BOX[stack.side],
    };
}

// Стопки в коробке набора для разбора: где стоит стопка, как называется раздел и какие
// растры у её верхней карты. Нужно сцене — верхнюю карту любой стопки можно взять и
// рассмотреть, а координаты гнёзд знает только этот файл.
export const BOX_SPOTS = STACKS.map((stack, index) => ({
    index,
    id: stack.id,
    side: stack.side,
    name: stack.name,
    count: stack.faces.length,
    face: stack.faces[stack.faces.length - 1],
    back: stack.back,
    at: boxAt(stack),
}));

// Куда и как лежит карта в текущем состоянии. Чистая функция от состояния колоды:
// сравнив её результат с прошлым, видно, кто именно должен поехать.
function place(state, index) {
    const card = CARDS[index];
    const stack = STACKS[card.stack];
    const seed = index * 3;
    const at = state.where[index];

    if (at.kind === "dealt") {
        // level поднимает карту над соседней: ряд разбора идёт внахлёст, и без разницы
        // высот девять карт спорят за одну плоскость и мерцают.
        return { p: [at.x, GROUND + T / 2 + at.level * T * GAP, at.z], q: lying(true, at.spin), seed };
    }
    if (at.kind === "hand") {
        return {
            p: [HAND_PILE.x + jitter(seed) * 0.004, GROUND + T / 2 + at.level * T * GAP, HAND_PILE.z + jitter(seed + 1) * 0.004],
            q: lying(true, jitter(seed + 2) * 0.12),
            seed,
        };
    }
    const anchor = at.kind === "field" ? stack.at : boxAt(stack);
    const spin = at.kind === "field" ? stack.spin : 0;
    return {
        p: [
            anchor.x + jitter(seed) * 0.0018,
            GROUND + T / 2 + card.idx * T * GAP + (anchor.lift ?? 0),
            anchor.z + jitter(seed + 1) * 0.0018,
        ],
        q: lying(false, spin + jitter(seed + 2) * 0.05),
        seed,
    };
}

export const TableDecks3D = forwardRef(function TableDecks3D({ position = [0, 0, 0], side = "ya", onReady }, ref) {
    const backs = useTexture(BACK_URLS, tuneTextures);
    const faces = useTexture(FACE_URLS, tuneTextures);

    const geometry = useMemo(() => roundedPlateGeometry(W, H, T, CORNER), []);

    const materials = useMemo(() => {
        // Картон: матовый, почти без бликов, иначе карта выглядит ламинированной.
        const paper = new THREE.MeshStandardMaterial({ color: "#efe9dd", roughness: 0.85 });
        // Порядок групп у roundedPlate: лицо, рубашка, торец.
        return CARDS.map((card, index) => [
            new THREE.MeshStandardMaterial({ map: faces[index], roughness: 0.78 }),
            new THREE.MeshStandardMaterial({ map: backs[card.stack], roughness: 0.78 }),
            paper,
        ]);
    }, [backs, faces]);

    const meshes = useRef([]);
    const anim = useRef(CARDS.map(() => null));
    const current = useRef(CARDS.map(() => null));

    // Состояние колоды живёт в ref: карты двигает useFrame, перерисовывать React-дерево
    // незачем. Побочная выгода — left() отвечает свежими данными сразу после deal().
    const deck = useRef({
        where: CARDS.map(() => ({ kind: "box" })),
        taken: STACKS.map(() => 0),
        hand: 0,
    });

    // delay — общая пауза перед стартом жеста. Нужна раздаче: пока прошлые задания летят
    // в руку команды, новые не должны выходить из стопки, иначе в кадре двенадцать карт
    // пересекаются на одной высоте.
    const applyLayout = useCallback((instant, stagger = STEP_DELAY, delay = 0) => {
        let queued = 0;
        for (let index = 0; index < CARDS.length; index += 1) {
            const mesh = meshes.current[index];
            if (!mesh) continue;
            const to = place(deck.current, index);
            const was = current.current[index];
            const moved = !was || was.p.some((v, i) => Math.abs(v - to.p[i]) > 1e-6) || was.q.angleTo(to.q) > 1e-4;
            if (!moved) continue;
            current.current[index] = to;

            if (instant) {
                mesh.position.set(...to.p);
                mesh.quaternion.copy(to.q);
                anim.current[index] = null;
                continue;
            }

            const reach = Math.hypot(to.p[0] - mesh.position.x, to.p[2] - mesh.position.z);
            anim.current[index] = {
                fromP: mesh.position.clone(),
                fromQ: mesh.quaternion.clone(),
                to,
                // Дальняя карта поднимается выше: рука обносит её над столом, а не тащит по нему.
                lift: Math.min(0.09, 0.014 + reach * 0.3),
                t: -(delay + queued * stagger),
            };
            queued += 1;
        }
    }, []);

    // Обе стороны набора лежат на столе всегда: на своём месте справа стоят и семь
    // разделов «Я», и шесть «МЫ». Прятать неигровую сторону нельзя — тогда переворот
    // полотна читается как подмена колоды, а не как смена этапа одной и той же партии.

    useLayoutEffect(() => {
        applyLayout(true);
        // Сюда доходит только загруженная колода: useTexture выше саспендится, пока не
        // приедут все растры. Значит это и есть «колода на столе» — сцене нужен сигнал,
        // чтобы не давать запускать партию по пустой ручке.
        onReady?.();
    }, [applyLayout, onReady]);

    useImperativeHandle(
        ref,
        () => {
            const indexOf = (stackId) => STACK_INDEX[`${side}:${stackId}`];
            const left = (stackId) => {
                const si = indexOf(stackId);
                return si === undefined ? 0 : STACKS[si].faces.length - deck.current.taken[si];
            };

            return {
                left,
                // Стопки текущей стороны уходят из коробки в свои пазы на поле.
                layout() {
                    const state = deck.current;
                    CARDS.forEach((card, index) => {
                        if (STACKS[card.stack].side !== side) return;
                        state.where[index] = { kind: "field" };
                    });
                    applyLayout(false, 0.03);
                },
                // Снять верхнюю карту стопки и положить её лицом вверх в точку to.
                // delay — через сколько секунд рука тронется с места: карты ряда выходят
                // из стопок по очереди и после того, как прошлые задания убраны.
                deal(stackId, to, delay = 0) {
                    const si = indexOf(stackId);
                    if (si === undefined) return false;
                    const state = deck.current;
                    const first = FIRST_CARD[si];
                    const size = STACKS[si].faces.length;
                    // Снимается верхняя нетронутая: те, что под ней, остаются на своих высотах.
                    for (let idx = size - 1; idx >= 0; idx -= 1) {
                        const index = first + idx;
                        if (state.where[index].kind !== "field" && state.where[index].kind !== "box") continue;
                        state.where[index] = { kind: "dealt", x: to.x, z: to.z, spin: to.spin ?? 0, level: to.level ?? 0 };
                        state.taken[si] += 1;
                        applyLayout(false, STEP_DELAY, delay);
                        return true;
                    }
                    return false;
                },
                // Разобранные карты уходят инспектору соседней команды — в стопку «рука».
                // Вызывается перед следующей раздачей: на столе лежат только те задания,
                // которые сейчас решают, а не всё, что выдали с начала партии.
                parkDealt() {
                    const state = deck.current;
                    let moved = false;
                    for (let index = 0; index < CARDS.length; index += 1) {
                        if (state.where[index].kind !== "dealt") continue;
                        state.where[index] = { kind: "hand", level: state.hand };
                        state.hand += 1;
                        moved = true;
                    }
                    if (moved) applyLayout(false, 0.02);
                },
                // Всё обратно в коробку набора, откуда брали. Стол расчищен.
                returnAll() {
                    const state = deck.current;
                    state.where = CARDS.map(() => ({ kind: "box" }));
                    state.taken = STACKS.map(() => 0);
                    state.hand = 0;
                    applyLayout(false, 0.012);
                },
            };
        },
        [applyLayout, side]
    );

    useFrame((_, delta) => {
        // Кадр длиной в полсекунды и больше значит, что вкладка была в фоне или сцена
        // встала. Шаг анимации ограничен 1/30, поэтому после такой паузы карты ползут
        // в тридцать раз медленнее реального времени: сценарий давно ушёл вперёд, а
        // карта всё ещё в воздухе и лежит рубашкой вверх. Такие жесты доигрываем разом —
        // предметы должны догнать сценарий, а не тянуть уже отыгранный ход.
        const catchUp = delta > 0.5;

        for (let index = 0; index < anim.current.length; index += 1) {
            const move = anim.current[index];
            if (!move) continue;

            if (catchUp) {
                const mesh = meshes.current[index];
                mesh.position.set(...move.to.p);
                mesh.quaternion.copy(move.to.q);
                anim.current[index] = null;
                continue;
            }

            // На лаге кадра шаг ограничен, иначе карта перепрыгивает всю дугу разом.
            move.t += Math.min(delta, 1 / 30);
            if (move.t <= 0) continue;

            const mesh = meshes.current[index];
            const p = Math.min(move.t / MOVE_SECONDS, 1);
            const e = ease(p);

            mesh.position.set(
                mix(move.fromP.x, move.to.p[0], e),
                mix(move.fromP.y, move.to.p[1], e) + Math.sin(Math.PI * p) * move.lift,
                mix(move.fromP.z, move.to.p[2], e)
            );
            // Поворот отстаёт от переноса: сначала карту снимают, потом переворачивают в воздухе.
            mesh.quaternion.slerpQuaternions(move.fromQ, move.to.q, ease(Math.max(0, Math.min(1, (p - 0.15) / 0.7))));

            if (p >= 1) anim.current[index] = null;
        }
    });

    return (
        <group position={position}>
            {CARDS.map((card, index) => (
                <mesh
                    key={`${STACKS[card.stack].side}-${STACKS[card.stack].id}-${card.idx}`}
                    ref={(node) => {
                        meshes.current[index] = node;
                    }}
                    geometry={geometry}
                    material={materials[index]}
                    raycast={noRaycast}
                    castShadow
                    receiveShadow
                />
            ))}
        </group>
    );
});

export default TableDecks3D;
