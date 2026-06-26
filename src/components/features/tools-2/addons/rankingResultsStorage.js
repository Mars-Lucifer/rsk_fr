// Хранилище результатов теста-ранжирования в localStorage (вынесено из
// RankingTestPopup, этап 5). Ключи и доступ к localStorage инкапсулированы
// здесь; компонент работает только через эти функции.

const STORAGE_KEY = "trainer_v2_rankingTestResults";
const PREVIOUS_STORAGE_KEY = "trainer_v2_rankingTestResults_previous";

export function loadSavedResults() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function loadPreviousResults() {
    try {
        const raw = localStorage.getItem(PREVIOUS_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function saveResults(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error("Ошибка сохранения результатов тестирования:", e);
    }
}

// Перенос текущих результатов в «предыдущие» (для сравнения при пересдаче).
export function savePreviousResults(data) {
    try {
        localStorage.setItem(PREVIOUS_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error("Ошибка сохранения предыдущих результатов:", e);
    }
}

// Очистка текущих результатов (при старте пересдачи).
export function clearCurrentResults() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // no-op
    }
}
