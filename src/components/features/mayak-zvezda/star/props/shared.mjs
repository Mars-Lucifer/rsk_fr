// Общая мастерская предметов на тумбах.
//
// Каждый луч живёт в своём файле (knowledge.js, data.js и так далее) и собирает шесть
// предметов — по одному на уровень зрелости. Материалы и повторяющиеся приёмы вынесены сюда:
// иначе шесть файлов заводят шесть слегка разных «стёкол», и уровни перестают сравниваться
// между лучами, хотя сравнение уровней — единственное, ради чего сцена и существует.
//
// Правила, общие для всех тридцати шести предметов:
//
//  - Габарит. След по горизонтали не шире PROP_SPAN в каждую сторону, высота не выше
//    PROP_MAX_HEIGHT. Процедурные предметы, в отличие от GLB, не масштабируются под тумбу:
//    что собрано, то и стоит, и вылезшее за поле перечёркивает цветное кольцо.
//  - Опора. Уровни −1…+2 лежат или стоят на поле (низ у y = 0). На +3 предмет уже
//    приподнят, на +4 парит: низ не ниже FLOAT_BASE, ножек и подставок нет.
//  - Материал. Снизу вверх: матовый картон и бумага → крашеный пластик и металл →
//    подсвеченное стекло → чистое свечение. Материал и есть шкала.
//  - Движение. onFrame вешать только там, где движение читается: анимация считается лишь
//    у выбранного луча и стоит кадров. Ниже +3 предмет, как правило, неподвижен.

import * as THREE from "three";

// Поле тумбы — радиус 0.563. Половина стороны предмета берётся с запасом на поворот.
export const PROP_SPAN = 0.3;
export const PROP_MAX_HEIGHT = 0.85;
// Низ парящего предмета на +4: ниже него левитация читается как «предмет стоит».
export const FLOAT_BASE = 0.35;

// Палитра «до цифры»: картон, бумага, канцелярский металл, старый пластик.
export const PAPER = "#f8fafc";
export const CARDBOARD = "#a88c68";
export const GRAPHITE = "#475569";
export const RUST = "#8c8275";

export function matteMat(color, roughness = 0.9) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

export function plasticMat(color, roughness = 0.55) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.15 });
}

export function metalMat(color, roughness = 0.35) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.75 });
}

// Экран: тёмная панель со светящейся картинкой. Свечение на emissive, а не на источнике
// света: источник в этой сцене стоит дорого и засветил бы соседние тумбы.
export function screenMat(color, intensity = 0.9) {
    return new THREE.MeshStandardMaterial({ color: "#12181f", emissive: color, emissiveIntensity: intensity, roughness: 0.25, metalness: 0.2 });
}

// Полупрозрачное цветное стекло музейного уровня — материал верхних уровней.
export function glassMat(colorHex, emissiveHex = colorHex) {
    return new THREE.MeshPhysicalMaterial({
        color: colorHex,
        emissive: emissiveHex,
        emissiveIntensity: 0.22,
        roughness: 0.08,
        metalness: 0.05,
        transmission: 0.82,
        thickness: 0.6,
        ior: 1.52,
        transparent: true,
        opacity: 0.9,
        specularIntensity: 1.0,
    });
}

// Тонкая яркая линия: связь, траектория, лазерный след.
export function laserMat(colorHex) {
    return new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: colorHex, emissiveIntensity: 2.3, roughness: 0.1 });
}

// Сияющее ядро: точка предсказания, вершина, узел.
export function orbMat(colorHex) {
    return new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: colorHex, emissiveIntensity: 2.8, roughness: 0.05 });
}

// Опережающие волны радара по полю тумбы. Признак уровня +4 и только его: система
// действует до запроса, и волна уходит раньше, чем что-то произошло.
export function proactiveWaves(color) {
    const group = new THREE.Group();

    const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.16, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(0, 0.003, 0);
    disc.userData = {
        onFrame: (node, time) => {
            node.material.opacity = 0.28 + Math.sin(time * 2.8) * 0.1;
        },
    };
    group.add(disc);

    [0, 0.33, 0.66].forEach((phase, idx) => {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.18, 0.2, 64),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
        );
        ring.name = `waveRing_${idx}`;
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(0, 0.005, 0);
        ring.userData = {
            offset: phase,
            onFrame: (node, time) => {
                const progress = (time * 0.65 + node.userData.offset) % 1;
                const s = 0.45 + progress * 2.0;
                node.scale.set(s, s, 1);
                node.material.opacity = Math.sin(progress * Math.PI) * 0.7;
            },
        };
        group.add(ring);
    });

    return group;
}

// Парение группы над тумбой. Вешается на группу целиком, а не на каждую деталь: детали
// внутри могут иметь своё движение, и складывать их с общим качанием нельзя.
export function hover(group, amplitude = 0.022, speed = 1.9) {
    const base = group.position.y;
    group.userData = {
        ...group.userData,
        onFrame: (node, time) => {
            node.position.y = base + Math.sin(time * speed) * amplitude;
        },
    };
    return group;
}

// Медленное вращение вокруг вертикали — движение уровней +3 и +4.
export function spin(object, speed = 0.35) {
    object.userData = {
        ...object.userData,
        onFrame: (node, time) => {
            node.rotation.y = time * speed;
        },
    };
    return object;
}

// Тени включаются одним проходом на готовой сборке: забыть их на отдельной детали значит
// получить предмет, висящий без опоры на белом поле.
export function castAll(group) {
    group.traverse((n) => {
        if (!n.isMesh) return;
        n.castShadow = true;
        n.receiveShadow = true;
    });
    return group;
}
