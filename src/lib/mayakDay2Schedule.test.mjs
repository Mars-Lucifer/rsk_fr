// node --test src/lib/mayakDay2Schedule.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import {
    DAY2_TAKTS,
    day2TaktStatus,
    day2DefaultSeconds,
    clampDay2TaktSeconds,
    formatDay2Remaining,
} from "./mayakDay2Schedule.js";

const START = Date.parse("2026-09-15T09:00:00.000Z");
const at = (minutes) => START + minutes * 60 * 1000;
const takt = (index, minutes) => ({
    index,
    startedAt: new Date(START).toISOString(),
    durationSeconds: (minutes ?? DAY2_TAKTS[index - 1].minutes) * 60,
});

test("расписание — 90, 70 и 45 минут", () => {
    assert.equal(day2DefaultSeconds(1), 90 * 60);
    assert.equal(day2DefaultSeconds(2), 70 * 60);
    assert.equal(day2DefaultSeconds(3), 45 * 60);
    assert.equal(day2DefaultSeconds(4), 0);
});

test("не начатый такт показывает полную длительность, а не ноль", () => {
    const status = day2TaktStatus({ index: 1, startedAt: null }, at(0));
    assert.equal(status.running, false);
    assert.equal(status.remainingSeconds, 90 * 60);
    assert.equal(status.expiresAt, null);
    assert.equal(status.mark, null);
});

test("остаток считается от серверной метки старта", () => {
    const status = day2TaktStatus(takt(1), at(20));
    assert.equal(status.running, true);
    assert.equal(status.elapsedSeconds, 20 * 60);
    assert.equal(status.remainingSeconds, 70 * 60);
    assert.equal(Date.parse(status.expiresAt), at(90));
});

test("время вышло — такт не гаснет сам, а помечается просроченным", () => {
    const status = day2TaktStatus(takt(1), at(95));
    assert.equal(status.overdue, true);
    assert.equal(status.remainingSeconds, 0);
    // Просроченный такт отметок не показывает: они про работу, а не про то,
    // что ведущий не нажал кнопку.
    assert.equal(status.mark, null);
});

test("отметка первого такта приходит за 30 минут до конца", () => {
    assert.equal(day2TaktStatus(takt(1), at(59)).mark, null);
    const mark = day2TaktStatus(takt(1), at(61)).mark;
    assert.equal(mark?.id, "detail-check-on-neighbour");
    assert.match(mark.text, /телефон соседа/i);
});

test("отметка второго такта — через 25 минут после начала", () => {
    assert.equal(day2TaktStatus(takt(2), at(20)).mark, null);
    assert.equal(day2TaktStatus(takt(2), at(30)).mark?.id, "node-mismatch-is-normal");
    // Окно закрывается: к концу такта подсказка про «не сошлось» уже поздна.
    assert.equal(day2TaktStatus(takt(2), at(50)).mark, null);
});

test("отметка третьего такта — за 10 минут до конца", () => {
    assert.equal(day2TaktStatus(takt(3), at(30)).mark, null);
    assert.equal(day2TaktStatus(takt(3), at(40)).mark?.id, "product-acceptance-checks");
});

test("отметки не путаются тактами", () => {
    // За 30 минут до конца второго такта отметка первого не всплывает.
    assert.equal(day2TaktStatus(takt(2), at(45)).mark, null);
});

test("сдвиг такта ограничен разумным", () => {
    assert.equal(clampDay2TaktSeconds(60), 5 * 60);
    assert.equal(clampDay2TaktSeconds(100 * 60 * 60), 4 * 60 * 60);
    assert.equal(clampDay2TaktSeconds(80 * 60), 80 * 60);
    assert.equal(clampDay2TaktSeconds("нет"), 0);
});

test("остаток печатается как MM:SS", () => {
    assert.equal(formatDay2Remaining(47 * 60 + 12), "47:12");
    assert.equal(formatDay2Remaining(0), "00:00");
    assert.equal(formatDay2Remaining(-5), "00:00");
});
