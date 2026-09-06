// День 2: карта задания в SVG, собранная сервером из полей карточки.
//
// Зачем: генератор карт жил на ноутбуке (Python, PIL). Чтобы админка записывала
// раздел кнопкой, карта должна рисоваться здесь. Раскладка повторяет png-карты
// колоды 8101-8200: пилюля вида, номер, минуты, заголовок, «зачем», фигура
// (гекс, пара, цветок, точка 0, питч, приёмка, карта), задание, «сдать», «готово».
// Шрифт — системный Arial: метрик у сервера нет, ширина строки оценивается по
// средней ширине знака, поэтому переносы приблизительные, но текст не вылезает.

export const CARD_W = 1259;
export const CARD_H = 1747;

const COL = { 11: "#F2A900", 12: "#D9412B", 13: "#1F6FD0", 14: "#1B4F9C", 15: "#6EC1E4", 16: "#7AB929", 0: "#6D6D6D" };
const NAME = { 11: ["Знания", "и навыки"], 12: ["Внешние", "взаимодействия"], 13: ["Данные", "и аналитика"], 14: ["Автома-", "тизация"], 15: ["Единое цифровое", "пространство"], 16: ["Защита", "данных"] };
const PILL_COL = { СТАРТ: "#6D6D6D", ПИТЧ: "#1B4F9C", ДЕТАЛЬ: "#F2A900", УЗЕЛ: "#1F6FD0", СБОРКА: "#D9412B", ПРИЁМКА: "#7AB929", КАРТА: "#6EC1E4" };

function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Оценка ширины строки: средний знак Arial ≈ 0,55 размера (кириллица чуть шире латиницы).
function widthOf(text, size) {
    return text.length * size * 0.55;
}

function wrap(text, size, maxW) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = "";
    words.forEach((w) => {
        const t = (cur + " " + w).trim();
        if (widthOf(t, size) <= maxW) cur = t;
        else {
            if (cur) lines.push(cur);
            cur = w;
        }
    });
    if (cur) lines.push(cur);
    return lines;
}

function textBlock(y, text, size, maxW, { fill = "#111", bold = true, gap = 8, anchor = "middle", x = CARD_W / 2 } = {}) {
    const lines = wrap(text, size, maxW);
    const out = lines.map((ln, i) =>
        `<text x="${x}" y="${y + i * (size + gap) + size}" font-size="${size}" font-weight="${bold ? 700 : 400}" fill="${fill}" text-anchor="${anchor}">${esc(ln)}</text>`
    );
    return { svg: out.join(""), nextY: y + lines.length * (size + gap) };
}

function hexPoints(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 6; i += 1) {
        const a = ((60 * i - 30) * Math.PI) / 180;
        pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(" ");
}

function hex(cx, cy, r, color, label, name, { width = 14, fill = "#FFFFFF" } = {}) {
    let s = `<polygon points="${hexPoints(cx, cy, r)}" fill="${fill}" stroke="${color}" stroke-width="${width}"/>`;
    const fs = Math.round(r * 0.7);
    // три строки подписи не помещаются под цифрой: блок сдвигается вверх на полстроки, две строки — как раньше
    const fn = Math.round(r * 0.17);
    const up = name ? ((name.length - 2) * (fn + 2)) / 2 : 0;
    s += `<text x="${cx}" y="${cy + (name ? fs * 0.1 : fs * 0.35) - up}" font-size="${fs}" font-weight="700" fill="#111" text-anchor="middle">${esc(label)}</text>`;
    if (name) {
        name.forEach((ln, i) => {
            s += `<text x="${cx}" y="${cy + r * 0.12 + (i + 1) * (fn + 2) - up}" font-size="${fn}" font-weight="700" fill="#111" text-anchor="middle">${esc(ln)}</text>`;
        });
    }
    return s;
}

