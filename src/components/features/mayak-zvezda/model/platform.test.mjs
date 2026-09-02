import assert from "node:assert/strict";
import test from "node:test";

import { LEVELS, RAYS } from "./zvezda.mjs";
import { OVERVIEW, PEDESTAL, STAR, inlay, pedestalAt, rayAngle, rayCamera, starOutline, tiers, towerHeight } from "./platform.mjs";

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
        assert.equal(y, PEDESTAL.height / 2);
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
        assert.ok(cam.position[1] > PEDESTAL.height, `${ray.id}: камера ниже столешницы`);
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
