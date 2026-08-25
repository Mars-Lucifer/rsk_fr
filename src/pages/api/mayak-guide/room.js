import crypto from "crypto";
import path from "path";

import { readJsonFile, updateJsonFile } from "@/lib/jsonFileLock";
import { MY_PLANS, acceptBlocker, canMove, nextTakt, phaseOf, sideFinished, taktDeals } from "@/components/features/mayak-guide/guideRules.mjs";

// Живой стол гайда — режим «Обучение» рядом с демонстрацией.
//
// Своё маленькое хранилище, а не сессионный рантайм МАЯКа, намеренно: сессия требует
// админского входа, создания сессии, столов и ролей, и живёт в файлах чужого
// направления. Здесь нужен один стол на шестерых и ссылка, которую мастер копирует и
// шлёт участнику. Когда режим перерастёт прототип, комната меняется на сессионный
// токен — контракт снаружи (место, ячейка, такт) при этом не меняется.
//
// На столе шесть мест по числу миплов набора (MEEPLE_COLORS в fieldLayoutYa.mjs).
// Геометрию поля сервер не знает и знать не должен: ячейка приходит и уходит строкой
// вроде "inner:2" или "type:text:ray:1", а расшифровывает её сцена. Правила прохождения
// сервер и сцена берут из одного модуля guideRules.mjs — иначе валидация хода и
// подсветка клетки разъедутся.
const ROOMS_FILE = path.join(process.cwd(), "data", "mayak-guide-rooms.json");
const SEATS = 6;

// Комнат в файле держим немного: это прототип, а не журнал. Свежие сверху, лишние
// вытесняются — иначе файл растёт от каждой пробы.
const MAX_ROOMS = 20;

// Место, с которого никто не подавал признаков жизни, освобождается: иначе стол на
// шесть мест умирает после шести случайных входов (телефон, потом ноутбук, потом
// чистка кэша), и посреди занятия приходится раздавать новую ссылку.
const SEAT_TTL_MS = 15 * 60 * 1000;

// Ячейка — только ярлык: буквы, цифры, двоеточие, дефис. Проверка не про правила
// (их считает guideRules), а про то, что в файл не приедет произвольная строка.
const CELL_PATTERN = /^[a-z0-9:_-]{1,40}$/;

const EMPTY_STORE = { rooms: [] };

// Комнаты живут в памяти процесса, файл — только чтобы пережить перезапуск сервера.
//
// Так это устроено не из экономии: доску опрашивают шесть участников раз в полторы
// секунды, и файл читался четыре раза в секунду. Пока читатель шёл без лока, он ловил
// файл в момент подмены и падал с «Unexpected end of JSON input»; лок на чтении убрал
// это, но выстроил очередь и начал отдавать EEXIST по таймауту.
//
// Мемоизируется промис, а не результат: шесть участников, открывших ссылку разом после
// перезапуска, входят сюда до того, как разрешилось чтение файла, и на результате
// каждый строил бы свою копию комнаты — места раздались бы в мусор.
//
// ponytail: состояние в одном процессе. Если приложение поднимут в несколько инстансов,
// комнаты у них разъедутся — тогда переносить в общее хранилище (сессионный рантайм
// МАЯКа или Redis), а не чинить файл.
// Состояние живёт в globalThis, а не в переменной модуля. Next в разработке
// перекомпилирует роут на каждой правке, и модульная переменная при этом обнуляется:
// комната перечитывается с диска, а там состояние на 400 мс старше — участник, только
// что сходивший, снова оказывается не дошедшим, и мастер видит «Не дошли: И5» при
// правильных фишках на экране. Ловится это только на живом занятии, потому что в
// одиночных проверках между запросами никто ничего не правит.
const CELL = Symbol.for("mayak.guide.rooms");
const shared = (globalThis[CELL] = globalThis[CELL] || { ready: null, memory: null, saving: null, dirty: false });

async function store() {
    if (!shared.memory) {
        if (!shared.ready) shared.ready = readJsonFile(ROOMS_FILE, EMPTY_STORE);
        const loaded = await shared.ready;
        if (!shared.memory) shared.memory = Array.isArray(loaded?.rooms) ? loaded : { rooms: [] };
    }
    return shared.memory;
}

