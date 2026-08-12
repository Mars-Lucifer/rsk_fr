"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei/core/Texture";
import { Html } from "@react-three/drei/web/Html";
import * as THREE from "three";

import { PINS, cropBox } from "./cardPins.mjs";
import { BOX_SPOTS } from "./TableDecks3D";
import { CARD_MM, MAX_ANISOTROPY } from "./tableSpots.mjs";
import { roundedPlateGeometry } from "./roundedPlate";

// Разбор карты задания прямо на столе: карта лежит с краю ряда колоды рубашкой вверх,
// по клику встаёт, переворачивается лицом и показывает пронумерованные маркеры — те же,
// что на 2D-странице /mayak-guide. Клик по маркеру рассказывает про его элемент.
//
// Это отдельный предмет, а не карта из колоды, и по двум причинам. Растры колоды
// (deck-ya) обрезаны под чистый формат 104 × 145, а проценты маркеров сняты с печатной
// страницы с вылетами — на обрезанной карте они уедут. И рубашки в колоде другие: у
// deck-ya/text-back.png нет бейджа с номером, в который целится маркер «Номер».
//
// Карты колоды курсор не ловят вовсе (raycast отключён у всех 64 штук), поэтому и
// «ткнуть верхнюю» в самой колоде нельзя — здесь предмет свой, со своей ловушкой.

const W = CARD_MM.w / 1000;
const H = CARD_MM.h / 1000;
const T = CARD_MM.thickness / 1000;
const CORNER = CARD_MM.corner / 1000;

// Карта лежит верхней на своей стопке: под ней весь раздел. Числа те же, что у колоды
// (GROUND и зазор между листами в TableDecks3D), иначе карта утонет в стопке.
const restY = (under) => 0.0006 + under * T * 1.6 + T / 2;

// Растры верхних карт всех тринадцати разделов. Те же URL уже загружает колода, поэтому
// второй useTexture берёт их из кэша drei, а не тянет заново.
const FACE_URLS = BOX_SPOTS.map((spot) => spot.face);
const BACK_URLS = BOX_SPOTS.map((spot) => spot.back);

// Габариты блоков пересчитаны под обрезанный формат колоды: проценты в cardPins сняты
// по печатной странице с вылетами.
const BOXES = PINS.face.map((item) => cropBox(item.box));
const OPEN_SECONDS = 0.6;
const HOVER_SECONDS = 0.18;
const HOVER_LIFT = 0.014;

// Поднятая карта завалена назад под ту же камеру, что и карты ролей: она приходит низко
// и почти в лоб. Числа те же — иначе два разбора в одной сцене выглядят разными приёмами.
export const CARD_TILT = -0.42;
export const CARD_OPEN = { lift: 0.16, z: 0.16 };

// Поднятая карта стоит не на столе, а над ним: её нижняя кромка приходится ровно на
// соседние ряды колоды, и при завале назад угол карты уходил в их растры. Тридцать
// миллиметров — минимум, при котором кромка чистая на всей ширине кадра.
const OPEN_CLEARANCE = 0.03;

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);

// Поза лежащей карты — Ry(180°)·Rx(90°), а не просто Rx(90°). Разница не стилистическая:
// при простом Rx(90°) верх рубашки смотрит НА игрока, то есть название раздела стоит
// вверх ногами, и прежний код лечил это доворотом самой текстуры на 180°. Пока карта
// лежит, подмену не видно; в движении она вылезает — перевёрнутая текстура означает,
// что жест, которым карту берут, в жизни невозможен.
//
// Сам жест — две доли, как рукой:
//   1) карта поднимается на ребро, рубашкой к игроку. Название раздела читается всё
//      это время: карта только встаёт, вокруг своей оси не крутится;
//   2) уже стоя, поворачивается вокруг собственной вертикали, как переворачивают
//      страницу, и заваливается назад под камеру.
// Одной дугой (slerp между «лежит» и «стоит лицом») карта закручивается по диагонали:
// в середине хода рубашка стоит криво, и жест читается как подброс, а не как «взяли».
const RAISE = 0.45; // доля хода на подъём, остальное — поворот
const HALF_TURN = new THREE.Quaternion().setFromAxisAngle(AXIS_Y, Math.PI);
const qA = new THREE.Quaternion(); // рабочие, чтобы не сорить объектами каждый кадр
const qB = new THREE.Quaternion();

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;

// Проценты макета → координаты в плоскости карты. Отсчёт процентов от левого верхнего
// угла, у геометрии центр в нуле и Y вверх — отсюда обе поправки.
function pinAt(pin) {
    return [(pin.x / 100 - 0.5) * W, (0.5 - pin.y / 100) * H, T / 2 + 0.0006];
}

