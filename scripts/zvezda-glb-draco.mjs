// Сжатие GLB-предметов ЗВЕЗДЫ в Draco.
//
// Генераторы отдают модель сырой: позиции и нормали по float32, индексы по uint32,
// плюс UV-развёртка и текстура. Сцена всё равно перекрашивает предмет в гипс
// (Props.js, материал PLASTER), поэтому UV и текстура — мёртвый вес, а точность
// float32 на предмете размером с ладонь избыточна.
//
// Шесть предметов по мегабайту — это шесть мегабайт на каждого зрителя демо.
// После сжатия столько же весит вся страница целиком.
//
// Декодер уже лежит в public/draco/ и подключён в Props.js вторым аргументом
// useGLTF. Ни одного нового пакета: draco3d стоит в зависимостях.
//
// Запуск:  node scripts/zvezda-glb-draco.mjs public/zvezda-props/*.glb
// Файл переписывается на месте, исходник уезжает в data/zvezda-props-raw/.
// Не рядом с файлом: public/ раздаётся целиком, и копия по мегабайту лежала бы
// в открытом доступе и уходила бы в коммит. data/ не отслеживается.

import { createEncoderModule } from "draco3d";
import fs from "node:fs";
import path from "node:path";

// Уровень сжатия и разрядность квантования. 14 бит на позицию — это 16384 деления
// на габарит предмета, то есть доли миллиметра при размере тумбы. Меньше — на контуре
// EdgesGeometry начинают проступать ступеньки.
const SPEED = 0;
const BITS = { POSITION: 14, NORMAL: 10 };

const COMPONENT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function readGlb(buf) {
    if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("не GLB");
    const jsonLen = buf.readUInt32LE(12);
    const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
    const binLen = buf.readUInt32LE(20 + jsonLen);
    const bin = buf.slice(20 + jsonLen + 8, 20 + jsonLen + 8 + binLen);
    return { json, bin };
}

function writeGlb(json, bin) {
    const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
    const jsonPad = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
    const binPad = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
    const total = 12 + 8 + jsonPad.length + 8 + binPad.length;
    const out = Buffer.alloc(total);
    out.writeUInt32LE(0x46546c67, 0);
    out.writeUInt32LE(2, 4);
    out.writeUInt32LE(total, 8);
    out.writeUInt32LE(jsonPad.length, 12);
    out.writeUInt32LE(0x4e4f534a, 16);
    jsonPad.copy(out, 20);
    out.writeUInt32LE(binPad.length, 20 + jsonPad.length);
    out.writeUInt32LE(0x004e4942, 24 + jsonPad.length);
    binPad.copy(out, 28 + jsonPad.length);
    return out;
}

// Чтение аккессора в плоский типизированный массив. Чересстрочные буферы (byteStride)
// генераторы отдают редко, но встречаются, поэтому шаг учитывается.
function readAccessor(json, bin, index) {
    const acc = json.accessors[index];
    const view = json.bufferViews[acc.bufferView];
    const Type = COMPONENT[acc.componentType];
    const comps = COUNT[acc.type];
    const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const stride = view.byteStride || comps * Type.BYTES_PER_ELEMENT;
    const out = new Type(acc.count * comps);
    for (let i = 0; i < acc.count; i++) {
        const src = new Type(bin.buffer, bin.byteOffset + base + i * stride, comps);
        out.set(src, i * comps);
    }
    return out;
}