// Сохранение не держит ответ: ход уже применён в памяти и отдан клиенту. Но и не
// откладывается — иначе перезапуск сервера съедает последние ходы, а на живом занятии
// это выглядит как «фишка сама уехала назад».
//
// Записи не идут параллельно: пока одна в работе, остальные только поднимают флаг, и
// после неё пишется уже актуальный снимок. Так на диск попадает всё, но открытие
// лок-файла не устраивает шторм — на Windows десятки записей в секунду дают EPERM.
function persist() {
    shared.dirty = true;
    if (shared.saving) return;
    shared.saving = (async () => {
        try {
            while (shared.dirty) {
                shared.dirty = false;
                const snapshot = { rooms: shared.memory.rooms };
                await updateJsonFile(ROOMS_FILE, EMPTY_STORE, () => snapshot).catch((error) => {
                    console.error("Живой стол: не удалось сохранить комнаты", error);
                });
            }
        } finally {
            shared.saving = null;
        }
    })();
}

function emptySeats() {
    return Array.from({ length: SEATS }, (_, index) => ({
        index,
        memberId: "",
        name: "",
        // null — фишка в лотке, ещё не на поле.
        cell: null,
        // Направление специализации: выбирается участником, определяет его луч и стопку.
        typeId: "",
        star: false,
        updatedAt: null,
        lastSeenAt: null,
    }));
}

function newRoom() {
    return {
        token: crypto.randomBytes(6).toString("hex"),
        // Ключ мастера наружу не отдаётся никогда: он лежит в браузере создателя стола и
        // даёт право принимать такты, поправлять чужие фишки и освобождать места.
        masterKey: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        // Монотонная версия снимка. Без неё отставший ответ опроса откатывает чужие
        // фишки на предыдущую клетку, а раздача карт применяется повторно.
        version: 1,
        // Сторона набора: партия начинается с «Я» и переходит на «МЫ» по решению
        // мастера — как за настоящим столом, где полотно переворачивают руками.
        side: "ya",
        phase: 0,
        taktIndex: 0,
        // Журнал стола: раздачи карт и уборка со стола, по порядку. Клиент проигрывает
        // всё, что новее применённого им номера, — так карты появляются одинаково у
        // всех шестерых, хотя сцена у каждого своя.
        events: [],
        seats: emptySeats(),
    };
}

function bump(room) {
    room.version += 1;
    return room;
}

function pushEvent(room, event) {
    room.events.push({ n: room.events.length + 1, ...event });
    // Журнал не растёт бесконечно: партия — это полторы сотни событий, храним с запасом.
    if (room.events.length > 400) room.events = room.events.slice(-400);
}

// Наружу уходит всё, кроме ключа мастера и идентификаторов участников: по memberId
// соседа можно было бы двигать его фишку.
function publicRoom(room) {
    return {
        token: room.token,
        createdAt: room.createdAt,
        version: room.version,
        side: room.side,
        phase: room.phase,
        taktIndex: room.taktIndex,
        events: room.events,
        seats: room.seats.map((seat) => ({
            index: seat.index,
            name: seat.name,
            cell: seat.cell,
            typeId: seat.typeId,
            taken: Boolean(seat.memberId),
            updatedAt: seat.updatedAt,
            // Красная Звезда-Джокер за закрытую специализацию: на «МЫ» она закроет
            // последнюю клетку направления.
            star: Boolean(seat.star),
            // На связи ли участник. Опрос идёт раз в полторы секунды, поэтому минута
            // молчания — это уже закрытая вкладка или пропавший интернет, а не пауза.
            online: Boolean(seat.memberId && seat.lastSeenAt && Date.now() - Date.parse(seat.lastSeenAt) < 60_000),
        })),
        // Подсказка мастеру, кого ждём. Считается тем же модулем правил, что и подсветка.
        blocker: acceptBlocker(room),
    };
}

function findRoom(state, token) {
    return state.rooms.find((room) => room.token === token) || null;
}

function seatOf(room, memberId) {
    return memberId ? room.seats.find((seat) => seat.memberId === memberId) || null : null;
}

