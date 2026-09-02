"use client";

// Три наброска трёх разных подходов к визуализации. Статика, без анимации и без интерактива:
// цель — выбрать направление глазами за минуту, а не оценить готовую вещь.
//
// Данные настоящие: те же шесть лучей и шесть уровней, что в модели. Подставлять рыбу здесь
// нельзя — половина вопроса как раз в том, помещаются ли реальные названия и не душно ли от них.

import { CENTER, DEMO_LEVELS, INK, LEVELS, RAYS, RAY_COLOR, RING_R, VIEW, pointAt, profilePolygon, rayAngle, ringPolygon, spiralPath, vertex } from "./sketchGeometry.mjs";

// ── Набросок А. Звёздная карта ──────────────────────────────────────────────────────────
// Организация — сама шестиконечная фигура на сетке. Цикл раскручивает одну вершину наружу
// ровно на одно кольцо и оставляет за собой видимый виток.
export function SketchStarMap() {
    return (
        // Поле шире холста: подписи лучей уходят наружу за кольца, и при viewBox по размеру
        // комнаты они обрезались по краям — проверено кадром.
        <svg viewBox={`-250 -40 1500 1130`} role="img" aria-label="Звёздная карта: шесть лучей, шесть колец, спираль на луче">
            <rect x="-250" y="-40" width="1500" height="1130" fill={INK.bg} />

            {/* Кольца-уровни. Светлота растёт наружу монотонно: шкала порядковая, и кодировать
                её разными тонами нельзя — порядок сломается. */}
            {RING_R.map((r, i) => (
                <polygon
                    key={r}
                    points={ringPolygon(r)}
                    fill="none"
                    stroke={INK.grid}
                    strokeWidth={i === RING_R.length - 1 ? 1.6 : 1}
                    strokeDasharray={i === RING_R.length - 1 ? "6 4" : undefined}
                />
            ))}

            {/* Оси лучей */}
            {RAYS.map((ray, i) => {
                const [x, y] = pointAt(rayAngle(i), RING_R.at(-1) + 4);
                return <line key={ray.id} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke={INK.grid} strokeWidth="1" />;
            })}

            {/* Витки цикла на луче «Единое цифровое пространство»: он поднялся до четвёртого,
                и все три пройденных оборота остались нарисованными — это и есть спираль. */}
            <path d={spiralPath(2, DEMO_LEVELS[2])} fill="none" stroke={RAY_COLOR.space} strokeWidth="2.5" opacity="0.55" strokeLinecap="round" />

            {/* Профиль организации. Неровный намеренно: модель как раз про то, что направления
                развиты по-разному. */}
            <polygon points={profilePolygon(DEMO_LEVELS)} fill="rgba(107,144,255,0.14)" stroke="#8fb0ff" strokeWidth="2" />
            {RAYS.map((ray, i) => {
                const [x, y] = vertex(i, DEMO_LEVELS[i]);
                return <rect key={ray.id} x={x - 6} y={y - 6} width="12" height="12" transform={`rotate(45 ${x} ${y})`} fill={RAY_COLOR[ray.id]} />;
            })}

            {/* Жетоны лучей: буква аббревиатуры и название. Буква «З» стоит дважды — различает
                только цвет и подпись. */}
            {RAYS.map((ray, i) => {
                const angle = rayAngle(i);
                const [x, y] = pointAt(angle, RING_R.at(-1) + 52);
                const anchor = Math.abs(Math.cos(angle)) < 0.2 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
                return (
                    <g key={ray.id}>
                        <circle cx={x} cy={y} r="20" fill={RAY_COLOR[ray.id]} />
                        <text x={x} y={y + 7} textAnchor="middle" fontSize="21" fontWeight="700" fill={INK.bg}>
                            {ray.letter}
                        </text>
                        <text x={x + (anchor === "start" ? 28 : anchor === "end" ? -28 : 0)} y={y + 5} textAnchor={anchor} fontSize="19" fill={INK.text}>
                            {ray.name}
                        </text>
                    </g>
                );
            })}

            {/* Лестница уровней. Второе, независимое представление той же шкалы: кольцо
                показывает «докуда дошли», лестница — «как эта ступень называется». */}
            {LEVELS.map((level, i) => (
                <g key={level.n}>
                    <rect x="-230" y={VIEW - 60 - i * 46} width={26} height="26" fill={i < 3 ? "#8fb0ff" : INK.grid} />
                    <text x="-192" y={VIEW - 41 - i * 46} fontSize="19" fill={i < 3 ? INK.text : INK.dim}>
                        {level.icz > 0 ? `+${level.icz}` : level.icz} · {level.name}
                    </text>
                </g>
            ))}
        </svg>
    );
}

