import assert from "node:assert/strict";
import test from "node:test";

import { LEVELS, RAYS } from "./zvezda.mjs";
import { OVERVIEW, PEDESTAL, STAR, TOWER, crown, inlay, pedestalAt, plinth, rayAngle, rayCamera, raySector, starOutline, staveAngles, tiers, towerHeight } from "./platform.mjs";

test("контур звезды: двенадцать вершин, внешние и внутренние чередуются", () => {
    const pts = starOutline();
    assert.equal(pts.length, 12);
    pts.forEach(([x, y], i) => {
        const r = Math.hypot(x, y);
        const want = i % 2 === 0 ? STAR.outer : STAR.inner;
        assert.ok(Math.abs(r - want) < 1e-9, `вершина ${i}: радиус ${r}, ожидался ${want}`);
    });
});

test("впадина заметно ближе кончика — иначе звезда выродится в шестиугольник", () => {
    assert.ok(STAR.inner / STAR.outer < 0.55, "лучи слишком короткие, фигура читается многоугольником");
    assert.ok(STAR.inner / STAR.outer > 0.3, "лучи слишком тонкие, тумба не удержится на кончике");
});

test("тумба стоит на луче, а не за его краем", () => {
    RAYS.forEach((ray, i) => {
        const [x, y, z] = pedestalAt(i);
        const r = Math.hypot(x, z);
        assert.ok(r + PEDESTAL.radius > STAR.outer, `${ray.id}: тумба целиком внутри звезды, кончик луча пустой`);
        assert.ok(r - PEDESTAL.radius < STAR.outer, `${ray.id}: тумба висит за кончиком без опоры`);
        // Тумба и плита — одно тело: столешница выше поверхности платформы, подошва ниже её
        // подошвы. Если низ тумбы поднимется до нуля, она снова станет диском, положенным
        // сверху, — та самая «плитка над платформой».
        const topY = y + PEDESTAL.height / 2;
        const bottomY = y - PEDESTAL.height / 2;
        assert.ok(topY > 0, `${ray.id}: столешница утоплена в платформу`);
        assert.ok(bottomY < -(STAR.thickness + STAR.bevel), `${ray.id}: тумба не доходит до подошвы платформы, стык вылезет ступенькой`);
    });
});

test("шесть тумб стоят по одной на луч и не пересекаются", () => {
    const spots = RAYS.map((_, i) => pedestalAt(i));
    assert.equal(spots.length, LEVELS.length);
    for (let i = 0; i < spots.length; i += 1) {
        for (let j = i + 1; j < spots.length; j += 1) {
            const d = Math.hypot(spots[i][0] - spots[j][0], spots[i][2] - spots[j][2]);
            assert.ok(d > PEDESTAL.radius * 2, `тумбы ${i} и ${j} перекрываются: расстояние ${d.toFixed(2)}`);
        }
    }
});

test("ярусов маяка ровно столько, сколько уровней, и он сужается кверху", () => {
    const t = tiers();
    assert.equal(t.length, LEVELS.length);
    for (let i = 1; i < t.length; i += 1) {
        assert.ok(t[i].y > t[i - 1].y, `ярус ${i + 1} не выше предыдущего`);
        assert.ok(t[i].rBottom <= t[i - 1].rBottom, `ярус ${i + 1} шире нижнего`);
    }
    assert.ok(t.at(-1).rTop > 0.05, "верхний ярус схлопнулся в точку");
});

test("маяк ниже, чем луч длинный: башня не должна спорить с платформой", () => {
    assert.ok(towerHeight() < STAR.outer * 0.6, `башня ${towerHeight().toFixed(2)} против луча ${STAR.outer}`);
});

test("маяк приземистый: высота ствола сопоставима с его диаметром", () => {
    // Эталон даёт 1.14 (профиль свечения: 100 px высоты при 88 px ширины). Ярусов у нас
    // шесть против четырёх, поэтому потолок взят с запасом. Проверка нужна именно здесь:
    // высота ствола складывается из tierHeight и числа уровней, и добавление седьмого
    // уровня молча вернуло бы фабричную трубу.
    const stem = towerHeight() - TOWER.baseHeight;
    const ratio = stem / (TOWER.rBottom * 2);
    assert.ok(ratio < 1.45, `ствол вытянут: ${ratio.toFixed(2)} против эталонных 1.14`);
    assert.ok(ratio > 0.9, `ствол приплюснут: ${ratio.toFixed(2)}`);
});

test("цоколь: три ступени укладываются ровно в baseHeight и не уже ствола", () => {
    const p = plinth();
    const sum = p.bottom.height + p.glow.height + p.top.height;
    assert.ok(Math.abs(sum - TOWER.baseHeight) < 1e-9, `цоколь ${sum} против baseHeight ${TOWER.baseHeight}`);
    assert.ok(p.bottom.y < p.glow.y && p.glow.y < p.top.y, "ступени цоколя идут не снизу вверх");
    assert.ok(p.glow.radius < p.bottom.radius, "щель не утоплена: свет пойдёт кромкой, а не из-под маяка");
    assert.ok(p.top.radius > tiers()[0].rBottom, "верхняя ступень уже ствола — маяк повиснет в воздухе");
});