function normalizeName(value) {
    return String(value || "").trim().slice(0, 40);
}

function touch(seat) {
    seat.lastSeenAt = new Date().toISOString();
}

// Освободить места, с которых давно никто не отзывался. Вызывается только при входе:
// чистить по таймеру в прототипе нечем, да и незачем — место нужно ровно тогда, когда
// за него садятся.
function releaseStale(room) {
    const now = Date.now();
    let freed = 0;
    for (const seat of room.seats) {
        if (!seat.memberId || !seat.lastSeenAt) continue;
        if (now - Date.parse(seat.lastSeenAt) < SEAT_TTL_MS) continue;
        seat.memberId = "";
        seat.name = "";
        seat.cell = null;
        seat.typeId = "";
        seat.lastSeenAt = null;
        freed += 1;
    }
    return freed;
}

export default async function handler(req, res) {
    try {
        const state = await store();

        if (req.method === "GET") {
            const room = findRoom(state, String(req.query.token || ""));
            if (!room) return res.status(404).json({ success: false, error: "Стол не найден" });
            // Опрос доски заодно отмечает участника живым. Без этого «на связи» знали бы
            // только про того, кто сейчас ходит, а отвалившегося от закрывшего ноутбук
            // не отличить: оба просто перестают двигать фишку.
            const watcher = seatOf(room, String(req.query.member || ""));
            if (watcher) touch(watcher);
            return res.status(200).json({ success: true, data: publicRoom(room) });
        }

        if (req.method !== "POST") {
            return res.status(405).json({ success: false, error: "Method not allowed" });
        }

        const { action } = req.body || {};
        const token = String(req.body?.token || "");
        const memberId = String(req.body?.memberId || "");

        if (action === "create") {
            const room = newRoom();
            // Вытесняем не по возрасту, а по признаку жизни: иначе двадцать первый
            // созданный стол выбрасывает тот, за которым прямо сейчас идёт занятие.
            // Живым считается стол, где кто-то сидит и подавал признаки жизни недавно.
            const now = Date.now();
            const alive = (entry) =>
                entry.seats.some((seat) => seat.memberId && seat.lastSeenAt && now - Date.parse(seat.lastSeenAt) < SEAT_TTL_MS);
            const kept = [room, ...state.rooms];
            if (kept.length > MAX_ROOMS) {
                const living = kept.filter(alive);
                const idle = kept.filter((entry) => !alive(entry));
                state.rooms = [...living, ...idle].slice(0, Math.max(MAX_ROOMS, living.length));
            } else {
                state.rooms = kept;
            }
            persist();
            // Ключ мастера отдаётся ровно один раз — тому, кто создал стол.
            return res.status(200).json({ success: true, data: { ...publicRoom(room), masterKey: room.masterKey } });
        }

        const room = findRoom(state, token);
        if (!room) return res.status(404).json({ success: false, error: "Стол не найден" });

        if (action === "join") {
            const name = normalizeName(req.body?.name);
            // Участник приходит со своим memberId из localStorage: перезагрузка страницы
            // и потеря связи не должны отбирать у него место и фишку.
            const id = memberId || crypto.randomUUID();

            let seat = seatOf(room, id);
            if (!seat) {
                releaseStale(room);
                seat = room.seats.find((entry) => !entry.memberId);
            }
            if (!seat) return res.status(409).json({ success: false, error: "За столом уже шестеро" });

            seat.memberId = id;
            seat.name = name || seat.name || `Игрок ${seat.index + 1}`;
            touch(seat);
            bump(room);
            persist();
            return res.status(200).json({ success: true, data: { seatIndex: seat.index, memberId: id, room: publicRoom(room) } });
        }

        if (action === "leave") {
            const seat = seatOf(room, memberId);
            if (seat) {
                seat.memberId = "";
                seat.name = "";
                seat.cell = null;
                seat.typeId = "";
                seat.lastSeenAt = null;
                bump(room);
                persist();
            }
            return res.status(200).json({ success: true, data: publicRoom(room) });
        }

        if (action === "move") {
            const raw = req.body?.cell;
            const cell = raw === null ? null : String(raw);
            if (cell !== null && !CELL_PATTERN.test(cell)) {
                return res.status(400).json({ success: false, error: "Недопустимая ячейка" });
            }

            // Свою фишку двигает только её хозяин. Место ищем по memberId, а не по
            // индексу из запроса: иначе достаточно прислать чужой номер места.
            const seat = seatOf(room, memberId);
            if (!seat) return res.status(403).json({ success: false, error: "Это не ваш мипл" });

            // Повторный ход на ту же клетку — не ошибка, а ничего не делающее действие.
            // Так бывает на переходе фаз: место уже стоит на секторе своего типа, и
            // первый такт специализации начинается там же, где кончилось кольцо.
            if (seat.cell === cell) {
                return res.status(200).json({ success: true, data: publicRoom(room) });
            }

            // Ход по правилам такта, а не куда угодно. Проверяет тот же модуль, по
            // которому сцена подсвечивает клетку, поэтому «подсвечено, но не принято»
            // невозможно by design.
            if (cell !== null && !canMove(room, seat, cell)) {
                return res.status(409).json({ success: false, error: "Эта клетка сейчас закрыта" });
            }

            seat.cell = cell;
            seat.updatedAt = new Date().toISOString();
            touch(seat);
            bump(room);
            persist();
            return res.status(200).json({ success: true, data: publicRoom(room) });
        }

        if (action === "type") {
            const typeId = String(req.body?.typeId || "");
            const seat = seatOf(room, memberId);
            if (!seat) return res.status(403).json({ success: false, error: "Это не ваше место" });
            // Направление выбирается до специализации и дальше не меняется: карты уже
            // розданы из стопки этого типа, а фишка стоит на его луче.
            if (room.phase > 3 || (room.phase === 3 && seat.typeId)) {
                return res.status(409).json({ success: false, error: "Направление уже выбрано" });
            }
            seat.typeId = typeId;
            touch(seat);
            bump(room);
            persist();
            return res.status(200).json({ success: true, data: publicRoom(room) });
        }

        // Ниже — действия мастера. Ключ приходит из браузера того, кто создал стол.
        const isMaster = String(req.body?.masterKey || "") === room.masterKey;

        if (action === "accept" || action === "moveAny" || action === "free" || action === "reset" || action === "flip") {
            if (!isMaster) return res.status(403).json({ success: false, error: "Это может только мастер стола" });
        }

        if (action === "accept") {
            // Мастер может принять такт и раньше, чем все дошли: занятие важнее правила,
            // а кто не дошёл — видно в blocker. Force приходит с подтверждением из панели.
            const blocker = acceptBlocker(room);
            if (blocker && !req.body?.force) {
                return res.status(409).json({ success: false, error: blocker });
            }

            const next = nextTakt(room);
            if (!next) return res.status(409).json({ success: false, error: "Партия уже закончена" });

            // Сданные карты уходят со стола, и только потом ложатся новые: на столе
            // лежит текущее задание, а не всё, что выдали с начала партии.
            pushEvent(room, { kind: "park" });

            // Закрытие такта «МЫ» — это ещё и предметы: девять жетонов переворачиваются
            // цветной стороной, девять звёзд встают на трек индекса зрелости. Порядок
            // важен: сначала закрываем прошлый такт, потом выкладываем следующий.
            if (room.side === "my" && room.phase === 1) {
                pushEvent(room, { kind: "jetons-flip", takt: room.taktIndex });
                (MY_PLANS[room.taktIndex] || []).forEach((dir, cell) => pushEvent(room, { kind: "star", dir, cell }));
            }
            // Итог «Я»: каждый, кто закрыл свой луч, приносит команде красную
            // Звезду-Джокер. На «МЫ» она закроет последнюю клетку направления.
            //
            // Условие ловит именно выход из специализации, а не саму фазу: по фазе оно
            // срабатывало на каждом из четырёх тактов и выдавало 24 звезды вместо шести,
            // то есть вчетверо больше, чем есть в наборе.
            if (room.side === "ya" && room.phase === 3 && next.phase !== 3) {
                for (const seat of room.seats) {
                    if (!seat.memberId || !seat.typeId) continue;
                    seat.star = true;
                    pushEvent(room, { kind: "joker-ya", typeId: seat.typeId, seatIndex: seat.index });
                }
            }

            room.phase = next.phase;
            room.taktIndex = next.taktIndex;

            // Новый такт «МЫ» начинается с жетонов: команда выкладывает план девятью
            // жетонами рубашкой вверх, и только под них уходят карты.
            if (room.side === "my" && room.phase === 1) pushEvent(room, { kind: "jetons-lay", takt: room.taktIndex });
            for (const deal of taktDeals(room)) pushEvent(room, { kind: "deal", ...deal });
            // Итог «МЫ»: шесть Джокеров закрывают последние клетки направлений.
            if (room.side === "my" && sideFinished(room)) pushEvent(room, { kind: "jokers" });

            bump(room);
            persist();
            return res.status(200).json({ success: true, data: publicRoom(room) });
        }

        if (action === "flip") {
            if (!isMaster) return res.status(403).json({ success: false, error: "Это может только мастер стола" });
            if (room.side === "my") return res.status(409).json({ success: false, error: "Полотно уже на стороне «МЫ»" });
            if (!sideFinished(room)) return res.status(409).json({ success: false, error: "Сторона «Я» ещё не пройдена" });

            // Полотно нельзя перевернуть с разложенными предметами: сначала стол
            // расчищают, и только потом берутся за ткань. Тот же порядок, что в
            // демонстрации, и та же причина — иначе половина набора исчезает на глазах.
            room.side = "my";
            room.phase = 0;
            room.taktIndex = 0;
            // Журнал НЕ обнуляется. Номер события — это указатель, докуда клиент уже
            // доиграл; обнулив нумерацию, мы делаем новые события «старее» применённых,
            // и они молча пропускаются: полотно остаётся стороной «Я» при том, что
            // сервер уверен в обратном.
            pushEvent(room, { kind: "flip" });
            for (const seat of room.seats) seat.cell = null;
            bump(room);
            persist();
            return res.status(200).json({ success: true, data: publicRoom(room) });
        }

        if (action === "moveAny") {
            // Мастер поправляет чужую фишку: участник ошибся и ушёл, а занятие стоит.
            // Правила здесь не проверяются намеренно — это ручное вмешательство.
            const index = Number(req.body?.seatIndex);
            const seat = room.seats[index];
            if (!seat) return res.status(400).json({ success: false, error: "Нет такого места" });
            const raw = req.body?.cell;
            const cell = raw === null ? null : String(raw);
            if (cell !== null && !CELL_PATTERN.test(cell)) {
                return res.status(400).json({ success: false, error: "Недопустимая ячейка" });
            }
            seat.cell = cell;
            seat.updatedAt = new Date().toISOString();
            bump(room);
            persist();
            return res.status(200).json({ success: true, data: publicRoom(room) });
        }

        if (action === "free") {
            const index = Number(req.body?.seatIndex);
            const seat = room.seats[index];
            if (!seat) return res.status(400).json({ success: false, error: "Нет такого места" });
            seat.memberId = "";
            seat.name = "";
            seat.cell = null;
            seat.typeId = "";
            seat.lastSeenAt = null;
            bump(room);
            persist();
            return res.status(200).json({ success: true, data: publicRoom(room) });
        }

        if (action === "reset") {
            // Партия сначала: фишки в лоток, карты в коробку, такт нулевой. Места и имена
            // остаются — заново рассаживать шестерых посреди занятия незачем.
            room.side = "ya";
            room.phase = 0;
            room.taktIndex = 0;
            // Журнал продолжается по той же причине, что и при перевороте: номер события
            // — курсор клиента, а не порядковый номер внутри партии.
            pushEvent(room, { kind: "reset" });
            for (const seat of room.seats) {
                seat.cell = null;
                seat.typeId = "";
                seat.star = false;
            }
            bump(room);
            persist();
            return res.status(200).json({ success: true, data: publicRoom(room) });
        }

        return res.status(400).json({ success: false, error: "Неизвестное действие" });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message || "Ошибка стола" });
    }
}
