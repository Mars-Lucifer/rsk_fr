"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics, CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

import { BOARD_MM } from "./fieldLayout.mjs";
import { CARD_MM, CLOTH_SURFACE, DECK_BOX, JETON_BOX, MEEPLE_TRAY, READ_ROW, ROLES_AT, STAR_TRAY, TABLE } from "./tableSpots.mjs";
import { MY_PHASES, VOICE_SRC, YA_PHASES, buildMy, buildYa, readSlots } from "./tableScript.mjs";
import { MY_PLANS, TYPE_IDS, allowedCells, phaseOf, sideFinished, taktLabel } from "./guideRules.mjs";
import { ClothFieldGroup } from "./FieldCloth3D";
import { JetonsGroup } from "./Jetons3D";
import { CARD_NORMAL, CARD_OPEN, CardPinsGroup, pinWorld } from "./CardPins3D";
import { PINS } from "./cardPins.mjs";
import { ROLE_FOCUS, RoleCardsGroup } from "./RoleCards3D";
import TableDecks3D, { BOX_SPOTS, DECK_ID } from "./TableDecks3D";
import { YA_DECKS } from "./fieldLayoutYa.mjs";
import Meeples3D, { meepleTray } from "./Meeples3D";
import { CELLS, MEEPLE_COLORS, TYPES, cellOutline, cellToMeters, outward as outwardYa, pxToMeters as pxToMetersYa } from "./fieldLayoutYa.mjs";
import useGuideRoom from "./useGuideRoom";
import Stars3D from "./Stars3D";
import MayakokoPanel from "./MayakokoPanel";
import PromptLaptop3D, { LAPTOP_SPOT } from "./PromptLaptop3D";
import PromptCard3D from "./PromptCard3D";
import CardStands3D, { PER_ROW, standPlace } from "./CardStands3D";
import { CARD_IMG } from "./promptCard.mjs";

// Весь набор МАЯКа на одном столе. У каждого предмета своё постоянное место — как на
// реальном столе мастера: поле в центре, коробка жетонов под левой рукой, колода и лоток
// звёзд под правой, карты ролей перед игроком.
//
// Партия идёт сама: сценарий (tableScript.mjs) шаг за шагом отдаёт командыпредметам, а
// предметы сами решают, как доехать до своей точки. Это те же две раскладки, что показывают
// 2D-плееры на /mayak-guide, только здесь их разыгрывают настоящие вещи.
//
// Камера не орбитальная: она стоит над столом и перелетает к предмету по клику.
// Свободное вращение убрано сознательно — иначе кадр «плывёт» и предметы теряют места.

// Точки съёмки: eye — где камера, look — куда смотрит. Обе в метрах сцены.
// Общий план смещён вправо: справа сверху висит панель шагов, и без сдвига лоток миплов
// уходил бы под неё. Числа калибровочные — правятся под реальную вёрстку, а не выводятся.
//
// Кадр обязан держать всю глубину стола: два ряда колоды за полем (z ≈ −0.65) и ряд
// разбора у ближней кромки (z ≈ +0.43). Раньше камера стояла ниже и ближе, и выданная
// карта — та самая, которую переворачивают лицом вверх, — обрезалась нижним краем экрана.
const OVERVIEW = { eye: [0.2, 1.35, 1.15], look: [0.2, 0, 0] };

// Разбор роли — отдельная точка съёмки: камера падает низко, заходит почти в лоб и
// подходит вплотную. Со стандартного вида на предмет поднятая карта видна с торца,
// то есть не видна вовсе. Сдвига по X нет: панели в этот момент на экране нет, и карта
// стоит ровно посередине кадра.
const ROLE_VIEW = {
    eye: [ROLES_AT[0] + ROLE_FOCUS.x, 0.19, ROLES_AT[2] + ROLE_FOCUS.z + 0.28],
    look: [ROLES_AT[0] + ROLE_FOCUS.x, 0.07, ROLES_AT[2] + ROLE_FOCUS.z],
};

// Сколько стол расчищают перед переворотом полотна и сколько длится сам переворот.
// Первое — самый долгий возврат (64 карты с перехлёстом), второе — FLIP + SETTLE у ткани.
const CLEAR_MS = 1900;
const FLIP_MS = 4400;
// Осадка после переворота полотна, прежде чем ссылка из урока запускает партию.
// Подбирается по кадру: на 500 мс стол оставался пустым.
const DEEP_SETTLE_MS = 2500;

const CAMERA_EASE = 0.0016; // чем меньше, тем резче подлёт; независимо от частоты кадров

// Панель шагов занимает правую четверть экрана. Чтобы предмет под ней не оказывался,
// камера смотрит правее предмета ровно на эту величину — предмет уходит влево.
// Сдвиг нужен только полю: панель показывают лишь в его фокусе, у остальных предметов
// кадр свободен целиком, и увод влево оставлял бы справа пустоту.
const PANEL_SHIFT = 0.14;

// Место игрока — ближняя левая кромка стола, перед самой камерой: там стоит ноутбук,
// на экране которого живёт форма МАЯК-ОКО.
//
// Раньше здесь лежала плашка в дальнем левом углу, а форма выезжала отдельной панелью
// поверх кадра — панели всё равно, как далеко предмет. Экрану не всё равно: его высота
// в кадре равна доле, которую занимает крышка, и из дальнего угла (1.37 м до камеры)
// матрица занимала 17% высоты — на окне 900 px это 150 px на форму из семи полей.
// Разметка видна, текст нет.
//
// Поэтому ноутбук переехал к игроку, а не камера к ноутбуку: рамка кадра осталась
// прежней — экран слева, карта задания справа, — а экран занял ту же левую часть, где
// раньше висело стекло ввода. С этого места до камеры 0.47 м, и крышка держит около
// сорока процентов ширины кадра: форма приезжает почти пиксель в пиксель.
//
// Правее ноутбука проходит ряд разбора (READ_ROW, x от −0.34): между ними 5 см, и
// выданные карты не ложатся на корпус.
const PROMPT_AT = [-0.82, 0.004, -0.46];

// Карта задания в разборе стоит ближе всех к камере и потому крупнее подставок: слева
// экран ноутбука, справа сама карта — примерно одного с ним размера в кадре.
//
// Место выверено кадром, а не расчётом: со старой точки карта уходила за правую кромку
// вместе с номером задания и заголовком, то есть ровно тем, по чему её опознают.
// Координаты абсолютные, а не считанные от ноутбука: ноутбук переехал к игроку, а карта
// и подставки остались на своих местах.
const PROMPT_CARD_AT = [-0.54, 0.13, -0.62];

// Подставки стоят справа от ноутбука, тремя рядами по четыре — прямо в том же кадре,
// что и экран. Промежуточной ступени с отдельным видом на ряд больше нет: подойдя к
// ноутбуку, участник видит перед собой экран, а под правой рукой — разделы, из которых
// берут задание. Ради этого ряд и переехал сюда с середины стола.
const PROMPT_STANDS_AT = [-0.46, 0, -0.7];

// Двенадцать мест: шесть типов контента «Я» и шесть направлений «МЫ». «Старт» в подставки
// не ставится — по МАЯК-ОКО его задания не разбирают.
const PROMPT_SECTIONS = BOX_SPOTS.filter((entry) => entry.id !== "start");

// Разбор по полям есть пока только у карты-образца раздела «Текст»: разметка фрагментов
// ручная (promptCard.mjs), и у остальных разделов таблицы фрагментов ещё нет.
const MARKED_SECTION = "ya:text";

// Все растры, которые может показать карта разбора. Грузятся разом: иначе смена раздела
// роняет карту в Suspense, и на кадр-другой она пропадает — это и есть мигание при клике.
const PROMPT_IMAGES = [CARD_IMG, ...PROMPT_SECTIONS.map((entry) => entry.face), ...PROMPT_SECTIONS.map((entry) => entry.back)];

// Камера разбора — та же идея, что у карты роли: приходит низко и почти в лоб, вплотную,
// иначе стоящая карта видна с торца. Композиция прежняя: экран слева, карта задания
// справа, подставки за ними.
//
// Кадр собран по трём предметам сразу, а не подобран к одному. До экрана ноутбука
// получается 0.55 м, и крышка занимает около 43% высоты кадра — форма на 820 px приезжает
// с запасом на чтение. Ряд подставок при этом влезает по ширине, а поднятая карта задания
// встаёт в правую треть. Ось съёмки уведена левее середины: там крышка, и без сдвига её
// левая кромка срезалась краем кадра.
//
// Клавиатура уходит за нижнюю кромку наполовину — так и задумано: подойдя к ноутбуку,
// смотрят в экран, а не на корпус.
//
// Координаты по z абсолютные: ноутбук переехал к игроку, а камера осталась стоять с его
// стороны стола, и привязка к PROMPT_AT увела бы её за спину игроку.
// Камера приходит к экрану в лоб: направление взгляда — обратная нормаль раскрытой
// крышки, то есть сверху под тем же наклоном, на который она откинута. Косой подлёт
// давал завал текста в форме, а ноутбук на столе, стоящем по осям, читался вклеенным.
//
// Ось съёмки смещена вправо параллельным переносом, а не разворотом: eye и look имеют
// один и тот же x. Экран от этого уезжает в левую часть кадра, оставаясь фронтальным, —
// разворот на тот же сдвиг снова показал бы крышку под углом.
const PROMPT_VIEW = {
    eye: [-0.7, 0.325, -0.1665],
    look: [-0.7, 0.115, -0.62],
};



// Точка съёмки предмета выводится из его габарита, а не подбирается для каждого:
// высота пропорциональна размеру пятна, наклон один и тот же у всех — стол читается
// с одного ракурса, а не шестью разными.
function viewOf(at, size, panel = false) {
    const radius = Math.hypot(size[0], size[1]) / 2;
    // Высота подобрана так, чтобы предмет занимал около четырёх пятых кадра по ширине
    // при обычной пропорции окна. Это калибровочная ручка, а не вывод из оптики.
    const height = radius * 1.95 + 0.09;
    const shift = panel ? PANEL_SHIFT * (0.35 + radius) : 0;
    // Плоские и мелкие предметы смотрим положе: у фишки и звезды всё интересное
    // в силуэте, а отвесная камера показывает только их макушку.
    const reach = height * (radius < 0.2 ? 1.15 : 0.5);
    return {
        eye: [at[0] + shift, height, at[2] + reach],
        look: [at[0] + shift, 0, at[2]],
    };
}

// Ряд стопок — исключение из этой формулы, и не по вкусу, а по геометрии. Ряды лежат за
// полем, а высоту viewOf берёт от диагонали пятна: у полосы 840 × 165 мм диагональ почти
// равна её длине, камера уезжает высоко и далеко — то есть встаёт на само полотно. В кадр
// тогда попадает полотно крупным планом, а ряд уходит к верхней кромке, и оба ряда
// выглядят одинаково: «поле сверху, полоска карт вдали».
//
// Ряд снимается почти отвесно: всё его содержание — названия разделов на лицевой стороне,
// их читают сверху. Дальность считается от длины ряда, чтобы он занял кадр по ширине.
const ROW_PITCH = (74 * Math.PI) / 180;
function rowView(x, z, width) {
    // Множитель считан от кадра: ряд должен уложиться в ширину экрана с полями, а не впритык.
    const dist = width * 1.15;
    return {
        eye: [x, Math.sin(ROW_PITCH) * dist, z + Math.cos(ROW_PITCH) * dist],
        look: [x, 0, z],
    };
}

// Габариты пятен считаются от тех же чисел, что и сами предметы: карта 104 × 145 мм,
// шаг ряда и число мест берутся из tableSpots. Иначе рамка подсветки разъезжается
// с предметом при первой же правке раскладки стола.
const CARD_W = CARD_MM.w / 1000;
const CARD_H = CARD_MM.h / 1000;

// Ряд «Я» шире ряда «МЫ» — семь стопок против шести, и по нему считают общее пятно колоды.
const DECK_ROW_W = DECK_BOX.dx * 6 + DECK_BOX.gap + CARD_W;

// Пятно колоды — по обоим рядам.
const DECK_SPOT = {
    x: 0,
    z: (DECK_BOX.ya + DECK_BOX.my) / 2,
    w: DECK_ROW_W,
    d: DECK_BOX.my - DECK_BOX.ya + CARD_H + 0.02,
};

// Разбор карты — своя точка съёмки, как у карты роли: камера падает низко и заходит
// в лоб. С отвесного вида на ряд поднятая карта видна с торца, то есть не видна вовсе.
// Считается от гнезда стопки: разбирают верхнюю карту любого из тринадцати разделов.
function cardView(spot) {
    return {
        eye: [spot.at.x, 0.2, spot.at.z + CARD_OPEN.z + 0.3],
        look: [spot.at.x, 0.075, spot.at.z + CARD_OPEN.z],
    };
}