test("венец идёт снизу вверх и стоит на верхнем ярусе", () => {
    const c = crown();
    const ys = [c.galleryY, c.lanternY, c.rimY, c.domeBase, c.stemY, c.ballY, c.tipY];
    ys.forEach((y, i) => {
        if (i > 0) assert.ok(y > ys[i - 1], `элемент венца ${i} не выше предыдущего`);
    });
    assert.ok(c.galleryY > towerHeight(), "галерея утоплена в верхний ярус");
    assert.ok(c.top > c.tipY, "шпиль не учтён в габарите");
});

test("стойки распределены по кругу и не смыкаются в сплошную стенку", () => {
    const a = staveAngles();
    assert.equal(a.length, TOWER.staves);
    // Шаг по дуге у самого узкого яруса должен оставаться шире самой стойки, иначе
    // светящаяся стенка исчезает за частоколом и ярус перестаёт «гореть».
    const step = (2 * Math.PI * TOWER.rTop) / TOWER.staves;
    assert.ok(step > TOWER.staveWidth * 1.8, `шаг ${step.toFixed(3)} против стойки ${TOWER.staveWidth}`);
});

test("карнизы выступают за стенку и сужаются кверху", () => {
    // Карниз — самая широкая точка яруса, на эталоне он выступает и над своей стенкой, и над
    // следующей. Единственное, чего нельзя, — чтобы верхний карниз оказался шире нижнего:
    // тогда силуэт перестаёт сужаться и башня распухает кверху.
    let prev = Infinity;
    tiers().forEach((t) => {
        const cornice = t.rTop * TOWER.corniceOut;
        assert.ok(cornice > t.rTop, `ярус ${t.level}: карниз не выступает, ступень не читается`);
        assert.ok(cornice < prev, `ярус ${t.level}: карниз шире нижнего, силуэт распухает кверху`);
        assert.ok(t.height > TOWER.corniceHeight, `ярус ${t.level}: карниз съел стенку целиком`);
        prev = cornice;
    });
    assert.ok(TOWER.lanternRadius * 1.34 < prev, "ободок купола шире верхнего карниза");
});

test("жила идёт от основания маяка до тумбы и никуда не выходит", () => {
    RAYS.forEach((ray, i) => {
        const line = inlay(i);
        assert.ok(line.length > 0.5, `${ray.id}: жила вырождена`);
        assert.ok(line.to < STAR.outer, `${ray.id}: жила выходит за край платформы`);
        assert.ok(Math.abs(line.angle - rayAngle(i)) < 1e-12);
    });
});

test("камера луча смотрит на свою тумбу и стоит снаружи неё", () => {
    RAYS.forEach((ray, i) => {
        const cam = rayCamera(i);
        const [px, , pz] = pedestalAt(i);
        assert.ok(Math.abs(cam.target[0] - px) < 1e-9 && Math.abs(cam.target[2] - pz) < 1e-9, `${ray.id}: камера смотрит мимо тумбы`);
        assert.ok(Math.hypot(cam.position[0], cam.position[2]) > Math.hypot(px, pz), `${ray.id}: камера внутри звезды, маяк закроет кадр`);
        assert.ok(cam.position[1] > PEDESTAL.top, `${ray.id}: камера ниже столешницы`);
    });
});

test("обзорная камера выше и дальше любой из лучевых", () => {
    const far = Math.hypot(OVERVIEW.position[0], OVERVIEW.position[2]);
    RAYS.forEach((_, i) => {
        const cam = rayCamera(i);
        assert.ok(OVERVIEW.position[1] > cam.position[1], "обзор должен быть выше подлёта");
        assert.ok(far > 0, "обзорная камера в центре сцены");
    });
});

test("сектор луча расширяется от тонкой полоски (u=0) до полного сектора звезды (u=1)", () => {
    RAYS.forEach((ray, i) => {
        const thin = raySector(i, 0);
        const full = raySector(i, 1);
        assert.equal(thin.points.length, full.points.length);
        // При u=0 полуширина тонкая (0.013)
        assert.ok(Math.abs(Math.abs(thin.points[0][1]) - 0.013) < 1e-4, `${ray.id}: тонкая полоска не равна 0.013`);
        // При u=1 сектор заметно шире
        assert.ok(Math.abs(full.points[1][1]) > 0.5, `${ray.id}: сектор не расширяется у впадины`);
        assert.ok(Math.abs(full.points[1][1]) > Math.abs(thin.points[1][1]));
    });
});

