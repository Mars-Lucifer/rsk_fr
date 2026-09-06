// Разбор загруженной модели: сколько в ней связных кусков и какие они.
//
// Нужен ради одного решения. Генераторы отдают сцену одним слитым мешем с одним материалом,
// и вопрос «можно ли вынуть отсюда предметы по отдельности» решается не на глаз, а счётом
// связных компонент. Если предметы не спаяны с подставкой, компонент будет столько же,
// сколько вещей, и каждую можно вырезать в свой файл.
//
// Считается в браузере после загрузки: декодировать Draco в ноде нечем, а здесь декодер
// уже отработал.

import * as THREE from "three";

// Сварка по позиции: генератор дублирует вершины на швах, и без сварки каждый треугольник
// оказывается собственной компонентой. Округление — до пятого знака от габарита, иначе
// шум координат разрывает поверхность.
function weld(pos, eps) {
    const map = new Map();
    const label = new Int32Array(pos.count);
    let next = 0;
    for (let i = 0; i < pos.count; i += 1) {
        const key = `${Math.round(pos.getX(i) / eps)},${Math.round(pos.getY(i) / eps)},${Math.round(pos.getZ(i) / eps)}`;
        let id = map.get(key);
        if (id === undefined) {
            id = next;
            next += 1;
            map.set(key, id);
        }
        label[i] = id;
    }
    return { label, count: next };
}

// Система непересекающихся множеств со сжатием пути. Без сжатия миллион треугольников
// укладывает вкладку.
function makeDsu(n) {
    const p = new Int32Array(n);
    for (let i = 0; i < n; i += 1) p[i] = i;
    const find = (x) => {
        let r = x;
        while (p[r] !== r) r = p[r];
        while (p[x] !== r) {
            const nx = p[x];
            p[x] = r;
            x = nx;
        }
        return r;
    };
    return { find, union: (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) p[ra] = rb; } };
}

export function components(geometry, eps) {
    const pos = geometry.getAttribute("position");
    const idx = geometry.getIndex();
    const { label, count } = weld(pos, eps);
    const dsu = makeDsu(count);
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
        const a = label[idx ? idx.getX(i) : i];
        const b = label[idx ? idx.getX(i + 1) : i + 1];
        const c = label[idx ? idx.getX(i + 2) : i + 2];
        dsu.union(a, b);
        dsu.union(b, c);
    }
    // Габарит каждой компоненты: по нему видно, что это — предмет, подставка или мусор.
    const boxes = new Map();
    for (let i = 0; i < pos.count; i += 1) {
        const root = dsu.find(label[i]);
        let b = boxes.get(root);
        if (!b) {
            b = new THREE.Box3();
            boxes.set(root, b);
        }
        b.expandByPoint(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
    const out = [];
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    boxes.forEach((b, root) => {
        b.getSize(size);
        b.getCenter(center);
        out.push({ root, size: size.toArray().map((v) => +v.toFixed(3)), center: center.toArray().map((v) => +v.toFixed(2)), diag: +size.length().toFixed(3) });
    });
    out.sort((a, b) => b.diag - a.diag);
    return out;
}

export function report(model, file, size, k) {
    const meshes = [];
    model.traverse((n) => n.isMesh && meshes.push(n));
    const total = meshes.reduce((s, m) => s + (m.geometry.getIndex() ? m.geometry.getIndex().count : m.geometry.getAttribute("position").count) / 3, 0);
    /* eslint-disable no-console */
    console.log(`[предмет] ${file} габарит ${size.toArray().map((v) => +v.toFixed(3)).join(" x ")} масштаб ${k.toFixed(4)} мешей ${meshes.length} треугольников ${Math.round(total)}`);
    const eps = Math.max(size.x, size.y, size.z) / 100000;
    meshes.forEach((m, i) => {
        const t0 = performance.now();
        const comps = components(m.geometry, eps);
        const big = comps.filter((c) => c.diag > size.length() / 60);
        console.log(`[компоненты] меш ${i}: всего ${comps.length}, крупных ${big.length}, за ${Math.round(performance.now() - t0)} мс`);
        big.slice(0, 20).forEach((c, j) => console.log(`   ${j} размер ${c.size.join(" x ")} центр ${c.center.join(",")}`));
    });
    /* eslint-enable no-console */
}