// Кучка лотков слева: жетоны, звёзды и миплы. Габарит выводится из их собственных
// координат, а не подбирается на глаз — сдвинули лоток в tableSpots, пятно поехало следом.
// KIT_PAD — поля вокруг крайних фишек: сами фишки в координатах точечные, а на столе
// занимают около 30 мм.
const KIT_PAD = 0.03;
const KIT = (() => {
    const x0 = Math.min(JETON_BOX.x, STAR_TRAY.x, MEEPLE_TRAY.x) - KIT_PAD;
    const x1 = Math.max(JETON_BOX.x + JETON_BOX.dx * 2, STAR_TRAY.x + STAR_TRAY.dx * 5, MEEPLE_TRAY.x + MEEPLE_TRAY.dx * 5) + KIT_PAD;
    const z0 = JETON_BOX.z - KIT_PAD;
    const z1 = MEEPLE_TRAY.z + KIT_PAD;
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
})();

// Поле в фокусе снимают не по габариту полотна. Во время партии перед его ближней кромкой
// лежит ряд разбора — выданные задания, ради которых ход и показывают, — и кадр, собранный
// по одному полотну, срезает их нижним краем экрана. Поэтому точка съёмки поля считается по
// общему пятну «полотно плюс ряд разбора»; само пятно предмета остаётся габаритом полотна,
// иначе ловушка курсора и рамка подсветки полезли бы на пустой стол.
const FIELD_NEAR = READ_ROW.z + CARD_H / 2;
const FIELD_FAR = -BOARD_MM.h / 2000;
const FIELD_VIEW = viewOf([0, CLOTH_SURFACE, (FIELD_NEAR + FIELD_FAR) / 2], [BOARD_MM.w / 1000, FIELD_NEAR - FIELD_FAR], true);

// Предметы стола: что где лежит, откуда на это смотрят и что про это сказать.
// at — центр пятна, size — его габарит [ширина, глубина] в метрах: и ловушка курсора,
// и рамка подсветки строятся по нему. Круг здесь не годится — колода стоит в одну
// линию за полем, и круг вокруг неё резал бы полотно.
const SPOTS = [
    {
        id: "field",
        nm: "Поле",
        sub: "двустороннее полотно 700 × 550 мм",
        at: [0, CLOTH_SURFACE, 0],
        size: [BOARD_MM.w / 1000, BOARD_MM.h / 1000],
        marker: [-0.3, 0.02, 0.3],
        view: FIELD_VIEW,
    },
    {
        // Три лотка слева — одно пятно и один маркер. По отдельности это три предмета
        // размером с ладонь, стоящие в ряд: три кольца на пустом столе и три почти
        // одинаковых подлёта камеры. Границы считаются от их собственных координат,
        // чтобы пятно не разъехалось с лотками при правке раскладки.
        id: "kit",
        nm: "Жетоны, звёзды и миплы",
        sub: "коробка жетонов, лоток звёзд и фишки команды",
        at: [KIT.x, 0.004, KIT.z],
        size: [KIT.w, KIT.d],
        // Маркер стоит слева от кучки: спереди от неё лежит рука команды, и кольцо
        // оказалось бы на разобранных картах.
        marker: [KIT.x - KIT.w / 2 - 0.06, 0.03, KIT.z],
    },
    {
        // Оба ряда колоды — одно пятно: они лежат вплотную друг к другу за полем и
        // читаются как одна выкладка набора. Габарит берётся по широкому ряду «Я» и по
        // глубине от дальней кромки одного ряда до ближней кромки другого.
        id: "decks",
        nm: "Карты",
        sub: "тринадцать разделов и карта разбора — ткните её, она перевернётся",
        at: [DECK_SPOT.x, 0.004, DECK_SPOT.z],
        size: [DECK_SPOT.w, DECK_SPOT.d],
        marker: [DECK_SPOT.x + DECK_SPOT.w / 2 + 0.055, 0.03, DECK_SPOT.z],
        view: rowView(DECK_SPOT.x, DECK_SPOT.z, DECK_SPOT.w),
    },
    {
        id: "roles",
        nm: "Планшет игрока",
        sub: "шесть функций команды",
        at: [ROLES_AT[0], 0.004, ROLES_AT[2]],
        size: [0.36, 0.34],
        marker: [ROLES_AT[0] + 0.24, 0.03, ROLES_AT[2]],
        // Рамка обводит убранную стопку, а не пятно целиком: пятно взято по раскладке в
        // два ряда — она нужна камере, — а на общем плане, где и наводят курсор, карты
        // лежат стопкой с ладонь. Рамка по пятну висела бы вокруг неё по пустому столу.
        glow: [0.15, 0.19],
    },
    {
        // Место игрока: отсюда собирают промпт по МАЯК-ОКО. Под маркером лежит ноутбук,
        // поэтому и пятно, и рамка считаются по его габариту — как у остальных предметов.
        id: "prompt",
        nm: "МАЯК-ОКО",
        sub: "семь полей — и промпт собран",
        at: PROMPT_AT,
        size: [LAPTOP_SPOT.w + 0.04, LAPTOP_SPOT.d + 0.04],
        glow: [LAPTOP_SPOT.w + 0.018, LAPTOP_SPOT.d + 0.018],
        // Маркер стоит слева от ноутбука, а не на нём: кольцо посреди крышки закрывало
        // ровно тот экран, ради которого к нему и подходят.
        marker: [PROMPT_AT[0] - LAPTOP_SPOT.w / 2 - 0.06, 0.03, PROMPT_AT[2]],
        // Камера действительно подъезжает к углу: низко, с разворотом на стол. Точка
        // съёмки уведена влево от плашки — там встаёт стекло ввода, а плашка, ряды колоды
        // и поле остаются в правой половине кадра, то есть перед глазами.
        view: PROMPT_VIEW,
    },
].map((spot) => ({ ...spot, view: spot.view ?? viewOf(spot.at, spot.size) }));

// Рамка подсветки: контур с закруглёнными углами по габариту предмета. Плоское
// заполнение поверх карт и полотна вымывает их краски, поэтому светится только контур.
function outlineGeometry([w, d], weight = 0.01) {
    const rounded = (halfW, halfD, r, Kind) => {
        const path = new Kind();
        path.moveTo(-halfW + r, -halfD);
        path.lineTo(halfW - r, -halfD);
        path.quadraticCurveTo(halfW, -halfD, halfW, -halfD + r);
        path.lineTo(halfW, halfD - r);
        path.quadraticCurveTo(halfW, halfD, halfW - r, halfD);
        path.lineTo(-halfW + r, halfD);
        path.quadraticCurveTo(-halfW, halfD, -halfW, halfD - r);
        path.lineTo(-halfW, -halfD + r);
        path.quadraticCurveTo(-halfW, -halfD, -halfW + r, -halfD);
        return path;
    };
    const inner = Math.min(w, d) * 0.14;
    const shape = rounded(w / 2 + weight, d / 2 + weight, inner + weight, THREE.Shape);
    shape.holes.push(rounded(w / 2, d / 2, inner, THREE.Path));
    const geometry = new THREE.ShapeGeometry(shape, 10);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
}

