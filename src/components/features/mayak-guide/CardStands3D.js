"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei/core/Texture";
import * as THREE from "three";

import { CARD_MM, MAX_ANISOTROPY } from "./tableSpots.mjs";
import { roundedPlateGeometry, roundedPlateLying } from "./roundedPlate";

// Подставки с картами разделов — то, из чего выбирают задание в разборе МАЯК-ОКО.
//
// Карта стоит в подставке, а не лежит на сукне: камера разбора приходит низко и почти
// в лоб, и лежащая карта видна с торца, то есть не видна вовсе. Стоящая читается с той же
// точки, что и разобранная карта, поэтому весь выбор укладывается в один кадр без
// переключения ракурса.
//
// Мест ровно двенадцать: шесть типов контента этапа «Я» и шесть направлений «МЫ».
// «Старт» в подставки не ставится — это раздел про начало партии, задания из него
// по МАЯК-ОКО не разбирают.
//
// При входе в зону карты не появляются готовыми: каждая выезжает со своего места в
// коробке набора и встаёт в подставку. Это не украшение — так видно, что подставки берут
// те же карты, что лежат на столе, а не показывают отдельную колоду ниоткуда.

const W = CARD_MM.w / 1000;
const H = CARD_MM.h / 1000;
const T = CARD_MM.thickness / 1000;
const CORNER = CARD_MM.corner / 1000;

// Завал карты в подставке: та же логика, что у карты роли в фокусе — небольшой наклон
// назад под низкую камеру. Больше — карта сплющивается, меньше — стоит доской.
const LEAN = -0.26;
const LYING = -Math.PI / 2;

// Шаг чуть шире карты: карты не перекрываются, но и ряд не расползается за кадр.
// Уже карты его делать нельзя, хотя ряд от этого и влезал бы в кадр охотнее: соседняя
// карта наезжает на название раздела, а по названию карту в подставке и находят.
const STEP = 0.112;
export const PER_ROW = 6;
const ROW_GAP = 0.15;
// Задний ряд приподнят: иначе его нижняя треть уходит за карты переднего.
const ROW_LIFT = 0.06;

// Подставка — одна светлая рейка чуть шире карты: тёмный брусок с задней планкой на
// тёмном столе читался пятном под картой, а не предметом. Светлый матовый акрил ловит
// свет верхней кромкой и сам показывает, что карта во что-то вставлена.
const STAND = { w: W * 1.04, d: 0.03, thickness: 0.011, corner: 0.005 };
// Задний бортик: без него непонятно, на чём карта держится — стоит будто сама по себе.
// Наклонён вместе с картой и чуть ниже её трети: выше он закрывал бы рубашку.
const RAIL = { w: W * 1.04, h: 0.026, thickness: 0.006 };

const FLIGHT = 1.3; // секунды на перелёт одной карты
const STAGGER = 0.07; // карты трогаются по очереди, а не хором

const ease = (t) => 1 - (1 - t) ** 3;

function CardInStand({ entry, index, map, from, to, chosen, taken, onPick }) {
    const card = useRef(null);
    const [hover, setHover] = useState(false);
    const time = useRef(-index * STAGGER);
    const geometry = useMemo(() => roundedPlateGeometry(W, H, T, CORNER), []);

    useFrame((_, delta) => {
        const node = card.current;
        if (!node) return;

        time.current += delta;
        const t = ease(Math.min(Math.max(time.current / FLIGHT, 0), 1));

        // Карта летит по дуге: прямая линия по столу читается как протаскивание, а
        // подъём в середине пути — как рука, которая её переносит.
        const arc = Math.sin(Math.PI * t) * 0.09;
        node.position.x = from[0] + (to[0] - from[0]) * t;
        node.position.y = from[1] + (to[1] - from[1]) * t + arc;
        node.position.z = from[2] + (to[2] - from[2]) * t;
        node.rotation.x = LYING + (LEAN - LYING) * t;

        // Выбранная и наведённая карта чуть выступает вперёд — как её вытягивают из ряда.
        const out = chosen ? 0.026 : hover ? 0.012 : 0;
        node.position.z += out * t;
        node.position.y += out * 0.35 * t;
        // Взятая в разбор карта из подставки исчезает: один и тот же предмет не может
        // стоять в ряду и одновременно быть поднят к глазам.
        node.visible = !taken;
    });

    return (
        <mesh
            ref={card}
            geometry={geometry}
            position={from}
            rotation={[LYING, 0, 0]}
            onPointerOver={(event) => {
                event.stopPropagation();
                setHover(true);
                document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
                setHover(false);
                document.body.style.cursor = "";
            }}
            onClick={(event) => {
                event.stopPropagation();
                if (event.delta > 2) return;
                onPick(entry.index);
            }}>
            {/* Порядок групп у roundedPlate: лицо, рубашка, торец. К игроку карта
                повёрнута лицом геометрии, и рубашка раздела кладётся именно на него:
                в подставке карту опознают по разделу, как в наборе. */}
            <meshStandardMaterial attach="material-0" map={map} roughness={0.85} emissive="#4fc3d9" emissiveIntensity={chosen ? 0.22 : hover ? 0.1 : 0} />
            <meshStandardMaterial attach="material-1" color="#e8e2d6" roughness={0.9} />
            <meshStandardMaterial attach="material-2" color="#e8e2d6" roughness={1} />
        </mesh>
    );
}