// ── Набросок Б. Развёртка ───────────────────────────────────────────────────────────────
// Одна и та же вещь в двух системах координат: свёрнутая — звезда, развёрнутая — матрица.
// Переход между проекциями и есть объяснение модели.
export function SketchUnfold() {
    const cell = 92;
    const left = 470;
    const top = 210;
    return (
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} role="img" aria-label="Развёртка: звезда и матрица шесть на шесть">
            <rect width={VIEW} height={VIEW} fill={INK.bg} />

            {/* Свёрнутая проекция — уменьшенная звезда слева */}
            {/* Центр звезды приводится в (250, 400): при масштабе 0.42 сдвиг равен 250 − 500·0.42.
                Без пересчёта звезда уезжала за левую кромку кадра. */}
            <g transform="translate(40, 190) scale(0.42)">
                {RING_R.map((r) => (
                    <polygon key={r} points={ringPolygon(r)} fill="none" stroke={INK.grid} strokeWidth="1.8" />
                ))}
                <polygon points={profilePolygon(DEMO_LEVELS)} fill="rgba(107,144,255,0.16)" stroke="#8fb0ff" strokeWidth="3.5" />
            </g>
            <text x="120" y="620" fontSize="20" fill={INK.dim}>
                свёрнуто — звезда
            </text>

            {/* Развёрнутая проекция — матрица шесть на шесть. Клетка залита, если направление
                этого уровня достигнуто. Видно и профиль, и то, что уровень порядковый. */}
            {RAYS.map((ray, r) =>
                LEVELS.map((level, c) => {
                    const reached = DEMO_LEVELS[r] >= level.n;
                    return (
                        <rect
                            key={`${ray.id}${level.n}`}
                            x={left + c * cell}
                            y={top + r * cell}
                            width={cell - 8}
                            height={cell - 8}
                            rx="4"
                            fill={reached ? RAY_COLOR[ray.id] : INK.panel}
                            opacity={reached ? 0.85 : 1}
                        />
                    );
                })
            )}
            {RAYS.map((ray, r) => (
                <text key={ray.id} x={left - 16} y={top + r * cell + 50} textAnchor="end" fontSize="18" fill={INK.text}>
                    {ray.letter}
                </text>
            ))}
            {LEVELS.map((level, c) => (
                <text key={level.n} x={left + c * cell + 42} y={top - 18} textAnchor="middle" fontSize="17" fill={INK.dim}>
                    {level.icz > 0 ? `+${level.icz}` : level.icz}
                </text>
            ))}
            <text x={left} y={top + 6 * cell + 34} fontSize="20" fill={INK.dim}>
                развёрнуто — тридцать шесть клеток «луч × уровень»
            </text>
        </svg>
    );
}

// ── Набросок В. Обложка полосы ──────────────────────────────────────────────────────────
// Первый экран лонгрида: звезда, нарисованная одним росчерком, и три строки. Дальше спираль
// разворачивается прокруткой.
export function SketchCover() {
    // Контур шестилучевой звезды: чередование внешних вершин и внутренних впадин, двенадцать точек.
    //
    // Обход вершин через одну здесь применять нельзя, хотя он и рисуется одним росчерком: две
    // наложенные треугольные петли дают гексаграмму — звезду Давида. Это чужой символ, и к
    // шести направлениям методики он отношения не имеет. Проверено кадром: получилось именно оно.
    const stroke = Array.from({ length: 12 }, (_, s) => {
        const angle = -Math.PI / 2 + (s * Math.PI) / 6;
        const r = s % 2 === 0 ? RING_R[4] : RING_R[4] * 0.44;
        return pointAt(angle, r).map((v) => v.toFixed(1)).join(",");
    });
    stroke.push(stroke[0]);
    return (
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} role="img" aria-label="Обложка: звезда одним росчерком">
            <rect width={VIEW} height={VIEW} fill="#07090f" />
            <polyline points={stroke.join(" ")} fill="none" stroke="#ffc24b" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
            <polyline points={stroke.join(" ")} fill="none" stroke="#ffc24b" strokeWidth="12" strokeLinejoin="round" opacity="0.07" />

            <text x={CENTER} y={VIEW - 210} textAnchor="middle" fontSize="76" fontWeight="300" letterSpacing="26" fill={INK.text}>
                ЗВЕЗДА
            </text>
            <text x={CENTER} y={VIEW - 160} textAnchor="middle" fontSize="23" fill={INK.dim}>
                Шесть направлений. Шесть уровней. Один способ подниматься
            </text>
            <text x={CENTER} y={VIEW - 90} textAnchor="middle" fontSize="17" fill="rgba(244,239,230,0.3)">
                ↓ прокрутите
            </text>
        </svg>
    );
}

export const SKETCHES = [
    {
        id: "starmap",
        title: "А. Звёздная карта",
        about: "Сетка шесть на шесть. Организация — сама фигура, цикл раскручивает вершину наружу и оставляет виток. Точнее всех показывает модель.",
        risk: "Может прочитаться как инфографика из презентации.",
        Component: SketchStarMap,
    },
    {
        id: "unfold",
        title: "Б. Развёртка",
        about: "Одна вещь в двух проекциях: свёрнутая — звезда, развёрнутая — матрица. Переход между ними и есть объяснение.",
        risk: "Сухо. Ни вещей, ни людей.",
        Component: SketchUnfold,
    },
    {
        id: "cover",
        title: "В. Полоса",
        about: "Первый экран лонгрида: звезда одним росчерком, дальше спираль рисуется прокруткой.",
        risk: "Держится на типографике. Если она слабая — рассыплется.",
        Component: SketchCover,
    },
];