// Ловушка на стопке: невидимый прямоугольник во весь габарит карты. Сами карты колоды
// курсор не ловят вовсе — по листу в 0.3 мм не попасть, — поэтому «взять верхнюю»
// делается отдельной плоскостью над гнездом.
function DeckPick({ spot, chosen, onPick }) {
    const [hover, setHover] = useState(false);

    useEffect(() => {
        if (!hover) return undefined;
        document.body.style.cursor = "pointer";
        return () => {
            document.body.style.cursor = "";
        };
    }, [hover]);

    return (
        <mesh
            position={[spot.at.x, CLOTH_SURFACE + 0.012, spot.at.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerOver={(event) => {
                event.stopPropagation();
                setHover(true);
            }}
            onPointerOut={() => setHover(false)}
            onClick={(event) => {
                event.stopPropagation();
                if (event.delta > 2) return;
                setHover(false);
                onPick(spot.index);
            }}>
            <planeGeometry args={[CARD_W, CARD_H]} />
            <meshBasicMaterial
                color="#f4d9a2"
                transparent
                opacity={hover && !chosen ? 0.16 : 0}
                depthWrite={false}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

// Ячейка поля в живом режиме: подсветка ровно по печатному контуру клетки — гекс у
// лучей и СТАРТа, сектор кольца у обоих кругов. Круглым пятном это делать нельзя: игрок
// целится в круг, а фишка встаёт в гекс, и на соседних клетках пятна перекрываются.
//
// Появляется, только когда участник взял свою фишку: двадцать девять горящих клеток
// превращают поле в панель управления, а оно прежде всего игровое поле.
//
// Геометрия строится один раз на клетку и живёт в кэше: контуры одинаковых форм
// отличаются только положением, а материал у каждой свой — у них разная прозрачность.
const CELL_GEOMETRY = new Map();

// Ширина рамки в единицах растра поля: 9 из 1984 на ширину 700 мм — это чуть больше
// трёх миллиметров, как рисованный кант на самом поле.
const CELL_INSET = 9;

function cellGeometry(id) {
    if (CELL_GEOMETRY.has(id)) return CELL_GEOMETRY.get(id);
    const outline = cellOutline(id);
    const inner = cellOutline(id, CELL_INSET);
    const inner2 = cellOutline(id, CELL_INSET * 2);
    if (!outline || !inner || !inner2) return null;

    // Форма строится в плоскости XY и кладётся на стол поворотом группы на −90° по X.
    // Этот поворот переводит Y фигуры в −Z сцены, поэтому Z контура берётся со знаком
    // минус — иначе поле подсвечивается зеркально, ближним краем за дальний.
    const flat = (points) => points.map((p) => new THREE.Vector2(p.x, -p.z));
    const shape = new THREE.Shape(flat(outline));
    const fill = new THREE.ShapeGeometry(shape);

    // Рамка — кольцо между внешним контуром и ужатым: линия WebGL всегда в один пиксель
    // и на общем плане пропадает, а кольцу можно задать настоящую толщину.
    const ring = new THREE.Shape(flat(outline));
    ring.holes.push(new THREE.Path(flat(inner)));
    const edge = new THREE.ShapeGeometry(ring);

    // Второй кант, светлый, изнутри тёмного. Нужен из-за самого поля: тёмная рамка
    // пропадает на синих секторах внутреннего круга, светлая — на белых лучах. Вместе
    // они читаются на любом фоне, и это тот же приём, что у дорожной разметки.
    const glowRing = new THREE.Shape(flat(inner));
    glowRing.holes.push(new THREE.Path(flat(inner2)));
    const glow = new THREE.ShapeGeometry(glowRing);

    const made = { fill, edge, glow };
    CELL_GEOMETRY.set(id, made);
    return made;
}

// Спокойная клетка обозначена рамкой и едва тронута заливкой, под курсором — загорается
// и чуть приподнимается. Рамка тёмная, а не светлая: поле почти сплошь белое, и светлый
// кант на нём пропадает, тогда как тёмный читается и на белом, и на цветных секторах.
// В покое клетка обозначена только кантом, без заливки: двадцать девять залитых клеток
// и мутят рисунок поля, и стоят заметного числа кадров — прозрачные поверхности во весь
// экран дороги. Заливка приходит там, где она что-то значит: под курсором и под фишкой.
const CELL_REST = { fill: 0, edge: 0.34, glow: 0.22, lift: 0 };
const CELL_HOVER = { fill: 0.42, edge: 0.92, glow: 0.85, lift: 0.0022 };
const CELL_HERE = { fill: 0.2, edge: 0.6, glow: 0.45, lift: 0 };

// Ниже этого порога слой не рисуется вовсе: невидимая прозрачная поверхность стоит
// столько же, сколько видимая.
const CELL_MIN = 0.015;

// Высота подсветки над сукном. Здесь два требования тянут в разные стороны: ниже 5 мм
// подсветка тонет в полотне (ткань симулируется и лежит выше отметки CLOTH_SURFACE на
// свою толщину и провис), а выше — начинает заметно расходиться с рисунком поля, потому
// что камера смотрит на стол под углом и всякий зазор даёт параллакс. На 12 мм рамки
// уезжали с печатных клеток на треть гекса; 6 мм держат и то, и другое.
const CELL_Y = CLOTH_SURFACE + 0.006;

const noPick = () => null;

function CellPick({ cell, here, mineColor, delay, onPick, onHover }) {
    // Клетка, где фишка стоит сейчас, обведена её собственным цветом; остальные — тёмным
    // кантом, который одинаково читается на белом поле и на цветных секторах.
    const edgeColor = here ? mineColor : "#2a221b";
    const group = useRef(null);
    const fillRef = useRef(null);
    const edgeRef = useRef(null);
    const glowRef = useRef(null);
    const hover = useRef(false);
    const born = useRef(0);
    const geometry = useMemo(() => cellGeometry(cell.id), [cell.id]);

    // Клетки зажигаются волной от центра поля, а не все разом: волна показывает, что
    // открылось поле целиком, и глаз успевает прочесть раскладку. При системном запрете
    // анимации волны нет — клетки просто появляются.
    const calm = useMemo(
        () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
        []
    );

    useFrame((_, dt) => {
        if (!group.current || !fillRef.current || !edgeRef.current || !glowRef.current) return;
        born.current += dt;
        const wave = calm ? 1 : Math.min(1, Math.max(0, (born.current - delay) / 0.26));
        const target = hover.current ? CELL_HOVER : here ? CELL_HERE : CELL_REST;
        // Схождение к цели за кадр-независимое время — тот же приём, что у пятен предметов.
        const k = 1 - Math.pow(0.0009, dt);
        for (const [node, want] of [
            [fillRef.current, target.fill],
            [edgeRef.current, target.edge],
            [glowRef.current, target.glow],
        ]) {
            const next = node.material.opacity + (want * wave - node.material.opacity) * k;
            node.material.opacity = next;
            // Ловушка курсора живёт на заливке, поэтому её меш гасится не visible, а
            // прозрачностью: невидимый visible=false перестал бы ловить клик.
            if (node !== fillRef.current) node.visible = next > CELL_MIN;
        }
        group.current.position.y += (CELL_Y + target.lift - group.current.position.y) * k;
        const scale = calm ? 1 : 0.94 + 0.06 * wave;
        group.current.scale.setScalar(scale);
    });

    if (!geometry) return null;

    return (
        <group ref={group} position={[0, CELL_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh
                ref={fillRef}
                geometry={geometry.fill}
                onPointerOver={(event) => {
                    event.stopPropagation();
                    hover.current = true;
                    onHover(cell);
                    document.body.style.cursor = "pointer";
                }}
                onPointerOut={() => {
                    hover.current = false;
                    onHover(null);
                    document.body.style.cursor = "";
                }}
                onClick={(event) => {
                    event.stopPropagation();
                    hover.current = false;
                    onHover(null);
                    document.body.style.cursor = "";
                    onPick(cell.id);
                }}>
                <meshBasicMaterial color="#f4d9a2" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>

            {/* Рамка — главный сигнал «сюда можно»; заливка лишь придерживает клетку,
                чтобы кант не читался как царапина на поле. Своя клетка обведена цветом
                своей фишки: так видно, откуда фишка пойдёт. */}
            <mesh ref={edgeRef} geometry={geometry.edge} raycast={noPick} position={[0, 0, 0.0002]}>
                <meshBasicMaterial color={edgeColor} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>

            <mesh ref={glowRef} geometry={geometry.glow} raycast={noPick} position={[0, 0, 0.0003]}>
                <meshBasicMaterial color="#fff4dc" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
}

function Table() {
    return (
        <RigidBody type="fixed" colliders={false}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[TABLE.w, TABLE.d]} />
                <meshStandardMaterial color="#2f2823" roughness={0.9} />
            </mesh>
            <CuboidCollider args={[TABLE.w / 2, TABLE.thickness / 2, TABLE.d / 2]} position={[0, -TABLE.thickness / 2, 0]} />
            {/* Полотно поля физики не имеет, но жетоны кладут на него: под тканью лежит
                невидимая плита в её толщину, иначе жетоны опускались бы до стола. */}
            <CuboidCollider
                args={[BOARD_MM.w / 2000, CLOTH_SURFACE / 2, BOARD_MM.h / 2000]}
                position={[0, CLOTH_SURFACE / 2, 0]}
            />
        </RigidBody>
    );
}

// Пятно предмета на столе: широкий прозрачный диск ловит курсор, кольцо-маркер держит
// место, а мягкая подсветка под предметом загорается при наведении. Ловить курсор самими
// предметами нельзя — по стопке в 0.3 мм и по фишке в 24 мм не попасть, а карты и жетоны
// ещё и двигаются, так что цель уезжала бы из-под указателя.
function Hotspot({ spot, dimmed, onPick, onHover }) {
    const ring = useRef(null);
    const glow = useRef(null);
    const [hover, setHover] = useState(false);
    const { camera } = useThree();
    const scale = useRef(0);
    const lit = useRef(0);
    // Рамка не всегда совпадает с пятном: пятно задаёт кадр камеры и ловушку курсора, а
    // рамка обводит то, что реально лежит на столе. У карт ролей это разница между
    // раскладкой в два ряда (по ней считается подлёт) и убранной стопкой с ладонь (её и
    // обводим на общем плане). Массив в glow — этот собственный габарит рамки.
    const outlineSize = Array.isArray(spot.glow) ? spot.glow : spot.size;
    const outline = useMemo(() => outlineGeometry(outlineSize), [outlineSize]);

    useFrame((_, delta) => {
        const k = 1 - Math.pow(0.002, delta);

        const ringNode = ring.current;
        if (ringNode) {
            ringNode.quaternion.copy(camera.quaternion); // маркер всегда развёрнут к камере
            const target = dimmed ? 0 : hover ? 1.3 : 1;
            scale.current += (target - scale.current) * k;
            ringNode.scale.setScalar(Math.max(scale.current, 0.0001));
            ringNode.visible = scale.current > 0.02;
        }

        const glowNode = glow.current;
        if (glowNode) {
            lit.current += ((hover && !dimmed ? 1 : 0) - lit.current) * k;
            glowNode.material.opacity = lit.current * 0.55;
            glowNode.visible = lit.current > 0.01;
        }
    });

    const enter = (event) => {
        // Погашенное пятно не глотает событие: под ловушкой лежит карта разбора, и без
        // этого до неё не доходит ни наведение, ни клик — ловушка висит на 20 мм выше.
        if (dimmed) return;
        event.stopPropagation();
        setHover(true);
        onHover(spot);
        document.body.style.cursor = "pointer";
    };
    const leave = () => {
        setHover(false);
        onHover(null);
        document.body.style.cursor = "";
    };

    return (
        <>
            {/* Подсветка — рамка по контуру предмета, лежащая на столе. */}
            {spot.glow !== false && (
                <mesh ref={glow} geometry={outline} position={spot.at} visible={false}>
                    <meshBasicMaterial color="#f4d9a2" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
                </mesh>
            )}

            {/* Ловушка курсора: невидимый прямоугольник во весь габарит предмета. */}
            <mesh
                position={[spot.at[0], spot.at[1] + 0.02, spot.at[2]]}
                rotation={[-Math.PI / 2, 0, 0]}
                onPointerOver={enter}
                onPointerOut={leave}
                onClick={(event) => {
                    if (dimmed) return;
                    event.stopPropagation();
                    document.body.style.cursor = "";
                    onPick(spot.id);
                }}>
                <planeGeometry args={spot.size} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>

            <group ref={ring} position={spot.marker}>
                <mesh position={[0, 0, -0.0004]}>
                    <circleGeometry args={[0.026, 28]} />
                    <meshBasicMaterial color="#15110e" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
                </mesh>
                <mesh>
                    <ringGeometry args={[0.017, 0.023, 40]} />
                    <meshBasicMaterial color={hover ? "#ffffff" : "#d8cfbe"} transparent opacity={hover ? 0.95 : 0.75} side={THREE.DoubleSide} />
                </mesh>
                <mesh>
                    <circleGeometry args={[0.007, 24]} />
                    <meshBasicMaterial color="#f4efe6" transparent opacity={hover ? 1 : 0.8} side={THREE.DoubleSide} />
                </mesh>
            </group>
        </>
    );
}

// Знак листания: изогнутая стрелка с широким наконечником — половина того самого знака
// «поменять местами», который в наборе рисуют на обороте карт. Правая кнопка зеркалит
// её через CSS, чтобы обе стрелки были одного начертания.
function Curve() {
    return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            {/* Шеврон плюс дуга: рука ведёт карту назад по кругу. */}
            <path d="M9.5 14.5 4.5 9.5l5-5" />
            <path d="M4.5 9.5h8.5a5.5 5.5 0 0 1 0 11h-2.5" />
        </svg>
    );
}

// Стрелки, сходящиеся к центру: «убрать обратно». Тот же жест, что в просмотрщиках, и он
// не путается с шевронами листания ролей.
function Collapse() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M9 3v6H3" />
            <path d="M3.5 3.5 9 9" />
            <path d="M15 21v-6h6" />
            <path d="M20.5 20.5 15 15" />
        </svg>
    );
}

function CameraRig({ view }) {
    const { camera } = useThree();
    const eye = useMemo(() => new THREE.Vector3(...OVERVIEW.eye), []);
    const look = useMemo(() => new THREE.Vector3(...OVERVIEW.look), []);
    const targetEye = useMemo(() => new THREE.Vector3(...view.eye), [view]);
    const targetLook = useMemo(() => new THREE.Vector3(...view.look), [view]);

    useFrame((_, delta) => {
        const k = 1 - Math.pow(CAMERA_EASE, Math.min(delta, 1 / 20));
        eye.lerp(targetEye, k);
        look.lerp(targetLook, k);
        camera.position.copy(eye);
        camera.lookAt(look);
    });

    return null;
}

export default function MayakTable3D() {
    const [focus, setFocus] = useState(null);
    const [hovered, setHovered] = useState(null);
    const [role, setRole] = useState(null);
    // Какое поле МАЯК-ОКО сейчас разбирают: по нему на карте задания горит рамка вокруг
    // фрагмента, из которого это поле вычитано. Снимается там же, где снимается фокус.
    const [picked, setPicked] = useState(null);
    // Карта в этот момент возвращается в подставку: летит обратно тем же путём, и только
    // после посадки раздел снимается совсем. pending — раздел, который ждёт своей очереди:
    // клик по другой подставке сперва провожает текущую карту на место, и лишь потом
    // поднимает новую, иначе одна карта телепортируется в другую.
    const [stowing, setStowing] = useState(false);
    const [pending, setPending] = useState(null);
    // Раздел, чья карта стоит в разборе. По умолчанию — единственный размеченный «Текст».
    // Ни одна карта не поднята, пока её не выбрали: разбор начинается с пустого стола
    // и ряда подставок.
    const [section, setSection] = useState(null);
    // Карта разбора: поднята ли она, какой элемент выбран номером и какой сейчас под
    // курсором. Наведение общее для карты и для панели справа: подсветить блок можно
    // и с номера на карте, и со строки списка.
    const [anatomy, setAnatomy] = useState({ stack: null, open: false, pin: null, hint: null });
    const deck = anatomy.stack === null ? null : BOX_SPOTS[anatomy.stack];
    // Что сейчас происходит с полотном: null — лежит, "clear" — стол расчищают,
    // "flip" — ткань в воздухе. Пока не null, команды не принимаются.
    const [busy, setBusy] = useState(null);

    // Колода приезжает позже остального стола — у неё своя граница ожидания. Пока она
    // не встала, запускать партию нечем: startFrom упирается в пустую ручку и тихо
    // возвращается, то есть кнопка выглядит нажатой и не делает ничего.
    const [decksReady, setDecksReady] = useState(false);
    const onDecksReady = useCallback(() => setDecksReady(true), []);

    // Сторона и состояние плеера живут одним значением. Раздельно их держать нельзя:
    // переворот полотна меняет сценарий, и шаг от прошлой стороны обязан обнулиться в тот
    // же момент — иначе между рендерами существует кадр с чужим шагом в чужом сценарии.
    const [play, setPlay] = useState({ side: "ya", index: 0, started: false, playing: false });
    const { side, index, started, playing } = play;

    // Стопку можно взять в разбор, пока она лежит в коробке набора. У неиграющей стороны
    // это всегда: обе стороны лежат на столе одновременно, и «Я» на столе не мешает
    // разобрать карту «МЫ». У играющей — только до раскладки: потом её гнёзда пусты.
    const pickable = (entry) => entry.side !== side || !started;

    const fieldRef = useRef(null);
    const jetonsRef = useRef(null);
    const decksRef = useRef(null);
    const meeplesRef = useRef(null);
    const starsRef = useRef(null);
    const rolesRef = useRef(null);
    const voiceRef = useRef(null);

    const script = useMemo(() => (side === "ya" ? buildYa() : buildMy()), [side]);
    const phases = side === "ya" ? YA_PHASES : MY_PHASES;
    const step = script[Math.min(index, script.length - 1)];

    // Два режима одной сцены. «Демонстрация» — сценарная партия, как была: стол
    // разыгрывает себя сам. «Обучение» — живой стол: шесть мест, у каждого свой мипл,
    // позиции лежат на сервере, и участники ходят одновременно.
    //
    // Прототип. Своё маленькое хранилище комнаты вместо сессионного рантайма МАЯКа взято
    // сознательно: там вход через админскую сессию со столами и ролями, а здесь нужен
    // один стол и ссылка, которую мастер шлёт участнику.
    const [mode, setMode] = useState("demo");
    const live = mode === "live";
    // Токен из ссылки-приглашения читается один раз при монтировании и передаётся в хук:
    // он должен побеждать токен, сохранённый в этом браузере с прошлого занятия.
    const invite = useMemo(() => {
        if (typeof window === "undefined") return "";
        return new URLSearchParams(window.location.search).get("join") || "";
    }, []);
    // Ключ мастера тоже может прийти ссылкой — так роль возвращается после очистки
    // кэша или переезда за другой ноутбук.
    const inviteMaster = useMemo(() => {
        if (typeof window === "undefined") return "";
        return new URLSearchParams(window.location.search).get("master") || "";
    }, []);
    const room = useGuideRoom({ active: live, invite, inviteMaster });
    // Взял ли участник свою фишку в руку. Пока не взял, ячейки поля курсор не ловят.
    const [holding, setHolding] = useState(false);
    // Клетка под курсором — её название показывается в подписи внизу кадра. Без имени
    // подсветка говорит «сюда можно», но не говорит куда именно: лучи всех шести типов
    // выглядят одинаково, и с высоты камеры их не различить.
    const [hoveredCell, setHoveredCell] = useState(null);
    const [joinToken, setJoinToken] = useState("");
    const [joinName, setJoinName] = useState("");
    const [copied, setCopied] = useState("");

    // Ссылка приглашения открывается сразу в живом режиме с подставленным токеном:
    // участник получил её в мессенджере, и первый экран у него — «сесть за стол»,
    // а не демонстрация, из которой ещё надо переключиться.
    useEffect(() => {
        if (!invite) return;
        setJoinToken(invite);
        setMode("live");
    }, [invite]);

    const seats = room.room?.seats || [];
    const mySeat = room.seatIndex;
    const mySeatState = mySeat === null ? null : seats[mySeat] || null;
    const myCell = mySeatState?.cell || null;

    // Клетки, открытые этому месту прямо сейчас. Считает тот же модуль, по которому
    // сервер проверяет ход, поэтому «подсвечено, но не принято» невозможно.
    const openCells = useMemo(() => {
        if (!live || !room.room || !mySeatState) return [];
        return allowedCells(room.room, mySeatState);
    }, [live, room.room, mySeatState]);


    // Живой стол ведёт сервер, а сценарий двигает те же шесть фишек. Вместе они дерутся
    // за миплы, поэтому при входе в режим партия останавливается и стол расчищается.
    const switchMode = useCallback(
        (next) => {
            if (next === mode) return;
            setPlay((current) => ({ ...current, playing: false, started: false, index: 0 }));
            setHolding(false);
            decksRef.current?.returnAll();
            starsRef.current?.returnAll();
            jetonsRef.current?.pack();
            meeplesRef.current?.home();
            setMode(next);
            // Живой стол смотрят с поля: на общем плане фишка размером с ноготь, и
            // попасть по ячейке нельзя.
            setFocus(next === "live" ? "field" : null);
        },
        [mode]
    );

    // Раскладка живого стола: каждое место едет на свою ячейку, пустое — в лоток.
    // Ячейку в точку переводит сцена по fieldLayoutYa — сервер хранит только ярлык.
    //
    // Команда идёт по общим фазам одной клеткой на всех, поэтому фишки на ней надо
    // разводить: место в кластере считается не по номеру места, а по порядку среди тех,
    // кто на этой клетке стоит. Иначе одинокая фишка встаёт не в центр клетки, а в угол,
    // где было бы её место в шестёрке.
    const cellsKey = seats.map((seat) => seat.cell ?? "-").join("|");
    useEffect(() => {
        if (!live || !meeplesRef.current || !seats.length) return;
        const crowd = new Map();
        for (const seat of seats) {
            if (!seat.cell) continue;
            crowd.set(seat.cell, (crowd.get(seat.cell) || 0) + 1);
        }
        const seen = new Map();
        meeplesRef.current.moveTo(
            seats.map((seat) => {
                if (!seat.cell) return meepleTray(seat.index);
                const order = seen.get(seat.cell) || 0;
                seen.set(seat.cell, order + 1);
                const total = crowd.get(seat.cell) || 1;
                // Одна фишка — ровно в центр клетки; несколько — сеткой, как в демо.
                return total < 2 ? cellToMeters(seat.cell, 0, 0) : cellToMeters(seat.cell, order);
            })
        );
        // Зависимость по ярлыкам, а не по массиву seats: он новый после каждого опроса,
        // и раскладка перезапускала бы шаг фишки сорок раз в минуту — на чужих экранах
        // это выглядело как дёрганье.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [live, cellsKey]);

    // Карты появляются у всех одинаково, потому что порядок раздачи диктует сервер:
    // в журнале стола лежат события «убрать со стола» и «выдать карту из стопки», и
    // клиент проигрывает те, что новее уже применённых. Сама колода снимает верхнюю
    // карту, поэтому при одинаковом порядке событий у шестерых совпадают и лица карт.
    const appliedEvent = useRef(0);
    const events = room.room?.events;
    useEffect(() => {
        if (!live || !decksRef.current || !decksReady || !events?.length) return;
        const deck = decksRef.current;
        for (const event of events) {
            if (event.n <= appliedEvent.current) continue;
            appliedEvent.current = event.n;

            if (event.kind === "reset") {
                deck.returnAll();
                starsRef.current?.returnAll();
                jetonsRef.current?.pack();
                meeplesRef.current?.home();
                deck.layout();
                continue;
            }
            // Полотно переворачивают на сторону «МЫ»: сперва стол расчищают, и только
            // потом берутся за ткань — иначе половина набора исчезает на глазах.
            if (event.kind === "flip") {
                deck.returnAll();
                starsRef.current?.returnAll();
                jetonsRef.current?.pack();
                meeplesRef.current?.home();
                fieldRef.current?.run("flip");
                window.setTimeout(() => decksRef.current?.layout(), CLEAR_MS + FLIP_MS);
                continue;
            }
            if (event.kind === "park") {
                deck.parkDealt();
                continue;
            }
            // Такт «МЫ»: девять жетонов рубашкой вверх — это зафиксированный план, и
            // только под них уходят карты заданий.
            if (event.kind === "jetons-lay") {
                jetonsRef.current?.setTakt(event.takt);
                jetonsRef.current?.layTakt(event.takt);
                continue;
            }
            if (event.kind === "jetons-flip") {
                jetonsRef.current?.flipTakt(event.takt);
                continue;
            }
            // Принятая задача — звезда на трек индекса зрелости. Очередь по клетке:
            // девять звёзд одним кадром читаются как вспышка, а не как взятые предметы.
            if (event.kind === "star") {
                starsRef.current?.place(event.dir, event.cell * 0.09);
                continue;
            }
            if (event.kind === "jokers") {
                starsRef.current?.jokers();
                continue;
            }
            // Итог «Я»: красная звезда ложится рядом с фишкой того, кто закрыл луч.
            // Трека на этой стороне нет, поэтому звезда лежит на поле, а не на нём.
            if (event.kind === "joker-ya") {
                const type = TYPES.find((entry) => entry.id === event.typeId);
                if (type) starsRef.current?.joker(pxToMetersYa(outwardYa(type.ray[2], 78)), event.seatIndex * 0.12);
                continue;
            }
            if (event.kind !== "deal") continue;
            // Общая карта такта ложится по центру ряда разбора, карта специализации — в
            // своё место ряда из шести, а девять карт такта «МЫ» — в ряд по числу задач.
            const to =
                event.slot === "seat"
                    ? readSlots(MEEPLE_COLORS.length)[event.seatIndex]
                    : event.slot === "row"
                    ? readSlots(event.of || MY_PLANS[0].length)[event.cell]
                    : readSlots(1)[0];
            deck.deal(event.stack, to);
        }
    }, [live, decksReady, events]);

    // Вход в живой режим: стопки выходят из коробки на поле, как перед партией. Без
    // этого карты остались бы в коробке и раздавать было бы нечего.
    useEffect(() => {
        if (!live || !decksRef.current || !decksReady) return;
        decksRef.current.layout();
    }, [live, decksReady]);

    // Сел за стол — камера сразу на поле: с общего плана мипл размером с ноготь, по
    // ячейке им не попасть, и первое, что делает участник, это ищет своё поле руками.
    const joinSeat = useCallback(
        async (token, name) => {
            const done = await room.join(token, name);
            if (done) setFocus("field");
        },
        [room]
    );

    // Смена набора заданий: другой адрес и перезагрузка. Колода собирается на загрузке
    // модуля, поэтому менять её на месте нечем — да и на столе одну колоду сначала
    // убирают, а потом выкладывают другую.
    const switchDeck = useCallback((next) => {
        if (typeof window === "undefined" || next === DECK_ID) return;
        const url = new URL(window.location.href);
        if (next === "vuz") url.searchParams.delete("deck");
        else url.searchParams.set("deck", next);
        window.location.href = url.toString();
    }, []);

    // Две разные ссылки: приглашение для участников и ссылка мастера с ключом. Вторая
    // равна паролю от стола — её не рассылают, ею мастер возвращает себе роль.
    const copyLink = useCallback(
        (withMaster) => {
            if (typeof window === "undefined" || !room.token) return;
            const base = `${window.location.origin}${window.location.pathname}?join=${room.token}`;
            const link = withMaster ? `${base}&master=${room.masterKey}` : base;
            navigator.clipboard?.writeText(link).then(
                () => {
                    setCopied(withMaster ? "master" : "invite");
                    window.setTimeout(() => setCopied(""), 2000);
                },
                () => setCopied("")
            );
        },
        [room.token, room.masterKey]
    );

    const api = useCallback(
        () => ({
            decks: decksRef.current,
            jetons: jetonsRef.current,
            meeples: meeplesRef.current,
            stars: starsRef.current,
        }),
        []
    );

    // Убрать со стола всё, что на нём разложено. Это и «в начало» для плеера, и первая
    // половина переворота полотна: ткань нельзя вертеть вместе с жетонами и картами.
    const clearTable = useCallback(() => {
        decksRef.current?.returnAll();
        meeplesRef.current?.home();
        starsRef.current?.returnAll();
        jetonsRef.current?.pack();
    }, []);

    const startFrom = useCallback(
        (target) => {
            const now = api();
            // Текстуры грузятся внутри Suspense: до первого кадра групп ещё нет.
            if (!now.decks || !now.meeples || !now.stars || !now.jetons || target < 0) return;
            clearTable();
            // Прыжок на фазу: шаги до неё проигрываются мгновенно, иначе состояние стола
            // не сойдётся с подписью — карты остались бы в коробке, а жетоны на поле.
            for (let i = 0; i < target; i += 1) script[i].run(now);
            script[target].run(now);
            setPlay((current) => ({ ...current, index: target, started: true, playing: true }));
        },
        [api, clearTable, script]
    );

    // Голос ведёт партию, а не сопровождает её: длительность шага уже подогнана под длину
    // фразы (withVoice в tableScript), поэтому здесь остаётся только держать дорожку в
    // нужной точке. Перемотка идёт лишь на первом шаге фазы — внутри фазы дорожка играет
    // сама, и лишний seek дал бы щелчок на каждом шаге.
    useEffect(() => {
        const voice = voiceRef.current;
        if (!voice) return;
        if (!playing || busy || step.mute) {
            voice.pause();
            return;
        }
        if (step.seek != null && Math.abs(voice.currentTime - step.seek) > 0.3) voice.currentTime = step.seek;
        // Браузер отклоняет play() без жеста пользователя — первый запуск идёт с клика,
        // а отказ на всякий случай глушим: сцена должна идти и без звука.
        voice.play().catch(() => {});
    }, [playing, busy, step]);

    useEffect(() => {
        if (!playing || busy) return undefined;
        const timer = window.setTimeout(() => {
            const next = index + 1;
            if (next >= script.length) {
                setPlay((current) => ({ ...current, playing: false }));
                return;
            }
            script[next].run(api());
            setPlay((current) => ({ ...current, index: next }));
        }, step.hold);
        return () => window.clearTimeout(timer);
    }, [playing, busy, index, script, step.hold, api]);

    // Полотно отдаёт свою сторону наружу. Перевернулось — партия начинается заново,
    // уже по другому сценарию.
    const onFieldStatus = useCallback(({ face }) => {
        setPlay((current) => (current.side === face ? current : { side: face, index: 0, started: false, playing: false }));
    }, []);

    // Отступ на одну ступень: маркер элемента → вся карта → общий стол. Сразу к столу
    // нельзя: разобрав элемент, возвращаются к карте, а не к пустой сцене.
    //
    // Ступень выбирается по текущему состоянию, а не внутри updater'а setAnatomy: тот
    // вызывается лениво, и «съел ли Escape ступень» на месте вызова ещё неизвестно —
    // один нажатый Escape уводил камеру со стола вместе со снятием маркера.
    // Уход из зоны разбирает её обратно: поднятая карта возвращается в подставку, и
    // следующий заход начинается с пустого стола. Иначе карта прошлого раздела сама
    // подъезжала к глазам при каждом возвращении — а её берут руками из подставки, и это
    // движение не должно случаться само собой. Сброс мгновенный, без обратного полёта:
    // зона в этот момент уже вне кадра, и проигрывать там анимацию некому.
    const leavePrompt = useCallback(() => {
        setSection(null);
        setPending(null);
        setStowing(false);
        setPicked(null);
    }, []);

    const stepBack = useCallback(() => {
        if (anatomy.pin) {
            setAnatomy((current) => ({ ...current, pin: null }));
            return;
        }
        if (anatomy.open) {
            setAnatomy((current) => ({ ...current, open: false, hint: null }));
            return;
        }
        // Поднятая карта разбора — такая же ступень, как маркер элемента и открытая карта
        // колоды: первый Escape кладёт её обратно в подставку, и только следующий уводит
        // ко всему столу. Иначе один нажатый Escape уносил камеру со стола вместе с картой,
        // которую только что взяли в руки.
        if (focus === "prompt" && section !== null && !stowing) {
            setPicked(null);
            setStowing(true);
            return;
        }
        setRole(null);
        leavePrompt();
        setFocus(null);
    }, [anatomy.pin, anatomy.open, focus, section, stowing, leavePrompt]);

    // Тот же отступ с клавиатуры. Клик по пустому столу работает не всегда: вблизи
    // предмет занимает почти весь кадр, и «пустого стола» под курсором может не остаться.
    useEffect(() => {
        const onKey = (event) => {
            if (event.key !== "Escape") return;
            stepBack();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [stepBack]);

    const timers = useRef([]);
    useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

    const flip = useCallback(() => {
        if (busy) return;
        setPlay((current) => ({ ...current, playing: false }));
        setBusy("clear");
        clearTable();
        // Сначала стол пустеет, и только потом мастер берётся за ткань. Порядок важен:
        // перевернуть полотно с разложенными предметами в жизни нельзя, и в сцене это
        // выглядело бы как исчезновение половины набора.
        timers.current = [
            window.setTimeout(() => {
                setBusy("flip");
                fieldRef.current?.run("flip");
            }, CLEAR_MS),
            window.setTimeout(() => setBusy(null), CLEAR_MS + FLIP_MS),
        ];
    }, [busy, clearTable]);

    const reset = useCallback(() => {
        setPlay((current) => ({ ...current, index: 0, started: false, playing: false }));
        clearTable();
    }, [clearTable]);

    // Ссылка из урока приводит стол сразу к нужному месту партии: ?side=ya&phase=2.
    // Без этого мастеру, которому в уроке сказано «смотри кольцо», достаётся начало партии
    // и догадка, куда нажать, — а урок ровно от догадок и избавляет.
    //
    // Другая сторона сначала переворачивается: эффект после переворота срабатывает снова,
    // смена стороны приходит через onFieldStatus.
    //
    // ponytail: партия после переворота не стартует — startFrom отрабатывает вхолостую,
    // хотя ручки групп на месте, а тот же startFrom по кнопке через несколько секунд
    // раскладывает стол. Осадкой физики это не лечится: пробовал 0.5 и 2.5 с, кадр
    // одинаковый. До разбора кросс-сторонняя ссылка делает половину работы — приводит
    // на нужную сторону, а партию мастер пускает кнопкой. Ссылка внутри своей стороны
    // (?side=ya на «Я») работает целиком, ей и пользуются уроки.
    const deepLink = useMemo(() => {
        if (typeof window === "undefined") return null;
        const query = new URLSearchParams(window.location.search);
        const wanted = query.get("side");
        if (wanted !== "ya" && wanted !== "my") return null;
        const phase = Number.parseInt(query.get("phase") ?? "0", 10);
        return { side: wanted, phase: Number.isFinite(phase) ? Math.max(0, phase) : 0 };
    }, []);
    const deepDone = useRef(false);
    // Ссылку приходится доигрывать по тикам: между снятием busy и появлением ручек групп
    // ни одна зависимость эффекта не меняется, и без собственного повтора он замер бы на
    // перевёрнутом, но пустом столе.
    const [deepTick, setDeepTick] = useState(0);

    useEffect(() => {
        if (!deepLink || deepDone.current || live) return undefined;
        if (!decksReady || busy) {
            const timer = window.setTimeout(() => setDeepTick((value) => value + 1), 200);
            return () => window.clearTimeout(timer);
        }
        if (deepLink.side !== side) {
            flip();
            return undefined;
        }
        // Ручки групп после переворота встают не в том же кадре, что снимается busy:
        // startFrom на пустых ссылках тихо возвращается, и ссылка считалась бы
        // отработанной при неразложенном столе — полотно перевернулось, партия не идёт.
        if (!decksRef.current || !meeplesRef.current || !starsRef.current || !jetonsRef.current) {
            const timer = window.setTimeout(() => setDeepTick((value) => value + 1), 200);
            return () => window.clearTimeout(timer);
        }
        deepDone.current = true;
        const target = script.findIndex((item) => item.phase === deepLink.phase);
        // Пауза после снятия busy — калибровочная. Сразу после переворота предметы ещё
        // висят в физике, и команды раскладки уходят в тела, которые в этот момент падают:
        // на полсекунды стол оставался пустым, партия не начиналась вовсе.
        const timer = window.setTimeout(() => startFrom(target < 0 ? 0 : target), DEEP_SETTLE_MS);
        return () => window.clearTimeout(timer);
    }, [deepLink, live, decksReady, busy, side, flip, script, startFrom, deepTick]);

    // Прятать пятна во время партии больше не нужно, и это следствие объединения. Раньше
    // кольцо оставалось висеть над опустевшим местом — стопки уехали на поле, миплы на
    // гексы. Теперь в колоде всегда лежит второй ряд, а в кучке слева на «Я» остаётся
    // лоток звёзд, на «МЫ» — миплы: пусто под маркером не бывает.
    const spot = useMemo(() => SPOTS.find((entry) => entry.id === focus) || null, [focus]);

    // Куда едет выкладка колоды: к месту игрока в зоне МАЯК-ОКО, на своё место во всех
    // остальных состояниях.
    // Разбор МАЯК-ОКО: свой стол, свои предметы. Поле, жетоны, звёзды, миплы, ряды колоды
    // и карты ролей в нём скрыты — они спорят за внимание с картой и подставками. Именно
    // скрыты, а не размонтированы: у групп своё состояние и свой сценарий раскладки, и
    // снимать их со сцены ради смены ракурса значит терять партию.
    const inPrompt = focus === "prompt";

    // Какой раздел стоит в разборе. Карта-образец «Текст» размечена по полям, у остальных
    // разделов показывается лицо верхней карты без разбора.
    const chosenSection = PROMPT_SECTIONS.find((entry) => entry.index === section) || null;
    const cardMarked = chosenSection ? `${chosenSection.side}:${chosenSection.id}` === MARKED_SECTION : false;
    const cardImg = cardMarked || !chosenSection ? CARD_IMG : chosenSection.face;

    // Откуда карта поднимается: её собственное место в ряду подставок. Координаты берутся
    // у самих подставок, чтобы старт полёта не разошёлся с рядом при правке раскладки.
    const cardFrom = useMemo(() => {
        const at = PROMPT_SECTIONS.findIndex((entry) => entry.index === section);
        if (at < 0) return null;
        const place = standPlace(at);
        return [PROMPT_STANDS_AT[0] + place.x, PROMPT_STANDS_AT[1] + place.y, PROMPT_STANDS_AT[2] + place.z];
    }, [section]);

    // Высота дуги подъёма считается по ряду подставки: карта переднего ряда идёт к глазам
    // над пустым сукном, а карта заднего обязана перелететь через весь передний ряд — той
    // же дугой она проходила сквозь стоящие карты. Оба числа калибровочные: базовая высота
    // подъёма и прибавка на каждый ряд вглубь стола.
    const cardArc = useMemo(() => {
        const at = PROMPT_SECTIONS.findIndex((entry) => entry.index === section);
        return at < 0 ? 0.05 : 0.05 + 0.11 * Math.floor(at / PER_ROW);
    }, [section]);


    // Стопка, которую сейчас держит разбор. Одна проверка на всё: и карта в сцене, и
    // панель справа, и подлёт камеры смотрят на неё же. Раздельные условия расходились:
    // карту «Я», открытую до партии, после старта убирало со стола (её гнездо опустело),
    // а панель разбора и камера оставались на ней — кадр упирался в пустой стол.
    const openStack = spot?.id === "decks" && deck && pickable(deck) ? deck : null;

    // Разбор карты — что роли, что задания — меняет и позу карты, и точку съёмки: карта
    // встаёт, камера падает низко и заходит в лоб. Со стандартного вида на предмет
    // поднятую карту видно с торца, то есть не видно вовсе.
    // Выбранный маркер — это ещё и подлёт к самому элементу: «перейти в зону» значит
    // увидеть её вблизи, а не только прочитать подпись.
    const pinView = useMemo(() => {
        if (!anatomy.pin || !openStack) return null;
        const at = pinWorld(anatomy.pin, [openStack.at.x, CLOTH_SURFACE, openStack.at.z]);
        const reach = 0.14;
        return {
            eye: [at[0] + CARD_NORMAL[0] * reach, at[1] + CARD_NORMAL[1] * reach, at[2] + CARD_NORMAL[2] * reach],
            look: at,
        };
    }, [anatomy.pin, openStack]);

    const view =
        role && spot?.id === "roles"
            ? ROLE_VIEW
            : anatomy.open && openStack
            ? pinView ?? cardView(openStack)
            : spot
            ? spot.view
            : OVERVIEW;

    const phaseSteps = script.filter((item) => item.phase === step.phase);
    const phasePosition = phaseSteps.indexOf(step) + 1;
    const finished = started && !playing && index === script.length - 1;

    return (
        <div className="table3d">
            {/* Дорожка на обе стороны, одна на всю сцену. preload metadata, а не auto:
                полмегабайта не нужны, пока никто не нажал пуск. */}
            <audio ref={voiceRef} src={VOICE_SRC} preload="metadata" />

            {/* Тип карты теней задан явно. По умолчанию r3f ставит PCFSoftShadowMap,
                а three его объявил устаревшим и молча подменяет на PCFShadowMap —
                картинка та же, но консоль на каждой пересборке теней сыпет
                предупреждением. Ставим сразу то, что и так будет использовано. */}
            <Canvas
                shadows={{ type: THREE.PCFShadowMap }}
                dpr={[1, 2]}
                camera={{ position: OVERVIEW.eye, fov: 42 }}
                onPointerMissed={(event) => {
                    // Клик по форме на экране ноутбука промахом не считается. DOM крышки
                    // лежит внутри контейнера холста, на котором R3F слушает указатель,
                    // поэтому любой клик по полю формы приходит сюда как «мимо предметов»
                    // — и зона закрывалась ровно тогда, когда в поле собирались писать.
                    //
                    // Проверяется цель события, а не гасится всплытие на самой матрице:
                    // остановленное всплытие не доходит до корня приложения, где React
                    // держит свои делегированные слушатели, и тогда перестают работать
                    // все кнопки формы — сброс, кубик, «взять с карты», копирование.
                    if (event?.target instanceof Element && event.target.closest(".mayakoko")) return;

                    // Клик по пустому столу уводит сразу, минуя ступени, — но карту при
                    // этом надо опустить: иначе она поднимется сама при следующем заходе
                    // в колоду, без клика по стопке.
                    setAnatomy((current) => ({ ...current, open: false, pin: null, hint: null }));
                    setRole(null);
                    leavePrompt();
                    setFocus(null);
                }}>
                <color attach="background" args={["#15110e"]} />
                <ambientLight intensity={0.5} />
                <directionalLight
                    position={[1.1, 1.9, 0.9]}
                    intensity={2.2}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                    shadow-camera-left={-1.4}
                    shadow-camera-right={1.4}
                    shadow-camera-top={1.1}
                    shadow-camera-bottom={-1.1}
                    shadow-bias={-0.0004}
                />
                <directionalLight position={[-1.3, 1, -0.8]} intensity={0.45} />

                {/* Группы грузят свои текстуры и саспендятся на первом кадре — без границы
                    ожидания повиснет вся сцена, включая стол и маркеры. */}
                <Suspense fallback={null}>
                    <Physics gravity={[0, -9.81, 0]}>
                        <Table />
                        {/* Весь набор прячется в разборе МАЯК-ОКО: там на столе только
                            подставки с разделами и одна разобранная карта. */}
                        <group visible={!inPrompt}>
                        <ClothFieldGroup ref={fieldRef} onStatus={onFieldStatus} />
                        {/* Коробка жетонов стоит в кучке слева на обеих сторонах, как и
                            миплы со звёздами: набор на столе один, и предметы с него не
                            исчезают от переворота полотна. В партии «Я» жетоны просто не
                            участвуют — лежат в своих ячейках. */}
                        <JetonsGroup ref={jetonsRef} position={[0, CLOTH_SURFACE, 0]} />

                        {/* У колоды своя граница ожидания, и это самая дорогая правка
                            загрузки во всей сцене. Лица 85 карт весят почти шесть мегабайт
                            против одного у всего остального, а на общем плане их не видно
                            вовсе — там стопки лежат рубашками вверх. Под общим Suspense
                            стол не появлялся, пока не догрузится последняя карта; со своей
                            границей поле, жетоны, звёзды и миплы встают сразу, а колода
                            дотекает следом. */}
                        <Suspense fallback={null}>
                            <TableDecks3D ref={decksRef} side={side} position={[0, CLOTH_SURFACE, 0]} onReady={onDecksReady} />
                            {/* Карта разбора — верхняя карта выбранной стопки и единственная
                                карта набора, которую можно взять руками: остальные курсор не
                                ловят вовсе, иначе по столу не попасть. */}
                            <CardPinsGroup
                                stack={openStack}
                                groundY={CLOTH_SURFACE}
                                open={anatomy.open}
                                pin={anatomy.pin}
                                hint={anatomy.hint}
                                onToggle={() => setAnatomy((current) => ({ ...current, open: !current.open, pin: null, hint: null }))}
                                onPin={(pin) => setAnatomy((current) => ({ ...current, pin }))}
                                onHint={(hint) => setAnatomy((current) => ({ ...current, hint }))}
                            />
                        </Suspense>
                        <Meeples3D
                            ref={meeplesRef}
                            position={[0, CLOTH_SURFACE, 0]}
                            mine={live ? mySeat : null}
                            selected={holding}
                            onPick={live && mySeat !== null ? () => setHolding((current) => !current) : null}
                        />

                        {/* Открыта клетка текущего такта, и только она: партия идёт
                            последовательно, прыгать через такт и уходить на чужой луч
                            нельзя. Подсветка появляется, когда своя фишка в руке. */}
                        {live && holding && mySeat !== null && (
                            <group>
                                {CELLS.filter((cell) => openCells.includes(cell.id)).map((cell) => (
                                    <CellPick
                                        key={cell.id}
                                        cell={cell}
                                        here={cell.id === myCell}
                                        mineColor={MEEPLE_COLORS[mySeat]}
                                        delay={0}
                                        onHover={setHoveredCell}
                                        onPick={(id) => {
                                            room.move(id);
                                            setHolding(false);
                                            setHoveredCell(null);
                                        }}
                                    />
                                ))}
                            </group>
                        )}
                        <Stars3D ref={starsRef} position={[0, CLOTH_SURFACE, 0]} />
                        <RoleCardsGroup ref={rolesRef} position={ROLES_AT} active={spot?.id === "roles"} onFocusRole={setRole} />
                        </group>
                    </Physics>
                </Suspense>

                {/* В фокусе гаснут все пятна, включая своё: вблизи кольцо предмета шире
                    кадра и превращается в дугу поперёк экрана. Выход — клик по пустому
                    столу (onPointerMissed) или ссылка в накладке. */}
                {/* Ноутбук места игрока стоит вне физики: его не берут в руки и не роняют,
                    он только держит угол и открывается, когда мастер подошёл. Форма живёт
                    на его экране настоящим DOM — в неё пишут прямо в сцене. */}
                <PromptLaptop3D position={PROMPT_AT} active={inPrompt} screenOn={inPrompt}>
                    <MayakokoPanel embedded onClose={stepBack} onPickFromCard={setPicked} picked={picked} marked={cardMarked} />
                </PromptLaptop3D>

                {/* Разбор появляется только в своей зоне: подставки с разделами и одна
                    выбранная карта. На общем плане они читались бы как забытые предметы. */}
                {inPrompt && (
                    <Suspense fallback={null}>
                        {chosenSection && (
                            <PromptCard3D
                                key={section}
                                position={PROMPT_CARD_AT}
                                from={cardFrom}
                                arc={cardArc}
                                images={PROMPT_IMAGES}
                                img={cardImg}
                                backImg={chosenSection.back}
                                marked={cardMarked}
                                picked={picked}
                                stowing={stowing}
                                onStowed={() => {
                                    setStowing(false);
                                    setSection(pending);
                                    setPending(null);
                                }}
                            />
                        )}
                        <CardStands3D origin={PROMPT_STANDS_AT} sections={PROMPT_SECTIONS} chosen={section} taken={section}
                            onPick={(index) => {
                                if (index === section) return;
                                setPicked(null);
                                if (section === null) {
                                    setSection(index);
                                    return;
                                }
                                // Текущая карта сперва возвращается в свою подставку —
                                // подмена одной карты другой на лету читается как сбой.
                                setPending(index);
                                setStowing(true);
                            }}
                        />
                    </Suspense>
                )}

                {SPOTS.map((item) => (
                    <Hotspot
                        key={item.id}
                        spot={item}
                        // Пятна предметов лежат выше самих предметов и первыми ловят луч.
                        // В демонстрации это и нужно: по фишке в 24 мм не попасть. Но у
                        // сидящего за столом фишка — предмет в руке, и пятно кучки её
                        // накрывает: клик по своему миплу уводил камеру к жетонам вместо
                        // того, чтобы взять фишку. Погашенное пятно луч не останавливает
                        // (обработчик выходит без stopPropagation), и клик доходит до того,
                        // что под ним: до мипла, а с фишкой в руке — до ячейки поля.
                        dimmed={Boolean(spot) || (live && mySeat !== null && (holding || item.id === "kit"))}
                        onPick={(id) => {
                            leavePrompt();
                            setFocus(id);
                            setHovered(null);
                        }}
                        onHover={setHovered}
                    />
                ))}

                {/* Верхнюю карту любого раздела можно взять и рассмотреть. Ловушка живёт
                    там, где под ней есть стопка: у неиграющей стороны — всегда, у играющей
                    — пока партия не началась. После раскладки её гнёзда пусты, и карта
                    висела бы над голым столом. Разбирать колоду «МЫ» при разложенном «Я»
                    (и наоборот) можно в любой момент: обе стороны лежат на столе всегда. */}
                {spot?.id === "decks" &&
                    BOX_SPOTS.filter(pickable).map((entry) => (
                        <DeckPick
                            key={`${entry.side}-${entry.id}`}
                            spot={entry}
                            chosen={anatomy.stack === entry.index && anatomy.open}
                            onPick={(index) =>
                                setAnatomy((current) =>
                                    current.stack === index && current.open
                                        ? { ...current, open: false, pin: null, hint: null }
                                        : { stack: index, open: true, pin: null, hint: null }
                                )
                            }
                        />
                    ))}

                <CameraRig view={view} />
            </Canvas>

            {/* Стрелки листания ролей. Появляются только у поднятой карты: это её орган
                управления, а не постоянный элемент сцены. */}
            {role && (
                <>
                    <button type="button" className="arrow left" aria-label="Предыдущая роль" onClick={() => rolesRef.current?.run("prev")}>
                        <Curve />
                    </button>
                    <button type="button" className="arrow right" aria-label="Следующая роль" onClick={() => rolesRef.current?.run("next")}>
                        <Curve />
                    </button>
                </>
            )}

            {/* Отложить карту: она уходит обратно в подставку, кадр остаётся. Иконка —
                стрелки, сходящиеся внутрь: тот же жест «свернуть обратно», что и в
                просмотрщиках, и он не путается со стрелками листания ролей. */}
            {inPrompt && chosenSection && (
                <button
                    type="button"
                    className="stow"
                    onClick={() => {
                        setPicked(null);
                        setStowing(true);
                    }}
                    title="Отложить карту в подставку">
                    <Collapse />
                </button>
            )}

            {/* Переключатель режимов — сверху по центру, над сценой. Демонстрация
                остаётся тем, чем была; живой стол включается рядом, а не вместо неё. */}
            <div className="modes">
                <button type="button" className={mode === "demo" ? "on" : ""} onClick={() => switchMode("demo")}>
                    Демонстрация
                </button>
                <button type="button" className={live ? "on" : ""} onClick={() => switchMode("live")}>
                    Обучение
                </button>

                {/* Набор заданий — тот же переключатель, но про реквизит: поле и фишки
                    у колод общие, разные только лица карт. */}
                <span className="sep" />
                {Object.values(YA_DECKS).map((deck) => (
                    <button
                        key={deck.id}
                        type="button"
                        className={DECK_ID === deck.id ? "on" : ""}
                        title={`Колода заданий «${deck.name}»`}
                        onClick={() => switchDeck(deck.id)}>
                        {deck.name}
                    </button>
                ))}
            </div>

            {live && (
                <div className="room">
                    {!room.token ? (
                        <>
                            <strong>Живой стол</strong>
                            <p>Создайте стол и пришлите ссылку участникам — сядут за него сами, до шести человек.</p>
                            <button type="button" className="act" disabled={room.busy} onClick={room.create}>
                                Создать стол
                            </button>
                            <div className="or">или войдите по коду</div>
                            <input
                                value={joinToken}
                                onChange={(event) => setJoinToken(event.target.value)}
                                placeholder="Код стола"
                                aria-label="Код стола"
                            />
                            <input
                                value={joinName}
                                onChange={(event) => setJoinName(event.target.value)}
                                placeholder="Ваше имя"
                                aria-label="Ваше имя"
                            />
                            <button type="button" className="act" disabled={room.busy} onClick={() => joinSeat(joinToken, joinName)}>
                                Сесть за стол
                            </button>
                        </>
                    ) : (
                        <>
                            <strong>Стол {room.token}</strong>
                            <button type="button" className="act" onClick={() => copyLink(false)}>
                                {copied === "invite" ? "Ссылка скопирована" : "Ссылка для участников"}
                            </button>
                            {room.isMaster && room.masterKey ? (
                                <button type="button" className="ghost" title="Открывает стол с правами мастера — не рассылать участникам" onClick={() => copyLink(true)}>
                                    {copied === "master" ? "Скопирована ссылка мастера" : "Ссылка мастера (только себе)"}
                                </button>
                            ) : null}

                            {/* Такт — главное, что нужно знать за столом: где партия и
                                кого ждут. Считается из состояния комнаты тем же модулем
                                правил, что и подсветка клетки. */}
                            {room.room && <div className="takt">{taktLabel(room.room)}</div>}

                            {mySeat === null ? (
                                <>
                                    <input
                                        value={joinName}
                                        onChange={(event) => setJoinName(event.target.value)}
                                        placeholder="Ваше имя"
                                        aria-label="Ваше имя"
                                    />
                                    <button type="button" className="act" disabled={room.busy} onClick={() => joinSeat(room.token, joinName)}>
                                        Занять место
                                    </button>
                                </>
                            ) : (
                                <p className="hint">
                                    {room.room?.side === "my"
                                        ? "Сторона «МЫ»: фишки не ходят. Решайте задания такта, такт закрывает мастер."
                                        : openCells.length === 0 && myCell
                                        ? "Ход сделан — ждём остальных."
                                        : openCells.length === 0
                                        ? "Ходить некуда: выберите направление или дождитесь такта."
                                        : holding
                                        ? "Фишка в руке — открытая клетка подсвечена."
                                        : "Нажмите на свой мипл, чтобы взять его."}
                                </p>
                            )}

                            {/* Направление специализации участник выбирает сам, до того
                                как команда разойдётся по лучам. От него зависят и
                                открытый луч, и стопка, из которой придут его карты. */}
                            {mySeat !== null && !mySeatState?.typeId && room.room?.phase >= 2 && (
                                <div className="types">
                                    <span className="or">выберите направление</span>
                                    <div className="row wrap">
                                        {TYPE_IDS.map((id) => (
                                            <button key={id} type="button" className="ghost" onClick={() => room.chooseType(id)}>
                                                {TYPES.find((type) => type.id === id)?.name || id}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <ul className="seats">
                                {seats.map((seat) => (
                                    <li key={seat.index} className={seat.index === mySeat ? "me" : ""}>
                                        <i style={{ background: MEEPLE_COLORS[seat.index] }} />
                                        <span className={seat.taken && !seat.online ? "away" : ""}>
                                            {seat.taken ? seat.name : "свободно"}
                                            {seat.taken && !seat.online ? " · нет связи" : ""}
                                        </span>
                                        {seat.typeId ? <em>{TYPES.find((type) => type.id === seat.typeId)?.name}</em> : null}
                                        {room.isMaster && seat.taken ? (
                                            <button type="button" className="free" title="Освободить место" onClick={() => room.freeSeat(seat.index)}>
                                                ✕
                                            </button>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>

                            {/* Панель мастера. Такт закрывает он: инспектора соседнего
                                стола в прототипе нет, а без приёмки партия не двигается. */}
                            {room.isMaster && (
                                <div className="master">
                                    {room.room?.blocker ? <p className="wait">{room.room.blocker}</p> : null}

                                    {/* Сторона «Я» пройдена — полотно переворачивают на
                                        «МЫ». Дальше фишки не ходят: там играют жетоны,
                                        карты направлений и трек индекса зрелости. */}
                                    {room.room && sideFinished(room.room) && room.room.side === "ya" ? (
                                        <button type="button" className="act" disabled={room.busy} onClick={room.flipSide}>
                                            Перевернуть на «МЫ»
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="act"
                                            disabled={room.busy || (room.room ? sideFinished(room.room) : false)}
                                            onClick={() => room.accept(Boolean(room.room?.blocker))}>
                                            {room.room?.side === "my" && room.room?.phase === 1
                                                ? "Такт закрыт"
                                                : room.room?.blocker
                                                ? "Принять такт всё равно"
                                                : "Задание принято"}
                                        </button>
                                    )}
                                    <button type="button" className="ghost" onClick={room.restart}>
                                        Партию сначала
                                    </button>
                                </div>
                            )}

                            <button type="button" className="ghost" onClick={room.leave}>
                                Выйти со стола
                            </button>
                        </>
                    )}

                    {room.error ? <p className="err">{room.error}</p> : null}
                </div>
            )}

            <div className="hud">
                <div className="side">
                    {/* Только то, где мы сейчас. Сторону полотна видно на самом полотне,
                        и дублировать её строкой над названием предмета незачем. */}
                    {/* Клетка под курсором вытесняет название предмета: в этот момент
                        участник целится ходом, и знать надо именно клетку. */}
                    <strong>{hoveredCell ? hoveredCell.label : hovered ? hovered.nm : spot ? spot.nm : "Стол мастера"}</strong>
                    {hoveredCell && myCell === hoveredCell.id ? <div className="role">фишка уже здесь</div> : null}
                    {/* Только название роли: всё остальное написано на самой карте, а она
                        в этот момент стоит перед камерой во весь кадр. */}
                    {role && (
                        <div className="role">
                            <strong>{role.nm}</strong>
                        </div>
                    )}

                </div>
            </div>

            {/* Подписи к поднятой карте здесь нет намеренно: название раздела написано на
                самой карте, а она в этот момент стоит перед камерой во весь кадр. */}

            {/* Разбор карты задания: те же шесть элементов, что и в 2D-руководстве.
                Наведение на строку обводит блок на карте, клик подводит к нему камеру. */}
            {anatomy.open && openStack && (
                <div className="panel">
                    <div className="head">
                        <strong>Карта задания</strong>
                        <span>{`${PINS.face.length} элементов на лице`}</span>
                    </div>

                    <div className="legend" onMouseLeave={() => setAnatomy((current) => ({ ...current, hint: null }))}>
                        {PINS.face.map((item, index) => (
                            <button
                                type="button"
                                key={item.id}
                                className={`item ${anatomy.hint === item.id || anatomy.pin?.id === item.id ? "on" : ""}`}
                                onMouseEnter={() => setAnatomy((current) => ({ ...current, hint: item.id }))}
                                onFocus={() => setAnatomy((current) => ({ ...current, hint: item.id }))}
                                onClick={() =>
                                    setAnatomy((current) => ({ ...current, pin: current.pin?.id === item.id ? null : item }))
                                }>
                                <span className="k">{String(index + 1).padStart(2, "0")}</span>
                                <span className="v">
                                    <b>{item.t}</b>
                                    <span>{item.d}</span>
                                </span>
                            </button>
                        ))}
                    </div>

                </div>
            )}

            {spot ? (
                // Кнопка делает ровно то же, что Escape, и подписью говорит, куда именно
                // отступит: с маркера элемента — к карте, с поднятой карты — к ряду, и
                // только с ряда — ко всему столу.
                <button type="button" className="back" onClick={stepBack}>
                    {anatomy.pin
                        ? "← К карте · Esc"
                        : anatomy.open && openStack
                        ? "← К ряду карт · Esc"
                        : inPrompt && section !== null
                        ? "← К подставкам · Esc"
                        : "← Ко всему столу · Esc"}
                </button>
            ) : (
                // На общем плане панели шагов нет, а стол после партии остаётся разложенным.
                // Убрать его отсюда больше неоткуда — кнопка занимает тот же угол, что и
                // «Ко всему столу» в фокусе предмета.
                <button type="button" className="back" onClick={reset} disabled={!started || Boolean(busy)}>
                    Разложить по местам
                </button>
            )}

            {/* Панель шагов — принадлежность поля, а не сцены: партия идёт на полотне, и
                показывать её управление, пока камера стоит над всем столом или над другим
                предметом, нечестно. Поэтому панель живёт только в фокусе поля.
                Div, а не aside: глобальные стили портала делают из aside колонку во всю
                высоту с position: sticky, и накладка уезжает к левому краю. */}
            {spot?.id === "field" && !live && (
            <div className="panel">
                {/* Номер шага из подписи убран: шаг виден по подсвеченной фазе и полосе
                    внизу панели, а числом «7 из 14» не пользуются. На его месте — возврат
                    раскладки к началу: расчистить стол и пойти с нулевого шага. */}
                <div className="head start">
                    <strong>{side === "ya" ? "Я цифровой эксперт" : "Мы цифровая организация"}</strong>
                    {/* «Сначала», а не «Начать сначала»: полное название стороны «Мы
                        цифровая организация» длиннее «Я цифровой эксперт», и с длинной
                        подписью кнопка вылезала за правую кромку панели именно на «МЫ». */}
                    <button type="button" className="restart" disabled={Boolean(busy) || !decksReady} onClick={() => startFrom(0)}>
                        Сначала
                    </button>
                </div>

                {/* Один орган управления вместо трёх подписей: зелёный треугольник —
                    пуск, красная пауза — остановка. Голос и стол идут вместе, поэтому и
                    кнопка у них одна. */}
                <button
                    type="button"
                    className={`play ${playing ? "on" : ""}`}
                    aria-label={playing ? "Пауза" : started && !finished ? "Продолжить" : "Показать раскладку"}
                    disabled={Boolean(busy) || !decksReady}
                    onClick={() =>
                        !started || finished ? startFrom(0) : setPlay((current) => ({ ...current, playing: !current.playing }))
                    }>
                    <span className="glyph" aria-hidden="true" />
                    {!decksReady
                        ? "Колода ещё едет…"
                        : playing
                        ? "Пауза"
                        : started && !finished
                        ? "Продолжить"
                        : finished
                        ? "Показать заново"
                        : "Показать раскладку"}
                </button>

                <ol className="phases">
                    {phases.map((phase, order) => {
                        const total = script.filter((item) => item.phase === phase.id).length;
                        const active = started && step.phase === phase.id;
                        const passed = started && step.phase > phase.id;
                        return (
                            <li key={phase.id}>
                                <button
                                    type="button"
                                    className={`phase ${active ? "on" : ""} ${passed ? "passed" : ""}`}
                                    disabled={Boolean(busy) || !decksReady}
                                    onClick={() => startFrom(script.findIndex((item) => item.phase === phase.id))}>
                                    <span className="num">{passed ? "✓" : String(order + 1).padStart(2, "0")}</span>
                                    <span className="txt">
                                        <b>
                                            {phase.label}
                                            {active && total > 1 ? <i>{`шаг ${phasePosition} из ${total}`}</i> : null}
                                        </b>
                                        {/* Описание — только у текущей фазы: пять развёрнутых
                                            блоков не помещаются в накладку и уезжают за экран. */}
                                        {active ? <span className="desc">{phase.text}</span> : null}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>

                <div className="bar">
                    <span className="fill" style={{ width: `${started ? ((index + 1) / script.length) * 100 : 0}%` }} />
                </div>

                {/* Подписи к шагу здесь больше нет: описание фазы стоит прямо в её строке
                    и меняется реже, а вторая бегущая строка под списком спорила с ней и
                    с голосом. */}

                {/* Обе кнопки в одну строку: они равноправны и делят ширину панели поровну,
                    поэтому и переносить нечего. */}
                <div className="row">
                    <button type="button" className="ghost" onClick={reset} disabled={!started || Boolean(busy)}>
                        Разложить по местам
                    </button>
                    <button type="button" className="ghost" onClick={flip} disabled={Boolean(busy)}>
                        Перевернуть на «{side === "ya" ? "МЫ" : "Я"}»
                    </button>
                </div>
            </div>
            )}

            <style jsx>{`
                /* Переключатель режимов и панель стола — те же материалы, что у остальных
                   накладок сцены: тёмная подложка с размытием, чтобы читаться и над
                   белым полотном, и над тёмным столом. */
                .modes {
                    position: absolute;
                    top: 24px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 4px;
                    padding: 4px;
                    border-radius: 999px;
                    background: rgba(20, 16, 13, 0.72);
                    backdrop-filter: blur(6px);
                    z-index: 3;
                }
                .modes button {
                    border: 0;
                    border-radius: 999px;
                    padding: 8px 18px;
                    font-size: 13px;
                    color: #d8cfbe;
                    background: transparent;
                    cursor: pointer;
                }
                .modes button.on {
                    background: #f4efe6;
                    color: #15110e;
                }
                .modes .sep {
                    width: 1px;
                    align-self: stretch;
                    margin: 4px 4px;
                    background: rgba(244, 239, 230, 0.18);
                }
                .room {
                    position: absolute;
                    top: 24px;
                    right: 24px;
                    width: 268px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding: 16px;
                    border-radius: 14px;
                    background: rgba(20, 16, 13, 0.82);
                    backdrop-filter: blur(6px);
                    color: #f4efe6;
                    font-size: 13px;
                    z-index: 3;
                }
                .room p {
                    margin: 0;
                    color: #b9b0a2;
                    line-height: 1.45;
                }
                .room .hint {
                    color: #f4d9a2;
                }
                .room .err {
                    color: #e08a7a;
                }
                .room .or {
                    color: #8d857a;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .room input {
                    border: 1px solid rgba(244, 239, 230, 0.18);
                    border-radius: 8px;
                    padding: 8px 10px;
                    background: rgba(244, 239, 230, 0.06);
                    color: #f4efe6;
                    font-size: 13px;
                }
                .room .act,
                .room .ghost {
                    border: 0;
                    border-radius: 8px;
                    padding: 9px 12px;
                    font-size: 13px;
                    cursor: pointer;
                }
                .room .act {
                    background: #f4efe6;
                    color: #15110e;
                }
                .room .ghost {
                    background: transparent;
                    color: #b9b0a2;
                    border: 1px solid rgba(244, 239, 230, 0.18);
                }
                .room .seats {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                .room .seats li {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #b9b0a2;
                }
                .room .seats li.me {
                    color: #f4efe6;
                }
                .room .seats i {
                    width: 10px;
                    height: 10px;
                    border-radius: 3px;
                    flex: 0 0 auto;
                }
                .room .seats em {
                    font-style: normal;
                    font-size: 11px;
                    color: #8d857a;
                    margin-left: auto;
                }
                .room .seats .free {
                    border: 0;
                    background: none;
                    color: #8d857a;
                    cursor: pointer;
                    padding: 0 2px;
                    font-size: 12px;
                }
                .room .takt {
                    padding: 7px 10px;
                    border-radius: 8px;
                    background: rgba(244, 217, 162, 0.14);
                    color: #f4d9a2;
                    font-size: 12px;
                }
                .room .row.wrap {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                }
                .room .row.wrap .ghost {
                    flex: 1 1 auto;
                    font-size: 12px;
                    padding: 6px 8px;
                }
                .room .master {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding-top: 8px;
                    border-top: 1px solid rgba(244, 239, 230, 0.14);
                }
                .room .master .wait {
                    color: #f4d9a2;
                    font-size: 12px;
                }
                .room .seats .away {
                    color: #8d857a;
                }

                /* На телефоне панель уезжает вниз узкой полосой: на 390 px она накрывала
                   поле целиком, и играть было нечем — доска видна полосками по краям.
                   Внизу же она перекрывает только ближнюю кромку стола, где ничего,
                   кроме ряда разбора, не лежит. */
                .table3d {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }
                .hud {
                    position: absolute;
                    left: 24px;
                    bottom: 24px;
                    pointer-events: none;
                    /* Подложка нужна не для красоты: в фокусе под подписью оказывается
                       белое полотно поля, и светлый текст на нём пропадает. */
                    padding: 12px 16px;
                    border-radius: 12px;
                    background: rgba(20, 16, 13, 0.72);
                    backdrop-filter: blur(6px);
                }
                .side {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    color: rgba(244, 239, 230, 0.62);
                    font-size: 13px;
                }
                .side strong {
                    color: #f4efe6;
                    font-size: 22px;
                    font-weight: 600;
                    line-height: 1.2;
                }
                /* Стрелки листания ролей: круглые кнопки у левого и правого края кадра.
                   Поднятая карта стоит в середине, и по бокам от неё пусто. */
                /* Уровень стрелок — примерно там, где на столе лежат сами карты, а не
                   середина экрана: поднятая карта занимает верхние две трети кадра, и
                   кнопки посреди неё читались как часть карты. */
                .arrow {
                    position: absolute;
                    top: 68%;
                    transform: translateY(-50%);
                    width: 52px;
                    height: 52px;
                    padding: 0;
                    display: grid;
                    place-items: center;
                    font-size: 22px;
                    line-height: 1;
                    background: rgba(20, 16, 13, 0.72);
                    backdrop-filter: blur(6px);
                }
                /* Ближе к центру, а не по кромкам экрана: у самых краёв кнопки читаются
                   как элементы страницы, а не как органы управления этой картой.
                   Зеркалится левая, а не правая: обе кнопки — одна и та же глифа, и
                   наконечник должен смотреть в сторону своего края кадра. */
                .arrow.left {
                    left: 27%;
                    transform: translateY(-50%) scaleX(-1);
                }
                .arrow.right {
                    right: 27%;
                }
                /* Выход из фокуса — в левом верхнем углу: это навигация, а не подпись
                   к предмету, и искать её внизу, под текстом роли, было негде. */
                /* Под картой разбора, по центру её половины кадра: это орган управления
                   картой, поэтому стоит под ней, а не в углу экрана. */
                /* По центру карты: это её орган управления, и смещённая вбок кнопка
                   читается как элемент страницы. */
                .stow {
                    position: absolute;
                    left: 68%;
                    transform: translateX(-50%);
                    bottom: 5%;
                    width: 46px;
                    height: 46px;
                    padding: 0;
                    display: grid;
                    place-items: center;
                    background: rgba(20, 16, 13, 0.72);
                    backdrop-filter: blur(6px);
                }
                .back {
                    position: absolute;
                    left: 24px;
                    top: 24px;
                    padding: 9px 14px;
                    font-size: 13px;
                    background: rgba(20, 16, 13, 0.72);
                    backdrop-filter: blur(6px);
                }
                /* Панель стоит по середине правого поля: в ней то пять строк, то
                   пятнадцать, и прижатая к верху она то упирается в кромку экрана, то
                   висит одинокой плашкой в углу. */
                .panel {
                    position: absolute;
                    right: 24px;
                    top: 50%;
                    transform: translateY(-50%);
                    /* 360, а не 320: в 320 не вставали ни название стороны с кнопкой
                       возврата в одну строку, ни две нижние кнопки — «Перевернуть на
                       «МЫ»» вылезала за кромку панели. */
                    width: 360px;
                    /* Без прокрутки: список фаз короткий, а полоса прокрутки прятала
                       нижнюю кнопку — «Перевернуть на «МЫ»» приходилось искать колесом. */
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.14);
                    border-radius: 16px;
                    background: rgba(20, 16, 13, 0.82);
                    backdrop-filter: blur(8px);
                    color: #f4efe6;
                }
                .head {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .head strong {
                    font-size: 17px;
                    font-weight: 600;
                }
                /* Шапка панели поля: название стороны и возврат к началу в одну строку.
                   Название переносится, кнопка — нет: она короче и не должна рваться. */
                .head.start {
                    flex-direction: row;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                }
                .head.start strong {
                    font-size: 15px;
                    line-height: 1.2;
                    /* Название стороны — одной строкой: перенос делает из шапки два
                       этажа и сдвигает кнопку возврата вниз, к списку фаз. */
                    white-space: nowrap;
                }
                .restart {
                    flex: 0 0 auto;
                    padding: 7px 12px;
                    font-size: 12px;
                    white-space: nowrap;
                }
                .head span,
                .caption {
                    color: rgba(244, 239, 230, 0.58);
                    font-size: 13px;
                    margin: 0;
                }
                .caption {
                    line-height: 1.45;
                    min-height: 72px;
                }
                button {
                    flex: 0 0 auto;
                    width: auto; /* в globals.css кнопки тянутся на всю строку */
                    padding: 10px 16px;
                    border: 1px solid rgba(255, 255, 255, 0.22);
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.06);
                    color: #f4efe6;
                    font-size: 13px;
                    cursor: pointer;
                }
                button:hover:not(:disabled) {
                    border-color: rgba(255, 255, 255, 0.5);
                }
                button:disabled {
                    opacity: 0.4;
                    cursor: default;
                }
                /* Зелёный треугольник — пуск, красная пауза — стоп. Цвет здесь несёт
                   смысл, а не украшает: это единственная кнопка, которой партию и
                   запускают, и останавливают. */
                .play {
                    width: 100%;
                    justify-content: center;
                    gap: 10px;
                    font-weight: 600;
                    border-color: rgba(144, 199, 67, 0.55);
                    background: rgba(144, 199, 67, 0.16);
                }
                .play .glyph {
                    flex: 0 0 auto;
                    width: 0;
                    height: 0;
                    border-style: solid;
                    border-width: 6px 0 6px 11px;
                    border-color: transparent transparent transparent #90c743;
                }
                .play.on {
                    border-color: rgba(201, 80, 63, 0.6);
                    background: rgba(201, 80, 63, 0.18);
                }
                .play.on .glyph {
                    width: 10px;
                    height: 12px;
                    border: 0;
                    background: linear-gradient(to right, #c9503f 0 3px, transparent 3px 7px, #c9503f 7px 10px);
                }
                .phases {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                /* justify-content нужен явно: в globals.css у кнопок портала содержимое
                   центрируется, и названия фаз вставали посреди панели вместо левого края. */
                .phase {
                    width: 100%;
                    display: flex;
                    justify-content: flex-start;
                    align-items: flex-start;
                    gap: 10px;
                    text-align: left;
                    padding: 8px 10px;
                    border-radius: 10px;
                    border: 1px solid transparent;
                    background: transparent;
                    color: rgba(244, 239, 230, 0.6);
                }
                .phase:hover:not(:disabled) {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: transparent;
                    color: #f4efe6;
                }
                .phase .num {
                    flex: 0 0 auto;
                    margin-top: 1px;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    font-size: 10.5px;
                    font-weight: 700;
                    border: 1px solid rgba(255, 255, 255, 0.22);
                    font-variant-numeric: tabular-nums;
                }
                .phase .txt {
                    display: flex;
                    flex-direction: column;
                    line-height: 1.25;
                }
                .phase .txt b {
                    display: flex;
                    align-items: baseline;
                    gap: 8px;
                    font-size: 13.5px;
                    font-weight: 600;
                }
                .phase .txt i {
                    font-style: normal;
                    font-size: 11px;
                    font-weight: 600;
                    color: #e7a847;
                }
                .phase .desc {
                    display: block;
                    margin-top: 3px;
                    font-size: 11.8px;
                    line-height: 1.4;
                    color: rgba(244, 239, 230, 0.42);
                }
                .phase.on {
                    background: rgba(231, 168, 71, 0.14);
                    color: #f4efe6;
                }
                .phase.on .num {
                    background: #e7a847;
                    border-color: #e7a847;
                    color: #221a10;
                }
                .phase.passed .num {
                    border-color: rgba(144, 199, 67, 0.6);
                    color: #90c743;
                }
                .bar {
                    height: 3px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.12);
                    overflow: hidden;
                }
                .fill {
                    display: block;
                    height: 100%;
                    background: #e7a847;
                    transition: width 0.35s ease;
                }
                .row {
                    display: flex;
                    gap: 8px;
                    flex-wrap: nowrap;
                }
                .ghost {
                    flex: 1 1 0;
                    padding: 10px 8px;
                    font-size: 12px;
                    white-space: nowrap;
                }
                /* Список элементов карты: номер колонкой слева, текст колонкой справа —
                   строки выравниваются друг под друга, а не пляшут от длины названия. */
                .legend {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .item {
                    width: 100%;
                    display: grid;
                    grid-template-columns: 26px 1fr;
                    align-items: start;
                    gap: 10px;
                    padding: 8px 10px;
                    border: 1px solid transparent;
                    border-radius: 10px;
                    background: transparent;
                    text-align: left;
                    color: rgba(244, 239, 230, 0.6);
                }
                .item:hover:not(:disabled) {
                    border-color: transparent;
                }
                .item .k {
                    font-size: 11px;
                    font-weight: 700;
                    line-height: 1.35;
                    color: #e7a847;
                    font-variant-numeric: tabular-nums;
                }
                .item .v {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    line-height: 1.35;
                }
                .item .v b {
                    font-size: 13px;
                    font-weight: 600;
                    color: #f4efe6;
                }
                .item .v span {
                    font-size: 11.8px;
                    color: rgba(244, 239, 230, 0.5);
                }
                .item.on {
                    background: rgba(231, 168, 71, 0.14);
                }
                .item.on .v span {
                    color: rgba(244, 239, 230, 0.72);
                }
                /* Текст роли живёт в левой нижней накладке — панели шагов в этот момент нет. */
                .role {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    max-width: 340px;
                    margin-top: 4px;
                    padding-top: 10px;
                    border-top: 1px solid rgba(255, 255, 255, 0.12);
                }
                .role em {
                    color: #e7a847;
                    font-style: normal;
                    font-size: 13px;
                }
                .role p {
                    margin: 0;
                    color: rgba(244, 239, 230, 0.72);
                    font-size: 13px;
                    line-height: 1.45;
                }
                @media (prefers-reduced-motion: reduce) {
                    .fill {
                        transition: none;
                    }
                }

                /* Мобильные правила идут последними: styled-jsx не поднимает
                   специфичность медиазапроса, и стоя выше базовых блоков они молча
                   проигрывали им — панель уезжала вниз, а подписи оставались внахлёст. */
                @media (max-width: 760px) {
                    .modes {
                        top: 10px;
                        gap: 2px;
                        padding: 3px;
                    }
                    .modes button {
                        padding: 6px 10px;
                        font-size: 12px;
                    }
                    .room {
                        top: auto;
                        right: 8px;
                        left: 8px;
                        bottom: 8px;
                        width: auto;
                        max-height: 46vh;
                        overflow-y: auto;
                        padding: 12px;
                    }
                    .room .seats {
                        flex-direction: row;
                        flex-wrap: wrap;
                        gap: 4px 10px;
                    }
                    .room .seats li {
                        font-size: 12px;
                    }
                    .room .seats em {
                        margin-left: 4px;
                    }
                    /* Вверху узкого экрана сходятся три накладки: переключатель режимов,
                       кнопка возврата и подпись места. Разводим по этажам, иначе они
                       ложатся друг на друга и не читается ни одна. */
                    .back {
                        top: 52px;
                        left: 8px;
                        font-size: 12px;
                        padding: 7px 12px;
                    }
                    .hud {
                        bottom: auto;
                        top: 52px;
                        left: auto;
                        right: 8px;
                        padding: 7px 12px;
                    }
                    .hud .side strong {
                        font-size: 13px;
                    }
                }
            `}</style>
        </div>
    );
}
