"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei/core/Texture";
import * as THREE from "three";

import { CARD_MM, MAX_ANISOTROPY } from "./tableSpots.mjs";
import { roundedPlateGeometry } from "./roundedPlate";

// Карты ролей МАЯКа — шесть отдельных предметов на столе, а не список картинок.
// В отличие от поля, карта жёсткая: у неё есть толщина, она не провисает и не мнётся,
// поэтому здесь не симуляция ткани, а тонкая коробка с шестью материалами.
//
// Файл отдаёт только RoleCardsGroup — встраиваемую группу с предметами. Стенд отдельной
// страницы /mayak-3d/roles живёт в stands.js.
//
// Единицы сцены — метры, как в FieldCloth3D.

// Растры ролей берём из roles-3d: это те же карты, но с обрезанным белым полем.
// На столе шесть карт с широкой белой рамкой сливаются в белое пятно, а сложенные
// стопкой — просто в белый прямоугольник. Оригиналы в /mayak-guide остаются для 2D-страниц.
const A = "/mayak-guide/roles-3d";

// Те же шесть ролей, что и в текстовом руководстве /mayak-guide. Список продублирован
// сознательно: сцена не должна тянуть за собой импорты и состояние страницы руководства.
// Кроме названия у роли ничего не нужно: разбор идёт вплотную к карте, и всё, что
// раньше дублировалось в накладке, читается прямо с неё.
const ROLES = [
    { img: "role_kapitan.jpg", nm: "Капитан" },
    { img: "role_mediator.jpg", nm: "Медиатор" },
    { img: "role_inspector.jpg", nm: "Инспектор" },
    { img: "role_hranitel.jpg", nm: "Хранитель Маяка" },
    { img: "role_engineer.jpg", nm: "Инженер" },
    { img: "role_letopisec.jpg", nm: "Летописец" },
];

// Кнопки, которые общая сцена рисует своим HTML и исполняет через ref.run(id).
export const ROLES_ACTIONS = [{ id: "reset", label: "Положить обратно" }];

const CARD_W = CARD_MM.w / 1000; // как у остальных карт набора; высота — из пропорции растра
const THICKNESS = 0.0004; // 0.4 мм картона: торец видно, но карта не выглядит бруском
const EDGE = "#141b2c"; // торец под тёмный фон рисунка ролей
const CORNER = CARD_MM.corner / 1000; // скругление углов — то же, что у карт колоды

const REST_Y = THICKNESS / 2 + 0.0002; // карта лежит на столе, не в столе
const LAYER = 0.00008; // соседи слегка расходятся по высоте, иначе на нахлёсте z-fighting

const HOVER_LIFT = 0.018; // наведение приподнимает карту над столом
const ARC = 0.045; // выезжая вперёд, карта проходит НАД соседями, а не сквозь них

// Поза разбора задана В КООРДИНАТАХ ГРУППЫ, а не мира: в общей сцене группа стоит
// со смещением, и мировые числа увели бы карту в чужой угол стола.
//
// Карта встаёт перед своим рядом (FOCUS_Z), но не за кромкой стола. Смещения по X нет:
// панель шагов в разборе роли не показывают, кадр свободен целиком, и карта стоит ровно
// посередине. Раньше FOCUS_Z равнялся 0.2 при группе на z = 0.52 — поднятая карта
// оказывалась в точке съёмки, то есть ровно под камерой, и её не было видно.
export const ROLE_FOCUS = { x: 0, z: 0.2 };
const FOCUS_X = ROLE_FOCUS.x;
const FOCUS_Z = ROLE_FOCUS.z;
// Завал назад под камеру разбора. Она приходит низко и почти в лоб (см. ROLE_VIEW в
// MayakTable3D), поэтому карта стоит почти вертикально: сильный завал сплющил бы её.
// Орбиты в общей сцене нет — камера приходит в известную точку, поэтому доворот
// «на камеру» здесь фиксированный, без чтения camera.position.
export const FOCUS_TILT = -0.42;

const FOCUS_SECONDS = 0.55;
const HOVER_SECONDS = 0.18;

// Та же функция сглаживания, что у поля: старт и финиш без рывка.
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;