// Рамка блока: контур габарита элемента в плоскости карты, чуть выше лица, чтобы линия
// не спорила с самой печатью. Замкнутый контур из пяти точек — lineLoop замкнул бы и сам,
// но пятая точка избавляет от догадок при чтении кода.
const PIN_Z = T / 2 + 0.0006;

function boxOutline(box) {
    const x0 = (box.x / 100 - 0.5) * W;
    const x1 = ((box.x + box.w) / 100 - 0.5) * W;
    const y0 = (0.5 - box.y / 100) * H;
    const y1 = (0.5 - (box.y + box.h) / 100) * H;
    const points = [x0, y0, x1, y0, x1, y1, x0, y1, x0, y0];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            points.reduce((acc, value, i) => (i % 2 ? [...acc, value, PIN_Z] : [...acc, value]), []),
            3
        )
    );
    return geometry;
}

// Номер стоит у левой кромки блока, а не посреди текста: цифра поверх строки читается
// как часть строки. У блоков, прижатых к левому краю карты, он свисает за кромку — это
// HTML-накладка, её ничем не обрезает.
//
// Выносить все номера за габарит карты пробовали — столбиком слева и над верхней кромкой.
// Связь «номер ↔ место на карте» при этом теряется: цифра стоит в пустоте, и куда она
// показывает, видно только по загоревшейся рамке. У кромки блока хуже с текстом, но
// понятно без наведения, поэтому вернули как было.
const BADGE_GAP = 3.5; // на сколько процентов ширины карты номер отходит от кромки блока
function badgeAt(box) {
    return [((box.x - BADGE_GAP) / 100 - 0.5) * W, (0.5 - (box.y + box.h / 2) / 100) * H, PIN_Z];
}

// Нормаль поднятой карты в мире: лицо смотрит вверх-на зрителя ровно на завал CARD_TILT.
// По ней камера отходит от выбранного элемента, чтобы смотреть на него в лоб.
export const CARD_NORMAL = [0, -Math.sin(CARD_TILT), Math.cos(CARD_TILT)];

// Где элемент карты оказывается в мире, когда карта поднята. Нужно сцене: клик по
// маркеру подводит камеру к самому элементу, а не просто пишет про него в накладке.
export function pinWorld(pin, groupPosition) {
    const [px, py] = pinAt(pin);
    const pz = T / 2 + 0.0006;
    const c = Math.cos(CARD_TILT);
    const s = Math.sin(CARD_TILT);
    // Поворот вокруг X на CARD_TILT, затем перенос в позу открытой карты и в мир группы.
    return [
        groupPosition[0] + px,
        groupPosition[1] + (H / 2) * c + OPEN_CLEARANCE + (py * c - pz * s),
        groupPosition[2] + CARD_OPEN.z + (py * s + pz * c),
    ];
}

