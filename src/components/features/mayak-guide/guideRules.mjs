// Правила прохождения стороны «Я» для живого стола: какая клетка открыта, что за карта
// ложится и когда открывается следующая.
//
// Модуль чистый и общий для сервера и сцены намеренно. Сервер по нему проверяет ход,
// сцена по нему же подсвечивает клетку — иначе правило разъедется между валидацией и
// картинкой ровно так, как разъехались 2D-плеер и 3D-сценарий: в одном внешний круг
// карт не выдаёт, в другом выдаёт.
//
// Формат .mjs — как у fieldLayout.mjs: ни JSX, ни React, поэтому его тянет и вебпак
// Next, и `node --test` для guideRules.test.mjs.
//
// Маршрут восстановлен по трём источникам (сценарий демо, 2D-плеер, руководство мастера)
// и оказался жёсткой цепочкой без развилок:
//
//   лоток → СТАРТ → внутренний круг по часовой (4 такта) → выход только из верхней
//   ячейки → кольцо шести типов (6 тактов) → свой сектор → три гекса своего луча
//
// Возвратов, диагоналей и прыжков через такт нет ни в одном источнике, поэтому здесь
// белый список, а не запрет отдельных ходов.

// Порядок типов совпадает с TYPES в fieldLayoutYa.mjs: обход кольца по часовой стрелке
// от верхнего сектора. Дублируется списком идентификаторов, чтобы модуль правил не тянул
// за собой геометрию поля — серверу она не нужна.
export const TYPE_IDS = ["text", "audio", "image", "interactive", "data", "video"];

export const PHASES = [
    { id: 0, key: "setup", name: "Сбор на СТАРТ", takts: 1 },
    { id: 1, key: "inner", name: "Внутренний круг", takts: 4 },
    { id: 2, key: "ring", name: "Кольцо типов", takts: 6 },
    { id: 3, key: "spec", name: "Специализация", takts: 4 },
    { id: 4, key: "done", name: "Итог «Я»", takts: 0 },
];

// Сторона «МЫ» устроена иначе, и это не вариация той же партии. Фишки по полю не ходят
// вовсе: команда берёт девять задач такта, выкладывает жетоны направлений, решает
// задания и закрывает такт — девять жетонов переворачиваются цветной стороной, девять
// звёзд встают на трек индекса зрелости. Четыре такта по девять задач дают 36 карт,
// 36 жетонов и 36 звёзд — ровно ёмкость набора.
export const PHASES_MY = [
    { id: 0, key: "setup", name: "Полотно перевёрнуто", takts: 1 },
    { id: 1, key: "takt", name: "Такты", takts: 4 },
    { id: 2, key: "done", name: "Итог «МЫ»", takts: 0 },
];

// Девять задач такта: какое направление легло в каждую клетку. Числа — индексы DIRS в
// fieldLayout.mjs, план тот же, что разыгрывает демонстрация.
export const MY_PLANS = [
    [0, 3, 1, 4, 2, 5, 0, 1, 4],
    [2, 5, 0, 3, 1, 4, 3, 5, 2],
    [1, 4, 0, 2, 5, 3, 0, 1, 2],
    [5, 2, 3, 0, 4, 1, 4, 5, 3],
];

export const MY_DIR_IDS = ["knowledge", "external", "space", "security", "analytics", "automation"];

export function phasesOf(room) {
    return room?.side === "my" ? PHASES_MY : PHASES;
}

// Внешний круг выдаёт по карте на каждый из шести типов. Источники здесь расходятся:
// 2D-плеер говорит «карт здесь не берут», 3D-сценарий выдаёт. Взята версия 3D, потому
// что только с ней сходится арифметика раздела: пять карт типа = одна на круге плюс
// четыре на луче. Смена правила — это значение и ничего больше.
export const RING_DEALS_CARD = true;

// Путь специализации: свой сектор кольца, затем три гекса своего луча наружу.
export function specPath(typeId) {
    return [`type:${typeId}:sector`, `type:${typeId}:ray:0`, `type:${typeId}:ray:1`, `type:${typeId}:ray:2`];
}

export function phaseOf(room) {
    const list = phasesOf(room);
    return list[Math.min(room.phase ?? 0, list.length - 1)];
}

// Клетка текущего такта. На общих фазах она одна на всю команду, на специализации своя
// у каждого — по выбранному типу.
export function targetCell(room, seat) {
    const phase = room.phase ?? 0;
    const takt = room.taktIndex ?? 0;

    // На стороне «МЫ» фишки не ходят: там играют жетоны, карты и трек звёзд, а миплы
    // лежат в лотке. Пустая цель закрывает и подсветку, и ход на сервере.
    if (room.side === "my") return null;

    if (phase === 0) return "start";
    if (phase === 1) return `inner:${takt}`;
    if (phase === 2) return `type:${TYPE_IDS[takt]}:sector`;
    if (phase === 3) {
        if (!seat?.typeId) return null; // тип не выбран — ходить некуда
        return specPath(seat.typeId)[takt] || null;
    }
    return null;
}