// Раскладка «как разложили руками»: два ряда по три, у каждой карты свой разворот.
// Числа подобраны, а не сгенерированы: стол должен выглядеть одинаково каждый раз.
const SLOTS = [
    { x: -0.115, z: -0.082, spin: 0.09 },
    { x: 0.0, z: -0.09, spin: -0.05 },
    { x: 0.117, z: -0.076, spin: 0.13 },
    { x: -0.12, z: 0.078, spin: -0.11 },
    { x: -0.004, z: 0.086, spin: 0.06 },
    { x: 0.114, z: 0.074, spin: -0.08 },
];

// Убранная стопка: шесть карт лежат друг на друге с лёгким разбросом руки.
// Разложены они только пока мастер у них: постоянные два ряда по три занимают
// четверть стола, и общий план из-за них уходит в мелкий масштаб.
const PACK_SECONDS = 0.5;
const packed = (index) => ({ x: index * 0.0016, z: index * 0.0021, spin: (index % 3) * 0.018 - 0.018 });

function Card({ index, map, slot, focused, hovered, onHover, onSelect, active }) {
    const group = useRef(null);
    const faceMaterial = useRef(null);
    // open — раскрыта ли стопка в ряды; focus — поднята ли эта карта; hover — наведение.
    const progress = useRef({ open: 0, focus: 0, hover: 0 });
    const pack = useMemo(() => packed(index), [index]);

    // Пропорция — из самого файла: подгонять её константой значит ловить искажение
    // при первой же замене картинки роли.
    const height = (CARD_W * map.image.height) / map.image.width;
    const geometry = useMemo(() => roundedPlateGeometry(CARD_W, height, THICKNESS, CORNER), [height]);
    const restY = REST_Y + index * LAYER;

    useFrame((state, delta) => {
        // Кадр после возвращения во вкладку может быть длиной в секунды — иначе
        // карта не «доедет», а телепортируется.
        const step = Math.min(delta, 1 / 20);
        const p = progress.current;
        p.open = clamp01(p.open + (active ? step / PACK_SECONDS : -step / PACK_SECONDS));
        p.focus = clamp01(p.focus + (focused ? step / FOCUS_SECONDS : -step / FOCUS_SECONDS));
        // Поднятая карта не подсвечивается как наведённая: у неё уже свой режим.
        p.hover = clamp01(p.hover + (hovered && !focused ? step / HOVER_SECONDS : -step / HOVER_SECONDS));

        const o = ease(p.open);
        const f = ease(p.focus);
        const h = ease(p.hover);
        const obj = group.current;
        if (!obj) return;

        // Три положения по очереди: стопка → своё место в ряду → поднята для разбора.
        obj.position.x = mix(mix(pack.x, slot.x, o), FOCUS_X, f);
        obj.position.z = mix(mix(pack.z, slot.z, o), FOCUS_Z, f);
        // Поднятая карта стоит на столе, а не висит над ним: центр поднимается ровно
        // на половину высоты с поправкой на завал назад.
        obj.position.y = mix(restY, (height / 2) * Math.cos(FOCUS_TILT) + 0.001, f) + Math.sin(f * Math.PI) * ARC + h * HOVER_LIFT;

        // Порядок Эйлера XYZ: лежащая карта — это X = -90°, а разворот на столе
        // при этом даёт Z, не Y. Через Y карта бы не легла, а встала на ребро.
        obj.rotation.x = mix(-Math.PI / 2, FOCUS_TILT, f);
        obj.rotation.z = mix(mix(pack.spin, slot.spin, o), 0, f);

        // Подсветка идёт по самой картинке (emissiveMap), иначе ровное свечение
        // забивает лицо карты белым.
        if (faceMaterial.current) faceMaterial.current.emissiveIntensity = h * 0.3 + f * 0.1;
    });

    // Спящий предмет не должен ни ловить курсор, ни попадать в raycast общей сцены:
    // без обработчиков R3F вычёркивает объект из списка интерактивных.
    const handlers = active
        ? {
              onPointerOver: (event) => {
                  event.stopPropagation();
                  onHover(index);
              },
              onPointerOut: () => onHover(null),
              onClick: (event) => {
                  event.stopPropagation();
                  // Протяжка камеры начинается нажатием на ту же карту, и R3F всё равно
                  // считает это кликом. event.delta — пройденный курсором путь в пикселях,
                  // тот же порог, по которому R3F отсекает протяжку от промаха.
                  if (event.delta > 2) return;
                  onSelect(index);
              },
          }
        : null;

    return (
        <mesh ref={group} geometry={geometry} castShadow receiveShadow {...handlers}>
            {/* Порядок групп у roundedPlate: лицо, рубашка, торец.
                Скруглённые углы — не украшение: у растра роли углы печатной страницы
                светлые, и на прямоугольной геометрии они торчали белыми уголками поверх
                тёмного рисунка. Скругление срезает их вместе с геометрией.
                Цветовое пространство и анизотропия ставятся в колбэке useTexture, как у
                остальных групп сцены (см. tuneTextures в TableDecks3D): через pierced-проп
                они доезжают только благодаря порядку фаз React и молча теряются, если
                текстуру успел залить другой потребитель. */}
            <meshStandardMaterial
                attach="material-0"
                ref={faceMaterial}
                map={map}
                emissive="#ffffff"
                emissiveMap={map}
                emissiveIntensity={0}
                roughness={0.75}
            />
            <meshStandardMaterial attach="material-1" color="#8c4a33" roughness={0.75} />
            <meshStandardMaterial attach="material-2" color={EDGE} roughness={0.75} />
        </mesh>
    );
}

