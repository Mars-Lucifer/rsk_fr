import * as THREE from "three";

// Плоский предмет со скруглёнными углами: жетон и карта в наборе именно такие, а не
// цилиндр и не коробка с острыми углами.
//
// Геометрия строится в плоскости XY: лицо смотрит в +Z, рубашка в −Z, по периметру торец.
// Три группы материалов в этом порядке: 0 — лицо, 1 — рубашка, 2 — торец.
//
// ExtrudeGeometry сама кладёт на крышки UV прямо в метрах, поэтому текстура на них
// растянулась бы в бесконечность — координаты крышек пересчитываем планарно по габариту.
export function roundedPlateGeometry(width, height, thickness, radius) {
    const w = width / 2;
    const h = height / 2;
    const r = Math.max(0, Math.min(radius, Math.min(w, h)));

    const shape = new THREE.Shape();
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);

    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 6, steps: 1 });
    geometry.translate(0, 0, -thickness / 2);
    geometry.computeVertexNormals();

    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;

    for (let i = 0; i < position.count; i += 1) {
        const nz = normal.getZ(i);
        if (Math.abs(nz) < 0.5) continue;
        const u = (position.getX(i) + w) / width;
        const v = (position.getY(i) + h) / height;
        // Рубашку видно с другой стороны, поэтому её координаты зеркалим по горизонтали:
        // иначе после переворота картинка читалась бы наоборот.
        uv.setXY(i, nz > 0 ? u : 1 - u, v);
    }

    // Группы материалов разложены по нормали треугольника. ExtrudeGeometry выдаёт
    // несвязанную геометрию, поэтому идём по треугольникам и склеиваем подряд идущие.
    geometry.clearGroups();
    let start = 0;
    let current = -1;
    const kindOf = (triangle) => {
        const nz = normal.getZ(triangle * 3);
        if (nz > 0.5) return 0;
        if (nz < -0.5) return 1;
        return 2;
    };
    const triangles = position.count / 3;
    for (let triangle = 0; triangle < triangles; triangle += 1) {
        const kind = kindOf(triangle);
        if (kind === current) continue;
        if (current >= 0) geometry.addGroup(start * 3, (triangle - start) * 3, current);
        start = triangle;
        current = kind;
    }
    if (current >= 0) geometry.addGroup(start * 3, (triangles - start) * 3, current);

    return geometry;
}

// Тот же предмет, но лежащий на столе: лицо смотрит вверх, в +Y.
export function roundedPlateLying(width, depth, thickness, radius) {
    const geometry = roundedPlateGeometry(width, depth, thickness, radius);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
}