function compress(file) {
    const raw = fs.readFileSync(file);
    const { json, bin } = readGlb(raw);
    const enc = new encoderModule.Encoder();
    const chunks = [];
    let dropped = 0;

    for (const mesh of json.meshes || []) {
        for (const prim of mesh.primitives) {
            if (prim.extensions?.KHR_draco_mesh_compression) continue;

            // Всё, кроме позиции и нормали, выбрасывается: сцена ставит свой материал,
            // и ни UV, ни вершинный цвет, ни касательные до шейдера не доходят.
            for (const key of Object.keys(prim.attributes)) {
                if (key !== "POSITION" && key !== "NORMAL") {
                    dropped++;
                    delete prim.attributes[key];
                }
            }

            const builder = new encoderModule.MeshBuilder();
            const mesh3 = new encoderModule.Mesh();
            const indices = readAccessor(json, bin, prim.indices);
            builder.AddFacesToMesh(mesh3, indices.length / 3, new Uint32Array(indices));

            const attrIds = {};
            for (const [name, accIndex] of Object.entries(prim.attributes)) {
                const data = readAccessor(json, bin, accIndex);
                const comps = COUNT[json.accessors[accIndex].type];
                const type = name === "POSITION" ? encoderModule.POSITION : encoderModule.NORMAL;
                const id = builder.AddFloatAttributeToMesh(mesh3, type, data.length / comps, comps, data);
                attrIds[name] = id;
                enc.SetAttributeQuantization(type, BITS[name]);
            }

            enc.SetSpeedOptions(SPEED, SPEED);
            enc.SetEncodingMethod(encoderModule.MESH_EDGEBREAKER_ENCODING);
            const buf = new encoderModule.DracoInt8Array();
            const len = enc.EncodeMeshToDracoBuffer(mesh3, buf);
            if (len <= 0) throw new Error("Draco вернул пустой буфер: " + file);
            const bytes = Buffer.alloc(len);
            for (let i = 0; i < len; i++) bytes[i] = buf.GetValue(i);

            // Аккессоры остаются: загрузчик берёт из них count, min и max до распаковки.
            // Ссылка на буфер снимается — данные теперь внутри сжатого блока.
            for (const accIndex of [prim.indices, ...Object.values(prim.attributes)]) {
                delete json.accessors[accIndex].bufferView;
                delete json.accessors[accIndex].byteOffset;
            }

            chunks.push({ prim, bytes, attrIds });
            encoderModule.destroy(mesh3);
            encoderModule.destroy(builder);
            encoderModule.destroy(buf);
        }
    }
    encoderModule.destroy(enc);

    // Новый бинарный блок: только сжатые куски. Старые bufferView с координатами
    // и текстурой не переносятся — на них больше никто не ссылается.
    const parts = [];
    const views = [];
    let offset = 0;
    for (const c of chunks) {
        const pad = (4 - (c.bytes.length % 4)) % 4;
        views.push({ buffer: 0, byteOffset: offset, byteLength: c.bytes.length });
        parts.push(c.bytes, Buffer.alloc(pad));
        offset += c.bytes.length + pad;
        c.prim.extensions = { ...(c.prim.extensions || {}), KHR_draco_mesh_compression: { bufferView: views.length - 1, attributes: c.attrIds } };
    }
    const newBin = Buffer.concat(parts);

    // Аккессоры выброшенных атрибутов (UV и прочее) остались бы висеть со ссылкой
    // на bufferView, которого в новом файле нет. Битая ссылка — это уже не «лишние
    // байты», а файл, на котором загрузчик спотыкается, поэтому чистим и перенумеровываем.
    const used = new Map();
    const keep = [];
    const remap = (i) => {
        if (!used.has(i)) {
            used.set(i, keep.length);
            keep.push(json.accessors[i]);
        }
        return used.get(i);
    };
    for (const mesh of json.meshes || []) {
        for (const prim of mesh.primitives) {
            if (prim.indices != null) prim.indices = remap(prim.indices);
            for (const [name, i] of Object.entries(prim.attributes)) prim.attributes[name] = remap(i);
        }
    }
    json.accessors = keep;

    json.bufferViews = views;
    json.buffers = [{ byteLength: newBin.length }];
    json.images = undefined;
    json.textures = undefined;
    json.samplers = undefined;
    for (const m of json.materials || []) delete m.pbrMetallicRoughness?.baseColorTexture;
    json.extensionsUsed = [...new Set([...(json.extensionsUsed || []), "KHR_draco_mesh_compression"])];
    json.extensionsRequired = [...new Set([...(json.extensionsRequired || []), "KHR_draco_mesh_compression"])];

    const out = writeGlb(JSON.parse(JSON.stringify(json)), newBin);
    const vault = path.join("data", "zvezda-props-raw");
    fs.mkdirSync(vault, { recursive: true });
    const backup = path.join(vault, path.basename(file));
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    fs.writeFileSync(file, out);
    return { name: path.basename(file), before: raw.length, after: out.length, prims: chunks.length, dropped };
}

const encoderModule = await createEncoderModule();
const files = process.argv.slice(2).filter((f) => /\.glb$/i.test(f) && !/\.raw\.glb$/i.test(f));
if (!files.length) {
    console.error("укажи файлы: node scripts/zvezda-glb-draco.mjs public/zvezda-props/*.glb");
    process.exit(1);
}
for (const f of files) {
    const r = compress(f);
    const k = (n) => (n / 1024).toFixed(0) + "K";
    console.log(`${r.name}: ${k(r.before)} -> ${k(r.after)} (${(100 - (r.after / r.before) * 100).toFixed(0)}% долой, примитивов ${r.prims}, атрибутов выброшено ${r.dropped})`);
}