// Куда этому месту разрешено пойти прямо сейчас. Пустой список значит «стоит там, где
// надо» либо «партия кончилась» — и то, и другое одинаково запрещает ход.
export function allowedCells(room, seat) {
    const target = targetCell(room, seat);
    if (!target) return [];
    if (seat?.cell === target) return [];
    return [target];
}

export function canMove(room, seat, cell) {
    return allowedCells(room, seat).includes(cell);
}

// Кто ещё не дошёл до клетки текущего такта. Мастеру это и есть ответ на вопрос
// «можно ли принимать»: пока список не пуст, команда не собралась.
export function pendingSeats(room) {
    return (room.seats || []).filter((seat) => {
        if (!seat.memberId) return false;
        const target = targetCell(room, seat);
        return target !== null && seat.cell !== target;
    });
}

// Карты такта: что выложить на стол, когда такт начинается.
//
// На общих фазах карта одна на команду и лежит в общем слоте разбора; на специализации
// каждому своя из стопки его типа. Карты кладутся не на клетку — карта вдвое шире
// гекса, — а в ряд разбора у ближней кромки стола, как в демонстрации.
export function taktDeals(room) {
    const phase = room.phase ?? 0;
    const takt = room.taktIndex ?? 0;

    // Такт «МЫ»: девять карт из шести разделов по плану такта, по одной на задачу.
    if (room.side === "my") {
        if (phase !== 1) return [];
        return (MY_PLANS[takt] || []).map((dir, cell) => ({ stack: MY_DIR_IDS[dir], slot: "row", cell, of: MY_PLANS[takt].length, dir }));
    }

    if (phase === 1) return [{ stack: "start", slot: "team" }];
    if (phase === 2) return RING_DEALS_CARD ? [{ stack: TYPE_IDS[takt], slot: "team" }] : [];
    if (phase === 3) {
        return (room.seats || [])
            .filter((seat) => seat.memberId && seat.typeId)
            .map((seat) => ({ stack: seat.typeId, slot: "seat", seatIndex: seat.index }));
    }
    return [];
}

// Следующий такт после принятого. Возвращает { phase, taktIndex } либо null, если
// партия дошла до конца.
export function nextTakt(room) {
    const phase = room.phase ?? 0;
    const takt = room.taktIndex ?? 0;
    const list = phasesOf(room);
    const current = list[phase];
    if (!current) return null;

    if (takt + 1 < current.takts) return { phase, taktIndex: takt + 1 };

    const next = list[phase + 1];
    if (!next) return null;
    return { phase: next.id, taktIndex: 0 };
}

// Подпись такта для панели: «Внутренний круг · такт 2 из 4».
export function taktLabel(room) {
    const phase = phaseOf(room);
    if (!phase) return "";
    const side = room?.side === "my" ? "МЫ" : "Я";
    if (phase.takts <= 1) return `${side} · ${phase.name}`;
    return `${side} · ${phase.name} · ${(room.taktIndex ?? 0) + 1} из ${phase.takts}`;
}

// Закончена ли сторона целиком: на «Я» это фаза итога, на «МЫ» — тоже. Мастеру по этому
// признаку показывается переход на вторую сторону, а не «принять такт».
export function sideFinished(room) {
    return phaseOf(room)?.key === "done";
}

// Что мешает принять такт прямо сейчас. Пустая строка — можно принимать.
export function acceptBlocker(room) {
    const phase = room.phase ?? 0;
    // На «МЫ» ждать некого: фишки не ходят, задания решают в тренажёре, а такт закрывает
    // мастер, когда команда сдала девять задач.
    if (room.side === "my") {
        if (!(room.seats || []).some((seat) => seat.memberId)) return "За столом никого нет";
        return "";
    }
    // Направление нужно знать до того, как команда разойдётся по лучам: карты первого
    // такта специализации приходят из стопки своего типа в тот же миг, когда фаза
    // начинается. Без этой проверки первый такт оставался без карт вовсе — шестеро
    // расходились по лучам с пустым столом.
    const next = nextTakt(room);
    const needsType = phase >= 3 || next?.phase === 3;
    if (needsType && (room.seats || []).some((seat) => seat.memberId && !seat.typeId)) {
        return "Не все выбрали направление";
    }
    const waiting = pendingSeats(room);
    if (waiting.length) {
        return `Не дошли: ${waiting.map((seat) => seat.name || `место ${seat.index + 1}`).join(", ")}`;
    }
    if (!(room.seats || []).some((seat) => seat.memberId)) return "За столом никого нет";
    return "";
}