// Встраиваемый кусок для общей сцены: только предметы, никакого света, стола и HTML.
// Текст роли уходит наружу через onFocusRole, кнопки — через ref.run(actionId).
export const RoleCardsGroup = forwardRef(function RoleCardsGroup({ position = [0, 0, 0], active = true, onFocusRole }, ref) {
    const maps = useTexture(ROLES.map((role) => `${A}/${role.img}`), (textures) => {
        for (const map of [textures].flat()) {
            map.colorSpace = THREE.SRGBColorSpace;
            map.anisotropy = MAX_ANISOTROPY;
        }
    });
    const [focused, setFocused] = useState(null);
    const [hovered, setHovered] = useState(null);
    const notify = useRef(null);

    // Колбэк держим в ref: общая сцена почти наверняка передаст стрелку прямо в JSX,
    // и эффект не должен перезапускаться от смены её идентичности.
    useEffect(() => {
        notify.current = onFocusRole;
    });

    // Спящий предмет кладёт карту на место сам: в общей сцене камера уже улетела
    // к другому предмету, и оставленная стоймя карта торчала бы в кадре.
    // Сброс идёт на рендере, а не в эффекте: эффект здесь дал бы лишний каскадный
    // ререндер, а состояние всё равно должно смениться до отрисовки карт.
    const [wasActive, setWasActive] = useState(active);
    if (wasActive !== active) {
        setWasActive(active);
        setFocused(null);
        setHovered(null);
    }

    useEffect(() => {
        notify.current?.(focused === null ? null : ROLES[focused]);
    }, [focused]);

    useImperativeHandle(
        ref,
        () => ({
            run(actionId) {
                if (actionId === "reset") setFocused(null);
                // Пролистывание по кругу: разобрав одну карту, соседнюю берут стрелкой,
                // а не возвратом к раскладке и повторным попаданием курсором по картонке.
                if (actionId === "next" || actionId === "prev") {
                    const shift = actionId === "next" ? 1 : ROLES.length - 1;
                    setFocused((current) => (current === null ? 0 : (current + shift) % ROLES.length));
                }
            },
            hint() {
                return focused === null ? "Шесть ролей команды" : `Выбрана роль: ${ROLES[focused].nm}`;
            },
        }),
        [focused]
    );

    // Курсор живёт на body, поэтому и снимать его надо централизованно:
    // при размонтировании сцены «рука» иначе останется висеть на всей странице.
    useEffect(() => {
        if (hovered === null) return undefined;
        document.body.style.cursor = "pointer";
        return () => {
            document.body.style.cursor = "";
        };
    }, [hovered]);

    // Повторный клик по той же карте кладёт её обратно.
    const onSelect = useCallback((index) => {
        setFocused((current) => (current === index ? null : index));
    }, []);

    return (
        <group position={position}>
            {ROLES.map((role, index) => (
                <Card
                    key={role.img}
                    index={index}
                    map={maps[index]}
                    slot={SLOTS[index]}
                    active={active}
                    focused={focused === index}
                    hovered={hovered === index}
                    onHover={setHovered}
                    onSelect={onSelect}
                />
            ))}
        </group>
    );
});
