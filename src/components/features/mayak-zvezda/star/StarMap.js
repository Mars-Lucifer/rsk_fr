"use client";

// Звезда как навигация, а не как иллюстрация.
//
// Центр — организация целиком на выбранном уровне, шесть жетонов по кругу — точки входа
// в направления. Клик по жетону открывает клетку «луч × уровень», клик по центру
// возвращает к обзору.
//
// Уровень задаётся снаружи и применяется ко всей звезде разом: в первоисточнике уровень
// один на организацию («ваш уровень определяется большинством»), а не свой у каждого луча.
// Поэтому фигура здесь правильная, а не изрезанная: изрезанный профиль — это диагностика
// конкретного колледжа, а мы объясняем модель.

import { LEVELS, RAYS } from "../model/zvezda.mjs";
import { CENTER, INK, RAY_COLOR, RING_R, pointAt, rayAngle } from "../proba/sketchGeometry.mjs";

// Геометрия общая с набросками: одни и те же кольца и углы, чтобы звезда на разных экранах
// была одной и той же звездой, а не похожей.

const BADGE_R = RING_R.at(-1) + 52;

// Сектор луча: клин от центра до внешнего кольца, шириной в шестую часть круга.
// Нужен как подсветка выбранного направления и как крупная зона попадания.
function sector(index) {
    const half = Math.PI / 6;
    const base = rayAngle(index);
    const [x1, y1] = pointAt(base - half, RING_R.at(-1));
    const [x2, y2] = pointAt(base + half, RING_R.at(-1));
    return `M${CENTER} ${CENTER} L${x1.toFixed(1)} ${y1.toFixed(1)} A${RING_R.at(-1)} ${RING_R.at(-1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
}

export default function StarMap({ level, ray, onPickRay, onPickCenter }) {
    const lv = LEVELS[level - 1];
    const ringR = RING_R[level - 1];

    return (
        // Поле шире звезды и симметрично относительно её центра: подписи уходят наружу за
        // кольца, и при поле по размеру колец правая («Единое цифровое пространство») обрезалась
        // по кромке — проверено кадром.
        <svg viewBox="-220 40 1440 920" role="img" aria-label={`ЗВЕЗДА: уровень ${lv.icz} ${lv.name}`}>
            {/* Сектор выбранного луча лежит под кольцами: подсветка не должна перекрывать шкалу */}
            {ray && <path d={sector(RAYS.findIndex((r) => r.id === ray))} fill={RAY_COLOR[ray]} opacity="0.1" />}

            {/* Кольца-уровни. Достигнутые — сплошные, недостигнутые — пунктиром: шкала
                порядковая, и «докуда дошли» должно читаться до чтения подписей. */}
            {RING_R.map((r, i) => (
                <polygon
                    key={r}
                    points={ringPolygonPoints(r)}
                    fill="none"
                    stroke={i + 1 === level ? "#8fb0ff" : INK.grid}
                    strokeWidth={i + 1 === level ? 2.4 : 1.2}
                    strokeDasharray={i + 1 > level ? "4 7" : undefined}
                    opacity={i + 1 > level ? 0.8 : 1}
                />
            ))}

            {/* Оси */}
            {RAYS.map((r, i) => {
                const [x, y] = pointAt(rayAngle(i), RING_R.at(-1));
                return <line key={r.id} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke={INK.grid} strokeWidth="1" />;
            })}

            {/* Организация на выбранном уровне */}
            <polygon points={ringPolygonPoints(ringR)} fill="rgba(107,144,255,0.13)" stroke="#8fb0ff" strokeWidth="2.5" />

            {/* Вершины: точка каждого луча на текущем кольце */}
            {RAYS.map((r, i) => {
                const [x, y] = pointAt(rayAngle(i), ringR);
                return <rect key={r.id} x={x - 7} y={y - 7} width="14" height="14" transform={`rotate(45 ${x} ${y})`} fill={RAY_COLOR[r.id]} opacity={ray && ray !== r.id ? 0.35 : 1} />;
            })}

            {/* Центр — обзор организации. Внутри только значение шкалы: название сюда
                не помещается ни при каком кегле, оно живёт в панели. */}
            <g onClick={onPickCenter} role="button" tabIndex={0} aria-label="Общий обзор организации" onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPickCenter()} style={{ cursor: "pointer" }}>
                <circle cx={CENTER} cy={CENTER} r="58" fill={ray ? INK.panel : "#1b2740"} stroke={ray ? INK.grid : "#8fb0ff"} strokeWidth="2" />
                <text x={CENTER} y={CENTER + 15} textAnchor="middle" fontSize="40" fontWeight="600" fill={ray ? INK.dim : INK.text}>
                    {lv.icz > 0 ? `+${lv.icz}` : lv.icz}
                </text>
            </g>

            {/* Жетоны лучей — точки входа */}
            {RAYS.map((r, i) => {
                const angle = rayAngle(i);
                const [x, y] = pointAt(angle, BADGE_R);
                const anchor = Math.abs(Math.cos(angle)) < 0.2 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
                // Верхний и нижний лучи стоят строго над и под центром: сдвигать их подпись вбок
                // некуда, она уезжает от своего жетона к соседнему. Поэтому у них подпись
                // выносится по вертикали — наружу от центра, а не вбок.
                const vertical = anchor === "middle";
                const dx = anchor === "start" ? 30 : anchor === "end" ? -30 : 0;
                const dy = vertical ? (y < CENTER ? -34 : 42) : 6;
                const active = ray === r.id;
                return (
                    <g
                        key={r.id}
                        onClick={() => onPickRay(r.id)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPickRay(r.id)}
                        role="button"
                        tabIndex={0}
                        aria-label={r.name}
                        aria-pressed={active}
                        style={{ cursor: "pointer" }}
                    >
                        {/* Прозрачная подложка: попадать надо по жетону вместе с подписью,
                            а не по кружку в двадцать пикселей */}
                        <rect
                            x={x + (anchor === "end" ? -320 : anchor === "middle" ? -170 : -26)}
                            y={y - (vertical ? 52 : 26)}
                            width={vertical ? 340 : 346}
                            height={vertical ? 104 : 52}
                            fill="transparent"
                        />
                        {active && <circle cx={x} cy={y} r="30" fill="none" stroke={RAY_COLOR[r.id]} strokeWidth="2" opacity="0.5" />}
                        <circle cx={x} cy={y} r="22" fill={RAY_COLOR[r.id]} opacity={ray && !active ? 0.4 : 1} />
                        <text x={x} y={y + 8} textAnchor="middle" fontSize="23" fontWeight="700" fill={INK.bg}>
                            {r.letter}
                        </text>
                        <text x={x + dx} y={y + dy} textAnchor={anchor} fontSize="18.5" fill={active ? INK.text : ray ? INK.dim : "rgba(244,239,230,0.8)"}>
                            {r.name}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

function ringPolygonPoints(radius) {
    return RAYS.map((_, i) => pointAt(rayAngle(i), radius).map((v) => v.toFixed(1)).join(",")).join(" ");
}
