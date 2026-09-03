"use client";

// Рендер знака. Единственное место, где описание из model/signs.mjs превращается в SVG:
// толщина штриха, скругления и наконечники стрелок задаются здесь и только здесь — иначе
// набор расползается по весу линии, а это первое, что выдаёт самодельный набор знаков.

import { GRID, RADIUS, STROKE } from "../model/signs.mjs";

// Наконечник строится от направления отрезка, а не рисуется руками под каждый угол:
// вручную поставленные наконечники расходятся по размеру, и это видно на матрице сразу.
function head(x1, y1, x2, y2, size = 4.2) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const wing = 0.42;
    return [
        `${x2},${y2}`,
        `${x2 - size * Math.cos(a - wing)},${y2 - size * Math.sin(a - wing)}`,
        `${x2 - size * Math.cos(a + wing)},${y2 - size * Math.sin(a + wing)}`,
    ].join(" ");
}

// Дуга из центра и углов. Считается здесь, чтобы описание знака оставалось проверяемым:
// строку пути тест границами не возьмёт, а центр с радиусом — возьмёт.
function arcPath({ cx, cy, r, from, to }) {
    const rad = (deg) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad(from));
    const y1 = cy + r * Math.sin(rad(from));
    const x2 = cx + r * Math.cos(rad(to));
    const y2 = cy + r * Math.sin(rad(to));
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    const sweep = to > from ? 1 : 0;
    return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${large} ${sweep} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

// Заливка идёт тем же цветом, что и штрих, но прозрачной. Непрозрачная заливка того же цвета
// съедала внутренние линии базы целиком — на матрице четыре луча превращались в одинаковые
// прямоугольники, и знак переставал отличать луч от луча.
function Shape({ s, tint }) {
    const fill = s.fill === "tint" ? tint : "none";
    const fillOpacity = s.fill === "tint" && tint !== "none" ? 0.22 : 1;
    switch (s.k) {
        case "rect":
            return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={RADIUS} fill={fill} fillOpacity={fillOpacity} />;
        case "circle":
            return <circle cx={s.cx} cy={s.cy} r={s.r} fill={fill} fillOpacity={fillOpacity} />;
        case "line":
            return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />;
        case "poly":
            return <polygon points={s.points} fill={fill} fillOpacity={fillOpacity} />;
        case "arc":
            return <path d={arcPath(s)} fill="none" />;
        case "arrow":
            return (
                <g>
                    <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeDasharray={s.dashed ? "3 3" : undefined} />
                    <polygon points={head(s.x1, s.y1, s.x2, s.y2)} fill="currentColor" stroke="none" />
                </g>
            );
        default:
            return null;
    }
}

export default function Sign({ cell, color, size = 48, title }) {
    if (!cell) return null;
    // На уровне «Хаос» цифры нет вовсе, и заливка акцентом там соврала бы: показывать нечего.
    // Поэтому бледная клетка теряет заливку, но не штрих — предмет-то в комнате стоит.
    const tint = cell.pale ? "none" : color;
    return (
        <svg
            viewBox={`0 0 ${GRID} ${GRID}`}
            width={size}
            height={size}
            role="img"
            aria-label={title}
            style={{ color, display: "block" }}
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        >
            {title ? <title>{title}</title> : null}
            {cell.shapes.map((s, i) => (
                <Shape key={i} s={s} tint={tint} />
            ))}
        </svg>
    );
}
