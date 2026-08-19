// node --test src/components/features/tools-2/utils/mayakTrainerLocalState.test.mjs
// Проверка одна: смена личности чистит состояние прогона, а тот же вход — нет.

import test from "node:test";
import assert from "node:assert/strict";

import { resetTrainerLocalState, syncTrainerLocalIdentity } from "./mayakTrainerLocalState.mjs";

function createStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        get length() {
            return data.size;
        },
        key: (index) => Array.from(data.keys())[index] ?? null,
        getItem: (key) => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: (key) => data.delete(key),
        has: (key) => data.has(key),
    };
}

function primeStores(extra = {}) {
    globalThis.localStorage = createStorage({
        trainer_v2_completedTasks: '{"guest-1":{}}',
        trainer_v2_session_tasks_log: '[{"number":"7"}]',
        trainer_v2_sessionStartTime: "1755000000000",
        trainer_v2_buffer: '{"m":["текст"]}',
        trainer_v2_history: '[{"date":"2026-08-01"}]',
        portal_profile_cache: "keep-me",
        ...extra,
    });
    globalThis.sessionStorage = createStorage({
        trainer_v2_currentTaskIndex: "12",
        trainer_v2_taskTimer: '{"isRunning":true}',
    });
}

test("новая личность сбрасывает прогон, архив и чужие ключи остаются", () => {
    primeStores();

    const didReset = syncTrainerLocalIdentity({ userId: "guest-2", sessionId: "s-2", token: "tok-2" });

    assert.equal(didReset, true);
    assert.equal(globalThis.localStorage.has("trainer_v2_completedTasks"), false);
    assert.equal(globalThis.localStorage.has("trainer_v2_sessionStartTime"), false);
    assert.equal(globalThis.localStorage.has("trainer_v2_buffer"), false);
    assert.equal(globalThis.sessionStorage.has("trainer_v2_currentTaskIndex"), false);
    assert.equal(globalThis.sessionStorage.has("trainer_v2_taskTimer"), false);

    assert.equal(globalThis.localStorage.getItem("trainer_v2_history"), '[{"date":"2026-08-01"}]');
    assert.equal(globalThis.localStorage.getItem("portal_profile_cache"), "keep-me");
    assert.equal(globalThis.localStorage.getItem("trainer_v2_prev_session_tasks_log"), '[{"number":"7"}]');
});

test("тот же вход состояние не трогает", () => {
    primeStores({ trainer_v2_identity: "guest-1|s-1|tok-1" });

    const didReset = syncTrainerLocalIdentity({ userId: "guest-1", sessionId: "s-1", token: "tok-1" });

    assert.equal(didReset, false);
    assert.equal(globalThis.localStorage.getItem("trainer_v2_completedTasks"), '{"guest-1":{}}');
    assert.equal(globalThis.sessionStorage.getItem("trainer_v2_currentTaskIndex"), "12");
});

// Упрощённая ссылка — legacy-токен без sessionId: отличать входы приходится
// по значению токена, иначе переход внутри одной сессии выглядит продолжением.
test("смена токена без sessionId считается новой личностью", () => {
    primeStores({ trainer_v2_identity: "guest-1||tok-plain-1" });

    const didReset = syncTrainerLocalIdentity({ userId: "guest-1", sessionId: "", token: "tok-plain-2" });

    assert.equal(didReset, true);
    assert.equal(globalThis.localStorage.has("trainer_v2_completedTasks"), false);
});

test("пустая личность ничего не сбрасывает", () => {
    primeStores({ trainer_v2_identity: "guest-1|s-1|tok-1" });

    const didReset = syncTrainerLocalIdentity({ userId: "", sessionId: "", token: "" });

    assert.equal(didReset, false);
    assert.equal(globalThis.localStorage.getItem("trainer_v2_completedTasks"), '{"guest-1":{}}');
});

test("недоступное хранилище не роняет сброс", () => {
    globalThis.localStorage = {
        get length() {
            throw new Error("SecurityError: приватный режим");
        },
        key: () => null,
        getItem: () => {
            throw new Error("SecurityError: приватный режим");
        },
        setItem: () => {},
        removeItem: () => {},
    };
    globalThis.sessionStorage = createStorage({ trainer_v2_taskTimer: "{}" });

    assert.doesNotThrow(() => resetTrainerLocalState());
});