function figure(kind, hexes, cy) {
    const cx = CARD_W / 2;
    if (kind === "detail" && hexes[0]) {
        const n = hexes[0];
        return hex(cx, cy, 210, COL[n], String(n), NAME[n]);
    }
    if (kind === "node" && hexes.length === 2) {
        const r = 170;
        const dx = (r * Math.sqrt(3)) / 2;
        return hex(cx - dx, cy, r, COL[hexes[0]], String(hexes[0]), NAME[hexes[0]]) + hex(cx + dx, cy, r, COL[hexes[1]], String(hexes[1]), NAME[hexes[1]]);
    }
    if (kind === "assembly" || kind === "intro") {
        const r = 105;
        const dist = r * Math.sqrt(3) + 6;
        let s = "";
        [11, 12, 13, 14, 15, 16].forEach((n, i) => {
            const a = ((-90 + 60 * i) * Math.PI) / 180;
            s += hex(cx + dist * Math.cos(a), cy + dist * Math.sin(a), r, COL[n], String(n), null, { width: 10 });
        });
        return s + hex(cx, cy, r, COL[0], "10", null, { width: 10, fill: "#EEEEEE" });
    }
    if (kind === "point0") {
        return hex(cx, cy, 210, COL[0], "0", ["кто пользуется ·", "что болит ·", "что изменится"], { fill: "#F3F3F3" });
    }
    if (kind === "pitch") {
        return `<circle cx="${cx}" cy="${cy}" r="200" fill="none" stroke="#1B4F9C" stroke-width="14"/><polygon points="${cx - 60},${cy - 110} ${cx - 60},${cy + 110} ${cx + 130},${cy}" fill="#1B4F9C"/>`;
    }
    if (kind === "acceptance") {
        let s = "";
        for (let i = 0; i < 7; i += 1) {
            const x = cx - 3 * 150 + i * 150;
            s += `<circle cx="${x}" cy="${cy}" r="55" fill="none" stroke="#7AB929" stroke-width="10"/><text x="${x}" y="${cy + 21}" font-size="60" font-weight="700" fill="#111" text-anchor="middle">${i + 1}</text>`;
        }
        return s;
    }
    if (kind === "roadmap") {
        let s = "";
        for (let i = 0; i < 6; i += 1) {
            const x = cx - 2.5 * 190 + i * 190;
            s += hex(x, cy, 80, "#6EC1E4", String(i + 1), null, { width: 8 });
        }
        return s + `<line x1="${cx - 2.5 * 190}" y1="${cy + 130}" x2="${cx + 2.5 * 190}" y2="${cy + 130}" stroke="#6EC1E4" stroke-width="8"/>`;
    }
    return "";
}

// card — запись index.json с полем day2 {kind, hexes, mins, pill, why, task, submit, done}.
export function renderDayTwoCardSvg(card) {
    const meta = card?.day2 || {};
    const pill = meta.pill || card?.contentType || "";
    const pc = PILL_COL[pill] || "#111";
    const parts = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" font-family="Arial, Helvetica, sans-serif">`,
        `<rect width="${CARD_W}" height="${CARD_H}" fill="#FFFFFF"/>`,
        `<rect x="430" y="80" width="400" height="110" rx="55" fill="none" stroke="${pc}" stroke-width="8"/>`,
        `<text x="${CARD_W / 2}" y="152" font-size="46" font-weight="700" fill="${pc}" text-anchor="middle">${esc(pill)}</text>`,
        `<rect x="1000" y="95" width="190" height="80" rx="40" fill="none" stroke="#111" stroke-width="6"/>`,
        `<text x="1095" y="150" font-size="40" font-weight="700" fill="#111" text-anchor="middle">№${esc(card?.number)}</text>`,
    ];
    if (meta.mins) parts.push(`<text x="70" y="150" font-size="40" font-weight="700" fill="#666">${esc(meta.mins)} мин</text>`);

    let y = 230;
    let b = textBlock(y, card?.title || "", 88, CARD_W - 160, { gap: 6 });
    parts.push(b.svg); y = b.nextY + 14;
    b = textBlock(y, meta.why || "", 46, CARD_W - 160, { fill: "#333", bold: false });
    parts.push(b.svg);

    parts.push(figure(meta.kind, (meta.hexes || []).map(Number), 830));

    y = 1150;
    b = textBlock(y, meta.task || "", 64, CARD_W - 140);
    parts.push(b.svg); y = b.nextY + 26;
    if (meta.submit) {
        b = textBlock(y, "Сдать: " + meta.submit, 42, CARD_W - 160, { fill: "#1B4F9C", bold: false });
        parts.push(b.svg); y = b.nextY + 6;
    }
    if (meta.done) {
        b = textBlock(y, "Готово, когда: " + meta.done, 42, CARD_W - 160, { fill: "#7AB929", bold: false });
        parts.push(b.svg);
    }
    parts.push("</svg>");
    return parts.join("");
}
