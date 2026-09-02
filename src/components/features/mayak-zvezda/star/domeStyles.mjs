// Четыре стиля на одном объекте.
//
// Зачем таблицей, а не четырьмя сценами: спорный вопрос — стиль или структура. Пока стиль
// меняется вместе с объектом, разделить их нельзя, и каждый заход стоит целого цикла. Здесь
// объект один и тот же, меняются только эти параметры — если ни один стиль не подойдёт,
// значит дело в куполе, и это выяснится за один просмотр.
//
// Каждый стиль снят с конкретного референса, а не придуман. Ссылка в комментарии — чтобы
// через месяц было видно, откуда взялись числа.

export const STYLES = {
    // jordan-breton.com: вся картинка — светящийся контур по чёрному, ни одной заливки.
    // Самый дешёвый: качество даёт обводка, а не материал.
    contour: {
        name: "Контур",
        about: "Свечение по чёрному, заливки нет",
        bg: "#02040a",
        fog: [7, 26],
        fill: null, // блоки не заливаются вовсе
        edge: { built: "ray", cage: "#1d4a5c", builtOpacity: 1, cageOpacity: 0.3 },
        light: { ambient: 0.2, hemiSky: "#2a4a5c", hemiGround: "#02040a", hemi: 0.3, dir: 0.4, point: 0 },
        bloom: { intensity: 1.8, threshold: 0.08 },
        ground: { fill: null, ring: "#0e3a48", ringOpacity: 0.85 },
        dust: 0,
    },

    // igloo.inc: один объект в пустоте, холодный монохром, туман, разметка по земле.
    // Цвет луча здесь почти не звучит — различает форма и подпись, а не тон.
    pribor: {
        name: "Прибор",
        about: "Холодный монохром, туман, разметка",
        bg: "#0c1016",
        fog: [8, 22],
        fill: { color: "#8e9bb0", roughness: 0.85, tint: 0.15 },
        edge: { built: "#e8f0ff", cage: "#54637d", builtOpacity: 0.9, cageOpacity: 0.45 },
        light: { ambient: 0.9, hemiSky: "#cfe0ff", hemiGround: "#151a24", hemi: 1.4, dir: 2.4, point: 3 },
        bloom: { intensity: 0.35, threshold: 0.75 },
        ground: { fill: "#161c26", ring: "#2c3646", ringOpacity: 0.9 },
        dust: 260,
    },

    // joseph-san.com: плотный цветной туман, пылинки в свете, глубина вместо детализации.
    kino: {
        name: "Кино",
        about: "Плотный туман, пыль, глубина",
        bg: "#071c22",
        fog: [6, 17],
        fill: { color: "#123038", roughness: 0.95, tint: 0.4 },
        edge: { built: "ray", cage: "#1c4650", builtOpacity: 0.85, cageOpacity: 0.28 },
        light: { ambient: 0.4, hemiSky: "#4fd6d0", hemiGround: "#04141a", hemi: 0.8, dir: 1.4, point: 9 },
        bloom: { intensity: 1.1, threshold: 0.3 },
        ground: { fill: "#061419", ring: "#0f3b42", ringOpacity: 0.7 },
        dust: 420,
    },

    // thibault-introvigne.com: светло, мягко, дружелюбно. Проверка на то, обязана ли
    // объяснялка методологии быть тёмной — все четыре референса тёмные кроме этого.
    svet: {
        name: "Свет",
        about: "Светло и мягко, без темноты",
        bg: "#e3d7e6",
        fog: [10, 30],
        fill: { color: "#fbf7fa", roughness: 0.7, tint: 0.25 },
        edge: { built: "ray", cage: "#b9a6c0", builtOpacity: 0.75, cageOpacity: 0.5 },
        light: { ambient: 1.6, hemiSky: "#ffffff", hemiGround: "#c9b6d0", hemi: 2, dir: 1.6, point: 0 },
        bloom: { intensity: 0.15, threshold: 0.95 },
        ground: { fill: "#d3c4d8", ring: "#b09cb8", ringOpacity: 0.8 },
        dust: 0,
    },
};

export const STYLE_IDS = Object.keys(STYLES);

// Пылинки. Детерминированный генератор, не Math.random: кадр должен воспроизводиться, иначе
// сравнивать два стиля нечем — разница будет частью в стиле, частью в случайной раскладке.
export function dustPositions(count, seed = 7) {
    let s = seed;
    const rnd = () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
    };
    const out = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
        const r = 2 + rnd() * 6;
        const a = rnd() * Math.PI * 2;
        out[i * 3] = Math.cos(a) * r;
        out[i * 3 + 1] = rnd() * 4.2;
        out[i * 3 + 2] = Math.sin(a) * r;
    }
    return out;
}