// Где стоит карта раздела внутри группы подставок. Нужно и самой группе, и разбору:
// карта в разбор вылетает именно отсюда, и вторая правда координат разошлась бы с первой.
export function standPlace(index) {
    const row = Math.floor(index / PER_ROW);
    const column = index % PER_ROW;
    return {
        x: (column - (PER_ROW - 1) / 2) * STEP,
        y: row * ROW_LIFT + (H / 2) * Math.cos(LEAN) + STAND.thickness,
        z: -row * ROW_GAP,
    };
}

export default function CardStands3D({ origin, sections, chosen, taken, onPick }) {
    const baseGeometry = useMemo(() => roundedPlateLying(STAND.w, STAND.d, STAND.thickness, STAND.corner), []);
    const railGeometry = useMemo(() => roundedPlateGeometry(RAIL.w, RAIL.h, RAIL.thickness, 0.003), []);

    const urls = useMemo(() => sections.map((item) => item.back), [sections]);
    const backs = useTexture(urls, (maps) => {
        for (const map of Array.isArray(maps) ? maps : [maps]) {
            map.colorSpace = THREE.SRGBColorSpace;
            map.anisotropy = MAX_ANISOTROPY;
        }
    });

    const places = useMemo(() => sections.map((_, index) => standPlace(index)), [sections]);

    return (
        <group position={origin}>
            {sections.map((item, index) => {
                const place = places[index];
                // Откуда карта прилетает: её собственное гнездо в коробке набора, в
                // координатах этой группы. Карта там лежит плашмя, на уровне стола.
                const from = [item.at.x - origin[0], 0.004 - origin[1], item.at.z - origin[2]];
                const to = [place.x, place.y, place.z];
                const lit = chosen === item.index;
                // На сколько поднят ряд, в котором стоит эта карта. Дальние ряды подняты,
                // чтобы не прятаться за передними, — и без опоры их подставки висели в
                // воздухе. Поэтому под ними стоит брусок ровно на эту высоту.
                const lift = Math.floor(index / PER_ROW) * ROW_LIFT;

                return (
                    <group key={`${item.side}-${item.id}`}>
                        <group position={[place.x, place.y - (H / 2) * Math.cos(LEAN) - STAND.thickness, place.z]}>
                            {lift > 0 && (
                                // Брусок-подиум от стола до подставки: та же плита, растянутая
                                // по высоте. Тон темнее самой подставки — опора не должна
                                // спорить с рейкой, на которой стоит карта.
                                <mesh geometry={baseGeometry} scale={[0.92, lift / STAND.thickness, 0.92]} position={[0, -lift / 2, 0.004]}>
                                    <meshStandardMaterial color="#8f9aa1" roughness={0.6} metalness={0.04} />
                                </mesh>
                            )}
                            <mesh geometry={baseGeometry} position={[0, STAND.thickness / 2, 0.004]}>
                                <meshStandardMaterial
                                    color={lit ? "#e8f4f7" : "#b9c2c7"}
                                    roughness={0.35}
                                    metalness={0.05}
                                    emissive="#4fc3d9"
                                    emissiveIntensity={lit ? 0.28 : 0}
                                />
                            </mesh>
                            <mesh geometry={railGeometry} position={[0, STAND.thickness + (RAIL.h / 2) * Math.cos(LEAN), -0.008 - (RAIL.h / 2) * Math.sin(-LEAN)]} rotation={[LEAN, 0, 0]}>
                                <meshStandardMaterial color={lit ? "#dfeef2" : "#a9b3b9"} roughness={0.4} metalness={0.08} />
                            </mesh>
                        </group>

                        <CardInStand entry={item} index={index} map={backs[index]} from={from} to={to} chosen={lit} taken={taken === item.index} onPick={onPick} />
                    </group>
                );
            })}
        </group>
    );
}