// Разбор верхней карты любой стопки набора. Какую именно стопку разбирают, решает сцена:
// stack — запись из BOX_SPOTS, open — поднята карта или лежит. Оба состояния снаружи,
// потому что тот же выбор живёт в панели справа и в цепочке Escape, а две копии одного
// состояния расходятся на первом же клике. Здесь остаётся только жест.
export function CardPinsGroup({ stack = null, groundY = 0, open = false, pin = null, hint = null, onPin, onHint, onToggle }) {
    const maps = useTexture([...FACE_URLS, ...BACK_URLS], (textures) => {
        for (const map of [textures].flat()) {
            map.colorSpace = THREE.SRGBColorSpace;
            map.anisotropy = MAX_ANISOTROPY;
        }
    });
    const face = stack ? maps[stack.index] : maps[0];
    const back = stack ? maps[FACE_URLS.length + stack.index] : maps[FACE_URLS.length];

    const geometry = useMemo(() => roundedPlateGeometry(W, H, T, CORNER), []);
    const outlines = useMemo(() => BOXES.map((box) => boxOutline(box)), []);
    const card = useRef(null);
    const progress = useRef({ open: 0, hover: 0 });

    const [hover, setHover] = useState(false);
    // Номера показываем не по команде «поднять», а по факту поднятия. Карта встаёт и
    // поворачивается лицом 0.6 с, и разметка, включённая сразу, полсекунды висит поверх
    // рубашки — красные цифры появляются раньше самой карты.
    const [shown, setShown] = useState(false);
    const rest = restY(stack ? stack.count : 4);

    useFrame((_, delta) => {
        const step = Math.min(delta, 1 / 20);
        const p = progress.current;
        p.open = clamp01(p.open + (open ? step / OPEN_SECONDS : -step / OPEN_SECONDS));
        p.hover = clamp01(p.hover + (hover && !open ? step / HOVER_SECONDS : -step / HOVER_SECONDS));

        const ready = p.open > 0.995;
        if (ready !== shown) setShown(ready);

        const node = card.current;
        if (!node) return;
        const o = ease(p.open);
        const h = ease(p.hover);

        node.position.y = mix(rest, (H / 2) * Math.cos(CARD_TILT) + OPEN_CLEARANCE, o) + h * HOVER_LIFT;
        node.position.z = mix(0, CARD_OPEN.z, o);

        if (o <= RAISE) {
            // Доля 1: карта встаёт на ребро. Ry(180°) держит рубашку читаемой всё время.
            node.quaternion.copy(HALF_TURN).multiply(qA.setFromAxisAngle(AXIS_X, mix(Math.PI / 2, 0, o / RAISE)));
        } else {
            // Доля 2: поворот вокруг собственной вертикали плюс завал назад под камеру.
            const t = (o - RAISE) / (1 - RAISE);
            node.quaternion
                .copy(qA.setFromAxisAngle(AXIS_X, mix(0, CARD_TILT, t)))
                .multiply(qB.setFromAxisAngle(AXIS_Y, mix(Math.PI, 2 * Math.PI, t)));
        }
    });


    useEffect(() => {
        if (!hover || open) return undefined;
        document.body.style.cursor = "pointer";
        return () => {
            document.body.style.cursor = "";
        };
    }, [hover, open]);

    const handlers = stack
        ? {
              onPointerOver: (event) => {
                  event.stopPropagation();
                  setHover(true);
              },
              onPointerOut: () => setHover(false),
              onClick: (event) => {
                  event.stopPropagation();
                  // Протяжка камеры начинается нажатием на ту же карту, и R3F всё равно
                  // считает это кликом: тот же порог, что у карт ролей.
                  if (event.delta > 2) return;
                  setHover(false);
                  onToggle?.();
              },
          }
        : null;

    const pick = useCallback(
        (item) => {
            onPin?.(pin?.id === item.id ? null : item);
        },
        [onPin, pin]
    );

    return (
        <group position={stack ? [stack.at.x, groundY, stack.at.z] : [0, groundY, 0]} visible={Boolean(stack)}>
            {/* Поднятая карта тени не отбрасывает. Лист толщиной 0.4 мм, вставший почти
                вертикально, даёт в карте теней не тень, а полосу поперёк стола: глубина
                листа тоньше одного тексела, и смещение против самозатенения выносит её
                далеко вбок. Лежащая карта такой проблемы не имеет и тень оставляет. */}
            <mesh ref={card} geometry={geometry} castShadow={!open} receiveShadow {...handlers}>
                {/* Порядок групп у roundedPlate: лицо, рубашка, торец. */}
                <meshStandardMaterial attach="material-0" map={face} roughness={0.78} />
                <meshStandardMaterial attach="material-1" map={back} roughness={0.78} />
                <meshStandardMaterial attach="material-2" color="#efe9dd" roughness={0.85} />

                {/* Разметка — дети самой карты: едет и поворачивается вместе с ней, и её
                    не приходится пересчитывать на каждый кадр подъёма. Показываем только
                    у доведённой до конца карты: на лежащей рубашкой вверх номера лица
                    висели бы в воздухе над обратной стороной. */}
                {shown &&
                    PINS.face.map((item, index) => {
                        const lit = hint === item.id || pin?.id === item.id;
                        return (
                            <group key={item.id}>
                                <lineLoop geometry={outlines[index]} visible={lit} renderOrder={2}>
                                    <lineBasicMaterial color={pin?.id === item.id ? "#c9503f" : "#e7a847"} depthTest={false} />
                                </lineLoop>
                                <Html position={badgeAt(BOXES[index])} center zIndexRange={[20, 0]}>
                                    <button
                                        type="button"
                                        className={`num ${lit ? "on" : ""}`}
                                        onMouseEnter={() => onHint?.(item.id)}
                                        onMouseLeave={() => onHint?.(null)}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            pick(item);
                                        }}>
                                        {index + 1}
                                        {/* Размер в пикселях, а не в метрах сцены
                                            (distanceFactor): подлетев к элементу, номер
                                            иначе раздувается во весь кадр и закрывает
                                            ровно то, ради чего подлетели. */}
                                        <style jsx>{`
                                            .num {
                                                width: 22px;
                                                height: 22px;
                                                padding: 0;
                                                border: 0;
                                                border-radius: 50%;
                                                display: grid;
                                                place-items: center;
                                                font-size: 12px;
                                                font-weight: 700;
                                                font-family: inherit;
                                                color: #fff;
                                                background: #c9503f;
                                                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
                                                cursor: pointer;
                                                transition: transform 0.16s ease, background 0.16s ease;
                                            }
                                            .num.on {
                                                background: #15110e;
                                                transform: scale(1.2);
                                            }
                                        `}</style>
                                    </button>
                                </Html>
                            </group>
                        );
                    })}
            </mesh>
        </group>
    );
}

export default CardPinsGroup;
