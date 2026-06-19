// Звук окончания таймера дашборда сессии.
//
// Готового аудио-файла в проекте нет, поэтому звук синтезируется через Web Audio
// API (без бинарных ассетов): мягкий трёхнотный мажорный аккорд (C6-E6-G6),
// который повторяется ~10 секунд, пока его не остановят (пауза/сброс).
//
// Браузеры блокируют автозапуск звука без пользовательского жеста, поэтому
// контекст создаётся/возобновляется по клику «Старт» через resumeTimerAudio().

let audioContext = null;
let activeNodes = []; // активные осцилляторы/гейны текущего аккорда
let repeatTimer = null; // setInterval — повтор аккорда
let stopTimer = null; // setTimeout — авто-стоп через 10с

const TOTAL_DURATION_MS = 10000; // звук длится хотя бы 10 секунд
const REPEAT_EVERY_MS = 1600; // интервал между повторами аккорда

function getContext() {
    if (typeof window === "undefined") return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioContext) {
        try {
            audioContext = new Ctx();
        } catch {
            return null;
        }
    }
    return audioContext;
}

// Вызывать на пользовательский жест (клик «Старт»), чтобы разблокировать звук.
export function resumeTimerAudio() {
    const ctx = getContext();
    if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
    }
}

function playNote(ctx, frequency, startAt, duration) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;

    // Мягкая огибающая: быстрый подъём, плавное затухание.
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);

    const node = { osc, gain };
    activeNodes.push(node);
    osc.onended = () => {
        activeNodes = activeNodes.filter((n) => n !== node);
    };
}

// Один трёхнотный аккорд-«колокольчик» (C6, E6, G6 лёгким арпеджио).
function playChimeOnce() {
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    playNote(ctx, 1046.5, now, 1.0);
    playNote(ctx, 1318.5, now + 0.12, 1.0);
    playNote(ctx, 1568.0, now + 0.24, 1.1);
}

// Запускает звук окончания: аккорд повторяется ~10 секунд или до stopTimerSound().
export function playTimerEndChime() {
    stopTimerSound(); // сброс предыдущего звучания, если было
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
    }
    playChimeOnce();
    repeatTimer = setInterval(playChimeOnce, REPEAT_EVERY_MS);
    stopTimer = setTimeout(() => stopTimerSound(), TOTAL_DURATION_MS);
}

// Немедленно останавливает звук (по паузе/сбросу таймера или авто-стопу).
export function stopTimerSound() {
    if (repeatTimer) {
        clearInterval(repeatTimer);
        repeatTimer = null;
    }
    if (stopTimer) {
        clearTimeout(stopTimer);
        stopTimer = null;
    }
    activeNodes.forEach(({ osc, gain }) => {
        try {
            gain.gain.cancelScheduledValues(0);
        } catch {}
        try {
            osc.stop();
        } catch {}
        try {
            osc.disconnect();
            gain.disconnect();
        } catch {}
    });
    activeNodes = [];
}
